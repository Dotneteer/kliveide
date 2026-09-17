import { describe, it, expect } from "vitest";
import type {
  NexAnnotationRegion,
  NexBankAnnotation,
  NexFileAnnotations
} from "@renderer/appIde/DocumentPanels/Next/nexAnnotations";
import {
  addLabelIfMissing,
  flattenBankComment,
  resolveBankSprites,
  withBankSprites,
  withBankComment,
  countLabelReferences,
  getAlternativeRegionType,
  getRegionTypeForSpan,
  mergeAnnotationRegions,
  removeLabel,
  removeLabelOperandReferences,
  removeLabelOperandReferencesFromBanks,
  replaceAnnotationRegion
} from "@renderer/appIde/DocumentPanels/Next/nexAnnotationEdits";

/*
 * These rules lived inside a 2168-line memory-dump component, where the only way to reach them was
 * to mount React and drive the DOM — even though none of them touches it. They are tested here
 * directly for the first time.
 */

function bank(over: Partial<NexBankAnnotation> = {}): NexBankAnnotation {
  return {
    offsetIndex: 0,
    regions: [{ start: 0, end: 0x3fff, type: "disassemble" }],
    ...over
  };
}

function annotations(banks: Record<string, NexBankAnnotation>): NexFileAnnotations {
  return { schemaVersion: 1, banks };
}

describe("mergeAnnotationRegions", () => {
  it("sorts, then joins touching regions of the same type", () => {
    const merged = mergeAnnotationRegions([
      { start: 0x20, end: 0x2f, type: "bytes" },
      { start: 0x00, end: 0x1f, type: "bytes" }
    ]);
    expect(merged).toEqual([{ start: 0x00, end: 0x2f, type: "bytes" }]);
  });

  it("keeps touching bytes regions with different row sizes apart", () => {
    const regions: NexAnnotationRegion[] = [
      { start: 0x00, end: 0x1f, type: "bytes" },
      { start: 0x20, end: 0x2f, type: "bytes", rowBytes: 2 }
    ];
    expect(mergeAnnotationRegions(regions)).toEqual(regions);
    expect(
      mergeAnnotationRegions([
        { start: 0x00, end: 0x1f, type: "bytes", rowBytes: 2 },
        { start: 0x20, end: 0x2f, type: "bytes", rowBytes: 2 }
      ])
    ).toEqual([{ start: 0x00, end: 0x2f, type: "bytes", rowBytes: 2 }]);
  });

  it("keeps neighbours of different types apart", () => {
    const regions: NexAnnotationRegion[] = [
      { start: 0x00, end: 0x1f, type: "bytes" },
      { start: 0x20, end: 0x2f, type: "words" }
    ];
    expect(mergeAnnotationRegions(regions)).toEqual(regions);
  });

  it("leaves a gap between same-type regions that do not touch", () => {
    const regions: NexAnnotationRegion[] = [
      { start: 0x00, end: 0x0f, type: "bytes" },
      { start: 0x20, end: 0x2f, type: "bytes" }
    ];
    expect(mergeAnnotationRegions(regions)).toEqual(regions);
  });

  it("absorbs a region wholly inside its predecessor", () => {
    const merged = mergeAnnotationRegions([
      { start: 0x00, end: 0xff, type: "bytes" },
      { start: 0x10, end: 0x1f, type: "bytes" }
    ]);
    expect(merged).toEqual([{ start: 0x00, end: 0xff, type: "bytes" }]);
  });

  it("does not mutate the regions it is given", () => {
    const original: NexAnnotationRegion[] = [{ start: 0x00, end: 0x0f, type: "bytes" }];
    mergeAnnotationRegions([...original, { start: 0x10, end: 0x1f, type: "bytes" }]);
    expect(original).toEqual([{ start: 0x00, end: 0x0f, type: "bytes" }]);
  });
});

describe("replaceAnnotationRegion", () => {
  const whole: NexAnnotationRegion[] = [{ start: 0, end: 0x3fff, type: "disassemble" }];

  it("splits a covering region in three when the span is inside it", () => {
    expect(replaceAnnotationRegion(whole, 0x100, 0x1ff, "bytes")).toEqual([
      { start: 0x0000, end: 0x00ff, type: "disassemble" },
      { start: 0x0100, end: 0x01ff, type: "bytes" },
      { start: 0x0200, end: 0x3fff, type: "disassemble" }
    ]);
  });

  it("keeps the row size of the parts left either side", () => {
    const copper: NexAnnotationRegion[] = [{ start: 0, end: 0x3fff, type: "bytes", rowBytes: 2 }];
    expect(replaceAnnotationRegion(copper, 0x100, 0x1ff, "disassemble")).toEqual([
      { start: 0x0000, end: 0x00ff, type: "bytes", rowBytes: 2 },
      { start: 0x0100, end: 0x01ff, type: "disassemble" },
      { start: 0x0200, end: 0x3fff, type: "bytes", rowBytes: 2 }
    ]);
  });

  it("replaces the whole bank when the span covers it", () => {
    expect(replaceAnnotationRegion(whole, 0, 0x3fff, "skip")).toEqual([
      { start: 0, end: 0x3fff, type: "skip" }
    ]);
  });

  it("leaves untouched regions alone", () => {
    const regions: NexAnnotationRegion[] = [
      { start: 0x0000, end: 0x00ff, type: "words" },
      { start: 0x0100, end: 0x3fff, type: "disassemble" }
    ];
    expect(replaceAnnotationRegion(regions, 0x200, 0x2ff, "bytes")).toEqual([
      { start: 0x0000, end: 0x00ff, type: "words" },
      { start: 0x0100, end: 0x01ff, type: "disassemble" },
      { start: 0x0200, end: 0x02ff, type: "bytes" },
      { start: 0x0300, end: 0x3fff, type: "disassemble" }
    ]);
  });

  it("merges into an adjacent region of the same type rather than leaving a seam", () => {
    const regions: NexAnnotationRegion[] = [
      { start: 0x0000, end: 0x00ff, type: "bytes" },
      { start: 0x0100, end: 0x3fff, type: "disassemble" }
    ];
    expect(replaceAnnotationRegion(regions, 0x100, 0x1ff, "bytes")).toEqual([
      { start: 0x0000, end: 0x01ff, type: "bytes" },
      { start: 0x0200, end: 0x3fff, type: "disassemble" }
    ]);
  });

  it("keeps full coverage of the bank", () => {
    // --- The viewer relies on regions covering $0000..$3FFF with no holes.
    const result = replaceAnnotationRegion(whole, 0x1000, 0x1fff, "words");
    expect(result[0].start).toEqual(0);
    expect(result[result.length - 1].end).toEqual(0x3fff);
    for (let i = 1; i < result.length; i++) {
      expect(result[i].start).toEqual(result[i - 1].end + 1);
    }
  });
});

describe("getRegionTypeForSpan", () => {
  const regions: NexAnnotationRegion[] = [
    { start: 0x0000, end: 0x00ff, type: "bytes" },
    { start: 0x0100, end: 0x01ff, type: "words" },
    { start: 0x0200, end: 0x3fff, type: "disassemble" }
  ];

  it("reports the type when the span sits in one region", () => {
    expect(getRegionTypeForSpan(regions, 0x10, 0x20)).toEqual("bytes");
    expect(getRegionTypeForSpan(regions, 0x100, 0x1ff)).toEqual("words");
  });

  it("falls back to `disassemble` when the span straddles differing types", () => {
    expect(getRegionTypeForSpan(regions, 0x00ff, 0x0100)).toEqual("disassemble");
  });

  it("falls back to `disassemble` when nothing intersects", () => {
    expect(getRegionTypeForSpan([], 0x10, 0x20)).toEqual("disassemble");
  });
});

describe("getAlternativeRegionType", () => {
  it("toggles between disassembly and bytes", () => {
    expect(getAlternativeRegionType("disassemble")).toEqual("bytes");
    expect(getAlternativeRegionType("bytes")).toEqual("disassemble");
    // --- Anything else offers disassembly as the way back.
    expect(getAlternativeRegionType("words")).toEqual("disassemble");
    expect(getAlternativeRegionType("skip")).toEqual("disassemble");
  });
});

describe("label bookkeeping", () => {
  it("adds a label only when its name is new", () => {
    const labels = [{ name: "Start", value: 0x100 }];
    expect(addLabelIfMissing(labels, { name: "Loop", value: 0x200 })).toEqual([
      { name: "Start", value: 0x100 },
      { name: "Loop", value: 0x200 }
    ]);
    // --- Same name at a different value is still a duplicate name, so it is not added.
    expect(addLabelIfMissing(labels, { name: "Start", value: 0x999 })).toBe(labels);
  });

  it("removes a label by name and value together", () => {
    const labels = [
      { name: "Start", value: 0x100 },
      { name: "Start", value: 0x200 }
    ];
    expect(removeLabel(labels, { name: "Start", value: 0x100 })).toEqual([
      { name: "Start", value: 0x200 }
    ]);
  });
});

describe("countLabelReferences", () => {
  const withRefs = annotations({
    "5": bank({
      operandReferences: {
        "16": [{ operandIndex: 0, scope: "local", name: "Loop" }],
        "32": [
          { operandIndex: 0, scope: "global", name: "Start" },
          { operandIndex: 1, scope: "local", name: "Loop" }
        ]
      }
    }),
    "6": bank({
      operandReferences: {
        "48": [{ operandIndex: 0, scope: "global", name: "Start" }]
      }
    })
  });

  it("counts a global label across every bank", () => {
    expect(countLabelReferences(withRefs, 5, "global", "Start")).toEqual(2);
  });

  it("counts a local label only within its own bank", () => {
    expect(countLabelReferences(withRefs, 5, "local", "Loop")).toEqual(2);
    expect(countLabelReferences(withRefs, 6, "local", "Loop")).toEqual(0);
  });

  it("reports zero for an unreferenced name", () => {
    expect(countLabelReferences(withRefs, 5, "global", "Nowhere")).toEqual(0);
  });

  it("copes with a bank that has no references at all", () => {
    expect(countLabelReferences(annotations({ "5": bank() }), 5, "local", "Loop")).toEqual(0);
  });
});

describe("removing a label's operand references", () => {
  it("drops the references and the offset entry once it is empty", () => {
    const source = bank({
      operandReferences: {
        "16": [{ operandIndex: 0, scope: "local", name: "Loop" }],
        "32": [
          { operandIndex: 0, scope: "local", name: "Loop" },
          { operandIndex: 1, scope: "global", name: "Start" }
        ]
      }
    });

    const result = removeLabelOperandReferences(source, "local", "Loop");

    expect(result.operandReferences).toEqual({
      "32": [{ operandIndex: 1, scope: "global", name: "Start" }]
    });
  });

  it("removes the whole map when nothing is left", () => {
    const source = bank({
      operandReferences: { "16": [{ operandIndex: 0, scope: "local", name: "Loop" }] }
    });
    expect("operandReferences" in removeLabelOperandReferences(source, "local", "Loop")).toEqual(
      false
    );
  });

  it("returns the bank untouched when it has no references", () => {
    const source = bank();
    expect(removeLabelOperandReferences(source, "local", "Loop")).toBe(source);
  });

  it("touches only the named bank for a local label", () => {
    const banks = {
      "5": bank({
        operandReferences: { "16": [{ operandIndex: 0, scope: "local", name: "Loop" }] }
      }),
      "6": bank({
        operandReferences: { "16": [{ operandIndex: 0, scope: "local", name: "Loop" }] }
      })
    };

    const result = removeLabelOperandReferencesFromBanks(banks, 5, "local", "Loop");

    expect(result["5"].operandReferences).toEqual(undefined);
    // --- Bank 6's `Loop` is a different label: local labels are scoped to their bank.
    expect(result["6"]).toBe(banks["6"]);
  });

  it("touches every bank for a global label", () => {
    const banks = {
      "5": bank({
        operandReferences: { "16": [{ operandIndex: 0, scope: "global", name: "Start" }] }
      }),
      "6": bank({
        operandReferences: { "32": [{ operandIndex: 0, scope: "global", name: "Start" }] }
      })
    };

    const result = removeLabelOperandReferencesFromBanks(banks, 5, "global", "Start");

    expect(result["5"].operandReferences).toEqual(undefined);
    expect(result["6"].operandReferences).toEqual(undefined);
  });
});

describe("withBankComment", () => {
  it("sets a comment, normalized", () => {
    const result = withBankComment(annotations({ "5": bank() }), 5, "Music  \r\nIM2\t");
    expect(result?.banks["5"].comment).toBe("Music\nIM2");
  });

  it("replaces an existing comment and leaves other banks alone", () => {
    const other = bank({ comment: "Other" });
    const model = annotations({ "5": bank({ comment: "Old" }), "6": other });
    const result = withBankComment(model, 5, "New");
    expect(result?.banks["5"].comment).toBe("New");
    expect(result?.banks["6"]).toBe(other);
  });

  it("removes the key when cleared or emptied", () => {
    const model = annotations({ "5": bank({ comment: "Old" }) });
    expect(withBankComment(model, 5, undefined)?.banks["5"]).not.toHaveProperty("comment");
    expect(withBankComment(model, 5, "  \n ")?.banks["5"]).not.toHaveProperty("comment");
  });

  it("reports no change for an equal comment or a clear of nothing", () => {
    expect(withBankComment(annotations({ "5": bank({ comment: "Same" }) }), 5, "Same  ")).toBe(
      undefined
    );
    expect(withBankComment(annotations({ "5": bank() }), 5, undefined)).toBe(undefined);
  });

  it("reports no change for a bank the model does not describe", () => {
    expect(withBankComment(annotations({ "5": bank() }), 7, "Nope")).toBe(undefined);
  });

  it("does not mutate the model it was given", () => {
    const model = annotations({ "5": bank() });
    withBankComment(model, 5, "Note");
    expect(model.banks["5"]).not.toHaveProperty("comment");
  });
});

describe("flattenBankComment", () => {
  it("joins lines with a middle dot, dropping blank lines", () => {
    expect(flattenBankComment("Music player\n\n  Called  from IsrMain \r\nEnd")).toBe(
      "Music player \u00b7 Called from IsrMain \u00b7 End"
    );
  });

  it("leaves a single line as it is", () => {
    expect(flattenBankComment("Palette ramps")).toBe("Palette ramps");
  });

  it("is empty for no comment", () => {
    expect(flattenBankComment(undefined)).toBe("");
    expect(flattenBankComment("\n  \n")).toBe("");
  });
});

describe("withBankSprites", () => {
  it("stores only what differs from 8-bit at offset 0", () => {
    const result = withBankSprites(annotations({ "5": bank() }), 5, { offset: 3 });
    expect(result?.banks["5"].sprites).toEqual({ offset: 3 });
    expect(withBankSprites(result!, 5, { format: "4bit" })?.banks["5"].sprites).toEqual({
      format: "4bit",
      offset: 3
    });
  });

  it("removes the block when it returns to the defaults", () => {
    const model = annotations({ "5": bank({ sprites: { format: "4bit", offset: 3 } }) });
    const result = withBankSprites(model, 5, { format: "8bit", offset: 0 });
    expect(result?.banks["5"]).not.toHaveProperty("sprites");
  });

  it("reports no change for equal settings or a missing bank", () => {
    const model = annotations({ "5": bank({ sprites: { offset: 3 } }) });
    expect(withBankSprites(model, 5, { offset: 3, format: "8bit" })).toBe(undefined);
    expect(withBankSprites(annotations({ "5": bank() }), 5, {})).toBe(undefined);
    expect(withBankSprites(model, 6, { offset: 1 })).toBe(undefined);
  });

  it("clamps the offset into the bank", () => {
    expect(withBankSprites(annotations({ "5": bank() }), 5, { offset: 0x5000 })?.banks["5"].sprites)
      .toEqual({ offset: 0x3fff });
  });

  it("resolves an absent block to the defaults", () => {
    expect(resolveBankSprites(undefined)).toEqual({ format: "8bit", offset: 0, active: false });
    expect(resolveBankSprites({ format: "4bit" })).toEqual({ format: "4bit", offset: 0, active: false });
  });

  it("records the Sprites view as active, and drops the flag when it is not", () => {
    const shown = withBankSprites(annotations({ "5": bank() }), 5, { active: true });
    expect(shown?.banks["5"].sprites).toEqual({ active: true });
    expect(withBankSprites(shown!, 5, { active: true })).toBe(undefined);
    expect(withBankSprites(shown!, 5, { active: false })?.banks["5"]).not.toHaveProperty("sprites");
  });
});
