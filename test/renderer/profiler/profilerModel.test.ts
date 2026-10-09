import { describe, expect, it, vi } from "vitest";
import type { KliveCompilerOutput } from "@abstractions/CompilerInfo";
import { sp128ProfileLayout } from "@common/profile/layouts/sp128";
import { sp48ProfileLayout } from "@common/profile/layouts/sp48";
import {
  PF_CODE,
  PF_EXECUTED,
  PROFILE_KEY_INT,
  PROFILE_KEY_ROOT,
  type ProfileEdge,
  type ProfileStatus
} from "@common/profile/profileTypes";
import {
  buildProfilerModel,
  cpuAddressResolver,
  flattenCallTree,
  formatTime,
  formatWallTime,
  offsetResolver,
  profileHeaderFacts,
  profilerEmptyMessage,
  readProfileSnapshot,
  type ProfileSnapshot
} from "@renderer/features/profiler/profilerModel";
import { routineInlays } from "@renderer/features/profiler/profilerInlays";

/*
 * The Profiler document's model (`.plans/PROFILER_PLAN.md` D5, D10, D14, Phase 4): the snapshot
 * read, offsets through the current paging, the header's facts, the empty states and the Call tree's
 * visible rows.
 */

function status(over: Partial<ProfileStatus> = {}): ProfileStatus {
  return {
    machineId: "sp48",
    enabled: false,
    counters: true,
    muted: false,
    flagBytes: 0x10000,
    poolPages: 8,
    pagesUsed: 1,
    pagesDropped: 0,
    firstDroppedPage: -1,
    timeIntAck: 0,
    timeNmiAck: 0,
    timeDma: 0,
    timeSnooze: 0,
    timeHalt: 0,
    timeTotal: 1000,
    instructions: 10,
    generation: 1,
    timeUnit: "T-states",
    abandonedInstructions: 0,
    callsOn: true,
    depth: 0,
    stackResyncs: 0,
    depthOverflows: 0,
    edgesDropped: 0,
    edgesUsed: 3,
    edgeCapacity: 16384,
    calls: 3,
    interrupts: 1,
    armedStart: -1,
    armedStop: -1,
    windowClosed: 0,
    frameTicks: 250,
    clockHz: 3_500_000,
    ...over
  };
}

const EDGES: ProfileEdge[] = [
  { caller: PROFILE_KEY_ROOT, callee: 0x8000, calleeAddress: 0x8000, kind: "call", calls: 1, inclusive: 900, exclusive: 300 },
  { caller: 0x8000, callee: 0x8010, calleeAddress: 0x8010, kind: "call", calls: 2, inclusive: 600, exclusive: 600 },
  { caller: PROFILE_KEY_INT, callee: 0x0038, calleeAddress: 0x0038, kind: "int", calls: 1, inclusive: 100, exclusive: 100 }
];

const COMPILATION = {
  procedures: [],
  sourceFileList: [{ filename: "/p/m.asm" }],
  segments: [{ startAddress: 0x8000, emittedCode: new Array(0x20).fill(0) }],
  listFileItems: [],
  symbols: {
    main: { name: "Main", type: 1, value: { _value: 0x8000 }, definitionFileIndex: 0, definitionLine: 4 },
    draw: { name: "Draw", type: 1, value: { _value: 0x8010 }, definitionFileIndex: 0, definitionLine: 9 }
  }
} as unknown as KliveCompilerOutput;

function snapshot(over: Partial<ProfileSnapshot> = {}): ProfileSnapshot {
  return {
    status: status(),
    bytes: [
      { offset: 0x8000, flags: PF_EXECUTED | PF_CODE, exec: 1, time: 300 },
      { offset: 0x8010, flags: PF_EXECUTED | PF_CODE, exec: 2, time: 600 },
      { offset: 0x0038, flags: PF_EXECUTED | PF_CODE, exec: 1, time: 100 }
    ],
    edges: EDGES,
    slotOffsets: [0, 0x2000, 0x4000, 0x6000, 0x8000, 0xa000, 0xc000, 0xe000],
    partitionLabels: {},
    ...over
  };
}

describe("the profiler's snapshot", () => {
  it("reads the edges only when the call tracker ran", async () => {
    const api = {
      getProfileStatus: vi.fn().mockResolvedValue(status({ callsOn: false, calls: 0, interrupts: 0 })),
      getProfileTouched: vi.fn().mockResolvedValue({ info: status({ callsOn: false }), bytes: [] }),
      getProfileEdges: vi.fn(),
      getProfileSlotOffsets: vi.fn().mockResolvedValue([]),
      getPartitionLabels: vi.fn().mockResolvedValue({ 0: "0" })
    };
    const s = await readProfileSnapshot(api as never);
    expect(api.getProfileTouched).toHaveBeenCalledWith(PF_EXECUTED);
    expect(api.getProfileEdges).not.toHaveBeenCalled();
    expect(s).toMatchObject({ edges: [], partitionLabels: { 0: "0" } });
    api.getProfileStatus.mockResolvedValue(undefined);
    expect(await readProfileSnapshot(api as never)).toBeUndefined();
  });
});

describe("offsets through the paging", () => {
  // --- A 128K with bank 7 paged at $C000: slot 6 starts at bank 7's offset
  const slots = [0x40000, 0x42000, 5 * 0x4000, 5 * 0x4000 + 0x2000, 2 * 0x4000, 2 * 0x4000 + 0x2000, 7 * 0x4000, 7 * 0x4000 + 0x2000];

  it("places unbanked code in what is paged, banked code in its partition", () => {
    const offsetOf = offsetResolver(sp128ProfileLayout, slots);
    expect(offsetOf(undefined, 0xc010)).toBe(7 * 0x4000 + 0x10);
    expect(offsetOf(3, 0xc010)).toBe(3 * 0x4000 + 0x10);
    expect(offsetOf(undefined, 0x0038)).toBe(0x40038);
  });

  it("maps an offset back to the address it runs at, when it is paged in", () => {
    const addressOf = cpuAddressResolver(sp128ProfileLayout, slots);
    expect(addressOf(7 * 0x4000 + 0x2010)).toBe(0xe010);
    expect(addressOf(3 * 0x4000)).toBeUndefined();
    // --- A fixed map knows every address
    expect(cpuAddressResolver(sp48ProfileLayout, [])(0x8123)).toBe(0x8123);
  });
});

describe("the profiler's text", () => {
  it("formats time in the core's unit and as wall time (D5)", () => {
    expect(formatWallTime(3_500_000, 3_500_000)).toBe("1.00 s");
    expect(formatWallTime(70_000, 3_500_000)).toBe("20.00 ms");
    expect(formatWallTime(350, 3_500_000)).toBe("100 µs");
    expect(formatWallTime(7, 3_500_000)).toBe("2.0 µs");
    expect(formatWallTime(100)).toBeUndefined();
    expect(formatTime(69_888, status())).toBe("69,888 T (19.97 ms)");
    expect(formatTime(28, status({ timeUnit: "28 MHz ticks", clockHz: undefined }))).toBe("28 ticks");
  });

  it("states the window and warns when the call graph is approximate (D10)", () => {
    const model = buildProfilerModel(snapshot({ status: status({ stackResyncs: 3, depthOverflows: 1, edgesDropped: 9 }) }), COMPILATION)!;
    const facts = profileHeaderFacts(model);
    expect(facts.map((f) => f.text)).toEqual([
      "Stopped",
      "4.00 frames",
      "Total 1,000 T (286 µs)",
      "Routines from labels (Klive asm)",
      "3 stack switches",
      "1 calls too deep",
      "9 calls in (other)"
    ]);
    expect(facts.filter((f) => f.warning)).toHaveLength(3);
    expect(facts[4].title).toContain("rebuilt from the root");
  });

  it("says what to do when there is nothing to show", () => {
    expect(profilerEmptyMessage({ supported: false, switchedOff: true })).toContain("advanced debugging");
    expect(profilerEmptyMessage({ supported: false, switchedOff: false })).toContain("does not keep a profile");
    const idle = buildProfilerModel(snapshot({ status: status({ timeTotal: 0, instructions: 0 }), bytes: [] }), COMPILATION);
    expect(profilerEmptyMessage({ supported: true, switchedOff: false, model: idle })).toContain("Start Profiling");
    const armed = buildProfilerModel(
      snapshot({ status: status({ enabled: true, timeTotal: 0, instructions: 0, armedStart: 0x8000 }), bytes: [] }),
      COMPILATION
    );
    expect(profilerEmptyMessage({ supported: true, switchedOff: false, model: armed })).toBe(
      "Waiting for the program to reach $8000."
    );
    const full = buildProfilerModel(snapshot(), COMPILATION);
    expect(profilerEmptyMessage({ supported: true, switchedOff: false, model: full })).toBeUndefined();
  });
});

describe("the Call tree's rows", () => {
  const model = buildProfilerModel(snapshot(), COMPILATION)!;

  it("shows the roots collapsed, then a node's calls under it when expanded", () => {
    const graph = model.graph!;
    let rows = flattenCallTree(graph, new Set());
    expect(rows.map((r) => [r.node.name, r.depth, r.expandable, r.expanded])).toEqual([
      ["(entered before profiling)", 0, true, false],
      ["IM 1 handler at $0038", 0, false, false]
    ]);
    rows = flattenCallTree(graph, new Set([rows[0].pathKey]));
    expect(rows.map((r) => [r.node.name, r.depth])).toEqual([
      ["(entered before profiling)", 0],
      ["Main", 1],
      ["IM 1 handler at $0038", 0]
    ]);
    rows = flattenCallTree(graph, new Set([rows[0].pathKey, rows[1].pathKey]));
    expect(rows.map((r) => [r.node.name, r.depth, r.node.calls, r.node.inclusive])).toEqual([
      ["(entered before profiling)", 0, 1, 900],
      ["Main", 1, 1, 900],
      ["Draw", 2, 2, 600],
      ["IM 1 handler at $0038", 0, 1, 100]
    ]);
  });

  it("stops at recursion and at the row limit", () => {
    const recursive = buildProfilerModel(
      snapshot({
        edges: [
          ...EDGES,
          { caller: 0x8010, callee: 0x8010, calleeAddress: 0x8010, kind: "call", calls: 5, inclusive: 0, exclusive: 50 }
        ]
      }),
      COMPILATION
    )!;
    const graph = recursive.graph!;
    const top = flattenCallTree(graph, new Set());
    const main = flattenCallTree(graph, new Set([top[0].pathKey]))[1];
    const draw = flattenCallTree(graph, new Set([top[0].pathKey, main.pathKey]))[2];
    const rows = flattenCallTree(graph, new Set([top[0].pathKey, main.pathKey, draw.pathKey]));
    const again = rows.find((r) => r.depth === 3)!;
    expect(again.node).toMatchObject({ name: "Draw", recursive: true, calls: 5 });
    expect(again.expandable).toBe(false);
    expect(flattenCallTree(graph, new Set([top[0].pathKey, main.pathKey]), 2)).toHaveLength(2);
  });
});

describe("the editor's profile hints (D15)", () => {
  it("puts each routine's share and calls on its first line", () => {
    const model = buildProfilerModel(snapshot(), COMPILATION)!;
    expect([...routineInlays(model, "/p/m.asm")]).toEqual([
      [9, "60.0% · 2 calls"],
      [4, "30.0% · 1 call"]
    ]);
    // --- Windows paths compare without case; another file has no hints
    expect(routineInlays(model, "\\P\\M.ASM").size).toBe(2);
    expect(routineInlays(model, "/p/other.asm").size).toBe(0);
  });

  it("says nothing of a routine whose share rounds to 0.0%", () => {
    const model = buildProfilerModel(
      snapshot({
        bytes: [...snapshot().bytes, { offset: 0x9000, flags: PF_EXECUTED | PF_CODE, exec: 1, time: 10_000_000 }],
        status: status({ timeTotal: 10_001_000 })
      }),
      COMPILATION
    )!;
    expect(routineInlays(model, "/p/m.asm").size).toBe(0);
  });

  it("gives no count for a routine never called (jumped to)", () => {
    const model = buildProfilerModel(snapshot({ edges: EDGES.filter((e) => e.callee !== 0x8000) }), COMPILATION)!;
    expect(routineInlays(model, "/p/m.asm").get(4)).toBe("30.0%");
  });

  it("says entries rather than calls without a call graph", () => {
    const model = buildProfilerModel(snapshot({ edges: [] }), COMPILATION)!;
    expect(routineInlays(model, "/p/m.asm").get(9)).toBe("60.0% · 2 entries");
  });
});
