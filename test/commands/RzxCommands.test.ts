import { describe, it, expect, vi } from "vitest";

import { MI_SPECTRUM_48, MI_Z88 } from "@common/machines/constants";
import {
  RzxPlayCommand,
  RzxRecordCommand,
  RzxRollbackCommand,
  RzxRollbackPointCommand,
  RzxStopCommand,
  RzxVideoCommand,
  isRzxPath
} from "@renderer/appIde/commands/RzxCommands";
import {
  rzxPlayCommandText,
  rzxStopCommandText,
  rzxVideoCommandText
} from "@common/spectrum/rzx/rzxCommandTypes";
import { writeRzxFile } from "@common/spectrum/rzx/rzxWriter";
import { droppedFileAction } from "@common/utils/dropped-file-action";
import { parseCommand } from "@renderer/appIde/services/command-parser";
import { ValidationMessageType } from "@renderer/abstractions/ValidationMessageType";
import { buildSzx, state48 } from "../spectrum/snapshot/builders";

/*
 * The RZX IDE commands (`.plans/RZX_PLAN.md` §1.6, Phases 5-7). The emulator side is mocked here;
 * `test/spectrum/rzx/rzx-sp-flow.test.ts` covers it on a real controller and core.
 */

const RZX = writeRzxFile({
  major: 0,
  minor: 13,
  flags: 0,
  creator: { name: "Fuse", major: 1, minor: 10, custom: new Uint8Array(0) },
  blocks: [
    { kind: "snapshot", extension: "szx", bytes: buildSzx(state48(), { machineId: 1 }), compressed: true },
    { kind: "input", tstates: 0, frames: [{ fetchCount: 1000, ins: Uint8Array.from([1]) }], compressed: true }
  ],
  notes: []
});

const PLAY_RESULT = {
  machineId: MI_SPECTRUM_48,
  modelId: "pal",
  machineName: "ZX Spectrum 48K",
  rebuilt: true,
  frames: 1,
  segments: 1,
  creator: "Fuse 1.10",
  pc: 0x8000,
  warnings: ["a warning"]
};

function contextFor(options: { machineId?: string; project?: boolean; files?: Record<string, Uint8Array>; recordingAvailable?: boolean } = {}) {
  const lines: string[] = [];
  const files = options.files ?? { "/r/game.rzx": RZX };
  const emuApi = {
    playRzx: vi.fn(async () => PLAY_RESULT),
    renderRzxToVideo: vi.fn(async () => PLAY_RESULT),
    startRzxRecording: vi.fn(async () => ({ machineName: "ZX Spectrum 48K", pc: 0x1234, tookOverPlayback: true })),
    stopRzxRecording: vi.fn(async () => ({ bytes: RZX, frames: 77, points: 1 })),
    rollbackRzxRecording: vi.fn(async () => ({ frame: 250, points: 2 })),
    insertRzxRollbackPoint: vi.fn(async () => ({ frame: 99 }))
  };
  const mainApi = {
    readBinaryFile: vi.fn(async (path: string) => {
      if (!files[path]) throw new Error(`Error: ENOENT: ${path}`);
      return files[path];
    }),
    saveBinaryFile: vi.fn(async (path: string) => path),
    getAppVersion: vi.fn(async () => "0.63.0")
  };
  const context: any = {
    store: {
      getState: () => ({
        project: { isKliveProject: !!options.project },
        emulatorState: {
          machineId: options.machineId ?? MI_SPECTRUM_48,
          screenRecordingAvailable: options.recordingAvailable ?? true
        }
      })
    },
    output: {
      write: vi.fn(),
      writeLine: vi.fn((text: string) => lines.push(text)),
      color: vi.fn(),
      resetStyle: vi.fn(),
      bold: vi.fn(),
      italic: vi.fn(),
      underline: vi.fn()
    },
    emuApi,
    mainApi
  };
  return { context, lines, emuApi, mainApi };
}

const errors = (messages: { type: ValidationMessageType; message: string }[]) =>
  messages.filter((m) => m.type === ValidationMessageType.Error).map((m) => m.message);

describe("zx-rzx", () => {
  it("validates the path and the segment", async () => {
    const { context } = contextFor();
    const cmd = new RzxPlayCommand();
    expect(errors(await cmd.validateCommandArgs(context, { file: "/r/a.RZX" }))).toEqual([]);
    expect(errors(await cmd.validateCommandArgs(context, { file: "/r/a.z80" }))).toEqual([
      "The file must be an .rzx recording."
    ]);
    expect(errors(await cmd.validateCommandArgs(context, { file: "/r/a.rzx", "-s": 0 }))).toEqual([
      "The segment number starts at 1."
    ]);
  });

  it("refuses inside a project for a machine that is not a Spectrum", async () => {
    const { context } = contextFor({ machineId: MI_Z88, project: true });
    expect(errors(await new RzxPlayCommand().validateCommandArgs(context, { file: "/r/a.rzx" }))[0]).toMatch(
      /ZX Spectrum recording/
    );
  });

  it("plays the file, reporting the machine switch and the warnings", async () => {
    const { context, lines, emuApi } = contextFor();
    const result = await new RzxPlayCommand().execute(context, { file: "/r/game.rzx" });
    expect(result.success).toBe(true);
    expect(result.finalMessage).toMatch(/1 frames, Fuse 1.10\) loaded on the ZX Spectrum 48K, playing/);
    expect(emuApi.playRzx).toHaveBeenCalledWith("/r/game.rzx", RZX, "run", { keepModel: false, segment: undefined });
    expect(lines.join("\n")).toMatch(/Machine switched to the ZX Spectrum 48K/);
    expect(lines.join("\n")).toMatch(/Warning: a warning/);
  });

  it("plays under the debugger from a segment", async () => {
    const { context, emuApi } = contextFor();
    const result = await new RzxPlayCommand().execute(context, { file: "/r/game.rzx", "-d": true, "-s": 1 });
    expect(result.finalMessage).toMatch(/under the debugger, stopped at PC \$8000/);
    expect(emuApi.playRzx).toHaveBeenCalledWith("/r/game.rzx", RZX, "debug", { keepModel: false, segment: 0 });
  });

  it("explains a file it cannot play", async () => {
    const { context } = contextFor({ files: { "/r/bad.rzx": Uint8Array.from([1, 2, 3]) } });
    const result = await new RzxPlayCommand().execute(context, { file: "/r/bad.rzx" });
    expect(result.success).toBe(false);
    expect(result.finalMessage).toMatch(/cannot be played: The file has no "RZX!" signature/);
  });
});

describe("zx-rzx-record, zx-rzx-stop, zx-rzx-rollback, zx-rzx-point", () => {
  it("records only on a Spectrum, writing Klive's version into the file", async () => {
    const z88 = contextFor({ machineId: MI_Z88 });
    expect(errors(await new RzxRecordCommand().validateCommandArgs(z88.context))).toHaveLength(1);
    const { context, emuApi } = contextFor();
    const result = await new RzxRecordCommand().execute(context);
    expect(emuApi.startRzxRecording).toHaveBeenCalledWith({ name: "Klive IDE", major: 0, minor: 63 });
    expect(result.finalMessage).toMatch(/at PC \$1234, taking over the playback/);
  });

  it("stops and saves, refusing to overwrite without -f", async () => {
    const { context, mainApi, emuApi } = contextFor();
    const refused = await new RzxStopCommand().execute(context, { file: "/r/game.rzx" });
    expect(refused.success).toBe(false);
    expect(emuApi.stopRzxRecording).not.toHaveBeenCalled();
    const saved = await new RzxStopCommand().execute(context, { file: "/r/new.rzx" });
    expect(saved.finalMessage).toBe("RZX recording saved to /r/new.rzx (77 frames).");
    expect(mainApi.saveBinaryFile).toHaveBeenCalledWith("/r/new.rzx", RZX);
  });

  it("rolls back and inserts rollback points", async () => {
    const { context, emuApi } = contextFor();
    expect((await new RzxRollbackCommand().execute(context, { back: 2 })).finalMessage).toMatch(
      /Rolled back to frame 250; 2 rollback point\(s\) left/
    );
    expect(emuApi.rollbackRzxRecording).toHaveBeenCalledWith(2);
    expect((await new RzxRollbackPointCommand().execute(context)).finalMessage).toMatch(/frame 100/);
  });
});

describe("zx-rzx-video", () => {
  it("needs the screen recorder", async () => {
    const { context } = contextFor({ recordingAvailable: false });
    expect(errors(await new RzxVideoCommand().validateCommandArgs(context, { file: "/r/game.rzx" }))).toEqual([
      "Screen recording is not available (FFmpeg was not found)."
    ]);
  });

  it("renders unthrottled by default, in real time with -t", async () => {
    const { context, emuApi } = contextFor();
    await new RzxVideoCommand().execute(context, { file: "/r/game.rzx" });
    expect(emuApi.renderRzxToVideo).toHaveBeenLastCalledWith("/r/game.rzx", RZX, { keepModel: false, unthrottled: true });
    const result = await new RzxVideoCommand().execute(context, { file: "/r/game.rzx", "-t": true });
    expect(emuApi.renderRzxToVideo).toHaveBeenLastCalledWith("/r/game.rzx", RZX, { keepModel: false, unthrottled: false });
    expect(result.finalMessage).toMatch(/in real time/);
  });
});

describe("RZX command texts and drops", () => {
  it("quotes paths so the command parser reads them back", () => {
    const path = "/My Files/a game.rzx";
    expect(parseCommand(rzxPlayCommandText(path)).map((t) => t.text)).toEqual(["zx-rzx", path]);
    expect(parseCommand(rzxPlayCommandText(path, true, 2)).map((t) => t.text)).toEqual(["zx-rzx", path, "-d", "-s", "3"]);
    expect(parseCommand(rzxStopCommandText(path, true)).map((t) => t.text)).toEqual(["zx-rzx-stop", path, "-f"]);
    expect(parseCommand(rzxVideoCommandText(path)).map((t) => t.text)).toEqual(["zx-rzx-video", path]);
  });

  it("plays a dropped .rzx file", () => {
    expect(isRzxPath("/a/B.RZX")).toBe(true);
    expect(droppedFileAction("/a/game.RZX")).toEqual({ kind: "command", command: 'zx-rzx "/a/game.RZX"' });
    expect((droppedFileAction("/a/x.bin") as { message: string }).message).toMatch(/an \.rzx recording/);
  });
});
