/**
 * The docs' chrome text (docs/i18n/ui/<lang>.json): search, the table of contents, the theme
 * switch, tab names, notices. English fills any key a translation lacks.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

type Catalog = Record<string, unknown>;

function load(lang: string): Catalog {
  const file = join(process.cwd(), "i18n", "ui", `${lang}.json`);
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as Catalog) : {};
}

export function uiTranslator(lang: string) {
  const own = load(lang);
  const english = load("en");
  return (key: string, vars: Record<string, string> = {}): string => {
    const text = own[key] ?? english[key];
    if (typeof text !== "string") throw new Error(`Docs chrome: no text for "${key}"`);
    return text.replace(/\{(\w+)\}/g, (match, name) => vars[name] ?? match);
  };
}
