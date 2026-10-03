import { describe, expect, it } from "vitest";

import type { KliveCompilerOutput } from "@abstractions/CompilerInfo";

import { checkSourceAnnotations } from "@common/utils/source-annotations";
import { buildLogpoints } from "@common/utils/breakpoints";
import { integerSymbolsOf } from "@common/utils/breakpoint-condition/integer-symbols";

import { createSp48Session } from "../harness/sp48";

/*
 * DeZog `ASSERTION` and `WPMEM` comments on the real 48K core
 * (`.plans/ASSERTIONS_WATCHPOINTS_ONE_SHOT_PLAN.md` Phase 4): a Klive assembler program is checked
 * and installed the way the IDE does after a build, then run. An assertion stops when its
 * expression is false, with the values it read; a WPMEM watchpoint catches a write inside its range
 * and not one past it; LOGPOINT, ASSERTION and WPMEM breakpoints live in the one annotation set.
 */

async function session(source: string, options: { switches?: { assertion?: boolean; wpmem?: boolean } } = {}) {
  const s = await createSp48Session();
  const program = await s.loadCode(source);
  const output = checkSourceAnnotations(program.output as unknown as KliveCompilerOutput);
  expect(output.errors.filter((e) => e.isWarning)).toEqual([]);
  const ds = s.attachDebugSupport();
  ds.setConditionSymbols(integerSymbolsOf((output as { symbols?: Record<string, unknown> }).symbols));
  ds.resetBreakpointsTo(buildLogpoints(output, undefined, "sp48", options), { kind: "annotation" });
  ds.addBreakpoint({ address: program.symbol("Done"), exec: true });
  return { s, program, ds };
}

describe("ASSERTION comments - ZX Spectrum 48K", () => {
  const LOOP = `
      .org $8000
  Main:
      ld b,5
      ld a,0
  Loop:
      inc a
      ; ASSERTION a < 4 ; the counter stays small
      djnz Loop
  Done:
      jr Done
  `;

  it("stops when the expression turns false, and reports the values it read", async () => {
    const { s, program, ds } = await session(LOOP);
    const stop = s.callToBreakpoint("Main");
    // --- On its own line: checked before the next instruction (DJNZ), once A has reached 4
    expect(stop).toBe(program.symbol("Loop") + 1);
    expect(s.machine.a).toBe(4);
    ds.consumeFiredOneShots();
    expect(ds.lastStopBreakpoints.map((bp) => bp.annotationKind)).toEqual(["ASSERTION"]);
    expect(ds.describeDezogValues("a < 4")).toBe("a=$04");
    expect(ds.describeDezogValues("b@(0x8000) == 6 && hl != 0")).toBe("b@(0x8000)=$06, hl=$0000".replace("$0000", `$${s.machine.hl.toString(16).toUpperCase().padStart(4, "0")}`));
  });

  it("does not stop while switched off, nor while disabled", async () => {
    const off = await session(LOOP, { switches: { assertion: false } });
    expect(off.s.callToBreakpoint("Main")).toBe(off.program.symbol("Done"));
    const disabled = await session(LOOP);
    for (const bp of disabled.ds.breakpoints.filter((b) => b.annotationKind)) {
      disabled.ds.enableBreakpoint(bp, false);
    }
    expect(disabled.s.callToBreakpoint("Main")).toBe(disabled.program.symbol("Done"));
  });
});

describe("WPMEM comments - ZX Spectrum 48K", () => {
  const WRITES = (offset: number) => `
      .org $8000
  Main:
      ld a,$aa
      ld (Buf+${offset}),a
      nop
  Done:
      jr Done
  Buf:   ; WPMEM, 5, w
      .defs 6
  `;

  it("catches a write inside the 5-byte range", async () => {
    const { s, program, ds } = await session(WRITES(4));
    expect(s.callToBreakpoint("Main")).not.toBe(program.symbol("Done"));
    ds.consumeFiredOneShots();
    expect(ds.lastStopBreakpoints[0]).toMatchObject({ annotationKind: "WPMEM", memoryWrite: true, length: 5 });
    expect(ds.lastStopAccesses[0]).toEqual({ address: program.symbol("Buf") + 4, value: 0xaa });
  });

  it("does not catch a write one past it", async () => {
    const { s, program, ds } = await session(WRITES(5));
    expect(s.callToBreakpoint("Main")).toBe(program.symbol("Done"));
    ds.consumeFiredOneShots();
    expect(ds.lastStopBreakpoints).toEqual([]);
  });
});

describe("one annotation set (§4.4)", () => {
  it("keeps LOGPOINT, ASSERTION and WPMEM breakpoints together, apart from the user's", async () => {
    const { ds } = await session(`
      .org $8000
  Main:
      ld a,1     ; ASSERTION a == 1
      nop        ; LOGPOINT [X] here
  Done:
      jr Done
  Buf: ; WPMEM
      .defb 0
    `);
    const kinds = () =>
      ds.breakpoints
        .filter((bp) => bp.owner?.kind === "annotation")
        .map((bp) => bp.annotationKind ?? "LOGPOINT")
        .sort();
    expect(kinds()).toEqual(["ASSERTION", "LOGPOINT", "WPMEM", "WPMEM"]);
    // --- A project-scoped reset leaves them alone; a user breakpoint on the same address coexists
    ds.addBreakpoint({ address: 0x8000, exec: true });
    ds.resetBreakpointsTo([], { kind: "project" });
    expect(kinds()).toEqual(["ASSERTION", "LOGPOINT", "WPMEM", "WPMEM"]);
  });
});

describe("the WPMEM stop report's PC", () => {
  it("is the writing instruction's address, which the last stop decision holds", async () => {
    const s = await createSp48Session();
    const program = await s.loadCode(`
      .org $8000
  Main:
      ld a,1
  Write:
      ld (Buf),a
      nop
  Done:
      jr Done
  Buf: .defb 0
    `);
    const ds = s.attachDebugSupport();
    ds.addBreakpoint({ address: program.symbol("Done"), exec: true });
    ds.addBreakpoint({ address: program.symbol("Buf"), memoryWrite: true });
    s.callToBreakpoint("Main");
    expect(ds.lastDecisionPc).toBe(program.symbol("Write"));
  });
});
