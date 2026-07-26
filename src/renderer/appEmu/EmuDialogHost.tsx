import { ReactElement, useEffect, useRef } from "react";
import {
  DialogControls,
  useDialogs
} from "@renderer/controls/overlay/DialogProvider";
import {
  CREATE_DISK_DIALOG,
  FIRST_STARTUP_DIALOG_EMU,
  Z88_CHANGE_RAM_DIALOG,
  Z88_EXPORT_CARD_DIALOG,
  Z88_INSERT_CARD_DIALOG,
  Z88_REMOVE_CARD_DIALOG
} from "@common/messaging/dialog-ids";
import {
  FirstStartDialog,
  FirstStartDialogResult
} from "@renderer/appIde/dialogs/FirstStartDialog";
import {
  CreateDiskDialog,
  CreateDiskDialogResult
} from "./dialogs/CreateDiskDialog";
import {
  Z88RemoveCardDialog,
  Z88RemoveCardDialogResult
} from "./dialogs/Z88RemoveCardDialog";
import {
  Z88InsertCardDialog,
  Z88InsertCardDialogResult
} from "./dialogs/Z88InsertCardDialog";
import {
  Z88ExportCardDialog,
  Z88ExportCardDialogResult
} from "./dialogs/Z88ExportCardDialog";
import {
  Z88ChangeRamDialog,
  Z88ChangeRamDialogResult
} from "./dialogs/Z88ChangeRamDialog";

type EmuDialogResult =
  | FirstStartDialogResult
  | CreateDiskDialogResult
  | Z88RemoveCardDialogResult
  | Z88InsertCardDialogResult
  | Z88ExportCardDialogResult
  | Z88ChangeRamDialogResult;

type EmuDialogRenderer = (
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
  )
};

type EmuDialogHostProps = {
  dialogData?: any;
  dialogId?: number;
  onClose: () => void;
};

export function EmuDialogHost({
  dialogData,
  dialogId,
  onClose
}: EmuDialogHostProps): ReactElement | null {
  const dialogs = useDialogs();
  const onCloseRef = useRef(onClose);

  onCloseRef.current = onClose;

  useEffect(() => {
    if (dialogId === undefined) return;
    const dialogRenderer = emuDialogRegistry[dialogId];
    if (!dialogRenderer) return;

    const legacyDialogId = `emu-dialog-${dialogId}`;
    void dialogs.openLegacy<EmuDialogResult>(
      (controls) => dialogRenderer(dialogData, controls),
      { id: legacyDialogId }
    ).finally(() => onCloseRef.current());

    return () => dialogs.closeById(legacyDialogId);
  }, [dialogData, dialogId, dialogs]);

  if (dialogId === undefined) return null;
  return null;
}
