import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CoverageCommand,
  CoverageResetCommand,
  MemoryHeatCommand,
  coverageFormatOfName,
  coverageStatusLines,
  lcovFilesOf
} from "@renderer/appIde/commands/CoverageCommands";
import { createMockContext, createMockEmuApi, createMockMainApi, createMockStore } from "./test-helpers/mock-context";
import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import type { ProfileStatus } from "@common/profile/profileTypes";
import { PF_CODE, PF_EXECUTED, PF_SELF_MODIFIED, PF_WRITTEN } from "@common/profile/profileTypes";
import { parseKcov, parseLcov } from "@common/profile/coverageExport";
import { sp48ProfileLayout } from "@common/profile/layouts/sp48";

/*
 * The coverage commands (`.plans/CODE_COVERAGE_AND_HEAT_MAP_PLAN.md` D15, D16, Phase 3) against a
 * faked Emu API: the gates, the switch, the status (pool use and dropped pages, T6), the exports and
 * the SMC report.
 */

function status(over: Partial<ProfileStatus> = {}): ProfileStatus {
  return {
    machineId: "sp48",
    enabled: true,
    counters: true,
    muted: false,
    flagBytes: 0x10000,
    poolPages: 8,
    pagesUsed: 2,
    pagesDropped: 0,
    firstDroppedPage: -1,
    timeIntAck: 100,
    timeNmiAck: 0,
    timeDma: 0,
    timeSnooze: 0,
    timeHalt: 400,
    timeTotal: 1000,
    instructions: 42,
    generation: 3,
    timeUnit: "T-states",
    abandonedInstructions: 0,
    ...over
  };
}

/** A compilation of three lines at $8000: two instructions that ran, one that did not */
const COMPILATION = {
  sourceFileList: [{ filename: "/proj/code/main.kz80.asm", includes: [] }],
  segments: [{ startAddress: 0x8000, emittedCode: [0x3e, 0x01, 0xc9, 0x00] }],
  listFileItems: [
    { fileIndex: 0, address: 0x8000, lineNumber: 2, segmentIndex: 0, codeStartIndex: 0, codeLength: 2 },
    { fileIndex: 0, address: 0x8002, lineNumber: 3, segmentIndex: 0, codeStartIndex: 2, codeLength: 1 },
    { fileIndex: 0, address: 0x8003, lineNumber: 5, segmentIndex: 0, codeStartIndex: 3, codeLength: 1 }
  ],
  sourceMap: {},
  errors: [],
  symbols: {
    Main: { name: "Main", type: 1, value: { _value: 0x8000 } },
    Patch: { name: "Patch", type: 1, value: { _value: 0x8003 } }
  }
};

function makeContext(options: { advanced?: boolean; machineId?: string } = {}): IdeCommandContext {
  const emuApi = {
    ...createMockEmuApi(),
    getProfileStatus: vi.fn().mockResolvedValue(status()),
    setProfiling: vi.fn().mockImplementation(async (enabled: boolean, counters?: boolean) =>
      status({ enabled, counters: counters ?? true })
    ),
    resetProfile: vi.fn().mockResolvedValue(undefined),
    getProfileSample: vi.fn().mockImplementation(async (addresses: number[], _p: unknown, withCounts?: boolean) => ({
      info: status(),
      flags: Uint8Array.from(addresses.map((a) => (a === 0x8003 ? 0 : PF_EXECUTED | PF_CODE))),
      exec: withCounts ? Uint32Array.from(addresses.map((a) => (a === 0x8003 ? 0 : 7))) : undefined
    })),
    getProfileTouched: vi.fn().mockImplementation(async (mask?: number) => {
      const bytes = [
        { offset: 0x8000, flags: PF_EXECUTED | PF_CODE, exec: 7, read: 0, write: 0, time: 49 },
        { offset: 0x8003, flags: PF_WRITTEN | PF_CODE | PF_SELF_MODIFIED, exec: 0, read: 0, write: 2, time: 0 },
        { offset: 0x8004, flags: PF_WRITTEN | PF_CODE | PF_SELF_MODIFIED, exec: 0, read: 0, write: 1, time: 0 }
      ];
      return { info: status(), bytes: mask === undefined ? bytes : bytes.filter((b) => b.flags & mask) };
    }),
    mergeProfile: vi.fn().mockResolvedValue(status())
  };
  const store = createMockStore({
    emulatorState: { machineId: options.machineId ?? "sp48", advancedDebugging: options.advanced ?? true } as never,
    compilation: { result: COMPILATION } as never,
    project: { folderPath: "/proj" } as never
  });
  const ctx = createMockContext({ emuApi, store, mainApi: { ...createMockMainApi(), saveTextFile: vi.fn(), readTextFile: vi.fn(), readBinaryFile: vi.fn().mockRejectedValue(new Error("no")) } });
  (ctx.service.machineService.getMachineInfo as ReturnType<typeof vi.fn>).mockReturnValue({
    machine: { machineId: options.machineId ?? "sp48" }
  });
  return ctx;
}

function written(ctx: IdeCommandContext): string {
  return (ctx.output.writeLine as ReturnType<typeof vi.fn>).mock.calls.map((c) => String(c[0] ?? "")).join("\n");
}

describe("coverage commands", () => {
  let ctx: IdeCommandContext;
  beforeEach(() => {
    ctx = makeContext();
  });

  it("are refused with advanced debugging off", async () => {
    ctx = makeContext({ advanced: false });
    const result = await new CoverageCommand().execute(ctx, { action: "on" });
    expect(result.success).toBe(false);
    expect(result.finalMessage).toContain("advanced debugging");
  });

  it("are refused on a machine whose core does not profile", async () => {
    ctx = makeContext({ machineId: "c64" });
    const result = await new CoverageCommand().execute(ctx, { action: "status" });
    expect(result.success).toBe(false);
    expect(result.finalMessage).toContain("does not keep code coverage");
  });

  it("turns coverage on with counters, or flags only", async () => {
    await new CoverageCommand().execute(ctx, { action: "on" });
    expect(ctx.emuApi.setProfiling).toHaveBeenCalledWith(true, undefined);
    await new CoverageCommand().execute(ctx, { action: "on", "-nocounts": true });
    expect(ctx.emuApi.setProfiling).toHaveBeenLastCalledWith(true, false);
    expect(written(ctx)).toContain("flags only");
  });

  it("resets through `coverage reset` and `covr`", async () => {
    await new CoverageCommand().execute(ctx, { action: "reset" });
    await new CoverageResetCommand().execute(ctx);
    expect(ctx.emuApi.resetProfile).toHaveBeenCalledTimes(2);
    expect(new CoverageResetCommand().aliases).toEqual(["covr"]);
    expect(new CoverageCommand().aliases).toEqual(["cov"]);
  });

  it("reports pool use, dropped pages and source coverage in `coverage status`", async () => {
    (ctx.emuApi.getProfileStatus as ReturnType<typeof vi.fn>).mockResolvedValue(
      status({ pagesUsed: 64, poolPages: 64, pagesDropped: 3, firstDroppedPage: 200, abandonedInstructions: 1234 })
    );
    await new CoverageCommand().execute(ctx, { action: "status" });
    const out = written(ctx);
    expect(out).toContain("64 of 64 8K pages used");
    expect(out).toContain("3 pages found the pool full");
    expect(out).toContain("physical page 200");
    expect(out).toContain("1,234 instructions from an abandoned future");
    expect(out).toContain("Source: 2 of 3 lines covered (66.7%)");
  });

  it("validates the action and the export format", async () => {
    const cmd = new CoverageCommand();
    expect(await cmd.validateCommandArgs(ctx, { action: "bogus" })).toHaveLength(1);
    expect(await cmd.validateCommandArgs(ctx, { action: "export" })).toHaveLength(1);
    expect(await cmd.validateCommandArgs(ctx, { action: "export", file: "out.txt" })).toHaveLength(1);
    expect(await cmd.validateCommandArgs(ctx, { action: "export", file: "out.info" })).toHaveLength(0);
    expect(await cmd.validateCommandArgs(ctx, { action: "export", file: "out.txt", "-format": "csv" })).toHaveLength(0);
  });

  it("exports LCOV with project-relative paths and hit counts", async () => {
    const result = await new CoverageCommand().execute(ctx, { action: "export", file: "/out/cov.info" });
    expect(result.success).toBe(true);
    const [path, text] = (ctx.mainApi.saveTextFile as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(path).toBe("/out/cov.info");
    const [record] = parseLcov(text);
    expect(record.path).toBe("code/main.kz80.asm");
    expect([...record.lines]).toEqual([
      [2, 7],
      [3, 7],
      [5, 0]
    ]);
    expect(record.found).toBe(3);
    expect(record.hit).toBe(2);
  });

  it("exports CSV and .kcov, and loads a .kcov back", async () => {
    await new CoverageCommand().execute(ctx, { action: "export", file: "cov.csv" });
    const csv = (ctx.mainApi.saveTextFile as ReturnType<typeof vi.fn>).mock.calls[0][1] as string;
    expect(csv.split("\n")[0]).toBe("offset,partition,address,flags,exec,read,write,time");
    expect(csv).toContain("008000,,8000,EC----,7,0,0,49");

    await new CoverageCommand().execute(ctx, { action: "export", file: "cov.kcov" });
    const kcov = (ctx.mainApi.saveTextFile as ReturnType<typeof vi.fn>).mock.calls[1][1] as string;
    const run = parseKcov(kcov, sp48ProfileLayout);
    expect(typeof run).not.toBe("string");

    (ctx.mainApi.readTextFile as ReturnType<typeof vi.fn>).mockResolvedValue(kcov);
    const loaded = await new CoverageCommand().execute(ctx, { action: "load", file: "cov.kcov" });
    expect(loaded.success).toBe(true);
    expect(ctx.emuApi.mergeProfile).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ offset: 0x8000, exec: 7 })]),
      { instructions: 42, timeTotal: 1000 }
    );
  });

  it("refuses to overwrite an existing file without -f", async () => {
    (ctx.mainApi.readBinaryFile as ReturnType<typeof vi.fn>).mockResolvedValue(new Uint8Array(1));
    const result = await new CoverageCommand().execute(ctx, { action: "export", file: "cov.info" });
    expect(result.success).toBe(false);
    expect(result.finalMessage).toContain("-f");
  });

  it("lists self-modified runs with their nearest label and counts", async () => {
    await new CoverageCommand().execute(ctx, { action: "smc" });
    const out = written(ctx);
    expect(out).toContain("1 self-modified run");
    expect(out).toContain("$8003, 2 bytes Patch (written 3, executed 0)");
  });

  it("sets the memory view's heat mode", async () => {
    const cmd = new MemoryHeatCommand();
    expect(await cmd.validateCommandArgs(ctx, { mode: "warm" })).toHaveLength(1);
    await cmd.execute(ctx, { mode: "read" });
    expect(ctx.store.dispatch).toHaveBeenCalledWith({ type: "SET_MEMORY_HEAT_MODE", payload: { text: "read" } });
  });
});

describe("coverage command helpers", () => {
  it("pick the format by the file's extension", () => {
    expect(coverageFormatOfName("a.info")).toBe("lcov");
    expect(coverageFormatOfName("a.LCOV")).toBe("lcov");
    expect(coverageFormatOfName("a.csv")).toBe("csv");
    expect(coverageFormatOfName("a.kcov")).toBe("kcov");
    expect(coverageFormatOfName("a.txt")).toBeUndefined();
  });

  it("say when a replay mutes the counting and break the time down", () => {
    const lines = coverageStatusLines(status({ muted: true, timeDma: 250 }));
    expect(lines[0]).toContain("a replay is running");
    expect(lines.find((l) => l.startsWith("Time:"))).toBe("Time: total 1,000 T-states, HALT 40.0%, INT ack 10.0%, DMA 25.0%");
  });

  it("name LCOV files relative to the project, Windows paths included", () => {
    const files = lcovFilesOf(
      new Map([["C:\\proj\\a.asm", new Map([[1, { state: "covered" }]])]]),
      "C:\\proj"
    );
    expect(files).toEqual([{ path: "a.asm", lines: [{ line: 1, hits: 1 }] }]);
  });
});
