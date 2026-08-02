import { ReactElement } from "react";
import { DialogControls } from "@renderer/controls/overlay/DialogProvider";
import {
  ABOUT_DIALOG,
  CREATE_DISK_DIALOG,
  FIRST_STARTUP_DIALOG_EMU,
  Z88_CHANGE_RAM_DIALOG,
  Z88_EXPORT_CARD_DIALOG,
  Z88_INSERT_CARD_DIALOG,
  Z88_REMOVE_CARD_DIALOG
} from "@common/messaging/dialog-ids";
import type { AboutDialogData } from "@common/messaging/about-dialog";
import { AboutDialog, AboutDialogResult } from "@renderer/appIde/dialogs/AboutDialog";
import {
  FirstStartDialog,
  FirstStartDialogResult
} from "@renderer/appIde/dialogs/FirstStartDialog";
import {
  CreateDiskDialog,
  CreateDiskDialogResult
} from "./CreateDiskDialog";
import {
  Z88RemoveCardDialog,
  Z88RemoveCardDialogResult
} from "./Z88RemoveCardDialog";
import {
  Z88InsertCardDialog,
  Z88InsertCardDialogResult
} from "./Z88InsertCardDialog";
import {
  Z88ExportCardDialog,
  Z88ExportCardDialogResult
} from "./Z88ExportCardDialog";
import {
  Z88ChangeRamDialog,
  Z88ChangeRamDialogResult
} from "./Z88ChangeRamDialog";

export type EmuDialogResult =
  | FirstStartDialogResult
  | CreateDiskDialogResult
  | Z88RemoveCardDialogResult
  | Z88InsertCardDialogResult
  | Z88ExportCardDialogResult
  | Z88ChangeRamDialogResult
  | AboutDialogResult;

export type EmuDialogRenderer = (
  data: any,
  controls: DialogControls<EmuDialogResult>
) => ReactElement;

export const emuDialogRegistry: Record<number, EmuDialogRenderer> = {
  [FIRST_STARTUP_DIALOG_EMU]: (_, controls) => (
    <FirstStartDialog onResolve={(result) => controls.close(result)} onClose={controls.cancel} />
  ),
  [Z88_REMOVE_CARD_DIALOG]: (data, controls) => (
    <Z88RemoveCardDialog
      slot={data}
      onRemove={(result) => controls.close(result)}
      onClose={controls.cancel}
    />
  ),
  [Z88_INSERT_CARD_DIALOG]: (data, controls) => (
    <Z88InsertCardDialog
      slot={data}
      onInsert={(result) => controls.close(result)}
      onClose={controls.cancel}
    />
  ),
  [Z88_EXPORT_CARD_DIALOG]: (data, controls) => (
    <Z88ExportCardDialog
      slot={data}
      onExport={(result) => controls.close(result)}
      onClose={controls.cancel}
    />
  ),
  [Z88_CHANGE_RAM_DIALOG]: (_, controls) => (
    <Z88ChangeRamDialog onChange={(result) => controls.close(result)} onClose={controls.cancel} />
  ),
  [CREATE_DISK_DIALOG]: (_, controls) => (
    <CreateDiskDialog onCreate={(result) => controls.close(result)} onClose={controls.cancel} />
  ),
  [ABOUT_DIALOG]: (data, controls) => (
    <AboutDialog
      about={data as AboutDialogData}
      onClose={(result) => controls.close(result)}
    />
  )
};
