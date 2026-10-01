import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, vi } from "vitest";
import { unzipSync, zipSync } from "fflate";

import { MI_SPECTRUM_48, MI_Z88 } from "@common/machines/constants";
import {
  isZ88SnapshotPath,
  Z88SnapshotCommand,
  z88SnapshotProjectGuard
} from "@renderer/appIde/commands/Z88SnapshotCommand";
import { z88SnapshotCommandText } from "@common/z88/z88SnapshotLoadTypes";
import { parseCommand } from "@renderer/appIde/services/command-parser";
import { ValidationMessageType } from "@renderer/abstractions/ValidationMessageType";

/*
 * The `z88-snapshot` IDE command (`.plans/Z88_SNAPSHOT_PLAN.md` §4.6, Phase 4). The emulator side is
 * mocked here; `test/z88/snapshot/z88-snapshot-flow.test.ts` covers it on the real machine.
 */

const SAMPLE = new Uint8Array(
  readFileSync(join(__dirname, "../z88/snapshot/fixtures/mm+jsw-oz5.z88"))
);

/** The sample with its Autorun flag replaced */
function sampleWithAutorun(value: boolean): Uint8Array {
  const entries = unzipSync(SAMPLE);
  const text = new TextDecoder("latin1").decode(entries["snapshot.settings"]);
  entries["snapshot.settings"] = new TextEncoder().encode(
    text.replace(/^Autorun=.*$/m, `Autorun=${value}`)
  );
  return zipSync(entries);
}

type State = {
  machineId?: string;
  isKliveProject?: boolean;
};

function contextFor(state: State = { machineId: MI_Z88 }, bytes: Uint8Array = SAMPLE) {
  const lines: string[] = [];
  const readBinaryFile = vi.fn().mockResolvedValue(bytes);
  const loadZ88Snapshot = vi.fn().mockResolvedValue({
    pc: 0xf523,
    tim: [0, 0, 0, 0, 0],
    rebuilt: false,
    autorun: true,
    warnings: []
  });
  const context: any = {
    store: {
      getState: () => ({
        emulatorState: { machineId: state.machineId },
        project: { isKliveProject: state.isKliveProject, folderPath: state.isKliveProject ? "/p" : null }
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
    emuApi: { loadZ88Snapshot },
    mainApi: { readBinaryFile }
  };
  return { context, lines, readBinaryFile, loadZ88Snapshot };
}

async function validate(args: Record<string, unknown>, state?: State) {
  const { context } = contextFor(state);
  const messages = await new Z88SnapshotCommand().validateCommandArgs(context, args as any);
  return messages.filter((m) => m.type === ValidationMessageType.Error).map((m) => m.message);
}

describe("z88-snapshot command", () => {
  it("is registered as `z88-snapshot`", () => {
    const command = new Z88SnapshotCommand();
    expect(command.id).toBe("z88-snapshot");
    expect(command.aliases).toEqual(["z88snap"]);
    expect(command.argumentInfo.commandOptions).toEqual(["-r", "-d", "-a"]);
  });

  it("recognises a .z88 path regardless of case or padding", () => {
    expect(isZ88SnapshotPath("/p/boot.z88")).toBe(true);
    expect(isZ88SnapshotPath(" /p/BOOT.Z88 ")).toBe(true);
    expect(isZ88SnapshotPath("/p/boot.z80")).toBe(false);
    expect(isZ88SnapshotPath("/p/boot.z88.zip")).toBe(false);
    expect(isZ88SnapshotPath(undefined)).toBe(false);
  });

  describe("validation", () => {
    it("accepts a .z88 file with any one option", async () => {
      expect(await validate({ file: "/p/a.z88" })).toEqual([]);
      for (const option of ["-r", "-d", "-a"]) {
        expect(await validate({ file: "/p/a.z88", [option]: true })).toEqual([]);
      }
    });

    it("refuses an empty path and a file that is not a .z88", async () => {
      expect(await validate({ file: "  " })).toEqual(["The snapshot file path cannot be empty."]);
      expect(await validate({ file: "/p/a.tap" })).toEqual([
        "The file to load must be a .z88 snapshot."
      ]);
    });

    it("refuses more than one option", async () => {
      expect(await validate({ file: "/p/a.z88", "-r": true, "-d": true })).toEqual([
        "Use only one of -r, -d and -a (got -r, -d)."
      ]);
    });

    it("loads with no project open, whatever the machine", async () => {
      expect(await validate({ file: "/p/a.z88" }, { machineId: MI_SPECTRUM_48 })).toEqual([]);
    });

    it("loads into a Z88 project", async () => {
      expect(await validate({ file: "/p/a.z88" }, { machineId: MI_Z88, isKliveProject: true })).toEqual(
        []
      );
    });

    it("refuses to switch a project for another machine", async () => {
      const errors = await validate({ file: "/p/a.z88" }, { machineId: MI_SPECTRUM_48, isKliveProject: true });
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatch(/^The open project targets ZX Spectrum 48K; .*Close the project/);
    });
  });

  describe("project guard", () => {
    it("names no problem without a project or with a Z88 project", () => {
      expect(z88SnapshotProjectGuard({ emulatorState: { machineId: MI_SPECTRUM_48 } })).toBeUndefined();
      expect(
        z88SnapshotProjectGuard({ project: { isKliveProject: true }, emulatorState: { machineId: MI_Z88 } })
      ).toBeUndefined();
    });

    it("falls back to the machine id for an unknown machine", () => {
      expect(
        z88SnapshotProjectGuard({ project: { isKliveProject: true }, emulatorState: { machineId: "zzz" } })
      ).toMatch(/^The open project targets zzz;/);
    });
  });

  describe("execute", () => {
    it.each([
      // --- No option debugs: "load and stay paused" stopped at PC exactly as debugging does
      [{}, "debug", "stopped at"],
      [{ "-r": true }, "run", "running"],
      [{ "-d": true }, "debug", "stopped at"]
    ])("with %o loads the file in %s mode", async (options, mode, done) => {
      const { context, readBinaryFile, loadZ88Snapshot } = contextFor();
      const result = await new Z88SnapshotCommand().execute(context, { file: " /p/a.z88 ", ...options } as any);
      expect(readBinaryFile).toHaveBeenCalledWith("/p/a.z88");
      expect(loadZ88Snapshot).toHaveBeenCalledWith(SAMPLE, mode);
      expect(result).toEqual({
        success: true,
        finalMessage: `Z88 snapshot /p/a.z88 loaded, ${done} PC $F523.`,
        value: undefined
      });
    });

    it.each([
      [true, "run"],
      [false, "debug"]
    ])("with -a follows Autorun=%s: %s", async (autorun, mode) => {
      const bytes = sampleWithAutorun(autorun);
      const { context, loadZ88Snapshot } = contextFor({ machineId: MI_Z88 }, bytes);
      await new Z88SnapshotCommand().execute(context, { file: "/p/a.z88", "-a": true } as any);
      expect(loadZ88Snapshot).toHaveBeenCalledWith(bytes, mode);
    });

    it("with -a reports a file that is not a snapshot, without loading", async () => {
      const { context, loadZ88Snapshot } = contextFor({ machineId: MI_Z88 }, new Uint8Array([1, 2, 3]));
      const result = await new Z88SnapshotCommand().execute(context, { file: "/p/a.z88", "-a": true } as any);
      expect(result.success).toBe(false);
      expect(result.finalMessage).toMatch(/^\/p\/a\.z88 is not a valid Z88 snapshot: Not a ZIP archive/);
      expect(loadZ88Snapshot).not.toHaveBeenCalled();
    });

    it("reports a file it cannot read", async () => {
      const { context, readBinaryFile, loadZ88Snapshot } = contextFor();
      readBinaryFile.mockRejectedValue(new Error("ENOENT: no such file"));
      const result = await new Z88SnapshotCommand().execute(context, { file: "/p/a.z88" } as any);
      expect(result).toMatchObject({ success: false, finalMessage: "Could not read /p/a.z88: ENOENT: no such file" });
      expect(loadZ88Snapshot).not.toHaveBeenCalled();
    });

    it("reports the emulator's refusal, without the 'Error:' the process boundary adds", async () => {
      const { context, loadZ88Snapshot } = contextFor();
      loadZ88Snapshot.mockRejectedValue(
        new Error("Error: The snapshot cannot be loaded: Slot 3 holds a hybrid card")
      );
      const result = await new Z88SnapshotCommand().execute(context, { file: "/p/a.z88" } as any);
      expect(result).toMatchObject({
        success: false,
        finalMessage: "Could not load /p/a.z88: The snapshot cannot be loaded: Slot 3 holds a hybrid card"
      });
    });

    it("tells about a rebuild and every warning", async () => {
      const { context, lines, loadZ88Snapshot } = contextFor();
      loadZ88Snapshot.mockResolvedValue({
        pc: 0x1234,
        tim: [0, 0, 0, 0, 0],
        rebuilt: true,
        autorun: false,
        warnings: ["first", "second"]
      });
      await new Z88SnapshotCommand().execute(context, { file: "/p/a.z88" } as any);
      expect(lines).toEqual([
        "The Z88 was set up again to fit the snapshot.",
        "Warning: first",
        "Warning: second"
      ]);
    });
  });

  describe("command text (the emulator menu and the viewer)", () => {
    it("quotes the path and adds the option's flag", () => {
      expect(z88SnapshotCommandText("/p/my game.z88", "run")).toBe('z88-snapshot "/p/my game.z88" -r');
      expect(z88SnapshotCommandText("/p/a.z88", "debug")).toBe('z88-snapshot "/p/a.z88" -d');
      expect(z88SnapshotCommandText("/p/a.z88", "autorun")).toBe('z88-snapshot "/p/a.z88" -a');
    });

    it("survives the IDE's tokenizer with spaces and Windows separators", () => {
      for (const path of ["/project/my game.z88", "C:\\Users\\me\\My Games\\mm+jsw.z88"]) {
        const tokens = parseCommand(z88SnapshotCommandText(path, "debug"));
        expect(tokens.map((t) => t.text)).toEqual(["z88-snapshot", path, "-d"]);
      }
    });
  });
});
