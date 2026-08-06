import "../styles/globals.css";
import "mapbox-gl/dist/mapbox-gl.css";
import type { AppProps } from "next/app";
import Head from "next/head";
import { I18nProvider } from "@/lib/useI18n";

export default function App({ Component, pageProps }: AppProps) {
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
        <meta key="twitter-card" name="twitter:card" content="summary" />
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
      </Head>
      <Component {...pageProps} />
    </I18nProvider>
  );
}
