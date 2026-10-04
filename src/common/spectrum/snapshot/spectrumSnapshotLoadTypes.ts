/*
 * The types of the emulator's `loadSpectrumSnapshot` call (`EmuApi`), shared by the IDE, the main
 * process and the emulator. See `.plans/ZX_SPECTRUM_SNAPSHOT_PLAN.md` §4.5.
 */

/**
 * What happens after the snapshot's state is restored: run ("run"), or debug, stopping at its PC
 * before that instruction runs ("debug"). There is no "load and stay paused" (D4).
 */
export type SpectrumSnapshotLoadMode = "run" | "debug";

/** Options of a load */
export type SpectrumSnapshotLoadOptions = {
  /**
   * Keep the machine's current model when the machine type matches but the model is not one the
   * snapshot prefers (a project is open, D7). A model the snapshot cannot run on is still refused.
   */
  keepModel?: boolean;
};

/** The result of a load; it crosses the process boundary, so it is plain data */
export type SpectrumSnapshotLoadResult = {
  /** The snapshot's PC, where the machine stands (or stopped, in "debug" mode) */
  pc: number;
  /** The machine the snapshot was loaded on */
  machineId: string;
  modelId?: string;
  /** Its display name */
  machineName: string;
  /** The machine was rebuilt to fit the snapshot */
  rebuilt: boolean;
  /** "sna", "z80" or "szx" */
  format: string;
  /** Warnings of the parser, the mapping and the load */
  warnings: string[];
};

/** How the `zx-snapshot` IDE command continues after the load */
export type SpectrumSnapshotCommandOption = "run" | "debug";

const COMMAND_FLAGS: Record<SpectrumSnapshotCommandOption, string> = {
  run: " -r",
  debug: " -d"
};

/**
 * The text of the `zx-snapshot` IDE command for a file. The menus, the drop handler, the viewer and
 * the Explorer build it here, so all of them quote the path the same way.
 * @param path The snapshot file
 * @param option What to do after loading
 */
export function spectrumSnapshotCommandText(
  path: string,
  option: SpectrumSnapshotCommandOption
): string {
  return `zx-snapshot "${path}"${COMMAND_FLAGS[option]}`;
}
