/**
 * The display language in the main process (`.plans/LOCALIZATION_PLAN.md` §5, D8).
 *
 * Main is the one place that resolves the `ideViewOptions.language` setting: "system" becomes the
 * OS's preferred language (when Klive offers it). The result goes into the app state
 * (`uiLanguage`), which both renderers follow, and into main's own translator, which the menus
 * read. A change invalidates the menu cache so the next `setupMenu` rebuilds every label.
 */
import { get } from "lodash";
import type { AppState } from "@state/AppState";
import type { Action } from "@state/Action";
import { setUiLanguageAction } from "@state/actions";
import { translator } from "@common/i18n/i18n";
import { resolveUiLanguage, LANGUAGE_SYSTEM, type UiLanguageState } from "@common/i18n/languages";
import { SETTING_IDE_I18N_SHOW_KEYS, SETTING_IDE_LANGUAGE } from "@common/settings/setting-const";

export type UiLanguageSyncDeps = {
  getState: () => AppState;
  dispatch: (action: Action) => void;
  /** The OS's preferred locales, most preferred first */
  systemLocales: () => readonly string[];
  /** A dev build */
  devTools: boolean;
  /** Called after the language (or show-keys) changed */
  onChanged?: (value: UiLanguageState) => void;
};

/** The language state the settings ask for now */
export function computeUiLanguage(
  state: AppState,
  systemLocales: readonly string[],
  devTools: boolean
): UiLanguageState {
  const setting = get(state?.globalSettings, SETTING_IDE_LANGUAGE, LANGUAGE_SYSTEM);
  const { current, system } = resolveUiLanguage(setting, systemLocales, devTools);
  const showKeys = !!get(state?.globalSettings, SETTING_IDE_I18N_SHOW_KEYS, false);
  return { current, system, showKeys, devTools };
}

function sameLanguage(a: UiLanguageState | undefined, b: UiLanguageState): boolean {
  return (
    !!a &&
    a.current === b.current &&
    a.system === b.system &&
    a.showKeys === b.showKeys &&
    a.devTools === b.devTools
  );
}

/**
 * Returns the sync function to call on every store change: it publishes the language when it
 * differs from the published one. `force` re-publishes regardless — for the moment the windows
 * exist, since a state dispatched before that reaches no renderer.
 */
export function createUiLanguageSync(deps: UiLanguageSyncDeps): (force?: boolean) => void {
  return (force = false) => {
    const state = deps.getState();
    const wanted = computeUiLanguage(state, deps.systemLocales(), deps.devTools);
    const changed = !sameLanguage(state?.uiLanguage, wanted);
    if (!changed && !force) return;
    translator.setLanguage(wanted.current);
    translator.setShowKeys(wanted.showKeys);
    deps.dispatch(setUiLanguageAction(wanted));
    if (changed) deps.onChanged?.(wanted);
  };
}
