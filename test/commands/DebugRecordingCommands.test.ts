import { beforeEach, describe, expect, it, vi } from "vitest";

import { writeDebugRecording, type DebugRecording } from "@common/debugRecording/debugRecordingFile";
import type { DebugRecordingLoadResult } from "@common/debugRecording/debugRecordingTypes";
import {
  DebugRecordingLoadCommand,
  DebugRecordingSaveCommand,
  parseRecordingFrom,
  RECORDING_PRIVACY_NOTICE
} from "@renderer/appIde/commands/DebugRecordingCommands";
import { projectRelativePath } from "@renderer/appIde/commands/debugRecordingSources";
import { extractArguments, splitRawTail } from "@renderer/appIde/services/ide-commands";
import { parseCommand } from "@renderer/appIde/services/command-parser";
import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import { createMockContext } from "./test-helpers/mock-context";

/* `.plans/DEBUG_SESSION_RECORDING_PLAN.md` Phase 3: `drsave` and `drload` against faked APIs */

function recordingBytes(machineId = "sp48"): Promise<Uint8Array> {
  const r: DebugRecording = {
    header: {
      machineId,
      kliveVersion: "0.64.0",
      coreId: machineId,
      fingerprint: "f".repeat(32),
      codeHash: "c".repeat(64),
      contractHash: "a".repeat(64),
      memorySize: 4096,
      pageSize: 4096,
      savedAt: "",
      base: { sequence: 1, sub: 1, phase: 0 },
      present: { sequence: 9, sub: 1, phase: 0 },
      frames: 1,
      seconds: 0.02,
      records: 8,
      keyframes: 1,
      sparse: false,
      pc: 0x8000
    },
    pages: [new Uint8Array(4096)],
    keyframes: [{ seed: { position: { sequence: 1, sub: 1, phase: 0 } }, frame: 0, journalIndex: 0, complete: true, pages: Int32Array.from([0]) }],
    journal: [],
    hits: [],
    present: { host: {}, frames: 1 },
    media: []
  };
  return writeDebugRecording(r);
}

type Fake = { context: IdeCommandContext; files: Map<string, Uint8Array | string>; output: string[]; state: any };

function fake(machineId = "sp48", project?: { folderPath: string }): Fake {
  const files = new Map<string, Uint8Array | string>();
  const context = createMockContext();
  const state: any = {
    emulatorState: { machineId, advancedDebugging: true },
    compilation: { filename: "/p/code/main.asm", result: { sourceFileList: [{ filename: "/p/code/main.asm" }, { filename: "/p/code/lib.asm" }] } },
    watchExpressions: [{ symbol: "counter", type: "b" }],
    project: project ? { ...project, isKliveProject: true } : {}
  };
  (context.store.getState as any).mockImplementation(() => state);
  (context.store.dispatch as any).mockImplementation((action: any) => {
    if (action.type === "ADD_WATCH") state.watchExpressions = [...state.watchExpressions, action.payload?.watch ?? action.payload];
  });
  Object.assign(context.mainApi, {
    readBinaryFile: vi.fn(async (p: string) => {
      const f = files.get(p);
      if (!(f instanceof Uint8Array)) throw new Error("File does not exist");
      return f;
    }),
    readTextFile: vi.fn(async (p: string) => {
      const f = files.get(p);
      if (typeof f !== "string") throw new Error("File does not exist");
      return f;
    }),
    saveBinaryFile: vi.fn(async (p: string, data: Uint8Array) => {
      files.set(p, data);
      return p;
    }),
    getAppVersion: vi.fn(async () => "0.64.0"),
    getSdCardFingerprint: vi.fn(async () => ({ fileName: "ks2.cim", size: 1, fingerprint: "x" }))
  });
  const output: string[] = [];
  (context.output.writeLine as any).mockImplementation((t: string) => output.push(t));
  return { context, files, output, state };
}

function argsOf(command: DebugRecordingSaveCommand | DebugRecordingLoadCommand, line: string): any {
  const raw = command.argumentInfo.rawTailOption ? splitRawTail(line, command.argumentInfo.rawTailOption) : undefined;
  const parsed = extractArguments(parseCommand(raw ? raw.head : line).slice(1), command.argumentInfo);
  if (Array.isArray(parsed)) throw new Error(parsed.join("; "));
  if (raw) parsed[command.argumentInfo.rawTailOption!] = raw.tail;
  return parsed;
}

async function run(f: Fake, command: DebugRecordingSaveCommand | DebugRecordingLoadCommand, line: string) {
  const args = argsOf(command, line);
  const messages = await command.validateCommandArgs!(f.context, args);
  if (messages.length) return { success: false, finalMessage: messages[0].message };
  return command.execute(f.context, args);
}

describe("debug-recording-save", () => {
  let f: Fake;
  beforeEach(() => {
    f = fake();
    f.files.set("/p/code/main.asm", "  ld a,1\n");
    f.files.set("/p/code/lib.asm", "  ret\n");
    f.state.project = { folderPath: "/p", isKliveProject: true };
    (f.context.emuApi as any).saveDebugRecording = vi.fn(async () => ({
      bytes: new Uint8Array(1536 * 1024),
      machineName: "ZX Spectrum 48K",
      records: 1_234_567,
      frames: 618,
      seconds: 12.37,
      keyframes: 25,
      sectionSizes: {},
      fromPast: false,
      warnings: ["The state has no portable .szx part"]
    }));
  });

  it("has its id, alias and options; the note is the rest of the line", () => {
    const command = new DebugRecordingSaveCommand();
    expect(command).toMatchObject({ id: "debug-recording-save", aliases: ["drsave"] });
    expect(argsOf(command, 'drsave "bug 1.klr" -from #1234 -sparse -sources -f -note Crashes -when "x" == 1')).toEqual({
      file: "bug 1.klr",
      "-from": "#1234",
      "-sparse": true,
      "-sources": true,
      "-f": true,
      "-note": 'Crashes -when "x" == 1'
    });
  });

  it("saves through the emulator and writes the file, with the IDE's part", async () => {
    const result = await run(f, new DebugRecordingSaveCommand(), "drsave bug.klr -from -500 -sparse -note Spins");
    expect(result.success).toBe(true);
    expect(result.finalMessage).toBe(
      "Debug recording bug.klr saved (ZX Spectrum 48K): 12 s of machine time, 1,234,567 instructions, 25 keyframes, 1.5 MB."
    );
    expect(f.files.get("bug.klr")).toBeInstanceOf(Uint8Array);
    const options = (f.context.emuApi as any).saveDebugRecording.mock.calls[0][0];
    expect(options).toMatchObject({ kliveVersion: "0.64.0", from: { stepsBack: 500 }, sparse: true, note: "Spins" });
    expect(options.watches).toEqual([{ symbol: "counter", type: "b" }]);
    // --- The sources' identity, project-relative, without their text (D13)
    expect(options.sources.mainFile).toBe("code/main.asm");
    expect(options.sources.files.map((s: any) => s.path)).toEqual(["code/main.asm", "code/lib.asm"]);
    expect(options.sources.files[0].sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(options.sources.files[0].text).toBeUndefined();
    expect(f.output).toContain("Warning: The state has no portable .szx part");
    expect(f.output).toContain(RECORDING_PRIVACY_NOTICE);
  });

  it("embeds the sources with -sources, and asks the Next's SD card", async () => {
    f = Object.assign(fake("zxnext"), {});
    f.files.set("/p/code/main.asm", "  ld a,1\n");
    (f.context.emuApi as any).saveDebugRecording = vi.fn(async () => ({ bytes: new Uint8Array(10), machineName: "Next", records: 1, frames: 1, seconds: 1, keyframes: 1, sectionSizes: {}, fromPast: true, warnings: [] }));
    const result = await run(f, new DebugRecordingSaveCommand(), "drsave bug.klr -sources");
    expect(result.finalMessage).toMatch(/opens where the machine stands now, in the past/);
    const options = (f.context.emuApi as any).saveDebugRecording.mock.calls[0][0];
    expect(options.sdCard).toEqual({ fileName: "ks2.cim", size: 1, fingerprint: "x" });
    expect(options.sources.files).toEqual([{ path: "/p/code/main.asm", sha256: expect.any(String), text: "  ld a,1\n" }]);
  });

  it("checks the file, -from and the machine; does not replace a file without -f", async () => {
    expect((await run(f, new DebugRecordingSaveCommand(), "drsave bug.kls")).finalMessage).toMatch(/\.klr extension/);
    expect((await run(f, new DebugRecordingSaveCommand(), "drsave bug.klr -from abc")).finalMessage).toMatch(/-from: use a step back/);
    expect((await run(fake("c64"), new DebugRecordingSaveCommand(), "drsave bug.klr")).finalMessage).toMatch(/no reverse debugging/);
    f.files.set("bug.klr", new Uint8Array(1));
    expect((await run(f, new DebugRecordingSaveCommand(), "drsave bug.klr")).finalMessage).toBe("bug.klr already exists; use -f to replace it.");
  });

  it("reports what the emulator refuses", async () => {
    (f.context.emuApi as any).saveDebugRecording = vi.fn(async () => {
      throw new Error("Error: Start the machine with debugging; recordings come from reverse debugging");
    });
    expect((await run(f, new DebugRecordingSaveCommand(), "drsave bug.klr")).finalMessage).toBe(
      "Could not save the recording: Start the machine with debugging; recordings come from reverse debugging"
    );
  });
});

describe("debug-recording-load", () => {
  let f: Fake;
  const loaded = (over: Partial<DebugRecordingLoadResult> = {}): DebugRecordingLoadResult => ({
    machineId: "sp48",
    machineName: "ZX Spectrum 48K",
    pc: 0x8000,
    rebuilt: true,
    path: "timeline",
    landed: "saved",
    records: 8,
    keyframes: 3,
    seconds: 12.37,
    breakpointsAdded: 2,
    watches: [{ symbol: "counter", type: "b" }, { symbol: "lives", type: "b" }],
    sources: { mainFile: "code/main.asm", files: [{ path: "code/main.asm", sha256: "0".repeat(64) }, { path: "code/gone.asm", sha256: "1".repeat(64) }] },
    warnings: ["The tape is the one in the recording (game.tap)"],
    ...over
  });
  beforeEach(async () => {
    f = fake("sp48", { folderPath: "/p" });
    f.files.set("bug.klr", await recordingBytes());
    f.files.set("/p/code/main.asm", "changed");
    (f.context.emuApi as any).loadDebugRecording = vi.fn(async () => loaded());
  });

  it("opens through the emulator, adds the watches and reports differing sources", async () => {
    const result = await run(f, new DebugRecordingLoadCommand(), "drload bug.klr -verify -nobreakpoints");
    expect(result.success).toBe(true);
    expect(result.finalMessage).toBe(
      "Debug recording bug.klr opened: 12 s of machine time, 3 keyframes, with 2 breakpoints and 1 watch; paused where it was saved, in its past (PC $8000)."
    );
    const [, bytes, version, options] = (f.context.emuApi as any).loadDebugRecording.mock.calls[0];
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(version).toBe("0.64.0");
    expect(options).toEqual({ land: "saved", verify: true, noBreakpoints: true, acceptFallback: false, currentSdCard: undefined });
    expect(f.state.watchExpressions.map((w: any) => w.symbol)).toEqual(["counter", "lives"]);
    expect(f.output).toContain("Machine switched to the ZX Spectrum 48K.");
    expect(f.output).toContain("Warning: The tape is the one in the recording (game.tap)");
    expect(f.output.join("\n")).toMatch(/Warning: Labels and source lines may not match the recording: code\/main\.asm differs/);
    expect(f.output.join("\n")).toMatch(/lacks a file the recording was made with: code\/gone\.asm/);
  });

  it("opens at the start with -start", async () => {
    (f.context.emuApi as any).loadDebugRecording = vi.fn(async () => loaded({ landed: "start", breakpointsAdded: 0, watches: [] }));
    const result = await run(f, new DebugRecordingLoadCommand(), "drload bug.klr -start");
    expect(result.finalMessage).toMatch(/; paused at its start \(PC \$8000\)\.$/);
    expect((f.context.emuApi as any).loadDebugRecording.mock.calls[0][3].land).toBe("start");
  });

  it("refuses another build's recording, naming -y; with -y opens its end state", async () => {
    (f.context.emuApi as any).loadDebugRecording = vi.fn(async (_n: string, _b: Uint8Array, _v: string, o: any) =>
      o.acceptFallback
        ? loaded({ path: "state", refusal: "The recording was recorded by Klive 0.1.0 (build 00000000); this build differs" })
        : loaded({ path: "refused", refusal: "The recording was recorded by Klive 0.1.0 (build 00000000); this build differs" })
    );
    const refused = await run(f, new DebugRecordingLoadCommand(), "drload bug.klr");
    expect(refused.success).toBe(false);
    expect(refused.finalMessage).toBe(
      "The recording was recorded by Klive 0.1.0 (build 00000000); this build differs. Use -y to open only its end state, without its past."
    );
    const state = await run(f, new DebugRecordingLoadCommand(), "drload bug.klr -y");
    expect(state.success).toBe(true);
    expect(state.finalMessage).toMatch(/Opened its end state only \(no past\), stopped at PC \$8000\.$/);
  });

  it("checks the file and the open project's machine", async () => {
    expect((await run(f, new DebugRecordingLoadCommand(), "drload bug.kls")).finalMessage).toMatch(/must be a debug recording/);
    expect((await run(f, new DebugRecordingLoadCommand(), "drload none.klr")).finalMessage).toMatch(/^Could not read none\.klr/);
    f.files.set("bad.klr", new Uint8Array([1, 2, 3]));
    expect((await run(f, new DebugRecordingLoadCommand(), "drload bad.klr")).finalMessage).toMatch(/is not a valid debug recording/);
    f.files.set("next.klr", await recordingBytes("zxnext"));
    expect((await run(f, new DebugRecordingLoadCommand(), "drload next.klr")).finalMessage).toMatch(
      /The open project targets the ZX Spectrum 48K, but this recording was made on the ZX Spectrum Next/
    );
  });
});

describe("debug recordings with the advanced-debugging switch off", () => {
  it("refuses to save or open one, and says how to turn the switch on", async () => {
    const f = fake();
    f.state.emulatorState.advancedDebugging = false;
    for (const [command, line] of [
      [new DebugRecordingSaveCommand(), "drsave bug.klr"],
      [new DebugRecordingLoadCommand(), "drload bug.klr"]
    ] as const) {
      const result = await run(f, command, line);
      expect(result.success).toBe(false);
      expect(JSON.stringify(result)).toContain("set -u features.advancedDebugging 1");
    }
  });
});

describe("helpers", () => {
  it("parses -from", () => {
    expect(parseRecordingFrom("#1234")).toEqual({ sequence: 1234 });
    expect(parseRecordingFrom("-42")).toEqual({ stepsBack: 42 });
    expect(parseRecordingFrom("−42")).toEqual({ stepsBack: 42 });
    expect(parseRecordingFrom("0")).toBeUndefined();
    expect(parseRecordingFrom("x")).toBeUndefined();
  });

  it("makes source paths project-relative", () => {
    expect(projectRelativePath("/p/code/main.asm", "/p")).toBe("code/main.asm");
    expect(projectRelativePath("C:\\P\\code\\a.asm", "c:\\p\\")).toBe("code/a.asm");
    expect(projectRelativePath("/elsewhere/a.asm", "/p")).toBe("/elsewhere/a.asm");
    expect(projectRelativePath("/p/a.asm", undefined)).toBe("/p/a.asm");
  });
});
