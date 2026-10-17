import { afterEach, describe, expect, it } from "vitest";
import { setLanguage } from "@common/i18n/i18n";
import { describeSpectrumMedia } from "@renderer/appEmu/machines/spectrumMedia";
import { cardTypes } from "@renderer/appEmu/machines/z88Cards";

/*
 * The emulator window's texts in the pseudo-locale (`.plans/LOCALIZATION_PLAN.md` step 11): the
 * tables built at module load translate when read, so a language switch reaches them.
 */
const isPseudo = (text: string) => /^\[.*~+\]$/s.test(text);

describe("the emulator's texts in the pseudo-locale", () => {
  afterEach(() => setLanguage("en"));

  it("translates the Spectrum media strip's cards, keeping the drive letter", () => {
    setLanguage("qps");
    const cards = describeSpectrumMedia({}, 2, true);
    for (const card of cards) {
      expect(isPseudo(card.title), card.title).toBe(true);
      expect(isPseudo(card.emptyText), card.emptyText).toBe(true);
    }
    expect(cards.map((c) => c.driveLetter)).toEqual([undefined, "A", "B", undefined]);
  });

  it("translates the Z88 card type names on each read, keeping the sizes", () => {
    setLanguage("qps");
    for (const card of cardTypes) {
      expect(isPseudo(card.typeName), card.typeName).toBe(true);
    }
    const ram = cardTypes.find((c) => c.sizeLabel === "128K")!;
    expect(ram.label.endsWith("*128K")).toBe(true);
    setLanguage("en");
    expect(ram.label).toBe("RAM*128K");
    expect(cardTypes.find((c) => c.value === "IF28F004S5")?.label).toBe("Intel Flash 28F004S5*512K");
  });
});
