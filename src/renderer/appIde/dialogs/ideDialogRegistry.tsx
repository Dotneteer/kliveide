import { ReactElement } from "react";
import { DialogControls } from "@renderer/controls/overlay/DialogProvider";
import {
  EXPORT_CODE_DIALOG,
  EXCLUDED_PROJECT_ITEMS_DIALOG,
  FIRST_STARTUP_DIALOG_IDE,
  NEW_PROJECT_DIALOG
} from "@messaging/dialog-ids";
import {
  NewProjectDialog,
  NewProjectDialogResult
} from "./NewProjectDialog";
import {
  ExportCodeDialog,
  ExportCodeDialogResult
} from "./ExportCodeDialog";
import {
  ExcludedProjectItemsDialog,
  ExcludedProjectItemsDialogResult
} from "./ExcludedProjectItemsDialog";
import {
  FirstStartDialog,
  FirstStartDialogResult
} from "./FirstStartDialog";

export type IdeDialogResult =
  | NewProjectDialogResult
  | ExportCodeDialogResult
  | ExcludedProjectItemsDialogResult
  | FirstStartDialogResult;

export type IdeDialogRenderer = (controls: DialogControls<IdeDialogResult>) => ReactElement;

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
