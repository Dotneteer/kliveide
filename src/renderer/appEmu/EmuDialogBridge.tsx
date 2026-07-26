import { ReactElement, useEffect } from "react";
import { useDialogs } from "@renderer/controls/overlay/DialogProvider";
import { registerRendererDialogOpener } from "@renderer/controls/overlay/dialogRequestBridge";
import { emuDialogRegistry, EmuDialogResult } from "./dialogs/emuDialogRegistry";

export function EmuDialogBridge(): ReactElement | null {
  const dialogs = useDialogs();

  useEffect(() => {
    return registerRendererDialogOpener("emu", (dialogId, dialogData) => {
      const dialogRenderer = emuDialogRegistry[dialogId];
      if (!dialogRenderer) {
        throw new Error(`Unknown EMU dialog ID: ${dialogId}`);
      }
      return dialogs.openLegacy<EmuDialogResult>(
        (controls) => dialogRenderer(dialogData, controls),
        { id: `emu-dialog-${dialogId}` }
      );
    });
  }, [dialogs]);

  return null;
}
