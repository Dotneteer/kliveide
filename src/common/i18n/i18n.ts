/**
 * Klive's message lookup: `t(key, args)` (LOCALIZATION_PLAN D3, D6, §5).
 *
 * The same module runs in main and in both renderers. It holds the current language, looks a key
 * up in that language's catalog, falls back to English for a key the translation lacks (D2), and
 * formats the ICU message with `intl-messageformat`.
 *
 * - A key missing from English is a code bug: `t()` returns the key itself, so it shows on screen.
 * - A translation that fails to format falls back to the English message; an English message that
 *   fails to format is returned as its raw text. `t()` never throws.
 * - D7: call `t()` when text is displayed, never at import time, or the text freezes in the
 *   language that was current when the module loaded.
 */
import { IntlMessageFormat, type MessageValues } from "intl-messageformat";
import type { MessageFormatElement } from "@formatjs/icu-messageformat-parser";
import { SOURCE_CATALOG } from "./catalogs";
import { PSEUDO_LANGUAGE, SOURCE_LANGUAGE, type Catalog } from "./catalogs-core";
import { TRANSLATED_CATALOGS } from "./translations.generated";
import { PARSE_OPTIONS, pseudoLocalize } from "./pseudo";
import type { MessageKey } from "./keys.generated";

/**
 * A compiled message. Typed with intl-messageformat's own `MessageValues` rather than left untyped:
 * from version 12 the untyped form's `format` is chosen by a conditional type that, without
 * `strictNullChecks` (Klive builds without it), resolves to one that takes no values at all.
 */
type Formatter = IntlMessageFormat<MessageValues>;

/** Values substituted into a message's `{placeholders}`. */
export type MessageArgs = Readonly<Record<string, string | number | boolean | Date | null | undefined>>;

export interface TranslatorOptions {
  /** The source-language catalog; every other catalog falls back to it. */
  source: Catalog;
  /** Translated catalogs by language id. */
  catalogs?: Readonly<Record<string, Catalog>>;
  sourceLanguage?: string;
  /** The id of the generated pseudo-locale, or `null` for none. */
  pseudoLanguage?: string | null;
}

type Listener = (language: string) => void;

/**
 * A self-contained message translator. The app uses the singleton below; tests create their own
 * with fixture catalogs.
 */
export class Translator {
  private readonly source: Catalog;
  private readonly catalogs: Readonly<Record<string, Catalog>>;
  private readonly sourceLanguage: string;
  private readonly pseudoLanguage: string | null;
  private languageId: string;
  private showKeys = false;
  private readonly cache = new Map<string, Formatter>();
  private readonly listeners = new Set<Listener>();

  constructor(options: TranslatorOptions) {
    this.source = options.source;
    this.catalogs = options.catalogs ?? {};
    this.sourceLanguage = options.sourceLanguage ?? SOURCE_LANGUAGE;
    this.pseudoLanguage = options.pseudoLanguage === undefined ? PSEUDO_LANGUAGE : options.pseudoLanguage;
    this.languageId = this.sourceLanguage;
  }

  /** The current language id. */
  get language(): string {
    return this.languageId;
  }

  /**
   * The BCP 47 locale for human figures (file sizes, durations, percentages) in the current
   * language; the pseudo-locale formats as the source language. Never use it for addresses, hex,
   * T-states or anything copy-pasteable, which stay invariant (plan §4, "Formatting").
   */
  get locale(): string {
    return this.pseudoLanguage && this.languageId === this.pseudoLanguage ? this.sourceLanguage : this.languageId;
  }

  /** The language ids this translator has text for (source, translations, pseudo-locale). */
  get availableLanguages(): string[] {
    const ids = [this.sourceLanguage, ...Object.keys(this.catalogs)];
    if (this.pseudoLanguage) ids.push(this.pseudoLanguage);
    return ids;
  }

  /**
   * Switches the language. An id without a catalog is accepted and shows the source text, so a
   * stale setting can never leave the UI blank.
   */
  setLanguage(language: string): void {
    if (language === this.languageId) return;
    this.languageId = language;
    this.cache.clear();
    this.notify();
  }

  /** The "Show translation keys" debug mode (plan §2): `t()` returns the key, not the text. */
  setShowKeys(on: boolean): void {
    if (on === this.showKeys) return;
    this.showKeys = on;
    this.notify();
  }

  get showingKeys(): boolean {
    return this.showKeys;
  }

  /** Calls `listener` after every language (or show-keys) change; returns the unsubscribe. */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Looks up and formats a message. Never throws. */
  t(key: string, args?: MessageArgs): string {
    if (this.showKeys) return key;
    const english = this.source[key];
    if (english === undefined) return key;

    const formatter = this.formatterFor(key, english);
    if (formatter) {
      const text = tryFormat(formatter, args);
      if (text !== null) return text;
    }
    // --- The translation failed: retry with English before giving up
    if (formatter && this.languageId !== this.sourceLanguage) {
      const fallback = compile(english, this.sourceLanguage);
      const text = fallback ? tryFormat(fallback, args) : null;
      if (text !== null) return text;
    }
    return english;
  }

  /**
   * The English text of a message, whatever the current language: for log and trace output, which
   * stays English (D9). Never throws; a key English lacks returns the key.
   */
  sourceText(key: string, args?: MessageArgs): string {
    const english = this.source[key];
    if (english === undefined) return key;
    const formatter = compile(english, this.sourceLanguage);
    const text = formatter ? tryFormat(formatter, args) : null;
    return text ?? english;
  }

  private formatterFor(key: string, english: string): Formatter | null {
    const cached = this.cache.get(key);
    if (cached) return cached;

    let formatter: Formatter | null;
    if (this.pseudoLanguage && this.languageId === this.pseudoLanguage) {
      formatter = compilePseudo(english, this.sourceLanguage);
    } else {
      const translated = this.catalogs[this.languageId]?.[key];
      formatter =
        (translated !== undefined && compile(translated, this.languageId)) ||
        compile(english, this.sourceLanguage);
    }
    if (formatter) this.cache.set(key, formatter);
    return formatter;
  }

  private notify(): void {
    for (const listener of [...this.listeners]) listener(this.languageId);
  }
}

function compile(message: string | MessageFormatElement[], locale: string): Formatter | null {
  try {
    return new IntlMessageFormat<MessageValues>(message, locale, undefined, PARSE_OPTIONS);
  } catch {
    return null;
  }
}

function compilePseudo(english: string, locale: string): Formatter | null {
  try {
    return compile(pseudoLocalize(english), locale);
  } catch {
    return null;
  }
}

function tryFormat(formatter: Formatter, args?: MessageArgs): string | null {
  try {
    const result = formatter.format(args);
    return Array.isArray(result) ? result.join("") : String(result);
  } catch {
    return null;
  }
}

/**
 * Picks the language to show for a setting value (plan §5). `"system"` (or an unknown id) is
 * resolved from the OS locale (`app.getLocale()` in main, `navigator.language` in a renderer):
 * an exact match first (`pt-BR`), then the bare language (`es-MX` -> `es`), then any regional
 * variant of it (a bare `pt` -> the first `pt-*` listed), else the source language.
 */
export function resolveLanguage(
  setting: string | undefined,
  systemLocale: string | undefined,
  available: readonly string[],
  sourceLanguage = SOURCE_LANGUAGE
): string {
  if (setting && setting !== "system" && available.includes(setting)) return setting;
  const locale = (systemLocale ?? "").replace("_", "-");
  if (!locale) return sourceLanguage;
  const lower = locale.toLowerCase();
  const exact = available.find((id) => id.toLowerCase() === lower);
  if (exact) return exact;
  const base = lower.split("-")[0];
  const bare = available.find((id) => id.toLowerCase() === base);
  if (bare) return bare;
  const regional = available.find((id) => id.toLowerCase().startsWith(`${base}-`));
  return regional ?? sourceLanguage;
}

/** The app-wide translator. */
export const translator = new Translator({ source: SOURCE_CATALOG, catalogs: TRANSLATED_CATALOGS });

/** Looks up and formats a message in the current language (D7: call it at display time). */
export function t(key: MessageKey, args?: MessageArgs): string {
  return translator.t(key, args);
}

/** The English text of a message, for log output (D9) */
export function tEnglish(key: MessageKey, args?: MessageArgs): string {
  return translator.sourceText(key, args);
}

/** The locale for human figures in the current display language (see `Translator.locale`) */
export function uiLocale(): string {
  return translator.locale;
}

export function setLanguage(language: string): void {
  translator.setLanguage(language);
}

export function getLanguage(): string {
  return translator.language;
}
