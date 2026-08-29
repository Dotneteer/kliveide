import { ReactElement, useEffect, useState } from "react";
import { useDialogs } from "@renderer/controls/overlay/DialogProvider";
import { registerRendererDialogOpener } from "@renderer/controls/overlay/dialogRequestBridge";
import { ideDialogRegistry, IdeDialogResult } from "./dialogs/ideDialogRegistry";

export function IdeDialogBridge(): ReactElement | null {
  const dialogs = useDialogs();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unregister = registerRendererDialogOpener("ide", (dialogId, dialogData) => {
      const dialogRenderer = ideDialogRegistry[dialogId];
      if (!dialogRenderer) {
        throw new Error(`Unknown IDE dialog ID: ${dialogId}`);
      }
      return dialogs.open<IdeDialogResult>((controls) => dialogRenderer(dialogData, controls));
    });
    setReady(true);
    return () => {
      setReady(false);
      unregister();
    };
  }, [dialogs]);

  return ready ? <span aria-hidden="true" data-dialog-bridge-ready="true" /> : null;
}
