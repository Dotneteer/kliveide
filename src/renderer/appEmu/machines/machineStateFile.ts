/*
 * Saves and loads Klive state files (`.kls`) for every WASM machine: the orchestration of
 * `.plans/SNAPSHOT_SAVING_AND_STATE_FILES_PLAN.md` §4.8.
 *
 * Save:
 *  1. A machine with no state (stopped, never started) cannot be saved.
 *  2. A running machine is paused for the capture and runs on afterwards; a paused one stays paused.
 *  3. The core's memory image, the wrapper's fields, a thumbnail, the media list and - for a ZX
 *     Spectrum - a `.szx` of the same moment (the portable fallback, D9) go into the container.
 *
 * Load:
 *  1. The machine is fitted to the state: its machine type, model and configuration (D10). A state
 *     is never retargeted to another model.
 *  2. The image goes in when the core's memory layout matches (D7); otherwise a Spectrum state loads
 *     its `.szx` with a warning, and any other is refused (D9, D21).
 *  3. Media come from the state's image, not from the media store (trap 12), and disks are detached
 *     from their files (D11). A changed Next SD card needs confirmation (D12).
 *  4. Then by mode: run, or debug, stopping at PC before that instruction runs.
 */

import type { IMachineController } from "@renderer/abstractions/IMachineController";
import type { MachineConfigSet } from "@common/machines/info-types";
import type { MachineStateParts } from "@emu/machines/state/wasmStateImage";
import type { SpectrumSnapshot } from "@common/spectrum/snapshot/spectrumSnapshot";
import type {
  KliveStateFile,
  KliveStateMedia,
  KliveStateThumbnail
} from "@common/machineState/kliveStateFile";
import type {
  MachineStateLoadMode,
  MachineStateLoadResult,
  MachineStateSaveResult
} from "@common/machineState/machineStateTypes";
import type { SpectrumSnapshotLoadPorts } from "./spectrumSnapshotLoad";

import { MachineControllerState } from "@abstractions/MachineControllerState";
import { machineRegistry, resolveModelId } from "@common/machines/machine-registry";
import { readKliveStateFile, writeKliveStateFile } from "@common/machineState/kliveStateFile";
import { stateMismatch } from "@emu/machines/state/wasmStateImage";
import { writeSpectrumSnapshot } from "@common/spectrum/snapshot/writeSpectrumSnapshot";
import { MEDIA_DISK_A, MEDIA_DISK_B, MEDIA_SD_CARD, MEDIA_TAPE } from "@common/structs/project-const";
import { loadSpectrumSnapshot } from "./spectrumSnapshotLoad";

/** The services the save and the load use */
export type MachineStatePorts = SpectrumSnapshotLoadPorts & {
  /** The file names in the media store, by media id */
  getMediaFiles(): Record<string, string | undefined>;
};

/** The part of the WASM machines this flow needs */
type StateMachine = {
  machineId: string;
  pc: number;
  saveMachineState(): MachineStateParts;
  loadMachineState(parts: MachineStateParts): void;
  captureSnapshotState?(media?: object): SpectrumSnapshot;
  getPixelBuffer?(): Uint32Array;
  screenWidthInPixels?: number;
  screenHeightInPixels?: number;
  wasmV2Runtime?: { module?: WebAssembly.Module };
};

function stateMachineOf(controller: IMachineController | undefined): StateMachine | undefined {
  const machine = controller?.machine as unknown as StateMachine | undefined;
  return typeof machine?.saveMachineState === "function" ? machine : undefined;
}

/** The core id of a Klive machine */
export function coreIdOfMachine(machineId: string): string {
  switch (machineId) {
    case "zx80":
    case "zx81":
      return "zx8081";
    default:
      return machineId;
  }
}

/** The display name of a machine and model */
export function machineDisplayName(machineId: string, modelId?: string): string {
  const info = machineRegistry.find((m) => m.machineId === machineId);
  const model = info?.models?.find((m) => m.modelId === modelId);
  return model?.displayName ?? info?.displayName ?? machineId;
}

/** The largest thumbnail side, in pixels */
const THUMBNAIL_MAX = 320;

/** A downscaled copy of the machine's picture (the pixel buffer is ABGR: RGBA bytes) */
function thumbnailOf(machine: StateMachine): KliveStateThumbnail | undefined {
  const width = machine.screenWidthInPixels ?? 0;
  const height = machine.screenHeightInPixels ?? 0;
  const pixels = machine.getPixelBuffer?.();
  if (!pixels || !width || !height || pixels.length < width * height) return undefined;
  const scale = Math.max(1, Math.ceil(Math.max(width, height) / THUMBNAIL_MAX));
  const w = Math.floor(width / scale);
  const h = Math.floor(height / scale);
  const rgba = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = pixels[y * scale * width + x * scale];
      const o = (y * w + x) * 4;
      rgba[o] = v & 0xff;
      rgba[o + 1] = (v >>> 8) & 0xff;
      rgba[o + 2] = (v >>> 16) & 0xff;
      rgba[o + 3] = 0xff;
    }
  }
  return { width: w, height: h, rgba };
}

/**
 * Saves the machine as a Klive state file
 * @param ports The services the save uses
 * @param options The Klive version for the header; the SD card's fingerprint (the main process
 * computes it)
 */
export async function saveMachineStateFile(
  ports: MachineStatePorts,
  options: { kliveVersion: string; sdCard?: KliveStateMedia }
): Promise<MachineStateSaveResult> {
  const controller = ports.getMachineController();
  const machine = stateMachineOf(controller);
  if (!controller || !machine) {
    throw new Error("This machine cannot save its state");
  }
  const state = controller.state;
  if (state !== MachineControllerState.Running && state !== MachineControllerState.Paused) {
    throw new Error("The machine has no state to save; start it first");
  }

  const warnings: string[] = [];
  const emulator = ports.getEmulatorState();
  const mediaFiles = ports.getMediaFiles();
  const running = state === MachineControllerState.Running;
  const debugging = controller.isDebugging;
  let parts: MachineStateParts;
  let szx: Uint8Array | undefined;
  let thumbnail: KliveStateThumbnail | undefined;
  if (running) await controller.pause();
  try {
    parts = machine.saveMachineState();
    thumbnail = thumbnailOf(machine);
    if (machine.captureSnapshotState) {
      try {
        const snapshot = machine.captureSnapshotState({
          tapeFile: mediaFiles[MEDIA_TAPE],
          diskFiles: [mediaFiles[MEDIA_DISK_A], mediaFiles[MEDIA_DISK_B]]
        });
        szx = writeSpectrumSnapshot(snapshot, "szx", {
          name: "Klive IDE",
          ...versionParts(options.kliveVersion)
        }).bytes;
      } catch (err) {
        warnings.push(
          `The state has no portable .szx part (${(err as Error).message}); it loads only into this version of Klive`
        );
      }
    }
  } finally {
    if (running) {
      if (debugging) await controller.startDebug();
      else await controller.start();
    }
  }

  const media: KliveStateMedia[] = [MEDIA_TAPE, MEDIA_DISK_A, MEDIA_DISK_B]
    .filter((id) => mediaFiles[id])
    .map((id) => ({ id, fileName: mediaFiles[id] }));
  if (options.sdCard) media.push({ ...options.sdCard, id: MEDIA_SD_CARD });

  const machineName = machineDisplayName(machine.machineId, emulator.modelId);
  const file: KliveStateFile = {
    header: {
      machineId: machine.machineId,
      modelId: emulator.modelId,
      config: emulator.config as Record<string, unknown> | undefined,
      kliveVersion: options.kliveVersion,
      coreId: parts.coreId,
      fingerprint: parts.fingerprint,
      memorySize: parts.memorySize,
      savedAt: new Date().toISOString(),
      pc: machine.pc,
      machineName
    },
    meta: { pc: machine.pc },
    thumbnail,
    image: parts.image,
    host: parts.host,
    media,
    szx
  };
  return { bytes: writeKliveStateFile(file), machineName, pc: machine.pc, warnings };
}

/** "0.62.1" -> { major: 0, minor: 62 } */
function versionParts(version: string): { major: number; minor: number } {
  const [major, minor] = version.split(".").map((p) => parseInt(p, 10) || 0);
  return { major: major ?? 0, minor: minor ?? 0 };
}

/** Do two configurations differ? (key order does not matter) */
function configDiffers(a: MachineConfigSet | undefined, b: Record<string, unknown> | undefined): boolean {
  const norm = (c: object | undefined) =>
    JSON.stringify(Object.entries(c ?? {}).sort(([x], [y]) => x.localeCompare(y)));
  return norm(a) !== norm(b);
}

/**
 * Loads a Klive state file
 * @param ports The services the load uses
 * @param fileName The file's name, for messages
 * @param bytes The file
 * @param mode What to do once the state is in
 * @param options `currentSdCard`: the live SD card's fingerprint; `acceptChangedSdCard`: load even
 * when it differs from the one the state was saved with
 */
export async function loadMachineStateFile(
  ports: MachineStatePorts,
  fileName: string,
  bytes: Uint8Array,
  mode: MachineStateLoadMode,
  options: { currentSdCard?: KliveStateMedia; acceptChangedSdCard?: boolean } = {}
): Promise<MachineStateLoadResult> {
  const file = readKliveStateFile(bytes);
  const header = file.header;
  const warnings: string[] = [];
  const machineName = header.machineName ?? machineDisplayName(header.machineId, header.modelId);

  // --- The Next SD card: the state remembers it, but cannot carry it (D12)
  const savedCard = file.media.find((m) => m.id === MEDIA_SD_CARD);
  if (savedCard?.fingerprint) {
    const live = options.currentSdCard;
    if (!live) {
      throw new Error(`The SD card image the state was saved with (${savedCard.fileName}) is not available`);
    }
    if (live.fingerprint !== savedCard.fingerprint && !options.acceptChangedSdCard) {
      return {
        needsConfirmation: `The SD card image (${live.fileName}) has changed since the state was saved; its file system may not match what the machine remembers`,
        machineId: header.machineId,
        modelId: header.modelId,
        machineName,
        pc: header.pc,
        rebuilt: false,
        path: "image",
        warnings
      };
    }
    if (live.fingerprint !== savedCard.fingerprint) {
      warnings.push("The SD card image has changed since the state was saved");
    }
  }

  // --- 1. Fit the machine: type, model and configuration, exactly as saved
  const emulator = ports.getEmulatorState();
  let rebuilt = false;
  // --- Model ids compare as they resolve: a 128K state from before the 128K had models says none
  if (
    emulator.machineId !== header.machineId ||
    resolveModelId(header.machineId, emulator.modelId) !== resolveModelId(header.machineId, header.modelId) ||
    configDiffers(emulator.config, header.config)
  ) {
    const done = await ports.setMachineType(
      header.machineId,
      header.modelId,
      (header.config ?? {}) as MachineConfigSet
    );
    if (!done) throw new Error("Another machine change superseded loading the state");
    rebuilt = true;
  }
  const controller = ports.getMachineController();
  const machine = stateMachineOf(controller);
  if (!controller || !machine || machine.machineId !== header.machineId) {
    throw new Error(`The emulator is not running the ${machineName}`);
  }

  // --- 2. The image, or the portable fallback
  const mismatch = stateMismatch(header, coreIdOfMachine(header.machineId), machine.wasmV2Runtime?.module);
  if (mismatch) {
    if (!file.szx) {
      throw new Error(
        `${mismatch}. The state was saved by Klive ${header.kliveVersion} and cannot be loaded into this version`
      );
    }
    const result = await loadSpectrumSnapshot(ports, `${fileName}.szx`, file.szx, mode, {
      keepModel: true
    });
    return {
      machineId: result.machineId,
      modelId: result.modelId,
      machineName: result.machineName,
      pc: result.pc,
      rebuilt: rebuilt || result.rebuilt,
      path: "szx",
      warnings: [
        `The state was saved by Klive ${header.kliveVersion}, whose ${header.coreId} core differs from this one; it was loaded from its .szx part, which leaves out the exact tape position, the disk controller's state and the EI/MEMPTR details`,
        ...warnings,
        ...result.warnings
      ]
    };
  }

  // --- 3. The state's own media, then 4. the restore
  const parts: MachineStateParts = {
    coreId: header.coreId,
    fingerprint: header.fingerprint,
    memorySize: header.memorySize,
    image: file.image,
    host: file.host
  };
  await controller.restoreState(() => machine.loadMachineState(parts), "Machine state loaded", {
    attachMedia: false
  });
  for (const m of file.media) {
    if (m.id === MEDIA_TAPE) warnings.push(`The tape is the one in the state (${m.fileName}), at its saved position`);
    if (m.id === MEDIA_DISK_A || m.id === MEDIA_DISK_B) {
      warnings.push(
        `Disk ${m.id === MEDIA_DISK_A ? "A" : "B"} is the one in the state (${m.fileName}); it is detached from that file, so the machine's writes are not saved to it. Insert a disk to attach one again`
      );
    }
  }

  if (mode === "run") {
    await controller.start();
  } else {
    controller.debugSupport?.addBreakpoint({
      address: header.pc,
      exec: true,
      oneShot: true,
      runTo: true,
      owner: { kind: "session" }
    });
    await controller.startDebug();
  }
  return {
    machineId: header.machineId,
    modelId: header.modelId,
    machineName,
    pc: header.pc,
    rebuilt,
    path: "image",
    warnings
  };
}

// ==========================================================================================
// Quick save and restore (D19): one in-memory slot per machine instance

/** The slots, by machine instance: a rebuilt machine has none */
const quickSlots = new WeakMap<object, { parts: MachineStateParts; pc: number }>();

/**
 * Saves the machine's state into its quick slot (memory only, never a file). A running machine
 * runs on afterwards.
 * @returns The machine's name and PC
 */
export async function quickSaveMachineState(
  ports: Pick<MachineStatePorts, "getMachineController" | "getEmulatorState">
): Promise<{ machineName: string; pc: number }> {
  const controller = ports.getMachineController();
  const machine = stateMachineOf(controller);
  if (!controller || !machine) throw new Error("This machine cannot save its state");
  const state = controller.state;
  if (state !== MachineControllerState.Running && state !== MachineControllerState.Paused) {
    throw new Error("The machine has no state to save; start it first");
  }
  const running = state === MachineControllerState.Running;
  const debugging = controller.isDebugging;
  if (running) await controller.pause();
  try {
    quickSlots.set(machine, { parts: machine.saveMachineState(), pc: machine.pc });
  } finally {
    if (running) {
      if (debugging) await controller.startDebug();
      else await controller.start();
    }
  }
  const emulator = ports.getEmulatorState();
  return { machineName: machineDisplayName(machine.machineId, emulator.modelId), pc: machine.pc };
}

/** Does the live machine have a quick-saved state? */
export function hasQuickMachineState(
  ports: Pick<MachineStatePorts, "getMachineController">
): boolean {
  const machine = stateMachineOf(ports.getMachineController());
  return !!machine && quickSlots.has(machine);
}

/**
 * Puts the machine back into its quick-saved state and leaves it Paused. The machine's media come
 * from the saved state, with disks detached from their files, as for a state file.
 * @returns The PC the machine stands at
 */
export async function quickRestoreMachineState(
  ports: Pick<MachineStatePorts, "getMachineController">
): Promise<{ pc: number }> {
  const controller = ports.getMachineController();
  const machine = stateMachineOf(controller);
  const slot = machine ? quickSlots.get(machine) : undefined;
  if (!controller || !machine || !slot) {
    throw new Error("No state has been quick-saved for this machine");
  }
  await controller.restoreState(() => machine.loadMachineState(slot.parts), "Quick state restored", {
    attachMedia: false
  });
  return { pc: slot.pc };
}
