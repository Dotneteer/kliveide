import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  MI_C64,
  MI_SPECTRUM_128,
  MI_SPECTRUM_3E,
  MI_SPECTRUM_48,
  MI_Z88,
  MI_ZXNEXT
} from "@common/machines/constants";
import {
  isTapeFilePath,
  resolveTapePath,
  TapeLoadCommand,
  tapeLoadGuard
} from "@renderer/appIde/commands/TapeLoadCommand";
import { parseCommand } from "@renderer/appIde/services/command-parser";
import { ValidationMessageType } from "@renderer/abstractions/ValidationMessageType";

/*
 * The `tape-load` IDE command (`.plans/TAPE_VIEWER_PLAN.md` §4.6). The main process and the emulator
 * are mocked here; the keystroke flows run on the real machine in
 * `test/tape/tape-load-flow.test.ts`.
 */

const FLOAT_SPY = new Uint8Array(readFileSync(join(__dirname, "../testfiles/floatspy.tap")));

function contextFor(machineId: string = MI_SPECTRUM_48, bytes: Uint8Array = FLOAT_SPY) {
  const lines: string[] = [];
  const readBinaryFile = vi.fn().mockResolvedValue(bytes);
  const setTapeFile = vi.fn().mockResolvedValue(undefined);
  const startTapeLoad = vi.fn().mockResolvedValue(undefined);
  const setTapeFileOnEmu = vi.fn();
  const focusEmuWindow = vi.fn().mockResolvedValue(undefined);
  const context: any = {
    store: { getState: () => ({ emulatorState: { machineId } }) },
    output: {
      write: vi.fn(),
      writeLine: vi.fn((text: string) => lines.push(text)),
      color: vi.fn(),
      resetStyle: vi.fn(),
      bold: vi.fn(),
      italic: vi.fn(),
      underline: vi.fn()
    },
    emuApi: { startTapeLoad, setTapeFile: setTapeFileOnEmu },
    mainApi: { readBinaryFile, setTapeFile, focusEmuWindow }
  };
  return {
    context,
    lines,
    readBinaryFile,
    setTapeFile,
    startTapeLoad,
    setTapeFileOnEmu,
    focusEmuWindow
  };
}

async function validate(args: Record<string, unknown>, machineId?: string) {
  const { context } = contextFor(machineId);
  const messages = await new TapeLoadCommand().validateCommandArgs(context, args as any);
  return messages.filter((m) => m.type === ValidationMessageType.Error).map((m) => m.message);
}

describe("tape-load command", () => {
  it("is registered as `tape-load`", () => {
    const command = new TapeLoadCommand();
    expect(command.id).toBe("tape-load");
    expect(command.aliases).toEqual(["tapeload"]);
    expect(command.argumentInfo.commandOptions).toEqual(["-r", "-d"]);
  });

  it("recognises tape paths", () => {
    expect(isTapeFilePath("/p/a.tap")).toBe(true);
    expect(isTapeFilePath(" /p/A.TZX ")).toBe(true);
    expect(isTapeFilePath("/p/a.tap.zip")).toBe(false);
  });

  it.each([
    [MI_SPECTRUM_48, true],
    [MI_SPECTRUM_128, true],
    [MI_SPECTRUM_3E, true],
    [MI_ZXNEXT, false],
    [MI_Z88, false],
    [MI_C64, false],
    [undefined, false]
  ])("allows %s: %s", (machineId, allowed) => {
    expect(!tapeLoadGuard({ emulatorState: { machineId } })).toBe(allowed);
  });

  it("takes a ZX80/ZX81 program on a ZX80 or ZX81, and only there", async () => {
    expect(await validate({ file: "/p/game.P" }, "zx81")).toEqual([]);
    expect(await validate({ file: "/p/game.o" }, "zx80")).toEqual([]);
    expect(await validate({ file: "/p/game.tap" }, "zx81")).toEqual([
      expect.stringMatching(/^Loading a tape requires a ZX Spectrum 48K, 128K or \+2\/\+3 machine/)
    ]);
    expect(await validate({ file: "/p/game.p" })).toEqual([
      expect.stringMatching(/^Loading a tape requires a ZX80 or ZX81 machine/)
    ]);
  });

  it("validates its arguments", async () => {
    expect(await validate({ file: "/p/a.tap" })).toEqual([]);
    expect(await validate({ file: "" })).toEqual(["The tape file path cannot be empty."]);
    expect(await validate({ file: "/p/a.nex" })).toEqual([
      "The file to load must be a .tap or .tzx tape, or a ZX80/ZX81 .p, .81, .o or .80 program."
    ]);
    expect(await validate({ file: "/p/a.tap", "-r": true, "-d": true })).toEqual([
      "Use only one of -r and -d."
    ]);
  });

  it("refuses the ZX Spectrum Next and says why", async () => {
    const [message] = await validate({ file: "/p/a.tap" }, MI_ZXNEXT);
    expect(message).toMatch(/^Loading a tape requires a ZX Spectrum 48K, 128K or \+2\/\+3 machine/);
  });

  it("inserts the tape through the main process, never the emulator directly", async () => {
    const { context, setTapeFile, startTapeLoad, setTapeFileOnEmu, focusEmuWindow } = contextFor();
    const result = await new TapeLoadCommand().execute(context, { file: " /p/a.tap " } as any);
    expect(result.success).toBe(true);
    expect(setTapeFile).toHaveBeenCalledWith("/p/a.tap");
    expect(setTapeFileOnEmu).not.toHaveBeenCalled();
    expect(startTapeLoad).not.toHaveBeenCalled();
    // --- Inserting alone starts nothing, so the IDE keeps the keyboard
    expect(focusEmuWindow).not.toHaveBeenCalled();
  });

  it.each([
    [{ "-r": true }, false],
    [{ "-d": true }, true]
  ])("with %o resets and starts the load (debug: %s)", async (options, debug) => {
    const { context, setTapeFile, startTapeLoad, focusEmuWindow } = contextFor(MI_SPECTRUM_128);
    const result = await new TapeLoadCommand().execute(context, {
      file: "/p/a.tap",
      ...options
    } as any);
    expect(result.success).toBe(true);
    expect(setTapeFile).toHaveBeenCalled();
    expect(startTapeLoad).toHaveBeenCalledWith(debug);
    // --- The loaded program waits for keys, so the emulator gets the keyboard
    expect(focusEmuWindow).toHaveBeenCalledTimes(1);
    expect(focusEmuWindow.mock.invocationCallOrder[0]).toBeGreaterThan(
      startTapeLoad.mock.invocationCallOrder[0]
    );
  });

  it("still succeeds when the emulator window cannot take the focus", async () => {
    const { context, focusEmuWindow } = contextFor();
    focusEmuWindow.mockRejectedValue(new Error("no window"));
    const result = await new TapeLoadCommand().execute(context, {
      file: "/p/a.tap",
      "-r": true
    } as any);
    expect(result.success).toBe(true);
  });

  it("refuses a file that is not a tape, without inserting it", async () => {
    const { context, setTapeFile } = contextFor(MI_SPECTRUM_48, new Uint8Array([1, 2, 3]));
    const result = await new TapeLoadCommand().execute(context, { file: "/p/a.tap" } as any);
    expect(result.success).toBe(false);
    expect(setTapeFile).not.toHaveBeenCalled();
  });

  it("reports the main process's failure to insert", async () => {
    const { context, setTapeFile, startTapeLoad } = contextFor();
    setTapeFile.mockResolvedValueOnce("Reading file /p/a.tap resulted in error: gone");
    const result = await new TapeLoadCommand().execute(context, {
      file: "/p/a.tap",
      "-r": true
    } as any);
    expect(result.success).toBe(false);
    expect(startTapeLoad).not.toHaveBeenCalled();
  });

  it("warns about the +3 Loader booting a disk", async () => {
    const { context, lines } = contextFor(MI_SPECTRUM_3E);
    await new TapeLoadCommand().execute(context, { file: "/p/a.tap", "-r": true } as any);
    expect(lines.join("\n")).toMatch(/boots a disk/);
  });

  it("resolves a relative path against the open project", async () => {
    expect(resolveTapePath("tapes/a.tap", "/proj")).toBe("/proj/tapes/a.tap");
    expect(resolveTapePath("a.tap", "/proj/")).toBe("/proj/a.tap");
    expect(resolveTapePath("/abs/a.tap", "/proj")).toBe("/abs/a.tap");
    expect(resolveTapePath("C:\\t\\a.tap", "D:\\proj")).toBe("C:\\t\\a.tap");
    expect(resolveTapePath("a.tap", "D:\\proj")).toBe("D:\\proj\\a.tap");
    expect(resolveTapePath("a.tap", undefined)).toBe("a.tap");

    const { context, setTapeFile, readBinaryFile } = contextFor();
    context.store.getState = () => ({
      emulatorState: { machineId: MI_SPECTRUM_48 },
      project: { folderPath: "/proj" }
    });
    await new TapeLoadCommand().execute(context, { file: "game.tzx" } as any);
    expect(readBinaryFile).toHaveBeenCalledWith("/proj/game.tzx");
    expect(setTapeFile).toHaveBeenCalledWith("/proj/game.tzx");
  });

  it("parses a quoted path with spaces", () => {
    const tokens = parseCommand('tape-load "/p/my game.tzx" -r');
    expect(tokens.map((t) => t.text)).toEqual(["tape-load", "/p/my game.tzx", "-r"]);
  });
});
