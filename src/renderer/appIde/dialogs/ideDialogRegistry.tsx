import { ReactElement } from "react";
import { DialogControls } from "@renderer/controls/overlay/DialogProvider";
import {
  ABOUT_DIALOG,
  EXPORT_CODE_DIALOG,
  EXCLUDED_PROJECT_ITEMS_DIALOG,
  FIRST_STARTUP_DIALOG_IDE,
  NEW_PROJECT_DIALOG
} from "@messaging/dialog-ids";
import type { AboutDialogData } from "@common/messaging/about-dialog";
import { AboutDialog, AboutDialogResult } from "./AboutDialog";
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
  | FirstStartDialogResult
  | AboutDialogResult;

export type IdeDialogRenderer = (
  data: any,
  controls: DialogControls<IdeDialogResult>
) => ReactElement;

export const ideDialogRegistry: Record<number, IdeDialogRenderer> = {
  [NEW_PROJECT_DIALOG]: (_, controls) => (
    <NewProjectDialog onCreate={(result) => controls.close(result)} onClose={controls.cancel} />
  ),
  [EXPORT_CODE_DIALOG]: (_, controls) => (
    <ExportCodeDialog onExport={(result) => controls.close(result)} onClose={controls.cancel} />
  ),
  [EXCLUDED_PROJECT_ITEMS_DIALOG]: (_, controls) => (
    <ExcludedProjectItemsDialog onApply={(result) => controls.close(result)} onClose={controls.cancel} />
  ),
  [FIRST_STARTUP_DIALOG_IDE]: (_, controls) => (
    <FirstStartDialog onResolve={(result) => controls.close(result)} onClose={controls.cancel} />
  ),
  [ABOUT_DIALOG]: (data, controls) => (
    <AboutDialog
      about={data as AboutDialogData}
      onClose={(result) => controls.close(result)}
    />
  )
};
