/**
 * Port shapes shared by dialogs built on the UI MVC infrastructure.
 *
 * A port is an interface a controller calls and a test fakes. Keeping the
 * outside world behind these three shapes is what lets a dialog's whole
 * behavior be driven with no React, no DOM and no module mocking.
 */

export type FileDialogFilter = {
  name: string;
  extensions: string[];
};

export type FilePickerPort = {
  // --- Resolves to undefined when the user dismisses the picker.
  pickFile(
    filters: FileDialogFilter[],
    settingsKey?: string
  ): Promise<string | undefined>;
  pickFolder(settingsKey?: string): Promise<string | undefined>;
};

export type ConfirmRequest = {
  title: string;
  // --- Rendered as separate lines, above and below the optional code block.
  lines: string[];
  // --- A path or value shown verbatim in a monospaced block between the lines.
  code?: string;
  linesAfterCode?: string[];
  confirmLabel: string;
  cancelLabel: string;
  // --- Styles the confirm button as destructive.
  danger?: boolean;
};

export type ConfirmPort = {
  // --- False for both "no" and "dismissed": a question nobody answered is not
  // --- permission to proceed.
  confirm(request: ConfirmRequest): Promise<boolean>;
};

export type DialogClosePort<TResult> = {
  close(result: TResult): void;
};
