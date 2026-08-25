import "../styles/globals.css";
import "mapbox-gl/dist/mapbox-gl.css";
import type { AppProps } from "next/app";
import Head from "next/head";
import { Analytics } from "@vercel/analytics/next";
import { I18nProvider } from "@/lib/useI18n";
import { getPublicSiteOrigin } from "@/lib/appStoreUrls";

export default function App({ Component, pageProps }: AppProps) {
  const publicSiteOrigin = getPublicSiteOrigin();
  const socialPreview = publicSiteOrigin
    ? `${publicSiteOrigin}/mirebook-customer-discovery-hero.jpg`
    : null;

  const initialLocale =
    pageProps.initialLocale === "sq"
      ? "sq"
      : pageProps.initialLocale === "en"
        ? "en"
        : undefined;

  return (
    <I18nProvider initialLocale={initialLocale}>
      <Head>
        <title>Mirëbook</title>
        <meta
          key="viewport"
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <meta key="theme-color" name="theme-color" content="#ffffff" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta
          key="description"
          name="description"
          content="Discover reviewed places and book local services across Albania with Mirëbook."
        />
        <meta
          key="og-title"
          property="og:title"
          content="Mirëbook — Discover and book across Albania"
        />
        <meta
          key="og-description"
          property="og:description"
          content="Discover reviewed places and book local services across Albania with Mirëbook."
        />
        <meta
          key="twitter-card"
          name="twitter:card"
          content="summary_large_image"
        />
        <meta
          key="twitter-title"
          name="twitter:title"
          content="Mirëbook — Discover and book across Albania"
        />
        <meta
          key="twitter-description"
          name="twitter:description"
          content="Discover reviewed places and book local services across Albania with Mirëbook."
        />
        {socialPreview ? (
          <>
            <meta key="og-image" property="og:image" content={socialPreview} />
            <meta
              key="og-image-width"
              property="og:image:width"
              content="1774"
            />
            <meta
              key="og-image-height"
              property="og:image:height"
              content="887"
            />
            <meta
              key="twitter-image"
              name="twitter:image"
              content={socialPreview}
            />
          </>
        ) : null}
      </Head>
      <Component {...pageProps} />
      <Analytics />
    </I18nProvider>
  );
}
