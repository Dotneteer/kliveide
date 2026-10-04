/*
 * Saving and loading Klive state files through a real MachineController and the real cores
 * (`.plans/SNAPSHOT_SAVING_AND_STATE_FILES_PLAN.md` Phase 7). The machine service's part is played
 * by a small fake that rebuilds machines the way MachineService does.
 */
import { afterEach, describe, expect, it } from "vitest";

import type { MachineConfigSet } from "@common/machines/info-types";
import type { Store } from "@state/redux-light";
import type { AppState } from "@state/AppState";

import createAppStore from "@state/store";
import { setMachineConfigAction, setMachineTypeAction, setModelTypeAction } from "@state/actions";
import { DebugSupport } from "@emu/machines/DebugSupport";
import { MachineController } from "@emu/machines/MachineController";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { MC_DISK_SUPPORT, MI_SPECTRUM_128, MI_SPECTRUM_3E, MI_SPECTRUM_48 } from "@common/machines/constants";
import { MEDIA_DISK_A, MEDIA_SD_CARD, MEDIA_TAPE } from "@common/structs/project-const";
import { readKliveStateFile, writeKliveStateFile } from "@common/machineState/kliveStateFile";
import { parseSpectrumSnapshot } from "@common/spectrum/snapshot/parseSpectrumSnapshot";
import {
  loadMachineStateFile,
  saveMachineStateFile,
  type MachineStatePorts
} from "@renderer/appEmu/machines/machineStateFile";
import { ResolvingMessenger } from "../../harness/z88";
import { createHarnessSpectrumMachine } from "../../harness/sp128";
import { buildSzx, patternBank, state128, state48, szxBlock } from "../../spectrum/snapshot/builders";
import { loadSpectrumSnapshot } from "@renderer/appEmu/machines/spectrumSnapshotLoad";

class FakeEmulator {
  readonly store: Store<AppState> = createAppStore("emu");
  controller?: MachineController;
  rebuilds: string[] = [];
  media: Record<string, string | undefined> = {};

  readonly ports: MachineStatePorts = {
    getMachineController: () => this.controller,
    getEmulatorState: () => this.store.getState().emulatorState ?? {},
    setMachineType: async (machineId, modelId, config) => {
      this.rebuilds.push(`${machineId}/${modelId ?? ""}`);
      await this.build(machineId, modelId, config);
      return true;
    },
    setTape: async () => {},
    setDisk: async () => {},
    getMediaFiles: () => this.media
  };

  async build(machineId: string, modelId: string | undefined, config: MachineConfigSet): Promise<void> {
    await this.controller?.stop();
    this.controller?.dispose();
    const machine = await createHarnessSpectrumMachine(machineId, modelId, config);
    this.controller = new MachineController(this.store, new ResolvingMessenger(), machine as any);
    this.controller.debugSupport = new DebugSupport(this.store);
    this.store.dispatch(setMachineTypeAction(machineId), "emu");
    this.store.dispatch(setModelTypeAction(modelId), "emu");
    this.store.dispatch(setMachineConfigAction(config), "emu");
  }

  get machine(): any {
    return this.controller!.machine;
  }

  async until(state: MachineControllerState, timeoutMs = 5000): Promise<void> {
    const start = Date.now();
    while (this.controller?.state !== state) {
      if (Date.now() - start > timeoutMs) throw new Error(`Timed out waiting for ${MachineControllerState[state]}`);
      await new Promise((r) => setTimeout(r, 5));
    }
  }
}

const emulators: FakeEmulator[] = [];
afterEach(async () => {
  for (const emu of emulators.splice(0)) {
    await emu.controller?.stop();
    emu.controller?.dispose();
  }
});

async function emulator(machineId: string, modelId?: string, config: MachineConfigSet = {}): Promise<FakeEmulator> {
  const emu = new FakeEmulator();
  await emu.build(machineId, modelId, config);
  emulators.push(emu);
  return emu;
}

/** A 48K program that loops at $8100 (JR $) with interrupts off */
function loop(paged = false): Uint8Array {
  const base = paged ? state128({ port7ffd: 0x14 }) : state48();
  const ram = new Map(base.ram);
  const b2 = patternBank(0x22);
  b2.set([0x18, 0xfe], 0x100);
  ram.set(2, b2);
  return buildSzx({ ...base, ram, pc: 0x8100, iff1: false, iff2: false }, { machineId: paged ? 2 : 1 });
}

/** An emulator paused at $8100 of a loaded program */
async function pausedAtLoop(machineId = MI_SPECTRUM_48, modelId: string | undefined = "pal"): Promise<FakeEmulator> {
  const emu = await emulator(machineId, modelId);
  await loadSpectrumSnapshot(emu.ports, "p.szx", loop(machineId !== MI_SPECTRUM_48), "debug");
  await emu.until(MachineControllerState.Paused);
  return emu;
}

describe("saving a state", () => {
  it("refuses a machine that has not started", async () => {
    const emu = await emulator(MI_SPECTRUM_48, "pal");
    await expect(saveMachineStateFile(emu.ports, { kliveVersion: "0.62.1" })).rejects.toThrow(/start it first/);
  });

  it("writes the header, a thumbnail, the media and a portable .szx", async () => {
    const emu = await pausedAtLoop();
    emu.media = { [MEDIA_TAPE]: "/t/game.tzx" };
    const result = await saveMachineStateFile(emu.ports, { kliveVersion: "0.62.1" });
    expect(emu.controller!.state).toBe(MachineControllerState.Paused);
    expect(result).toMatchObject({ machineName: "ZX Spectrum 48K", pc: 0x8100, warnings: [] });
    const file = readKliveStateFile(result.bytes);
    expect(file.header).toMatchObject({ machineId: MI_SPECTRUM_48, modelId: "pal", coreId: "sp48", pc: 0x8100 });
    expect(file.header.fingerprint).toMatch(/^[0-9a-f]{32}$/);
    expect(file.thumbnail!.width).toBeGreaterThan(100);
    expect(file.media).toEqual([{ id: MEDIA_TAPE, fileName: "/t/game.tzx" }]);
    expect(parseSpectrumSnapshot("x.szx", file.szx!).cpu.pc).toBe(0x8100);
  });

  it("pauses a running machine for the capture and lets it run on", async () => {
    const emu = await pausedAtLoop();
    await emu.controller!.start();
    await emu.until(MachineControllerState.Running);
    await saveMachineStateFile(emu.ports, { kliveVersion: "0.62.1" });
    expect(emu.controller!.state).toBe(MachineControllerState.Running);
  });
});

describe("loading a state", () => {
  it("switches to the machine and model it was saved on, and debug-stops at PC", async () => {
    const source = await pausedAtLoop(MI_SPECTRUM_128, undefined);
    const bytes = (await saveMachineStateFile(source.ports, { kliveVersion: "0.62.1" })).bytes;
    const emu = await emulator(MI_SPECTRUM_48, "pal");
    const result = await loadMachineStateFile(emu.ports, "s.kls", bytes, "debug");
    await emu.until(MachineControllerState.Paused);
    expect(result).toMatchObject({ machineId: MI_SPECTRUM_128, rebuilt: true, path: "image", pc: 0x8100 });
    expect(emu.rebuilds).toEqual([`${MI_SPECTRUM_128}/`]);
    expect(emu.machine.pc).toBe(0x8100);
    // --- Exactly the saved machine: its image equals the source's
    expect(emu.machine.saveMachineState().image).toEqual(source.machine.saveMachineState().image);
  });

  it("keeps the machine when it already fits, and runs in run mode", async () => {
    const source = await pausedAtLoop();
    const bytes = (await saveMachineStateFile(source.ports, { kliveVersion: "0.62.1" })).bytes;
    const emu = await pausedAtLoop();
    const result = await loadMachineStateFile(emu.ports, "s.kls", bytes, "run");
    expect(result.rebuilt).toBe(false);
    expect(emu.controller!.state).toBe(MachineControllerState.Running);
  });

  it("loads over a running machine (it is stopped first)", async () => {
    const source = await pausedAtLoop();
    const bytes = (await saveMachineStateFile(source.ports, { kliveVersion: "0.62.1" })).bytes;
    const emu = await pausedAtLoop();
    await emu.controller!.start();
    await emu.until(MachineControllerState.Running);
    await loadMachineStateFile(emu.ports, "s.kls", bytes, "debug");
    await emu.until(MachineControllerState.Paused);
    expect(emu.machine.pc).toBe(0x8100);
  });

  it("falls back to the .szx part when the core's layout differs (another Klive version)", async () => {
    const source = await pausedAtLoop();
    const saved = readKliveStateFile((await saveMachineStateFile(source.ports, { kliveVersion: "0.61.0" })).bytes);
    const foreign = writeKliveStateFile({ ...saved, header: { ...saved.header, fingerprint: "0".repeat(32) } });
    const emu = await emulator(MI_SPECTRUM_48, "pal");
    const result = await loadMachineStateFile(emu.ports, "s.kls", foreign, "debug");
    await emu.until(MachineControllerState.Paused);
    expect(result.path).toBe("szx");
    expect(result.warnings[0]).toMatch(/Klive 0\.61\.0/);
    expect(emu.machine.pc).toBe(0x8100);
  });

  it("refuses a state from another layout that has no .szx part", async () => {
    const source = await pausedAtLoop();
    const saved = readKliveStateFile((await saveMachineStateFile(source.ports, { kliveVersion: "0.61.0" })).bytes);
    const foreign = writeKliveStateFile({ ...saved, szx: undefined, header: { ...saved.header, fingerprint: "0".repeat(32) } });
    const emu = await emulator(MI_SPECTRUM_48, "pal");
    await expect(loadMachineStateFile(emu.ports, "s.kls", foreign, "debug")).rejects.toThrow(
      /another memory layout.*Klive 0\.61\.0/
    );
  });

  it("asks before loading over a changed SD card, and loads when told to", async () => {
    const source = await pausedAtLoop();
    const saved = readKliveStateFile((await saveMachineStateFile(source.ports, { kliveVersion: "0.62.1" })).bytes);
    const withCard = writeKliveStateFile({
      ...saved,
      media: [{ id: MEDIA_SD_CARD, fileName: "/c/ks2.cim", fingerprint: "a".repeat(32), size: 10 }]
    });
    const emu = await emulator(MI_SPECTRUM_48, "pal");
    const changed = { id: MEDIA_SD_CARD, fileName: "/c/ks2.cim", fingerprint: "b".repeat(32), size: 10 };
    const asked = await loadMachineStateFile(emu.ports, "s.kls", withCard, "debug", { currentSdCard: changed });
    expect(asked.needsConfirmation).toMatch(/has changed/);
    expect(emu.controller!.state).not.toBe(MachineControllerState.Paused);
    const loaded = await loadMachineStateFile(emu.ports, "s.kls", withCard, "debug", {
      currentSdCard: changed,
      acceptChangedSdCard: true
    });
    await emu.until(MachineControllerState.Paused);
    expect(loaded.warnings.join()).toMatch(/SD card image has changed/);
    await expect(loadMachineStateFile(emu.ports, "s.kls", withCard, "debug")).rejects.toThrow(/not available/);
  });

  it("detaches a restored +3 disk from its file (D11)", async () => {
    const emu = await emulator(MI_SPECTRUM_3E, "fdd1", { [MC_DISK_SUPPORT]: 1 });
    await loadSpectrumSnapshot(
      emu.ports,
      "p.szx",
      buildSzx(state128(), { machineId: 6, extra: [szxBlock("+3", [1, 0])] }),
      "debug"
    );
    await emu.until(MachineControllerState.Paused);
    emu.media = { [MEDIA_DISK_A]: "/d/a.dsk" };
    const bytes = (await saveMachineStateFile(emu.ports, { kliveVersion: "0.62.1" })).bytes;
    (emu.machine as any).wasmV2DiskPayloads[0] = { data: new Uint8Array(1), sectorLength: 512 };
    const result = await loadMachineStateFile(emu.ports, "s.kls", bytes, "debug");
    await emu.until(MachineControllerState.Paused);
    expect((emu.machine as any).wasmV2DiskPayloads.length).toBe(0);
    expect(result.warnings.join()).toMatch(/Disk A .*detached/);
  });
});

describe("quick save and restore (D19)", () => {
  it("save, run, restore, run equals a straight run", async () => {
    const emu = await pausedAtLoop();
    const { quickSaveMachineState, quickRestoreMachineState, hasQuickMachineState } = await import(
      "@renderer/appEmu/machines/machineStateFile"
    );
    expect(hasQuickMachineState(emu.ports)).toBe(false);
    const saved = await quickSaveMachineState(emu.ports);
    expect(saved).toMatchObject({ machineName: "ZX Spectrum 48K", pc: 0x8100 });
    const before = emu.machine.saveMachineState().image;
    await emu.controller!.start();
    await emu.until(MachineControllerState.Running);
    await new Promise((r) => setTimeout(r, 60));
    await quickRestoreMachineState(emu.ports);
    expect(emu.controller!.state).toBe(MachineControllerState.Paused);
    expect(emu.machine.saveMachineState().image).toEqual(before);
  });

  it("a rebuilt machine has an empty slot", async () => {
    const emu = await pausedAtLoop();
    const { quickSaveMachineState, quickRestoreMachineState } = await import(
      "@renderer/appEmu/machines/machineStateFile"
    );
    await quickSaveMachineState(emu.ports);
    await emu.ports.setMachineType(MI_SPECTRUM_128, undefined, {});
    await expect(quickRestoreMachineState(emu.ports)).rejects.toThrow(/No state has been quick-saved/);
  });

  it("refuses a machine that has not started", async () => {
    const emu = await emulator(MI_SPECTRUM_48, "pal");
    const { quickSaveMachineState } = await import("@renderer/appEmu/machines/machineStateFile");
    await expect(quickSaveMachineState(emu.ports)).rejects.toThrow(/start it first/);
  });
});
