import SwiftUI

struct DosingDashboardSheet: View {
    let child: Child
    let medication: Medication
    
    @Binding var doseTimeline: [DoseEvent]
    var onComplete: () -> Void
    
    @Environment(\.presentationMode) var presentationMode
    @State private var loggedAmountMl: Double = 0.0
    @State private var caregiverName: String = "Caregiver"
    @State private var isSubmitting = false
    
    // Target Dose Calculations based on AAP Guidelines (12.5 mg/kg)
    private var calculatedTargetMg: Double {
        let dose = child.weightInKg * 12.5
        return min(dose, medication.maxDoseMg)
    }
    
    private var calculatedTargetMl: Double {
        calculatedTargetMg / medication.concentrationMgPerMl
    }
    
    private var safetyStatus: DoseSafetyStatus {
        let childEvents = doseTimeline.filter { $0.childId == child.id }.sorted(by: { $0.timestamp > $1.timestamp })
        guard let lastEvent = childEvents.first else {
            return .due
        }
        
        let elapsedSeconds = Date().timeIntervalSince(lastEvent.timestamp)
        let intervalSeconds = Double(medication.defaultIntervalHours) * 3600
        
        if elapsedSeconds < 900 { // 15 mins
            return .recent
        } else if elapsedSeconds < intervalSeconds {
            return .early
        } else if elapsedSeconds > 24 * 3600 {
            return .due
        } else {
            return .overdue
        }
    }
    
    private var lastDoseTimeText: String {
        let childEvents = doseTimeline.filter { $0.childId == child.id }.sorted(by: { $0.timestamp > $1.timestamp })
        guard let lastEvent = childEvents.first else {
            return "No previous doses recorded."
        }
        
        let elapsedHours = Int(Date().timeIntervalSince(lastEvent.timestamp) / 3600)
        if elapsedHours == 0 {
            return "Last dose was given less than an hour ago."
        } else if elapsedHours == 1 {
            return "Last dose was given 1 hour ago."
        } else {
            return "Last dose was given \(elapsedHours) hours ago."
        }
    }
    
    var body: some View {
        ZStack {
            Color.cappyBackground
                .ignoresSafeArea()
            
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    // Close Header
                    HStack {
                        Button(action: {
                            presentationMode.wrappedValue.dismiss()
                        }) {
                            Image(systemName: "chevron.left")
                                .foregroundColor(.cappyTeal)
                            Text("Back")
                                .foregroundColor(.cappyTeal)
                                .font(CappyFont.uiMedium(size: 16))
                        }
                        Spacer()
                        Text("Dosing Dashboard")
                            .font(CappyFont.display(size: 18))
                            .foregroundColor(.cappyText)
                        Spacer()
                        // Equal balance spacing
                        Text("Back").opacity(0)
                    }
                    .padding(.top, 16)
                    
                    // Safety Status Banner
                    safetyStatusBanner
                    
                    // Child Info Card
                    childInfoCard
                    
                    // Medication details
                    medicationCard
                    
                    // Dose Input Section
                    doseCalculatorSection
                    
                    // Caregiver Name Input
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Logged By")
                            .font(CappyFont.uiMedium(size: 14))
                            .foregroundColor(.cappyText)
                        
                        TextField("Your Name", text: $caregiverName)
                            .font(CappyFont.body(size: 16))
                            .padding(12)
                            .background(Color.cappyCard)
                            .cornerRadius(8)
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(Color.cappyText.opacity(0.12), lineWidth: 1)
                            )
                    }
                    
                    // Safety Disclaimer (NON-NEGOTIABLE COPY)
                    Text("Always confirm dosing before administering medication.")
                        .font(CappyFont.body(size: 12))
                        .italic()
                        .foregroundColor(.doseEarlySolid)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 8)
                    
                    // Log Dose Button
                    Button(action: logDose) {
                        if isSubmitting {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: .white))
                        } else {
                            Text("Log Dose")
                                .font(CappyFont.display(size: 16))
                                .foregroundColor(.white)
                                .frame(maxWidth: .infinity)
                        }
                    }
                    .padding(.vertical, 14)
                    .background(Color.cappyTeal)
                    .cornerRadius(12)
                    .disabled(isSubmitting || caregiverName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    
                    Spacer(minLength: 40)
                }
                .padding(.horizontal, 20)
            }
        }
        .onAppear {
            // Set calculated target as the initial default
            loggedAmountMl = calculatedTargetMl
        }
    }
    
    // MARK: - Subviews
    private var safetyStatusBanner: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                DoseStatusPill(status: safetyStatus, size: .md)
                Spacer()
            }
            
            Text(safetyStatus.subtitle)
                .font(CappyFont.body(size: 14))
                .foregroundColor(safetyStatus.fgColor)
            
            Text(lastDoseTimeText)
                .font(CappyFont.body(size: 12))
                .foregroundColor(safetyStatus.fgColor.opacity(0.8))
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(safetyStatus.bgColor)
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(safetyStatus.solidColor.opacity(0.24), lineWidth: 1)
        )
    }
    
    private var childInfoCard: some View {
        HStack(spacing: 16) {
            ChildAvatar(initials: child.initials, themeColor: child.themeColor, size: 48)
            
            VStack(alignment: .leading, spacing: 4) {
                Text(child.name)
                    .font(CappyFont.display(size: 16))
                    .foregroundColor(.cappyText)
                Text("Weight: \(child.weightValue.formatted(.number.precision(.fractionLength(1)))) \(child.weightUnit) · Dosing weight: \(child.weightInKg.formatted(.number.precision(.fractionLength(1)))) kg")
                    .font(CappyFont.body(size: 13))
                    .foregroundColor(.cappyTextMuted)
            }
            Spacer()
        }
        .padding(14)
        .background(Color.cappyCard)
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.cappyText.opacity(0.06), lineWidth: 1)
        )
    }
    
    private var medicationCard: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(medication.displayName)
                .font(CappyFont.uiMedium(size: 14))
                .foregroundColor(.cappyText)
            Text(medication.variant)
                .font(CappyFont.body(size: 12))
                .foregroundColor(.cappyTextMuted)
        }
        .padding(.horizontal, 4)
    }
    
    private var doseCalculatorSection: some View {
        VStack(spacing: 16) {
            VStack(spacing: 4) {
                Text("Dose Volume")
                    .font(CappyFont.body(size: 14))
                    .foregroundColor(.cappyTextMuted)
                
                Text("\(loggedAmountMl.formatted(.number.precision(.fractionLength(1)))) mL")
                    .font(CappyFont.displayBlack(size: 40))
                    .foregroundColor(.cappyTeal)
                
                let activeMg = loggedAmountMl * medication.concentrationMgPerMl
                Text("Equates to \(Int(activeMg)) mg active drug")
                    .font(CappyFont.mono(size: 12))
                    .foregroundColor(.cappyTextMuted)
            }
            .padding(.vertical, 16)
            
            // Slider to adjust volume
            VStack(spacing: 8) {
                Slider(value: $loggedAmountMl, in: 0.5...20.0, step: 0.1)
                    .accentColor(.cappyTeal)
                
                HStack {
                    Text("0.5 mL")
                        .font(CappyFont.mono(size: 11))
                        .foregroundColor(.cappyTextMuted)
                    Spacer()
                    
                    // Reset to recommended link
                    Button(action: {
                        loggedAmountMl = calculatedTargetMl
                    }) {
                        Text("Reset to Recommended (\(calculatedTargetMl.formatted(.number.precision(.fractionLength(1)))) mL)")
                            .font(CappyFont.uiMedium(size: 12))
                            .foregroundColor(.cappyBlue)
                    }
                    
                    Spacer()
                    Text("20.0 mL")
                        .font(CappyFont.mono(size: 11))
                        .foregroundColor(.cappyTextMuted)
                }
            }
        }
        .padding(20)
        .cappyCard()
    }
    
    // MARK: - Actions
    private func logDose() {
        isSubmitting = true
        
        // Simulate a network roundtrip
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            let newEvent = DoseEvent(
                id: UUID(),
                childId: child.id,
                medicationId: medication.id,
                amountMl: loggedAmountMl,
                concentration: medication.concentrationMgPerMl,
                timestamp: Date(),
                loggedBy: caregiverName,
                isCorrected: false
            )
            
            doseTimeline.insert(newEvent, at: 0)
            isSubmitting = false
            onComplete()
        }
    }
}
