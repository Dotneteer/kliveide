import type { AppState } from "../state/AppState";
import { createSettingsReader } from "./SettingsReader";

/*
 * The shortcut that starts and stops the IDE + Emulator recording (Machine | Recording).
 *
 * The accelerator uses Electron's syntax and can be overridden with the `shortcuts.recordIdeEmu`
 * user setting, like the stepping and navigation shortcuts. The default is free in the menus, the
 * machine menus and Monaco's re-bound keys (which cover F7 with one modifier, not two).
 *
 * See `.plans/IDE_EMU_RECORDING_PLAN.md` §5.3.
 */

export const SHORTCUT_RECORD_IDE_EMU = "shortcuts.recordIdeEmu";

export const DEFAULT_RECORD_IDE_EMU_SHORTCUT = "Ctrl+Shift+F7";

/** The configured shortcut, falling back to the default */
export function readRecordIdeEmuShortcut(state: AppState | undefined): string {
  const value = createSettingsReader(state).readSetting(SHORTCUT_RECORD_IDE_EMU);
  return typeof value === "string" && value.trim() ? value.trim() : DEFAULT_RECORD_IDE_EMU_SHORTCUT;
}
