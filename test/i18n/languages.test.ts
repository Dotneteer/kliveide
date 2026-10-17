import { describe, expect, it } from "vitest";
import {
  LANGUAGES,
  offeredLanguages,
  resolveSystemLanguage,
  resolveUiLanguage
} from "@common/i18n/languages";

const ids = (list: { id: string }[]) => list.map((l) => l.id);

describe("the language table", () => {
  it("lists the planned languages with unique ids and native names", () => {
    expect(ids([...LANGUAGES])).toEqual(["en", "es", "pt-BR", "pt-PT", "de", "hu", "qps"]);
    expect(LANGUAGES.find((l) => l.id === "hu")?.nativeName).toBe("Magyar");
    expect(LANGUAGES.find((l) => l.id === "pt-PT")?.nativeName).toBe("Português (Portugal)");
  });
});

describe("offeredLanguages", () => {
  const ALL = ["es", "pt-BR", "pt-PT", "de", "hu"];

  it("offers the enabled languages that have a catalog", () => {
    expect(ids(offeredLanguages(false, []))).toEqual(["en"]);
    expect(ids(offeredLanguages(false, ALL))).toEqual(["en", ...ALL]);
  });

  it("adds the pseudo-locale in a dev build", () => {
    expect(ids(offeredLanguages(true, ALL))).toEqual(["en", ...ALL, "qps"]);
  });

  it("offers a disabled language with a catalog only in a dev build", () => {
    const table = [...LANGUAGES, { id: "it", nativeName: "Italiano", englishName: "Italian", locale: "it", enabled: false }];
    expect(ids(offeredLanguages(false, ["it"], table))).toEqual(["en"]);
    expect(ids(offeredLanguages(true, ["it"], table))).toEqual(["en", "qps", "it"]);
    expect(ids(offeredLanguages(true, [], table))).toEqual(["en", "qps"]);
  });
});

describe("resolveSystemLanguage", () => {
  const offered = LANGUAGES.filter((l) => !l.devOnly);

  it("takes the first preferred locale Klive offers", () => {
    expect(resolveSystemLanguage(["fr-FR", "de-AT", "en-US"], offered)).toBe("de");
    expect(resolveSystemLanguage(["pt"], offered)).toBe("pt-BR");
    expect(resolveSystemLanguage(["pt-PT"], offered)).toBe("pt-PT");
  });

  it("falls back to English, never to the pseudo-locale", () => {
    expect(resolveSystemLanguage(["fr-FR"], offered)).toBe("en");
    expect(resolveSystemLanguage([], LANGUAGES)).toBe("en");
    expect(resolveSystemLanguage(["qps"], LANGUAGES)).toBe("en");
  });
});

describe("resolveUiLanguage", () => {
  it("follows the system for 'system', a missing or an unoffered value", () => {
    expect(resolveUiLanguage("system", ["hu-HU"], false, ["hu"])).toEqual({ current: "hu", system: "hu" });
    expect(resolveUiLanguage("system", ["hu-HU"], false, [])).toEqual({ current: "en", system: "en" });
    expect(resolveUiLanguage(undefined, ["en-GB"], false, [])).toEqual({ current: "en", system: "en" });
    expect(resolveUiLanguage("qps", ["en-GB"], false, [])).toEqual({ current: "en", system: "en" });
    expect(resolveUiLanguage(42, ["en-GB"], false, [])).toEqual({ current: "en", system: "en" });
  });

  it("honours an offered language", () => {
    expect(resolveUiLanguage("qps", ["en-GB"], true, [])).toEqual({ current: "qps", system: "en" });
    expect(resolveUiLanguage("en", ["de-DE"], true, ["de"])).toEqual({ current: "en", system: "de" });
  });
});
