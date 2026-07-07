import SwiftUI

struct TodayView: View {
    @Environment(AppState.self) private var appState
    @State private var state: LoadState<TodaySnapshot> = .idle
    @State private var selectedAppointment: Appointment?

    var body: some View {
        List {
            Section {
                OperationHeader(
                    title: appState.workspaceTitle,
                    subtitle: appState.workspaceSubtitle,
                    badgeKey: appState.mode == .business ? "mode.business" : "mode.staff",
                    systemImage: appState.mode == .business ? "briefcase" : "person.text.rectangle"
                )
            }

            switch state {
            case .idle, .loading:
                Section {
                    LoadingRow(titleKey: "today.loading")
                }
            case .failed(let message):
                Section {
                    ErrorRow(message: message) {
                        Task { await load() }
                    }
                }
            case .loaded(let snapshot):
                Section("today.summary") {
                    SummaryStrip(items: [
                        SummaryItem(id: "pending", titleKey: "today.pending", value: "\(snapshot.pendingCount)", systemImage: "exclamationmark.circle"),
                        SummaryItem(id: "confirmed", titleKey: "today.confirmed", value: "\(snapshot.confirmedCount)", systemImage: "checkmark.circle"),
                        SummaryItem(id: "hours", titleKey: "today.hours", value: String(localized: "today.hours.ready"), systemImage: "clock")
                    ])
                }

                Section("today.next") {
                    if let appointment = snapshot.nextAppointment {
                        Button {
                            selectedAppointment = appointment
                        } label: {
                            AppointmentRow(appointment: appointment, showsDisclosure: true)
                        }
                        .buttonStyle(.plain)
                    } else {
                        EmptyStateRow(
                            titleKey: "today.empty",
                            detailKey: appState.mode == .business ? "today.empty.ownerDetail" : "today.empty.staffDetail",
                            systemImage: "sun.max"
                        )
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .refreshable {
            await load()
        }
        .task(id: appState.mode) {
            await load()
        }
        .sheet(item: $selectedAppointment) { appointment in
            AppointmentDetailView(appointment: appointment)
        }
    }

    private func load() async {
        guard let token = appState.auth.accessToken else {
            state = .failed(String(localized: "auth.error.sessionMissing"))
            return
        }

        state = .loading

        do {
            async let appointments = appState.apiClient.loadCalendar(
                accessToken: token,
                mode: appState.mode,
                from: Date.todayStart,
                to: Date.todayEnd
            )
            async let inboxItems = appState.apiClient.loadInbox(accessToken: token, mode: appState.mode)
            state = .loaded(TodaySnapshot(appointments: try await appointments, inboxItems: try await inboxItems))
        } catch is CancellationError {
            return
        } catch {
            state = .failed(error.localizedDescription)
        }
    }
}

struct CalendarView: View {
    @Environment(AppState.self) private var appState
    @State private var selectedDate = Date()
    @State private var state: LoadState<[Appointment]> = .idle
    @State private var selectedAppointment: Appointment?

    private var weekStart: Date {
        selectedDate.startOfWeek
    }

    private var weekDays: [Date] {
        (0..<7).compactMap {
            Calendar.current.date(byAdding: .day, value: $0, to: weekStart)
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                OperationHeader(
                    title: String(localized: "calendar.title"),
                    subtitle: appState.workspaceTitle,
                    badgeKey: appState.mode == .business ? "mode.business" : "mode.staff",
                    systemImage: "calendar"
                )

                HStack(spacing: 12) {
                    Button {
                        selectedDate = Calendar.current.date(byAdding: .day, value: -7, to: selectedDate) ?? selectedDate
                    } label: {
                        Image(systemName: "chevron.left")
                    }
                    .buttonStyle(.bordered)
                    .accessibilityLabel(Text("calendar.previousWeek"))

                    DatePicker("calendar.date", selection: $selectedDate, displayedComponents: .date)
                        .labelsHidden()
                        .frame(maxWidth: .infinity)

                    Button {
                        selectedDate = Calendar.current.date(byAdding: .day, value: 7, to: selectedDate) ?? selectedDate
                    } label: {
                        Image(systemName: "chevron.right")
                    }
                    .buttonStyle(.bordered)
                    .accessibilityLabel(Text("calendar.nextWeek"))
                }

                switch state {
                case .idle, .loading:
                    LoadingRow(titleKey: "calendar.loading")
                        .padding()
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                case .failed(let message):
                    ErrorRow(message: message) {
                        Task { await load() }
                    }
                    .padding()
                    .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                case .loaded(let appointments):
                    CalendarWeekStrip(
                        days: weekDays,
                        selectedDate: selectedDate,
                        appointments: appointments
                    ) { day in
                        selectedDate = day
                    }

                    let dayAppointments = appointmentsForSelectedDay(appointments)
                    VStack(alignment: .leading, spacing: 10) {
                        HStack {
                            VStack(alignment: .leading, spacing: 3) {
                                Text(selectedDate.formatted(date: .complete, time: .omitted))
                                    .font(.headline)
                                Text("calendar.schedule")
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(.secondary)
                            }

                            Spacer()

                            Text(String(format: String(localized: "calendar.appointmentCount"), dayAppointments.count))
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(.secondary)
                        }

                        if dayAppointments.isEmpty {
                            EmptyStateRow(
                                titleKey: "calendar.empty",
                                detailKey: "calendar.emptyDetail",
                                systemImage: "calendar.badge.clock"
                            )
                            .padding(.vertical, 8)
                        }

                        CalendarWeekSchedule(
                            days: weekDays,
                            selectedDate: selectedDate,
                            appointments: appointments,
                            onSelectDate: { day in
                                selectedDate = day
                            },
                            onSelectAppointment: { appointment in
                                selectedAppointment = appointment
                            }
                        )
                    }
                    .padding(14)
                    .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
                }
            }
            .padding(16)
        }
        .refreshable {
            await load()
        }
        .task(id: calendarTaskID) {
            await load()
        }
        .toolbar {
            Button {
            } label: {
                Image(systemName: "plus")
            }
            .accessibilityLabel(Text("calendar.add"))
            .disabled(true)
        }
        .sheet(item: $selectedAppointment) { appointment in
            AppointmentDetailView(appointment: appointment)
        }
    }

    private var calendarTaskID: String {
        "\(appState.mode.rawValue)-\(weekStart.formatted(.iso8601.year().month().day()))"
    }

    private func appointmentsForSelectedDay(_ appointments: [Appointment]) -> [Appointment] {
        appointments
            .filter { Calendar.current.isDate($0.startAt, inSameDayAs: selectedDate) }
            .sorted { $0.startAt < $1.startAt }
    }

    private func load() async {
        guard let token = appState.auth.accessToken else {
            state = .failed(String(localized: "auth.error.sessionMissing"))
            return
        }

        state = .loading

        do {
            state = .loaded(
                try await appState.apiClient.loadCalendar(
                    accessToken: token,
                    mode: appState.mode,
                    from: weekStart.startOfDay,
                    to: Calendar.current.date(byAdding: .day, value: 6, to: weekStart)?.endOfDay ?? selectedDate.endOfDay
                )
            )
        } catch is CancellationError {
            return
        } catch {
            state = .failed(error.localizedDescription)
        }
    }
}

private struct CalendarWeekStrip: View {
    let days: [Date]
    let selectedDate: Date
    let appointments: [Appointment]
    let onSelect: (Date) -> Void

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 10) {
                ForEach(days, id: \.self) { day in
                    let isSelected = Calendar.current.isDate(day, inSameDayAs: selectedDate)
                    let dayAppointments = appointments.filter { Calendar.current.isDate($0.startAt, inSameDayAs: day) }

                    Button {
                        onSelect(day)
                    } label: {
                        VStack(spacing: 6) {
                            Text(day.formatted(.dateTime.weekday(.abbreviated)))
                                .font(.caption2.weight(.bold))
                                .foregroundStyle(isSelected ? .white : .secondary)
                            Text(day.formatted(.dateTime.day()))
                                .font(.headline.weight(.bold))
                                .foregroundStyle(isSelected ? .white : .primary)
                            Text("\(dayAppointments.count)")
                                .font(.caption2.weight(.semibold))
                                .foregroundStyle(isSelected ? .white.opacity(0.85) : .secondary)
                        }
                        .frame(width: 58, height: 76)
                        .background(
                            RoundedRectangle(cornerRadius: 18, style: .continuous)
                                .fill(isSelected ? Color.orange : Color(.secondarySystemGroupedBackground))
                        )
                        .overlay {
                            RoundedRectangle(cornerRadius: 18, style: .continuous)
                                .stroke(isSelected ? Color.orange : Color.secondary.opacity(0.16), lineWidth: 1)
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.vertical, 2)
        }
        .accessibilityLabel(Text("calendar.week"))
    }
}

private struct CalendarWeekSchedule: View {
    let days: [Date]
    let selectedDate: Date
    let appointments: [Appointment]
    let onSelectDate: (Date) -> Void
    let onSelectAppointment: (Appointment) -> Void

    private let dayWidth: CGFloat = 124
    private let hourHeight: CGFloat = 68
    private let timeRailWidth: CGFloat = 54
    private let headerHeight: CGFloat = 58

    private var window: ClosedRange<Int> {
        guard !appointments.isEmpty else { return 8...18 }

        let starts = appointments.map(\.startMinutes)
        let ends = appointments.map(\.endMinutes)
        let startHour = max(0, min(8, (starts.min() ?? 480) / 60))
        let endHour = min(24, max(18, Int(ceil(Double(ends.max() ?? 1080) / 60.0))))
        return startHour...max(startHour + 1, endHour)
    }

    var body: some View {
        let startHour = window.lowerBound
        let endHour = window.upperBound
        let hours = Array(startHour...endHour)
        let scheduleHeight = CGFloat(endHour - startHour) * hourHeight

        ScrollView(.horizontal, showsIndicators: true) {
            HStack(alignment: .top, spacing: 0) {
                VStack(spacing: 0) {
                    Text("calendar.week")
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(.secondary)
                        .frame(width: timeRailWidth, height: headerHeight, alignment: .bottomTrailing)
                        .padding(.trailing, 8)

                    ZStack(alignment: .topTrailing) {
                        ForEach(hours, id: \.self) { hour in
                            Text(String(format: "%02d:00", hour))
                                .font(.caption2.weight(.semibold))
                                .foregroundStyle(.secondary)
                                .offset(y: CGFloat(hour - startHour) * hourHeight - 7)
                        }
                    }
                    .frame(width: timeRailWidth, height: scheduleHeight, alignment: .topTrailing)
                    .padding(.trailing, 8)
                }

                ForEach(days, id: \.self) { day in
                    CalendarDayColumn(
                        day: day,
                        isSelected: Calendar.current.isDate(day, inSameDayAs: selectedDate),
                        appointments: appointments
                            .filter { Calendar.current.isDate($0.startAt, inSameDayAs: day) }
                            .sorted { $0.startAt < $1.startAt },
                        hours: hours,
                        startHour: startHour,
                        hourHeight: hourHeight,
                        headerHeight: headerHeight,
                        scheduleHeight: scheduleHeight,
                        width: dayWidth,
                        onSelectDate: onSelectDate,
                        onSelectAppointment: onSelectAppointment
                    )
                }
            }
            .padding(.bottom, 4)
        }
        .background(Color(.secondarySystemGroupedBackground).opacity(0.4), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .accessibilityLabel(Text("calendar.week"))
    }
}

private struct CalendarDayColumn: View {
    let day: Date
    let isSelected: Bool
    let appointments: [Appointment]
    let hours: [Int]
    let startHour: Int
    let hourHeight: CGFloat
    let headerHeight: CGFloat
    let scheduleHeight: CGFloat
    let width: CGFloat
    let onSelectDate: (Date) -> Void
    let onSelectAppointment: (Appointment) -> Void

    var body: some View {
        VStack(spacing: 0) {
            Button {
                onSelectDate(day)
            } label: {
                VStack(spacing: 4) {
                    Text(day.formatted(.dateTime.weekday(.abbreviated)))
                        .font(.caption2.weight(.bold))
                    Text(day.formatted(.dateTime.day()))
                        .font(.headline.weight(.bold))
                    Text(String(format: String(localized: "calendar.appointmentCount"), appointments.count))
                        .font(.caption2.weight(.semibold))
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                }
                .foregroundStyle(isSelected ? .white : .primary)
                .frame(width: width, height: headerHeight)
                .background(isSelected ? Color.orange : Color.clear)
            }
            .buttonStyle(.plain)

            ZStack(alignment: .topLeading) {
                ForEach(hours.dropLast(), id: \.self) { hour in
                    Rectangle()
                        .fill(Color.secondary.opacity(0.16))
                        .frame(height: 1)
                        .offset(y: CGFloat(hour - startHour) * hourHeight)
                }

                ForEach(appointments) { appointment in
                    Button {
                        onSelectAppointment(appointment)
                    } label: {
                        CalendarAppointmentBlock(appointment: appointment)
                    }
                    .buttonStyle(.plain)
                    .frame(width: max(78, width - 10), height: appointment.blockHeight(hourHeight: hourHeight))
                    .offset(x: 5, y: appointment.blockOffset(fromHour: startHour, hourHeight: hourHeight))
                }
            }
            .frame(width: width, height: scheduleHeight, alignment: .topLeading)
            .background(Color(.systemGroupedBackground).opacity(isSelected ? 0.72 : 0.36))
        }
        .overlay(alignment: .trailing) {
            Rectangle()
                .fill(Color.secondary.opacity(0.14))
                .frame(width: 1)
        }
    }
}

private struct CalendarDaySchedule: View {
    let appointments: [Appointment]
    let onSelect: (Appointment) -> Void

    private let hourHeight: CGFloat = 72
    private let timeRailWidth: CGFloat = 58

    private var window: ClosedRange<Int> {
        guard !appointments.isEmpty else { return 8...18 }

        let starts = appointments.map(\.startMinutes)
        let ends = appointments.map(\.endMinutes)
        let startHour = max(0, min(8, (starts.min() ?? 480) / 60))
        let endHour = min(24, max(18, Int(ceil(Double(ends.max() ?? 1080) / 60.0))))
        return startHour...max(startHour + 1, endHour)
    }

    var body: some View {
        let startHour = window.lowerBound
        let endHour = window.upperBound
        let hours = Array(startHour...endHour)
        let scheduleHeight = CGFloat(endHour - startHour) * hourHeight

        ScrollView(.vertical, showsIndicators: true) {
            HStack(alignment: .top, spacing: 0) {
                ZStack(alignment: .topTrailing) {
                    ForEach(hours, id: \.self) { hour in
                        Text(String(format: "%02d:00", hour))
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(.secondary)
                            .offset(y: CGFloat(hour - startHour) * hourHeight - 7)
                    }
                }
                .frame(width: timeRailWidth, height: scheduleHeight, alignment: .topTrailing)
                .padding(.trailing, 10)

                ZStack(alignment: .topLeading) {
                    ForEach(hours.dropLast(), id: \.self) { hour in
                        Rectangle()
                            .fill(Color.secondary.opacity(0.16))
                            .frame(height: 1)
                            .offset(y: CGFloat(hour - startHour) * hourHeight)
                    }

                    ForEach(appointments) { appointment in
                        Button {
                            onSelect(appointment)
                        } label: {
                            CalendarAppointmentBlock(appointment: appointment)
                        }
                        .buttonStyle(.plain)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .frame(height: appointment.blockHeight(hourHeight: hourHeight))
                        .offset(y: appointment.blockOffset(fromHour: startHour, hourHeight: hourHeight))
                    }
                }
                .frame(maxWidth: .infinity)
                .frame(height: scheduleHeight)
                .background(Color(.secondarySystemGroupedBackground).opacity(0.55), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
            }
            .padding(.vertical, 8)
        }
        .frame(minHeight: min(scheduleHeight + 16, 420))
    }
}

private struct CalendarAppointmentBlock: View {
    let appointment: Appointment

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(appointment.timeRangeText)
                .font(.caption2.weight(.bold))
                .foregroundStyle(.secondary)
            Text(appointment.customerName)
                .font(.subheadline.weight(.bold))
                .lineLimit(1)
            Text(appointment.serviceName)
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(1)
            Text(appointment.status.titleKey)
                .font(.caption2.weight(.semibold))
                .foregroundStyle(appointment.status == .pending ? .orange : .green)
        }
        .padding(10)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(appointment.status == .pending ? Color.orange.opacity(0.16) : Color.green.opacity(0.14))
        )
        .overlay(alignment: .leading) {
            RoundedRectangle(cornerRadius: 2)
                .fill(appointment.status == .pending ? Color.orange : Color.green)
                .frame(width: 4)
                .padding(.vertical, 8)
        }
        .overlay {
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(appointment.status == .pending ? Color.orange.opacity(0.28) : Color.green.opacity(0.26), lineWidth: 1)
        }
    }
}

struct InboxView: View {
    @Environment(AppState.self) private var appState
    @State private var state: LoadState<[InboxItem]> = .idle
    @State private var selectedItem: InboxItem?

    var body: some View {
        List {
            Section {
                OperationHeader(
                    title: String(localized: "inbox.title"),
                    subtitle: String(localized: "inbox.subtitle"),
                    badgeKey: appState.mode == .business ? "mode.business" : "mode.staff",
                    systemImage: "tray"
                )
            }

            switch state {
            case .idle, .loading:
                Section {
                    LoadingRow(titleKey: "inbox.loading")
                }
            case .failed(let message):
                Section {
                    ErrorRow(message: message) {
                        Task { await load() }
                    }
                }
            case .loaded(let items):
                Section("inbox.needsAction") {
                    let needsAction = items.filter(\.needsAction)
                    if needsAction.isEmpty {
                        EmptyStateRow(
                            titleKey: "inbox.emptyNeedsAction",
                            detailKey: "inbox.emptyNeedsActionDetail",
                            systemImage: "checkmark.circle"
                        )
                    } else {
                        ForEach(needsAction) { item in
                            Button {
                                selectedItem = item
                            } label: {
                                InboxRow(item: item, showsDisclosure: true)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }

                Section("inbox.recent") {
                    let recent = items.filter { !$0.needsAction }
                    if recent.isEmpty {
                        EmptyStateRow(
                            titleKey: "inbox.emptyRecent",
                            detailKey: "inbox.emptyRecentDetail",
                            systemImage: "bell"
                        )
                    } else {
                        ForEach(recent) { item in
                            Button {
                                selectedItem = item
                            } label: {
                                InboxRow(item: item, showsDisclosure: true)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .refreshable {
            await load()
        }
        .task(id: appState.mode) {
            await load()
        }
        .sheet(item: $selectedItem) { item in
            InboxDetailView(item: item)
        }
    }

    private func load() async {
        guard let token = appState.auth.accessToken else {
            state = .failed(String(localized: "auth.error.sessionMissing"))
            return
        }

        state = .loading

        do {
            state = .loaded(try await appState.apiClient.loadInbox(accessToken: token, mode: appState.mode))
        } catch is CancellationError {
            return
        } catch {
            state = .failed(error.localizedDescription)
        }
    }
}

struct InboxDetailView: View {
    @Environment(\.dismiss) private var dismiss
    let item: InboxItem

    var body: some View {
        NavigationStack {
            List {
                Section("inbox.detail.summary") {
                    DisplayTextView(item.title)
                        .font(.headline)
                    DisplayTextView(item.detail)
                        .foregroundStyle(.secondary)

                    if let status = item.status, !status.isEmpty {
                        StatusRow(titleKey: "appointment.status", value: status)
                    }
                }

                if item.hasCustomerDetails {
                    Section("appointment.customer") {
                        if let customerName = item.customerName, !customerName.isEmpty {
                            StatusRow(titleKey: "appointment.customerName", value: customerName)
                        }

                        if let customerEmail = item.customerEmail, !customerEmail.isEmpty {
                            StatusRow(titleKey: "appointment.customerEmail", value: customerEmail)
                        }

                        if let customerPhone = item.customerPhone, !customerPhone.isEmpty {
                            StatusRow(titleKey: "appointment.customerPhone", value: customerPhone)
                        }
                    }
                }

                if item.hasAppointmentDetails {
                    Section("appointment.details") {
                        if let serviceName = item.serviceName, !serviceName.isEmpty {
                            StatusRow(titleKey: "appointment.service", value: serviceName)
                        }

                        if let staffName = item.staffName, !staffName.isEmpty {
                            StatusRow(titleKey: "appointment.staff", value: staffName)
                        }

                        if let currentStartAt = item.currentStartAt {
                            StatusRow(titleKey: "inbox.currentTime", value: currentStartAt.formatted(date: .abbreviated, time: .shortened))
                        }

                        if let requestedStartAt = item.requestedStartAt {
                            StatusRow(titleKey: "inbox.requestedTime", value: requestedStartAt.formatted(date: .abbreviated, time: .shortened))
                        }

                        if let durationMinutes = item.durationMinutes {
                            StatusRow(titleKey: "appointment.duration", value: String(format: String(localized: "appointment.durationMinutes"), durationMinutes))
                        }
                    }
                }

                if !item.actions.isEmpty {
                    Section {
                        ForEach(item.actions) { action in
                            Button(action.titleKey) {
                            }
                            .disabled(true)
                        }
                    } header: {
                        Text("appointment.actions")
                    } footer: {
                        Text("inbox.actionsDisabled")
                    }
                }
            }
            .navigationTitle("inbox.detail.title")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("common.done") {
                        dismiss()
                    }
                }
            }
        }
    }
}

struct SetupView: View {
    @Environment(AppState.self) private var appState
    private let items = SetupItem.fixtures

    var body: some View {
        List {
            Section {
                OperationHeader(
                    title: String(localized: "setup.title"),
                    subtitle: appState.workspaceTitle,
                    badgeKey: "setup.ownerOnly",
                    systemImage: "slider.horizontal.3"
                )
            }

            Section {
                ForEach(items) { item in
                    SetupChecklistRow(item: item)
                }
            } header: {
                Text("setup.checklist")
            } footer: {
                Text("setup.webFirst")
            }
        }
        .listStyle(.insetGrouped)
    }
}

struct AppointmentDetailView: View {
    @Environment(\.dismiss) private var dismiss
    let appointment: Appointment

    var body: some View {
        NavigationStack {
            List {
                Section("appointment.customer") {
                    StatusRow(titleKey: "appointment.customerName", value: appointment.customerName)

                    if let email = appointment.customerEmail, !email.isEmpty {
                        StatusRow(titleKey: "appointment.customerEmail", value: email)
                    }

                    if let phone = appointment.customerPhone, !phone.isEmpty {
                        StatusRow(titleKey: "appointment.customerPhone", value: phone)
                    }
                }

                Section("appointment.details") {
                    StatusRow(titleKey: "appointment.service", value: appointment.serviceName)
                    StatusRow(titleKey: "appointment.staff", value: appointment.staffName)
                    StatusRow(titleKey: "appointment.date", value: appointment.startAt.formatted(date: .abbreviated, time: .omitted))
                    StatusRow(titleKey: "appointment.time", value: appointment.timeRangeText)
                    StatusRow(titleKey: "appointment.duration", value: String(format: String(localized: "appointment.durationMinutes"), appointment.durationMinutes))
                    StatusRow(titleKey: "appointment.status", valueKey: appointment.status.titleKey)
                }

                if !appointment.availableActions.isEmpty {
                    Section {
                        ForEach(appointment.availableActions, id: \.rawValue) { action in
                            Button(action.titleKey) {
                            }
                            .disabled(true)
                        }
                    } header: {
                        Text("appointment.actions")
                    } footer: {
                        Text("appointment.actionsDisabled")
                    }
                }
            }
            .navigationTitle("appointment.title")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("common.done") {
                        dismiss()
                    }
                }
            }
        }
    }
}

private extension Date {
    static var todayStart: Date {
        Date().startOfDay
    }

    static var todayEnd: Date {
        Date().endOfDay
    }

    var startOfDay: Date {
        Calendar.current.startOfDay(for: self)
    }

    var endOfDay: Date {
        Calendar.current.date(bySettingHour: 23, minute: 59, second: 59, of: self) ?? self
    }

    var startOfWeek: Date {
        let calendar = Calendar.current
        let startOfDay = calendar.startOfDay(for: self)
        let weekday = calendar.component(.weekday, from: startOfDay)
        let daysSinceMonday = (weekday + 5) % 7
        return calendar.date(byAdding: .day, value: -daysSinceMonday, to: startOfDay) ?? startOfDay
    }
}

private extension Appointment {
    var timeRangeText: String {
        let end = endAt ?? Calendar.current.date(byAdding: .minute, value: durationMinutes, to: startAt) ?? startAt
        return "\(startAt.formatted(date: .omitted, time: .shortened)) - \(end.formatted(date: .omitted, time: .shortened))"
    }

    var endDate: Date {
        endAt ?? Calendar.current.date(byAdding: .minute, value: durationMinutes, to: startAt) ?? startAt
    }

    var startMinutes: Int {
        let components = Calendar.current.dateComponents([.hour, .minute], from: startAt)
        return (components.hour ?? 0) * 60 + (components.minute ?? 0)
    }

    var endMinutes: Int {
        let components = Calendar.current.dateComponents([.hour, .minute], from: endDate)
        return (components.hour ?? 0) * 60 + (components.minute ?? 0)
    }

    func blockOffset(fromHour hour: Int, hourHeight: CGFloat) -> CGFloat {
        CGFloat(max(0, startMinutes - hour * 60)) / 60 * hourHeight
    }

    func blockHeight(hourHeight: CGFloat) -> CGFloat {
        let minutes = max(15, endMinutes - startMinutes)
        return max(54, CGFloat(minutes) / 60 * hourHeight)
    }
}

private extension AppointmentStatus {
    var titleKey: LocalizedStringKey {
        switch self {
        case .pending:
            "status.pending"
        case .confirmed:
            "status.confirmed"
        case .declined:
            "status.declined"
        case .cancelled:
            "status.cancelled"
        case .completed:
            "status.completed"
        }
    }
}

private extension AppointmentAction {
    var titleKey: LocalizedStringKey {
        switch self {
        case .accept:
            "appointment.action.accept"
        case .decline:
            "appointment.action.decline"
        case .cancel:
            "appointment.action.cancel"
        case .complete:
            "appointment.action.complete"
        }
    }
}

private extension InboxAction {
    var titleKey: LocalizedStringKey {
        switch rawValue {
        case "accept":
            "appointment.action.accept"
        case "decline":
            "appointment.action.decline"
        case "accept_reschedule":
            "inbox.action.acceptReschedule"
        case "decline_reschedule":
            "inbox.action.declineReschedule"
        default:
            "inbox.action.review"
        }
    }
}

private extension InboxItem {
    var hasCustomerDetails: Bool {
        hasText(customerName) || hasText(customerEmail) || hasText(customerPhone)
    }

    var hasAppointmentDetails: Bool {
        hasText(serviceName) || hasText(staffName) || currentStartAt != nil || requestedStartAt != nil || durationMinutes != nil
    }

    func hasText(_ value: String?) -> Bool {
        guard let value else { return false }
        return !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }
}

struct AvailabilityView: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        List {
            Section {
                OperationHeader(
                    title: String(localized: "availability.title"),
                    subtitle: appState.session.staff?.name ?? appState.session.user.name,
                    badgeKey: "mode.staff",
                    systemImage: "clock"
                )
            }

            Section {
                MetricRow(titleKey: "availability.weekdays", value: "09:00-17:00")
                MetricRow(titleKey: "availability.saturday", valueKey: "availability.closed")
                MetricRow(titleKey: "availability.sunday", valueKey: "availability.closed")
            } header: {
                Text("availability.workingHours")
            } footer: {
                Text("availability.readOnly")
            }
        }
        .listStyle(.insetGrouped)
    }
}

struct AccountView: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        @Bindable var appState = appState

        List {
            Section {
                OperationHeader(
                    title: appState.session.user.name,
                    subtitle: appState.session.user.email,
                    badgeKey: appState.mode == .business ? "mode.business" : "mode.staff",
                    systemImage: "person.crop.circle"
                )
            }

            Section("account.profile") {
                StatusRow(titleKey: "account.name", value: appState.session.user.name)
                StatusRow(titleKey: "account.email", value: appState.session.user.email)
                StatusRow(titleKey: "account.language", value: appState.session.user.preferredLanguage.uppercased())
            }

            if appState.session.access.canUseBusiness && appState.session.access.canUseStaff {
                Section("account.workspace") {
                    Picker("account.workspace", selection: $appState.mode) {
                        Text("mode.business").tag(AppMode.business)
                        Text("mode.staff").tag(AppMode.staff)
                    }
                    .pickerStyle(.segmented)
                }
            }

            Section {
                Button("account.logout", role: .destructive) {
                    appState.signOut()
                }
            }

            Section("account.diagnostics") {
                DisclosureGroup("account.contracts") {
                    ForEach(AppAPIClient.Endpoint.allCases, id: \.rawValue) { endpoint in
                        Text(endpoint.rawValue)
                            .font(.footnote.monospaced())
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
    }
}

private extension AppState {
    var workspaceTitle: String {
        if mode == .business, let business = session.business {
            return business.name
        }

        if let staffBusiness = session.staff?.business {
            return staffBusiness.name
        }

        if let staff = session.staff {
            return staff.name
        }

        return session.user.name
    }

    var workspaceSubtitle: String {
        if mode == .business {
            return session.business?.city ?? String(localized: "workspace.business")
        }

        return session.staff?.roleTitle ?? String(localized: "workspace.staff")
    }
}
