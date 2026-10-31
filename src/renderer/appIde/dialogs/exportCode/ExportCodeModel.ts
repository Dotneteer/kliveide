import { labelled, withLabels, withTexts } from "@common/i18n/labels";
import type { ExportDialogSettings } from "@main/settings";
import type { UiReducer } from "@mvc/core/types";
import type { IValidationService } from "@renderer/core/ValidationService";

import { decimalAddress, optionalPath, requiredFilename } from "../dialogValidators";
import { buildExportCodeCommand } from "./exportCodeCommand";

// ─── Vocabulary ──────────────────────────────────────────────────────────────

export type SelectOption = { value: string; label: string };

// --- The tables hold message keys; `withLabels` turns `label` into a getter that translates at
// --- display time, so the model itself stays text-free.
export const FORMAT_OPTIONS: SelectOption[] = withLabels([
  { value: "tap", labelKey: "dialog.exportCode.format.tap" },
  { value: "tzx", labelKey: "dialog.exportCode.format.tzx" },
  { value: "hex", labelKey: "dialog.exportCode.format.hex" }
]);

// --- The ZX80 and ZX81 have their own program files (`.plans/ZX8081_CODE_INJECTION_PLAN.md` D8);
// --- a ZX80 with the 8K ROM runs ZX81 programs, so it is offered both.
export const ZX81_PROGRAM_FORMAT = "p";
export const ZX80_PROGRAM_FORMAT = "o";
const ZX81_OPTION: SelectOption = labelled({
  value: ZX81_PROGRAM_FORMAT,
  labelKey: "dialog.exportCode.format.zx81Program"
});
const ZX80_OPTION: SelectOption = labelled({
  value: ZX80_PROGRAM_FORMAT,
  labelKey: "dialog.exportCode.format.zx80Program"
});
const HEX_OPTION: SelectOption = labelled({ value: "hex", labelKey: "dialog.exportCode.format.hex" });
export const ZX81_FORMAT_OPTIONS: SelectOption[] = [ZX81_OPTION, HEX_OPTION];

// --- The HT-1080Z's code goes into a .cmd load module or a .cas SYSTEM tape
// --- (`.plans/HT1080Z_CODE_INJECTION_PLAN.md` D6); `.cmd` comes first, the default (D-Q4)
export const HT1080Z_CMD_FORMAT = "cmd";
export const HT1080Z_CAS_FORMAT = "cas";
export const HT1080Z_FORMAT_OPTIONS: SelectOption[] = [
  labelled({ value: HT1080Z_CMD_FORMAT, labelKey: "dialog.exportCode.format.ht1080zCmd" }),
  labelled({ value: HT1080Z_CAS_FORMAT, labelKey: "dialog.exportCode.format.ht1080zCas" }),
  HEX_OPTION
];
export const ZX80_FORMAT_OPTIONS: SelectOption[] = [ZX80_OPTION, ZX81_OPTION, HEX_OPTION];

// --- The TVC's code goes into a .cas program file that LOAD runs (`renderer/appIde/utils/tvc-code.ts`);
// --- the same "cas" value as the HT-1080Z's, which the export command tells apart by the build's model
export const TVC_CAS_FORMAT = "cas";
export const TVC_FORMAT_OPTIONS: SelectOption[] = [
  labelled({ value: TVC_CAS_FORMAT, labelKey: "dialog.exportCode.format.tvcCas" }),
  HEX_OPTION
];

// --- The Enterprise's code goes into an EXOS `$$APP` .com file (`renderer/appIde/utils/ep-code.ts`)
export const EP_COM_FORMAT = "com";
export const EP_FORMAT_OPTIONS: SelectOption[] = [
  labelled({ value: EP_COM_FORMAT, labelKey: "dialog.exportCode.format.epCom" }),
  HEX_OPTION
];

// --- A bootable disk (`.plans/DISK_IMAGES_AND_FILE_SYSTEMS_PLAN.md` B6): a +3DOS `.dsk` on the
// --- +2A/+3, a TR-DOS `.trd` on the machines with a Beta 128 (the Pentagon, the Scorpion)
export const DSK_FORMAT = "dsk";
export const TRD_FORMAT = "trd";
const DSK_OPTION: SelectOption = labelled({ value: DSK_FORMAT, labelKey: "dialog.exportCode.format.dsk" });
const TRD_OPTION: SelectOption = labelled({ value: TRD_FORMAT, labelKey: "dialog.exportCode.format.trd" });
// --- A Microdrive cartridge on the machines that can have an Interface 1 (`.plans/MICRODRIVE_PLAN.md` Q7)
export const MDR_FORMAT = "mdr";
const MDR_OPTION: SelectOption = labelled({ value: MDR_FORMAT, labelKey: "dialog.exportCode.format.mdr" });

/** The formats the running machine's code exports as */
export function formatOptionsFor(machineId: string | undefined): SelectOption[] {
  if (machineId === "zx81") return ZX81_FORMAT_OPTIONS;
  if (machineId === "zx80") return ZX80_FORMAT_OPTIONS;
  if (machineId === "ht1080z") return HT1080Z_FORMAT_OPTIONS;
  if (machineId === "tvc") return TVC_FORMAT_OPTIONS;
  if (machineId === "ep") return EP_FORMAT_OPTIONS;
  if (machineId === "spp3e") return [...FORMAT_OPTIONS, DSK_OPTION];
  if (machineId === "sp128") return [...FORMAT_OPTIONS, TRD_OPTION, MDR_OPTION];
  if (machineId === "scorpion") return [...FORMAT_OPTIONS, TRD_OPTION];
  if (machineId === "sp48") return [...FORMAT_OPTIONS, MDR_OPTION];
  return FORMAT_OPTIONS;
}

// --- "none" is not a colour: it means "leave the border alone", and is why the
// --- value is a string here and a number|undefined in the saved settings.
export const NO_BORDER = "none";

export const BORDER_OPTIONS: SelectOption[] = withLabels([
  { value: NO_BORDER, labelKey: "dialog.exportCode.border.none" },
  { value: "0", labelKey: "dialog.exportCode.border.black" },
  { value: "1", labelKey: "dialog.exportCode.border.blue" },
  { value: "2", labelKey: "dialog.exportCode.border.red" },
  { value: "3", labelKey: "dialog.exportCode.border.magenta" },
  { value: "4", labelKey: "dialog.exportCode.border.green" },
  { value: "5", labelKey: "dialog.exportCode.border.cyan" },
  { value: "6", labelKey: "dialog.exportCode.border.yellow" },
  { value: "7", labelKey: "dialog.exportCode.border.white" }
]);

// --- Intel HEX carries raw bytes with no tape structure, so none of the
// --- loader options mean anything for it.
export const HEX_FORMAT = "hex";

export const DEFAULT_FORMAT = "tzx";

export const EXPORT_CODE_FOLDER_SETTINGS_KEY = "exportCodeFolder";

export const SCREEN_FILE_FILTERS = [
  withTexts({ extensions: ["tap", "tzx"] }, { name: "dialog.exportCode.filter.tapeFiles" }),
  withTexts({ extensions: ["scr"] }, { name: "dialog.exportCode.filter.screenFiles" }),
  withTexts({ extensions: ["*"] }, { name: "common.filter.allFiles" })
];

// --- The command reports an out-of-range address by naming the switch it came
// --- from; that is not something to show a user.
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
  /** The formats to offer (`formatOptionsFor`); the Spectrum's when absent */
  formats?: SelectOption[];
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
      return event.env.validation === state.env.validation && event.env.formats === state.env.formats
        ? state
        : { ...state, env: event.env };

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

/** The formats on offer */
export function formatOptionsOf(state: ExportCodeState): SelectOption[] {
  return state.env.formats ?? FORMAT_OPTIONS;
}

// --- A saved format the machine does not offer (TZX on a ZX81) gives way to its first one.
export function effectiveFormatOf(state: ExportCodeState): string {
  const options = formatOptionsOf(state);
  return options.some((o) => o.value === state.settings.formatId)
    ? state.settings.formatId
    : options[0].value;
}

// --- A HEX file has no tape blocks, so there is no loader to create; a ZX80 program cannot start
// --- itself. On a ZX81 program the checkbox makes it run once loaded. An HT-1080Z .cmd or .cas
// --- always carries its start address: SYSTEM's `/` starts it. A TVC .cas (the same "cas") always
// --- starts itself, and so does an Enterprise .com (EXOS starts it at 0100h).
export function supportsLoader(state: ExportCodeState): boolean {
  const format = effectiveFormatOf(state);
  return (
    format !== HEX_FORMAT &&
    format !== ZX80_PROGRAM_FORMAT &&
    format !== HT1080Z_CMD_FORMAT &&
    format !== HT1080Z_CAS_FORMAT &&
    format !== EP_COM_FORMAT
  );
}

// --- On a ZX81 program the loader checkbox means "run once loaded", not "add a BASIC loader".
export function loaderRunsProgram(state: ExportCodeState): boolean {
  return effectiveFormatOf(state) === ZX81_PROGRAM_FORMAT;
}

// --- The startup options only exist to configure the Spectrum's BASIC loader.
export function showsStartupOptions(state: ExportCodeState): boolean {
  return (
    supportsLoader(state) && state.settings.startBlock && effectiveFormatOf(state) !== ZX81_PROGRAM_FORMAT
  );
}

export function commandOf(state: ExportCodeState): { command: string; fullFilename: string } {
  return buildExportCodeCommand({ ...state.settings, formatId: effectiveFormatOf(state) });
}

/**
 * Whether a failed export's message is the command's complaint about the start address.
 *
 * The command reports a rejected start address by echoing the switch it came from; the view model
 * replaces that with a sentence (`exportFailureMessage`).
 */
export function isAddressRangeFailure(finalMessage?: string): boolean {
  return !!finalMessage?.includes(ADDRESS_SWITCH);
}
