import { useMemo } from "react";

import { useMainApi } from "@renderer/core/MainApi";
import { useDialogs } from "@renderer/controls/overlay/DialogProvider";

import { ConfirmDialog } from "./ConfirmDialog";
import type {
  ConfirmPort,
  ConfirmRequest,
  DialogClosePort,
  FileDialogFilter,
  FilePickerPort
} from "./DialogPorts";

/**
 * The adapters that bind the generic dialog ports to the real renderer
 * services. This is the only module that knows a port is answered by
 * `useMainApi()` or `useDialogs()`; controllers and their tests see interfaces.
 */

export function useFilePickerPort(): FilePickerPort {
  const mainApi = useMainApi();
  return useMemo<FilePickerPort>(
    () => ({
      pickFile: async (filters: FileDialogFilter[], settingsKey?: string) =>
        // --- A dismissed picker comes back as an empty string; the port speaks
        // --- in "nothing was chosen" instead.
        (await mainApi.showOpenFileDialog(filters, settingsKey)) || undefined,
      pickFolder: async (settingsKey?: string) =>
        (await mainApi.showOpenFolderDialog(settingsKey)) || undefined
    }),
    [mainApi]
  );
}

export function useConfirmPort(): ConfirmPort {
  const dialogs = useDialogs();
  return useMemo<ConfirmPort>(
    () => ({
      confirm: async (request: ConfirmRequest) => {
        // --- Still opened through DialogProvider, per .docs/dialog-pattern.md.
        // --- The port only hides *which* service answers the question.
        const result = await dialogs.open<boolean, ConfirmRequest>(ConfirmDialog, request, {
          title: request.title,
          width: 460,
          dialogRole: "alertdialog",
          closeOnOutsideClick: false
        });
        // --- A dialog dismissed with Escape or the X resolves undefined, which
        // --- is a "no", not a missing answer to retry.
        return result === true;
      }
    }),
    [dialogs]
  );
}

export function useClosePort<TResult>(onClose: (result: TResult) => void): DialogClosePort<TResult> {
  return useMemo<DialogClosePort<TResult>>(() => ({ close: onClose }), [onClose]);
}
