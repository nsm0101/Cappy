//
//  RealtimeService.swift
//  Cappy
//
//  A compact Supabase Realtime client (Phoenix v1 JSON protocol over a
//  WebSocket) supporting `postgres_changes` INSERT subscriptions. Mirrors
//  app/src/api/realtime.ts (subscribeFamilyDoses).
//
//  Realtime is a live-update convenience: every screen also refreshes on
//  appear and after actions, so subscription failures are non-fatal and are
//  swallowed silently.
//

import Foundation

/// Cancel handle for a realtime subscription.
final class RealtimeSubscription {
    private let onCancel: () -> Void
    private var cancelled = false
    init(onCancel: @escaping () -> Void) { self.onCancel = onCancel }
    func cancel() {
        guard !cancelled else { return }
        cancelled = true
        onCancel()
    }
    deinit { cancel() }
}

final class RealtimeService {
    /// The shared client is resolved lazily at use time (never during init).
    private var client: SupabaseClient { SupabaseClient.shared }
    private let queue = DispatchQueue(label: "cappy.realtime")
    private var task: URLSessionWebSocketTask?
    private var refCounter = 0
    private var heartbeatTimer: DispatchSourceTimer?
    private var channelSeq = 0

    private struct Channel {
        let topic: String
        let table: String
        let filter: String
        let onChange: () -> Void
    }
    private var channels: [String: Channel] = [:]
    private var isConnecting = false

    init() {}

    // MARK: Public API

    /// Subscribe to INSERTs on `dose_events` for a family. `onInsert` runs on
    /// the main thread.
    func subscribeFamilyDoses(familyId: String, onInsert: @escaping () -> Void) -> RealtimeSubscription {
        subscribe(table: "dose_events", filter: "family_id=eq.\(familyId)", onChange: onInsert)
    }

    func subscribe(table: String, filter: String, onChange: @escaping () -> Void) -> RealtimeSubscription {
        var topic = ""
        queue.sync {
            channelSeq += 1
            topic = "realtime:cappy:\(table):\(channelSeq)"
            channels[topic] = Channel(topic: topic, table: table, filter: filter) {
                DispatchQueue.main.async { onChange() }
            }
        }
        connectIfNeeded()
        queue.async { [weak self] in self?.joinChannel(topic) }
        return RealtimeSubscription { [weak self] in
            self?.queue.async {
                guard let self, let ch = self.channels[topic] else { return }
                self.send(["topic": ch.topic, "event": "phx_leave", "payload": [:], "ref": self.nextRef()])
                self.channels[topic] = nil
                if self.channels.isEmpty { self.teardown() }
            }
        }
    }

    // MARK: Socket lifecycle

    private func connectIfNeeded() {
        queue.async { [weak self] in
            guard let self, self.task == nil, !self.isConnecting else { return }
            self.isConnecting = true
            let ws = self.client.session.webSocketTask(with: SupabaseConfig.realtimeURL)
            self.task = ws
            ws.resume()
            self.isConnecting = false
            self.receiveLoop()
            self.startHeartbeat()
        }
    }

    private func teardown() {
        heartbeatTimer?.cancel(); heartbeatTimer = nil
        task?.cancel(with: .goingAway, reason: nil)
        task = nil
    }

    private func startHeartbeat() {
        let timer = DispatchSource.makeTimerSource(queue: queue)
        timer.schedule(deadline: .now() + 25, repeating: 25)
        timer.setEventHandler { [weak self] in
            guard let self else { return }
            self.send(["topic": "phoenix", "event": "heartbeat", "payload": [:], "ref": self.nextRef()])
        }
        timer.resume()
        heartbeatTimer = timer
    }

    private func joinChannel(_ topic: String) {
        guard let ch = channels[topic] else { return }
        let payload: [String: Any] = [
            "config": [
                "postgres_changes": [
                    ["event": "INSERT", "schema": "public", "table": ch.table, "filter": ch.filter]
                ]
            ],
            "access_token": client.bearerToken
        ]
        send(["topic": topic, "event": "phx_join", "payload": payload, "ref": nextRef()])
    }

    // MARK: Send / receive

    private func nextRef() -> String {
        refCounter += 1
        return String(refCounter)
    }

    private func send(_ object: [String: Any]) {
        guard let task, let data = try? JSONSerialization.data(withJSONObject: object),
              let string = String(data: data, encoding: .utf8) else { return }
        task.send(.string(string)) { _ in /* non-fatal */ }
    }

    private func receiveLoop() {
        guard let task else { return }
        task.receive { [weak self] result in
            guard let self else { return }
            switch result {
            case .failure:
                // Socket dropped — reconnect after a short delay if channels remain.
                self.queue.asyncAfter(deadline: .now() + 3) {
                    guard !self.channels.isEmpty else { return }
                    self.task = nil
                    self.connectIfNeeded()
                    for topic in self.channels.keys { self.joinChannel(topic) }
                }
            case .success(let message):
                self.handle(message)
                self.queue.async { self.receiveLoop() }
            }
        }
    }

    private func handle(_ message: URLSessionWebSocketTask.Message) {
        var text: String?
        switch message {
        case .string(let s): text = s
        case .data(let d): text = String(data: d, encoding: .utf8)
        @unknown default: break
        }
        guard let text,
              let data = text.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let topic = obj["topic"] as? String,
              let event = obj["event"] as? String
        else { return }

        // Realtime delivers row changes as a "postgres_changes" event.
        if event == "postgres_changes" || event == "INSERT" {
            queue.async { [weak self] in self?.channels[topic]?.onChange() }
        }
    }
}
