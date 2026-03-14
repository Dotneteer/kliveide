import type { AppProps } from 'next/app'
import "nextra-theme-docs/style.css";
import "./custom.css";
 
export default function MyApp({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />
}