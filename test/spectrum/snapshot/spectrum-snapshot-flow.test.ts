/*
 * The emulator-side snapshot load (`.plans/ZX_SPECTRUM_SNAPSHOT_PLAN.md` §4.5, Phase 4): fitting the
 * machine to the snapshot, media first, restoring the state Paused, and the run / debug modes - on a
 * real `MachineController` driving the real Spectrum cores. Runs in the e2e-cores tier.
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
import {
  MC_DISK_SUPPORT,
  MC_SP3_ROM_SET,
  MC_SP48_ROM_FILE,
  MI_SPECTRUM_128,
  MI_SPECTRUM_3E,
  MI_SPECTRUM_48,
  MI_Z88
} from "@common/machines/constants";
import { parseSpectrumSnapshot } from "@common/spectrum/snapshot/parseSpectrumSnapshot";
import { mapSpectrumSnapshotToKlive } from "@common/spectrum/snapshot/spectrumSnapshotMapping";
import {
  effectiveModelId,
  fitSpectrumMachine,
  loadSpectrumSnapshot,
  type SpectrumSnapshotLoadPorts
} from "@renderer/appEmu/machines/spectrumSnapshotLoad";
import { saveSpectrumSnapshot, type SpectrumSnapshotSavePorts } from "@renderer/appEmu/machines/spectrumSnapshotSave";
import { ResolvingMessenger } from "../../harness/z88";
import { createHarnessSpectrumMachine } from "../../harness/sp128";
import {
  buildSna128,
  buildSna48,
  buildSzx,
  patternBank,
  state128,
  state48,
  szxBlock,
  szxTapeBlock
} from "./builders";

type Event = string;

/** An emulator: the store, the live controller, and the ports the load uses (MachineService's part) */
class FakeEmulator {
  readonly store: Store<AppState> = createAppStore("emu");
  controller?: MachineController;
  rebuilds: { machineId: string; modelId?: string; config: MachineConfigSet }[] = [];
  supersede = false;
  events: Event[] = [];

  readonly ports: SpectrumSnapshotLoadPorts = {
    getMachineController: () => this.controller,
    getEmulatorState: () => this.store.getState().emulatorState ?? {},
    setMachineType: async (machineId, modelId, config) => {
      this.rebuilds.push({ machineId, modelId, config });
      if (this.supersede) return false;
      await this.build(machineId, modelId, config);
      return true;
    },
    setTape: async (file) => {
      this.events.push(`tape:${file}`);
    },
    setDisk: async (drive, file) => {
      this.events.push(`disk${drive}:${file}`);
    }
  };

  /** Builds the machine as MachineService does: setup, hard reset, then publish the state */
  async build(machineId: string, modelId: string | undefined, config: MachineConfigSet): Promise<void> {
    await this.controller?.stop();
    this.controller?.dispose();
    if (machineId === MI_Z88) {
      this.controller = undefined;
    } else {
      const machine = await createHarnessSpectrumMachine(machineId, modelId, config);
      this.controller = new MachineController(this.store, new ResolvingMessenger(), machine as any);
      this.controller.debugSupport = new DebugSupport(this.store);
      this.controller.stateChanged.on(({ newState }) => this.events.push(`state:${MachineControllerState[newState]}`));
    }
    this.store.dispatch(setMachineTypeAction(machineId), "emu");
    this.store.dispatch(setModelTypeAction(modelId), "emu");
    this.store.dispatch(setMachineConfigAction(config), "emu");
  }

  get machine() {
    return this.controller!.machine;
  }

  /** Waits until the controller reaches a state */
  async until(state: MachineControllerState, timeoutMs = 5000): Promise<void> {
    const start = Date.now();
    while (this.controller?.state !== state) {
      if (Date.now() - start > timeoutMs) {
        throw new Error(`Timed out waiting for ${MachineControllerState[state]}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 5));
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

/** A 48K snapshot whose program loops at $8100 (JR $) */
function loop48(): Uint8Array {
  const ram = new Map(state48().ram);
  const b2 = patternBank(0x22);
  b2.set([0x18, 0xfe], 0x100);
  ram.set(2, b2);
  return buildSzx(state48({ ram, pc: 0x8100, iff1: false, iff2: false }), { machineId: 1 });
}

function loop128(): Uint8Array {
  const t = state128();
  const b2 = patternBank(0x22);
  b2.set([0x18, 0xfe], 0x100);
  t.ram.set(2, b2);
  return buildSna128({ ...t, pc: 0x8100, iff1: false, iff2: false });
}

describe("fitting the machine", () => {
  const map = (bytes: Uint8Array, name: string) => {
    const s = parseSpectrumSnapshot(name, bytes);
    return { s, m: mapSpectrumSnapshotToKlive(s) };
  };

  it("keeps a machine whose type and model fit", () => {
    const { s, m } = map(buildSna48(state48()), "a.sna");
    expect(fitSpectrumMachine({ machineId: MI_SPECTRUM_48, modelId: "ntsc" }, m, s, false).rebuild).toBe(false);
    expect(fitSpectrumMachine({ machineId: MI_SPECTRUM_48, modelId: "pal" }, m, s, false).rebuild).toBe(false);
  });

  it("reads a model-less machine's model from its configuration (a `newp` project)", () => {
    const { s, m } = map(buildSna48(state48()), "a.sna");
    expect(fitSpectrumMachine({ machineId: MI_SPECTRUM_48, config: {} }, m, s, true)).toMatchObject({
      rebuild: false,
      warnings: []
    });
    const p3 = map(buildSzx(state128(), { machineId: 5 }), "a.szx");
    expect(fitSpectrumMachine({ machineId: MI_SPECTRUM_3E, config: { diskSupport: 1 } }, p3.m, p3.s, true)).toMatchObject({
      rebuild: false,
      modelId: "fdd1",
      warnings: []
    });
  });

  it("rebuilds another machine type with the preferred model", () => {
    const { s, m } = map(buildSna48(state48()), "a.sna");
    const fit = fitSpectrumMachine({ machineId: MI_Z88, modelId: "x" }, m, s, false);
    expect(fit).toMatchObject({ rebuild: true, machineId: MI_SPECTRUM_48, modelId: "pal" });
  });

  it("rebuilds a 16K for a 48K snapshot, keeping the machine's other settings", () => {
    const { s, m } = map(buildSna48(state48()), "a.sna");
    const fit = fitSpectrumMachine(
      { machineId: MI_SPECTRUM_48, modelId: "pal-16k", config: { [MC_SP48_ROM_FILE]: "x.rom", memSize: 16 } },
      m,
      s,
      false
    );
    expect(fit.rebuild).toBe(true);
    expect(fit.modelId).toBe("pal");
    expect(fit.config[MC_SP48_ROM_FILE]).toBe("x.rom");
  });

  it("keeps the project's model with a warning (keepModel), but refuses a 16K for 48K RAM", () => {
    const { s, m } = map(buildSzx(state128(), { machineId: 5 }), "a.szx");
    const fit = fitSpectrumMachine({ machineId: MI_SPECTRUM_3E, modelId: "nofdd" }, m, s, true);
    expect(fit.rebuild).toBe(false);
    expect(fit.modelId).toBe("nofdd");
    expect(fit.warnings.join()).toMatch(/project's ZX Spectrum \+2E/);
    const s48 = map(buildSna48(state48()), "a.sna");
    expect(() => fitSpectrumMachine({ machineId: MI_SPECTRUM_48, modelId: "pal-16k" }, s48.m, s48.s, true)).toThrow(/16K/);
  });
});

describe("fitting the machine: the Amstrad +2A/+3 models (.plans/PLUS3_AMSTRAD_ROMS_PLAN.md Phase 3)", () => {
  const map = (bytes: Uint8Array, name: string) => {
    const s = parseSpectrumSnapshot(name, bytes);
    return { s, m: mapSpectrumSnapshotToKlive(s) };
  };
  const plus3 = () => map(buildSzx(state128(), { machineId: 5, extra: [szxBlock("+3", [1, 0])] }), "a.szx");
  const plus2a = () => map(buildSzx(state128(), { machineId: 4 }), "a.szx");

  it("a +3 snapshot opens on the +3E by default", () => {
    const { s, m } = plus3();
    expect(fitSpectrumMachine({ machineId: MI_SPECTRUM_48, modelId: "pal" }, m, s, false)).toMatchObject({
      rebuild: true,
      modelId: "fdd1",
      config: { [MC_DISK_SUPPORT]: 1, [MC_SP3_ROM_SET]: "plus3e" }
    });
  });

  it.each(["plus3-fdd1", "plus3-v40-fdd2", "plus3-es-fdd1"])("a +3 snapshot stays on the project's %s", (modelId) => {
    const { s, m } = plus3();
    expect(fitSpectrumMachine({ machineId: MI_SPECTRUM_3E, modelId }, m, s, true)).toMatchObject({
      rebuild: false,
      modelId,
      warnings: []
    });
  });

  it("a +2A snapshot stays on the +2A models", () => {
    const { s, m } = plus2a();
    expect(fitSpectrumMachine({ machineId: MI_SPECTRUM_3E, modelId: "plus2a-es" }, m, s, false).rebuild).toBe(false);
  });

  it("reads a model-less Amstrad machine's model from its ROM set", () => {
    const { s, m } = plus3();
    const fit = fitSpectrumMachine(
      { machineId: MI_SPECTRUM_3E, config: { [MC_DISK_SUPPORT]: 2, [MC_SP3_ROM_SET]: "amstrad40" } },
      m,
      s,
      true
    );
    expect(fit).toMatchObject({ rebuild: false, modelId: "plus3-v40-fdd2" });
    expect(effectiveModelId(MI_SPECTRUM_3E, { [MC_DISK_SUPPORT]: 0 })).toBe("nofdd");
    expect(effectiveModelId(MI_SPECTRUM_3E, { [MC_DISK_SUPPORT]: 0, [MC_SP3_ROM_SET]: "amstrad41es" })).toBe("plus2a-es");
  });

  it("rebuilding from an Amstrad model to a +E model does not carry the Amstrad ROM set over", () => {
    const { s, m } = map(buildSzx(state128(), { machineId: 6, extra: [szxBlock("+3", [1, 0])] }), "a.szx");
    const fit = fitSpectrumMachine(
      { machineId: MI_SPECTRUM_3E, modelId: "plus2a", config: { [MC_DISK_SUPPORT]: 0, [MC_SP3_ROM_SET]: "amstrad41" } },
      m,
      s,
      false
    );
    expect(fit).toMatchObject({ rebuild: true, modelId: "fdd1", config: { [MC_SP3_ROM_SET]: "plus3e" } });
  });
});

describe("loading through the controller", () => {
  it("debug: switches a Z88 to a 48K and stops at PC before running it", async () => {
    const emu = await emulator(MI_Z88);
    const result = await loadSpectrumSnapshot(emu.ports, "a.szx", loop48(), "debug");
    await emu.until(MachineControllerState.Paused);
    expect(result).toMatchObject({ pc: 0x8100, machineId: MI_SPECTRUM_48, modelId: "pal", rebuilt: true, format: "szx" });
    expect(emu.store.getState().emulatorState.machineId).toBe(MI_SPECTRUM_48);
    expect(emu.machine.pc).toBe(0x8100);
    expect(emu.controller!.isDebugging).toBe(true);
    expect(emu.controller!.debugSupport!.breakpoints).toEqual([]);
    // --- Paused by the restore and by the breakpoint, at the same tact
    const tacts = emu.machine.tacts;
    await emu.controller!.stepInto();
    await emu.until(MachineControllerState.Paused);
    expect(emu.machine.tacts).toBeGreaterThan(tacts);
    expect(emu.machine.pc).toBe(0x8100); // --- JR $ jumps to itself
  });

  it("run: continues from the snapshot, not from a reset", async () => {
    const emu = await emulator(MI_SPECTRUM_48, "pal");
    await loadSpectrumSnapshot(emu.ports, "a.szx", loop48(), "run");
    expect(emu.controller!.state).toBe(MachineControllerState.Running);
    await new Promise((resolve) => setTimeout(resolve, 100));
    await emu.controller!.pause();
    expect(emu.machine.frames).toBeGreaterThan(0);
    // --- Interrupts are off, so the loop never leaves $8100
    expect(emu.machine.pc).toBe(0x8100);
  });

  it("switches between 48K, 128K and +3E as the snapshots ask", async () => {
    const emu = await emulator(MI_SPECTRUM_48, "pal");
    let r = await loadSpectrumSnapshot(emu.ports, "a.sna", loop128(), "debug");
    await emu.until(MachineControllerState.Paused);
    expect(r).toMatchObject({ machineId: MI_SPECTRUM_128, rebuilt: true });
    expect(emu.machine.pc).toBe(0x8100);
    // --- A +3e with a drive (without the +3 block it would be Klive's own +2E, which has none)
    r = await loadSpectrumSnapshot(
      emu.ports,
      "a.szx",
      buildSzx(state128(), { machineId: 6, extra: [szxBlock("+3", [1, 0])] }),
      "debug"
    );
    await emu.until(MachineControllerState.Paused);
    expect(r).toMatchObject({ machineId: MI_SPECTRUM_3E, modelId: "fdd1", rebuilt: true });
    r = await loadSpectrumSnapshot(emu.ports, "a.szx", loop48(), "debug");
    await emu.until(MachineControllerState.Paused);
    expect(r).toMatchObject({ machineId: MI_SPECTRUM_48, rebuilt: true });
    // --- The same machine again: no rebuild
    r = await loadSpectrumSnapshot(emu.ports, "a.szx", loop48(), "debug");
    await emu.until(MachineControllerState.Paused);
    expect(r.rebuilt).toBe(false);
  });

  it("reloads over a running machine and really stops it", async () => {
    const emu = await emulator(MI_SPECTRUM_48, "pal");
    await loadSpectrumSnapshot(emu.ports, "a.szx", loop48(), "run");
    await new Promise((resolve) => setTimeout(resolve, 50));
    await loadSpectrumSnapshot(emu.ports, "a.szx", loop48(), "debug");
    await emu.until(MachineControllerState.Paused);
    const frames = emu.machine.frames;
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(emu.machine.frames).toBe(frames);
    expect(emu.machine.pc).toBe(0x8100);
  });

  it("refuses an unsupported machine, leaving the machine untouched", async () => {
    const emu = await emulator(MI_SPECTRUM_48, "pal");
    await expect(
      loadSpectrumSnapshot(emu.ports, "a.szx", buildSzx(state128(), { machineId: 7 }), "run")
    ).rejects.toThrow(/Pentagon 128/);
    expect(emu.rebuilds).toEqual([]);
    expect(emu.events.filter((e) => e.startsWith("state:"))).toEqual([]);
  });

  it("refuses when a machine change is superseded", async () => {
    const emu = await emulator(MI_Z88);
    emu.supersede = true;
    await expect(loadSpectrumSnapshot(emu.ports, "a.szx", loop48(), "run")).rejects.toThrow(/superseded/);
  });

  it("inserts the embedded tape and the IDE's disks before the restore (trap 12)", async () => {
    const emu = await emulator(MI_SPECTRUM_3E, "fdd2");
    const tape = new Uint8Array([0x13, 0x00, 0x00, 0x03]);
    const bytes = buildSzx(state128(), {
      machineId: 5,
      extra: [szxBlock("+3", [2, 0]), szxTapeBlock(tape, "tap", true)]
    });
    const result = await loadSpectrumSnapshot(emu.ports, "/x/game.szx", bytes, "debug", {
      disks: [
        { drive: 0, fileName: "a.dsk", contents: new Uint8Array(10) },
        { drive: 1, fileName: "b.dsk", contents: new Uint8Array(10) }
      ]
    });
    await emu.until(MachineControllerState.Paused);
    const media = emu.events.filter((e) => !e.startsWith("state:Stopp"));
    expect(media.slice(0, 4)).toEqual([
      "tape:game.szx (embedded tape).tap",
      "disk0:a.dsk",
      "disk1:b.dsk",
      "state:Paused"
    ]);
    expect(result.warnings).toEqual(expect.arrayContaining([expect.stringMatching(/\+3 snapshot/)]));
  });

  it("keeps a +3 snapshot on the project's Amstrad +3, without the +E ROMs warning", async () => {
    const bytes = buildSzx(state128(), { machineId: 5, extra: [szxBlock("+3", [1, 0])] });
    const amstrad = await emulator(MI_SPECTRUM_3E, "plus3-fdd1");
    const onAmstrad = await loadSpectrumSnapshot(amstrad.ports, "a.szx", bytes, "debug");
    await amstrad.until(MachineControllerState.Paused);
    expect(onAmstrad).toMatchObject({ modelId: "plus3-fdd1", rebuilt: false, machineName: "ZX Spectrum +3 (1 FDD)" });
    expect(onAmstrad.warnings.join()).not.toMatch(/\+E ROMs/);
    expect(amstrad.machine.romId).toBe("spp3-41");

    const plusE = await emulator(MI_SPECTRUM_3E, "fdd1");
    const onPlusE = await loadSpectrumSnapshot(plusE.ports, "a.szx", bytes, "debug");
    await plusE.until(MachineControllerState.Paused);
    expect(onPlusE.modelId).toBe("fdd1");
    expect(onPlusE.warnings.join()).toMatch(/\+E ROMs instead of the Amstrad ones/);
  });

  it("warns about a disk for a drive the machine lacks", async () => {
    const emu = await emulator(MI_SPECTRUM_3E, "fdd1");
    const result = await loadSpectrumSnapshot(emu.ports, "a.szx", buildSzx(state128(), { machineId: 6 }), "debug", {
      disks: [{ drive: 1, fileName: "b.dsk", contents: new Uint8Array(10) }]
    });
    await emu.until(MachineControllerState.Paused);
    expect(result.warnings.join()).toMatch(/no drive B/);
    expect(emu.events.some((e) => e.startsWith("disk"))).toBe(false);
  });
});

describe("saving through the controller (.plans/SNAPSHOT_SAVING_AND_STATE_FILES_PLAN.md Phase 3)", () => {
  function savePorts(emu: FakeEmulator, media = {}): SpectrumSnapshotSavePorts {
    return {
      getMachineController: () => emu.controller,
      getMediaFiles: () => media,
      getEmulatorState: () => emu.store.getState().emulatorState ?? {}
    };
  }

  it("refuses a machine that has not started", async () => {
    const emu = await emulator(MI_SPECTRUM_48, "pal");
    await expect(saveSpectrumSnapshot(savePorts(emu), "szx")).rejects.toThrow(/start it first/);
  });

  it("keeps a paused machine paused, and the file loads back to the same PC", async () => {
    const emu = await emulator(MI_SPECTRUM_48, "pal");
    await loadSpectrumSnapshot(emu.ports, "a.szx", loop48(), "debug");
    await emu.until(MachineControllerState.Paused);
    const result = await saveSpectrumSnapshot(savePorts(emu), "szx");
    expect(emu.controller!.state).toBe(MachineControllerState.Paused);
    expect(result).toMatchObject({ format: "szx", pc: 0x8100, machineName: "ZX Spectrum 48K", losses: [] });
    const reread = parseSpectrumSnapshot("a.szx", result.bytes);
    expect(reread.cpu.pc).toBe(0x8100);
    expect(reread.machine).toBe("48k");
  });

  it("pauses a running machine for the capture and lets it run on", async () => {
    const emu = await emulator(MI_SPECTRUM_48, "pal");
    await loadSpectrumSnapshot(emu.ports, "a.szx", loop48(), "run");
    await emu.until(MachineControllerState.Running);
    const result = await saveSpectrumSnapshot(savePorts(emu), "z80");
    expect(emu.controller!.state).toBe(MachineControllerState.Running);
    expect(emu.controller!.isDebugging).toBe(false);
    expect(parseSpectrumSnapshot("a.z80", result.bytes).cpu.pc).toBe(0x8100);
  });

  it("keeps a debugging machine in debug mode", async () => {
    const emu = await emulator(MI_SPECTRUM_48, "pal");
    await loadSpectrumSnapshot(emu.ports, "a.szx", loop48(), "debug");
    await emu.until(MachineControllerState.Paused);
    await emu.controller!.startDebug();
    await emu.until(MachineControllerState.Running);
    await saveSpectrumSnapshot(savePorts(emu), "szx");
    expect(emu.controller!.state).toBe(MachineControllerState.Running);
    expect(emu.controller!.isDebugging).toBe(true);
  });

  it("names the tape and the +3 disks the media store holds", async () => {
    const emu = await emulator(MI_SPECTRUM_3E, "fdd2", { [MC_DISK_SUPPORT]: 2 });
    await loadSpectrumSnapshot(
      emu.ports,
      "a.szx",
      buildSzx(state128(), { machineId: 6, extra: [szxBlock("+3", [2, 0])] }),
      "debug"
    );
    await emu.until(MachineControllerState.Paused);
    const result = await saveSpectrumSnapshot(
      savePorts(emu, { diskFiles: ["/d/a.dsk", undefined] }),
      "szx"
    );
    const reread = parseSpectrumSnapshot("a.szx", result.bytes);
    expect(reread.peripherals.plus3).toEqual({
      drives: 2,
      motorOn: false,
      disks: [{ drive: 0, fileName: "/d/a.dsk" }]
    });
    expect(result.machineName).toBe("ZX Spectrum +3E (2 FDDs)");
  });

  it.each([
    ["plus3-fdd1", 1, "plus3", 5, 7],
    ["plus3-es-fdd2", 2, "plus3", 5, 7],
    ["plus2a", 0, "plus2a", 4, 13],
    ["fdd1", 1, "plus3e", 6, undefined]
  ] as const)("saves a %s (%i drives) as a %s", async (modelId, drives, machine, szxId, z80Mode) => {
    const emu = await emulator(MI_SPECTRUM_3E, modelId);
    const state = buildSzx(state128(), { machineId: 6, extra: drives ? [szxBlock("+3", [drives, 0])] : [] });
    await loadSpectrumSnapshot(emu.ports, "a.szx", state, "debug", { keepModel: true });
    await emu.until(MachineControllerState.Paused);
    const szx = await saveSpectrumSnapshot(savePorts(emu), "szx");
    expect(szx.bytes[6]).toBe(szxId);
    expect(parseSpectrumSnapshot("a.szx", szx.bytes).machine).toBe(machine);
    if (z80Mode !== undefined) {
      const z80 = await saveSpectrumSnapshot(savePorts(emu), "z80");
      expect(z80.bytes[34]).toBe(z80Mode);
      expect(parseSpectrumSnapshot("a.z80", z80.bytes).machine).toBe(machine);
    }
  });

  it("refuses a .sna that the format cannot hold, and leaves the machine as it was", async () => {
    const emu = await emulator(MI_SPECTRUM_3E, "fdd1", { [MC_DISK_SUPPORT]: 1 });
    await loadSpectrumSnapshot(
      emu.ports,
      "a.szx",
      buildSzx(state128({ port1ffd: 0x01 }), { machineId: 6, extra: [szxBlock("+3", [1, 0])] }),
      "debug"
    );
    await emu.until(MachineControllerState.Paused);
    await expect(saveSpectrumSnapshot(savePorts(emu), "sna")).rejects.toThrow(/special paging/);
    expect(emu.controller!.state).toBe(MachineControllerState.Paused);
  });
});
