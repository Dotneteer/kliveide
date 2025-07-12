import type { AppProps } from 'next/app'
import { ThemeProvider } from 'next-themes'
import "nextra-theme-docs/style.css";
import "./custom.css";
 
export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <Component {...pageProps} />
    </ThemeProvider>
  )
}