import SwiftUI

struct AppointmentRow: View {
    let appointment: Appointment
    var showsDisclosure = false

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 8) {
                HStack(alignment: .firstTextBaseline) {
                    Text(appointment.customerName)
                        .font(.headline)
                    Spacer()
                    Text(appointment.startAt, style: .time)
                        .font(.subheadline.weight(.semibold))
                }

                Text(appointment.serviceName)
                    .foregroundStyle(.secondary)

                HStack {
                    Label(appointment.staffName, systemImage: "person")
                    Spacer()
                    Text(statusKey)
                        .font(.caption.weight(.semibold))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(statusTint.opacity(0.14), in: Capsule())
                        .foregroundStyle(statusTint)
                }
                .font(.caption)
            }

            if showsDisclosure {
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.tertiary)
            }
        }
        .padding(.vertical, 4)
    }

    private var statusKey: LocalizedStringKey {
        switch appointment.status {
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

    private var statusTint: Color {
        switch appointment.status {
        case .pending:
            .orange
        case .confirmed:
            .green
        case .declined, .cancelled:
            .red
        case .completed:
            .blue
        }
    }
}

struct InboxRow: View {
    let item: InboxItem
    var showsDisclosure = false

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: item.needsAction ? "exclamationmark.circle.fill" : "bell")
                .foregroundStyle(item.needsAction ? .orange : .secondary)
            VStack(alignment: .leading, spacing: 4) {
                DisplayTextView(item.title)
                    .font(.headline)
                DisplayTextView(item.detail)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            if !item.actions.isEmpty {
                Text("inbox.actionsAvailable")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.orange)
            }

            if showsDisclosure {
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.tertiary)
            }
        }
        .padding(.vertical, 4)
    }
}

struct OperationHeader: View {
    let title: String
    let subtitle: String
    let badgeKey: LocalizedStringKey
    let systemImage: String

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                Image(systemName: systemImage)
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(.white)
                    .frame(width: 36, height: 36)
                    .background(Color.accentColor, in: RoundedRectangle(cornerRadius: 8))

                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.headline)
                    Text(subtitle)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                Spacer()
            }

            Text(badgeKey)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 4)
    }
}

struct SummaryStrip: View {
    let items: [SummaryItem]

    var body: some View {
        HStack(spacing: 8) {
            ForEach(items) { item in
                VStack(alignment: .leading, spacing: 6) {
                    Label(item.titleKey, systemImage: item.systemImage)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Text(item.value)
                        .font(.title3.weight(.semibold))
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(10)
                .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 8))
            }
        }
    }
}

struct SummaryItem: Identifiable {
    let id: String
    let titleKey: LocalizedStringKey
    let value: String
    let systemImage: String
}

struct EmptyStateRow: View {
    let titleKey: LocalizedStringKey
    let detailKey: LocalizedStringKey
    let systemImage: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Image(systemName: systemImage)
                .font(.title2)
                .foregroundStyle(.secondary)
            Text(titleKey)
                .font(.headline)
            Text(detailKey)
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 8)
    }
}

struct SetupChecklistRow: View {
    let item: SetupItem

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: item.systemImage)
                .font(.body.weight(.semibold))
                .foregroundStyle(Color.accentColor)
                .frame(width: 28, height: 28)
            Text(LocalizedStringKey(item.titleKey))
            Spacer()
            Text(LocalizedStringKey(item.statusKey))
                .font(.footnote.weight(.semibold))
                .foregroundStyle(.secondary)
        }
    }
}

struct DisplayTextView: View {
    let value: DisplayText

    init(_ value: DisplayText) {
        self.value = value
    }

    var body: some View {
        switch value {
        case .localized(let key):
            Text(LocalizedStringKey(key))
        case .plain(let text):
            Text(text)
        }
    }
}

struct LoadingRow: View {
    let titleKey: LocalizedStringKey

    var body: some View {
        HStack {
            Spacer()
            ProgressView(titleKey)
            Spacer()
        }
    }
}

struct ErrorRow: View {
    let message: String
    let retry: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(message)
                .foregroundStyle(.secondary)
            Button("common.retry", action: retry)
        }
        .padding(.vertical, 4)
    }
}

struct MetricRow: View {
    let titleKey: LocalizedStringKey
    let value: String?
    let valueKey: LocalizedStringKey?

    init(titleKey: LocalizedStringKey, value: String) {
        self.titleKey = titleKey
        self.value = value
        self.valueKey = nil
    }

    init(titleKey: LocalizedStringKey, valueKey: LocalizedStringKey) {
        self.titleKey = titleKey
        self.value = nil
        self.valueKey = valueKey
    }

    var body: some View {
        HStack {
            Text(titleKey)
            Spacer()
            if let value {
                Text(value)
                    .foregroundStyle(.secondary)
            } else if let valueKey {
                Text(valueKey)
                    .foregroundStyle(.secondary)
            }
        }
    }
}

struct StatusRow: View {
    let titleKey: LocalizedStringKey
    let value: String?
    let valueKey: LocalizedStringKey?

    init(titleKey: LocalizedStringKey, value: String) {
        self.titleKey = titleKey
        self.value = value
        self.valueKey = nil
    }

    init(titleKey: LocalizedStringKey, valueKey: LocalizedStringKey) {
        self.titleKey = titleKey
        self.value = nil
        self.valueKey = valueKey
    }

    var body: some View {
        HStack {
            Text(titleKey)
            Spacer()
            if let value {
                Text(value)
                    .foregroundStyle(.secondary)
            } else if let valueKey {
                Text(valueKey)
                    .foregroundStyle(.secondary)
            }
        }
    }
}
