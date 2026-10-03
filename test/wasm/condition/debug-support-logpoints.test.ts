import { describe, expect, it } from "vitest";

import type { BreakpointInfo } from "@abstractions/BreakpointInfo";
import type { ConditionRegister } from "@common/utils/breakpoint-condition/condition-types";

import { COND_BP, DebugSupport, LOG_LINES_PER_FRAME } from "@emu/machines/DebugSupport";
import { shouldStopAtDebugPoint } from "@emu/machines/DebugStepDecision";
import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { conditionMachineFacts } from "@common/utils/breakpoint-condition/condition-machine";
import { logLineOutput } from "@emu/machines/logOutput";
import { conditionTestStore } from "./condition-host";

/*
 * Logpoints in the emulator's breakpoint store (`.plans/LOGPOINTS_PLAN.md` Phase 3): the "log and
 * continue" outcome of the slow path, the arrival rule through the real stop decision (§4.2's six
 * cases), the queue and its cap, groups, and the error and inactive states. Templates run on the C
 * evaluator every Z80 core includes, built standalone over a fake machine.
 */

function setup() {
  const regs: Partial<Record<ConditionRegister, number>> = {};
  const memory = new Uint8Array(0x10000);
  const store = conditionTestStore({
    reg: (id) => regs[id] ?? 0,
    readMemory: (address) => memory[address],
    readPartition: () => 0,
    readBank: () => 0,
    partitionOf: () => undefined,
    tstates: () => 1234
  });
  const ds = new DebugSupport();
  ds.setConditionEnvironment(conditionMachineFacts("sp48", {}));
  ds.conditionStoreProvider = () => store;
  ds.machineInfo = { cpuFrequency: () => 3_500_000, frame: () => 42, slots: () => "" };
  return { ds, regs, memory };
}

/** One stop decision through the shared decision function, as every debug loop makes it. */
function decide(
  ds: DebugSupport,
  pc: number,
  instructionsExecuted: number,
  mode = DebugStepMode.StopAtBreakpoint,
  callLength = 0
): boolean {
  return shouldStopAtDebugPoint({
    debugSupport: ds,
    debugStepMode: mode,
    pc,
    instructionsExecuted,
    getPartition: () => undefined,
    getCallInstructionLength: () => callLength,
    retExecuted: false
  });
}

const texts = (ds: DebugSupport) => ds.takeLogLines().lines.map((l) => l.text);

describe("the logpoint outcome", () => {
  it("logs and never stops (L3), and takes the slow path", () => {
    const { ds, regs } = setup();
    ds.addBreakpoint({ address: 0x8000, exec: true, logMessage: "x={A} at {PC:hex16}" });
    expect(ds.breakpointFlags[0x8000] & COND_BP).toBeTruthy();
    regs.A = 0x3f;
    regs.PC = 0x8000;
    expect(ds.shouldStopAt(0x8000, () => undefined)).toBe(false);
    const { lines, dropped } = ds.takeLogLines();
    expect(dropped).toBe(0);
    expect(lines).toEqual([{ group: "DEFAULT", text: "x=$3F at 8000", address: 0x8000, key: "$8000" }]);
    expect(ds.hasPendingLog).toBe(false);
  });

  it("formats with the values at the hit", () => {
    const { ds, regs } = setup();
    ds.addBreakpoint({ address: 0x8000, exec: true, logMessage: "B={B:uint8}" });
    for (const b of [10, 9, 8]) {
      regs.B = b;
      ds.shouldStopAt(0x8000, () => undefined);
    }
    expect(texts(ds)).toEqual(["B=10", "B=9", "B=8"]);
  });

  it("applies the condition and the hit rule; the counter counts logs", () => {
    const { ds, regs } = setup();
    ds.addBreakpoint({
      address: 0x8000,
      exec: true,
      logMessage: "n={B:uint8}",
      condition: "A == 0",
      hitMode: "every",
      hitCount: 2
    });
    for (let i = 0; i < 8; i++) {
      regs.A = i % 2; // --- true on every other pass
      regs.B = i;
      ds.shouldStopAt(0x8000, () => undefined);
    }
    // --- Condition true at 0, 2, 4, 6; every 2nd of those logs
    expect(texts(ds)).toEqual(["n=2", "n=6"]);
    expect(ds.listBreakpointsWithState()[0].currentHits).toBe(4);
  });

  it("logs and stops when a stopping breakpoint shares the address (L4)", () => {
    const { ds } = setup();
    ds.addBreakpoint({ address: 0x8000, exec: true });
    ds.addBreakpoint({ address: 0x8000, partition: 0, exec: true, logMessage: "here" });
    // --- Different keys (one partitioned): both claim $8000; the partition resolver says 0
    expect(ds.shouldStopAt(0x8000, () => 0)).toBe(true);
    expect(texts(ds)).toEqual(["here"]);
  });

  it("logs a template that does not compile as its error, without stopping", () => {
    const { ds } = setup();
    ds.addBreakpoint({ address: 0x8000, exec: true, logMessage: "x={A +}" });
    expect(ds.shouldStopAt(0x8000, () => undefined)).toBe(false);
    expect(texts(ds)[0]).toMatch(/^<logpoint error: column \d+:/);
    expect(ds.listBreakpointsWithState()[0].logError).toMatch(/^column/);
  });

  it("stays silent while a label it names is unknown, and comes back when a build defines it", () => {
    const { ds, memory } = setup();
    ds.addBreakpoint({ address: 0x8000, exec: true, logMessage: "c={b[counter]}" });
    ds.shouldStopAt(0x8000, () => undefined);
    expect(texts(ds)).toEqual([]);
    expect(ds.listBreakpointsWithState()[0].conditionInactive).toBe("unknown label counter");
    memory[0x7000] = 5;
    ds.setConditionSymbols({ counter: 0x7000 });
    ds.shouldStopAt(0x8000, () => undefined);
    expect(texts(ds)).toEqual(["c=$05"]);
    expect(ds.listBreakpointsWithState()[0].conditionInactive).toBeUndefined();
  });

  it("logs a memory write with VAL and ADDR", () => {
    const { ds } = setup();
    ds.addBreakpoint({ address: 0x4000, memoryWrite: true, logMessage: "[MEM] wrote {VAL} to {ADDR}" });
    expect(ds.hasMemoryWrite([0x4000], 1, () => undefined, [0xa5])).toBe(false);
    const [line] = ds.takeLogLines().lines;
    expect(line).toMatchObject({ group: "MEM", text: "wrote $A5 to $4000", address: 0x4000 });
  });

  it("reads the machine specials", () => {
    const { ds } = setup();
    ds.addBreakpoint({ address: 0x8000, exec: true, logMessage: "{tstates()} {cpufreq()/1000} {frame()}" });
    ds.shouldStopAt(0x8000, () => undefined);
    expect(texts(ds)).toEqual(["1234 3500 42"]);
  });

  it("logs a DeZog-dialect template", () => {
    const { ds, regs, memory } = setup();
    memory[0x7000] = 7;
    ds.setConditionSymbols({ "sprite.counter": 0x7000 });
    ds.addBreakpoint({
      address: 0x8000,
      exec: true,
      logMessage: "[SPRITES] Status=${A:hex8}, Counter=${b@(sprite.counter)}",
      logDialect: "dezog"
    });
    regs.A = 0xf3;
    ds.shouldStopAt(0x8000, () => undefined);
    expect(ds.takeLogLines().lines[0]).toMatchObject({
      group: "SPRITES",
      text: "Status=F3, Counter=$07"
    });
  });

  it("is skipped while disabled", () => {
    const { ds } = setup();
    ds.addBreakpoint({ address: 0x8000, exec: true, logMessage: "x", disabled: true });
    ds.shouldStopAt(0x8000, () => undefined);
    expect(texts(ds)).toEqual([]);
  });

  it("turns back into a stopping breakpoint when the template goes", () => {
    const { ds } = setup();
    const bp: BreakpointInfo = { address: 0x8000, exec: true, logMessage: "x" };
    ds.addBreakpoint(bp);
    expect(ds.shouldStopAt(0x8000, () => undefined)).toBe(false);
    ds.addBreakpoint({ address: 0x8000, exec: true });
    expect(ds.breakpoints).toHaveLength(1);
    expect(ds.shouldStopAt(0x8000, () => undefined)).toBe(true);
  });
});

describe("the arrival rule (L5, §4.2)", () => {
  it("1: a run passing through a logpoint logs once per pass", () => {
    const { ds } = setup();
    ds.addBreakpoint({ address: 0x8000, exec: true, logMessage: "pass" });
    decide(ds, 0x8000, 3);
    decide(ds, 0x8001, 4);
    decide(ds, 0x8000, 7);
    expect(texts(ds)).toEqual(["pass", "pass"]);
  });

  it("1b: a frame boundary on the logpoint does not log it twice", () => {
    const { ds } = setup();
    ds.addBreakpoint({ address: 0x8000, exec: true, logMessage: "pass" });
    decide(ds, 0x8000, 3000); // --- the last decision of one frame
    decide(ds, 0x8000, 0); // --- the first of the next: the same instruction
    expect(texts(ds)).toEqual(["pass"]);
  });

  it("2: stopping at a breakpoint with a logpoint logs once; Continue does not log again", () => {
    const { ds } = setup();
    ds.addBreakpoint({ address: 0x8000, exec: true });
    ds.addBreakpoint({ address: 0x8000, partition: 0, exec: true, logMessage: "here" });
    const resolver = () => 0;
    const stop = shouldStopAtDebugPoint({
      debugSupport: ds,
      debugStepMode: DebugStepMode.StopAtBreakpoint,
      pc: 0x8000,
      instructionsExecuted: 2,
      getPartition: resolver,
      getCallInstructionLength: () => 0,
      retExecuted: false
    });
    expect(stop).toBe(true);
    expect(texts(ds)).toEqual(["here"]);
    // --- Continue
    shouldStopAtDebugPoint({
      debugSupport: ds,
      debugStepMode: DebugStepMode.StopAtBreakpoint,
      pc: 0x8000,
      instructionsExecuted: 0,
      getPartition: resolver,
      getCallInstructionLength: () => 0,
      retExecuted: false
    });
    expect(texts(ds)).toEqual([]);
  });

  it("3: Step Into onto a logpoint logs; Continue from there does not", () => {
    const { ds } = setup();
    ds.addBreakpoint({ address: 0x8000, exec: true, logMessage: "here" });
    decide(ds, 0x7ffe, 0, DebugStepMode.StepInto);
    decide(ds, 0x8000, 1, DebugStepMode.StepInto);
    expect(texts(ds)).toEqual(["here"]);
    decide(ds, 0x8000, 0, DebugStepMode.StopAtBreakpoint);
    expect(texts(ds)).toEqual([]);
  });

  it("4: Pause while sitting on it, then Continue: no second line", () => {
    const { ds } = setup();
    ds.addBreakpoint({ address: 0x8000, exec: true, logMessage: "here" });
    decide(ds, 0x8000, 12); // --- the decision made just before the pause took effect
    decide(ds, 0x8000, 0); // --- Continue
    expect(texts(ds)).toEqual(["here"]);
  });

  it("5: Step Over a CALL whose routine has a logpoint logs", () => {
    const { ds } = setup();
    ds.addBreakpoint({ address: 0x9000, exec: true, logMessage: "in routine" });
    expect(decide(ds, 0x8000, 0, DebugStepMode.StepOver, 3)).toBe(false);
    expect(decide(ds, 0x9000, 1, DebugStepMode.StepOver)).toBe(false);
    expect(decide(ds, 0x8003, 9, DebugStepMode.StepOver)).toBe(true);
    expect(texts(ds)).toEqual(["in routine"]);
  });

  it("6: a machine started with PC on a logpoint logs once", () => {
    const { ds } = setup();
    ds.addBreakpoint({ address: 0x8000, exec: true, logMessage: "start" });
    ds.lastDecisionPc = undefined; // --- what the controller does on a start
    decide(ds, 0x8000, 0);
    decide(ds, 0x8001, 1);
    expect(texts(ds)).toEqual(["start"]);
  });
});

describe("the queue", () => {
  it(`keeps at most ${LOG_LINES_PER_FRAME} lines per drain and counts the rest`, () => {
    const { ds } = setup();
    ds.addBreakpoint({ address: 0x8000, exec: true, logMessage: "x" });
    for (let i = 0; i < 1000; i++) ds.shouldStopAt(0x8000, () => undefined);
    const { lines, dropped } = ds.takeLogLines();
    expect(lines).toHaveLength(LOG_LINES_PER_FRAME);
    expect(dropped).toBe(1000 - LOG_LINES_PER_FRAME);
    expect(ds.takeLogLines()).toEqual({ lines: [], dropped: 0 });
  });

  it("is rendered as [GROUP] message @ $addr, with one drop line", () => {
    const out = logLineOutput([{ group: "LOOP", text: "B=$03", address: 0x8012, key: "$8012" }], 1234);
    expect(out.map((s) => s.text).join("|")).toBe("[LOOP] |B=$03| @ $8012|… 1 234 log lines dropped in this frame");
    expect(out.every((s) => s.pane === "log")).toBe(true);
  });
});

describe("groups (L11)", () => {
  it("switches all off, all on, or only the listed groups", () => {
    const { ds } = setup();
    ds.addBreakpoint({ address: 0x8000, exec: true, logMessage: "[A] a" });
    ds.addBreakpoint({ address: 0x8001, exec: true, logMessage: "[b] b" });
    ds.addBreakpoint({ address: 0x8002, exec: true, logMessage: "c" });
    const run = () => {
      for (const a of [0x8000, 0x8001, 0x8002]) ds.shouldStopAt(a, () => undefined);
      return texts(ds);
    };
    expect(run()).toEqual(["a", "b", "c"]);
    ds.setLogGroups({ enabled: false });
    expect(run()).toEqual([]);
    ds.setLogGroups({ enabled: true, groups: ["b", "DEFAULT"] });
    expect(run()).toEqual(["b", "c"]);
    expect(ds.isLogGroupEnabled("a")).toBe(false);
    ds.setLogGroups(undefined);
    expect(run()).toEqual(["a", "b", "c"]);
  });

  it("does not count hits while the group is off", () => {
    const { ds } = setup();
    ds.addBreakpoint({ address: 0x8000, exec: true, logMessage: "[G] x" });
    ds.setLogGroups({ enabled: true, groups: ["OTHER"] });
    ds.shouldStopAt(0x8000, () => undefined);
    expect(ds.listBreakpointsWithState()[0].currentHits).toBe(0);
  });
});
