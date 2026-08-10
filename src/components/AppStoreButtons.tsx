import { Apple, ArrowUpRight } from "lucide-react";
import { useI18n } from "@/lib/useI18n";
import {
  getBusinessAppStoreUrl,
  getCustomerAppStoreUrl,
} from "@/lib/appStoreUrls";

type StoreLink = {
  href: string;
  product: string;
};

export default function AppStoreButtons() {
  const { t } = useI18n();
  const links: StoreLink[] = [
    getCustomerAppStoreUrl()
      ? {
          href: getCustomerAppStoreUrl() as string,
          product: t("appStore.customer", "Mirëbook customer app"),
        }
      : null,
    getBusinessAppStoreUrl()
      ? {
          href: getBusinessAppStoreUrl() as string,
          product: t("appStore.business", "Mirëbook Business app"),
        }
      : null,
  ].filter((item): item is StoreLink => Boolean(item));

  if (links.length === 0) return null;

  return (
    <section className="home-apps-band" aria-labelledby="app-store-title">
      <div className="container home-apps-band-inner">
        <div>
          <span className="home-apps-kicker">
            {t("appStore.kicker", "Now on iPhone")}
          </span>
          <h2 id="app-store-title">
            {t("appStore.title", "Take Mirëbook with you")}
          </h2>
          <p>
            {t(
              "appStore.body",
              "Discover, manage and keep up with Mirëbook wherever you are.",
            )}
          </p>
        </div>
        <div className="home-app-store-links">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="app-store-button"
              target="_blank"
              rel="noreferrer"
            >
              <Apple size={25} aria-hidden="true" />
              <span>
                <small>{t("appStore.download", "Download on the")}</small>
                <strong>App Store</strong>
                <em>{link.product}</em>
              </span>
              <ArrowUpRight size={18} aria-hidden="true" />
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
