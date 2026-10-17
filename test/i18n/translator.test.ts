import { describe, expect, it, vi } from "vitest";
import { resolveLanguage, setLanguage, t, translator, Translator } from "@common/i18n/i18n";
import { SOURCE_CATALOG } from "@common/i18n/catalogs";
import { mergeNamespaces } from "@common/i18n/catalogs-core";

const en = {
  "menu.file.openFile": "Open File…",
  "dialog.delete.confirm": "Delete {name}?",
  "statusbar.breakpoints": "{count, plural, one {# breakpoint} other {# breakpoints}}",
  "common.none": "<none>",
  "common.onlyEnglish": "Only in English",
  "common.empty": ""
};
const de = {
  "menu.file.openFile": "Datei öffnen…",
  "dialog.delete.confirm": "{name} löschen?",
  "statusbar.breakpoints": "{count, plural, one {# Haltepunkt} other {# Haltepunkte}}",
  // --- A broken translation must fall back to English, not throw
  "common.none": "{oops"
};
const hu = {
  // --- Hungarian has no "one" category; the translator keeps only "other"
  "statusbar.breakpoints": "{count, plural, other {# töréspont}}"
};

function create(): Translator {
  return new Translator({ source: en, catalogs: { de, hu } });
}

describe("Translator", () => {
  it("formats English text, placeholders and plurals", () => {
    const tr = create();
    expect(tr.language).toBe("en");
    expect(tr.t("menu.file.openFile")).toBe("Open File…");
    expect(tr.t("dialog.delete.confirm", { name: "main.kz80.asm" })).toBe("Delete main.kz80.asm?");
    expect(tr.t("statusbar.breakpoints", { count: 1 })).toBe("1 breakpoint");
    expect(tr.t("statusbar.breakpoints", { count: 3 })).toBe("3 breakpoints");
  });

  it("treats tags as text", () => {
    expect(create().t("common.none")).toBe("<none>");
  });

  it("returns an empty English message as empty", () => {
    expect(create().t("common.empty")).toBe("");
  });

  it("shows the translation, falling back to English per key", () => {
    const tr = create();
    tr.setLanguage("de");
    expect(tr.t("menu.file.openFile")).toBe("Datei öffnen…");
    expect(tr.t("dialog.delete.confirm", { name: "x.asm" })).toBe("x.asm löschen?");
    expect(tr.t("statusbar.breakpoints", { count: 2 })).toBe("2 Haltepunkte");
    expect(tr.t("common.onlyEnglish")).toBe("Only in English");
  });

  it("falls back to English when a translation is invalid ICU", () => {
    const tr = create();
    tr.setLanguage("de");
    expect(tr.t("common.none")).toBe("<none>");
  });

  it("uses the target language's plural rules", () => {
    const tr = create();
    tr.setLanguage("hu");
    expect(tr.t("statusbar.breakpoints", { count: 1 })).toBe("1 töréspont");
    expect(tr.t("statusbar.breakpoints", { count: 5 })).toBe("5 töréspont");
  });

  it("returns the key for a key English does not have", () => {
    const tr = create();
    expect(tr.t("menu.does.notExist")).toBe("menu.does.notExist");
    tr.setLanguage("de");
    expect(tr.t("menu.does.notExist")).toBe("menu.does.notExist");
  });

  it("shows English for a language without a catalog", () => {
    const tr = create();
    tr.setLanguage("xx");
    expect(tr.language).toBe("xx");
    expect(tr.t("menu.file.openFile")).toBe("Open File…");
  });

  it("never throws when an argument is missing", () => {
    const tr = create();
    expect(() => tr.t("dialog.delete.confirm")).not.toThrow();
    expect(tr.t("dialog.delete.confirm")).toBe("Delete {name}?");
  });

  it("shows keys in show-keys mode", () => {
    const tr = create();
    tr.setShowKeys(true);
    expect(tr.t("menu.file.openFile")).toBe("menu.file.openFile");
    tr.setShowKeys(false);
    expect(tr.t("menu.file.openFile")).toBe("Open File…");
  });

  it("notifies subscribers on a change, once per change", () => {
    const tr = create();
    const listener = vi.fn();
    const unsubscribe = tr.subscribe(listener);
    tr.setLanguage("de");
    tr.setLanguage("de");
    tr.setShowKeys(true);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenCalledWith("de");
    unsubscribe();
    tr.setLanguage("en");
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("lists the languages it has text for", () => {
    expect(create().availableLanguages).toEqual(["en", "de", "hu", "qps"]);
    expect(new Translator({ source: en, pseudoLanguage: null }).availableLanguages).toEqual(["en"]);
  });
});

describe("pseudo-locale (qps)", () => {
  it("accents, pads and brackets the English text, keeping placeholders", () => {
    const tr = create();
    tr.setLanguage("qps");
    const open = tr.t("menu.file.openFile");
    expect(open.startsWith("[Ôþéñ Ƒîļé…")).toBe(true);
    expect(open.endsWith("~]")).toBe(true);
    expect(open.length).toBeGreaterThan("Open File…".length * 1.3);
    expect(tr.t("dialog.delete.confirm", { name: "main.asm" })).toContain("main.asm");
    expect(tr.t("statusbar.breakpoints", { count: 3 })).toMatch(/^\[3 ƀŕéåķþôîñţš~+\]$/);
  });
});

describe("the app translator", () => {
  it("starts in English, pinned by the test setup", () => {
    expect(translator.language).toBe("en");
    setLanguage("qps");
    expect(translator.language).toBe("qps");
  });

  it("is reset to English before the next test", () => {
    expect(translator.language).toBe("en");
  });

  it("returns an unknown key unchanged", () => {
    expect(t("menu.not.aKey" as never)).toBe("menu.not.aKey");
  });

  it("has a text-only English catalog", () => {
    expect(Object.keys(SOURCE_CATALOG).some((k) => k.startsWith("@"))).toBe(false);
  });
});

describe("mergeNamespaces", () => {
  it("drops metadata entries and non-strings", () => {
    expect(
      mergeNamespaces({
        a: { "a.one": "One", "@a.one": { context: "c" } },
        b: { "b.two": "Two", "b.bad": 3 }
      })
    ).toEqual({ "a.one": "One", "b.two": "Two" });
  });
});

describe("resolveLanguage", () => {
  const available = ["en", "es", "pt-BR", "pt-PT", "de", "hu"];

  it("honours an explicit, supported setting", () => {
    expect(resolveLanguage("de", "hu-HU", available)).toBe("de");
  });

  it.each([
    ["pt-BR", "pt-BR"],
    ["pt-PT", "pt-PT"],
    ["pt_PT", "pt-PT"],
    ["pt", "pt-BR"],
    ["es-MX", "es"],
    ["de-AT", "de"],
    ["hu", "hu"],
    ["fr-FR", "en"],
    ["", "en"]
  ])("resolves system locale %s to %s", (locale, expected) => {
    expect(resolveLanguage("system", locale, available)).toBe(expected);
  });

  it("treats an unsupported setting like system", () => {
    expect(resolveLanguage("fr", "de-DE", available)).toBe("de");
    expect(resolveLanguage(undefined, undefined, available)).toBe("en");
  });
});
