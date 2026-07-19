import '../styles/globals.css'
import 'mapbox-gl/dist/mapbox-gl.css'
import type { AppProps } from 'next/app'
import Head from 'next/head'
import { I18nProvider } from '@/lib/useI18n'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <I18nProvider>
      <Head>
        <title>Mirëbook</title>
      </Head>
      <Component {...pageProps} />
    </I18nProvider>
  )
}
