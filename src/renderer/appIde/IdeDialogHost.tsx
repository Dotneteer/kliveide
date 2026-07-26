import { ReactElement, useEffect, useRef } from "react";
import {
  DialogControls,
  useDialogs
} from "@renderer/controls/overlay/DialogProvider";
import {
  EXPORT_CODE_DIALOG,
  EXCLUDED_PROJECT_ITEMS_DIALOG,
  FIRST_STARTUP_DIALOG_IDE,
  NEW_PROJECT_DIALOG
} from "@messaging/dialog-ids";
import {
  NewProjectDialog,
  NewProjectDialogResult
} from "./dialogs/NewProjectDialog";
import {
  ExportCodeDialog,
  ExportCodeDialogResult
} from "./dialogs/ExportCodeDialog";
import {
  ExcludedProjectItemsDialog,
  ExcludedProjectItemsDialogResult
} from "./dialogs/ExcludedProjectItemsDialog";
import {
  FirstStartDialog,
  FirstStartDialogResult
} from "./dialogs/FirstStartDialog";

type IdeDialogResult =
  | NewProjectDialogResult
  | ExportCodeDialogResult
  | ExcludedProjectItemsDialogResult
  | FirstStartDialogResult;

type IdeDialogRenderer = (controls: DialogControls<IdeDialogResult>) => ReactElement;

export const ideDialogRegistry: Record<number, IdeDialogRenderer> = {
  [NEW_PROJECT_DIALOG]: (controls) => (
    <NewProjectDialog onCreate={(result) => controls.close(result)} onClose={controls.cancel} />
  ),
  [EXPORT_CODE_DIALOG]: (controls) => (
    <ExportCodeDialog onExport={(result) => controls.close(result)} onClose={controls.cancel} />
  ),
  [EXCLUDED_PROJECT_ITEMS_DIALOG]: (controls) => (
    <ExcludedProjectItemsDialog onApply={(result) => controls.close(result)} onClose={controls.cancel} />
  ),
  [FIRST_STARTUP_DIALOG_IDE]: (controls) => (
    <FirstStartDialog onResolve={(result) => controls.close(result)} onClose={controls.cancel} />
  )
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
    void dialogs.openLegacy<IdeDialogResult>(
      (controls) => dialogRenderer(controls),
      { id: legacyDialogId }
    ).finally(() => onCloseRef.current());

    return () => dialogs.closeById(legacyDialogId);
  }, [dialogId, dialogs]);

  if (dialogId === undefined) return null;
  return null;
}
