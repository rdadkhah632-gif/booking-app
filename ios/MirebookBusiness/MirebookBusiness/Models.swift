import Foundation

struct AppSessionContext: Decodable, Equatable {
    var user: AppUser
    var business: AppBusiness?
    var staff: AppStaffProfile?
    var access: AppAccess
}

struct AppUser: Decodable, Equatable {
    var id: String
    var email: String
    var name: String
    var preferredLanguage: String

    enum CodingKeys: String, CodingKey {
        case id
        case email
        case name
        case preferredLanguage
    }

    init(id: String, email: String, name: String, preferredLanguage: String) {
        self.id = id
        self.email = email
        self.name = name
        self.preferredLanguage = preferredLanguage
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        email = try container.decodeIfPresent(String.self, forKey: .email) ?? ""
        name = try container.decodeIfPresent(String.self, forKey: .name) ?? email
        preferredLanguage = try container.decodeIfPresent(String.self, forKey: .preferredLanguage) ?? "en"
    }
}

struct AppAccess: Decodable, Equatable {
    var canUseBusiness: Bool
    var canUseStaff: Bool
    var defaultRoute: String? = nil
    var appMode: String? = nil
    var tabs: [String]? = nil
}

struct AppBusiness: Decodable, Equatable {
    var id: String
    var name: String
    var city: String?
    var category: String? = nil
    var published: Bool
    var timezone: String?

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case city
        case category
        case published
        case timezone
    }

    init(id: String, name: String, city: String?, category: String? = nil, published: Bool, timezone: String?) {
        self.id = id
        self.name = name
        self.city = city
        self.category = category
        self.published = published
        self.timezone = timezone
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        name = try container.decodeIfPresent(String.self, forKey: .name) ?? String(localized: "business.fallbackName")
        city = try container.decodeIfPresent(String.self, forKey: .city)
        category = try container.decodeIfPresent(String.self, forKey: .category)
        published = try container.decodeIfPresent(Bool.self, forKey: .published) ?? false
        timezone = try container.decodeIfPresent(String.self, forKey: .timezone)
    }
}

struct AppStaffProfile: Decodable, Equatable {
    var id: String
    var businessId: String
    var name: String
    var roleTitle: String? = nil
    var active: Bool
    var business: AppBusiness? = nil

    enum CodingKeys: String, CodingKey {
        case id
        case businessId
        case name
        case roleTitle
        case active
        case business
    }

    init(
        id: String,
        businessId: String,
        name: String,
        roleTitle: String? = nil,
        active: Bool,
        business: AppBusiness? = nil
    ) {
        self.id = id
        self.businessId = businessId
        self.name = name
        self.roleTitle = roleTitle
        self.active = active
        self.business = business
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        businessId = try container.decode(String.self, forKey: .businessId)
        name = try container.decodeIfPresent(String.self, forKey: .name) ?? String(localized: "appointment.staff.fallback")
        roleTitle = try container.decodeIfPresent(String.self, forKey: .roleTitle)
        active = try container.decodeIfPresent(Bool.self, forKey: .active) ?? false
        business = try container.decodeIfPresent(AppBusiness.self, forKey: .business)
    }
}

struct Appointment: Decodable, Identifiable, Equatable {
    var id: String
    var customerName: String
    var customerEmail: String?
    var customerPhone: String?
    var serviceName: String
    var staffName: String
    var startAt: Date
    var endAt: Date?
    var durationMinutes: Int
    var status: AppointmentStatus
    var availableActions: [AppointmentAction]

    enum CodingKeys: String, CodingKey {
        case id
        case customerName
        case customerEmail
        case customerPhone
        case serviceName
        case staffName
        case service
        case staff
        case startAt
        case endAt
        case durationMinutes
        case status
        case availableActions
    }

    init(
        id: String,
        customerName: String,
        customerEmail: String? = nil,
        customerPhone: String? = nil,
        serviceName: String,
        staffName: String,
        startAt: Date,
        endAt: Date?,
        durationMinutes: Int,
        status: AppointmentStatus,
        availableActions: [AppointmentAction]
    ) {
        self.id = id
        self.customerName = customerName
        self.customerEmail = customerEmail
        self.customerPhone = customerPhone
        self.serviceName = serviceName
        self.staffName = staffName
        self.startAt = startAt
        self.endAt = endAt
        self.durationMinutes = durationMinutes
        self.status = status
        self.availableActions = availableActions
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        customerName = try container.decode(String.self, forKey: .customerName)
        customerEmail = try container.decodeIfPresent(String.self, forKey: .customerEmail)
        customerPhone = try container.decodeIfPresent(String.self, forKey: .customerPhone)
        serviceName = try container.decodeIfPresent(String.self, forKey: .serviceName)
            ?? container.decodeIfPresent(AppServiceSummary.self, forKey: .service)?.name
            ?? String(localized: "appointment.service.fallback")
        staffName = try container.decodeIfPresent(String.self, forKey: .staffName)
            ?? container.decodeIfPresent(AppStaffSummary.self, forKey: .staff)?.name
            ?? String(localized: "appointment.staff.fallback")
        startAt = try container.decode(Date.self, forKey: .startAt)
        endAt = try container.decodeIfPresent(Date.self, forKey: .endAt)
        durationMinutes = try container.decode(Int.self, forKey: .durationMinutes)
        status = try container.decode(AppointmentStatus.self, forKey: .status)
        availableActions = try container.decodeIfPresent([AppointmentAction].self, forKey: .availableActions) ?? []
    }
}

private struct AppServiceSummary: Decodable {
    let name: String?
}

private struct AppStaffSummary: Decodable {
    let name: String?
}

enum AppointmentStatus: String, Decodable {
    case pending
    case confirmed
    case declined
    case cancelled
    case completed
}

enum AppointmentAction: String, Decodable {
    case accept
    case decline
    case cancel
    case complete
}

struct InboxItem: Decodable, Identifiable, Equatable {
    var id: String
    var title: DisplayText
    var detail: DisplayText
    var needsAction: Bool
    var kind: String?
    var bookingId: String?
    var requestId: String?
    var businessId: String?
    var customerName: String?
    var customerEmail: String?
    var customerPhone: String?
    var serviceName: String?
    var staffName: String?
    var currentStartAt: Date?
    var requestedStartAt: Date?
    var durationMinutes: Int?
    var status: String?
    var actions: [InboxAction]
    var createdAt: Date?
    var readAt: Date?

    enum CodingKeys: String, CodingKey {
        case id
        case titleKey
        case detailKey
        case needsAction
        case title
        case message
        case priority
        case kind
        case bookingId
        case requestId
        case businessId
        case customerName
        case customerEmail
        case customerPhone
        case serviceName
        case staffName
        case currentStartAt
        case requestedStartAt
        case durationMinutes
        case status
        case actions
        case createdAt
        case readAt
    }

    init(id: String, titleKey: String, detailKey: String, needsAction: Bool) {
        self.id = id
        title = .localized(titleKey)
        detail = .localized(detailKey)
        self.needsAction = needsAction
        kind = nil
        bookingId = nil
        requestId = nil
        businessId = nil
        customerName = nil
        customerEmail = nil
        customerPhone = nil
        serviceName = nil
        staffName = nil
        currentStartAt = nil
        requestedStartAt = nil
        durationMinutes = nil
        status = nil
        actions = []
        createdAt = nil
        readAt = nil
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        if let titleKey = try container.decodeIfPresent(String.self, forKey: .titleKey) {
            title = .localized(titleKey)
        } else {
            title = .plain(try container.decodeIfPresent(String.self, forKey: .title) ?? String(localized: "inbox.item.fallbackTitle"))
        }

        if let detailKey = try container.decodeIfPresent(String.self, forKey: .detailKey) {
            detail = .localized(detailKey)
        } else {
            detail = .plain(try container.decodeIfPresent(String.self, forKey: .message) ?? String(localized: "inbox.item.fallbackDetail"))
        }
        let priority = try container.decodeIfPresent(String.self, forKey: .priority)
        needsAction = (try container.decodeIfPresent(Bool.self, forKey: .needsAction)) ?? (priority == "needs_action")
        kind = try container.decodeIfPresent(String.self, forKey: .kind)
        bookingId = try container.decodeIfPresent(String.self, forKey: .bookingId)
        requestId = try container.decodeIfPresent(String.self, forKey: .requestId)
        businessId = try container.decodeIfPresent(String.self, forKey: .businessId)
        customerName = try container.decodeIfPresent(String.self, forKey: .customerName)
        customerEmail = try container.decodeIfPresent(String.self, forKey: .customerEmail)
        customerPhone = try container.decodeIfPresent(String.self, forKey: .customerPhone)
        serviceName = try container.decodeIfPresent(String.self, forKey: .serviceName)
        staffName = try container.decodeIfPresent(String.self, forKey: .staffName)
        currentStartAt = try container.decodeIfPresent(Date.self, forKey: .currentStartAt)
        requestedStartAt = try container.decodeIfPresent(Date.self, forKey: .requestedStartAt)
        durationMinutes = try container.decodeIfPresent(Int.self, forKey: .durationMinutes)
        status = try container.decodeIfPresent(String.self, forKey: .status)
        actions = try container.decodeIfPresent([InboxAction].self, forKey: .actions) ?? []
        createdAt = try container.decodeIfPresent(Date.self, forKey: .createdAt)
        readAt = try container.decodeIfPresent(Date.self, forKey: .readAt)
    }
}

struct InboxAction: Decodable, Identifiable, Equatable, Hashable {
    let rawValue: String

    var id: String { rawValue }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        rawValue = try container.decode(String.self)
    }
}

enum DisplayText: Equatable {
    case localized(String)
    case plain(String)
}

enum LoadState<Value> {
    case idle
    case loading
    case loaded(Value)
    case failed(String)
}

struct TodaySnapshot: Equatable {
    var appointments: [Appointment]
    var inboxItems: [InboxItem]

    var nextAppointment: Appointment? {
        let now = Date()
        return appointments
            .filter { $0.startAt >= now }
            .sorted { $0.startAt < $1.startAt }
            .first ?? appointments.sorted { $0.startAt < $1.startAt }.first
    }

    var pendingCount: Int {
        appointments.filter { $0.status == .pending }.count + inboxItems.filter(\.needsAction).count
    }

    var confirmedCount: Int {
        appointments.filter { $0.status == .confirmed }.count
    }
}

struct SetupItem: Identifiable, Equatable {
    var id: String
    var titleKey: String
    var statusKey: String
    var systemImage: String
}

extension AppSessionContext {
    static let fixture = AppSessionContext(
        user: AppUser(
            id: "fixture-user",
            email: "owner@example.com",
            name: "Arta Hoxha",
            preferredLanguage: "en"
        ),
        business: AppBusiness(
            id: "fixture-business",
            name: "Mirebook Studio",
            city: "Tirana",
            published: true,
            timezone: "Europe/Tirane"
        ),
        staff: AppStaffProfile(
            id: "fixture-staff",
            businessId: "fixture-business",
            name: "Arta Hoxha",
            roleTitle: "Owner",
            active: true
        ),
        access: AppAccess(canUseBusiness: true, canUseStaff: true)
    )

    var preferredMode: AppMode {
        if access.canUseBusiness {
            return .business
        }

        if access.canUseStaff {
            return .staff
        }

        return .business
    }

    var canUseOperationsApp: Bool {
        access.canUseBusiness || access.canUseStaff
    }
}

extension Appointment {
    static let fixtures: [Appointment] = [
        Appointment(
            id: "next",
            customerName: "Elira D.",
            serviceName: "Consultation",
            staffName: "Arta Hoxha",
            startAt: Calendar.current.date(bySettingHour: 10, minute: 30, second: 0, of: Date()) ?? Date(),
            endAt: nil,
            durationMinutes: 45,
            status: .confirmed,
            availableActions: [.cancel, .complete]
        ),
        Appointment(
            id: "pending",
            customerName: "Ben K.",
            serviceName: "Follow-up",
            staffName: "Arta Hoxha",
            startAt: Calendar.current.date(bySettingHour: 14, minute: 0, second: 0, of: Date()) ?? Date(),
            endAt: nil,
            durationMinutes: 30,
            status: .pending,
            availableActions: [.accept, .decline]
        )
    ]
}

extension InboxItem {
    static let fixtures = [
        InboxItem(id: "request", titleKey: "inbox.request.title", detailKey: "inbox.request.detail", needsAction: true),
        InboxItem(id: "update", titleKey: "inbox.update.title", detailKey: "inbox.update.detail", needsAction: false)
    ]
}

extension SetupItem {
    static let fixtures = [
        SetupItem(id: "profile", titleKey: "setup.profile", statusKey: "setup.status.ready", systemImage: "building.2"),
        SetupItem(id: "services", titleKey: "setup.services", statusKey: "setup.status.ready", systemImage: "list.bullet.rectangle"),
        SetupItem(id: "team", titleKey: "setup.team", statusKey: "setup.status.ready", systemImage: "person.2"),
        SetupItem(id: "hours", titleKey: "setup.hours", statusKey: "setup.status.review", systemImage: "clock"),
        SetupItem(id: "publish", titleKey: "setup.publish", statusKey: "setup.status.live", systemImage: "checkmark.seal")
    ]
}
