/*
 * Loads a `.z88` snapshot into the emulator: the orchestration of `.plans/Z88_SNAPSHOT_PLAN.md` §4.5.
 *
 *  1. Parse and map the file. Anything Klive cannot load stops here, before the machine is touched.
 *  2. Make the machine fit: a Z88 with the snapshot's internal RAM and LCD size. A machine that does
 *     not fit is rebuilt; one that does only has its card configuration updated, so the card UI
 *     shows the snapshot's cards. Slot 0's configuration is never changed: it names a ROM file,
 *     which a snapshot does not have. The snapshot's slot 0 lives in the core only.
 *  3. Restore the state through `IMachineController.restoreState`, which leaves the machine Paused.
 *  4. Then, by mode: run ("run"), or debug, stopping at the snapshot's PC before that instruction
 *     runs ("debug" - a one-shot breakpoint, as `nex-run -e` stops at entry).
 *
 * The services it needs come in as ports, so the flow is testable without the emulator window.
 */

import type { IMachineController } from "@renderer/abstractions/IMachineController";
import type { MachineConfigSet } from "@common/machines/info-types";
import type { Z88Snapshot } from "@common/z88/z88Snapshot";
import type { Z88SnapshotMapping } from "@common/z88/z88SnapshotMapping";
import type { Z88Tim } from "@common/z88/z88Rtc";
import type { Z88SnapshotLoadMode, Z88SnapshotLoadResult } from "@common/z88/z88SnapshotLoadTypes";

import {
  MC_SCREEN_SIZE,
  MC_Z88_INTRAM,
  MC_Z88_SLOT1,
  MC_Z88_SLOT2,
  MC_Z88_SLOT3,
  MI_Z88
} from "@common/machines/constants";
import { machineRegistry } from "@common/machines/machine-registry";
import { z88InternalRamSizeInBytes } from "@emu/machines/z88/z88CardCatalog";
import { parseZ88Snapshot } from "@common/z88/z88Snapshot";
import { mapZ88SnapshotToKlive } from "@common/z88/z88SnapshotMapping";

/** The LCD size a configuration without `MC_SCREEN_SIZE` has (`z88LcdSizeRegisters`) */
const DEFAULT_SCREEN_SIZE = "640x64";

const SLOT_KEYS = [undefined, MC_Z88_SLOT1, MC_Z88_SLOT2, MC_Z88_SLOT3] as const;

/** The services the load uses */
export type Z88SnapshotLoadPorts = {
  /** The live machine controller (it changes when the machine is rebuilt) */
  getMachineController(): IMachineController | undefined;
  /** The emulator's machine type, model and configuration */
  getEmulatorState(): { machineId?: string; modelId?: string; config?: MachineConfigSet };
  /** Rebuilds the machine; false when a later machine change superseded it */
  setMachineType(machineId: string, modelId: string | undefined, config: MachineConfigSet): Promise<boolean>;
  /** Records a new configuration of the live machine, without a rebuild */
  setMachineConfig(config: MachineConfigSet): void;
};

/** The part of the Z88 machine the load needs (`Z88WasmV2Machine`) */
type Z88SnapshotMachine = {
  loadSnapshotState(snapshot: Z88Snapshot, mapping: Z88SnapshotMapping, nowMs: number): Z88Tim;
  dynamicConfig?: MachineConfigSet;
};

function isZ88SnapshotMachine(machine: unknown): machine is Z88SnapshotMachine {
  return typeof (machine as Z88SnapshotMachine)?.loadSnapshotState === "function";
}

/**
 * Loads a `.z88` snapshot into the emulator.
 * @param ports The services to use
 * @param bytes The `.z88` file
 * @param mode What to do once the state is restored
 * @param nowMs The host time, for the RTC catch-up
 * @throws When the file is not a snapshot, Klive cannot load it, or the machine change was superseded
 */
export async function loadZ88Snapshot(
  ports: Z88SnapshotLoadPorts,
  bytes: Uint8Array,
  mode: Z88SnapshotLoadMode,
  nowMs: number
): Promise<Z88SnapshotLoadResult> {
  // --- 1. Parse and map
  const snapshot = parseZ88Snapshot(bytes);
  const mapping = mapZ88SnapshotToKlive(snapshot);
  if (mapping.errors.length > 0) {
    throw new Error(`The snapshot cannot be loaded: ${mapping.errors.join("; ")}`);
  }

  // --- 2. Make the machine fit
  const fit = fitMachineConfig(ports.getEmulatorState(), mapping);
  if (fit.rebuild) {
    const live = await ports.setMachineType(MI_Z88, fit.modelId, fit.config);
    if (!live) {
      throw new Error("The machine change was superseded by another one; the snapshot was not loaded");
    }
  } else {
    ports.setMachineConfig(fit.config);
  }
  const controller = ports.getMachineController();
  const machine = controller?.machine;
  if (!controller || !isZ88SnapshotMachine(machine)) {
    throw new Error("The emulator is not running a Cambridge Z88");
  }
  if (!fit.rebuild) {
    // --- The cards the dialogs and a later configure() see; restoreState inserts the real ones
    machine.dynamicConfig = fit.config;
  }

  // --- 3. Restore the state, Paused
  let tim: Z88Tim = snapshot.blink.tim;
  await controller.restoreState(() => {
    tim = machine.loadSnapshotState(snapshot, mapping, nowMs);
  }, "Z88 snapshot loaded");

  // --- 4. Continue as asked
  const pc = snapshot.cpu.pc;
  if (mode === "run") {
    await controller.start();
  } else {
    controller.debugSupport?.addBreakpoint({
      address: pc,
      exec: true,
      oneShot: true,
      runTo: true,
      owner: { kind: "session" }
    });
    await controller.startDebug();
  }

  return {
    pc,
    tim: [...tim],
    rebuilt: fit.rebuild,
    autorun: snapshot.autorun,
    warnings: [...snapshot.warnings, ...mapping.warnings]
  };
}

/**
 * The configuration a snapshot needs, and whether the machine must be rebuilt for it: when it is
 * not a Z88, or its internal RAM or LCD size differs. Exported for the tests.
 * @param current The emulator's machine type, model and configuration
 * @param mapping The snapshot's mapping
 */
export function fitMachineConfig(
  current: { machineId?: string; modelId?: string; config?: MachineConfigSet },
  mapping: Z88SnapshotMapping
): { rebuild: boolean; modelId: string | undefined; config: MachineConfigSet } {
  const isZ88 = current.machineId === MI_Z88;
  let modelId = current.modelId;
  let base: MachineConfigSet = current.config ?? {};
  if (!isZ88) {
    // --- Another machine: start from the first Z88 model's configuration
    const model = machineRegistry.find((m) => m.machineId === MI_Z88)?.models?.[0];
    modelId = model?.modelId;
    base = model?.config ?? {};
  }

  const config: MachineConfigSet = { ...base, [MC_Z88_INTRAM]: mapping.intRamMask };
  if (mapping.screenSize) {
    config[MC_SCREEN_SIZE] = mapping.screenSize;
  }
  for (let slot = 1; slot <= 3; slot++) {
    const key = SLOT_KEYS[slot]!;
    const card = mapping.slots[slot];
    if (card) {
      // --- No file: the card's contents come from the snapshot, not from an image on disk
      config[key] = { cardType: card.cardType, size: card.sizeK };
    } else {
      delete config[key];
    }
  }

  const ramDiffers =
    z88InternalRamSizeInBytes(base[MC_Z88_INTRAM] ?? 0x1f) !==
    z88InternalRamSizeInBytes(config[MC_Z88_INTRAM]);
  const screenDiffers =
    (base[MC_SCREEN_SIZE] ?? DEFAULT_SCREEN_SIZE) !== (config[MC_SCREEN_SIZE] ?? DEFAULT_SCREEN_SIZE);
  return { rebuild: !isZ88 || ramDiffers || screenDiffers, modelId, config };
}
