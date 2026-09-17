import { describe, expect, it } from "vitest";

import type { DisassemblyItem } from "@renderer/appIde/disassemblers/common-types";
import {
  goToDefinitionTarget,
  resolveOperandLabel
} from "@renderer/appIde/DocumentPanels/Next/nexGoToDefinition";
import type {
  NexBankAnnotation,
  NexFileAnnotations
} from "@renderer/appIde/DocumentPanels/Next/nexAnnotations";

/*
 * Following a labelled operand to its definition.
 *
 * The resolution rule is shared with the listing's own operand resolver, which calls this: a menu
 * that sent you to a different label than the one printed on the line would be worse than no menu.
 */

const BASE = 0x8000; // --- bank 2, offsetIndex 2

function annotations(overrides: Partial<NexBankAnnotation> = {}): NexFileAnnotations {
  const bank: NexBankAnnotation = {
    offsetIndex: 2,
    regions: [{ start: 0, end: 0x3fff, type: "disassemble" }],
    localLabels: [{ name: "Loop", value: 0x0100 }],
    ...overrides
  };
  return {
    schemaVersion: 2,
    globalLabels: [
      { name: "InThisBank", value: 0x8200 },
      { name: "InAnotherBank", value: 0xc100 }
    ],
    banks: { "2": bank }
  };
}

/** A row carrying one 16-bit operand the listing resolved to a name. */
function row(operandValue: number, opts: { resolved?: boolean; bankOffset?: number } = {}): DisassemblyItem {
  return {
    address: BASE + 0x0010,
    instruction: "ld hl,X",
    annotation: { bank: 2, bankOffset: opts.bankOffset ?? 0x0010 } as never,
    operandCandidates: [
      {
        instructionAddress: BASE + 0x0010,
        instructionOffset: 0x0010,
        operandIndex: 0,
        operandValue,
        pragma: "defw" as never,
        defaultText: "$0000",
        ...(opts.resolved === false ? {} : { resolvedText: "X" })
      }
    ]
  } as DisassemblyItem;
}

describe("resolveOperandLabel", () => {
  const ann = annotations();
  const bankAnn = ann.banks["2"];

  it("matches a global label by absolute value", () => {
    expect(
      resolveOperandLabel(ann, bankAnn, { bankOffset: 0, operandIndex: 0, operandValue: 0x8200 }, BASE)
    ).toEqual({ name: "InThisBank", scope: "global", value: 0x8200 });
  });

  it("matches a local label by bank-relative value", () => {
    expect(
      resolveOperandLabel(ann, bankAnn, { bankOffset: 0, operandIndex: 0, operandValue: 0x8100 }, BASE)
    ).toEqual({ name: "Loop", scope: "local", value: 0x0100 });
  });

  it("prefers an explicit operand reference over a value match", () => {
    // --- The user pinned this operand to a name; that beats whatever the number happens to equal.
    const withRef = annotations({
      localLabels: [{ name: "Loop", value: 0x0100 }, { name: "Chosen", value: 0x0100 }],
      operandReferences: { "0": [{ operandIndex: 0, scope: "local", name: "Chosen" }] }
    });
    expect(
      resolveOperandLabel(
        withRef,
        withRef.banks["2"],
        { bankOffset: 0, operandIndex: 0, operandValue: 0x8100 },
        BASE
      )
    ).toEqual({ name: "Chosen", scope: "local", value: 0x0100 });
  });

  it("declines a reference whose label no longer matches the operand", () => {
    // --- The label moved. Naming it anyway would print a name for an address it is not at.
    const stale = annotations({
      operandReferences: { "0": [{ operandIndex: 0, scope: "local", name: "Loop" }] }
    });
    expect(
      resolveOperandLabel(
        stale,
        stale.banks["2"],
        { bankOffset: 0, operandIndex: 0, operandValue: 0x8999 },
        BASE
      )
    ).toBeUndefined();
  });

  it("declines an operand that names nothing", () => {
    expect(
      resolveOperandLabel(ann, bankAnn, { bankOffset: 0, operandIndex: 0, operandValue: 0x8999 }, BASE)
    ).toBeUndefined();
  });
});

describe("goToDefinitionTarget", () => {
  const ann = annotations();
  const args = { annotations: ann, bank: 2, addressOffset: BASE };

  it("finds a definition inside the bank on screen", () => {
    expect(goToDefinitionTarget({ ...args, item: row(0x8200) })).toEqual({
      kind: "same-bank",
      label: { name: "InThisBank", scope: "global", value: 0x8200 },
      address: 0x8200
    });
  });

  it("treats a local label as same-bank, since it can only be in this one", () => {
    const target = goToDefinitionTarget({ ...args, item: row(0x8100) });
    expect(target.kind).toBe("same-bank");
    expect(target).toMatchObject({ address: 0x8100 });
  });

  it("finds a definition outside the bank on screen", () => {
    // --- $C100 is beyond this bank's $8000-$BFFF window, so which bank holds it is a paging
    // --- question rather than an arithmetic one.
    expect(goToDefinitionTarget({ ...args, item: row(0xc100) })).toEqual({
      kind: "other-bank",
      label: { name: "InAnotherBank", scope: "global", value: 0xc100 },
      address: 0xc100
    });
  });

  it("ignores an operand the listing printed as a bare number", () => {
    /*
     * `resolvedText` is the only evidence left that a name was substituted — the instruction is a
     * flattened string by this point. Without the check, a line showing `$8200` would still offer a
     * jump, because the *value* happens to match a label.
     */
    expect(goToDefinitionTarget({ ...args, item: row(0x8200, { resolved: false }) })).toEqual({
      kind: "none"
    });
  });

  it("has nothing to offer on a synopsis row", () => {
    const prefix = { ...row(0x8200), isPrefixItem: true } as DisassemblyItem;
    expect(goToDefinitionTarget({ ...args, item: prefix })).toEqual({ kind: "none" });
  });

  it("has nothing to offer without annotations, a bank, or a row", () => {
    expect(goToDefinitionTarget({ ...args, annotations: undefined, item: row(0x8200) })).toEqual({
      kind: "none"
    });
    expect(goToDefinitionTarget({ ...args, bank: undefined, item: row(0x8200) })).toEqual({
      kind: "none"
    });
    expect(goToDefinitionTarget({ ...args, item: undefined })).toEqual({ kind: "none" });
  });
});
