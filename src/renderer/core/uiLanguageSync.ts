/**
 * Keeps a renderer's translator on the language main publishes (`.plans/LOCALIZATION_PLAN.md` §5).
 *
 * Installed at bootstrap, before React renders, as a plain store subscriber: it runs inside the
 * dispatch that delivers the new language, so the re-render that follows already formats text in
 * that language (a React effect would let one render run in the old one). Components re-render
 * through `useT()`, which listens to the translator.
 */
import type { AppState } from "@state/AppState";
import { translator, type Translator } from "@common/i18n/i18n";
import { languageInfo } from "@common/i18n/languages";

type StoreLike = {
  getState: () => AppState;
  subscribe: (listener: () => void) => () => void;
};

/** Applies the store's language now and on every change; returns the unsubscribe */
export function installUiLanguageSync(
  store: StoreLike,
  target: Translator = translator,
  doc: Pick<Document, "documentElement"> | undefined = typeof document === "undefined" ? undefined : document
): () => void {
  const apply = () => {
    const ui = store.getState()?.uiLanguage;
    if (!ui) return;
    target.setLanguage(ui.current);
    target.setShowKeys(ui.showKeys);
    // --- Hyphenation and spell-check hints follow the language
    const lang = languageInfo(ui.current)?.locale ?? ui.current;
    if (doc?.documentElement && doc.documentElement.lang !== lang) doc.documentElement.lang = lang;
  };
  apply();
  return store.subscribe(apply);
}
