import { describe, it, expect, vi } from "vitest";

import { MI_SPECTRUM_128, MI_SPECTRUM_3E, MI_SPECTRUM_48, MI_Z88 } from "@common/machines/constants";
import {
  diskCandidates,
  isSpectrumSnapshotPath,
  SpectrumSnapshotCommand,
  spectrumSnapshotProjectGuard
} from "@renderer/appIde/commands/SpectrumSnapshotCommand";
import { spectrumSnapshotCommandText } from "@common/spectrum/snapshot/spectrumSnapshotLoadTypes";
import { parseCommand } from "@renderer/appIde/services/command-parser";
import { ValidationMessageType } from "@renderer/abstractions/ValidationMessageType";
import { buildSna48, buildSzx, state128, state48, szxBlock, szxDskBlock } from "../spectrum/snapshot/builders";

/*
 * The `zx-snapshot` IDE command (`.plans/ZX_SPECTRUM_SNAPSHOT_PLAN.md` §4.6, Phase 5). The emulator
 * side is mocked here; `test/spectrum/snapshot/spectrum-snapshot-flow.test.ts` covers it on the
 * real machines.
 */

const SNA48 = buildSna48(state48());

type State = { machineId?: string; isKliveProject?: boolean };

function contextFor(state: State = { machineId: MI_SPECTRUM_48 }, files: Record<string, Uint8Array> = { "/p/a.sna": SNA48 }) {
  const lines: string[] = [];
  const readBinaryFile = vi.fn(async (path: string) => {
    const bytes = files[path];
    if (!bytes) throw new Error(`Error: ENOENT: no such file, open '${path}'`);
    return bytes;
  });
  const loadSpectrumSnapshot = vi.fn().mockResolvedValue({
    pc: 0x8123,
    machineId: MI_SPECTRUM_48,
    modelId: "pal",
    machineName: "ZX Spectrum 48K",
    rebuilt: false,
    format: "sna",
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
    emuApi: { loadSpectrumSnapshot },
    mainApi: { readBinaryFile }
  };
  return { context, lines, readBinaryFile, loadSpectrumSnapshot };
}

async function validate(args: Record<string, unknown>, state?: State) {
  const { context } = contextFor(state);
  const messages = await new SpectrumSnapshotCommand().validateCommandArgs(context, args as any);
  return messages.filter((m) => m.type === ValidationMessageType.Error).map((m) => m.message);
}

describe("zx-snapshot command", () => {
  it("is registered as `zx-snapshot` with the `zxsnap` alias", () => {
    const command = new SpectrumSnapshotCommand();
    expect(command.id).toBe("zx-snapshot");
    expect(command.aliases).toEqual(["zxsnap"]);
    expect(command.usage).toBe("zx-snapshot <snapshot-file> [-r | -d]");
  });

  it("recognises snapshot paths in any case", () => {
    for (const p of ["a.sna", "B.SNA", "c.z80", "D.Z80", "e.szx", "f.SZX"]) expect(isSpectrumSnapshotPath(p)).toBe(true);
    for (const p of ["a.tap", "a.z88", "", undefined]) expect(isSpectrumSnapshotPath(p)).toBe(false);
  });

  describe("validation", () => {
    it("accepts each option and none", async () => {
      expect(await validate({ file: "/p/a.sna" })).toEqual([]);
      expect(await validate({ file: "/p/a.z80", "-r": true })).toEqual([]);
      expect(await validate({ file: "/p/a.SZX", "-d": true })).toEqual([]);
    });

    it("refuses two options, an empty path and another extension", async () => {
      expect(await validate({ file: "/p/a.sna", "-r": true, "-d": true })).toEqual(["Use only one of -r and -d."]);
      expect(await validate({ file: " " })).toEqual(["The snapshot file path cannot be empty."]);
      expect(await validate({ file: "/p/a.tap" })).toEqual(["The file to load must be a .sna, .z80 or .szx snapshot."]);
    });

    it("lets any machine switch with no project, and refuses a non-Spectrum project", async () => {
      expect(await validate({ file: "/p/a.sna" }, { machineId: MI_Z88 })).toEqual([]);
      expect(await validate({ file: "/p/a.sna" }, { machineId: MI_SPECTRUM_3E, isKliveProject: true })).toEqual([]);
      const refused = await validate({ file: "/p/a.sna" }, { machineId: MI_Z88, isKliveProject: true });
      expect(refused[0]).toMatch(/targets Cambridge Z88/);
    });
  });

  describe("project guard", () => {
    it("refuses a project of another Spectrum type, naming both", () => {
      const msg = spectrumSnapshotProjectGuard(
        { project: { isKliveProject: true }, emulatorState: { machineId: MI_SPECTRUM_128 } },
        MI_SPECTRUM_48
      );
      expect(msg).toMatch(/ZX Spectrum 128K.*ZX Spectrum 48K/);
      expect(
        spectrumSnapshotProjectGuard({ project: { isKliveProject: true }, emulatorState: { machineId: MI_SPECTRUM_48 } }, MI_SPECTRUM_48)
      ).toBeUndefined();
      expect(spectrumSnapshotProjectGuard({ emulatorState: { machineId: MI_Z88 } }, MI_SPECTRUM_48)).toBeUndefined();
    });
  });

  describe("execution", () => {
    it.each([
      [{}, "debug", "stopped at"],
      [{ "-d": true }, "debug", "stopped at"],
      [{ "-r": true }, "run", "running"]
    ] as const)("loads with %o in %s mode", async (options, mode, done) => {
      const { context, loadSpectrumSnapshot } = contextFor();
      const result = await new SpectrumSnapshotCommand().execute(context, { file: " /p/a.sna ", ...options } as any);
      expect(loadSpectrumSnapshot).toHaveBeenCalledWith("/p/a.sna", SNA48, mode, { keepModel: false, disks: [] });
      expect(result).toEqual({ success: true, finalMessage: `SNA snapshot /p/a.sna loaded, ${done} PC $8123.` });
    });

    it("keeps the project's model when a project is open", async () => {
      const { context, loadSpectrumSnapshot } = contextFor({ machineId: MI_SPECTRUM_48, isKliveProject: true });
      await new SpectrumSnapshotCommand().execute(context, { file: "/p/a.sna" } as any);
      expect(loadSpectrumSnapshot.mock.calls[0][3]).toEqual({ keepModel: true, disks: [] });
    });

    it("refuses a snapshot for another machine than the project's, without loading", async () => {
      const { context, loadSpectrumSnapshot } = contextFor(
        { machineId: MI_SPECTRUM_128, isKliveProject: true },
        { "/p/a.sna": SNA48 }
      );
      const result = await new SpectrumSnapshotCommand().execute(context, { file: "/p/a.sna" } as any);
      expect(result.success).toBe(false);
      expect(result.finalMessage).toMatch(/needs the ZX Spectrum 48K/);
      expect(loadSpectrumSnapshot).not.toHaveBeenCalled();
    });

    it("reports an unreadable file, an invalid one and an unsupported machine", async () => {
      let { context } = contextFor(undefined, {});
      expect(await new SpectrumSnapshotCommand().execute(context, { file: "/p/a.sna" } as any)).toMatchObject({
        success: false,
        finalMessage: "Could not read /p/a.sna: ENOENT: no such file, open '/p/a.sna'"
      });
      ({ context } = contextFor(undefined, { "/p/a.z80": new Uint8Array(10) }));
      expect((await new SpectrumSnapshotCommand().execute(context, { file: "/p/a.z80" } as any)).finalMessage).toMatch(
        /^\/p\/a\.z80 is not a valid snapshot: A \.z80 file has a 30-byte header/
      );
      ({ context } = contextFor(undefined, { "/p/a.szx": buildSzx(state128(), { machineId: 7 }) }));
      expect((await new SpectrumSnapshotCommand().execute(context, { file: "/p/a.szx" } as any)).finalMessage).toBe(
        "/p/a.szx cannot be loaded: Klive cannot emulate the Pentagon 128"
      );
    });

    it("reports the emulator's refusal without the Error prefix", async () => {
      const { context, loadSpectrumSnapshot } = contextFor();
      loadSpectrumSnapshot.mockRejectedValue(new Error("Error: The machine change was superseded"));
      const result = await new SpectrumSnapshotCommand().execute(context, { file: "/p/a.sna" } as any);
      expect(result.finalMessage).toBe("Could not load /p/a.sna: The machine change was superseded");
    });

    it("tells about a machine switch and every warning", async () => {
      const { context, lines, loadSpectrumSnapshot } = contextFor();
      loadSpectrumSnapshot.mockResolvedValue({
        pc: 0x1234,
        machineId: MI_SPECTRUM_128,
        machineName: "ZX Spectrum 128K",
        rebuilt: true,
        format: "z80",
        warnings: ["first", "second"]
      });
      await new SpectrumSnapshotCommand().execute(context, { file: "/p/a.sna" } as any);
      expect(lines).toEqual(["Machine switched to the ZX Spectrum 128K.", "Warning: first", "Warning: second"]);
    });

    it("reads the linked disks, next to the snapshot when the linked path is gone", async () => {
      const szx = buildSzx(state128(), {
        machineId: 5,
        extra: [szxBlock("+3", [2, 0]), szxDskBlock(0, "C:\\old\\game.dsk"), szxDskBlock(1, "lost.dsk")]
      });
      const disk = new Uint8Array([1, 2, 3]);
      const { context, lines, loadSpectrumSnapshot } = contextFor(undefined, { "/p/s.szx": szx, "/p/game.dsk": disk });
      loadSpectrumSnapshot.mockResolvedValue({ pc: 0, machineId: MI_SPECTRUM_3E, machineName: "x", rebuilt: false, format: "szx", warnings: [] });
      await new SpectrumSnapshotCommand().execute(context, { file: "/p/s.szx" } as any);
      expect(loadSpectrumSnapshot.mock.calls[0][3].disks).toEqual([{ drive: 0, fileName: "/p/game.dsk", contents: disk }]);
      expect(lines.join("\n")).toMatch(/lost\.dsk.*not found; drive B/);
    });
  });

  it("finds disk candidates as written and beside the snapshot", () => {
    expect(diskCandidates("/p/s.szx", "/abs/a.dsk")).toEqual(["/abs/a.dsk", "/p/a.dsk"]);
    expect(diskCandidates("/p/s.szx", "sub/a.dsk")).toEqual(["/p/sub/a.dsk", "/p/a.dsk"]);
    expect(diskCandidates("C:\\g\\s.szx", "a.dsk")).toEqual(["C:\\g\\a.dsk"]);
  });

  describe("command text (the menus, the viewer and the Explorer)", () => {
    it("quotes the path and adds the option's flag", () => {
      expect(spectrumSnapshotCommandText("/p/my game.sna", "run")).toBe('zx-snapshot "/p/my game.sna" -r');
      expect(spectrumSnapshotCommandText("/p/a.z80", "debug")).toBe('zx-snapshot "/p/a.z80" -d');
    });

    it("survives the IDE's tokenizer with spaces and Windows separators", () => {
      for (const path of ["/project/my game.szx", "C:\\Users\\me\\My Games\\jsw.z80"]) {
        const tokens = parseCommand(spectrumSnapshotCommandText(path, "debug"));
        expect(tokens.map((t) => t.text)).toEqual(["zx-snapshot", path, "-d"]);
      }
    });
  });
});
