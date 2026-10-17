/**
 * Option tables with translated labels (`.plans/LOCALIZATION_PLAN.md` D7: keys at definition, text
 * at display).
 *
 * Shared tables such as the sound levels are module-level constants read by the menus, the Settings
 * dialog and the renderers. `withLabels` keeps their `label` field, but as a getter that translates
 * `labelKey` each time it is read, so every consumer shows the current language without change.
 */
import { t, tEnglish } from "./i18n";
import type { MessageKey } from "./keys.generated";

export type Labelled<T> = T & { readonly labelKey: MessageKey; readonly label: string };

/** Adds a translating `label` getter to each item (enumerable, so equality checks still see it) */
export function withLabels<T extends { labelKey: MessageKey }>(items: readonly T[]): Labelled<T>[] {
  return items.map((item) => labelled(item));
}

export function labelled<T extends { labelKey: MessageKey }>(item: T): Labelled<T> {
  return Object.defineProperty({ ...item }, "label", {
    enumerable: true,
    get: () => t(item.labelKey)
  }) as Labelled<T>;
}

/** A record of translated labels: `labels.left` reads `t(keys.left)` each time */
export function labelRecord<K extends string>(keys: Readonly<Record<K, MessageKey>>): Readonly<Record<K, string>> {
  const result = {} as Record<K, string>;
  for (const id of Object.keys(keys) as K[]) {
    Object.defineProperty(result, id, { enumerable: true, get: () => t(keys[id]) });
  }
  return result;
}

/** The English label of an item, for log output (D9) */
export function englishLabel(item: { labelKey: MessageKey }): string {
  return tEnglish(item.labelKey);
}

/**
 * Turns chosen string properties of an object into getters that translate a key each time they are
 * read: `withTexts({ id: "explorer", ... }, { title: "panels.explorer.title" })` keeps `title`
 * readable as before. For module-level registries whose consumers read the property directly.
 */
export function withTexts<T extends object, P extends string>(
  item: T,
  keys: Readonly<Record<P, MessageKey>>
): T & { readonly [K in P]: string } {
  const result = { ...item } as T & Record<P, string>;
  for (const prop of Object.keys(keys) as P[]) {
    Object.defineProperty(result, prop, { enumerable: true, configurable: true, get: () => t(keys[prop]) });
  }
  return result as T & { readonly [K in P]: string };
}
