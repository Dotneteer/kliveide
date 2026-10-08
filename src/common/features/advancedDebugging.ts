/*
 * The advanced-debugging feature switch: one user setting that turns the whole G4 and G5 feature
 * group of `.plans/CLOSING_THE_GAPS_PLAN.md` on or off.
 *
 * - G4: the execution history (viewer, lite step back, trace export), full reverse debugging (the
 *   timeline, Reverse Step/Continue, Take over here) and debug session recordings (`.klr`).
 * - G5: code coverage and the heat map, the profiler, unit tests and the CLI. None of it is built
 *   yet; each piece must check `isAdvancedDebuggingEnabled` (or gate its machine feature through
 *   `ADVANCED_DEBUGGING_FEATURES`) when it is.
 *
 * **Off unless the user opts in**, like `devTools.allow` (`docs/content/howto/diagnostics.mdx`):
 *
 *   set -u features.advancedDebugging 1      (then restart Klive)
 *
 * The main process reads the setting **once, at startup**, and publishes the result as
 * `emulatorState.advancedDebugging` in the shared store, so the menus, the IDE, the emulator and
 * the machine controller all see one value for the whole session. Reading it once is deliberate:
 * turning the group off mid-session would strand a running timeline, a history cursor in the past
 * or an open recording halfway.
 *
 * Off, the group is both hidden and inert: the gated machine features read as absent, so every
 * menu item, toolbar button, shortcut, command and panel that keys on them disappears or explains
 * itself, and the machine controller never starts the history recorder or the timeline, so the
 * group costs nothing at run time.
 */

import type { AppState } from "@common/state/AppState";
import type { MachineInfo } from "@common/machines/info-types";
import type { createSettingsReader } from "@common/utils/SettingsReader";

import { MF_EXEC_HISTORY, MF_REVERSE_DEBUG } from "@common/machines/constants";

/** The user setting (`set -u features.advancedDebugging 1`). */
export const ADVANCED_DEBUGGING_SETTING = "features.advancedDebugging";

/**
 * The machine features that belong to the group: off, a machine is treated as not having them.
 * G5 adds its own (the coverage plan's `MF_PROFILE`) here.
 */
export const ADVANCED_DEBUGGING_FEATURES: readonly string[] = [MF_EXEC_HISTORY, MF_REVERSE_DEBUG];

/** What a command or a refused action says when the group is off. */
export const ADVANCED_DEBUGGING_OFF_MESSAGE =
  "Execution history and reverse debugging are turned off. Turn them on with " +
  `'set -u ${ADVANCED_DEBUGGING_SETTING} 1', then restart Klive.`;

/** The switch as the user set it; anything but an explicit "on" is off. */
export function readAdvancedDebuggingSetting(reader: ReturnType<typeof createSettingsReader>): boolean {
  return reader.readBooleanSetting(ADVANCED_DEBUGGING_SETTING);
}

/** Is the group on for this session? (`emulatorState.advancedDebugging`, set at startup) */
export function isAdvancedDebuggingEnabled(state: AppState | undefined): boolean {
  return state?.emulatorState?.advancedDebugging === true;
}

/**
 * Does the machine have `feature`, given the switch? The group's features read as absent while it
 * is off; every other feature is the machine's own answer.
 */
export function hasMachineFeature(
  machine: Pick<MachineInfo, "features"> | undefined,
  feature: string,
  state: AppState | undefined
): boolean {
  if (!machine?.features?.[feature]) return false;
  return !ADVANCED_DEBUGGING_FEATURES.includes(feature) || isAdvancedDebuggingEnabled(state);
}
