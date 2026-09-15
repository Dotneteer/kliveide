import { describe, it, expect } from "vitest";

import type { NexFileAnnotations } from "@renderer/appIde/DocumentPanels/Next/nexAnnotations";
import { promoteLabelAt } from "@renderer/appIde/DocumentPanels/Next/nexLabelPromotion";

/*
 * Turning a discovery into an annotation.
 *
 * The loop has been one-way: labels written in the NEX viewer flow out into its listing and into the
 * live disassembly, but the moment you work out what a routine *is* you are paused in the debugger.
 * This puts the name in from there. Always a **local** label, because the address is only meaningful
 * as "offset X in bank B" — the same routine is elsewhere the next time its bank is paged.
 *
 * See `.plans/NEX_DEBUGGING_PLAN.md` §13.3.
 */

function annotations(over: Partial<NexFileAnnotations> = {}): NexFileAnnotations {
  return {
    schemaVersion: 2,
    globalLabels: [{ name: "Entry", value: 0x8000 }],
    banks: {
      "5": {
        offsetIndex: 3,
        regions: [{ start: 0, end: 0x3fff, type: "disassemble" }],
        localLabels: [{ name: "Existing", value: 0x0010 }]
      }
    },
    ...over
  } as NexFileAnnotations;
}

const localLabelsOf = (result: NexFileAnnotations, bank: number) =>
  result.banks[String(bank)]?.localLabels;

describe("promoteLabelAt", () => {
  it("adds a local label at the offset", () => {
    const result = promoteLabelAt(annotations(), { bank: 5, bankOffset: 0x0100 }, "DrawSprite");
    expect(result.ok).toEqual(true);
    expect(localLabelsOf(result.annotations!, 5)).toEqual([
      { name: "Existing", value: 0x0010 },
      { name: "DrawSprite", value: 0x0100 }
    ]);
  });

  it("never adds a global label", () => {
    // --- The address means "offset X in bank B"; a global label would claim it means one place in
    // --- the address space, which it does not.
    const result = promoteLabelAt(annotations(), { bank: 5, bankOffset: 0x0100 }, "DrawSprite");
    expect(result.annotations!.globalLabels).toEqual([{ name: "Entry", value: 0x8000 }]);
  });

  it("does not change the annotations it was given", () => {
    const original = annotations();
    promoteLabelAt(original, { bank: 5, bankOffset: 0x0100 }, "DrawSprite");
    expect(localLabelsOf(original, 5)).toEqual([{ name: "Existing", value: 0x0010 }]);
  });

  it("trims the name", () => {
    const result = promoteLabelAt(annotations(), { bank: 5, bankOffset: 0x0100 }, "  Draw  ");
    expect(localLabelsOf(result.annotations!, 5)!.at(-1)).toEqual({ name: "Draw", value: 0x0100 });
  });

  it("creates the bank entry when the sidecar does not describe that bank", () => {
    /*
     * A sidecar describes every bank the file had when it was created, so this is a bank added
     * afterwards — or a hand-written sidecar. `withLabelChange` declines for a bank it cannot find,
     * and losing the label would be the worst of the three options.
     */
    const result = promoteLabelAt(annotations(), { bank: 6, bankOffset: 0x0200 }, "NewBank");
    expect(result.ok).toEqual(true);
    expect(localLabelsOf(result.annotations!, 6)).toEqual([{ name: "NewBank", value: 0x0200 }]);
    // --- With the same default a new sidecar would have given it: the whole bank, disassembled.
    expect(result.annotations!.banks["6"].regions).toEqual([
      { start: 0, end: 0x3fff, type: "disassemble" }
    ]);
  });

  it("refuses a name the bank already uses", () => {
    // --- A name means one place. Silently moving the existing label would lose what it pointed at.
    const result = promoteLabelAt(annotations(), { bank: 5, bankOffset: 0x0100 }, "Existing");
    expect(result.ok).toEqual(false);
    expect(result.error).toContain("already has a label named Existing");
  });

  it("allows the same name in a different bank", () => {
    // --- Local labels are scoped to their bank; two banks may each have a `Draw`.
    const result = promoteLabelAt(annotations(), { bank: 6, bankOffset: 0 }, "Existing");
    expect(result.ok).toEqual(true);
  });

  it("allows a second name for an offset, and says so", () => {
    /*
     * Unusual but permitted by the model, and a routine with both a technical and a descriptive
     * name is a real thing. Reported so the user is not surprised by two names on one line.
     */
    const result = promoteLabelAt(annotations(), { bank: 5, bankOffset: 0x0010 }, "AlsoThis");
    expect(result.ok).toEqual(true);
    expect(result.replaced).toEqual("Existing");
  });

  it("refuses a name that is not an identifier", () => {
    for (const bad of ["", "   ", "1Draw", "Draw Sprite", "Draw-Sprite", "a".repeat(17)]) {
      const result = promoteLabelAt(annotations(), { bank: 5, bankOffset: 0x0100 }, bad);
      expect(result.ok, bad).toEqual(false);
      expect(result.error, bad).toContain("identifier name");
    }
  });

  it("accepts a 16-character name, the longest allowed", () => {
    const result = promoteLabelAt(annotations(), { bank: 5, bankOffset: 0 }, "a".repeat(16));
    expect(result.ok).toEqual(true);
  });

  it("refuses an offset outside a bank", () => {
    expect(promoteLabelAt(annotations(), { bank: 5, bankOffset: 0x4000 }, "X").ok).toEqual(false);
    expect(promoteLabelAt(annotations(), { bank: 5, bankOffset: -1 }, "X").ok).toEqual(false);
  });

  it("refuses a bank outside the format's range", () => {
    expect(promoteLabelAt(annotations(), { bank: 112, bankOffset: 0 }, "X").ok).toEqual(false);
    expect(promoteLabelAt(annotations(), { bank: -1, bankOffset: 0 }, "X").ok).toEqual(false);
  });

  it("accepts bank 0 at offset 0, which is every falsy value at once", () => {
    const result = promoteLabelAt(annotations(), { bank: 0, bankOffset: 0 }, "Top");
    expect(result.ok).toEqual(true);
    expect(localLabelsOf(result.annotations!, 0)).toEqual([{ name: "Top", value: 0 }]);
  });

  it("refuses when there are no annotations at all", () => {
    const result = promoteLabelAt(undefined, { bank: 5, bankOffset: 0 }, "X");
    expect(result.ok).toEqual(false);
    expect(result.error).toContain("no annotations");
  });
});
