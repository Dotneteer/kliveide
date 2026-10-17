import { t } from "@common/i18n/i18n";

import {
  BORDER_OPTIONS,
  canExport,
  effectiveFormatOf,
  formatOptionsOf,
  isAddressRangeFailure,
  loaderRunsProgram,
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
  loader: { kind: "hidden" } | { kind: "shown"; checked: boolean; label: string };
  startup: StartupOptionsViewModel;
  submitLabel: string;
  submitEnabled: boolean;
  submitting: boolean;
};

// ─── Formatting ──────────────────────────────────────────────────────────────

export function loaderLabelOf(state: ExportCodeState): string {
  return loaderRunsProgram(state)
    ? t("dialog.exportCode.loader.runProgram")
    : t("dialog.exportCode.loader.createBasicLoader");
}

/** The title of the message box that reports the export's outcome */
export function exportTitle(): string {
  return t("dialog.exportCode.notify.title");
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
  if (isAddressRangeFailure(finalMessage)) return t("dialog.exportCode.notify.addressRange");
  return finalMessage || t("dialog.exportCode.notify.failed");
}

export function exportSuccessMessage(finalMessage?: string): string {
  return finalMessage ?? t("dialog.exportCode.notify.succeeded");
}

// ─── Selector ────────────────────────────────────────────────────────────────

export function selectViewModel(state: ExportCodeState): ExportCodeViewModel {
  const settings = state.settings;
  return {
    format: { options: formatOptionsOf(state), value: effectiveFormatOf(state) },
    exportFolder: { value: settings.exportFolder, error: folderErrorOf(state) },
    exportName: { value: settings.exportName, error: exportNameErrorOf(state) },
    // --- No rule of its own: an empty program name falls back to the file name
    // --- when the command is built.
    programName: { value: settings.programName },
    loader: supportsLoader(state)
      ? { kind: "shown", checked: settings.startBlock, label: loaderLabelOf(state) }
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
    submitLabel: t("dialog.exportCode.submit"),
    submitEnabled: canExport(state) && !state.busy,
    submitting: state.busy
  };
}
