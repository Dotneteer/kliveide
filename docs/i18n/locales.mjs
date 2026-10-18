/**
 * The site's languages (R1 of .plans/DOCS_SITE_MODERNIZATION_PLAN.md): the enabled UI languages
 * of the app, exported to languages.json by `node scripts/docs-i18n.cjs languages` (and checked
 * by `doc:i18n:check`). A language is *published* once it has a content/<id>/ folder - that is,
 * once its first translation is merged - so an enabled language without translations yet does
 * not produce empty pages.
 *
 * Plain .mjs so next.config.mjs and the TypeScript app share one list. Server-side only: it
 * reads the file system at build time.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const DEFAULT_LOCALE = "en";

const root = process.cwd();
const languages = JSON.parse(readFileSync(join(root, "i18n", "languages.json"), "utf8"));

/** The published languages, English first. */
export const LOCALES = languages
  .map((l) => l.id)
  .filter((id) => id === DEFAULT_LOCALE || existsSync(join(root, "content", id, "_meta.ts")));

/** Each language's name in itself (never translated). */
export const LOCALE_NAMES = Object.fromEntries(languages.map((l) => [l.id, l.nativeName]));

/**
 * The documentation areas translated into every non-English locale. Links into any other area
 * go to the English pages (§4.2 of the plan). Keep in step with scripts/docs-i18n.cjs.
 */
export const TRANSLATED_AREAS = ["get-started"];
