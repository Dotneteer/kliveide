import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, it, expect } from "vitest";
import { zipSync, unzipSync } from "fflate";

import type { MachineConfigSet } from "@common/machines/info-types";
import type { Store } from "@state/redux-light";
import type { AppState } from "@state/AppState";

import createAppStore from "@state/store";
import { setMachineConfigAction, setMachineTypeAction, setModelTypeAction } from "@state/actions";
import { DebugSupport } from "@emu/machines/DebugSupport";
import { MachineController } from "@emu/machines/MachineController";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import {
  MC_SCREEN_SIZE,
  MC_Z88_INTRAM,
  MC_Z88_SLOT0,
  MC_Z88_SLOT1,
  MC_Z88_SLOT2,
  MC_Z88_SLOT3,
  MI_SPECTRUM_48,
  MI_Z88
} from "@common/machines/constants";
import { CardIds } from "@emu/machines/z88/CardIds";
import { parseZ88Snapshot } from "@common/z88/z88Snapshot";
import { mapZ88SnapshotToKlive } from "@common/z88/z88SnapshotMapping";
import {
  fitMachineConfig,
  loadZ88Snapshot,
  type Z88SnapshotLoadPorts
} from "@renderer/appEmu/machines/z88SnapshotLoad";
import type { Z88WasmV2Machine } from "@emu/machines/z88/Z88WasmV2Machine";
import { createHarnessZ88Machine, ResolvingMessenger, z88Model } from "../../harness/z88";

/*
 * The emulator-side snapshot load (`.plans/Z88_SNAPSHOT_PLAN.md` §4.5, Phase 3): fitting the machine
 * to the snapshot, restoring the state Paused, and the load / run / debug modes - on a real
 * `MachineController` driving the real Z88 core.
 */

const SAMPLE = new Uint8Array(readFileSync(join(__dirname, "fixtures", "mm+jsw-oz5.z88")));
const SAMPLE_PC = 0xf523;
const MODEL = z88Model();

/** The sample with one settings value replaced */
function sampleWith(key: string, value: string): Uint8Array {
  const entries = unzipSync(SAMPLE);
  const text = new TextDecoder("latin1").decode(entries["snapshot.settings"]);
  entries["snapshot.settings"] = new TextEncoder().encode(
    text.replace(new RegExp(`^${key}=.*$`, "m"), `${key}=${value}`)
  );
  return zipSync(entries);
}

/** An emulator: the store, the live controller, and the ports the load uses (MachineService's part) */
class FakeEmulator {
  readonly store: Store<AppState> = createAppStore("emu");
  controller?: MachineController;
  rebuilds: MachineConfigSet[] = [];
  supersede = false;

  readonly ports: Z88SnapshotLoadPorts = {
    getMachineController: () => this.controller,
    getEmulatorState: () => this.store.getState().emulatorState ?? {},
    setMachineType: async (machineId, modelId, config) => {
      this.rebuilds.push(config);
      if (this.supersede) return false;
      await this.build(machineId, modelId, config);
      return true;
    },
    setMachineConfig: (config) => this.store.dispatch(setMachineConfigAction(config), "emu")
  };

  /** Builds the machine as MachineService does: setup, hard reset, then publish the state */
  async build(machineId: string, modelId: string | undefined, config: MachineConfigSet): Promise<void> {
    await this.controller?.stop();
    this.controller?.dispose();
    if (machineId === MI_Z88) {
      const machine = await createHarnessZ88Machine({ model: modelId, config, rom: "model" });
      this.controller = new MachineController(this.store, new ResolvingMessenger(), machine);
      this.controller.debugSupport = new DebugSupport(this.store);
    } else {
      // --- Another machine type: only its identity matters here
      this.controller = undefined;
    }
    this.store.dispatch(setMachineTypeAction(machineId), "emu");
    this.store.dispatch(setModelTypeAction(modelId), "emu");
    this.store.dispatch(setMachineConfigAction(config), "emu");
  }

  get machine(): Z88WasmV2Machine {
    return this.controller!.machine as unknown as Z88WasmV2Machine;
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

/** An emulator running a Z88 whose RAM and LCD already fit the sample */
async function fittingEmulator(): Promise<FakeEmulator> {
  const emu = new FakeEmulator();
  await emu.build(MI_Z88, MODEL.modelId, { ...MODEL.config, [MC_Z88_INTRAM]: 0x07 });
  return emu;
}

const emulators: FakeEmulator[] = [];
afterEach(async () => {
  for (const emu of emulators.splice(0)) {
    await emu.controller?.stop();
    emu.controller?.dispose();
  }
});

async function track(emu: Promise<FakeEmulator>): Promise<FakeEmulator> {
  const e = await emu;
  emulators.push(e);
  return e;
}

describe("Z88 snapshot - fitting the machine", () => {
  const mapping = mapZ88SnapshotToKlive(parseZ88Snapshot(SAMPLE));
  const fitting = { ...MODEL.config, [MC_Z88_INTRAM]: 0x07 };

  it("keeps a Z88 whose RAM and LCD fit, and records the snapshot's cards", () => {
    const fit = fitMachineConfig({ machineId: MI_Z88, modelId: MODEL.modelId, config: { ...fitting, [MC_Z88_SLOT1]: { cardType: CardIds.RAM128, size: 128 } } }, mapping);
    expect(fit.rebuild).toBe(false);
    expect(fit.modelId).toBe(MODEL.modelId);
    expect(fit.config[MC_Z88_SLOT1]).toBeUndefined();
    expect(fit.config[MC_Z88_SLOT2]).toEqual({ cardType: CardIds.EPROMUV32, size: 32 });
    expect(fit.config[MC_Z88_SLOT3]).toEqual({ cardType: CardIds.EPROMUV32, size: 32 });
  });

  it("never touches slot 0's configuration (it names a ROM file)", () => {
    const fit = fitMachineConfig({ machineId: MI_Z88, modelId: MODEL.modelId, config: fitting }, mapping);
    expect(fit.config[MC_Z88_SLOT0]).toEqual(MODEL.config[MC_Z88_SLOT0]);
  });

  it("rebuilds when the internal RAM differs", () => {
    const fit = fitMachineConfig({ machineId: MI_Z88, modelId: MODEL.modelId, config: MODEL.config }, mapping);
    expect(fit.rebuild).toBe(true);
    expect(fit.config[MC_Z88_INTRAM]).toBe(0x07);
  });

  it("rebuilds when the LCD size differs", () => {
    const fit = fitMachineConfig(
      { machineId: MI_Z88, modelId: MODEL.modelId, config: { ...fitting, [MC_SCREEN_SIZE]: "640x480" } },
      mapping
    );
    expect(fit.rebuild).toBe(true);
    expect(fit.config[MC_SCREEN_SIZE]).toBe("640x64");
  });

  it("switches another machine type to the first Z88 model", () => {
    const fit = fitMachineConfig({ machineId: MI_SPECTRUM_48, modelId: "pal", config: {} }, mapping);
    expect(fit.rebuild).toBe(true);
    expect(fit.modelId).toBe(MODEL.modelId);
    expect(fit.config[MC_Z88_SLOT0]).toEqual(MODEL.config[MC_Z88_SLOT0]);
  });
});

describe("Z88 snapshot - loading through the controller", () => {
  it("load: stands Paused at the snapshot's PC, and the store says so", async () => {
    const emu = await track(fittingEmulator());
    const result = await loadZ88Snapshot(emu.ports, SAMPLE, "load", parseZ88Snapshot(SAMPLE).stoppedAt!);
    expect(result).toEqual({
      pc: SAMPLE_PC,
      tim: [0x51, 0x29, 0x0c, 0x00, 0x00],
      rebuilt: false,
      autorun: true,
      warnings: []
    });
    expect(emu.controller!.state).toBe(MachineControllerState.Paused);
    expect(emu.machine.pc).toBe(SAMPLE_PC);
    const emuState = emu.store.getState().emulatorState;
    expect(emuState.machineState).toBe(MachineControllerState.Paused);
    expect(emuState.pcValue).toBe(SAMPLE_PC);
  });

  it("load: the card UI's configuration shows the snapshot's cards, without a rebuild", async () => {
    const emu = await track(fittingEmulator());
    await loadZ88Snapshot(emu.ports, SAMPLE, "load", Date.now());
    expect(emu.rebuilds).toEqual([]);
    const config = emu.store.getState().emulatorState.config;
    expect(config[MC_Z88_SLOT2]).toEqual({ cardType: CardIds.EPROMUV32, size: 32 });
    expect(config[MC_Z88_SLOT3]).toEqual({ cardType: CardIds.EPROMUV32, size: 32 });
    expect(emu.machine.dynamicConfig).toEqual(config);
    expect(emu.machine.getInsertedCard(0)).toEqual({ kind: "AMD_FLASH_29F040B", sizeInBytes: 0x08_0000 });
  });

  it("load: rebuilds a Z88 whose internal RAM does not fit, then loads into the new machine", async () => {
    const emu = await track(
      (async () => {
        const e = new FakeEmulator();
        await e.build(MI_Z88, MODEL.modelId, MODEL.config); // --- 512K internal RAM
        return e;
      })()
    );
    const result = await loadZ88Snapshot(emu.ports, SAMPLE, "load", Date.now());
    expect(result.rebuilt).toBe(true);
    expect(emu.rebuilds).toHaveLength(1);
    expect(emu.machine.internalRam.sizeInBytes).toBe(128 * 1024);
    expect(emu.controller!.state).toBe(MachineControllerState.Paused);
    expect(emu.machine.pc).toBe(SAMPLE_PC);
  });

  it("load: turns another machine type into a Z88", async () => {
    const emu = new FakeEmulator();
    await emu.build(MI_SPECTRUM_48, "pal", {});
    emulators.push(emu);
    const result = await loadZ88Snapshot(emu.ports, SAMPLE, "load", Date.now());
    expect(result.rebuilt).toBe(true);
    expect(emu.store.getState().emulatorState.machineId).toBe(MI_Z88);
    expect(emu.machine.pc).toBe(SAMPLE_PC);
  });

  it("run: starts from the snapshot's state, not from a reset", async () => {
    const emu = await track(fittingEmulator());
    await loadZ88Snapshot(emu.ports, SAMPLE, "run", Date.now());
    expect(emu.controller!.state).toBe(MachineControllerState.Running);
    await new Promise((resolve) => setTimeout(resolve, 100));
    await emu.controller!.pause();
    // --- A reset would have started OZ from $0000 with SR0-SR3 at bank 0
    expect(emu.machine.getBlinkState().SR3).not.toBe(0);
    expect(emu.machine.frames).toBeGreaterThan(0);
  });

  it("debug: stops at the snapshot's PC before running it, in debug mode", async () => {
    const emu = await track(fittingEmulator());
    const tactsAtLoad: number[] = [];
    emu.controller!.stateChanged.on(({ newState }) => {
      if (newState === MachineControllerState.Paused) tactsAtLoad.push(emu.machine.tacts);
    });
    await loadZ88Snapshot(emu.ports, SAMPLE, "debug", Date.now());
    await emu.until(MachineControllerState.Paused);

    expect(emu.machine.pc).toBe(SAMPLE_PC);
    // --- Paused twice, by the restore and by the breakpoint, with no instruction between them
    expect(tactsAtLoad).toHaveLength(2);
    expect(tactsAtLoad[1]).toBe(tactsAtLoad[0]);
    expect(emu.controller!.isDebugging).toBe(true);
    expect(emu.store.getState().emulatorState.isDebugging).toBe(true);
    // --- The one-shot stop is consumed: nothing left behind in the breakpoint list
    expect(emu.controller!.debugSupport!.breakpoints).toEqual([]);
  });

  it("debug: a step from the stop executes the snapshot's first instruction", async () => {
    const emu = await track(fittingEmulator());
    await loadZ88Snapshot(emu.ports, SAMPLE, "debug", Date.now());
    await emu.until(MachineControllerState.Paused);
    await emu.controller!.stepInto();
    await emu.until(MachineControllerState.Paused);
    expect(emu.machine.pc).not.toBe(SAMPLE_PC);
  });

  it("reloads over a running machine", async () => {
    const emu = await track(fittingEmulator());
    await loadZ88Snapshot(emu.ports, SAMPLE, "run", Date.now());
    await new Promise((resolve) => setTimeout(resolve, 50));
    await loadZ88Snapshot(emu.ports, SAMPLE, "load", Date.now());
    expect(emu.controller!.state).toBe(MachineControllerState.Paused);
    expect(emu.machine.pc).toBe(SAMPLE_PC);
    // --- Really paused: the running loop was stopped, not just relabelled
    const frames = emu.machine.frames;
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(emu.machine.frames).toBe(frames);
    expect(emu.machine.pc).toBe(SAMPLE_PC);
  });

  it("debug twice: the second load stops at the same PC again", async () => {
    // --- The first stop leaves a breakpoint hit at that very PC behind; the second must still stop
    const emu = await track(fittingEmulator());
    await loadZ88Snapshot(emu.ports, SAMPLE, "debug", Date.now());
    await emu.until(MachineControllerState.Paused);
    await loadZ88Snapshot(emu.ports, SAMPLE, "debug", Date.now());
    await emu.until(MachineControllerState.Paused);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(emu.controller!.state).toBe(MachineControllerState.Paused);
    expect(emu.machine.pc).toBe(SAMPLE_PC);
  });

  it("reports the snapshot's Autorun flag", async () => {
    const emu = await track(fittingEmulator());
    const result = await loadZ88Snapshot(emu.ports, sampleWith("Autorun", "false"), "load", Date.now());
    expect(result.autorun).toBe(false);
  });

  it("refuses a snapshot Klive cannot load, leaving the machine alone", async () => {
    const emu = await track(fittingEmulator());
    const before = emu.controller;
    await expect(
      loadZ88Snapshot(emu.ports, sampleWith("SLOT0TYPE", "2"), "load", Date.now())
    ).rejects.toThrow(/cannot be loaded/);
    expect(emu.controller).toBe(before);
    expect(emu.controller!.state).toBe(MachineControllerState.None);
    expect(emu.rebuilds).toEqual([]);
  });

  it("refuses when the machine change was superseded", async () => {
    const emu = new FakeEmulator();
    await emu.build(MI_Z88, MODEL.modelId, MODEL.config);
    emulators.push(emu);
    emu.supersede = true;
    await expect(loadZ88Snapshot(emu.ports, SAMPLE, "load", Date.now())).rejects.toThrow(/superseded/);
  });
});
