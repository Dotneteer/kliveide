import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ProfileCommand,
  ProfileStartCommand,
  ProfileStopCommand,
  ShowProfilerCommand,
  profileStatusLines,
  resolveProfileAddress
} from "@renderer/appIde/commands/ProfileCommands";
import { createMockContext, createMockEmuApi, createMockMainApi, createMockStore } from "./test-helpers/mock-context";
import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import type { KliveCompilerOutput } from "@abstractions/CompilerInfo";
import {
  PF_CODE,
  PF_EXECUTED,
  PF_HALT,
  PROFILE_KEY_ROOT,
  type ProfileEdge,
  type ProfileStatus
} from "@common/profile/profileTypes";
import { PROFILER_PANEL_ID } from "@common/state/common-ids";

/*
 * The profiler's commands (`.plans/PROFILER_PLAN.md` D16, Phase 4) against a faked Emu API: the
 * gates, start with its window markers resolved from labels, stop, status, `top` and the exports.
 */

function status(over: Partial<ProfileStatus> = {}): ProfileStatus {
  return {
    machineId: "sp48",
    enabled: false,
    counters: true,
    muted: false,
    flagBytes: 0x10000,
    poolPages: 8,
    pagesUsed: 2,
    pagesDropped: 0,
    firstDroppedPage: -1,
    timeIntAck: 50,
    timeNmiAck: 0,
    timeDma: 0,
    timeSnooze: 0,
    timeHalt: 400,
    timeTotal: 1000,
    instructions: 42,
    generation: 3,
    timeUnit: "T-states",
    abandonedInstructions: 0,
    callsOn: true,
    depth: 0,
    stackResyncs: 0,
    depthOverflows: 0,
    edgesDropped: 0,
    edgesUsed: 2,
    edgeCapacity: 16384,
    calls: 5,
    interrupts: 0,
    armedStart: -1,
    armedStop: -1,
    windowClosed: 0,
    frameTicks: 500,
    clockHz: 3_500_000,
    ...over
  };
}

const COMPILATION = {
  sourceFileList: [{ filename: "/proj/main.kz80.asm", includes: [] }],
  segments: [{ startAddress: 0x8000, emittedCode: new Array(0x20).fill(0) }],
  listFileItems: [],
  sourceMap: {},
  errors: [],
  procedures: [],
  symbols: {
    mainloop: { name: "mainloop", type: 1, value: { _value: 0x8000 }, definitionFileIndex: 0, definitionLine: 3 },
    draw: { name: "draw", type: 1, value: { _value: 0x8010 }, definitionFileIndex: 0, definitionLine: 9 },
    wait: { name: "wait", type: 1, value: { _value: 0x8018 }, definitionFileIndex: 0, definitionLine: 12 },
    port: { name: "port", type: 3, value: { _value: 0xfe } }
  }
};

const EDGES: ProfileEdge[] = [
  { caller: PROFILE_KEY_ROOT, callee: 0x8000, calleeAddress: 0x8000, kind: "call", calls: 1, inclusive: 550, exclusive: 150 },
  { caller: 0x8000, callee: 0x8010, calleeAddress: 0x8010, kind: "call", calls: 4, inclusive: 400, exclusive: 400 }
];

function makeContext(options: { advanced?: boolean; machineId?: string; edges?: boolean } = {}): IdeCommandContext {
  const emuApi = {
    ...createMockEmuApi(),
    getProfileStatus: vi.fn().mockResolvedValue(status()),
    startProfiling: vi.fn().mockImplementation(async () => status({ enabled: true, timeTotal: 0 })),
    stopProfiling: vi.fn().mockResolvedValue(status()),
    resetProfile: vi.fn().mockResolvedValue(undefined),
    getProfileTouched: vi.fn().mockResolvedValue({
      info: status(),
      bytes: [
        { offset: 0x8000, flags: PF_EXECUTED | PF_CODE, exec: 1, time: 150 },
        { offset: 0x8010, flags: PF_EXECUTED | PF_CODE, exec: 4, time: 400 },
        { offset: 0x8018, flags: PF_EXECUTED | PF_CODE | PF_HALT, exec: 2, time: 400 }
      ]
    }),
    getProfileEdges: vi.fn().mockResolvedValue(options.edges === false ? undefined : { info: status(), edges: EDGES }),
    getProfileSlotOffsets: vi.fn().mockResolvedValue([0, 0x2000, 0x4000, 0x6000, 0x8000, 0xa000, 0xc000, 0xe000]),
    getPartitionLabels: vi.fn().mockResolvedValue({})
  };
  if (options.edges === false) {
    emuApi.getProfileStatus.mockResolvedValue(status({ callsOn: false, calls: 0 }));
  }
  const store = createMockStore({
    emulatorState: { machineId: options.machineId ?? "sp48", advancedDebugging: options.advanced ?? true } as never,
    compilation: { result: COMPILATION } as never,
    project: { folderPath: "/proj", buildRoots: ["main.kz80.asm"] } as never
  });
  const ctx = createMockContext({
    emuApi,
    store,
    mainApi: { ...createMockMainApi(), saveTextFile: vi.fn(), readBinaryFile: vi.fn().mockRejectedValue(new Error("no")) }
  });
  (ctx.service.machineService.getMachineInfo as ReturnType<typeof vi.fn>).mockReturnValue({
    machine: { machineId: options.machineId ?? "sp48" }
  });
  return ctx;
}

function written(ctx: IdeCommandContext): string {
  return (ctx.output.writeLine as ReturnType<typeof vi.fn>).mock.calls.map((c) => String(c[0] ?? "")).join("\n");
}

describe("profile commands", () => {
  let ctx: IdeCommandContext;
  beforeEach(() => {
    ctx = makeContext();
  });

  it("are refused with advanced debugging off, or on a machine that does not profile", async () => {
    let result = await new ProfileCommand().execute(makeContext({ advanced: false }), { action: "start" });
    expect(result.success).toBe(false);
    expect(result.finalMessage).toContain("advanced debugging");
    result = await new ProfileCommand().execute(makeContext({ machineId: "c64" }), { action: "status" });
    expect(result.finalMessage).toContain("does not keep a profile");
  });

  it("starts a window with the call graph and markers from labels or numbers (D2)", async () => {
    const result = await new ProfileCommand().execute(ctx, { action: "start", "-calls": true, "-at": "MainLoop", "-until": "$8010" });
    expect(result.success).toBe(true);
    expect(ctx.emuApi.startProfiling).toHaveBeenCalledWith({ calls: true, at: 0x8000, until: 0x8010 });
    expect(written(ctx)).toContain("with the call graph, counting from $8000, stopping at $8010 after that");
    await new ProfileStartCommand().execute(ctx, {});
    expect(ctx.emuApi.startProfiling).toHaveBeenLastCalledWith({ calls: false, at: undefined, until: undefined });
  });

  it("refuses a marker it cannot resolve", async () => {
    const result = await new ProfileCommand().execute(ctx, { action: "start", "-at": "NoSuchLabel" });
    expect(result.success).toBe(false);
    expect(result.finalMessage).toContain("NoSuchLabel");
    expect(ctx.emuApi.startProfiling).not.toHaveBeenCalled();
  });

  it("resolves addresses in every notation, labels and constants", () => {
    const c = COMPILATION as unknown as KliveCompilerOutput;
    expect(["$8000", "#8000", "0x8000", "8000h", "32768", "%1000000000000000"].map((t) => resolveProfileAddress(t, c))).toEqual(
      new Array(6).fill(0x8000)
    );
    expect(resolveProfileAddress("Draw", c)).toBe(0x8010);
    expect(resolveProfileAddress("port", c)).toBe(0xfe);
    expect(resolveProfileAddress("$10000", c)).toBeUndefined();
  });

  it("stops and resets, with the short aliases", async () => {
    await new ProfileStopCommand().execute(ctx);
    expect(ctx.emuApi.stopProfiling).toHaveBeenCalled();
    expect(written(ctx)).toContain("Profiling stopped: 1,000 T");
    await new ProfileCommand().execute(ctx, { action: "reset" });
    expect(ctx.emuApi.resetProfile).toHaveBeenCalled();
    expect(new ProfileCommand().aliases).toEqual(["prof"]);
    expect(new ProfileStartCommand().aliases).toEqual(["pst"]);
    expect(new ProfileStopCommand().aliases).toEqual(["psp"]);
  });

  it("validates the actions and their options", async () => {
    const cmd = new ProfileCommand();
    expect(await cmd.validateCommandArgs(ctx, { action: "bogus" })).toHaveLength(1);
    expect(await cmd.validateCommandArgs(ctx, { action: "top", arg: "0" })).toHaveLength(1);
    expect(await cmd.validateCommandArgs(ctx, { action: "top", arg: "5", "-by": "inclusive" })).toHaveLength(0);
    expect(await cmd.validateCommandArgs(ctx, { action: "top", "-by": "size" })).toHaveLength(1);
    expect(await cmd.validateCommandArgs(ctx, { action: "export" })).toHaveLength(1);
    expect(await cmd.validateCommandArgs(ctx, { action: "export", arg: "x.bin" })).toHaveLength(1);
    expect(await cmd.validateCommandArgs(ctx, { action: "export", arg: "x.bin", "-format": "fuse" })).toHaveLength(0);
    expect(await cmd.validateCommandArgs(ctx, { action: "stop", "-calls": true })).toHaveLength(1);
  });

  it("prints the window, the frames and the call tracker in `profile status`", async () => {
    (ctx.emuApi.getProfileStatus as ReturnType<typeof vi.fn>).mockResolvedValue(
      status({ enabled: true, armedStart: 0x8000, armedStop: 0x8000, stackResyncs: 2, depth: 3 })
    );
    await new ProfileCommand().execute(ctx, { action: "status" });
    const out = written(ctx);
    expect(out).toContain("Profiling is on, armed: counting starts at $8000, stops at $8000 (with the call graph)");
    expect(out).toContain("Measured: 1,000 T (286 µs), 42 instructions");
    expect(out).toContain("Frames: 2.00 (500 T-states each)");
    expect(out).toContain("Call graph: 5 calls, 0 interrupts, 2 caller/callee pairs, 3 open");
    expect(out).toContain("2 stack switches rebuilt the call stack");
  });

  it("prints the top routines by self, inclusive time or calls", async () => {
    await new ProfileCommand().execute(ctx, { action: "top", arg: "3" });
    let lines = written(ctx).split("\n");
    expect(lines[0]).toBe("Routines from labels (Klive asm)");
    expect(lines[1]).toMatch(/^Routine\s+Self \(T\)\s+Self %\s+Incl\. \(T\)\s+Calls$/);
    expect(lines[2]).toMatch(/^draw\s+400\s+66\.7%\s+400\s+4$/);
    expect(lines[3]).toMatch(/^mainloop\s+150\s+25\.0%\s+550\s+1$/);
    // --- The HALT in Wait is waiting: hidden, and out of the denominator (D4)
    expect(lines.some((l) => l.startsWith("wait"))).toBe(false);
    ctx = makeContext();
    await new ProfileCommand().execute(ctx, { action: "top", "-by": "inclusive" });
    lines = written(ctx).split("\n");
    expect(lines[2]).toMatch(/^mainloop/);
  });

  it("asks for the call graph where it needs it", async () => {
    ctx = makeContext({ edges: false });
    const top = await new ProfileCommand().execute(ctx, { action: "top", "-by": "inclusive" });
    expect(top.finalMessage).toContain("profile start -calls");
    const exported = await new ProfileCommand().execute(ctx, { action: "export", arg: "/tmp/out.json" });
    expect(exported.success).toBe(false);
    expect(exported.finalMessage).toContain("call graph");
  });

  it("exports every format by its file name", async () => {
    const save = ctx.mainApi.saveTextFile as ReturnType<typeof vi.fn>;
    await new ProfileCommand().execute(ctx, { action: "export", arg: "/tmp/game.prof" });
    expect(save).toHaveBeenLastCalledWith("/tmp/game.prof", "0x8000,150\n0x8010,400\n0x8018,400\n");
    await new ProfileCommand().execute(ctx, { action: "export", arg: "/tmp/callgrind.out.1" });
    expect(save.mock.lastCall![1]).toContain("cmd: main.kz80.asm");
    expect(save.mock.lastCall![1]).toContain("fn=draw");
    await new ProfileCommand().execute(ctx, { action: "export", arg: "/tmp/game.json" });
    expect(JSON.parse(save.mock.lastCall![1]).profiles[0].type).toBe("sampled");
    await new ProfileCommand().execute(ctx, { action: "export", arg: "/tmp/top.csv", "-addresses": true });
    expect(save.mock.lastCall![1]).toMatch(/^"Partition","Address","Routine"/);
    expect(written(ctx)).toContain("Exported the profile (csv, 1,000 T (286 µs)) to /tmp/top.csv");
  });

  it("will not replace a file without -f", async () => {
    ctx.mainApi.readBinaryFile = vi.fn().mockResolvedValue(new Uint8Array(1));
    const result = await new ProfileCommand().execute(ctx, { action: "export", arg: "/tmp/game.prof" });
    expect(result.finalMessage).toContain("use -f");
  });

  it("opens the Profiler document", async () => {
    const hub = ctx.service.projectService.getActiveDocumentHubService();
    (hub.isOpen as ReturnType<typeof vi.fn>)?.mockReturnValue?.(false);
    await new ShowProfilerCommand().execute(ctx);
    expect(hub.openDocument).toHaveBeenCalledWith(expect.objectContaining({ id: PROFILER_PANEL_ID, type: "Profiler" }), undefined, false);
  });

  it("formats the status of an idle profile", () => {
    expect(profileStatusLines(status({ callsOn: false, calls: 0, edgesUsed: 0, timeTotal: 0, timeHalt: 0 }))).toEqual([
      "Profiling is off",
      "Measured: 0 T (0.0 µs), 42 instructions"
    ]);
  });
});
