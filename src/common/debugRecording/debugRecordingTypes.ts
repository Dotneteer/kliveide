/*
 * The types of the emulator's debug recording calls (`EmuApi.saveDebugRecording`,
 * `EmuApi.loadDebugRecording`), shared by the IDE, the main process and the emulator
 * (`.plans/DEBUG_SESSION_RECORDING_PLAN.md` §4.4).
 */

import type { RecordingSources } from "./debugRecordingFile";

/** Where a recording's front is cut (D8): a record's sequence, or a step back from the present */
export type DebugRecordingFrom = { sequence: number } | { stepsBack: number };

export type DebugRecordingSaveOptions = {
  kliveVersion: string;
  from?: DebugRecordingFrom;
  /** Keep only keyframes about a second apart (D7) */
  sparse?: boolean;
  /** The user's description (NOTE) */
  note?: string;
  /** The Next SD card's identity, for MEDI (D14) */
  sdCard?: { fileName: string; size: number; fingerprint: string };
  /** The IDE's watch expressions (BRKP, D11) */
  watches?: unknown[];
  /** The compilation's identity, with texts for `-sources` (D13) */
  sources?: RecordingSources;
  /** Deflate level, 1-9 (D6) */
  level?: number;
};

export type DebugRecordingSaveResult = {
  bytes: Uint8Array;
  machineName: string;
  /** Instructions, frames and seconds of machine time the recording spans */
  records: number;
  frames: number;
  seconds: number;
  keyframes: number;
  /** Bytes by section */
  sectionSizes: Record<string, number>;
  /** Saved in the past: the recording remembers where the machine stood */
  fromPast: boolean;
  warnings: string[];
};

/** Where a loaded recording puts the machine (D10) */
export type DebugRecordingLanding = "saved" | "present" | "start";

export type DebugRecordingLoadOptions = {
  /** `saved` (the default): where it was saved - the present, or the cursor of a save in the past */
  land?: DebugRecordingLanding;
  /** Replay the whole recording once, checking every keyframe (D9) */
  verify?: boolean;
  /** Keep the current breakpoints instead of the recording's (D11) */
  noBreakpoints?: boolean;
  /** When this build cannot replay the recording, open its end state instead (D16) */
  acceptFallback?: boolean;
  /** The live SD card's identity (D14) */
  currentSdCard?: { fileName: string; size: number; fingerprint: string };
};

export type DebugRecordingLoadResult = {
  machineId: string;
  modelId?: string;
  machineName: string;
  pc: number;
  rebuilt: boolean;
  /** "timeline": the whole recording; "state": only its end state (D16); "refused": nothing loaded */
  path: "timeline" | "state" | "refused";
  /** Why the timeline cannot be replayed in this build (with `path: "refused"` or `"state"`) */
  refusal?: string;
  /** Where the machine stands */
  landed?: DebugRecordingLanding;
  records?: number;
  keyframes?: number;
  seconds?: number;
  /** Breakpoints added as session breakpoints */
  breakpointsAdded?: number;
  /** The recording's watches, for the IDE to add (D11) */
  watches?: unknown[];
  /** The recording's sources, for the IDE to compare with the project (D13) */
  sources?: RecordingSources;
  /** `-verify`: the keyframes the replay checked, and how long it took */
  verified?: { keyframes: number; ms: number };
  warnings: string[];
};

/** The `debug-recording-save` command for a file (the menu's save dialog has already asked to replace it) */
export function debugRecordingSaveCommandText(path: string, overwrite = false): string {
  return `debug-recording-save "${path.replace(/"/g, "")}"${overwrite ? " -f" : ""}`;
}

/** The `debug-recording-load` command for a file */
export function debugRecordingLoadCommandText(
  path: string,
  options: { start?: boolean; acceptFallback?: boolean } = {}
): string {
  return `debug-recording-load "${path.replace(/"/g, "")}"${options.start ? " -start" : ""}${options.acceptFallback ? " -y" : ""}`;
}

/** The end of the message `debug-recording-load` refuses a recording of another build with (D16) */
export const DEBUG_RECORDING_FALLBACK_HINT = "Use -y to open only its end state, without its past.";

/** Whether this build can replay a recording (the viewer, D19) */
export type DebugRecordingCompatibility = {
  /** The running core is the recording's, so the answer is known */
  known: boolean;
  /** Why this build cannot replay it; undefined when it can (or when not known) */
  refusal?: string;
  /** The running machine's core, when it is another one */
  liveCoreId?: string;
};
