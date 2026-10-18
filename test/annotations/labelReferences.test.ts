import { describe, expect, it } from "vitest";
import type { DisassemblyItem } from "@renderer/appIde/disassemblers/common-types";
import type { ProgramAnnotations } from "@renderer/appIde/annotations/programAnnotations";
import {
  countLabelReferencesInListing,
  findLabelReferences,
  labelKey,
  referenceSubjectsOf
} from "@renderer/appIde/annotations/labelReferences";
import { listLabelsForBank } from "@renderer/appIde/annotations/annotationEdits";
import { createAnnotatedDisassemblyItems } from "@renderer/appIde/annotations/annotatedDisassembly";

// --- Bank 0 listed at $0000. Code: call Sub ; jp Sub ; ld hl,$0020 (Table, by value) ; then the
// --- table of words at $0020: Sub, Other, Sub
const bytes = () => {
  const contents = new Uint8Array(0x4000);
  contents.set([0xcd, 0x10, 0x00, 0xc3, 0x10, 0x00, 0x21, 0x20, 0x00], 0);
  contents.set([0xc9], 0x10); // Sub: ret
  contents.set([0xc9], 0x11); // Other: ret
  contents.set([0x10, 0x00, 0x11, 0x00, 0x10, 0x00], 0x20);
  return contents;
};

const annotations = (extra: Partial<ProgramAnnotations["banks"][string]> = {}): ProgramAnnotations => ({
  schemaVersion: 1,
  banks: {
    "0": {
      offsetIndex: 0,
      regions: [
        { start: 0, end: 0x1f, type: "disassemble" },
        { start: 0x20, end: 0x25, type: "words" },
        { start: 0x26, end: 0x3fff, type: "skip" }
      ],
      localLabels: [
        { name: "Start", value: 0 },
        { name: "Sub", value: 0x10 },
        { name: "Other", value: 0x11 },
        { name: "Table", value: 0x20 }
      ],
      ...extra
    }
  }
});

const listing = (model: ProgramAnnotations) =>
  createAnnotatedDisassemblyItems({ annotations: model, bank: 0, contents: bytes(), disassOffset: 0 }).then(
    (items) => items ?? []
  );

const sub = { name: "Sub", scope: "local" as const, value: 0x10 };

describe("findLabelReferences", () => {
  it("finds every row whose operand names the label, .defw words included", async () => {
    const model = annotations();
    const items = await listing(model);
    const found = findLabelReferences(model, 0, items, sub, 0);
    expect(found.map((reference) => [reference.address, reference.instruction, reference.within])).toEqual([
      [0x0000, "call Sub", "Start"],
      [0x0003, "jp Sub", "Start"],
      // --- One entry for the row, though two of its words name the label
      [0x0020, ".defw Sub, Other", "Table"],
      [0x0024, ".defw Sub", "Table"]
    ]);
  });

  it("gives each found row's index in the listing it searched", async () => {
    const model = annotations();
    const items = await listing(model);
    for (const reference of findLabelReferences(model, 0, items, sub, 0)) {
      expect(items[reference.rowIndex].address).toEqual(reference.address);
    }
  });

  it("follows an explicit operand reference over a value match", async () => {
    // --- The `call` at offset 0 is pointed at `Other` by hand, though its value is Sub's
    const model = annotations({
      localLabels: [
        { name: "Start", value: 0 },
        { name: "Sub", value: 0x10 },
        { name: "Other", value: 0x10 },
        { name: "Table", value: 0x20 }
      ],
      operandReferences: { "0": [{ operandIndex: 0, name: "Other", scope: "local" }] }
    });
    const items = await listing(model);
    expect(findLabelReferences(model, 0, items, sub, 0).map((reference) => reference.address)).not.toContain(0);
    expect(
      findLabelReferences(model, 0, items, { name: "Other", scope: "local", value: 0x10 }, 0).map(
        (reference) => reference.address
      )
    ).toContain(0);
  });

  it("does not count a label's own definition as a reference", async () => {
    const model = annotations();
    const items = await listing(model);
    expect(findLabelReferences(model, 0, items, sub, 0).map((reference) => reference.address)).not.toContain(0x10);
  });

  it("finds nothing without annotations or the bank", async () => {
    const model = annotations();
    const items = await listing(model);
    expect(findLabelReferences(undefined, 0, items, sub, 0)).toEqual([]);
    expect(findLabelReferences(model, 7, items, sub, 0)).toEqual([]);
  });
});

describe("referenceSubjectsOf", () => {
  it("offers the row's own label, then each label its operands name, each once", async () => {
    // --- `Start: call Sub` at offset 0
    const model = annotations();
    const items = await listing(model);
    const row = items.find((item) => item.address === 0 && !item.isPrefixItem);
    expect(referenceSubjectsOf(model, 0, row, 0).map((subject) => [subject.label.name, subject.source])).toEqual([
      ["Start", "row"],
      ["Sub", { operandIndex: 0 }]
    ]);
  });

  it("offers, on a .defw row, its own label and each label its words name", async () => {
    // --- `Table: .defw Sub, Other`
    const model = annotations();
    const items = await listing(model);
    const row = items.find((item) => item.address === 0x20 && !item.isPrefixItem);
    expect(referenceSubjectsOf(model, 0, row, 0).map((subject) => [subject.label.name, subject.source])).toEqual([
      ["Table", "row"],
      ["Sub", { operandIndex: 0 }],
      ["Other", { operandIndex: 1 }]
    ]);
  });

  it("offers nothing for a generated prefix row or a row without a bank offset", () => {
    const model = annotations();
    expect(referenceSubjectsOf(model, 0, { address: 0, isPrefixItem: true } as DisassemblyItem, 0)).toEqual([]);
    expect(referenceSubjectsOf(model, 0, { address: 0, instruction: "nop" } as DisassemblyItem, 0)).toEqual([]);
  });
});

describe("countLabelReferencesInListing", () => {
  it("counts, for every label at once, the rows Go to References lists for it", async () => {
    const model = annotations();
    const items = await listing(model);
    const counts = countLabelReferencesInListing(model, 0, items, 0);
    for (const label of model.banks["0"].localLabels!) {
      const subject = { name: label.name, scope: "local" as const, value: label.value };
      expect(counts.get(labelKey(subject)) ?? 0, label.name).toEqual(
        findLabelReferences(model, 0, items, subject, 0).length
      );
    }
    expect(counts.get("local:Sub")).toEqual(4);
    expect(counts.get("local:Other")).toEqual(1);
  });
});

describe("listLabelsForBank with a listing", () => {
  it("counts the listed rows that name each label, and keeps the hand-made references apart", async () => {
    // --- `Start` is pointed at by hand from the `jp` (offset 3), whose value is Sub's: a reference
    // --- that no longer matches its operand names nothing (`resolveOperandLabel`), so the `jp`
    // --- shows a number. It still counts as hand-made: deleting Start would clear it.
    const model = annotations({ operandReferences: { "3": [{ operandIndex: 0, name: "Start", scope: "local" }] } });
    const items = await listing(model);
    const byName = Object.fromEntries(
      listLabelsForBank(model, 0, { items, addressOffset: 0 }).map((label) => [
        label.name,
        [label.referenceCount, label.operandReferenceCount, label.referenced]
      ])
    );
    expect(byName).toEqual({
      Start: [0, 1, true],
      // --- The `jp` no longer names Sub: the call and the two .defw rows do
      Sub: [3, 0, true],
      Other: [1, 0, true],
      // --- `ld hl,$0020` holds Table's value, so the listing prints it as Table
      Table: [1, 0, true]
    });
  });

  it("counts the hand-made references alone without a listing", () => {
    const model = annotations({ operandReferences: { "3": [{ operandIndex: 0, name: "Start", scope: "local" }] } });
    const start = listLabelsForBank(model, 0).find((label) => label.name === "Start");
    expect(start).toMatchObject({ referenceCount: 1, operandReferenceCount: 1 });
  });
});
