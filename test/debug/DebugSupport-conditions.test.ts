import { describe, expect, it } from "vitest";

import type { BreakpointInfo } from "@abstractions/BreakpointInfo";
import type { ConditionContext, ConditionRegister } from "@common/utils/breakpoint-condition/condition-types";

import { COND_BP, DebugSupport, EXEC_BP } from "@emu/machines/DebugSupport";
import { conditionMachineFacts } from "@common/utils/breakpoint-condition/condition-machine";
import { bankLocalSymbolKey } from "@common/utils/breakpoint-condition/condition-types";
import { bankRelativePartition } from "@common/utils/breakpoint-scope";

/*
 * Conditional breakpoints in the emulator's breakpoint store, Phase 3 of
 * `.plans/CONDITIONAL_BREAKPOINTS_PLAN.md`: the slow path, per-definition counters, the hit rules,
 * resets, symbol binding, and the fail-safe and inactive states.
 */

type Fake = {
  regs: Partial<Record<ConditionRegister, number>>;
  memory: Uint8Array;
  /** How many times the provider built a context. */
  contexts: number;
};

function setup(over: { machineId?: string; labels?: Record<number, string> } = {}) {
  const fake: Fake = { regs: {}, memory: new Uint8Array(0x10000), contexts: 0 };
  const ds = new DebugSupport();
  ds.setConditionEnvironment(conditionMachineFacts(over.machineId ?? "sp48", over.labels ?? {}));
  ds.conditionContextProvider = (): ConditionContext => {
    fake.contexts++;
    return {
      reg: (id) => fake.regs[id] ?? 0,
      readMemory: (address) => fake.memory[address],
      readPartition: () => 0,
      readBank: () => 0,
      partitionOf: () => undefined
    };
  };
  return { ds, fake };
}

const noPaging = () => undefined;
const at = (ds: DebugSupport, address: number, resolver: (a: number) => number | undefined = noPaging) =>
  ds.shouldStopAt(address, resolver);
const hitsOf = (ds: DebugSupport, index = 0) => ds.listBreakpointsWithState()[index].currentHits;

describe("the fast path", () => {
  it("is untouched for a breakpoint without filters: no flag, no context", () => {
    const { ds, fake } = setup();
    ds.addBreakpoint({ address: 0x8000, exec: true });
    expect(ds.breakpointFlags[0x8000] & COND_BP).toBe(0);
    expect(at(ds, 0x8000)).toBe(true);
    expect(fake.contexts).toBe(0);
  });

  it("builds no context for a hit rule alone", () => {
    const { ds, fake } = setup();
    ds.addBreakpoint({ address: 0x8000, exec: true, hitCount: 2 });
    expect(ds.breakpointFlags[0x8000] & COND_BP).toBeTruthy();
    at(ds, 0x8000);
    expect(fake.contexts).toBe(0);
  });

  it("builds the context once per decision, however many conditions read it", () => {
    const { ds, fake } = setup();
    ds.addBreakpoint({ address: 0x8000, exec: true, condition: "A == 1" });
    ds.addBreakpoint({ address: 0x8000, partition: 3, exec: true, condition: "B == 1" });
    at(ds, 0x8000, () => 3);
    expect(fake.contexts).toBe(1);
  });
});

describe("conditions", () => {
  it("stops only when the condition is true", () => {
    const { ds, fake } = setup();
    ds.addBreakpoint({ address: 0x8000, exec: true, condition: "B == 3" });
    fake.regs.B = 4;
    expect(at(ds, 0x8000)).toBe(false);
    fake.regs.B = 3;
    expect(at(ds, 0x8000)).toBe(true);
  });

  it("counts only condition-true hits (C11)", () => {
    const { ds, fake } = setup();
    ds.addBreakpoint({ address: 0x8000, exec: true, condition: "A == $FF" });
    for (const a of [1, 0xff, 2, 0xff, 0xff]) {
      fake.regs.A = a;
      at(ds, 0x8000);
    }
    expect(hitsOf(ds)).toBe(3);
  });

  it("stops every time when the condition does not compile (C15) and reports why", () => {
    const { ds } = setup();
    ds.addBreakpoint({ address: 0x8000, exec: true, condition: "A ==" });
    expect(at(ds, 0x8000)).toBe(true);
    expect(at(ds, 0x8000)).toBe(true);
    const [listed] = ds.listBreakpointsWithState();
    expect(listed.conditionError).toContain("column 5");
    expect(listed.currentHits).toBe(2);
  });

  it("stops when evaluation throws, e.g. a machine without a context", () => {
    const { ds } = setup();
    ds.conditionContextProvider = undefined;
    ds.addBreakpoint({ address: 0x8000, exec: true, condition: "A == 1" });
    expect(at(ds, 0x8000)).toBe(true);
  });

  it("rejects every condition on a non-Z80 machine, failing safe", () => {
    const { ds } = setup({ machineId: "c64" });
    ds.addBreakpoint({ address: 0x8000, exec: true, condition: "A == 1" });
    expect(ds.listBreakpointsWithState()[0].conditionError).toContain("Z80 machines only");
    expect(at(ds, 0x8000)).toBe(true);
  });

  it("does not let a disabled breakpoint stop or count", () => {
    const { ds } = setup();
    ds.addBreakpoint({ address: 0x8000, exec: true, condition: "1", disabled: true });
    expect(at(ds, 0x8000)).toBe(false);
    expect(hitsOf(ds)).toBe(0);
  });

  it("keeps a plain breakpoint working beside a conditional one at the same address", () => {
    const { ds, fake } = setup();
    ds.addBreakpoint({ address: 0x8000, partition: 3, exec: true, condition: "A == 1" });
    ds.addBreakpoint({ address: 0x8000, exec: true });
    fake.regs.A = 0;
    expect(at(ds, 0x8000, () => 3)).toBe(true);
  });
});

describe("labels (C14)", () => {
  it("is inactive while a label is unknown: never stops, never counts", () => {
    const { ds } = setup();
    ds.addBreakpoint({ address: 0x8000, exec: true, condition: "score == 1 || 1" });
    expect(at(ds, 0x8000)).toBe(false);
    const [listed] = ds.listBreakpointsWithState();
    expect(listed.conditionInactive).toBe("unknown label score");
    expect(listed.currentHits).toBe(0);
  });

  it("comes back when a build defines the label, and goes again when it disappears", () => {
    const { ds, fake } = setup();
    ds.addBreakpoint({ address: 0x8000, exec: true, condition: "w[score] == 1000" });
    fake.memory[0x9000] = 0xe8;
    fake.memory[0x9001] = 0x03;
    ds.setConditionSymbols({ score: 0x9000 });
    expect(ds.listBreakpointsWithState()[0].conditionInactive).toBeUndefined();
    expect(at(ds, 0x8000)).toBe(true);

    ds.setConditionSymbols({});
    expect(at(ds, 0x8000)).toBe(false);
    expect(ds.listBreakpointsWithState()[0].conditionInactive).toBe("unknown label score");
  });

  it("binds a breakpoint added after the symbols arrived", () => {
    const { ds } = setup();
    ds.setConditionSymbols({ lives: 3 });
    ds.addBreakpoint({ address: 0x8000, exec: true, condition: "lives == 3" });
    expect(at(ds, 0x8000)).toBe(true);
  });

  it("resolves NEX bank-local labels", () => {
    const { ds } = setup({ machineId: "zxnext", labels: { 0: "00", 1: "01" } });
    ds.setConditionSymbols({ [bankLocalSymbolKey(5, "Flags")]: 0x0123 });
    ds.addBreakpoint({ address: 0x8000, exec: true, condition: "05:Flags == $123" });
    expect(at(ds, 0x8000)).toBe(true);
  });
});

describe("hit rules (§4.2)", () => {
  function stopsOn(rule: Pick<BreakpointInfo, "hitMode" | "hitCount">, hits = 12): number[] {
    const { ds } = setup();
    ds.addBreakpoint({ address: 0x8000, exec: true, ...rule });
    const stops: number[] = [];
    for (let i = 1; i <= hits; i++) if (at(ds, 0x8000)) stops.push(i);
    return stops;
  }

  it.each<[string, Pick<BreakpointInfo, "hitMode" | "hitCount">, number[]]>([
    ["a bare count (equal)", { hitCount: 4 }, [4]],
    ["eq", { hitMode: "eq", hitCount: 4 }, [4]],
    ["gt", { hitMode: "gt", hitCount: 10 }, [11, 12]],
    ["ge", { hitMode: "ge", hitCount: 10 }, [10, 11, 12]],
    ["lt", { hitMode: "lt", hitCount: 3 }, [1, 2]],
    ["le", { hitMode: "le", hitCount: 3 }, [1, 2, 3]],
    ["every", { hitMode: "every", hitCount: 4 }, [4, 8, 12]],
    ["every 1", { hitMode: "every", hitCount: 1 }, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]]
  ])("%s", (_name, rule, expected) => {
    expect(stopsOn(rule)).toEqual(expected);
  });

  it("combines with a condition: every 2nd time A is $FF", () => {
    const { ds, fake } = setup();
    ds.addBreakpoint({ address: 0x8000, exec: true, condition: "A == $FF", hitMode: "every", hitCount: 2 });
    const stops: number[] = [];
    [0xff, 0, 0xff, 0, 0, 0xff, 0xff].forEach((a, i) => {
      fake.regs.A = a;
      if (at(ds, 0x8000)) stops.push(i);
    });
    expect(stops).toEqual([2, 6]);
  });
});

describe("counters (C12)", () => {
  it("are per definition: two breakpoints at one address count apart", () => {
    const { ds, fake } = setup();
    ds.addBreakpoint({ address: 0x8000, partition: 3, exec: true, condition: "A == 1" });
    ds.addBreakpoint({ address: 0x8000, partition: 4, exec: true, condition: "A == 1" });
    fake.regs.A = 1;
    at(ds, 0x8000, () => 3);
    at(ds, 0x8000, () => 3);
    at(ds, 0x8000, () => 4);
    const listed = ds.listBreakpointsWithState();
    expect(listed.find((bp) => bp.partition === 3)!.currentHits).toBe(2);
    expect(listed.find((bp) => bp.partition === 4)!.currentHits).toBe(1);
  });

  it("evaluates every definition at the address, so each counter stays right", () => {
    const { ds } = setup();
    ds.addBreakpoint({ address: 0x8000, exec: true, hitCount: 1 });
    ds.addBreakpoint({ address: 0x8000, partition: 1, exec: true, hitCount: 5 });
    at(ds, 0x8000, () => 1);
    expect(ds.listBreakpointsWithState().map((bp) => bp.currentHits)).toEqual([1, 1]);
  });

  it("count a bank-relative breakpoint only where its bank is paged", () => {
    const { ds } = setup({ machineId: "zxnext", labels: { 10: "0A" } });
    const partition = bankRelativePartition(5, 0x0100);
    ds.addBreakpoint({ bank: 5, bankOffset: 0x0100, exec: true, hitMode: "ge", hitCount: 1 });
    expect(at(ds, 0x8100, () => partition + 1)).toBe(false);
    expect(at(ds, 0x8100, () => partition)).toBe(true);
    expect(hitsOf(ds)).toBe(1);
  });

  it("survive an edit of the condition or the hit rule", () => {
    const { ds } = setup();
    ds.addBreakpoint({ address: 0x8000, exec: true, hitCount: 10 });
    at(ds, 0x8000);
    at(ds, 0x8000);
    ds.addBreakpoint({ address: 0x8000, exec: true, hitMode: "every", hitCount: 3 });
    expect(hitsOf(ds)).toBe(2);
    expect(at(ds, 0x8000)).toBe(true);
  });

  it("survive resetBreakpointsTo for the breakpoints that remain", () => {
    const { ds } = setup();
    ds.addBreakpoint({ address: 0x8000, exec: true, hitCount: 10 });
    ds.addBreakpoint({ address: 0x9000, exec: true, hitCount: 10 });
    at(ds, 0x8000);
    at(ds, 0x9000);
    ds.resetBreakpointsTo([{ address: 0x8000, exec: true, hitCount: 10 }], { kind: "project" });
    expect(ds.listBreakpointsWithState()).toHaveLength(1);
    expect(hitsOf(ds)).toBe(1);
    // --- The removed one starts from zero if it comes back
    ds.addBreakpoint({ address: 0x9000, exec: true, hitCount: 10 });
    expect(ds.listBreakpointsWithState().find((bp) => bp.address === 0x9000)!.currentHits).toBe(0);
  });

  it("start from zero for a breakpoint removed and added again", () => {
    const { ds } = setup();
    const bp = { address: 0x8000, exec: true, hitCount: 10 };
    ds.addBreakpoint(bp);
    at(ds, 0x8000);
    ds.removeBreakpoint(bp);
    ds.addBreakpoint(bp);
    expect(hitsOf(ds)).toBe(0);
  });

  it("follow a source breakpoint when its line moves or its file is renamed", () => {
    const { ds } = setup();
    ds.addBreakpoint({ resource: "a.asm", line: 5, exec: true, hitCount: 10 });
    ds.resolveBreakpoint("a.asm", 5, 0x8000);
    at(ds, 0x8000);
    ds.scrollBreakpoints({ resource: "a.asm", line: 1 }, 2);
    ds.renameBreakpoints("a.asm", "b.asm");
    expect(ds.listBreakpointsWithState()[0]).toMatchObject({ resource: "b.asm", line: 7, currentHits: 1 });
  });

  it("reset one breakpoint or all", () => {
    const { ds } = setup();
    ds.addBreakpoint({ address: 0x8000, exec: true, hitCount: 10 });
    ds.addBreakpoint({ address: 0x9000, exec: true, hitCount: 10 });
    at(ds, 0x8000);
    at(ds, 0x9000);
    expect(ds.resetHitCounts({ address: 0x8000, exec: true })).toBe(true);
    expect(ds.listBreakpointsWithState().map((bp) => bp.currentHits)).toEqual([0, 1]);
    ds.resetHitCounts();
    expect(ds.listBreakpointsWithState().map((bp) => bp.currentHits)).toEqual([0, 0]);
    expect(ds.resetHitCounts({ address: 0x1234, exec: true })).toBe(false);
  });

  it("report that they moved, once", () => {
    const { ds } = setup();
    ds.addBreakpoint({ address: 0x8000, exec: true, hitCount: 10 });
    expect(ds.takeHitsChanged()).toBe(false);
    at(ds, 0x8000);
    expect(ds.takeHitsChanged()).toBe(true);
    expect(ds.takeHitsChanged()).toBe(false);
  });

  it("are listed for filtered breakpoints only", () => {
    const { ds } = setup();
    ds.addBreakpoint({ address: 0x8000, exec: true });
    expect(ds.listBreakpointsWithState()[0]).not.toHaveProperty("currentHits");
    // --- and never stored on the definition itself
    ds.addBreakpoint({ address: 0x9000, exec: true, hitCount: 2 });
    at(ds, 0x9000);
    expect(ds.breakpoints.find((bp) => bp.address === 0x9000)).not.toHaveProperty("currentHits");
  });
});

describe("access breakpoints", () => {
  it("give each matched address its own VAL and ADDR", () => {
    const { ds } = setup();
    ds.addBreakpoint({ address: 0x8000, memoryWrite: true, condition: "VAL == $34 && ADDR == $8000" });
    ds.addBreakpoint({ address: 0x8001, memoryWrite: true, condition: "VAL == $34" });
    const writes = [0x8000, 0x8001];
    expect(ds.hasMemoryWrite(writes, 2, noPaging, [0x34, 0x12])).toBe(true);
    const listed = ds.listBreakpointsWithState();
    expect(listed.find((bp) => bp.address === 0x8000)!.currentHits).toBe(1);
    expect(listed.find((bp) => bp.address === 0x8001)!.currentHits).toBe(0);
  });

  it("examine every access, not only up to the first stop", () => {
    const { ds } = setup();
    ds.addBreakpoint({ address: 0x8000, memoryRead: true });
    ds.addBreakpoint({ address: 0x8001, memoryRead: true, hitCount: 5 });
    expect(ds.hasMemoryRead([0x8000, 0x8001], 2, noPaging, [0, 0])).toBe(true);
    expect(ds.listBreakpointsWithState().find((bp) => bp.address === 0x8001)!.currentHits).toBe(1);
  });

  it("no longer stop looking at a disabled breakpoint", () => {
    const { ds } = setup();
    ds.addBreakpoint({ address: 0x8000, memoryRead: true, disabled: true });
    ds.addBreakpoint({ address: 0x8001, memoryRead: true });
    expect(ds.hasMemoryRead([0x8000, 0x8001], 2, noPaging)).toBe(true);
  });

  it("filter port breakpoints through their mask", () => {
    const { ds } = setup();
    ds.addBreakpoint({ address: 0x00fe, ioWrite: true, ioMask: 0x00ff, condition: "VAL & 7 == 2 && ADDR == $12FE" });
    expect(ds.hasIoWrite(0x12fe, 0x02)).toBe(true);
    expect(ds.hasIoWrite(0x12fe, 0x03)).toBe(false);
    expect(ds.hasIoWrite(0x34fe, 0x02)).toBe(false);
    expect(ds.hasIoRead(0x12fe, 0x02)).toBe(false);
  });

  it("filter NextReg writes, with VAL the value and ADDR the register", () => {
    const { ds } = setup({ machineId: "zxnext", labels: { 0: "00" } });
    ds.addBreakpoint({ nextReg: 0x07, condition: "VAL >= 2 && ADDR == 7", hitMode: "every", hitCount: 2 });
    expect(ds.hasNextRegWrite(0x07, 1, "cpu")).toBe(false);
    expect(ds.hasNextRegWrite(0x07, 2, "cpu")).toBe(false);
    expect(ds.hasNextRegWrite(0x07, 3, "cpu")).toBe(true);
  });

  it("compile VAL as an error on an execution breakpoint, failing safe", () => {
    const { ds } = setup();
    ds.addBreakpoint({ address: 0x8000, exec: true, condition: "VAL == 1" });
    expect(ds.listBreakpointsWithState()[0].conditionError).toContain("execution breakpoint");
    expect(ds.breakpointFlags[0x8000] & EXEC_BP).toBeTruthy();
  });
});

describe("machine facts", () => {
  it("recompile when the machine changes", () => {
    const { ds } = setup();
    ds.addBreakpoint({ address: 0x8000, exec: true, condition: "page($C000) == @B5" });
    expect(ds.listBreakpointsWithState()[0].conditionError).toBeDefined();
    ds.setConditionEnvironment(conditionMachineFacts("sp128", { 5: "B5", 0: "B0" }));
    expect(ds.listBreakpointsWithState()[0].conditionError).toBeUndefined();
  });
});
