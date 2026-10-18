/**
 * The website's typefaces (decision D8): Schibsted Grotesk for headings, IBM Plex Sans for text,
 * JetBrains Mono for code and labels. next/font downloads them at build time and serves them from
 * the site itself, so visitors never fetch from Google.
 *
 * Each exposes a CSS variable that app/tokens.css builds its font stacks on.
 */
import { IBM_Plex_Sans, JetBrains_Mono, Schibsted_Grotesk } from "next/font/google";

const display = Schibsted_Grotesk({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "700", "800"],
  variable: "--font-display",
  display: "swap"
});

const body = IBM_Plex_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
  display: "swap"
});

const mono = JetBrains_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "600"],
  variable: "--font-mono",
  display: "swap"
});

/** The class names that define the three font variables; put them on <html>. */
export const fontVariables = `${display.variable} ${body.variable} ${mono.variable}`;
