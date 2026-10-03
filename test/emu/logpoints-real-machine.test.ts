import { describe, expect, it } from "vitest";

import type { KliveCompilerOutput } from "@abstractions/CompilerInfo";

import { LOG_LINES_PER_FRAME } from "@emu/machines/DebugSupport";
import { checkSourceAnnotations } from "@common/utils/source-annotations";
import { buildLogpoints } from "@common/utils/breakpoints";
import { integerSymbolsOf } from "@common/utils/breakpoint-condition/integer-symbols";

import { createSp48Session } from "../harness/sp48";
import { createSession } from "../harness/zxnext";

/*
 * Logpoints on the real machines (the WASM cores), Phase 3 of `.plans/LOGPOINTS_PLAN.md`: templates
 * read the core's registers and memory at the hit, hit rules count real passes, a logpoint never
 * stops, and the per-frame cap holds in a hot loop. Every program ends in a plain breakpoint.
 */

describe("logpoints - ZX Spectrum 48K", () => {
  async function loopSession(passes = 10) {
    const s = await createSp48Session();
    const program = await s.loadCode(`
        .org $8000
    Main:
        ld b,${passes}
    Loop:
        nop
        djnz Loop
    Done:
        jr Done
    `);
    const ds = s.attachDebugSupport();
    ds.addBreakpoint({ address: program.symbol("Done"), exec: true });
    return { s, program, ds };
  }

  it("logs B = 10 ... 1 in order from a DJNZ loop, and does not stop", async () => {
    const { s, program, ds } = await loopSession();
    ds.addBreakpoint({ address: program.symbol("Loop"), exec: true, logMessage: "[LOOP] B={B:uint8}" });
    expect(s.callToBreakpoint("Main")).toBe(program.symbol("Done"));
    const { lines } = ds.takeLogLines();
    expect(lines.map((l) => l.text)).toEqual(Array.from({ length: 10 }, (_, i) => `B=${10 - i}`));
    expect(lines.every((l) => l.group === "LOOP" && l.address === program.symbol("Loop"))).toBe(true);
  });

  it("logs every fourth pass with -hit *4", async () => {
    const { s, program, ds } = await loopSession();
    ds.addBreakpoint({
      address: program.symbol("Loop"),
      exec: true,
      logMessage: "B={B:uint8}",
      hitMode: "every",
      hitCount: 4
    });
    s.callToBreakpoint("Main");
    expect(ds.takeLogLines().lines.map((l) => l.text)).toEqual(["B=7", "B=3"]);
  });

  it("logs and stops where a breakpoint shares the address, the line first; Continue does not repeat it", async () => {
    const { s, program, ds } = await loopSession(3);
    const loop = program.symbol("Loop");
    // --- A source breakpoint resolved onto the logpoint's address: two definitions, one place
    ds.addBreakpoint({ resource: "main.asm", line: 4, exec: true });
    ds.resolveBreakpoint("main.asm", 4, loop);
    ds.addBreakpoint({ address: loop, exec: true, logMessage: "B={B:uint8}" });

    expect(s.callToBreakpoint("Main")).toBe(loop);
    // --- Queued before the stop is reported: the controller drains it before the stop message
    expect(ds.takeLogLines().lines.map((l) => l.text)).toEqual(["B=3"]);
    expect(s.continueToBreakpoint()).toBe(loop);
    expect(ds.takeLogLines().lines.map((l) => l.text)).toEqual(["B=2"]);
  });

  it("logs the first instruction a machine starts on once", async () => {
    const { s, program, ds } = await loopSession(1);
    ds.addBreakpoint({ address: program.symbol("Main"), exec: true, logMessage: "start" });
    ds.lastDecisionPc = undefined;
    s.callToBreakpoint("Main");
    expect(ds.takeLogLines().lines.map((l) => l.text)).toEqual(["start"]);
  });

  it("shows VAL on a memory-write logpoint", async () => {
    const s = await createSp48Session();
    const program = await s.loadCode(`
        .org $8000
    Main:
        ld a,$22
        ld ($9001),a
        ld a,$aa
        ld ($9001),a
    Done:
        jr Done
    `);
    const ds = s.attachDebugSupport();
    ds.addBreakpoint({ address: program.symbol("Done"), exec: true });
    ds.addBreakpoint({ address: 0x9001, memoryWrite: true, logMessage: "[MEM] {VAL} at PC={PC:hex16}" });
    expect(s.callToBreakpoint("Main")).toBe(program.symbol("Done"));
    const texts = ds.takeLogLines().lines.map((l) => l.text);
    expect(texts).toHaveLength(2);
    expect(texts[0]).toMatch(/^\$22 at PC=/);
    expect(texts[1]).toMatch(/^\$AA at PC=/);
  });

  it("is silent while its group is switched off", async () => {
    const { s, program, ds } = await loopSession(3);
    ds.addBreakpoint({ address: program.symbol("Loop"), exec: true, logMessage: "[LOOP] B={B}" });
    ds.setLogGroups({ enabled: true, groups: ["OTHER"] });
    s.callToBreakpoint("Main");
    expect(ds.takeLogLines()).toEqual({ lines: [], dropped: 0 });
  });

  it("caps a 100 000-pass loop at 256 lines a frame and counts what it drops", async () => {
    const s = await createSp48Session();
    const program = await s.loadCode(`
        .org $8000
    Main:
        ld c,2
    Outer:
        ld de,50000
    Inner:
        dec de
        ld a,d
        or e
        jr nz,Inner
        dec c
        jr nz,Outer
    Done:
        jr Done
    `);
    const ds = s.attachDebugSupport();
    ds.addBreakpoint({ address: program.symbol("Done"), exec: true });
    ds.addBreakpoint({ address: program.symbol("Inner"), exec: true, logMessage: "DE={DE}" });
    let logged = 0;
    let dropped = 0;
    let frames = 0;
    let largest = 0;
    const started = performance.now();
    s.callToBreakpoint("Main", {
      maxFrames: 2000,
      onFrame: () => {
        const drained = ds.takeLogLines();
        frames++;
        logged += drained.lines.length;
        dropped += drained.dropped;
        largest = Math.max(largest, drained.lines.length);
      }
    });
    const msPerFrame = (performance.now() - started) / frames;
    expect(logged + dropped).toBe(100_000);
    expect(largest).toBe(LOG_LINES_PER_FRAME);
    expect(dropped).toBeGreaterThan(0);
    // --- Far from a real-time budget check; it catches a pathological slowdown, not a regression
    expect(msPerFrame).toBeLessThan(200);
  });
});

describe("logpoints - ZX Spectrum Next", () => {
  it("logs a DJNZ loop, a Next register and the slot map", async () => {
    const s = await createSession();
    await s.loadCode(`
        .org $8000
    Main:
        nextreg $56,$21
        ld b,3
    Loop:
        nop
        djnz Loop
    Done:
        jr Done
    `);
    const ds = s.attachDebugSupport();
    ds.addBreakpoint({ address: s.symbol("Done"), exec: true });
    ds.addBreakpoint({
      address: s.symbol("Loop"),
      exec: true,
      logMessage: "B={B:uint8} nr={nr($56):hex8} map={slots()}"
    });
    expect(s.continueToBreakpoint()).toBe(s.symbol("Done"));
    const texts = ds.takeLogLines().lines.map((l) => l.text);
    expect(texts.map((t) => t.split(" map=")[0])).toEqual(["B=3 nr=21", "B=2 nr=21", "B=1 nr=21"]);
    const map = texts[0].split(" map=")[1].split(" ");
    expect(map).toHaveLength(8);
    expect(map[6]).toBe("21");
  });
});

describe("DeZog LOGPOINT comments end to end - ZX Spectrum 48K", () => {
  it("assembles a DeZog-style sample and logs what its comments say", async () => {
    const s = await createSp48Session();
    const program = await s.loadCode(`
        .org $8000
    Main:
        ld b,3
        ld hl,Counter
    Loop:
        ; LOGPOINT [LOOP] B=\${B}, counter=\${b@(Counter)}
        inc (hl)
        djnz Loop          ; LOGPOINT [LOOP] after inc: \${b@(Counter):uint8}
        ld a,(hl)          ; LOGPOINT [END] A will be \${b@(HL)}, \${Remote.cpuFrequency/1000000}MHz
    Done:
        jr Done
    Counter:
        .defb 0
    `);
    // --- What the IDE does after a build: check the comments, build the logpoints, bind the symbols
    const output = checkSourceAnnotations(program.output as unknown as KliveCompilerOutput);
    expect(output.errors.filter((e) => e.isWarning)).toEqual([]);
    const ds = s.attachDebugSupport();
    ds.setConditionSymbols(integerSymbolsOf((output as { symbols?: Record<string, unknown> }).symbols));
    ds.resetBreakpointsTo(buildLogpoints(output, undefined, "sp48"), { kind: "annotation" });
    ds.addBreakpoint({ address: program.symbol("Done"), exec: true });

    expect(s.callToBreakpoint("Main")).toBe(program.symbol("Done"));
    const lines = ds.takeLogLines().lines.map((l) => `[${l.group}] ${l.text}`);
    expect(lines).toEqual([
      "[LOOP] B=$03, counter=$00",
      "[LOOP] after inc: 1",
      "[LOOP] B=$02, counter=$01",
      "[LOOP] after inc: 2",
      "[LOOP] B=$01, counter=$02",
      "[LOOP] after inc: 3",
      "[END] A will be $03, 3MHz"
    ]);
    // --- The build owns them: a project-scoped replace leaves them alone
    ds.resetBreakpointsTo([], { kind: "project" });
    expect(ds.breakpoints.filter((bp) => bp.owner?.kind === "annotation")).toHaveLength(3);
  });
});
