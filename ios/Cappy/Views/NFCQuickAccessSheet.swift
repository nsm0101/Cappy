import SwiftUI

struct NFCQuickAccessSheet: View {
    let tagUID: String
    
    @Binding var children: [Child]
    @Binding var medications: [Medication]
    @Binding var doseTimeline: [DoseEvent]
    
    @Environment(\.presentationMode) var presentationMode
    @State private var selectedChild: Child? = nil
    
    // Resolve Tag UID to Medication.
    // In production, this calls the backend endpoint `/v1/nfc/resolve`.
    // For Alpha, we map it to Acetaminophen (Children's Tylenol).
    private var resolvedMedication: Medication? {
        medications.first { $0.brandName == "Tylenol" } ?? medications.first
    }
    
    var body: some View {
        NavigationView {
            ZStack {
                Color.cappyBackground
                    .ignoresSafeArea()
                
                VStack(alignment: .leading, spacing: 24) {
                    // Sheet Handle (visual indicator)
                    HStack {
                        Spacer()
                        Capsule()
                            .fill(Color.cappyText.opacity(0.18))
                            .frame(width: 36, height: 5)
                        Spacer()
                    }
                    .padding(.top, 12)
                    
                    if let medication = resolvedMedication {
                        // Detected Med Card
                        VStack(alignment: .leading, spacing: 12) {
                            HStack(spacing: 8) {
                                Image(systemName: "sensor.tag.radiowaves.forward.fill")
                                    .foregroundColor(.cappyBlue)
                                Text("NFC TAG RESOLVED")
                                    .font(CappyFont.mono(size: 11))
                                    .foregroundColor(.cappyBlue)
                            }
                            
                            VStack(alignment: .leading, spacing: 4) {
                                Text(medication.displayName)
                                    .font(CappyFont.display(size: 20))
                                    .foregroundColor(.cappyText)
                                Text(medication.variant)
                                    .font(CappyFont.body(size: 14))
                                    .foregroundColor(.cappyTextMuted)
                            }
                            
                            HStack {
                                Spacer()
                                Text("Tag UID: \(tagUID.prefix(8))...")
                                    .font(CappyFont.mono(size: 10))
                                    .foregroundColor(.cappyTextMuted.opacity(0.6))
                            }
                        }
                        .padding(16)
                        .background(Color.cappyInset)
                        .cornerRadius(12)
                        
                        Text("Select child for this dose:")
                            .font(CappyFont.display(size: 16))
                            .foregroundColor(.cappyText)
                        
                        // Children Selection Grid
                        ScrollView {
                            VStack(spacing: 12) {
                                ForEach(children) { child in
                                    Button(action: {
                                        selectedChild = child
                                    }) {
                                        HStack(spacing: 16) {
                                            ChildAvatar(initials: child.initials, themeColor: child.themeColor, size: 44)
                                            
                                            VStack(alignment: .leading, spacing: 4) {
                                                Text(child.name)
                                                    .font(CappyFont.display(size: 16))
                                                    .foregroundColor(.cappyText)
                                                Text("\(child.weightValue.formatted(.number.precision(.fractionLength(1)))) \(child.weightUnit)")
                                                    .font(CappyFont.body(size: 13))
                                                    .foregroundColor(.cappyTextMuted)
                                            }
                                            
                                            Spacer()
                                            
                                            Image(systemName: "chevron.right")
                                                .font(.caption)
                                                .foregroundColor(.cappyTextMuted)
                                        }
                                        .padding(14)
                                        .background(Color.cappyCard)
                                        .cornerRadius(12)
                                        .overlay(
                                            RoundedRectangle(cornerRadius: 12)
                                                .stroke(Color.cappyText.opacity(0.06), lineWidth: 1)
                                        )
                                    }
                                }
                            }
                        }
                    } else {
                        // Error State
                        VStack(spacing: 12) {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .font(.largeTitle)
                                .foregroundColor(.doseEarlySolid)
                            Text("Unrecognized Tag")
                                .font(CappyFont.display(size: 18))
                            Text("This NFC tag has not been registered to any medication in this family yet.")
                                .font(CappyFont.body(size: 14))
                                .multilineTextAlignment(.center)
                                .foregroundColor(.cappyTextMuted)
                        }
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                    }
                    
                    Spacer()
                }
                .padding(.horizontal, 20)
                .background(
                    // Navigation link to Dosing Dashboard Sheet
                    NavigationLink(
                        destination: Group {
                            if let child = selectedChild, let med = resolvedMedication {
                                DosingDashboardSheet(
                                    child: child,
                                    medication: med,
                                    doseTimeline: $doseTimeline,
                                    onComplete: {
                                        selectedChild = nil
                                        presentationMode.wrappedValue.dismiss()
                                    }
                                )
                            }
                        },
                        isActive: Binding<Bool>(
                            get: { selectedChild != nil },
                            set: { if !$0 { selectedChild = nil } }
                        ),
                        label: { EmptyView() }
                    )
                )
            }
            .navigationBarHidden(true)
        }
    }
}
