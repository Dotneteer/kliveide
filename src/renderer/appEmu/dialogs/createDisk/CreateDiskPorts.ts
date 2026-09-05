import type { FilePickerPort } from "@mvc/dialogs/DialogPorts";

export type CreateDiskDialogResult = {
  diskType: string;
  folder: string;
  filename: string;
  path: string;
};

/**
 * The main-process half of this dialog, narrowed to what it actually uses.
 * Narrow on purpose: a fake has to implement all of it.
 */
export type CreateDiskServicePort = {
  createDiskFile(folder: string, filename: string, diskType: string): Promise<string>;
  // --- The modal message box. Both the success confirmation and the failure
  // --- report go through it, so it is one call, not two ports.
  notify(type: "info" | "error", title: string, message: string): Promise<void>;
};

/**
 * A dialog settles two different ways and the shared `DialogClosePort` only
 * models one, so this dialog names both: `created` carries a result to the
 * caller, `cancelled` says nothing was made.
 */
export type CreateDiskClosePort = {
  created(result: CreateDiskDialogResult): void;
  cancelled(): void;
};

export type CreateDiskPorts = {
  files: FilePickerPort;
  close: CreateDiskClosePort;
  service: CreateDiskServicePort;
};
