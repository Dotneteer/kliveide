import { ReactElement, useEffect } from "react";
import { useDialogs } from "@renderer/controls/overlay/DialogProvider";
import { registerRendererDialogOpener } from "@renderer/controls/overlay/dialogRequestBridge";
import { ideDialogRegistry, IdeDialogResult } from "./dialogs/ideDialogRegistry";

export function IdeDialogBridge(): ReactElement | null {
  const dialogs = useDialogs();

  useEffect(() => {
    return registerRendererDialogOpener("ide", (dialogId) => {
      const dialogRenderer = ideDialogRegistry[dialogId];
      if (!dialogRenderer) {
        throw new Error(`Unknown IDE dialog ID: ${dialogId}`);
      }
      return dialogs.open<IdeDialogResult>((controls) => dialogRenderer(controls));
    });
  }, [dialogs]);

  return null;
}
