/*
 * The types of the emulator's `saveSpectrumSnapshot` call (`EmuApi`), shared by the IDE, the main
 * process and the emulator. See `.plans/SNAPSHOT_SAVING_AND_STATE_FILES_PLAN.md` §4.3.
 */

/** The result of a save; it crosses the process boundary, so it is plain data */
export type SpectrumSnapshotSaveResult = {
  /** The file's bytes */
  bytes: Uint8Array;
  /** What the format does not hold (D3); empty when the file is exact */
  losses: string[];
  /** The machine's display name */
  machineName: string;
  /** PC when the state was captured */
  pc: number;
  /** "sna", "z80" or "szx" */
  format: string;
};

/**
 * The text of the `zx-snapshot-save` IDE command for a file. The menus build it here, so they quote
 * the path the same way.
 * @param path The file to write (its extension picks the format)
 * @param overwrite Replace an existing file (the save dialog has already asked)
 */
export function spectrumSnapshotSaveCommandText(path: string, overwrite = false): string {
  return `zx-snapshot-save "${path}"${overwrite ? " -f" : ""}`;
}
