/**
 * The supported display languages (LOCALIZATION_PLAN D12): one row per language. The Language
 * settings page, the `system` resolution, the tooling and the contributor guide all read this
 * table, so adding a language is "add a row + a folder".
 *
 * A row with `enabled: false` is not offered to users yet (too incomplete); dev builds still list
 * it once it has a catalog. The five translated languages are enabled since the first translation
 * round (`.plans/LOCALIZATION_PLAN.md` step 10). `qps` is the generated pseudo-locale, offered only in dev builds.
 */
import { PSEUDO_LANGUAGE, SOURCE_LANGUAGE } from "./catalogs-core";
import { TRANSLATED_CATALOGS } from "./translations.generated";
import { resolveLanguage } from "./i18n";

export type LanguageInfo = {
  /** The id stored in the setting and used for the catalog folder */
  id: string;
  /** The language's name in itself; never translated (§7) */
  nativeName: string;
  englishName: string;
  /** The ICU/BCP 47 locale used for plurals and number formats */
  locale: string;
  /** Offered to users */
  enabled: boolean;
  /** Offered only in dev builds (the pseudo-locale) */
  devOnly?: boolean;
};

export const LANGUAGES: readonly LanguageInfo[] = [
  { id: "en", nativeName: "English", englishName: "English", locale: "en", enabled: true },
  { id: "es", nativeName: "Español", englishName: "Spanish", locale: "es", enabled: true },
  {
    id: "pt-BR",
    nativeName: "Português (Brasil)",
    englishName: "Portuguese (Brazil)",
    locale: "pt-BR",
    enabled: true
  },
  {
    id: "pt-PT",
    nativeName: "Português (Portugal)",
    englishName: "Portuguese (Portugal)",
    locale: "pt-PT",
    enabled: true
  },
  { id: "de", nativeName: "Deutsch", englishName: "German", locale: "de", enabled: true },
  { id: "hu", nativeName: "Magyar", englishName: "Hungarian", locale: "hu", enabled: true },
  {
    id: PSEUDO_LANGUAGE,
    nativeName: "Pseudo-locale (qps)",
    englishName: "Pseudo-locale",
    locale: "en",
    enabled: false,
    devOnly: true
  }
];

/** The setting value that follows the operating system's language */
export const LANGUAGE_SYSTEM = "system";

/** The display-language state main resolves and shares with both renderers */
export type UiLanguageState = {
  /** The language every window shows */
  current: string;
  /** What `system` resolves to now (for the "System default (…)" label) */
  system: string;
  /** The "Show translation keys" debug mode */
  showKeys: boolean;
  /** A dev build: the pseudo-locale and the show-keys switch are offered */
  devTools: boolean;
};

export function languageInfo(id: string): LanguageInfo | undefined {
  return LANGUAGES.find((l) => l.id === id);
}

/**
 * The languages offered in the dropdown, in table order: enabled languages that have text (English
 * always does); in dev builds also the disabled ones that have a catalog, and the pseudo-locale.
 */
export function offeredLanguages(
  devTools: boolean,
  catalogIds: readonly string[] = Object.keys(TRANSLATED_CATALOGS),
  table: readonly LanguageInfo[] = LANGUAGES
): LanguageInfo[] {
  return table.filter((l) => {
    if (l.devOnly) return devTools;
    const hasText = l.id === SOURCE_LANGUAGE || catalogIds.includes(l.id);
    return hasText && (l.enabled || devTools);
  });
}

/**
 * The offered language the OS asks for: the first of the OS's preferred locales that matches one
 * (`pt-PT` -> `pt-PT`, `es-MX` -> `es`, a bare `pt` -> `pt-BR`), else English. Never the
 * pseudo-locale.
 */
export function resolveSystemLanguage(systemLocales: readonly string[], offered: readonly LanguageInfo[]): string {
  const ids = offered.filter((l) => !l.devOnly).map((l) => l.id);
  for (const locale of systemLocales) {
    if (!locale) continue;
    const resolved = resolveLanguage(LANGUAGE_SYSTEM, locale, ids, "");
    if (resolved) return resolved;
  }
  return SOURCE_LANGUAGE;
}

/** The language to show for the setting value: an offered id as is, anything else as `system` */
export function resolveUiLanguage(
  setting: unknown,
  systemLocales: readonly string[],
  devTools: boolean,
  catalogIds?: readonly string[]
): { current: string; system: string } {
  const offered = offeredLanguages(devTools, catalogIds);
  const system = resolveSystemLanguage(systemLocales, offered);
  const explicit = typeof setting === "string" && offered.some((l) => l.id === setting);
  return { current: explicit ? (setting as string) : system, system };
}
