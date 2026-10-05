/*
 * RZX recording and playback for the Spectrum harnesses (`sp48/`, `sp128/`), as the emulator runs
 * them (`.plans/RZX_PLAN.md`): a recorder or player attached to the machine as its RZX session,
 * driven by the machine's own frame loop.
 */

import { parseRzxFile } from "@common/spectrum/rzx/rzxFile";
import { RzxPlayer, type RzxPlayerOptions } from "@emu/machines/zxSpectrum/rzx/RzxPlayer";
import { RzxRecorder, type RzxRecorderOptions } from "@emu/machines/zxSpectrum/rzx/RzxRecorder";
import type { IRzxMachine, RzxStop } from "@emu/machines/zxSpectrum/rzx/rzxSession";

export type RzxHarnessStatus = {
  mode?: "play" | "record";
  active: boolean;
  frame: number;
  frames?: number;
  stop?: RzxStop;
};

export function startRzxRecording(machine: IRzxMachine, options?: RzxRecorderOptions): RzxRecorder {
  const recorder = new RzxRecorder(machine, options);
  recorder.start();
  machine.rzxSession = recorder;
  return recorder;
}

export function stopRzxRecording(machine: IRzxMachine): Uint8Array {
  const recorder = machine.rzxSession;
  if (!(recorder instanceof RzxRecorder)) throw new Error("No RZX recording is running.");
  recorder.end();
  machine.rzxSession = undefined;
  return recorder.toFinalisedBytes();
}

export function playRzx(machine: IRzxMachine, bytes: Uint8Array, options?: RzxPlayerOptions): RzxPlayer {
  const player = new RzxPlayer(machine, parseRzxFile(bytes), options);
  machine.rzxSession = player;
  player.start();
  return player;
}

/**
 * Runs frames until the RZX session stops and returns why
 * @param frames Reads the session's completed-frame counter
 * @param execute Runs one `executeMachineFrame` (and counts a completed frame)
 */
export function runRzx(
  machine: IRzxMachine,
  frames: () => number,
  execute: () => void,
  { maxFrames = 100_000, onFrame }: { maxFrames?: number; onFrame?: () => void } = {}
): RzxStop {
  const session = machine.rzxSession;
  if (!session) throw new Error("No RZX session is running.");
  const limit = frames() + maxFrames;
  while (session.active) {
    if (frames() >= limit) throw new Error(`The RZX session did not stop in ${maxFrames} frames.`);
    const before = frames();
    execute();
    if (frames() !== before) onFrame?.();
  }
  const stop = session.takeStop() ?? session.stop!;
  machine.rzxSession = undefined;
  return stop;
}

export function rzxStatus(machine: IRzxMachine): RzxHarnessStatus {
  const session = machine.rzxSession;
  return {
    mode: session?.mode,
    active: session?.active ?? false,
    frame: session?.frame ?? 0,
    frames: session?.frames,
    stop: session?.stop
  };
}

/** Throws when a frame loop ran into a stopped RZX session (a plain `runFrames` would spin) */
export function assertRzxRunning(machine: IRzxMachine): void {
  const rzx = machine.rzxSession;
  if (rzx && !rzx.active) throw new Error(`The RZX session stopped: ${rzx.stop?.message}`);
}
