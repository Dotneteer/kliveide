import { ReactElement, useEffect, useRef } from "react";
import { useDialogs } from "@renderer/controls/overlay/DialogProvider";
import {
  EXPORT_CODE_DIALOG,
  EXCLUDED_PROJECT_ITEMS_DIALOG,
  FIRST_STARTUP_DIALOG_IDE,
  NEW_PROJECT_DIALOG
} from "@messaging/dialog-ids";
import { NewProjectDialog } from "./dialogs/NewProjectDialog";
import { ExportCodeDialog } from "./dialogs/ExportCodeDialog";
import { ExcludedProjectItemsDialog } from "./dialogs/ExcludedProjectItemsDialog";
import { FirstStartDialog } from "./dialogs/FirstStartDialog";

type IdeDialogRenderer = (onClose: () => void) => ReactElement;

export const ideDialogRegistry: Record<number, IdeDialogRenderer> = {
  [NEW_PROJECT_DIALOG]: (onClose) => <NewProjectDialog onCreate={async () => {}} onClose={onClose} />,
  [EXPORT_CODE_DIALOG]: (onClose) => <ExportCodeDialog onExport={async () => {}} onClose={onClose} />,
  [EXCLUDED_PROJECT_ITEMS_DIALOG]: (onClose) => <ExcludedProjectItemsDialog onClose={onClose} />,
  [FIRST_STARTUP_DIALOG_IDE]: (onClose) => <FirstStartDialog onClose={onClose} />
};

type IdeDialogHostProps = {
  dialogId?: number;
  onClose: () => void;
};

export function IdeDialogHost({ dialogId, onClose }: IdeDialogHostProps): ReactElement | null {
  const dialogs = useDialogs();
  const onCloseRef = useRef(onClose);

  onCloseRef.current = onClose;

  useEffect(() => {
    if (dialogId === undefined) return;
    const dialogRenderer = ideDialogRegistry[dialogId];
    if (!dialogRenderer) return;

    const legacyDialogId = `ide-dialog-${dialogId}`;
    void dialogs.openLegacy<void>(
      (controls) =>
        dialogRenderer(() => {
          controls.cancel();
          onCloseRef.current();
        }),
      { id: legacyDialogId }
    );

    return () => dialogs.closeById(legacyDialogId);
  }, [dialogId, dialogs]);

  if (dialogId === undefined) return null;
  return null;
}
