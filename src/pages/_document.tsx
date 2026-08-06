import Document, {
  DocumentContext,
  DocumentInitialProps,
  Head,
  Html,
  Main,
  NextScript,
} from "next/document";

type MirebookDocumentProps = DocumentInitialProps & {
  initialLocale: "en" | "sq";
};

export default function MirebookDocument({
  initialLocale,
}: MirebookDocumentProps) {
  return (
    <Html lang={initialLocale}>
      <Head>
        <meta name="application-name" content="Mirëbook" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="theme-color" content="#0f0e17" />
        <meta name="msapplication-TileColor" content="#0f0e17" />

        <meta property="og:site_name" content="Mirëbook" />
        <meta property="og:type" content="website" />

        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/mirebook-mark.svg" type="image/svg+xml" />
        <link
          rel="icon"
          href="/icons/icon-32.png"
          type="image/png"
          sizes="32x32"
        />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </Head>

      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}

MirebookDocument.getInitialProps = async (
  context: DocumentContext,
): Promise<MirebookDocumentProps> => {
  const initialProps = await Document.getInitialProps(context);
  const queryLocale = Array.isArray(context.query.locale)
    ? context.query.locale[0]
    : context.query.locale;
  const acceptedLanguages = String(
    context.req?.headers["accept-language"] || "",
  ).toLowerCase();

  return {
    ...initialProps,
    initialLocale:
      queryLocale === "sq" || (!queryLocale && acceptedLanguages.includes("sq"))
        ? "sq"
        : "en",
  };
};
