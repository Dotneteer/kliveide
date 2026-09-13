import {
  BORDER_OPTIONS,
  FORMAT_OPTIONS,
  canExport,
  exportNameErrorOf,
  folderErrorOf,
  screenFileErrorOf,
  showsStartupOptions,
  startAddressErrorOf,
  supportsLoader,
  type ExportCodeState,
  type SelectOption
} from "./ExportCodeModel";

// ─── View model shape ────────────────────────────────────────────────────────

export type TextFieldViewModel = {
  value: string;
  error?: string;
};

export type SelectViewModel = {
  options: SelectOption[];
  value: string;
};

// --- A string discriminant, not a boolean: this project compiles with
// --- `strictNullChecks: false`, under which TypeScript does not narrow a union
// --- on a boolean-literal discriminant.
export type StartupOptionsViewModel =
  | { kind: "hidden" }
  | {
      kind: "shown";
      addClear: boolean;
      addPause: boolean;
      singleBlock: boolean;
      border: SelectViewModel;
      screenFile: TextFieldViewModel;
      startAddress: TextFieldViewModel;
    };

export type ExportCodeViewModel = {
  format: SelectViewModel;
  exportFolder: TextFieldViewModel;
  exportName: TextFieldViewModel;
  programName: TextFieldViewModel;
  // --- The "Create BASIC loader" checkbox, absent for formats with no tape.
  loader: { kind: "hidden" } | { kind: "shown"; checked: boolean };
  startup: StartupOptionsViewModel;
  submitLabel: string;
  submitEnabled: boolean;
  submitting: boolean;
};

// ─── Selector ────────────────────────────────────────────────────────────────

export function selectViewModel(state: ExportCodeState): ExportCodeViewModel {
  const settings = state.settings;
  return {
    format: { options: FORMAT_OPTIONS, value: settings.formatId },
    exportFolder: { value: settings.exportFolder, error: folderErrorOf(state) },
    exportName: { value: settings.exportName, error: exportNameErrorOf(state) },
    // --- No rule of its own: an empty program name falls back to the file name
    // --- when the command is built.
    programName: { value: settings.programName },
    loader: supportsLoader(state)
      ? { kind: "shown", checked: settings.startBlock }
      : { kind: "hidden" },
    startup: showsStartupOptions(state)
      ? {
          kind: "shown",
          addClear: settings.addClear,
          addPause: settings.addPause,
          singleBlock: settings.singleBlock,
          border: { options: BORDER_OPTIONS, value: settings.borderId },
          screenFile: { value: settings.screenFilename, error: screenFileErrorOf(state) },
          startAddress: { value: settings.startAddress, error: startAddressErrorOf(state) }
        }
      : { kind: "hidden" },
    submitLabel: "Export",
    submitEnabled: canExport(state) && !state.busy,
    submitting: state.busy
  };
}
