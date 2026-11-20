import { useCallback } from "react";

import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { useBreakpointDialog } from "@renderer/appIde/dialogs/useBreakpointDialog";

import type { NextPaletteDeviceId } from "./nextPaletteDevices";
import { entryBreakpoint, entryBreakpointSpec } from "./paletteDocumentModel";
import { usePaletteBreakpointList } from "./usePaletteBreakpointList";

/**
 * The `pal:` breakpoints the Palette document marks and edits
 * (`dev/plans/NEXT_PALETTE_DEBUGGING_PLAN.md` §4). Every action goes through the command layer, as
 * the Sprite Inspector's do, so the command line, the dialog and the views agree on what a
 * breakpoint is.
 */
export function usePaletteBreakpoints() {
  const { ideCommandsService } = useAppServices();
  const openBreakpointDialog = useBreakpointDialog();
  const { breakpoints, refresh } = usePaletteBreakpointList();

  /** Sets the entry's breakpoint, or removes it when it has one */
  const toggle = useCallback(
    async (device: NextPaletteDeviceId, bank: 0 | 1, index: number, changed = false) => {
      const spec = `pal:${entryBreakpointSpec(device, bank, index)}`;
      const existing = entryBreakpoint(breakpoints, device, bank, index);
      const result = await ideCommandsService.executeCommand(
        existing ? `bp-del ${spec}` : `bp-set ${spec}${changed ? " -changed" : ""}`
      );
      await refresh();
      return result;
    },
    [breakpoints, ideCommandsService, refresh]
  );

  /** Opens the breakpoint dialog on the entry's breakpoint */
  const edit = useCallback(
    async (device: NextPaletteDeviceId, bank: 0 | 1, index: number) => {
      const existing = entryBreakpoint(breakpoints, device, bank, index);
      if (existing && (await openBreakpointDialog(existing))) await refresh();
    },
    [breakpoints, openBreakpointDialog, refresh]
  );

  return { breakpoints, toggle, edit };
}
