import { describe, expect, it } from "vitest";
import {
  derivePartitionWidthCh,
  isWidePartitionLabel
} from "@renderer/controls/data/partitionWidth";

/**
 * The bank-label column is sized once for a whole list, not per row.
 *
 * Sizing it per row left both the disassembly and the memory dump ragged: a bank with no label
 * dropped the cell entirely — which shifts every column after it, so addresses and hex bytes stop
 * lining up between rows — and a decimal view could mix a 2ch hex label with a 3ch decimal one.
 */
describe("isWidePartitionLabel", () => {
  it("widens only a label a decimal view can actually rewrite", () => {
    // --- "0A" parses as hex, so `toDecimal3` turns it into a 3-character "010".
    expect(isWidePartitionLabel("0A", true, true)).toBe(true);
    // --- A ROM label does not parse, keeps its raw 2 characters, and must not widen the column.
    expect(isWidePartitionLabel("R0", true, true)).toBe(false);
    // --- Hex view never widens, whatever the label.
    expect(isWidePartitionLabel("0A", false, true)).toBe(false);
    // --- Nor does a machine without banks, or a row with no label at all.
    expect(isWidePartitionLabel("0A", true, false)).toBe(false);
    expect(isWidePartitionLabel("", true, true)).toBe(false);
    expect(isWidePartitionLabel(undefined, true, true)).toBe(false);
  });
});

describe("derivePartitionWidthCh", () => {
  // --- A full 64K view: each row's label comes from its own 8K bank, so three of these eight
  // --- rows would have measured 0 and one 2ch, back when each sized itself.
  const fullView = { candidateLabels: ["", "", "", "0A"], decimalView: false, enabled: true };

  it("sizes the column to the widest label any row can show, not to one row's", () => {
    expect(derivePartitionWidthCh(fullView)).toBe(2);
    // --- 3 for *every* row, including the unlabelled ones that would have measured 2.
    expect(derivePartitionWidthCh({ ...fullView, decimalView: true })).toBe(3);
  });

  it("takes the widest when one bank widens and another does not", () => {
    // --- The mixed list that used to render 2ch and 3ch cells in the same view.
    expect(
      derivePartitionWidthCh({
        candidateLabels: ["R0", "", "", "0A"],
        decimalView: true,
        enabled: true
      })
    ).toBe(3);
  });

  it("stays at 2ch when no label in the list can widen", () => {
    expect(
      derivePartitionWidthCh({ candidateLabels: ["R0", "R1"], decimalView: true, enabled: true })
    ).toBe(2);
  });

  it("yields no column at all when there is nothing to label", () => {
    // --- Each of these must cost nothing, so a listing without banks renders as it always did:
    // --- 0 means the caller omits the cell, not that it draws a zero-width one.
    expect(derivePartitionWidthCh({ ...fullView, enabled: false })).toBe(0);
    expect(derivePartitionWidthCh({ ...fullView, candidateLabels: ["", "", "", ""] })).toBe(0);
    expect(derivePartitionWidthCh({ ...fullView, candidateLabels: [] })).toBe(0);
    // --- Outside a full view every row shows the current segment's single label.
    expect(derivePartitionWidthCh({ ...fullView, candidateLabels: [undefined] })).toBe(0);
  });
});
