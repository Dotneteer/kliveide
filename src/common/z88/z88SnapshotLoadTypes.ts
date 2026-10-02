/*
 * The types of the emulator's `loadZ88Snapshot` call (`EmuApi`), shared by the IDE, the main process
 * and the emulator. See `.plans/Z88_SNAPSHOT_PLAN.md` §4.5.
 */

/**
 * What happens after the snapshot's state is restored: run ("run"), or debug, stopping at its PC
 * before that instruction runs ("debug").
 *
 * There is no "load and stay paused": it ended in the same place as "debug" - paused at PC - and
 * differed only in that Continue then ran without breakpoints, which nothing on screen told apart.
 */
export type Z88SnapshotLoadMode = "run" | "debug";

/** The result of a load; it crosses the process boundary, so it is plain data */
export type Z88SnapshotLoadResult = {
  /** The snapshot's PC, where the machine stands (or stopped, in "debug" mode) */
  pc: number;
  /** TIM0..TIM4 as restored, after the RTC catch-up */
  tim: number[];
  /** The machine was rebuilt to fit the snapshot */
  rebuilt: boolean;
  /** The snapshot's `Autorun` flag */
  autorun: boolean;
  /** Warnings of the parser and the mapping */
  warnings: string[];
};

/** How the `z88-snapshot` IDE command continues after the load */
export type Z88SnapshotCommandOption = "run" | "debug" | "autorun";

const COMMAND_FLAGS: Record<Z88SnapshotCommandOption, string> = {
  run: " -r",
  debug: " -d",
  autorun: " -a"
};

/**
 * The text of the `z88-snapshot` IDE command for a file. The emulator menu and the `.z88` viewer
 * build it here, so both quote the path the same way.
 * @param path The `.z88` file
 * @param option What to do after loading; "autorun" follows the file's `Autorun` flag
 */
export function z88SnapshotCommandText(path: string, option: Z88SnapshotCommandOption): string {
  return `z88-snapshot "${path}"${COMMAND_FLAGS[option]}`;
}
