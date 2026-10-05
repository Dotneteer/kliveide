/*
 * The types of the emulator's RZX calls (`EmuApi`) and the text of the IDE's RZX commands, shared by
 * the IDE, the main process and the emulator (`.plans/RZX_PLAN.md` §1.6, §4.6).
 */

/** What to do once a recording's snapshot is loaded */
export type RzxPlayMode = "run" | "debug";

export type RzxPlayOptions = {
  /** A project is open: keep its model when it is of the right machine type */
  keepModel?: boolean;
  /** Start at this segment (an embedded snapshot); 0 is the first */
  segment?: number;
};

export type RzxPlayResult = {
  machineId: string;
  modelId?: string;
  machineName: string;
  /** The machine was rebuilt to fit the recording */
  rebuilt: boolean;
  /** Frames in the whole file */
  frames: number;
  segments: number;
  /** The creator, as "Fuse 1.10" */
  creator: string;
  pc: number;
  warnings: string[];
};

export type RzxVideoOptions = RzxPlayOptions & {
  /** Run as fast as the core allows (D18); the video is identical either way */
  unthrottled?: boolean;
};

export type RzxRecordResult = {
  machineName: string;
  pc: number;
  /** Playback that was running and is now taken over (D16) */
  tookOverPlayback: boolean;
};

export type RzxStopRecordingResult = {
  /** The finalised file */
  bytes: Uint8Array;
  frames: number;
  /** Rollback points the recording held */
  points: number;
};

export type RzxRollbackResult = {
  /** The recording's frame count after the rollback */
  frame: number;
  /** Rollback points left */
  points: number;
};

/** The IDE command that plays a file */
export function rzxPlayCommandText(path: string, debug = false, segment?: number): string {
  return `zx-rzx "${path}"${debug ? " -d" : ""}${segment ? ` -s ${segment + 1}` : ""}`;
}

/** The IDE command that renders a file to video */
export function rzxVideoCommandText(path: string, realTime = false): string {
  return `zx-rzx-video "${path}"${realTime ? " -t" : ""}`;
}

/** The IDE command that stops the recording and saves it */
export function rzxStopCommandText(path: string, overwrite = false): string {
  return `zx-rzx-stop "${path}"${overwrite ? " -f" : ""}`;
}
