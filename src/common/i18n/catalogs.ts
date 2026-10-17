/**
 * The message catalogs bundled into main and both renderers (LOCALIZATION_PLAN D1).
 *
 * The English namespace files are imported by `source.generated.ts`, and the translations by
 * `translations.generated.ts`; `npm run i18n:keys` (and `i18n:merge`) regenerate both, so adding a
 * namespace or a language needs no TypeScript edit (D12). A plain `import` of each JSON file is the
 * one form both tsconfig projects and all three Vite builds agree on.
 */
import { mergeNamespaces, type Catalog } from "./catalogs-core";
import { SOURCE_NAMESPACES } from "./source.generated";

/** English, merged. */
export const SOURCE_CATALOG: Catalog = mergeNamespaces(SOURCE_NAMESPACES);
