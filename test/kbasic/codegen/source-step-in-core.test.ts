import { describe, expect, it } from "vitest";

import { SourceDebugIndex, type SourceStepKind } from "@emu/machines/SourceStepDecision";
import { wasmDebugLoopOptions } from "@emu/machines/wasmDebugLoop";

import { startBasic } from "./run-kit";

/**
 * Source steps decided from the core's stops equal source steps decided after every instruction
 * (`.plans/WASM_CORE_LEAN_AND_DEBUG_PLAN.md` Phase 4d, T6).
 *
 * The core stops a source step only at statement entries and call-site return addresses
 * (`SourceDebugIndex.trackedAddresses`), where `shouldStopAtSourceStep` decides; elsewhere that function
 * returns at once. The same program is stepped the same way twice - once as the IDE runs it, once
 * instruction by instruction (`wasmDebugLoopOptions.inCore = false`) - and every stop must agree: its kind,
 * statement, PC, SP and T-states.
 */

const PROGRAM = [
  "SUB Show(a AS UByte)", // 1
  "  PRINT a;", // 2
  "END SUB", // 3
  "FUNCTION Twice(n AS UByte) AS UByte", // 4
  "  RETURN n * 2", // 5
  "END FUNCTION", // 6
  "FUNCTION Fact(n AS UInteger) AS UInteger", // 7
  "  IF n < 2 THEN RETURN 1", // 8
  "  n = n * Fact(n - 1)", // 9
  "  RETURN n", // 10
  "END FUNCTION", // 11
  "DIM i, x AS UByte", // 12
  "DIM r AS UInteger", // 13
  "FOR i = 1 TO 3", // 14
  "  x = Twice(i) : Show x", // 15
  "NEXT i", // 16
  "r = Fact(4)", // 17
  "Show 9", // 18
  ""
].join("\n");

const SCRIPT: SourceStepKind[] = [
  "into", "into", "over", "into", "into", "out", "over", "overLine", "over", "into",
  "into", "into", "out", "over", "into", "into", "into", "into", "out", "out", "over", "over"
];

type Stop = { kind: string; stoppedAt?: string; statement?: number; pc: number; sp: number; tacts: number };

async function stepThrough(inCore: boolean): Promise<Stop[]> {
  const { session, generated, done } = await startBasic(PROGRAM);
  const index = new SourceDebugIndex(generated.debug.sourceLevel);
  session.attachDebugSupport();
  const out: Stop[] = [];
  wasmDebugLoopOptions.inCore = inCore;
  try {
    for (const kind of SCRIPT) {
      const st = session.sourceStep(index, kind, { returnTo: done });
      if (!st) break;
      const m = session.machine;
      out.push({ kind, stoppedAt: st.stoppedAt, statement: st.stopStatement, pc: m.pc, sp: m.sp, tacts: m.tacts });
    }
  } finally {
    wasmDebugLoopOptions.inCore = true;
  }
  return out;
}

describe("source steps: in the core = instruction by instruction", () => {
  it("steps into, over, a line and out of SUBs, FUNCTIONs, recursion and a loop alike", async () => {
    const inCore = await stepThrough(true);
    const perInstruction = await stepThrough(false);
    expect(inCore).toEqual(perInstruction);
    // --- The script really stepped: many stops, both kinds
    expect(inCore.length).toBeGreaterThan(10);
    expect(new Set(inCore.map((s) => s.stoppedAt))).toEqual(new Set(["statement", "returnPoint"]));
  });
});
