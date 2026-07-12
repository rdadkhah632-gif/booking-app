import SwiftUI

struct LoginView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.openURL) private var openURL
    @State private var email = ""
    @State private var password = ""
    @State private var signUpRole: SignUpRole?

    var body: some View {
        @Bindable var auth = appState.auth

        NavigationStack {
            ZStack {
                AppEntryBackground()

                ScrollView {
                    VStack(alignment: .leading, spacing: 24) {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("auth.productLabel")
                                .font(.caption.weight(.bold))
                                .textCase(.uppercase)
                                .foregroundStyle(Color.mirebookAccent)
                                .padding(.horizontal, 10)
                                .padding(.vertical, 6)
                                .background(Color.mirebookAccentDim, in: Capsule())

                            Text("auth.title")
                                .font(.system(size: 38, weight: .bold))
                                .foregroundStyle(Color.mirebookText)
                                .lineLimit(2)
                                .minimumScaleFactor(0.86)
                                .fixedSize(horizontal: false, vertical: true)

                            Text("auth.subtitle")
                                .font(.body)
                                .foregroundStyle(Color.mirebookTextMuted)
                        }
                        .padding(.top, 48)

                        VStack(spacing: 16) {
                            VStack(spacing: 0) {
                                TextField("auth.email", text: $email)
                                    .textContentType(.username)
                                    .keyboardType(.emailAddress)
                                    .textInputAutocapitalization(.never)
                                    .autocorrectionDisabled()
                                    .padding(.horizontal, 16)
                                    .frame(minHeight: 56)
                                    .foregroundStyle(Color.mirebookText)

                                Divider()
                                    .padding(.leading, 16)
                                    .overlay(Color.mirebookBorder)

                                SecureField("auth.password", text: $password)
                                    .textContentType(.password)
                                    .padding(.horizontal, 16)
                                    .frame(minHeight: 56)
                                    .foregroundStyle(Color.mirebookText)
                            }
                            .background(Color.mirebookSurface2, in: RoundedRectangle(cornerRadius: 8))
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(Color.mirebookBorder, lineWidth: 1)
                            )

                            Button {
                                Task {
                                    if let context = await auth.signIn(email: email, password: password) {
                                        appState.apply(context: context)
                                    }
                                }
                            } label: {
                                HStack {
                                    Spacer()
                                    if auth.isLoading {
                                        ProgressView()
                                            .tint(.white)
                                    } else {
                                        Text("auth.signIn")
                                            .fontWeight(.semibold)
                                    }
                                    Spacer()
                                }
                                .frame(minHeight: 52)
                            }
                            .foregroundStyle(Color.mirebookText)
                            .background(Color.mirebookAccent, in: RoundedRectangle(cornerRadius: 8))
                            .buttonStyle(.plain)
                            .disabled(auth.isLoading)
                        }
                        .padding(16)
                        .background(Color.mirebookSurface, in: RoundedRectangle(cornerRadius: 16))
                        .overlay(
                            RoundedRectangle(cornerRadius: 16)
                                .stroke(Color.mirebookBorder, lineWidth: 1)
                        )

                        if let message = auth.errorMessage {
                            Text(message)
                                .font(.subheadline)
                                .foregroundStyle(Color.mirebookDanger)
                                .padding(14)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(Color.mirebookDanger.opacity(0.12), in: RoundedRectangle(cornerRadius: 8))
                        }

                        VStack(alignment: .leading, spacing: 12) {
                            AuthLinkRow(
                                titleKey: "auth.createBusinessAccount",
                                subtitleKey: "auth.createBusinessAccountDetail",
                                systemImage: "building.2",
                                action: { signUpRole = .business }
                            )

                            AuthLinkRow(
                                titleKey: "auth.createStaffAccount",
                                subtitleKey: "auth.createStaffAccountDetail",
                                systemImage: "person.badge.plus",
                                action: { signUpRole = .staff }
                            )

                            AuthLinkRow(
                                titleKey: "auth.resetPassword",
                                subtitleKey: "auth.resetPasswordDetail",
                                systemImage: "key",
                                action: { openURL(appState.resetPasswordURL) }
                            )
                        }

                        VStack(alignment: .leading, spacing: 8) {
                            Label("auth.staffHint", systemImage: "person.text.rectangle")
                                .font(.footnote.weight(.semibold))
                            Text("auth.footer")
                                .font(.footnote)
                                .foregroundStyle(Color.mirebookTextMuted)
                        }
                        .foregroundStyle(Color.mirebookText)
                        .padding(.bottom, 24)
                    }
                    .padding(.horizontal, 24)
                }
            }
            .sheet(item: $signUpRole) { role in
                NativeSignUpView(role: role) { context in
                    appState.apply(context: context)
                    signUpRole = nil
                }
            }
        }
    }
}

struct AuthLinkRow: View {
    let titleKey: LocalizedStringKey
    let subtitleKey: LocalizedStringKey
    let systemImage: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: systemImage)
                    .font(.body.weight(.semibold))
                    .foregroundStyle(Color.mirebookAccent)
                    .frame(width: 28, height: 28)
                    .background(Color.mirebookAccentDim, in: RoundedRectangle(cornerRadius: 8))

                VStack(alignment: .leading, spacing: 2) {
                    Text(titleKey)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Color.mirebookText)
                    Text(subtitleKey)
                        .font(.footnote)
                        .foregroundStyle(Color.mirebookTextMuted)
                }
                .multilineTextAlignment(.leading)
                .frame(maxWidth: .infinity, alignment: .leading)

                Image(systemName: "arrow.up.forward")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.tertiary)
            }
            .padding(14)
            .background(Color.mirebookSurface, in: RoundedRectangle(cornerRadius: 8))
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(Color.mirebookBorder, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }
}

enum SignUpRole: String, Identifiable {
    case business
    case staff

    var id: String { rawValue }
}

struct NativeSignUpView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    @State private var role: SignUpRole
    @State private var email = ""
    @State private var password = ""
    @State private var fullName = ""
    @State private var phone = ""
    @State private var preferredLanguage = "en"
    @State private var businessName = ""
    @State private var businessPhone = ""
    @State private var businessCategory = ""
    @State private var businessCity = ""
    @State private var businessCountry = "United Kingdom"
    @State private var businessTimezone = "Europe/London"
    @State private var businessCurrency = "GBP"
    @State private var ownerTakesBookings = false
    @State private var isSubmitting = false
    @State private var errorMessage: String?
    @State private var successMessage: String?

    let onSignedIn: (AppSessionContext) -> Void

    init(role: SignUpRole, onSignedIn: @escaping (AppSessionContext) -> Void) {
        _role = State(initialValue: role)
        self.onSignedIn = onSignedIn
    }

    var body: some View {
        NavigationStack {
            ZStack {
                AppEntryBackground()

                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        VStack(alignment: .leading, spacing: 8) {
                            Text(role == .business ? "signup.title.business" : "signup.title.staff")
                                .font(.system(size: 32, weight: .bold))
                                .foregroundStyle(Color.mirebookText)
                                .fixedSize(horizontal: false, vertical: true)

                            Text(role == .business ? "signup.subtitle.business" : "signup.subtitle.staff")
                                .foregroundStyle(Color.mirebookTextMuted)
                        }

                        Picker("signup.accountType", selection: $role) {
                            Text("signup.role.business").tag(SignUpRole.business)
                            Text("signup.role.staff").tag(SignUpRole.staff)
                        }
                        .pickerStyle(.segmented)

                        if role == .staff {
                            SignUpNotice(
                                titleKey: "signup.staffNotice.title",
                                bodyKey: "signup.staffNotice.body",
                                systemImage: "person.text.rectangle"
                            )
                        }

                        VStack(spacing: 12) {
                            SignUpTextField(titleKey: "signup.email", text: $email, keyboardType: .emailAddress, textContentType: .username)
                            SignUpSecureField(titleKey: "signup.password", text: $password)
                            SignUpTextField(titleKey: "signup.fullName", text: $fullName, textContentType: .name)
                            SignUpTextField(titleKey: "signup.phone", text: $phone, keyboardType: .phonePad, textContentType: .telephoneNumber)

                            SignUpPicker(titleKey: "signup.language", selection: $preferredLanguage) {
                                Text("signup.language.en").tag("en")
                                Text("signup.language.sq").tag("sq")
                            }
                        }
                        .padding(16)
                        .background(Color.mirebookSurface, in: RoundedRectangle(cornerRadius: 16))
                        .overlay(
                            RoundedRectangle(cornerRadius: 16)
                                .stroke(Color.mirebookBorder, lineWidth: 1)
                        )

                        if role == .business {
                            businessFields
                        }

                        if let errorMessage {
                            Text(errorMessage)
                                .font(.subheadline)
                                .foregroundStyle(Color.mirebookDanger)
                                .padding(14)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(Color.mirebookDanger.opacity(0.12), in: RoundedRectangle(cornerRadius: 8))
                        }

                        if let successMessage {
                            Text(successMessage)
                                .font(.subheadline)
                                .foregroundStyle(Color.mirebookSuccess)
                                .padding(14)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(Color.mirebookSuccess.opacity(0.12), in: RoundedRectangle(cornerRadius: 8))
                        }

                        Button {
                            Task { await submit() }
                        } label: {
                            HStack {
                                Spacer()
                                if isSubmitting {
                                    ProgressView()
                                        .tint(.white)
                                } else {
                                    Text(role == .business ? "signup.submit.business" : "signup.submit.staff")
                                        .fontWeight(.semibold)
                                }
                                Spacer()
                            }
                            .frame(minHeight: 52)
                        }
                        .foregroundStyle(Color.mirebookText)
                        .background(Color.mirebookAccent, in: RoundedRectangle(cornerRadius: 8))
                        .buttonStyle(.plain)
                        .disabled(isSubmitting)
                    }
                    .padding(24)
                }
            }
            .navigationTitle(role == .business ? "signup.nav.business" : "signup.nav.staff")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("common.done") {
                        dismiss()
                    }
                }
            }
        }
    }

    private var businessFields: some View {
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text("signup.business.section")
                    .font(.headline)
                    .foregroundStyle(Color.mirebookText)
                Text("signup.business.detail")
                    .font(.subheadline)
                    .foregroundStyle(Color.mirebookTextMuted)
            }

            SignUpTextField(titleKey: "signup.business.name", text: $businessName)
            SignUpTextField(titleKey: "signup.business.phone", text: $businessPhone, keyboardType: .phonePad, textContentType: .telephoneNumber)

            SignUpPicker(titleKey: "signup.business.category", selection: $businessCategory) {
                Text("signup.business.category.placeholder").tag("")
                ForEach(Self.categoryOptions, id: \.value) { option in
                    Text(LocalizedStringKey(option.titleKey)).tag(option.value)
                }
            }

            SignUpTextField(titleKey: "signup.business.city", text: $businessCity)
            SignUpTextField(titleKey: "signup.business.country", text: $businessCountry)

            SignUpPicker(titleKey: "signup.business.timezone", selection: $businessTimezone) {
                ForEach(Self.timezoneOptions, id: \.self) { timezone in
                    Text(timezone).tag(timezone)
                }
            }

            SignUpPicker(titleKey: "signup.business.currency", selection: $businessCurrency) {
                ForEach(Self.currencyOptions, id: \.self) { currency in
                    Text(currency).tag(currency)
                }
            }

            Toggle("signup.business.ownerTakesBookings", isOn: $ownerTakesBookings)
                .tint(Color.mirebookAccent)
                .foregroundStyle(Color.mirebookText)
        }
        .padding(16)
        .background(Color.mirebookAccentDim, in: RoundedRectangle(cornerRadius: 16))
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(Color.mirebookAccent.opacity(0.32), lineWidth: 1)
        )
    }

    private func submit() async {
        errorMessage = nil
        successMessage = nil

        let cleanEmail = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let cleanPassword = password
        let cleanFullName = fullName.trimmingCharacters(in: .whitespacesAndNewlines)
        let cleanPhone = phone.trimmingCharacters(in: .whitespacesAndNewlines)
        let cleanBusinessName = businessName.trimmingCharacters(in: .whitespacesAndNewlines)
        let cleanBusinessPhone = businessPhone.trimmingCharacters(in: .whitespacesAndNewlines)
        let cleanBusinessCity = businessCity.trimmingCharacters(in: .whitespacesAndNewlines)
        let cleanBusinessCountry = businessCountry.trimmingCharacters(in: .whitespacesAndNewlines)

        guard !cleanEmail.isEmpty, !cleanPassword.isEmpty else {
            errorMessage = String(localized: "signup.error.emailPasswordRequired")
            return
        }

        guard cleanPassword.count >= 6 else {
            errorMessage = String(localized: "signup.error.passwordTooShort")
            return
        }

        if role == .business {
            guard !cleanFullName.isEmpty, !cleanPhone.isEmpty else {
                errorMessage = String(localized: "signup.error.ownerRequired")
                return
            }

            guard !cleanBusinessName.isEmpty, !cleanBusinessPhone.isEmpty, !businessCategory.isEmpty, !cleanBusinessCity.isEmpty, !cleanBusinessCountry.isEmpty else {
                errorMessage = String(localized: "signup.error.businessRequired")
                return
            }
        }

        isSubmitting = true
        defer { isSubmitting = false }

        do {
            let pendingBusiness = role == .business
                ? NativeSignUpInput.PendingBusiness(
                    name: cleanBusinessName,
                    phone: cleanBusinessPhone,
                    category: businessCategory,
                    city: cleanBusinessCity,
                    country: cleanBusinessCountry,
                    timezone: businessTimezone,
                    currency: businessCurrency,
                    ownerTakesBookings: ownerTakesBookings
                )
                : nil

            let result = try await appState.auth.signUp(
                input: NativeSignUpInput(
                    role: role == .business ? .business : .staff,
                    email: cleanEmail,
                    password: cleanPassword,
                    fullName: cleanFullName,
                    phone: cleanPhone,
                    preferredLanguage: preferredLanguage,
                    pendingBusiness: pendingBusiness
                )
            )

            switch result {
            case .signedIn(let context):
                onSignedIn(context)
            case .verificationRequired:
                successMessage = String(localized: "signup.verificationRequired")
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private static let categoryOptions = [
        SignUpOption(value: "Barber", titleKey: "signup.category.barber"),
        SignUpOption(value: "Hair salon", titleKey: "signup.category.hairSalon"),
        SignUpOption(value: "Nails", titleKey: "signup.category.nails"),
        SignUpOption(value: "Beauty", titleKey: "signup.category.beauty"),
        SignUpOption(value: "Tattoo", titleKey: "signup.category.tattoo"),
        SignUpOption(value: "Pet grooming", titleKey: "signup.category.petGrooming"),
        SignUpOption(value: "Other", titleKey: "signup.category.other")
    ]

    private static let timezoneOptions = [
        "Europe/London",
        "Europe/Tirane",
        "Europe/Rome",
        "Europe/Paris",
        "Europe/Berlin"
    ]

    private static let currencyOptions = ["GBP", "ALL", "EUR", "USD"]
}

private struct SignUpOption {
    let value: String
    let titleKey: String
}

private struct SignUpTextField: View {
    let titleKey: LocalizedStringKey
    @Binding var text: String
    var keyboardType: UIKeyboardType = .default
    var textContentType: UITextContentType?

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(titleKey)
                .font(.caption.weight(.semibold))
                .foregroundStyle(Color.mirebookTextMuted)
            TextField(titleKey, text: $text)
                .keyboardType(keyboardType)
                .textContentType(textContentType)
                .textInputAutocapitalization(keyboardType == .emailAddress ? .never : .words)
                .autocorrectionDisabled(keyboardType == .emailAddress)
                .foregroundStyle(Color.mirebookText)
                .padding(12)
                .background(Color.mirebookSurface2, in: RoundedRectangle(cornerRadius: 8))
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(Color.mirebookBorder, lineWidth: 1)
                )
        }
    }
}

private struct SignUpSecureField: View {
    let titleKey: LocalizedStringKey
    @Binding var text: String

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(titleKey)
                .font(.caption.weight(.semibold))
                .foregroundStyle(Color.mirebookTextMuted)
            SecureField(titleKey, text: $text)
                .textContentType(.newPassword)
                .foregroundStyle(Color.mirebookText)
                .padding(12)
                .background(Color.mirebookSurface2, in: RoundedRectangle(cornerRadius: 8))
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(Color.mirebookBorder, lineWidth: 1)
                )
        }
    }
}

private struct SignUpPicker<Content: View>: View {
    let titleKey: LocalizedStringKey
    @Binding var selection: String
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(titleKey)
                .font(.caption.weight(.semibold))
                .foregroundStyle(Color.mirebookTextMuted)
            Picker(titleKey, selection: $selection, content: content)
                .pickerStyle(.menu)
                .tint(Color.mirebookAccent)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(12)
                .background(Color.mirebookSurface2, in: RoundedRectangle(cornerRadius: 8))
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(Color.mirebookBorder, lineWidth: 1)
                )
        }
    }
}

private struct SignUpNotice: View {
    let titleKey: LocalizedStringKey
    let bodyKey: LocalizedStringKey
    let systemImage: String

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: systemImage)
                .foregroundStyle(Color.mirebookWarning)
            VStack(alignment: .leading, spacing: 4) {
                Text(titleKey)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Color.mirebookText)
                Text(bodyKey)
                    .font(.footnote)
                    .foregroundStyle(Color.mirebookTextMuted)
            }
        }
        .padding(14)
        .background(Color.mirebookWarning.opacity(0.10), in: RoundedRectangle(cornerRadius: 8))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(Color.mirebookWarning.opacity(0.30), lineWidth: 1)
        )
    }
}

private struct AppEntryBackground: View {
    var body: some View {
        Color.mirebookBackground
            .ignoresSafeArea()
    }
}

private extension Color {
    static let mirebookBackground = Color(red: 0.06, green: 0.05, blue: 0.09)
    static let mirebookSurface = Color(red: 0.10, green: 0.10, blue: 0.15)
    static let mirebookSurface2 = Color(red: 0.13, green: 0.13, blue: 0.21)
    static let mirebookBorder = Color.white.opacity(0.10)
    static let mirebookAccent = Color(red: 1.00, green: 0.42, blue: 0.21)
    static let mirebookAccentDim = Color(red: 1.00, green: 0.42, blue: 0.21).opacity(0.12)
    static let mirebookText = Color(red: 1.00, green: 1.00, blue: 0.996)
    static let mirebookTextMuted = Color(red: 0.65, green: 0.65, blue: 0.75)
    static let mirebookDanger = Color(red: 1.00, green: 0.30, blue: 0.43)
    static let mirebookSuccess = Color(red: 0.02, green: 0.84, blue: 0.63)
    static let mirebookWarning = Color(red: 1.00, green: 0.75, blue: 0.04)
}

private extension AuthSessionStore {
    var isLoading: Bool {
        if case .loading = state {
            return true
        }
        return false
    }

    var errorMessage: String? {
        if case .failed(let message) = state {
            return message
        }
        return nil
    }
}
