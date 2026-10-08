import { describe, expect, it } from "vitest";
import type { KliveCompilerOutput } from "@abstractions/CompilerInfo";
import { profileOffsetOf } from "@common/profile/layouts/profileLayout";
import { sp48ProfileLayout as layout } from "@common/profile/layouts/sp48";
import {
  PF_CODE,
  PF_EXECUTED,
  PF_HALT,
  PROFILE_KEY_INT,
  PROFILE_KEY_ROOT,
  type ProfileEdge,
  type ProfileTouchedByte
} from "@common/profile/profileTypes";
import { buildCallGraph, rollupAddresses, rollupFlat, ROOT_NODE_NAME } from "@common/profile/profileRollup";
import { buildRoutineMap } from "@common/profile/routineMap";
import {
  profileFormatOfName,
  toAddressCsv,
  toCallgrind,
  toFlatCsv,
  toFuse,
  toSpeedscope
} from "@common/profile/profileExport";

/*
 * The flat rollup, the call graph and the exports (`.plans/PROFILER_PLAN.md` D3-D5, D11-D13,
 * Phases 1 and 5) on a synthetic profile whose numbers add up: every time a routine's inclusive
 * time claims is its own exclusive time plus its calls'.
 */

const E = PF_EXECUTED | PF_CODE;

/** Labels as sjasmplus gives them: Main $8000, Sub $8010, Sub2 $8018, Wait $8020 */
function label(name: string, address: number, line: number) {
  return { name, type: 1, value: { _value: address }, definitionFileIndex: 0, definitionLine: line };
}
const compilation = {
  sourceType: "sjasmp",
  sourceFileList: [{ filename: "game.asm" }],
  listFileItems: [],
  segments: [{ startAddress: 0x8000, emittedCode: new Array(0x30).fill(0) }],
  symbols: {
    main: label("Main", 0x8000, 10),
    sub: label("Sub", 0x8010, 20),
    sub2: label("Sub2", 0x8018, 30),
    wait: label("Wait", 0x8020, 40)
  }
} as unknown as KliveCompilerOutput;

const map = buildRoutineMap({
  compilation,
  layout,
  offsetOf: (partition, address) => profileOffsetOf(layout, partition, address)
});

const BYTES: ProfileTouchedByte[] = [
  { offset: 0x0038, flags: E, exec: 2, time: 150 },
  { offset: 0x8000, flags: E, exec: 1, time: 100 },
  { offset: 0x8003, flags: E, exec: 1, time: 50 },
  { offset: 0x8010, flags: E, exec: 4, time: 400 },
  { offset: 0x8012, flags: E, exec: 4, time: 200 },
  { offset: 0x8018, flags: E, exec: 4, time: 100 },
  { offset: 0x8020, flags: E | PF_HALT, exec: 2, time: 10_000 },
  { offset: 0x9000, flags: E, exec: 1, time: 30 },
  // --- Data, never executed
  { offset: 0xa000, flags: 0x04, read: 3 }
];
const INFO = { timeTotal: 11_106, timeIntAck: 76, timeNmiAck: 0, timeDma: 0, timeSnooze: 0 };

/*
 * The call graph of a 1000-tick window: the root ran Main (800); Main called Sub four times (600,
 * 460 its own); Sub recursed (40) and called Sub2 (100); two interrupts ran the ROM's handler (150)
 */
const EDGES: ProfileEdge[] = [
  { caller: PROFILE_KEY_ROOT, callee: 0x8000, calleeAddress: 0x8000, kind: "call", calls: 1, inclusive: 800, exclusive: 200 },
  { caller: 0x8000, callee: 0x8010, calleeAddress: 0x8010, kind: "call", calls: 4, inclusive: 600, exclusive: 460 },
  { caller: 0x8010, callee: 0x8010, calleeAddress: 0x8010, kind: "call", calls: 2, inclusive: 0, exclusive: 40 },
  { caller: 0x8010, callee: 0x8018, calleeAddress: 0x8018, kind: "call", calls: 4, inclusive: 100, exclusive: 100 },
  { caller: PROFILE_KEY_INT, callee: 0x0038, calleeAddress: 0x0038, kind: "int", calls: 2, inclusive: 150, exclusive: 150 }
];
const GRAPH_TOTAL = 1000;

describe("the flat profile (D3, D4)", () => {
  it("rolls instruction starts up into routines and hides waiting by default", () => {
    const flat = rollupFlat(BYTES, map, INFO);
    expect(flat.waiting).toBe(10_000);
    expect(flat.denominator).toBe(INFO.timeTotal - 10_000);
    // --- Routines by self time (ties by name), then the pseudo-rows; Wait's HALT is waiting, hidden
    expect(flat.rows.map((r) => [r.name, r.selfTime, r.calls, r.instructions])).toEqual([
      ["Sub", 600, 4, 8],
      ["$0000-$00FF", 150, 0, 2],
      ["Main", 150, 1, 2],
      ["Sub2", 100, 4, 4],
      ["$9000-$90FF", 30, 1, 1],
      ["Interrupt acknowledge", 76, 0, 0]
    ]);
    const sub = flat.rows.find((r) => r.name === "Sub")!;
    expect(sub.selfPct).toBeCloseTo((100 * 600) / flat.denominator, 6);
    expect(sub.avgPerCall).toBe(150);
    expect(sub).toMatchObject({ file: "game.asm", line: 20, entry: 0x8010, size: 8, callsFromGraph: false });
    expect(flat.rows.find((r) => r.pseudo === "intAck")).toMatchObject({ source: "pseudo", selfTime: 76 });
  });

  it("shows HALT as its own row when waiting is not hidden", () => {
    const flat = rollupFlat(BYTES, map, INFO, { hideWaiting: false });
    expect(flat.denominator).toBe(INFO.timeTotal);
    const halt = flat.rows.find((r) => r.pseudo === "halt")!;
    expect(halt).toMatchObject({ name: "HALT (waiting)", selfTime: 10_000 });
    expect(halt.selfPct).toBeCloseTo((100 * 10_000) / INFO.timeTotal, 6);
    // --- The routine holding the HALT keeps none of its time
    expect(flat.rows.some((r) => r.name === "Wait")).toBe(false);
  });

  it("counts calls from the call graph, and time per frame (D5)", () => {
    const flat = rollupFlat(BYTES, map, INFO, { edges: EDGES, frameTicks: INFO.timeTotal / 2 });
    const sub = flat.rows.find((r) => r.name === "Sub")!;
    // --- Four calls from Main and two recursive ones
    expect(sub).toMatchObject({ calls: 6, callsFromGraph: true });
    expect(flat.frames).toBe(2);
    expect(sub.perFrame).toBe(300);
  });

  it("lists instruction starts by time for the Addresses tab", () => {
    const flat = rollupFlat(BYTES, map, INFO);
    const rows = rollupAddresses(BYTES, map, layout, flat.denominator);
    expect(rows.map((r) => r.address)).toEqual([0x8010, 0x8012, 0x0038, 0x8000, 0x8018, 0x8003, 0x9000]);
    expect(rows[1]).toMatchObject({ routine: expect.objectContaining({ name: "Sub" }), routineOffset: 2, exec: 4, time: 200 });
    expect(rollupAddresses(BYTES, map, layout, flat.denominator, { hideWaiting: false })).toContainEqual(
      expect.objectContaining({ address: 0x8020, halt: true })
    );
  });
});

describe("the call graph (D11, D12, T5)", () => {
  const graph = buildCallGraph(EDGES, map, { timeTotal: GRAPH_TOTAL });

  it("has the code outside every call and each interrupt as roots", () => {
    expect(graph.roots.map((r) => [r.name, r.kind, r.calls, r.inclusive, r.exclusive])).toEqual([
      [ROOT_NODE_NAME, "root", 1, 850, 50],
      ["IM 1 handler at $0038", "interrupt", 2, 150, 150]
    ]);
  });

  it("expands top-down with each edge's own numbers, cutting recursion", () => {
    const [root] = graph.roots;
    const [main] = graph.childrenOf(root);
    expect(main).toMatchObject({ name: "Main", calls: 1, inclusive: 800, exclusive: 200 });
    const [sub] = graph.childrenOf(main, new Set([main.key]));
    expect(sub).toMatchObject({ name: "Sub", calls: 4, inclusive: 600, exclusive: 460 });
    const subChildren = graph.childrenOf(sub, new Set([main.key, sub.key]));
    expect(subChildren.map((c) => [c.name, c.calls, c.recursive ?? false])).toEqual([
      ["Sub2", 4, false],
      ["Sub", 2, true]
    ]);
    expect(graph.childrenOf(subChildren[1])).toEqual([]);
  });

  it("lists a routine's callers bottom-up", () => {
    const sub = map.routineAt(0x8010);
    expect(graph.callersOf(sub.key).map((c) => [c.name, c.calls, c.inclusive])).toEqual([
      ["Main", 4, 600],
      ["Sub", 2, 0]
    ]);
    const handler = map.routineAt(0x0038);
    expect(graph.callersOf(handler.key).map((c) => c.name)).toEqual(["IM 1 handler at $0038"]);
  });

  it("totals every call into a routine", () => {
    const sub = graph.totals.get(map.routineAt(0x8010).key)!;
    expect(sub).toMatchObject({ calls: 6, inclusive: 600, exclusive: 500 });
  });
});

describe("the exports (D13)", () => {
  it("picks the format from the file name", () => {
    expect(profileFormatOfName("game.prof")).toBe("fuse");
    expect(profileFormatOfName("top.csv")).toBe("csv");
    expect(profileFormatOfName("out/callgrind.out.1234")).toBe("callgrind");
    expect(profileFormatOfName("game.callgrind")).toBe("callgrind");
    expect(profileFormatOfName("game.speedscope.json")).toBe("speedscope");
    expect(profileFormatOfName("game.bin")).toBeUndefined();
  });

  it("writes Fuse's profile: one line per instruction start, in address order", () => {
    expect(toFuse(BYTES, layout)).toBe(
      "0x0038,150\n0x8000,100\n0x8003,50\n0x8010,400\n0x8012,200\n0x8018,100\n0x8020,10000\n0x9000,30\n"
    );
  });

  it("writes the flat and the address tables as CSV, formulas defused", () => {
    const flat = rollupFlat(BYTES, map, INFO);
    const csv = toFlatCsv(flat, { timeUnit: "T-states" }).split("\r\n");
    expect(csv[0]).toBe(
      '"Routine","Kind","Partition","Entry","Self (T-states)","Self %","Entry executions","Instructions",' +
        '"Average per call (T-states)","Per frame (T-states)","Size","File","Line"'
    );
    expect(csv[1]).toBe(`"Sub","labels",,"$8010",600,${Math.round((100000 * 600) / flat.denominator) / 1000},4,8,150,,8,"game.asm",20`);
    const evil = rollupFlat(BYTES, buildRoutineMap({ ...{ compilation: { ...compilation, symbols: { e: label("=cmd", 0x8010, 1) } } as unknown as KliveCompilerOutput }, layout, offsetOf: (p, a) => profileOffsetOf(layout, p, a) }), INFO);
    expect(toFlatCsv(evil, { timeUnit: "T-states" })).toContain(`"'=cmd"`);
    const addresses = toAddressCsv(rollupAddresses(BYTES, map, layout, flat.denominator), { timeUnit: "T-states" }).split("\r\n");
    expect(addresses[1]).toBe(`,"$8010","Sub",0,4,400,${Math.round((100000 * 400) / flat.denominator) / 1000},`);
  });

  it("writes callgrind that a reader can follow: every cfn is a fn, the costs add up", () => {
    const graph = buildCallGraph(EDGES, map, { timeTotal: GRAPH_TOTAL });
    const text = toCallgrind(graph, rollupFlat(BYTES, map, INFO), { name: "game", timeUnit: "T-states", total: GRAPH_TOTAL });
    const parsed = readCallgrind(text);
    expect(parsed.header.events).toBe("Ticks");
    expect(parsed.header.summary).toBe(String(GRAPH_TOTAL));
    for (const callee of parsed.calledNames) expect(parsed.functions.has(callee)).toBe(true);
    // --- Every tick is some function's own, once
    const self = [...parsed.functions.values()].reduce((t, f) => t + f.self, 0);
    expect(self).toBe(GRAPH_TOTAL);
    expect(parsed.functions.get("Main")).toMatchObject({ self: 200, file: "game.asm", calls: [{ to: "Sub", count: 4, cost: 600 }] });
    expect(parsed.functions.get("Sub")!.calls).toEqual([
      { to: "Sub2", count: 4, cost: 100 },
      { to: "Sub", count: 2, cost: 0 }
    ]);
    expect(parsed.functions.get("IM 1 handler at $0038")).toMatchObject({ self: 0, calls: [{ to: "$0000-$00FF", count: 2, cost: 150 }] });
  });

  it("writes the flat profile as callgrind when there is no call graph", () => {
    const parsed = readCallgrind(toCallgrind(undefined, rollupFlat(BYTES, map, INFO), { name: "game", timeUnit: "T-states", total: 1 }));
    expect(parsed.functions.get("Sub")).toMatchObject({ self: 600, calls: [] });
    expect(parsed.calledNames.size).toBe(0);
  });

  it("writes speedscope's sampled profile, weights adding up to the total", () => {
    const graph = buildCallGraph(EDGES, map, { timeTotal: GRAPH_TOTAL });
    const file = toSpeedscope(graph, { name: "game", timeUnit: "T-states", total: GRAPH_TOTAL });
    expect(file.$schema).toBe("https://www.speedscope.app/file-format-schema.json");
    expect(file.exporter).toBe("Klive IDE");
    const [profile] = file.profiles;
    expect(profile.type).toBe("sampled");
    expect(profile.unit).toBe("none");
    expect(profile.samples).toHaveLength(profile.weights.length);
    for (const stack of profile.samples) {
      expect(stack.length).toBeGreaterThan(0);
      for (const index of stack) expect(index).toBeLessThan(file.shared.frames.length);
    }
    const sum = profile.weights.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(GRAPH_TOTAL, 6);
    expect(profile.endValue).toBeCloseTo(sum, 6);
    // --- The stack root -> Main -> Sub -> Sub2 carries Sub2's time
    const names = (stack: number[]) => stack.map((i) => file.shared.frames[i].name).join(" > ");
    const deepest = profile.samples.map(names);
    expect(deepest).toContain(`${ROOT_NODE_NAME} > Main > Sub > Sub2`);
    expect(profile.weights[deepest.indexOf(`${ROOT_NODE_NAME} > Main > Sub > Sub2`)]).toBeCloseTo(100, 6);
    expect(file.shared.frames.find((f) => f.name === "Main")).toEqual({ name: "Main", file: "game.asm", line: 10 });
  });
});

/** A minimal callgrind reader: functions with their self cost and calls, as KCachegrind reads them */
function readCallgrind(text: string) {
  type Fn = { file?: string; self: number; calls: { to: string; count: number; cost: number }[] };
  const header: Record<string, string> = {};
  const functions = new Map<string, Fn>();
  const calledNames = new Set<string>();
  let file: string | undefined;
  let current: Fn | undefined;
  let pendingCall: { to: string; count: number } | undefined;
  let cfn: string | undefined;
  for (const line of text.split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv && !current) {
      header[kv[1]] = kv[2];
      continue;
    }
    if (line.startsWith("fl=")) file = line.slice(3);
    else if (line.startsWith("fn=")) {
      const name = line.slice(3);
      current = functions.get(name) ?? { file, self: 0, calls: [] };
      functions.set(name, current);
    } else if (line.startsWith("cfl=")) continue;
    else if (line.startsWith("cfn=")) cfn = line.slice(4);
    else if (line.startsWith("calls=")) {
      pendingCall = { to: cfn!, count: Number(line.slice(6).split(" ")[0]) };
      calledNames.add(cfn!);
    } else {
      const [, cost] = line.split(" ").map(Number);
      if (pendingCall) {
        current!.calls.push({ ...pendingCall, cost });
        pendingCall = undefined;
      } else {
        current!.self += cost;
      }
    }
  }
  return { header, functions, calledNames };
}
