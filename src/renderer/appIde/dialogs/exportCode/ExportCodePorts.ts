import type { ExportDialogSettings } from "@main/settings";
import type { FilePickerPort } from "@mvc/dialogs/DialogPorts";

export type ExportCodeDialogResult = {
  command: string;
  fullFilename: string;
  formatId: string;
  exportName: string;
  exportFolder: string;
  programName: string;
  startAddress: string;
};

// --- What running the export command reports back. `success` is the only field
// --- the dialog branches on; the message is for the user.
export type ExportCommandResult = {
  success: boolean;
  finalMessage?: string;
};

export type ExportCodeServicePort = {
  // --- Writes the form back into the project settings and saves the project.
  // --- The old dialog did this from an effect on every field change.
  persistSettings(settings: ExportDialogSettings): Promise<void>;
  // --- Runs the `expc` command against the build output pane.
  runExport(command: string): Promise<ExportCommandResult>;
  notify(type: "info" | "error", title: string, message: string): Promise<void>;
};

export type ExportCodeClosePort = {
  exported(result: ExportCodeDialogResult): Promise<void> | void;
  cancelled(): void;
};

export type ExportCodePorts = {
  files: FilePickerPort;
  close: ExportCodeClosePort;
  service: ExportCodeServicePort;
};
