/**
 * The catalog type and merge helper, shared by the English catalog (`catalogs.ts`) and the
 * generated translations module (`translations.generated.ts`) without either importing the other.
 */

/** A flat `key -> ICU message` table: what `t()` reads. */
export type Catalog = Readonly<Record<string, string>>;

/** The id of the source language; every other catalog falls back to it (D2). */
export const SOURCE_LANGUAGE = "en";

/** The generated pseudo-locale (plan §2); built from English at run time, never a file. */
export const PSEUDO_LANGUAGE = "qps";

/**
 * Merges namespace files into one flat catalog, dropping the `@key` metadata entries (D4) and
 * anything that is not a string.
 */
export function mergeNamespaces(namespaces: Readonly<Record<string, Record<string, unknown>>>): Catalog {
  const result: Record<string, string> = {};
  for (const ns of Object.values(namespaces)) {
    for (const [key, value] of Object.entries(ns)) {
      if (key.startsWith("@") || typeof value !== "string") continue;
      result[key] = value;
    }
  }
  return result;
}
