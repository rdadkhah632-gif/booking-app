import { useEffect } from "react";
import { signOutCurrentSession } from "@/lib/auth/signOutCurrentSession";
import { useI18n } from "@/lib/useI18n";

export default function LogoutPage() {
  const { t } = useI18n();

  useEffect(() => {
    void signOutCurrentSession("/");
  }, []);

  return (
    <main className="page-shell">
      <section className="container" style={{ padding: "42px 24px" }}>
        <div className="card" style={{ maxWidth: 520, margin: "0 auto" }}>
          <p className="small muted">
            {t("account.security.signingOut", "Signing out...")}
          </p>
        </div>
      </section>
    </main>
  );
}
