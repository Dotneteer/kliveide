/**
 * The renderer hook for translated text (LOCALIZATION_PLAN §5).
 *
 * `const t = useT();` re-renders the component whenever the language changes and returns the
 * module-level `t`. Step 2 connects the language to the shared store (`ide.language`), which then
 * calls `setLanguage`; the hook itself only listens to the translator.
 */
import { useCallback, useSyncExternalStore } from "react";
import { translator, type MessageArgs, type Translator } from "./i18n";
import type { MessageKey } from "./keys.generated";

export type TFunction = (key: MessageKey, args?: MessageArgs) => string;

/** `useT()` for the app; tests pass their own translator. */
export function useT(source: Translator = translator): TFunction {
  // --- The snapshot changes on every language or show-keys switch, which re-renders the caller
  const subscribe = useCallback((onChange: () => void) => source.subscribe(onChange), [source]);
  const snapshot = useSyncExternalStore(subscribe, () => `${source.language}|${source.showingKeys}`);
  return useCallback((key: MessageKey, args?: MessageArgs) => source.t(key, args), [source, snapshot]);
}
