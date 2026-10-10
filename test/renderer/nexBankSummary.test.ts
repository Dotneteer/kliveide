import { describe, expect, it } from "vitest";
import type { ProgramAnnotations } from "@renderer/appIde/annotations/programAnnotations";
import {
  bankContentMix,
  bankLabels,
  contentMixPercent,
  formatMixPercent,
  mixLegendTypes,
  isAnnotatedBank,
  isEmptyBank
} from "@renderer/appIde/DocumentPanels/Next/nexBankSummary";

const model = (bank: Record<string, unknown> = {}, globals: { name: string; value: number }[] = []) =>
  ({
    schemaVersion: 2,
    globalLabels: globals,
    banks: {
      "5": { offsetIndex: 1, regions: [{ start: 0, end: 0x3fff, type: "disassemble" }], ...bank }
    }
  }) as ProgramAnnotations;

describe("bankContentMix", () => {
  it("counts bytes per region type", () => {
    const mix = bankContentMix([
      { start: 0, end: 0x0fff, type: "disassemble" },
      { start: 0x1000, end: 0x2fff, type: "bytes" },
      { start: 0x3000, end: 0x37ff, type: "words" },
      { start: 0x3800, end: 0x3fff, type: "skip" }
    ]);
    expect(mix).toEqual({
      disassemble: 0x1000,
      bytes: 0x2000,
      words: 0x800,
      copper: 0,
      dma: 0,
      text: 0,
      graphic: 0,
      skip: 0x800
    });
    expect(contentMixPercent(mix, "bytes")).toBe(50);
    expect(contentMixPercent(mix, "words")).toBe(13);
  });

  it("counts Copper and DMA regions, and names them only when present", () => {
    const mix = bankContentMix([
      { start: 0, end: 0x0fff, type: "disassemble" },
      { start: 0x1000, end: 0x10ff, type: "copper" },
      { start: 0x1100, end: 0x3fff, type: "disassemble" }
    ]);
    expect(mix.copper).toBe(0x100);
    expect(formatMixPercent(mix, "copper")).toBe("2%");
    const tiny = bankContentMix([
      { start: 0, end: 13, type: "copper" },
      { start: 14, end: 0x3fff, type: "disassemble" }
    ]);
    expect(formatMixPercent(tiny, "copper")).toBe("<1%");
    expect(formatMixPercent(mix, "dma")).toBe("0%");
    expect(mix.dma).toBe(0);
    expect(mixLegendTypes(mix)).toEqual(["disassemble", "bytes", "words", "copper", "skip"]);
    expect(mixLegendTypes(bankContentMix(undefined))).toEqual([
      "disassemble",
      "bytes",
      "words",
      "skip"
    ]);
  });

  it("is all zero without regions", () => {
    const mix = bankContentMix(undefined);
    expect(contentMixPercent(mix, "disassemble")).toBe(0);
  });
});

describe("bankLabels", () => {
  it("lists local labels at the bank's listing address and global labels inside its window, in order", () => {
    const annotations = model(
      { localLabels: [{ name: "Local", value: 0x10 }] },
      [
        { name: "Inside", value: 0x5c50 },
        { name: "Outside", value: 0x8000 },
        { name: "First", value: 0x4000 }
      ]
    );
    expect(bankLabels(annotations, 5, 0x4000)).toEqual([
      { name: "First", address: 0x4000, scope: "global" },
      { name: "Local", address: 0x4010, scope: "local" },
      { name: "Inside", address: 0x5c50, scope: "global" }
    ]);
  });

  it("uses the listing address for a bank the model does not describe", () => {
    expect(bankLabels(model({}, [{ name: "G", value: 0xc001 }]), 7, 0xc000)).toEqual([
      { name: "G", address: 0xc001, scope: "global" }
    ]);
    expect(bankLabels(undefined, 5, 0x4000)).toEqual([]);
  });
});

describe("isEmptyBank / isAnnotatedBank", () => {
  it("recognises an all-zero bank", () => {
    expect(isEmptyBank(new Uint8Array(0x4000))).toBe(true);
    const bytes = new Uint8Array(0x4000);
    bytes[0x3fff] = 1;
    expect(isEmptyBank(bytes)).toBe(false);
  });

  it("treats defaults as unannotated, and a comment, label or region as annotated", () => {
    expect(isAnnotatedBank(model(), 5)).toBe(false);
    expect(isAnnotatedBank(model(), 6)).toBe(false);
    expect(isAnnotatedBank(undefined, 5)).toBe(false);
    expect(isAnnotatedBank(model({ comment: "x" }), 5)).toBe(true);
    expect(isAnnotatedBank(model({ localLabels: [{ name: "L", value: 0 }] }), 5)).toBe(true);
    expect(
      isAnnotatedBank(
        model({
          regions: [
            { start: 0, end: 0xff, type: "bytes" },
            { start: 0x100, end: 0x3fff, type: "disassemble" }
          ]
        }),
        5
      )
    ).toBe(true);
  });
});
