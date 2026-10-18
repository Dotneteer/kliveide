/**
 * The site's languages. Phase 1 of .plans/DOCS_SITE_MODERNIZATION_PLAN.md ships English
 * only; Phase 5 derives this list from src/common/i18n/languages.ts (R1).
 *
 * Plain .mjs so next.config.mjs and the TypeScript app share one list.
 */
export const DEFAULT_LOCALE = "en";
export const LOCALES = ["en"];

/** The language names shown in the language selector, in each language itself. */
export const LOCALE_NAMES = { en: "English" };

/**
 * The documentation areas translated into every non-English locale. Links into any other area
 * go to the English pages (§4.2 of the plan).
 */
export const TRANSLATED_AREAS = ["get-started"];
