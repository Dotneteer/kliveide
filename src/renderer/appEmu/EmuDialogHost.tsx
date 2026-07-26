import { ReactElement } from "react";
import {
  CREATE_DISK_DIALOG,
  FIRST_STARTUP_DIALOG_EMU,
  Z88_CHANGE_RAM_DIALOG,
  Z88_EXPORT_CARD_DIALOG,
  Z88_INSERT_CARD_DIALOG,
  Z88_REMOVE_CARD_DIALOG
} from "@common/messaging/dialog-ids";
import { FirstStartDialog } from "@renderer/appIde/dialogs/FirstStartDialog";
import { CreateDiskDialog } from "./dialogs/CreateDiskDialog";
import { Z88RemoveCardDialog } from "./dialogs/Z88RemoveCardDialog";
import { Z88InsertCardDialog } from "./dialogs/Z88InsertCardDialog";
import { Z88ExportCardDialog } from "./dialogs/Z88ExportCardDialog";
import { Z88ChangeRamDialog } from "./dialogs/Z88ChangeRamDialog";

type EmuDialogRenderer = (data: any, onClose: () => void) => ReactElement;

export const emuDialogRegistry: Record<number, EmuDialogRenderer> = {
  [FIRST_STARTUP_DIALOG_EMU]: (_, onClose) => <FirstStartDialog onClose={onClose} />,
  [Z88_REMOVE_CARD_DIALOG]: (data, onClose) => <Z88RemoveCardDialog slot={data} onClose={onClose} />,
  [Z88_INSERT_CARD_DIALOG]: (data, onClose) => <Z88InsertCardDialog slot={data} onClose={onClose} />,
  [Z88_EXPORT_CARD_DIALOG]: (data, onClose) => <Z88ExportCardDialog slot={data} onClose={onClose} />,
  [Z88_CHANGE_RAM_DIALOG]: (_, onClose) => <Z88ChangeRamDialog onClose={onClose} />,
  [CREATE_DISK_DIALOG]: (_, onClose) => <CreateDiskDialog onClose={onClose} />
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
  if (dialogId === undefined) return null;
  return emuDialogRegistry[dialogId]?.(dialogData, onClose) ?? null;
}
