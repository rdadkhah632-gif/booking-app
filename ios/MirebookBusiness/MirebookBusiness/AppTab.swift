import SwiftUI

enum AppTab: String, CaseIterable, Identifiable {
    case today
    case calendar
    case inbox
    case setup
    case availability
    case account

    var id: String { rawValue }

    static func tabs(for mode: AppMode) -> [AppTab] {
        switch mode {
        case .business:
            [.today, .calendar, .inbox, .setup, .account]
        case .staff:
            [.today, .calendar, .availability, .inbox, .account]
        }
    }

    @ViewBuilder
    var destination: some View {
        switch self {
        case .today:
            TodayView()
        case .calendar:
            CalendarView()
        case .inbox:
            InboxView()
        case .setup:
            SetupView()
        case .availability:
            AvailabilityView()
        case .account:
            AccountView()
        }
    }

    @ViewBuilder
    var label: some View {
        switch self {
        case .today:
            Label("tab.today", systemImage: "sun.max")
        case .calendar:
            Label("tab.calendar", systemImage: "calendar")
        case .inbox:
            Label("tab.inbox", systemImage: "tray")
        case .setup:
            Label("tab.setup", systemImage: "slider.horizontal.3")
        case .availability:
            Label("tab.availability", systemImage: "clock")
        case .account:
            Label("tab.account", systemImage: "person.crop.circle")
        }
    }
}
