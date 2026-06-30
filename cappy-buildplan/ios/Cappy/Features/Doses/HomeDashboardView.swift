import SwiftUI

struct HomeDashboardView: View {
    let environment: AppEnvironment

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: CappySpacing.md) {
                    header
                    nfcCard
                    lastDoseCard
                    timelineCard
                }
                .padding(CappySpacing.md)
            }
            .background(CappyColor.backgroundPrimary)
            .navigationTitle("Cappy")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Settings") {}
                        .font(CappyTypography.caption)
                }
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: CappySpacing.sm) {
            Text("Medication coordination")
                .font(CappyTypography.display)
                .foregroundStyle(CappyColor.textPrimary)
            Text("Tap a bottle tag to open the right shared dose log.")
                .font(CappyTypography.body)
                .foregroundStyle(CappyColor.textSecondary)
        }
    }

    private var nfcCard: some View {
        CappyCard {
            VStack(alignment: .leading, spacing: CappySpacing.sm) {
                DoseStatusPill(status: .pendingSync)
                Text("NFC quick access")
                    .font(CappyTypography.title)
                    .foregroundStyle(CappyColor.textPrimary)
                Text("Use Core NFC to read a tag UID only. Medication and child context resolves through the authenticated API.")
                    .font(CappyTypography.callout)
                    .foregroundStyle(CappyColor.textSecondary)
                CappyButton(title: "Scan tag", style: .primary) {
                    environment.logger.info(SafeLogEvent(name: "nfc_scan_requested", metadata: ["screen": "home"]))
                }
            }
        }
    }

    private var lastDoseCard: some View {
        CappyCard {
            HStack(alignment: .top, spacing: CappySpacing.md) {
                ChildAvatar(initials: "CP", color: CappyColor.brandSecondary)
                VStack(alignment: .leading, spacing: CappySpacing.xs) {
                    Text("Last dose")
                        .font(CappyTypography.subtitle)
                        .foregroundStyle(CappyColor.textPrimary)
                    Text("No sample child data is bundled. Real child and dose details load only after authenticated setup.")
                        .font(CappyTypography.caption)
                        .foregroundStyle(CappyColor.textSecondary)
                }
            }
        }
    }

    private var timelineCard: some View {
        CappyCard {
            VStack(alignment: .leading, spacing: CappySpacing.sm) {
                Text("Shared timeline")
                    .font(CappyTypography.title)
                    .foregroundStyle(CappyColor.textPrimary)
                Text("Upcoming work will merge local pending events with server-confirmed dose events and realtime updates.")
                    .font(CappyTypography.callout)
                    .foregroundStyle(CappyColor.textSecondary)
            }
        }
    }
}
