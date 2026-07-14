import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <meta name="application-name" content="Mirëbook" />
        <meta
          name="description"
          content="Mirëbook helps customers discover and book local services with real availability, staff selection and appointment management."
        />
        <meta name="format-detection" content="telephone=no" />
        <meta name="theme-color" content="#0f0e17" />
        <meta name="msapplication-TileColor" content="#0f0e17" />

        <meta property="og:site_name" content="Mirëbook" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Mirëbook — Book local services" />
        <meta
          property="og:description"
          content="Discover businesses, choose services, pick available times and manage bookings through Mirëbook."
        />

        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="Mirëbook — Book local services" />
        <meta
          name="twitter:description"
          content="Discover businesses, choose services, pick available times and manage bookings through Mirëbook."
        />

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
  )
}
