import type { ExportDialogSettings } from "@main/settings";
import type { UiReducer } from "@mvc/core/types";
import type { IValidationService } from "@renderer/core/ValidationService";

import { decimalAddress, optionalPath, requiredFilename } from "../dialogValidators";
import { buildExportCodeCommand } from "./exportCodeCommand";

// ─── Vocabulary ──────────────────────────────────────────────────────────────

export type SelectOption = { value: string; label: string };

export const FORMAT_OPTIONS: SelectOption[] = [
  { value: "tap", label: "TAP format" },
  { value: "tzx", label: "TZX format" },
  { value: "hex", label: "Intel HEX format" }
];

// --- "none" is not a colour: it means "leave the border alone", and is why the
// --- value is a string here and a number|undefined in the saved settings.
export const NO_BORDER = "none";

export const BORDER_OPTIONS: SelectOption[] = [
  { value: NO_BORDER, label: "None" },
  { value: "0", label: "Black" },
  { value: "1", label: "Blue" },
  { value: "2", label: "Red" },
  { value: "3", label: "Magenta" },
  { value: "4", label: "Green" },
  { value: "5", label: "Cyan" },
  { value: "6", label: "Yellow" },
  { value: "7", label: "White" }
];

// --- Intel HEX carries raw bytes with no tape structure, so none of the
// --- loader options mean anything for it.
export const HEX_FORMAT = "hex";

export const DEFAULT_FORMAT = "tzx";

export const EXPORT_CODE_FOLDER_SETTINGS_KEY = "exportCodeFolder";

export const SCREEN_FILE_FILTERS = [
  { name: "Tape files", extensions: ["tap", "tzx"] },
  { name: "Screen files", extensions: ["scr"] },
  { name: "All Files", extensions: ["*"] }
];

export const EXPORT_TITLE = "Exporting code";
export const EXPORT_SUCCESS_MESSAGE = "Code successfully exported.";
export const EXPORT_FAILURE_MESSAGE = "Code export failed";
// --- The command reports an out-of-range address by naming the switch it came
// --- from; that is not something to show a user.
export const ADDRESS_RANGE_MESSAGE = "Code start address must be between 16384 and 65535.";
const ADDRESS_SWITCH = "-addr";

// ─── State ───────────────────────────────────────────────────────────────────

/**
 * The form, as the dialog holds it.
 *
 * Everything is a string or a boolean because that is what the controls speak;
 * the conversion to the saved shape happens in one place, on the way out.
 */
export type ExportCodeSettings = {
  formatId: string;
  exportFolder: string;
  exportName: string;
  programName: string;
  borderId: string;
  screenFilename: string;
  startAddress: string;
  startBlock: boolean;
  addPause: boolean;
  addClear: boolean;
  singleBlock: boolean;
};

export type ExportCodeEnvironment = {
  validation: IValidationService;
};

export type ExportCodeState = {
  env: ExportCodeEnvironment;
  settings: ExportCodeSettings;
  busy: boolean;
};

// ─── Reading and writing the saved settings ──────────────────────────────────

export function readExportCodeSettings(saved: ExportDialogSettings = {}): ExportCodeSettings {
  return {
    formatId: saved.formatId ?? DEFAULT_FORMAT,
    exportFolder: saved.exportFolder ?? "",
    exportName: saved.exportName ?? "",
    programName: saved.programName ?? "",
    borderId: saved.border?.toString() ?? NO_BORDER,
    screenFilename: saved.screenFilename ?? "",
    startAddress: saved.startAddress?.toString() ?? "",
    startBlock: saved.startBlock ?? true,
    addPause: saved.addPause ?? false,
    addClear: saved.addClear ?? true,
    singleBlock: saved.singleBlock ?? false
  };
}

// --- "none", and anything else that is not a number, is stored as absent.
export function borderNumberOf(borderId: string): number | undefined {
  const border = parseInt(borderId, 10);
  return isNaN(border) ? undefined : border;
}

export function savedSettingsOf(settings: ExportCodeSettings): ExportDialogSettings {
  return {
    formatId: settings.formatId,
    exportName: settings.exportName,
    exportFolder: settings.exportFolder,
    programName: settings.programName,
    border: borderNumberOf(settings.borderId),
    screenFilename: settings.screenFilename,
    startBlock: settings.startBlock,
    addClear: settings.addClear,
    addPause: settings.addPause,
    singleBlock: settings.singleBlock,
    // --- Left as the string the box holds: the action's own type says number,
    // --- but this is what the old dialog wrote and what it reads back.
    startAddress: settings.startAddress as unknown as number
  };
}

// ─── Events ──────────────────────────────────────────────────────────────────

export type ExportCodeEvent =
  | { type: "envReplaced"; env: ExportCodeEnvironment }
  | { type: "settingsChanged"; patch: Partial<ExportCodeSettings> }
  | { type: "exportStarted" }
  | { type: "exportSettled" };

// ─── Initial state ───────────────────────────────────────────────────────────

export function initialState(
  env: ExportCodeEnvironment,
  saved: ExportDialogSettings = {}
): ExportCodeState {
  return { env, settings: readExportCodeSettings(saved), busy: false };
}

// ─── Reducer ─────────────────────────────────────────────────────────────────

export const reduce: UiReducer<ExportCodeState, ExportCodeEvent> = (state, event) => {
  switch (event.type) {
    case "envReplaced":
      return event.env.validation === state.env.validation ? state : { ...state, env: event.env };

    case "settingsChanged": {
      // --- A patch that changes nothing must not wake a subscriber; the view
      // --- writes back the same value on every re-render of a control.
      const changed = Object.entries(event.patch).some(
        ([key, value]) => state.settings[key as keyof ExportCodeSettings] !== value
      );
      return changed ? { ...state, settings: { ...state.settings, ...event.patch } } : state;
    }

    case "exportStarted":
      return state.busy ? state : { ...state, busy: true };

    case "exportSettled":
      return state.busy ? { ...state, busy: false } : state;

    default:
      return state;
  }
};

// ─── Derived rules ───────────────────────────────────────────────────────────

export function folderErrorOf(state: ExportCodeState): string | undefined {
  return optionalPath(state.env.validation, state.settings.exportFolder);
}

export function exportNameErrorOf(state: ExportCodeState): string | undefined {
  return requiredFilename(state.env.validation, state.settings.exportName);
}

export function screenFileErrorOf(state: ExportCodeState): string | undefined {
  return optionalPath(state.env.validation, state.settings.screenFilename);
}

export function startAddressErrorOf(state: ExportCodeState): string | undefined {
  return decimalAddress(state.settings.startAddress);
}

export function canExport(state: ExportCodeState): boolean {
  return (
    !folderErrorOf(state) &&
    !exportNameErrorOf(state) &&
    !screenFileErrorOf(state) &&
    !startAddressErrorOf(state)
  );
}

// --- A HEX file has no tape blocks, so there is no loader to create.
export function supportsLoader(state: ExportCodeState): boolean {
  return state.settings.formatId !== HEX_FORMAT;
}

// --- The startup options only exist to configure the loader.
export function showsStartupOptions(state: ExportCodeState): boolean {
  return supportsLoader(state) && state.settings.startBlock;
}

export function commandOf(state: ExportCodeState): { command: string; fullFilename: string } {
  return buildExportCodeCommand({ ...state.settings });
}

/**
 * What to tell the user about a failed export.
 *
 * The command reports a rejected start address by echoing the switch it came
 * from; that gets translated. Anything else is passed through, and a failure
 * that said nothing at all still gets a sentence — the old dialog called
 * `.includes` on the missing message and threw a TypeError instead.
 */
export function exportFailureMessage(finalMessage?: string): string {
  if (finalMessage?.includes(ADDRESS_SWITCH)) return ADDRESS_RANGE_MESSAGE;
  return finalMessage || EXPORT_FAILURE_MESSAGE;
}

export function exportSuccessMessage(finalMessage?: string): string {
  return finalMessage ?? EXPORT_SUCCESS_MESSAGE;
}
