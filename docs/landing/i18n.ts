/**
 * The landing page's text (docs/i18n/landing/<lang>.json), with English as the fallback for any
 * key a translation lacks. `@key` entries are translator context and are never shown.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_LOCALE, TRANSLATED_AREAS } from "../i18n/locales.mjs";

type Catalog = Record<string, string | { context: string }>;

function load(lang: string): Catalog {
  const file = join(process.cwd(), "i18n", "landing", `${lang}.json`);
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as Catalog) : {};
}

export type Translate = (key: string, vars?: Record<string, string>) => string;

/** A `t()` for one language. Unknown keys fail the build rather than showing the key. */
export function landingTranslator(lang: string): Translate {
  const own = load(lang);
  const english = lang === DEFAULT_LOCALE ? own : load(DEFAULT_LOCALE);
  return (key, vars = {}) => {
    const text = own[key] ?? english[key];
    if (typeof text !== "string") throw new Error(`Landing page: no text for "${key}"`);
    return text.replace(/\{(\w+)\}/g, (match, name) => vars[name] ?? match);
  };
}

/** The URL of a documentation area for a language: its own if translated, else English. */
export function docsHref(lang: string, area: string, rest = ""): string {
  const locale = lang === DEFAULT_LOCALE || TRANSLATED_AREAS.includes(area) ? lang : DEFAULT_LOCALE;
  return `/${locale}/${area}/${rest}`;
}

/** The landing page's URL for a language ("/" is English's). */
export function landingHref(lang: string): string {
  return lang === DEFAULT_LOCALE ? "/" : `/${lang}/`;
}
