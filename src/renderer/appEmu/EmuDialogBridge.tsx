import { ReactElement, useEffect, useState } from "react";
import { useDialogs } from "@renderer/controls/overlay/DialogProvider";
import { registerRendererDialogOpener } from "@renderer/controls/overlay/dialogRequestBridge";
import { emuDialogRegistry, EmuDialogResult } from "./dialogs/emuDialogRegistry";

export function EmuDialogBridge(): ReactElement | null {
  const dialogs = useDialogs();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unregister = registerRendererDialogOpener("emu", (dialogId, dialogData) => {
      const dialogRenderer = emuDialogRegistry[dialogId];
      if (!dialogRenderer) {
        throw new Error(`Unknown EMU dialog ID: ${dialogId}`);
      }
      return dialogs.open<EmuDialogResult>((controls) => dialogRenderer(dialogData, controls));
    });
    setReady(true);
    return () => {
      setReady(false);
      unregister();
    };
  }, [dialogs]);

  return ready ? <span aria-hidden="true" data-dialog-bridge-ready="true" /> : null;
}
