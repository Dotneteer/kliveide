import { describe, expect, it } from "vitest";
import type { AppState } from "@state/AppState";
import { Translator } from "@common/i18n/i18n";
import { installUiLanguageSync } from "@renderer/core/uiLanguageSync";

function fakeStore(initial: Partial<AppState>) {
  let state = initial as AppState;
  const listeners = new Set<() => void>();
  return {
    getState: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    set(next: Partial<AppState>) {
      state = { ...state, ...next };
      listeners.forEach((l) => l());
    },
    get listenerCount() {
      return listeners.size;
    }
  };
}

describe("installUiLanguageSync", () => {
  it("follows the published language, show-keys and the document language", () => {
    const tr = new Translator({ source: { "menu.a.b": "Open" } });
    const doc = { documentElement: { lang: "" } } as unknown as Document;
    const store = fakeStore({});
    const uninstall = installUiLanguageSync(store, tr, doc);

    // --- Nothing published yet: English stays
    expect(tr.language).toBe("en");

    store.set({ uiLanguage: { current: "qps", system: "en", showKeys: false, devTools: true } });
    expect(tr.language).toBe("qps");
    expect(tr.t("menu.a.b")).toMatch(/^\[Ôþéñ~+\]$/);
    // --- The pseudo-locale formats as English
    expect(doc.documentElement.lang).toBe("en");

    store.set({ uiLanguage: { current: "en", system: "en", showKeys: true, devTools: true } });
    expect(tr.t("menu.a.b")).toBe("menu.a.b");

    uninstall();
    expect(store.listenerCount).toBe(0);
  });

  it("applies a language already in the store when installed", () => {
    const tr = new Translator({ source: {} });
    const store = fakeStore({ uiLanguage: { current: "qps", system: "en", showKeys: false, devTools: true } });
    installUiLanguageSync(store, tr, undefined);
    expect(tr.language).toBe("qps");
  });
});
