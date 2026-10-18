/**
 * The site's languages. Phase 1 of .plans/DOCS_SITE_MODERNIZATION_PLAN.md ships English
 * only; Phase 5 derives this list from src/common/i18n/languages.ts (R1).
 *
 * Plain .mjs so next.config.mjs and the TypeScript app share one list.
 */
export const DEFAULT_LOCALE = "en";
export const LOCALES = ["en"];
