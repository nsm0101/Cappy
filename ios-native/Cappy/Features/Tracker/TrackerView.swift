//
//  TrackerView.swift
//  Cappy
//
//  Per-patient Medication Tracker with four time horizons:
//    • 24h  — left-to-right timeline per medication, with a semi-transparent
//             band showing the minimum-interval window after the last dose,
//             stackable across medications via the legend toggles.
//    • 3-day — three top-to-bottom day columns (left → right chronological)
//             with color-coded dose markers.
//    • Week — 7-day strip; per medication, one checkbox per allowed daily
//             dose, checked off by logged doses on that day.
//    • Month — 4-week calendar with per-day dose completion indicators.
//
//  An optional 24-hour clock renders every axis/time label as 14:00-style.
//

import SwiftUI

struct TrackerView: View {
    @EnvironmentObject private var model: AppModel
    @Environment(\.theme) private var theme
    @StateObject private var vm = TrackerViewModel()

    enum Mode: String, CaseIterable, Identifiable {
        case day = "24h", threeDay = "3-Day", week = "Week", month = "Month"
        var id: String { rawValue }
    }
    @State private var mode: Mode = .day
    @AppStorage("cappy.tracker.24hClock") private var use24hClock = false

    private let modeOptions = Mode.allCases.map { SegmentedOption(value: $0, label: $0.rawValue) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Space.lg) {
                if vm.loading {
                    ProgressView().tint(theme.tokens.brand).frame(maxWidth: .infinity).padding(.top, Space.xl)
                } else if vm.children.isEmpty {
                    Card {
                        Text("Add a child to start tracking doses.")
                            .font(CappyFont.sans(FontSizeToken.base)).foregroundStyle(theme.tokens.fg2)
                    }
                } else {
                    childPicker
                    SegmentedControl(options: modeOptions, selection: $mode)
                    if vm.meds.isEmpty {
                        Card {
                            Text("No doses in the last 28 days for \(vm.selectedChild?.displayName ?? "this child"). Logged doses will appear here.")
                                .font(CappyFont.sans(FontSizeToken.base)).foregroundStyle(theme.tokens.fg2)
                        }
                    } else {
                        legend
                        switch mode {
                        case .day: Tracker24hView(vm: vm, use24hClock: use24hClock)
                        case .threeDay: Tracker3DayView(vm: vm, use24hClock: use24hClock)
                        case .week: TrackerWeekView(vm: vm)
                        case .month: TrackerMonthView(vm: vm)
                        }
                        if mode == .day || mode == .threeDay {
                            Toggle("24-hour clock", isOn: $use24hClock)
                                .font(CappyFont.sans(FontSizeToken.sm))
                                .foregroundStyle(theme.tokens.fg2)
                                .tint(theme.tokens.brand)
                        }
                    }
                }
            }
            .padding(Space.lg)
        }
        .background(theme.tokens.bg.ignoresSafeArea())
        .navigationTitle("Medication Tracker")
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await vm.loadDoses() }
        .task(id: model.activeFamily?.id) { await vm.bootstrap(familyId: model.activeFamily?.id) }
        .onChange(of: vm.selectedChildId) { _, _ in Task { await vm.loadDoses() } }
    }

    // MARK: Patient picker

    private var childPicker: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Space.md) {
                ForEach(vm.children) { child in
                    let active = vm.selectedChildId == child.id
                    Button { vm.selectedChildId = child.id } label: {
                        VStack(spacing: 4) {
                            MemberAvatar(avatarPath: child.avatarUrl,
                                         initials: CappyFormat.initials(from: child.displayName),
                                         size: .lg)
                                .padding(2)
                                .overlay(Circle().stroke(active ? theme.tokens.brand : .clear, lineWidth: 3))
                            Text(child.displayName)
                                .font(active ? CappyFont.sansSemibold(FontSizeToken.xs) : CappyFont.sans(FontSizeToken.xs))
                                .foregroundStyle(active ? theme.tokens.fg1 : theme.tokens.fg2)
                                .lineLimit(1)
                        }
                        .frame(width: 72)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    // MARK: Legend (stack/unstack medications)

    private var legend: some View {
        HStack(spacing: Space.sm) {
            ForEach(vm.meds) { med in
                let visible = !vm.hiddenMedIds.contains(med.id)
                Button { withAnimation(.easeInOut(duration: Motion.fast)) { vm.toggle(med) } } label: {
                    HStack(spacing: 6) {
                        Circle().fill(med.color).frame(width: 10, height: 10)
                        Text(med.label)
                            .font(CappyFont.sansSemibold(FontSizeToken.xs))
                            .foregroundStyle(visible ? theme.tokens.fg1 : theme.tokens.fg3)
                    }
                    .padding(.horizontal, Space.md).padding(.vertical, 6)
                    .background(Capsule().fill(visible ? med.color.opacity(0.12) : theme.tokens.bgInset))
                    .overlay(Capsule().stroke(visible ? med.color.opacity(0.5) : theme.tokens.border, lineWidth: 1))
                    .opacity(visible ? 1 : 0.55)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("\(med.label), \(visible ? "shown" : "hidden")")
            }
            Spacer()
        }
    }
}

// MARK: - Shared helpers

enum TrackerClock {
    static func label(_ date: Date, use24h: Bool) -> String {
        let f = DateFormatter()
        f.dateFormat = use24h ? "HH:mm" : "h:mm a"
        return f.string(from: date)
    }
    static func hourLabel(_ hour: Int, use24h: Bool) -> String {
        if use24h { return String(format: "%02d", hour % 24) }
        let h = hour % 24
        if h == 0 { return "12a" }
        if h < 12 { return "\(h)a" }
        if h == 12 { return "12p" }
        return "\(h - 12)p"
    }
}

// MARK: - 24h view

struct Tracker24hView: View {
    @ObservedObject var vm: TrackerViewModel
    @Environment(\.theme) private var theme
    let use24hClock: Bool

    private var windowEnd: Date { Date() }
    private var windowStart: Date { windowEnd.addingTimeInterval(-24 * 3600) }

    var body: some View {
        Card {
            VStack(alignment: .leading, spacing: Space.md) {
                SectionLabel(text: "Last 24 hours")
                ForEach(vm.visibleMeds) { med in
                    medRow(med)
                }
                axis
            }
        }
    }

    private func fraction(_ date: Date) -> CGFloat {
        let total = windowEnd.timeIntervalSince(windowStart)
        return CGFloat(max(0, min(1, date.timeIntervalSince(windowStart) / total)))
    }

    private func medRow(_ med: TrackerViewModel.TrackedMed) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(med.label)
                .font(CappyFont.sansSemibold(FontSizeToken.xs))
                .foregroundStyle(theme.tokens.fg2)
            GeometryReader { geo in
                let w = geo.size.width
                ZStack(alignment: .leading) {
                    // Track + 6h gridlines
                    RoundedRectangle(cornerRadius: Radius.sm).fill(theme.tokens.bgInset)
                    ForEach(1..<4) { i in
                        Rectangle().fill(theme.tokens.hairline)
                            .frame(width: 1)
                            .offset(x: w * CGFloat(i) / 4)
                    }
                    // Semi-transparent interval band from the last logged dose
                    if let last = vm.lastDose(for: med.id), last.givenAt <= windowEnd {
                        let x0 = fraction(last.givenAt) * w
                        let bandEnd = last.givenAt.addingTimeInterval(Double(med.intervalHours) * 3600)
                        let x1 = fraction(bandEnd) * w
                        if x1 > x0 {
                            RoundedRectangle(cornerRadius: Radius.xs)
                                .fill(med.color.opacity(0.20))
                                .frame(width: max(2, x1 - x0))
                                .offset(x: x0)
                        }
                    }
                    // Dose markers
                    ForEach(vm.doses(for: med.id).filter { $0.givenAt >= windowStart }) { dose in
                        Circle()
                            .fill(med.color)
                            .frame(width: 12, height: 12)
                            .overlay(Circle().stroke(theme.tokens.bgCard, lineWidth: 2))
                            .offset(x: fraction(dose.givenAt) * w - 6)
                            .accessibilityLabel("\(med.label) \(dose.amountLabel) at \(TrackerClock.label(dose.givenAt, use24h: use24hClock))")
                    }
                }
            }
            .frame(height: 26)
        }
    }

    private var axis: some View {
        HStack {
            ForEach(0..<5) { i in
                let date = windowStart.addingTimeInterval(Double(i) * 6 * 3600)
                let hour = Calendar.current.component(.hour, from: date)
                Text(TrackerClock.hourLabel(hour, use24h: use24hClock))
                    .font(CappyFont.mono(FontSizeToken.xs))
                    .foregroundStyle(theme.tokens.fg3)
                if i < 4 { Spacer() }
            }
        }
    }
}

// MARK: - 3-day view

struct Tracker3DayView: View {
    @ObservedObject var vm: TrackerViewModel
    @Environment(\.theme) private var theme
    let use24hClock: Bool

    private var days: [Date] {
        let cal = Calendar.current
        let today = cal.startOfDay(for: Date())
        return [-2, -1, 0].compactMap { cal.date(byAdding: .day, value: $0, to: today) }
    }

    private let columnHeight: CGFloat = 320

    var body: some View {
        Card {
            VStack(alignment: .leading, spacing: Space.md) {
                SectionLabel(text: "Last 3 days · 72 hours")
                HStack(alignment: .top, spacing: Space.md) {
                    hourRuler
                    ForEach(days, id: \.self) { day in dayColumn(day) }
                }
            }
        }
    }

    private var hourRuler: some View {
        VStack(alignment: .trailing, spacing: 0) {
            Text(" ").font(CappyFont.sansSemibold(FontSizeToken.xs))
            ZStack(alignment: .topTrailing) {
                Color.clear.frame(width: 28, height: columnHeight)
                ForEach([0, 6, 12, 18], id: \.self) { hour in
                    Text(TrackerClock.hourLabel(hour, use24h: use24hClock))
                        .font(CappyFont.mono(FontSizeToken.xs))
                        .foregroundStyle(theme.tokens.fg3)
                        .offset(y: columnHeight * CGFloat(hour) / 24 - 6)
                }
            }
        }
    }

    private func dayColumn(_ day: Date) -> some View {
        let cal = Calendar.current
        let f = DateFormatter(); f.dateFormat = "EEE d"
        return VStack(spacing: 4) {
            Text(cal.isDateInToday(day) ? "Today" : f.string(from: day))
                .font(CappyFont.sansSemibold(FontSizeToken.xs))
                .foregroundStyle(cal.isDateInToday(day) ? theme.tokens.brand : theme.tokens.fg2)
            ZStack(alignment: .top) {
                RoundedRectangle(cornerRadius: Radius.sm).fill(theme.tokens.bgInset)
                // 6h gridlines
                ForEach(1..<4) { i in
                    Rectangle().fill(theme.tokens.hairline)
                        .frame(height: 1)
                        .offset(y: columnHeight * CGFloat(i) / 4)
                }
                // Dose markers, color-coded per medication
                ForEach(vm.visibleMeds) { med in
                    ForEach(vm.doses(for: med.id, on: day)) { dose in
                        let seconds = dose.givenAt.timeIntervalSince(cal.startOfDay(for: day))
                        let y = columnHeight * CGFloat(seconds / 86400)
                        HStack(spacing: 3) {
                            Circle().fill(med.color)
                                .frame(width: 10, height: 10)
                                .overlay(Circle().stroke(theme.tokens.bgCard, lineWidth: 1.5))
                            Text(TrackerClock.label(dose.givenAt, use24h: use24hClock))
                                .font(CappyFont.mono(9))
                                .foregroundStyle(theme.tokens.fg3)
                                .lineLimit(1)
                                .minimumScaleFactor(0.7)
                        }
                        .offset(y: min(max(0, y - 5), columnHeight - 10))
                        .accessibilityLabel("\(med.label) \(dose.amountLabel), \(TrackerClock.label(dose.givenAt, use24h: use24hClock))")
                    }
                }
            }
            .frame(height: columnHeight)
        }
        .frame(maxWidth: .infinity)
    }
}

// MARK: - Week view

struct TrackerWeekView: View {
    @ObservedObject var vm: TrackerViewModel
    @Environment(\.theme) private var theme

    private var days: [Date] {
        let cal = Calendar.current
        let today = cal.startOfDay(for: Date())
        return (0..<7).reversed().compactMap { cal.date(byAdding: .day, value: -$0, to: today) }
    }

    var body: some View {
        VStack(spacing: Space.md) {
            ForEach(vm.visibleMeds) { med in
                Card {
                    VStack(alignment: .leading, spacing: Space.sm) {
                        HStack(spacing: 6) {
                            Circle().fill(med.color).frame(width: 10, height: 10)
                            SectionLabel(text: "\(med.label) · up to \(med.maxDosesPer24h)/day")
                        }
                        HStack(alignment: .top, spacing: 0) {
                            ForEach(days, id: \.self) { day in
                                dayCell(med: med, day: day)
                                    .frame(maxWidth: .infinity)
                            }
                        }
                    }
                }
            }
        }
    }

    private func dayCell(med: TrackerViewModel.TrackedMed, day: Date) -> some View {
        let cal = Calendar.current
        let given = vm.doses(for: med.id, on: day).count
        let f = DateFormatter(); f.dateFormat = "EEEEE"
        let df = DateFormatter(); df.dateFormat = "d"
        return VStack(spacing: 4) {
            Text(f.string(from: day))
                .font(CappyFont.sansSemibold(FontSizeToken.xs))
                .foregroundStyle(cal.isDateInToday(day) ? theme.tokens.brand : theme.tokens.fg3)
            Text(df.string(from: day))
                .font(CappyFont.mono(FontSizeToken.xs))
                .foregroundStyle(theme.tokens.fg3)
            VStack(spacing: 3) {
                ForEach(0..<med.maxDosesPer24h, id: \.self) { slot in
                    Image(systemName: slot < given ? "checkmark.square.fill" : "square")
                        .font(.system(size: 13))
                        .foregroundStyle(slot < given ? med.color : theme.tokens.fgMuted.opacity(0.5))
                }
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("\(given) of \(med.maxDosesPer24h) doses")
        }
        .padding(.vertical, 4)
        .background(
            RoundedRectangle(cornerRadius: Radius.sm)
                .fill(cal.isDateInToday(day) ? theme.tokens.brandTint : .clear))
    }
}

// MARK: - Month view

struct TrackerMonthView: View {
    @ObservedObject var vm: TrackerViewModel
    @Environment(\.theme) private var theme

    /// 28 days ending today, split into 4 weeks of 7.
    private var weeks: [[Date]] {
        let cal = Calendar.current
        let today = cal.startOfDay(for: Date())
        let all = (0..<28).reversed().compactMap { cal.date(byAdding: .day, value: -$0, to: today) }
        return stride(from: 0, to: 28, by: 7).map { Array(all[$0..<min($0 + 7, all.count)]) }
    }

    var body: some View {
        Card {
            VStack(alignment: .leading, spacing: Space.sm) {
                SectionLabel(text: "Last 4 weeks")
                ForEach(Array(weeks.enumerated()), id: \.offset) { _, week in
                    HStack(spacing: 4) {
                        ForEach(week, id: \.self) { day in dayCell(day) }
                    }
                }
                legendFootnote
            }
        }
    }

    private func dayCell(_ day: Date) -> some View {
        let cal = Calendar.current
        let df = DateFormatter(); df.dateFormat = "d"
        return VStack(spacing: 3) {
            Text(df.string(from: day))
                .font(CappyFont.mono(FontSizeToken.xs))
                .foregroundStyle(cal.isDateInToday(day) ? theme.tokens.brand : theme.tokens.fg3)
            VStack(spacing: 2) {
                ForEach(vm.visibleMeds) { med in
                    let given = vm.doses(for: med.id, on: day).count
                    HStack(spacing: 2) {
                        Image(systemName: given > 0 ? "checkmark.square.fill" : "square")
                            .font(.system(size: 10))
                            .foregroundStyle(given > 0 ? med.color : theme.tokens.fgMuted.opacity(0.4))
                        if given > 1 {
                            Text("×\(given)")
                                .font(CappyFont.mono(9))
                                .foregroundStyle(med.color)
                        }
                    }
                    .accessibilityLabel("\(med.label): \(given) dose\(given == 1 ? "" : "s")")
                }
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 5)
        .background(
            RoundedRectangle(cornerRadius: Radius.xs)
                .fill(cal.isDateInToday(day) ? theme.tokens.brandTint : theme.tokens.bgInset.opacity(0.6)))
    }

    private var legendFootnote: some View {
        Text("A checked box means at least one dose was logged that day; ×n shows the day's count.")
            .font(CappyFont.sans(FontSizeToken.xs))
            .foregroundStyle(theme.tokens.fg3)
    }
}
