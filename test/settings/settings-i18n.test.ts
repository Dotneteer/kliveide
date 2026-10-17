import { describe, expect, it } from "vitest";
import { setLanguage } from "@common/i18n/i18n";
import {
  SETTINGS_PAGES,
  SETTINGS_ROWS,
  settingsPageTitle,
  settingsRowDescription,
  settingsRowGroup,
  settingsRowMatches,
  settingsRowOptions,
  settingsRowTitle
} from "@common/settings/settings-pages";
import { getMonospaceFontOptions } from "@common/settings/monospace-fonts";
import { t } from "@common/i18n/i18n";
import { LANGUAGES } from "@common/i18n/languages";

/*
 * The Settings dialog in another language (`.plans/LOCALIZATION_PLAN.md` step 6): in the
 * pseudo-locale every page, group, row, help text, choice and button is pseudo text. Literal
 * labels - numbers, sizes, product and font names, language names - are the deliberate exceptions.
 */
const isPseudo = (text: string) => /^\[.*~+\]$/s.test(text);
const FONT_NAMES = new Set(
  [...getMonospaceFontOptions(false), ...getMonospaceFontOptions(true)].map((f) => f.label)
);
const isLiteral = (label: string) =>
  !/[A-Za-z]/.test(label) ||
  /^\d+ [MG]B$/.test(label) ||
  /^640 x \d+$/.test(label) ||
  FONT_NAMES.has(label) ||
  ["Klive BASIC", "Boriel BASIC"].includes(label) ||
  // --- Language names are never translated (§7)
  LANGUAGES.some((l) => l.nativeName === label);

describe("the Settings dialog in the pseudo-locale", () => {
  it("translates every page, group, row, help text, choice and button", () => {
    setLanguage("qps");
    const env = { isWindows: false, uiLanguage: { current: "qps", system: "en", showKeys: false, devTools: true } };
    const problems: string[] = [];
    const check = (where: string, text: string | undefined) => {
      if (text !== undefined && !isPseudo(text)) problems.push(`${where}: ${text}`);
    };
    for (const page of SETTINGS_PAGES) check(`page ${page.id}`, settingsPageTitle(page.id));
    for (const row of SETTINGS_ROWS) {
      check(`${row.id} group`, settingsRowGroup(row));
      check(`${row.id} title`, settingsRowTitle(row));
      check(`${row.id} description`, settingsRowDescription(row));
      for (const option of settingsRowOptions(row, env)) {
        if (!isLiteral(option.label)) check(`${row.id} option ${String(option.value)}`, option.label);
      }
      for (const button of row.buttons ?? []) check(`${row.id} button`, t(button.labelKey));
    }
    expect(problems).toEqual([]);
  });

  it("finds a row by its English words while another language is shown", () => {
    setLanguage("qps");
    const tone = SETTINGS_ROWS.find((r) => r.id === "theme")!;
    expect(settingsRowMatches(tone, "tone")).toBe(true);
    expect(settingsRowMatches(tone, "ţôñé")).toBe(true);
    // --- The old English menu path still finds it
    expect(settingsRowMatches(tone, "view theme")).toBe(true);
  });

  it("keeps English unchanged", () => {
    const tone = SETTINGS_ROWS.find((r) => r.id === "theme")!;
    expect(settingsRowTitle(tone)).toBe("Tone");
    expect(settingsRowGroup(tone)).toBe("Theme");
    expect(settingsRowOptions(tone, { isWindows: false }).map((o) => o.label)).toEqual(["Dark", "Light"]);
  });
});
