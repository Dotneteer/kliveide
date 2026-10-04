/*
 * What a ZX Spectrum machine and an RZX session say to each other (`.plans/RZX_PLAN.md` §4.3).
 *
 * A session - `RzxPlayer` or `RzxRecorder` - is attached to the machine (`IRzxMachine.rzxSession`).
 * The machine's two execution paths call it:
 *  - the fast path (`executeMachineFrame` in normal mode) hands it the core's frame function through
 *    `runFastFrame`; a player runs RZX frames until one completes a picture (D19), a recorder runs one
 *    ULA frame;
 *  - the debug loop asks `beforeInstruction` before every instruction and `afterInstruction` after
 *    it, and calls `afterRun` on its way out, so breakpoints and stepping work inside a recording
 *    (D10).
 * When a session stops (the recording ended, a desync, an overflow, an IDE operation that changed
 * the machine from outside) the machine ends its frame with `FrameTerminationMode.DebugEvent`, and
 * the controller pauses and prints `takeStop()`'s message (D11, D12).
 */

import type { SpectrumSnapshot } from "@common/spectrum/snapshot/spectrumSnapshot";
import type { SpectrumSnapshotCaptureMedia } from "../spectrumSnapshotCapture";
import type { RzxCoreBridge } from "./rzxCoreBridge";

/** Why a session stopped */
export type RzxStopKind = "ended" | "desync" | "interrupted" | "overflow";

export type RzxStop = {
  kind: RzxStopKind;
  /** The output line that explains it */
  message: string;
  /** The frame the session stood at (1-based for a player: the frame that was playing) */
  frame: number;
};

/** What `afterInstruction` saw */
export type RzxInstructionResult =
  /** An instruction ran */
  | "ran"
  /** No instruction ran: the call ended an RZX frame that completes no picture */
  | "boundary"
  /** No instruction ran: the call ended an RZX frame that completes a picture */
  | "picture"
  /** The session stopped */
  | "stopped";

export interface IRzxSession {
  readonly mode: "play" | "record";
  /** False once the session has stopped */
  readonly active: boolean;
  /** Frames played or recorded so far */
  readonly frame: number;
  /** All frames of a playback; undefined while recording */
  readonly frames?: number;

  /**
   * The fast path: runs a picture frame (play) or a ULA frame (record)
   * @param executeFrame Runs the core's frame function once
   * @returns false when the session stopped (the machine stops too)
   */
  runFastFrame(executeFrame: () => void): boolean;

  /** The debug loop, before an instruction: false when the session stopped */
  beforeInstruction(): boolean;

  /** The debug loop, after an instruction */
  afterInstruction(): RzxInstructionResult;

  /**
   * After the machine ran (the fast path, or the debug loop on its way out)
   * @param frameCompleted A ULA frame just completed
   * @returns false when the session stopped
   */
  afterRun(frameCompleted: boolean): boolean;

  /** Ends the session because the IDE changed the machine from outside the CPU (trap 4) */
  interrupt(reason: string): void;

  /** The stop not yet reported, which is then cleared */
  takeStop(): RzxStop | undefined;

  /** The stop, reported or not */
  readonly stop?: RzxStop;
}

/** A ZX Spectrum machine that can play and record RZX files */
export interface IRzxMachine {
  /** The core's RZX module */
  readonly rzxCore: RzxCoreBridge;
  /** The running session, if any */
  rzxSession?: IRzxSession;
  /** The model id, for the creator text and the snapshot fitting */
  readonly modelInfo?: { modelId?: string };
  loadSnapshotState(snapshot: SpectrumSnapshot): number;
  captureSnapshotState(media?: SpectrumSnapshotCaptureMedia): SpectrumSnapshot;
}

export function isRzxMachine(machine: unknown): machine is IRzxMachine {
  return (
    typeof machine === "object" &&
    machine !== null &&
    "rzxCore" in machine &&
    typeof (machine as IRzxMachine).loadSnapshotState === "function"
  );
}
