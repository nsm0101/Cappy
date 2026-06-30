import SwiftUI

struct HomeDashboardView: View {
    @EnvironmentObject var nfcManager: NFCManager
    
    @Binding var children: [Child]
    @Binding var medications: [Medication]
    @Binding var doseTimeline: [DoseEvent]
    
    @State private var selectedChildForManualLog: Child? = nil
    @State private var isShowingNFCScanScreen = false
    
    var body: some View {
        NavigationView {
            ZStack {
                Color.cappyBackground
                    .ignoresSafeArea()
                
                ScrollView {
                    VStack(alignment: .leading, spacing: 24) {
                        // Header
                        headerView
                        
                        // NFC Pulse Call-to-Action
                        nfcScanCard
                        
                        // Children Section
                        childrenSection
                        
                        // Recent Timeline Section
                        timelineSection
                        
                        Spacer(minLength: 40)
                    }
                    .padding(.horizontal, 20)
                }
            }
            .navigationBarHidden(true)
            .sheet(item: Binding<IdentifiableString?>(
                get: { nfcManager.scannedTagUID.map { IdentifiableString(value: $0) } },
                set: { nfcManager.scannedTagUID = $0?.value }
            )) { tag in
                NFCQuickAccessSheet(
                    tagUID: tag.value,
                    children: $children,
                    medications: $medications,
                    doseTimeline: $doseTimeline
                )
                .presentationDetents([.medium, .large])
            }
        }
    }
    
    // MARK: - Subviews
    private var headerView: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Text("Cappy!")
                        .font(CappyFont.displayBlack(size: 28))
                        .foregroundColor(.cappyTeal)
                    
                    Text("🌙") // indicator for 3am parents
                        .font(.title2)
                }
                
                Text("Pediatric medication safety log")
                    .font(CappyFont.body(size: 14))
                    .foregroundColor(.cappyTextMuted)
            }
            Spacer()
            
            // Mascot/Caregiver Profile Icon
            Image(systemName: "person.2.fill")
                .foregroundColor(.cappyTeal)
                .padding(10)
                .background(Color.cappyTealLight)
                .clipShape(Circle())
        }
        .padding(.top, 16)
    }
    
    private var nfcScanCard: some View {
        VStack(spacing: 16) {
            ZStack {
                // Outer Pulse
                Circle()
                    .fill(Color.nfcGlow)
                    .frame(width: 80, height: 80)
                    .scaleEffect(nfcManager.isScanning ? 1.2 : 1.0)
                    .animation(nfcManager.isScanning ? Animation.easeInOut(duration: 1.0).repeatForever(autoreverses: true) : .default, value: nfcManager.isScanning)
                
                // Core
                Circle()
                    .fill(Color.nfcCore)
                    .frame(width: 56, height: 56)
                
                Image(systemName: "sensor.tag.radiowaves.forward")
                    .font(.title2)
                    .foregroundColor(.white)
            }
            
            VStack(spacing: 4) {
                Text("Tap NFC Tag to Log Dose")
                    .font(CappyFont.display(size: 16))
                    .foregroundColor(.cappyText)
                
                Text("Hold phone near medication bottle tag")
                    .font(CappyFont.body(size: 13))
                    .foregroundColor(.cappyTextMuted)
            }
            
            Button(action: {
                nfcManager.startScanning()
            }) {
                Text(nfcManager.isScanning ? "Scanning..." : "Start NFC Scan")
                    .font(CappyFont.uiMedium(size: 14))
                    .foregroundColor(.white)
                    .padding(.horizontal, 24)
                    .padding(.vertical, 10)
                    .background(Color.cappyTeal)
                    .cornerRadius(12)
            }
            .disabled(nfcManager.isScanning)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 24)
        .cappyCard()
    }
    
    private var childrenSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Children")
                .font(CappyFont.display(size: 18))
                .foregroundColor(.cappyText)
            
            ForEach(children) { child in
                let (status, lastDoseText) = getDoseStatus(for: child)
                
                HStack(spacing: 16) {
                    ChildAvatar(initials: child.initials, themeColor: child.themeColor, size: 52)
                    
                    VStack(alignment: .leading, spacing: 4) {
                        Text(child.name)
                            .font(CappyFont.display(size: 16))
                            .foregroundColor(.cappyText)
                        
                        Text(lastDoseText)
                            .font(CappyFont.body(size: 12))
                            .foregroundColor(.cappyTextMuted)
                    }
                    
                    Spacer()
                    
                    DoseStatusPill(status: status, size: .sm)
                }
                .padding(16)
                .background(Color.cappyCard)
                .cornerRadius(12)
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(Color.cappyText.opacity(0.06), lineWidth: 1)
                )
            }
        }
    }
    
    private var timelineSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Recent Dose Activity")
                .font(CappyFont.display(size: 18))
                .foregroundColor(.cappyText)
            
            if doseTimeline.isEmpty {
                VStack(spacing: 8) {
                    Text("No medication logged yet")
                        .font(CappyFont.uiMedium(size: 14))
                        .foregroundColor(.cappyTextMuted)
                    Text("Logs will sync automatically across caregivers")
                        .font(CappyFont.body(size: 12))
                        .foregroundColor(.cappyTextMuted)
                        .multilineTextAlignment(.center)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 32)
                .cappyCard()
            } else {
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(Array(doseTimeline.prefix(5).enumerated()), id: \.1.id) { index, event in
                        HStack(alignment: .top, spacing: 16) {
                            // Timeline dot & line
                            VStack(spacing: 0) {
                                Circle()
                                    .fill(Color.cappyTeal)
                                    .frame(width: 10, height: 10)
                                    .padding(.top, 4)
                                
                                if index < min(doseTimeline.count, 5) - 1 {
                                    Rectangle()
                                        .fill(Color.cappyText.opacity(0.1))
                                        .frame(width: 2)
                                        .frame(maxHeight: .infinity)
                                }
                            }
                            
                            VStack(alignment: .leading, spacing: 4) {
                                HStack {
                                    if let child = children.first(where: { $0.id == event.childId }),
                                       let med = medications.first(where: { $0.id == event.medicationId }) {
                                        Text("\(child.name) · \(med.brandName ?? med.name)")
                                            .font(CappyFont.uiMedium(size: 14))
                                            .foregroundColor(.cappyText)
                                    }
                                    Spacer()
                                    Text(event.formattedTime)
                                        .font(CappyFont.mono(size: 11))
                                        .foregroundColor(.cappyTextMuted)
                                }
                                
                                Text("\(event.amountMl.formatted(.number.precision(.fractionLength(1)))) mL (\(Int(event.amountMg)) mg) administered by \(event.loggedBy)")
                                    .font(CappyFont.body(size: 13))
                                    .foregroundColor(.cappyTextMuted)
                            }
                            .padding(.bottom, 16)
                        }
                    }
                }
                .padding(.top, 8)
            }
        }
    }
    
    // MARK: - Helper Methods
    private func getDoseStatus(for child: Child) -> (DoseSafetyStatus, String) {
        let childEvents = doseTimeline.filter { $0.childId == child.id }.sorted(by: { $0.timestamp > $1.timestamp })
        
        guard let lastEvent = childEvents.first else {
            return (.due, "No prior doses logged")
        }
        
        let elapsedSeconds = Date().timeIntervalSince(lastEvent.timestamp)
        let elapsedMinutes = elapsedSeconds / 60
        let elapsedHours = elapsedMinutes / 60
        
        // Define intervals (e.g. 4 hours default)
        let intervalHours: Double = 4.0
        let intervalSeconds = intervalHours * 3600
        
        if elapsedSeconds < 900 { // 15 minutes
            return (.recent, "Just given: \(lastEvent.formattedTime)")
        } else if elapsedSeconds < intervalSeconds {
            let remainHours = Int(ceil((intervalSeconds - elapsedSeconds) / 3600))
            return (.early, "Next dose in ~\(remainHours)h (last: \(lastEvent.formattedTime))")
        } else if elapsedHours > 24 {
            return (.due, "Last dose was >24h ago")
        } else {
            return (.overdue, "Window passed (last: \(lastEvent.formattedTime))")
        }
    }
}

// Custom wrapper to conform string ID to Identifiable for Sheets
struct IdentifiableString: Identifiable {
    let id = UUID()
    let value: String
}
