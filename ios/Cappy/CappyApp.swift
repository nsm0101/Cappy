import SwiftUI

@main
struct CappyApp: App {
    @StateObject private var nfcManager = NFCManager()
    
    // In-memory mock store for Alpha demo
    @State private var children: [Child] = [
        Child(id: UUID(), name: "Leo", weightValue: 12.5, weightUnit: "kg", avatarColorHex: "18A78D"),
        Child(id: UUID(), name: "Mia", weightValue: 24.0, weightUnit: "lbs", avatarColorHex: "1E6FC4"),
        Child(id: UUID(), name: "Zoe", weightValue: 8.2, weightUnit: "kg", avatarColorHex: "D84A4A")
    ]
    
    @State private var medications: [Medication] = [
        Medication(
            id: UUID(uuidString: "77777777-7777-7777-7777-777777777777")!,
            name: "Acetaminophen",
            brandName: "Tylenol",
            variant: "Children's Suspension (160mg/5mL)",
            concentrationMgPerMl: 32.0,
            maxDoseMg: 480.0,
            defaultIntervalHours: 4,
            colorHex: "18A78D"
        ),
        Medication(
            id: UUID(),
            name: "Ibuprofen",
            brandName: "Motrin",
            variant: "Children's Suspension (100mg/5mL)",
            concentrationMgPerMl: 20.0,
            maxDoseMg: 400.0,
            defaultIntervalHours: 6,
            colorHex: "1E6FC4"
        )
    ]
    
    @State private var doseTimeline: [DoseEvent] = []
    
    var body: some Scene {
        WindowGroup {
            HomeDashboardView(
                children: $children,
                medications: $medications,
                doseTimeline: $doseTimeline
            )
            .environmentObject(nfcManager)
            .onOpenURL { url in
                // Handle background NFC tap triggers
                let handled = nfcManager.handleUniversalLink(url)
                if handled {
                    print("Successfully handled background NFC trigger: \(url)")
                }
            }
            .preferredColorScheme(.none) // support both system light and dark
        }
    }
}
