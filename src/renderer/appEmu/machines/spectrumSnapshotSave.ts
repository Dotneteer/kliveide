/*
 * Saves the running ZX Spectrum as a `.sna`, `.z80` or `.szx` snapshot: the orchestration of
 * `.plans/SNAPSHOT_SAVING_AND_STATE_FILES_PLAN.md` §4.3 (decision D4).
 *
 *  1. A machine with no state (stopped, or never started) cannot be saved.
 *  2. A running machine is paused, captured and started again, so a save never leaves it paused; a
 *     paused one stays paused.
 *  3. A pause can land between an instruction prefix and its opcode, which no format can hold. When
 *     this flow did the pausing, it lets the machine run on and tries again a few times; a machine
 *     the user paused there is refused with a hint to step once more.
 *  4. The model is written in the requested format; refusals (D3) throw with their reason.
 *
 * The services it needs come in as ports, so the flow is testable without the emulator window.
 */

import type { IMachineController } from "@renderer/abstractions/IMachineController";
import type {
  SpectrumSnapshot,
  SpectrumSnapshotFormat
} from "@common/spectrum/snapshot/spectrumSnapshot";
import type { SpectrumSnapshotSaveResult } from "@common/spectrum/snapshot/spectrumSnapshotSaveTypes";
import type { SpectrumSnapshotCaptureMedia } from "@emu/machines/zxSpectrum/spectrumSnapshotCapture";

import { MachineControllerState } from "@abstractions/MachineControllerState";
import { SnapshotRefusedError } from "@common/spectrum/snapshot/snapshotBytes";
import { kliveSpectrumName } from "@common/spectrum/snapshot/spectrumSnapshotMapping";
import { writeSpectrumSnapshot } from "@common/spectrum/snapshot/writeSpectrumSnapshot";
import type { SzxCreator } from "@common/spectrum/snapshot/szxWriter";

/** The services the save uses */
export type SpectrumSnapshotSavePorts = {
  /** The live machine controller */
  getMachineController(): IMachineController | undefined;
  /** The tape and disk files in the media store */
  getMediaFiles(): SpectrumSnapshotCaptureMedia;
  /** The emulator's machine type and model */
  getEmulatorState(): { machineId?: string; modelId?: string };
};

/** The part of the Spectrum machines the save needs (`ZxSpectrum*WasmV2Machine`) */
type SpectrumSnapshotMachine = {
  captureSnapshotState(media?: SpectrumSnapshotCaptureMedia): SpectrumSnapshot;
};

/** How many times a self-made pause is retried when it lands inside a prefixed instruction */
const PREFIX_RETRIES = 5;

/** Is this a machine that can be captured? */
function isCapturable(machine: unknown): machine is SpectrumSnapshotMachine {
  return typeof (machine as SpectrumSnapshotMachine)?.captureSnapshotState === "function";
}

/** Is this the capture's "inside a prefixed instruction" refusal? */
function isPrefixRefusal(err: unknown): boolean {
  return err instanceof SnapshotRefusedError && /prefix/.test(err.message);
}

/**
 * Saves the machine as a snapshot
 * @param ports The services the save uses
 * @param format The file format
 * @param creator The program a `.szx` file names as its creator
 * @returns The file's bytes and what it could not hold
 * @throws When there is no state to save, the machine is not a ZX Spectrum, or the format refuses
 */
export async function saveSpectrumSnapshot(
  ports: SpectrumSnapshotSavePorts,
  format: SpectrumSnapshotFormat,
  creator?: SzxCreator
): Promise<SpectrumSnapshotSaveResult> {
  const controller = ports.getMachineController();
  if (!controller) {
    throw new Error("There is no machine to save");
  }
  const machine = controller.machine as unknown;
  if (!isCapturable(machine)) {
    throw new Error("Only a ZX Spectrum 48K, 128K or +2E/+3E can be saved as a snapshot");
  }
  const state = controller.state;
  if (state !== MachineControllerState.Running && state !== MachineControllerState.Paused) {
    throw new Error("The machine has no state to save; start it first");
  }

  const media = ports.getMediaFiles();
  let snapshot: SpectrumSnapshot | undefined;
  if (state === MachineControllerState.Paused) {
    snapshot = machine.captureSnapshotState(media);
  } else {
    // --- Pause, capture, and run on as before (in debug mode if it was debugging)
    const debugging = controller.isDebugging;
    for (let attempt = 0; !snapshot; attempt++) {
      await controller.pause();
      try {
        snapshot = machine.captureSnapshotState(media);
      } catch (err) {
        if (!isPrefixRefusal(err) || attempt >= PREFIX_RETRIES) {
          await resume(controller, debugging);
          throw err;
        }
      }
      await resume(controller, debugging);
    }
  }

  const written = writeSpectrumSnapshot(snapshot, format, creator);
  const emulator = ports.getEmulatorState();
  return {
    bytes: written.bytes,
    losses: written.losses,
    machineName: kliveSpectrumName(emulator.machineId ?? "", emulator.modelId),
    pc: snapshot.cpu.pc,
    format
  };
}

/** Starts the machine again the way it ran */
async function resume(controller: IMachineController, debugging: boolean): Promise<void> {
  if (debugging) {
    await controller.startDebug();
  } else {
    await controller.start();
  }
}
