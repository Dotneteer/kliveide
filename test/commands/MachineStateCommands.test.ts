import { describe, it, expect, vi } from "vitest";

import { MI_SPECTRUM_48, MI_SPECTRUM_128, MI_Z88, MI_ZX81, MI_ZXNEXT, MI_C64 } from "@common/machines/constants";
import {
  isMachineStatePath,
  machineStateProjectGuard,
  StateLoadCommand,
  StateSaveCommand
} from "@renderer/appIde/commands/MachineStateCommands";
import { writeKliveStateFile } from "@common/machineState/kliveStateFile";
import { ValidationMessageType } from "@renderer/abstractions/ValidationMessageType";

/*
 * The `state-save` and `state-load` IDE commands (`.plans/SNAPSHOT_SAVING_AND_STATE_FILES_PLAN.md`
 * §4.8, Phase 8). The emulator is mocked; `test/wasm/state/machine-state-flow.test.ts` covers it.
 */

function stateBytes(machineId = MI_SPECTRUM_48, media: object[] = []): Uint8Array {
  return writeKliveStateFile({
    header: {
      machineId,
      kliveVersion: "0.62.1",
      coreId: machineId,
      fingerprint: "a".repeat(32),
      memorySize: 16,
      savedAt: "2026-10-04T10:00:00.000Z",
      pc: 0x8000
    },
    image: new Uint8Array(16),
    host: {},
    media: media as never
  });
}

type Setup = {
  machineId?: string;
  project?: boolean;
  files?: Record<string, Uint8Array>;
  loadResult?: object;
  saveError?: string;
};

function contextFor(setup: Setup = {}) {
  const lines: string[] = [];
  const files = setup.files ?? {};
  const readBinaryFile = vi.fn(async (path: string) => {
    if (!files[path]) throw new Error(`Error: ENOENT: no such file, open '${path}'`);
    return files[path];
  });
  const saveBinaryFile = vi.fn(async (path: string) => path);
  const getSdCardFingerprint = vi.fn(async () => ({ fileName: "/c/ks2.cim", size: 1, fingerprint: "f".repeat(32) }));
  const saveMachineStateFile = vi.fn(async () => {
    if (setup.saveError) throw new Error(`Error: ${setup.saveError}`);
    return { bytes: Uint8Array.from([7]), machineName: "ZX Spectrum 48K", pc: 0x8123, warnings: [] };
  });
  const loadMachineStateFile = vi.fn(async () => ({
    machineId: MI_SPECTRUM_48,
    machineName: "ZX Spectrum 48K",
    pc: 0x8000,
    rebuilt: false,
    path: "image",
    warnings: [],
    ...setup.loadResult
  }));
  const context: any = {
    store: {
      getState: () => ({
        emulatorState: { machineId: setup.machineId ?? MI_SPECTRUM_48 },
        project: { isKliveProject: !!setup.project }
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
    emuApi: { saveMachineStateFile, loadMachineStateFile },
    mainApi: { readBinaryFile, saveBinaryFile, getSdCardFingerprint, getAppVersion: async () => "0.62.1" }
  };
  return { context, lines, saveBinaryFile, saveMachineStateFile, loadMachineStateFile, getSdCardFingerprint };
}

const errors = (messages: { type: ValidationMessageType; message: string }[]) =>
  messages.filter((m) => m.type === ValidationMessageType.Error).map((m) => m.message);

describe("state-save", () => {
  it("is registered with its alias and usage", () => {
    const c = new StateSaveCommand();
    expect([c.id, c.aliases, c.usage]).toEqual(["state-save", ["ssave"], "state-save <state-file> [-f]"]);
  });

  it("accepts .kls on every state machine, and refuses other extensions and the C64", async () => {
    for (const machineId of [MI_SPECTRUM_48, MI_SPECTRUM_128, MI_ZXNEXT, MI_Z88, MI_ZX81]) {
      const { context } = contextFor({ machineId });
      expect(errors(await new StateSaveCommand().validateCommandArgs(context, { file: "/p/a.KLS" }))).toEqual([]);
    }
    const { context } = contextFor({ machineId: MI_C64 });
    expect(errors(await new StateSaveCommand().validateCommandArgs(context, { file: "/p/a.szx" }))).toEqual([
      "The state file must have the .kls extension.",
      "This machine cannot save its state."
    ]);
    expect(isMachineStatePath("x.kls")).toBe(true);
    expect(isMachineStatePath("x.szx")).toBe(false);
  });

  it("saves and writes the file", async () => {
    const { context, saveBinaryFile, saveMachineStateFile, getSdCardFingerprint } = contextFor();
    const result = await new StateSaveCommand().execute(context, { file: "/p/a.kls" });
    expect(result.success).toBe(true);
    expect(result.finalMessage).toBe("Machine state saved to /p/a.kls (ZX Spectrum 48K, PC $8123).");
    expect(saveMachineStateFile).toHaveBeenCalledWith({ kliveVersion: "0.62.1", sdCard: undefined });
    expect(getSdCardFingerprint).not.toHaveBeenCalled();
    expect(saveBinaryFile).toHaveBeenCalledWith("/p/a.kls", Uint8Array.from([7]));
  });

  it("sends the SD card's fingerprint for a Next", async () => {
    const { context, saveMachineStateFile } = contextFor({ machineId: MI_ZXNEXT });
    await new StateSaveCommand().execute(context, { file: "/p/a.kls" });
    expect(saveMachineStateFile).toHaveBeenCalledWith({
      kliveVersion: "0.62.1",
      sdCard: { fileName: "/c/ks2.cim", size: 1, fingerprint: "f".repeat(32) }
    });
  });

  it("refuses to replace a file without -f, and reports the emulator's refusal", async () => {
    let setup = contextFor({ files: { "/p/a.kls": new Uint8Array(1) } });
    let result = await new StateSaveCommand().execute(setup.context, { file: "/p/a.kls" });
    expect(result.finalMessage).toBe("/p/a.kls already exists; use -f to replace it.");
    setup = contextFor({ saveError: "The machine has no state to save; start it first" });
    result = await new StateSaveCommand().execute(setup.context, { file: "/p/a.kls", "-f": true });
    expect(result.finalMessage).toBe("Could not save the state: The machine has no state to save; start it first");
    expect(setup.saveBinaryFile).not.toHaveBeenCalled();
  });
});

describe("state-load", () => {
  it("is registered with its alias and usage", () => {
    const c = new StateLoadCommand();
    expect([c.id, c.aliases, c.usage]).toEqual(["state-load", ["sload"], "state-load <state-file> [-r | -d] [-y]"]);
  });

  it("validates the path and the options", async () => {
    const { context } = contextFor();
    const v = (args: object) => new StateLoadCommand().validateCommandArgs(context, args as never);
    expect(errors(await v({ file: "/p/a.kls", "-r": true, "-y": true }))).toEqual([]);
    expect(errors(await v({ file: "/p/a.kls", "-r": true, "-d": true }))).toEqual(["Use only one of -r and -d."]);
    expect(errors(await v({ file: "/p/a.sna" }))).toEqual(["The file to load must be a Klive state file (.kls)."]);
  });

  it("loads, debugging by default, and reports a rebuild and warnings", async () => {
    const { context, lines, loadMachineStateFile } = contextFor({
      files: { "/p/a.kls": stateBytes(MI_SPECTRUM_128) },
      loadResult: { rebuilt: true, machineName: "ZX Spectrum 128K", warnings: ["Disk A is the one in the state"] }
    });
    const result = await new StateLoadCommand().execute(context, { file: "/p/a.kls" });
    expect(result.finalMessage).toBe("Machine state /p/a.kls loaded, stopped at PC $8000.");
    expect(loadMachineStateFile).toHaveBeenCalledWith("/p/a.kls", expect.any(Uint8Array), "debug", {
      currentSdCard: undefined,
      acceptChangedSdCard: false
    });
    expect(lines).toEqual(["Machine switched to the ZX Spectrum 128K.", "Warning: Disk A is the one in the state"]);
  });

  it("says when the portable .szx part was used", async () => {
    const { context } = contextFor({ files: { "/p/a.kls": stateBytes() }, loadResult: { path: "szx" } });
    const result = await new StateLoadCommand().execute(context, { file: "/p/a.kls", "-r": true });
    expect(result.finalMessage).toBe("Machine state /p/a.kls loaded from its .szx part, running PC $8000.");
  });

  it("asks for -y when the SD card has changed, and passes the live card's fingerprint", async () => {
    const files = { "/p/a.kls": stateBytes(MI_ZXNEXT, [{ id: "sdCard", fileName: "/c/ks2.cim", fingerprint: "e".repeat(32) }]) };
    const { context, loadMachineStateFile } = contextFor({
      machineId: MI_ZXNEXT,
      files,
      loadResult: { needsConfirmation: "The SD card image (/c/ks2.cim) has changed since the state was saved" }
    });
    const result = await new StateLoadCommand().execute(context, { file: "/p/a.kls" });
    expect(result.success).toBe(false);
    expect(result.finalMessage).toMatch(/has changed .* Use -y to load it anyway\.$/);
    expect(loadMachineStateFile.mock.calls[0][3]).toEqual({
      currentSdCard: { fileName: "/c/ks2.cim", size: 1, fingerprint: "f".repeat(32) },
      acceptChangedSdCard: false
    });
  });

  it("refuses a state of another machine type while a project is open (D10)", async () => {
    const { context, loadMachineStateFile } = contextFor({
      project: true,
      files: { "/p/a.kls": stateBytes(MI_Z88) }
    });
    const result = await new StateLoadCommand().execute(context, { file: "/p/a.kls" });
    expect(result.finalMessage).toMatch(/project targets the .*saved on the Cambridge Z88/);
    expect(loadMachineStateFile).not.toHaveBeenCalled();
    expect(machineStateProjectGuard({ project: { isKliveProject: false } }, MI_Z88)).toBeUndefined();
  });

  it("reports a file that is not a state", async () => {
    const { context } = contextFor({ files: { "/p/a.kls": new Uint8Array([1, 2, 3]) } });
    const result = await new StateLoadCommand().execute(context, { file: "/p/a.kls" });
    expect(result.finalMessage).toMatch(/is not a valid state file: Not a Klive state file/);
  });
});
