import { describe, it, expect, vi } from "vitest";

import { MI_SPECTRUM_128, MI_SPECTRUM_3E, MI_SPECTRUM_48, MI_Z88, MI_ZXNEXT } from "@common/machines/constants";
import { SpectrumSnapshotSaveCommand } from "@renderer/appIde/commands/SpectrumSnapshotSaveCommand";
import { spectrumSnapshotSaveCommandText } from "@common/spectrum/snapshot/spectrumSnapshotSaveTypes";
import { parseCommand } from "@renderer/appIde/services/command-parser";
import { ValidationMessageType } from "@renderer/abstractions/ValidationMessageType";

/*
 * The `zx-snapshot-save` IDE command (`.plans/SNAPSHOT_SAVING_AND_STATE_FILES_PLAN.md` §4.3,
 * Phase 3). The emulator side is mocked here; `test/spectrum/snapshot/spectrum-snapshot-flow.test.ts`
 * and `spectrum-snapshot-save.test.ts` cover it on the real machines.
 */

const BYTES = Uint8Array.from([1, 2, 3]);

function contextFor(
  machineId: string | undefined = MI_SPECTRUM_48,
  options: {
    existing?: string[];
    losses?: string[];
    saveError?: string;
    writeError?: string;
    version?: string;
  } = {}
) {
  const lines: string[] = [];
  const readBinaryFile = vi.fn(async (path: string) => {
    if (!(options.existing ?? []).includes(path)) throw new Error(`Error: ENOENT: no such file, open '${path}'`);
    return new Uint8Array(1);
  });
  const saveBinaryFile = vi.fn(async (path: string) => {
    if (options.writeError) throw new Error(`Error: ${options.writeError}`);
    return path;
  });
  const getAppVersion = vi.fn(async () => options.version ?? "0.62.1");
  const saveSpectrumSnapshot = vi.fn(async (format: string) => {
    if (options.saveError) throw new Error(`Error: Error: ${options.saveError}`);
    return {
      bytes: BYTES,
      losses: options.losses ?? [],
      machineName: "ZX Spectrum 48K",
      pc: 0x8123,
      format
    };
  });
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
    emuApi: { saveSpectrumSnapshot },
    mainApi: { readBinaryFile, saveBinaryFile, getAppVersion }
  };
  return { context, lines, saveBinaryFile, saveSpectrumSnapshot, getAppVersion };
}

async function validate(args: Record<string, unknown>, machineId?: string) {
  const { context } = contextFor(machineId);
  const messages = await new SpectrumSnapshotSaveCommand().validateCommandArgs(context, args as any);
  return messages.filter((m) => m.type === ValidationMessageType.Error).map((m) => m.message);
}

describe("zx-snapshot-save command", () => {
  it("is registered as `zx-snapshot-save` with the `zxsave` alias", () => {
    const command = new SpectrumSnapshotSaveCommand();
    expect(command.id).toBe("zx-snapshot-save");
    expect(command.aliases).toEqual(["zxsave"]);
    expect(command.usage).toBe("zx-snapshot-save <snapshot-file> [-f]");
  });

  describe("validation", () => {
    it("accepts the three extensions in any case, with and without -f", async () => {
      for (const file of ["/p/a.szx", "/p/B.Z80", "/p/c.SNA"]) {
        expect(await validate({ file })).toEqual([]);
        expect(await validate({ file, "-f": true })).toEqual([]);
      }
    });

    it("refuses an empty path and another extension", async () => {
      expect(await validate({ file: "  " })).toEqual(["The snapshot file path cannot be empty."]);
      expect(await validate({ file: "/p/a.tap" })).toEqual([
        "The file to save must be a .szx, .z80 or .sna snapshot."
      ]);
      expect(await validate({ file: "/p/a.zx-state" })).toHaveLength(1);
    });

    it.each([MI_SPECTRUM_48, MI_SPECTRUM_128, MI_SPECTRUM_3E])("accepts the %s", async (machineId) => {
      expect(await validate({ file: "/p/a.szx" }, machineId)).toEqual([]);
    });

    it.each([MI_ZXNEXT, MI_Z88])("refuses the %s", async (machineId) => {
      expect(await validate({ file: "/p/a.szx" }, machineId)).toEqual([
        "Only a ZX Spectrum 48K, 128K or +2E/+3E can be saved as a snapshot."
      ]);
    });
  });

  describe("execution", () => {
    it("saves in the format the extension names, with Klive's version as the creator", async () => {
      const { context, saveBinaryFile, saveSpectrumSnapshot } = contextFor();
      const result = await new SpectrumSnapshotSaveCommand().execute(context, { file: " /p/Game.Z80 " });
      expect(result.success).toBe(true);
      expect(saveSpectrumSnapshot).toHaveBeenCalledWith("z80", { name: "Klive IDE", major: 0, minor: 62 });
      expect(saveBinaryFile).toHaveBeenCalledWith("/p/Game.Z80", BYTES);
      expect(result.finalMessage).toBe("Z80 snapshot /p/Game.Z80 saved (ZX Spectrum 48K, PC $8123).");
      expect(result.value).toEqual({ format: "z80", losses: [] });
    });

    it("refuses to replace an existing file without -f", async () => {
      const { context, saveSpectrumSnapshot } = contextFor(MI_SPECTRUM_48, { existing: ["/p/a.szx"] });
      const result = await new SpectrumSnapshotSaveCommand().execute(context, { file: "/p/a.szx" });
      expect(result.success).toBe(false);
      expect(result.finalMessage).toBe("/p/a.szx already exists; use -f to replace it.");
      expect(saveSpectrumSnapshot).not.toHaveBeenCalled();
    });

    it("replaces an existing file with -f", async () => {
      const { context, saveBinaryFile } = contextFor(MI_SPECTRUM_48, { existing: ["/p/a.szx"] });
      const result = await new SpectrumSnapshotSaveCommand().execute(context, { file: "/p/a.szx", "-f": true });
      expect(result.success).toBe(true);
      expect(saveBinaryFile).toHaveBeenCalled();
    });

    it("writes each loss as a warning and returns them", async () => {
      const losses = ["A .sna has no frame position", "The EI delay is lost"];
      const { context, lines } = contextFor(MI_SPECTRUM_48, { losses });
      const result = await new SpectrumSnapshotSaveCommand().execute(context, { file: "/p/a.sna" });
      expect(lines).toEqual(losses.map((l) => `Warning: ${l}`));
      expect(result.value.losses).toEqual(losses);
    });

    it("reports the emulator's refusal without the Error: prefixes, and writes nothing", async () => {
      const { context, saveBinaryFile } = contextFor(MI_SPECTRUM_48, {
        saveError: "The machine has no state to save; start it first"
      });
      const result = await new SpectrumSnapshotSaveCommand().execute(context, { file: "/p/a.szx" });
      expect(result.success).toBe(false);
      expect(result.finalMessage).toBe(
        "Could not save /p/a.szx: The machine has no state to save; start it first"
      );
      expect(saveBinaryFile).not.toHaveBeenCalled();
    });

    it("reports a write error", async () => {
      const { context } = contextFor(MI_SPECTRUM_48, { writeError: "EACCES: permission denied" });
      const result = await new SpectrumSnapshotSaveCommand().execute(context, { file: "/p/a.szx" });
      expect(result.finalMessage).toBe("Could not write /p/a.szx: EACCES: permission denied");
    });

    it("still saves when the version is unavailable", async () => {
      const { context, getAppVersion, saveSpectrumSnapshot } = contextFor();
      getAppVersion.mockRejectedValue(new Error("no"));
      await new SpectrumSnapshotSaveCommand().execute(context, { file: "/p/a.szx" });
      expect(saveSpectrumSnapshot).toHaveBeenCalledWith("szx", { name: "Klive IDE", major: 0, minor: 0 });
    });
  });

  describe("command text", () => {
    it("quotes the path and adds -f when the dialog has confirmed an overwrite", () => {
      expect(spectrumSnapshotSaveCommandText("/p/my game.szx")).toBe('zx-snapshot-save "/p/my game.szx"');
      expect(spectrumSnapshotSaveCommandText("/p/a.z80", true)).toBe('zx-snapshot-save "/p/a.z80" -f');
    });

    it("survives the IDE's tokenizer with spaces and Windows separators", () => {
      for (const path of ["/project/my game.szx", "C:\\Users\\me\\My Games\\jsw.z80"]) {
        expect(parseCommand(spectrumSnapshotSaveCommandText(path, true)).map((t) => t.text)).toEqual([
          "zx-snapshot-save",
          path,
          "-f"
        ]);
      }
    });
  });
});
