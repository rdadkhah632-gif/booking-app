import SwiftUI

struct LoginView: View {
    @Environment(AppState.self) private var appState
    @State private var email = ""
    @State private var password = ""

    var body: some View {
        @Bindable var auth = appState.auth

        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("auth.productLabel")
                            .font(.caption.weight(.bold))
                            .textCase(.uppercase)
                            .foregroundStyle(Color.accentColor)

                        Text("auth.title")
                            .font(.largeTitle.weight(.bold))
                            .fixedSize(horizontal: false, vertical: true)

                        Text("auth.subtitle")
                            .font(.body)
                            .foregroundStyle(.secondary)
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

                            Divider()
                                .padding(.leading, 16)

                            SecureField("auth.password", text: $password)
                                .textContentType(.password)
                                .padding(.horizontal, 16)
                                .frame(minHeight: 56)
                        }
                        .background(.background, in: RoundedRectangle(cornerRadius: 8))
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(.separator.opacity(0.4), lineWidth: 1)
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
                        .buttonStyle(.borderedProminent)
                        .disabled(auth.isLoading)
                    }

                    if let message = auth.errorMessage {
                        Text(message)
                            .font(.subheadline)
                            .foregroundStyle(.red)
                            .padding(14)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(.red.opacity(0.08), in: RoundedRectangle(cornerRadius: 8))
                    }

                    VStack(alignment: .leading, spacing: 12) {
                        AuthLinkRow(
                            titleKey: "auth.createBusinessAccount",
                            subtitleKey: "auth.createBusinessAccountDetail",
                            systemImage: "building.2",
                            destination: appState.businessRegisterURL
                        )

                        AuthLinkRow(
                            titleKey: "auth.openWebLogin",
                            subtitleKey: "auth.openWebLoginDetail",
                            systemImage: "safari",
                            destination: appState.businessWebLoginURL
                        )

                        AuthLinkRow(
                            titleKey: "auth.resetPassword",
                            subtitleKey: "auth.resetPasswordDetail",
                            systemImage: "key",
                            destination: appState.resetPasswordURL
                        )
                    }

                    VStack(alignment: .leading, spacing: 8) {
                        Label("auth.staffHint", systemImage: "person.text.rectangle")
                            .font(.footnote.weight(.semibold))
                        Text("auth.footer")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.bottom, 24)
                }
                .padding(.horizontal, 24)
            }
            .background(Color(.secondarySystemBackground))
        }
    }
}

struct AuthLinkRow: View {
    let titleKey: LocalizedStringKey
    let subtitleKey: LocalizedStringKey
    let systemImage: String
    let destination: URL

    var body: some View {
        Link(destination: destination) {
            HStack(spacing: 12) {
                Image(systemName: systemImage)
                    .font(.body.weight(.semibold))
                    .foregroundStyle(Color.accentColor)
                    .frame(width: 28, height: 28)

                VStack(alignment: .leading, spacing: 2) {
                    Text(titleKey)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.primary)
                    Text(subtitleKey)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                Image(systemName: "arrow.up.forward")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.tertiary)
            }
            .padding(14)
            .background(.background, in: RoundedRectangle(cornerRadius: 8))
        }
    }
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
