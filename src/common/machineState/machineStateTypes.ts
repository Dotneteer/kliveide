/*
 * The types of the emulator's Klive state calls (`EmuApi.saveMachineStateFile`,
 * `EmuApi.loadMachineStateFile`), shared by the IDE, the main process and the emulator. See
 * `.plans/SNAPSHOT_SAVING_AND_STATE_FILES_PLAN.md` §4.8.
 */

/** What happens after a state is loaded: run, or debug, stopping at PC before it runs */
export type MachineStateLoadMode = "run" | "debug";

/** The result of a save; plain data */
export type MachineStateSaveResult = {
  /** The `.kls` file */
  bytes: Uint8Array;
  machineName: string;
  pc: number;
  /** What the file lacks (a Spectrum state without its portable .szx part) */
  warnings: string[];
};

/** The result of a load; plain data */
export type MachineStateLoadResult = {
  machineId: string;
  modelId?: string;
  machineName: string;
  /** PC where the machine stands */
  pc: number;
  /** The machine was rebuilt to fit the state */
  rebuilt: boolean;
  /** "image": the exact state; "szx": the portable fallback of another Klive version */
  path: "image" | "szx";
  warnings: string[];
  /** Set when nothing was loaded because the user must confirm first (a changed SD card) */
  needsConfirmation?: string;
};

/** An SD card image's identity: its file, size and a fingerprint of its content */
export type SdCardFingerprint = { fileName: string; size: number; fingerprint: string };

/**
 * The text of the `state-load` IDE command for a file
 * @param path The `.kls` file
 * @param option What to do after loading
 */
export function machineStateLoadCommandText(path: string, option: MachineStateLoadMode): string {
  return `state-load "${path}" ${option === "run" ? "-r" : "-d"}`;
}

/**
 * The text of the `state-save` IDE command for a file
 * @param path The `.kls` file
 * @param overwrite Replace an existing file (the save dialog has already asked)
 */
export function machineStateSaveCommandText(path: string, overwrite = false): string {
  return `state-save "${path}"${overwrite ? " -f" : ""}`;
}
