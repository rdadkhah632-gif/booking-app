import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { I18nProvider } from '@/lib/useI18n'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <I18nProvider>
      <Component {...pageProps} />
    </I18nProvider>
  )
}