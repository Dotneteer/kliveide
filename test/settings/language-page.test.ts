import { describe, expect, it } from "vitest";
import type { AppState } from "@common/state/AppState";
import { offeredLanguages, type UiLanguageState } from "@common/i18n/languages";
import { setLanguage } from "@common/i18n/i18n";
import { TRANSLATION_STATUS } from "@common/i18n/translations.generated";
import {
  SETTINGS_PAGES,
  SETTINGS_ROWS,
  isSettingsRowApplicable,
  languageOptions,
  translationStatusText,
  readSettingsRowValue,
  settingsPageTitle,
  settingsRowMatches,
  settingsRowTitle
} from "@common/settings/settings-pages";
import { createInitialState } from "@renderer/appIde/dialogs/settings/SettingsModel";
import { selectViewModel } from "@renderer/appIde/dialogs/settings/SettingsViewModel";

/*
 * The Language page of the Settings dialog (`.plans/LOCALIZATION_PLAN.md` §7, step 2).
 */

const row = (id: string) => SETTINGS_ROWS.find((r) => r.id === id)!;
const ui = (partial: Partial<UiLanguageState> = {}): UiLanguageState => ({
  current: "en",
  system: "en",
  showKeys: false,
  devTools: false,
  ...partial
});
const stateOf = (uiLanguage: UiLanguageState, globalSettings: Record<string, unknown> = {}) =>
  ({ uiLanguage, globalSettings }) as unknown as AppState;

describe("the Language page", () => {
  it("comes right after General", () => {
    expect(SETTINGS_PAGES.map((p) => p.id).slice(0, 2)).toEqual(["general", "language"]);
    expect(settingsPageTitle("language")).toBe("Language");
  });

  it("offers System default and the five translated languages in a release build", () => {
    expect(languageOptions({ isWindows: false, uiLanguage: ui() })).toEqual([
      { value: "system", label: "System default (English)" },
      { value: "en", label: "English" },
      { value: "es", label: "Español" },
      { value: "pt-BR", label: "Português (Brasil)" },
      { value: "pt-PT", label: "Português (Portugal)" },
      { value: "de", label: "Deutsch" },
      { value: "hu", label: "Magyar" }
    ]);
    // --- "System default" names what it gives, in that language's own name
    expect(languageOptions({ isWindows: false, uiLanguage: ui({ system: "de" }) })[0].label).toBe(
      "System default (Deutsch)"
    );
  });

  it("adds the pseudo-locale in a dev build", () => {
    const values = languageOptions({ isWindows: false, uiLanguage: ui({ devTools: true }) }).map((o) => o.value);
    // --- Plus every disabled language that already has a catalog (Hungarian since the step 9 dry run)
    expect(values).toEqual(["system", ...offeredLanguages(true).map((l) => l.id)]);
    expect(values).toContain("qps");
  });

  it("reads 'system' by default and the stored value otherwise", () => {
    expect(readSettingsRowValue(row("displayLanguage"), stateOf(ui()))).toBe("system");
    expect(
      readSettingsRowValue(row("displayLanguage"), stateOf(ui(), { ideViewOptions: { language: "en" } }))
    ).toBe("en");
  });

  it("shows the show-keys switch only in a dev build", () => {
    expect(isSettingsRowApplicable(row("i18nShowKeys"), stateOf(ui()))).toBe(false);
    expect(isSettingsRowApplicable(row("i18nShowKeys"), stateOf(ui({ devTools: true })))).toBe(true);
  });

  it("is found by English and by current-language words", () => {
    expect(settingsRowMatches(row("displayLanguage"), "language")).toBe(true);
    setLanguage("qps");
    // --- The pseudo-locale's accented text and the English both match
    expect(settingsRowMatches(row("displayLanguage"), "ðîšþļåý")).toBe(true);
    expect(settingsRowMatches(row("displayLanguage"), "display language")).toBe(true);
  });

  it("re-renders its texts in the new language (live switching)", () => {
    const env = { appState: stateOf(ui({ devTools: true })), platform: { isWindows: false, uiLanguage: ui({ devTools: true }) } };
    const state = createInitialState("language", env);
    const english = selectViewModel(state);
    expect(english.nav.find((n) => n.id === "language")?.title).toBe("Language");
    expect(english.sections[0].groups[0].rows[0].title).toBe("Display language");

    setLanguage("qps");
    const pseudo = selectViewModel(state);
    expect(pseudo.nav.find((n) => n.id === "language")?.title).toMatch(/^\[Ļåñĝûåĝé~+\]$/);
    expect(pseudo.sections[0].groups.map((g) => g.title)).toEqual([
      expect.stringMatching(/^\[Ðîšþļåý~+\]$/),
      expect.stringMatching(/^\[Ƒôŕ ţŕåñšļåţôŕš~+\]$/)
    ]);
    expect(settingsRowTitle(row("i18nShowKeys"))).toMatch(/^\[Šĥôŵ/);
    // --- Language names are never translated
    expect(pseudo.sections[0].groups[0].rows[0].options.map((o) => o.label).slice(1)).toEqual(
      offeredLanguages(true).map((l) => l.nativeName)
    );
  });

  it("shows the current language's translation status, and links to the guide", () => {
    const env = (current: string) => ({ isWindows: false, uiLanguage: ui({ current }) });
    expect(translationStatusText(env("en"))).toBeUndefined();
    expect(translationStatusText(env("qps"))).toBeUndefined();
    for (const [lang, status] of Object.entries(TRANSLATION_STATUS)) {
      const percent = Math.floor((status.translated * 100) / status.total);
      expect(translationStatusText(env(lang))).toBe(
        status.outdated
          ? `${percent} % translated · ${status.outdated} ${status.outdated === 1 ? "entry" : "entries"} outdated`
          : `${percent} % translated`
      );
    }
    const help = row("translationStatus");
    expect(help.buttons?.map((b) => b.action)).toEqual(["open:translation-guide"]);
  });
});

