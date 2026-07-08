import ExpoModulesCore
import MultipeerConnectivity
import NearbyInteraction

/// Cappy Proximity Share
///
/// Direct iPhone-to-iPhone transfer of a family-invite link: bring two
/// phones close together and the link transfers automatically, no share
/// sheet, no physical tag. This is the "most up-to-date iOS-to-iOS" path —
/// built on the same two frameworks NameDrop itself uses, since Apple gives
/// third-party apps no public API to trigger NameDrop directly.
///
/// How it works:
///  1. Multipeer Connectivity (MC) finds the other phone over Bluetooth/Wi-Fi
///     and opens an encrypted data channel. Both phones simultaneously
///     advertise AND browse, so either side can be "sender" or "receiver" —
///     whichever discovers the other first initiates the connection.
///  2. Once connected, both sides exchange their Nearby Interaction (NI)
///     discovery tokens over that MC channel, then start a UWB ranging
///     session to measure live distance between the two phones.
///  3. The sender only transmits the actual invite payload once NI reports
///     the phones are genuinely held together (< `thresholdMeters`, default
///     0.3m). This is the safety gate: MC's discovery range is tens of
///     meters, so without this gate the payload could reach any nearby
///     Cappy user, not just the one being handed the phone.
///
/// Requires iPhone 11 or later (U1/U2 Ultra Wideband chip) on both ends —
/// see `isSupported()`. Devices without the chip should fall back to
/// AirDrop/QR (see ShareViaTapScreen.tsx).
///
/// Privacy note: the advertised peer display name is a random, anonymous
/// string — never the device name or any user-identifying value — since
/// it broadcasts openly to any nearby device browsing the same service
/// type. The only thing transferred is the invite link itself, which is
/// already an opaque, non-PHI join code (see contracts around `nfc_tags`
/// and `invites`).
///
/// Note on structure: the Multipeer/NearbyInteraction machinery lives in a
/// separate `NSObject` coordinator (`ProximityShareCoordinator`) rather than
/// on this class directly. The Cocoa delegate protocols involved
/// (`MCSessionDelegate`, `MCNearbyServiceAdvertiserDelegate`,
/// `MCNearbyServiceBrowserDelegate`, `NISessionDelegate`) are `@objc` and so
/// require `NSObjectProtocol` conformance, which an Expo `Module` — a plain
/// Swift class — cannot provide. The module owns one coordinator and bridges
/// its callbacks to JS events.
public class CappyProximityShareModule: Module {
  private let coordinator = ProximityShareCoordinator()

  public func definition() -> ModuleDefinition {
    Name("CappyProximityShare")

    Events("onPhase", "onRange", "onReceive", "onError")

    // Bridge the coordinator's callbacks to JS events. Set once at module
    // creation; `[weak self]` avoids a module → coordinator → closure → module
    // retain cycle.
    OnCreate {
      self.coordinator.onPhase = { [weak self] phase in
        self?.sendEvent("onPhase", ["phase": phase])
      }
      self.coordinator.onRange = { [weak self] distanceMeters in
        self?.sendEvent("onRange", ["distanceMeters": distanceMeters])
      }
      self.coordinator.onReceive = { [weak self] payload in
        self?.sendEvent("onReceive", ["payload": payload])
      }
      self.coordinator.onError = { [weak self] message in
        self?.sendEvent("onError", ["message": message])
      }
    }

    Function("isSupported") { () -> Bool in
      NISession.isSupported
    }

    Function("startSending") { (payload: String, thresholdMeters: Double) in
      self.coordinator.startSending(payload: payload, thresholdMeters: thresholdMeters)
    }

    Function("startReceiving") { () in
      self.coordinator.startReceiving()
    }

    Function("stop") {
      self.coordinator.stop()
    }

    OnStopObserving {
      self.coordinator.stop()
    }

    OnDestroy {
      self.coordinator.stop()
    }
  }
}

/// Owns the Multipeer Connectivity + Nearby Interaction sessions and adopts
/// the Cocoa delegate protocols. Kept as an `NSObject` subclass precisely so
/// it *can* adopt those `@objc` protocols (see the note on the module above).
final class ProximityShareCoordinator: NSObject {
  private static let serviceType = "cappy-inv"

  // Event callbacks, wired up by the owning module.
  var onPhase: ((String) -> Void)?
  var onRange: ((Float) -> Void)?
  var onReceive: ((String) -> Void)?
  var onError: ((String) -> Void)?

  private var peerID: MCPeerID?
  private var session: MCSession?
  private var advertiser: MCNearbyServiceAdvertiser?
  private var browser: MCNearbyServiceBrowser?

  private var niSession: NISession?
  private var niConfig: NINearbyPeerConfiguration?
  private var connectedPeer: MCPeerID?

  private var pendingPayload: String?
  private var isReceivingRole = false
  private var hasCompleted = false
  private var thresholdMeters: Double = 0.3

  // MARK: - Public entry points

  func startSending(payload: String, thresholdMeters: Double) {
    reset()
    pendingPayload = payload
    isReceivingRole = false
    self.thresholdMeters = thresholdMeters > 0 ? thresholdMeters : 0.3
    beginSession()
  }

  func startReceiving() {
    reset()
    pendingPayload = nil
    isReceivingRole = true
    beginSession()
  }

  func stop() {
    reset()
  }

  // MARK: - Session lifecycle

  private func beginSession() {
    guard NISession.isSupported else {
      emitError("Nearby Interaction isn't supported on this iPhone.")
      return
    }

    hasCompleted = false

    // Anonymous, ephemeral peer id — never the real device name.
    let anonymousName = "cappy-\(Int.random(in: 100000...999999))"
    let peerID = MCPeerID(displayName: anonymousName)
    self.peerID = peerID

    let session = MCSession(peer: peerID, securityIdentity: nil, encryptionPreference: .required)
    session.delegate = self
    self.session = session

    let niSession = NISession()
    niSession.delegate = self
    self.niSession = niSession

    let advertiser = MCNearbyServiceAdvertiser(peer: peerID, discoveryInfo: nil, serviceType: Self.serviceType)
    advertiser.delegate = self
    self.advertiser = advertiser
    advertiser.startAdvertisingPeer()

    let browser = MCNearbyServiceBrowser(peer: peerID, serviceType: Self.serviceType)
    browser.delegate = self
    self.browser = browser
    browser.startBrowsingForPeers()

    emitPhase("searching")
  }

  private func reset() {
    advertiser?.stopAdvertisingPeer()
    browser?.stopBrowsingForPeers()
    session?.disconnect()
    niSession?.invalidate()

    advertiser = nil
    browser = nil
    session = nil
    niSession = nil
    niConfig = nil
    peerID = nil
    connectedPeer = nil
    pendingPayload = nil
    hasCompleted = false

    emitPhase("stopped")
  }

  // MARK: - Messaging envelope
  //
  // A tiny tagged envelope so a single MCSession data channel can carry
  // both the NI discovery-token handshake and the eventual invite payload
  // without ambiguity.

  private struct Envelope: Codable {
    let kind: String // "token" | "payload"
    let data: String // base64-encoded NIDiscoveryToken, or the raw invite link
  }

  private func sendToken(_ token: NIDiscoveryToken, to peer: MCPeerID) {
    guard let session = session,
          let tokenData = try? NSKeyedArchiver.archivedData(withRootObject: token, requiringSecureCoding: true)
    else { return }
    let envelope = Envelope(kind: "token", data: tokenData.base64EncodedString())
    guard let json = try? JSONEncoder().encode(envelope) else { return }
    try? session.send(json, toPeers: [peer], with: .reliable)
  }

  private func sendPayloadIfReady(distance: Float) {
    guard !isReceivingRole,
          !hasCompleted,
          let payload = pendingPayload,
          let session = session,
          let peer = connectedPeer,
          Double(distance) <= thresholdMeters
    else { return }

    let envelope = Envelope(kind: "payload", data: payload)
    guard let json = try? JSONEncoder().encode(envelope) else { return }
    do {
      try session.send(json, toPeers: [peer], with: .reliable)
      hasCompleted = true
      emitPhase("sent")
    } catch {
      emitError("Couldn't send: \(error.localizedDescription)")
    }
  }

  private func handleReceivedData(_ data: Data, from peer: MCPeerID) {
    guard let envelope = try? JSONDecoder().decode(Envelope.self, from: data) else { return }

    switch envelope.kind {
    case "token":
      guard let tokenData = Data(base64Encoded: envelope.data),
            let token = try? NSKeyedUnarchiver.unarchivedObject(ofClass: NIDiscoveryToken.self, from: tokenData)
      else { return }
      DispatchQueue.main.async {
        self.startRanging(with: token)
      }
    case "payload":
      guard isReceivingRole, !hasCompleted else { return }
      hasCompleted = true
      DispatchQueue.main.async {
        self.onReceive?(envelope.data)
        self.emitPhase("received")
      }
    default:
      break
    }
  }

  private func startRanging(with token: NIDiscoveryToken) {
    guard let niSession = niSession else { return }
    let config = NINearbyPeerConfiguration(peerToken: token)
    niConfig = config
    niSession.run(config)
    emitPhase("ranging")
  }

  // MARK: - Event helpers

  private func emitPhase(_ phase: String) {
    DispatchQueue.main.async {
      self.onPhase?(phase)
    }
  }

  private func emitError(_ message: String) {
    DispatchQueue.main.async {
      self.onError?(message)
    }
  }
}

// MARK: - MCSessionDelegate

extension ProximityShareCoordinator: MCSessionDelegate {
  func session(_ session: MCSession, peer peerID: MCPeerID, didChange state: MCSessionState) {
    switch state {
    case .connected:
      // Only track one peer at a time — first connection wins, matching
      // the "tap two specific phones together" mental model rather than
      // a multi-device broadcast.
      guard connectedPeer == nil else { return }
      connectedPeer = peerID
      emitPhase("connected")
      if let niSession = niSession, let token = niSession.discoveryToken {
        sendToken(token, to: peerID)
      }
    case .notConnected:
      if connectedPeer == peerID {
        connectedPeer = nil
        if !hasCompleted {
          emitPhase("disconnected")
        }
      }
    case .connecting:
      break
    @unknown default:
      break
    }
  }

  func session(_ session: MCSession, didReceive data: Data, fromPeer peerID: MCPeerID) {
    handleReceivedData(data, from: peerID)
  }

  // Unused MCSessionDelegate stream/resource callbacks — required by the
  // protocol but not part of this feature.
  func session(_ session: MCSession, didReceive stream: InputStream, withName streamName: String, fromPeer peerID: MCPeerID) {}
  func session(_ session: MCSession, didStartReceivingResourceWithName resourceName: String, fromPeer peerID: MCPeerID, with progress: Progress) {}
  func session(_ session: MCSession, didFinishReceivingResourceWithName resourceName: String, fromPeer peerID: MCPeerID, at localURL: URL?, withError error: Error?) {}
}

// MARK: - MCNearbyServiceAdvertiserDelegate

extension ProximityShareCoordinator: MCNearbyServiceAdvertiserDelegate {
  func advertiser(
    _ advertiser: MCNearbyServiceAdvertiser,
    didReceiveInvitationFromPeer peerID: MCPeerID,
    withContext context: Data?,
    invitationHandler: @escaping (Bool, MCSession?) -> Void
  ) {
    // Accept the first invitation only; ignore the rest so we don't end up
    // juggling multiple simultaneous nearby Cappy phones.
    invitationHandler(connectedPeer == nil, session)
  }
}

// MARK: - MCNearbyServiceBrowserDelegate

extension ProximityShareCoordinator: MCNearbyServiceBrowserDelegate {
  func browser(_ browser: MCNearbyServiceBrowser, foundPeer peerID: MCPeerID, withDiscoveryInfo info: [String: String]?) {
    guard connectedPeer == nil, let session = session else { return }
    browser.invitePeer(peerID, to: session, withContext: nil, timeout: 10)
  }

  func browser(_ browser: MCNearbyServiceBrowser, lostPeer peerID: MCPeerID) {
    // No action needed — MCSession's didChange(.notConnected) covers the
    // case where we were actually connected to this peer.
  }
}

// MARK: - NISessionDelegate

extension ProximityShareCoordinator: NISessionDelegate {
  func session(_ session: NISession, didUpdate nearbyObjects: [NINearbyObject]) {
    guard let object = nearbyObjects.first, let distance = object.distance else { return }
    DispatchQueue.main.async {
      self.onRange?(distance)
    }
    sendPayloadIfReady(distance: distance)
  }

  func session(_ session: NISession, didRemove nearbyObjects: [NINearbyObject], reason: NINearbyObject.RemovalReason) {
    // The peer moved out of range or ranging otherwise stopped — nothing
    // to clean up here beyond what didChange(.notConnected) already does.
  }

  func sessionWasSuspended(_ session: NISession) {
    emitPhase("suspended")
  }

  func sessionSuspensionEnded(_ session: NISession) {
    guard let config = niConfig else { return }
    session.run(config)
    emitPhase("ranging")
  }

  func session(_ session: NISession, didInvalidateWith error: Error) {
    if !hasCompleted {
      emitError("Nearby Interaction session ended: \(error.localizedDescription)")
    }
  }
}
