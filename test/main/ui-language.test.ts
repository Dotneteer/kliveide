import { describe, expect, it, vi } from "vitest";
import type { AppState } from "@state/AppState";
import type { Action } from "@state/Action";
import { appStateFlagsReducer } from "@state/app-state-flags-reducer";
import { translator } from "@common/i18n/i18n";
import { computeUiLanguage, createUiLanguageSync } from "@main/ui-language";

/** A tiny store: the flags reducer is the one that owns `uiLanguage` */
function fakeStore(globalSettings: Record<string, unknown>) {
  let state = { globalSettings } as AppState;
  const dispatched: Action[] = [];
  return {
    get state() {
      return state;
    },
    dispatched,
    setSettings(value: Record<string, unknown>) {
      state = { ...state, globalSettings: value };
    },
    getState: () => state,
    dispatch: (action: Action) => {
      dispatched.push(action);
      state = appStateFlagsReducer(state, action);
    }
  };
}

describe("computeUiLanguage", () => {
  it("reads the language and show-keys settings", () => {
    const state = { globalSettings: { ideViewOptions: { language: "qps", i18nShowKeys: true } } } as AppState;
    // --- German is offered, so a German OS resolves "system" to it
    expect(computeUiLanguage(state, ["de-DE"], true)).toEqual({
      current: "qps",
      system: "de",
      showKeys: true,
      devTools: true
    });
  });

  it("defaults to the system language with keys hidden", () => {
    expect(computeUiLanguage({} as AppState, ["en-US"], false)).toEqual({
      current: "en",
      system: "en",
      showKeys: false,
      devTools: false
    });
  });
});

describe("createUiLanguageSync", () => {
  it("publishes the language, sets main's translator, and reports the change once", () => {
    const store = fakeStore({ ideViewOptions: { language: "qps" } });
    const onChanged = vi.fn();
    const sync = createUiLanguageSync({
      getState: store.getState,
      dispatch: store.dispatch,
      systemLocales: () => ["en-US"],
      devTools: true,
      onChanged
    });

    sync();
    expect(store.state.uiLanguage).toEqual({ current: "qps", system: "en", showKeys: false, devTools: true });
    expect(translator.language).toBe("qps");
    expect(onChanged).toHaveBeenCalledTimes(1);

    // --- Nothing changed: no dispatch
    sync();
    expect(store.dispatched).toHaveLength(1);

    // --- Forced (the windows just appeared): re-published, but not a change
    sync(true);
    expect(store.dispatched).toHaveLength(2);
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it("switches live when the setting changes", () => {
    const store = fakeStore({ ideViewOptions: { language: "qps" } });
    const sync = createUiLanguageSync({
      getState: store.getState,
      dispatch: store.dispatch,
      systemLocales: () => ["en-US"],
      devTools: true
    });
    sync();
    store.setSettings({ ideViewOptions: { language: "system", i18nShowKeys: true } });
    sync();
    expect(store.state.uiLanguage?.current).toBe("en");
    expect(translator.language).toBe("en");
    expect(translator.showingKeys).toBe(true);
  });

  it("ignores the pseudo-locale in a release build", () => {
    const store = fakeStore({ ideViewOptions: { language: "qps" } });
    createUiLanguageSync({
      getState: store.getState,
      dispatch: store.dispatch,
      systemLocales: () => ["en-US"],
      devTools: false
    })();
    expect(store.state.uiLanguage?.current).toBe("en");
  });
});
