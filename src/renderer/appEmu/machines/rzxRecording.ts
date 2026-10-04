/*
 * Records an RZX file in the emulator (`.plans/RZX_PLAN.md` §4.5, D3, D16).
 *
 * Record:
 *  1. pause (a paused machine stays paused, D16: "record from here");
 *  2. end a playback that is still running - the recording takes it over from this state;
 *  3. start the recorder: it captures a `.szx` snapshot (D15) - inside a prefixed instruction it
 *     cannot, so the machine runs on a little and pauses again, as saving a snapshot does;
 *  4. attach it, and resume if the machine was running.
 * Stop: pause, end the recording and finalise it (D3); the IDE writes the file. A recording that an
 * IDE operation or an overflow stopped stays attached, unsaved, until it is saved this way.
 * Rollback and Insert Rollback Point act on the attached recorder.
 */

import type { IMachineController } from "@renderer/abstractions/IMachineController";
import type {
  RzxRecordResult,
  RzxRollbackResult,
  RzxStopRecordingResult
} from "@common/spectrum/rzx/rzxCommandTypes";

import { MachineControllerState } from "@abstractions/MachineControllerState";
import { SnapshotRefusedError } from "@common/spectrum/snapshot/snapshotBytes";
import { kliveSpectrumName } from "@common/spectrum/snapshot/spectrumSnapshotMapping";
import { RzxRecorder } from "@emu/machines/zxSpectrum/rzx/RzxRecorder";
import { isRzxMachine } from "@emu/machines/zxSpectrum/rzx/rzxSession";

export type RzxRecordingPorts = {
  getMachineController(): IMachineController | undefined;
  getEmulatorState(): { machineId?: string; modelId?: string };
};

const PREFIX_RETRIES = 5;

function requireController(ports: RzxRecordingPorts): IMachineController {
  const controller = ports.getMachineController();
  if (!controller) throw new Error("There is no machine to record");
  if (!isRzxMachine(controller.machine)) {
    throw new Error("Only a ZX Spectrum 48K, 128K or +2E/+3E can record an RZX file");
  }
  return controller;
}

function requireRecorder(controller: IMachineController): RzxRecorder {
  const session = controller.rzxSession;
  if (!(session instanceof RzxRecorder)) throw new Error("No RZX recording is running");
  return session;
}

/**
 * Starts recording at the machine's current state
 * @param creator The program and version written into the file
 */
export async function startRzxRecording(
  ports: RzxRecordingPorts,
  creator: { name: string; major: number; minor: number }
): Promise<RzxRecordResult> {
  const controller = requireController(ports);
  const machine = controller.machine;
  if (!isRzxMachine(machine)) throw new Error("The machine cannot record");
  const existing = controller.rzxSession;
  if (existing instanceof RzxRecorder && (existing.active || controller.store.getState()?.emulatorState?.rzx?.unsaved)) {
    throw new Error("A recording is already running or waiting to be saved; stop and save it first");
  }
  const state = controller.state;
  if (state !== MachineControllerState.Running && state !== MachineControllerState.Paused) {
    throw new Error("The machine has no state to record from; start it first");
  }
  const wasRunning = state === MachineControllerState.Running;
  const debugging = controller.isDebugging;
  if (wasRunning) await controller.pause();

  // --- Take over a playback (D16)
  const tookOverPlayback = existing?.mode === "play";
  if (existing) {
    if (existing.active) {
      existing.interrupt("recording starts from here");
      existing.takeStop();
    }
    controller.detachRzxSession();
  }

  const recorder = new RzxRecorder(machine, { creator });
  for (let attempt = 0; ; attempt++) {
    try {
      recorder.start();
      break;
    } catch (err) {
      if (!(err instanceof SnapshotRefusedError && /prefix/.test(err.message)) || attempt >= PREFIX_RETRIES) {
        if (wasRunning) await resume(controller, debugging);
        throw err;
      }
      // --- Inside a prefixed instruction: run on a little and pause again
      await resume(controller, debugging);
      await controller.pause();
    }
  }
  controller.attachRzxSession(recorder, { mode: "recording" });
  await controller.sendOutput(`RZX recording started (PC: $${machine.pc.toString(16).padStart(4, "0")})`, "green");
  if (wasRunning) await resume(controller, debugging);

  const emu = ports.getEmulatorState();
  return {
    machineName: kliveSpectrumName(emu.machineId ?? "", emu.modelId),
    pc: machine.pc,
    tookOverPlayback
  };
}

/** Ends the recording and returns the finalised file; the machine stays paused */
export async function stopRzxRecording(ports: RzxRecordingPorts): Promise<RzxStopRecordingResult> {
  const controller = requireController(ports);
  const recorder = requireRecorder(controller);
  if (controller.state === MachineControllerState.Running) await controller.pause();
  if (recorder.active) {
    recorder.end();
    recorder.takeStop();
  }
  const bytes = recorder.toFinalisedBytes();
  const result = { bytes, frames: recorder.frame, points: recorder.segments.length };
  controller.detachRzxSession();
  await controller.sendOutput(`RZX recording stopped after ${recorder.frame} frames`, "green");
  return result;
}

/** Discards a recording without saving it */
export async function discardRzxRecording(ports: RzxRecordingPorts): Promise<void> {
  const controller = requireController(ports);
  const recorder = requireRecorder(controller);
  if (recorder.active) {
    recorder.end();
    recorder.takeStop();
  }
  controller.detachRzxSession();
}

/**
 * Rolls the recording back (D3); the machine is left paused at the point
 * @param back 1: the latest point, 2: the one before it, ...
 */
export async function rollbackRzxRecording(ports: RzxRecordingPorts, back = 1): Promise<RzxRollbackResult> {
  const controller = requireController(ports);
  const recorder = requireRecorder(controller);
  if (!recorder.active) throw new Error("The recording has stopped; save it");
  let frame = 0;
  // --- Through the controller's restore, so the IDE refreshes; the tape stays where it is
  await controller.restoreState(
    () => {
      frame = recorder.rollback(back);
    },
    `RZX recording rolled back to frame ${back === 1 ? "the latest point" : `point -${back}`}`,
    { attachMedia: false, keepRzxSession: true }
  );
  controller.publishRzxState();
  return { frame, points: recorder.segments.length };
}

/** Asks for a rollback point at the next frame end */
export async function insertRzxRollbackPoint(ports: RzxRecordingPorts): Promise<{ frame: number }> {
  const controller = requireController(ports);
  const recorder = requireRecorder(controller);
  if (!recorder.active) throw new Error("The recording has stopped");
  recorder.insertRollbackPoint();
  return { frame: recorder.frame };
}

async function resume(controller: IMachineController, debugging: boolean): Promise<void> {
  if (debugging) await controller.startDebug();
  else await controller.start();
}
