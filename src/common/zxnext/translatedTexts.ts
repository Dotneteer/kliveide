/*
 * Translated text fields for the pure ZX Spectrum Next modules (`.plans/LOCALIZATION_PLAN.md` D7:
 * keys at definition, text at display).
 *
 * The diagnostics and the layer tables are built in pure code and read by view models and
 * components. These helpers keep their `chip`/`sentence` fields and their array entries readable as
 * plain strings, but as getters that translate on each read, so a view re-rendering after a language
 * change shows the new language without the result being recomputed.
 */
import { t, type MessageArgs } from "@common/i18n/i18n";
import type { MessageKey } from "@common/i18n/keys.generated";

/** A message key with its arguments */
export type TextRef = { key: MessageKey; args?: MessageArgs };

/** Adds enumerable getters to `item` that translate each `texts` entry when read */
export function withTranslatedTexts<T extends object, P extends string>(
  item: T,
  texts: Readonly<Record<P, TextRef>>
): T & { readonly [K in P]: string } {
  const result = { ...item } as T & Record<P, string>;
  for (const prop of Object.keys(texts) as P[]) {
    const { key, args } = texts[prop];
    Object.defineProperty(result, prop, { enumerable: true, configurable: true, get: () => t(key, args) });
  }
  return result as T & { readonly [K in P]: string };
}

/**
 * A string array whose entries are fixed text (hardware names, kept English) or message keys read
 * in the current language each time an index is read.
 */
export function translatedList(entries: readonly (string | { key: MessageKey })[]): readonly string[] {
  return entries.reduce<string[]>((list, entry, i) => {
    Object.defineProperty(list, i, {
      enumerable: true,
      get: () => (typeof entry === "string" ? entry : t(entry.key))
    });
    return list;
  }, []);
}
