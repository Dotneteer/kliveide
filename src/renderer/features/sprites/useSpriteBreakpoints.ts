import { useCallback, useEffect, useState } from "react";

import type { BreakpointInfo } from "@abstractions/BreakpointInfo";
import { isSpriteBreakpoint } from "@common/utils/breakpoint-scope";
import { formatSpriteIndex } from "@common/zxnext/sprites/spriteBreakpoints";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { useBreakpointDialog } from "@renderer/appIde/dialogs/useBreakpointDialog";
import { useEmuApi } from "@renderer/core/EmuApi";
import { useSelector } from "@renderer/core/RendererProvider";

/** A sprite's `sp:` breakpoint, as the Sprite Inspector marks and edits it. */
export type SpriteBreakpointState = { disabled: boolean; bp: BreakpointInfo };

/**
 * The `sp:` breakpoints the Sprite Inspector shows and edits (G3.8, sprite half;
 * `.plans/SPRITE_ATTRIBUTE_BREAKPOINTS_PLAN.md`), keyed by sprite. Every action goes through the
 * command layer, as the Copper List's gutter does, so the command line, the dialog and the views
 * cannot disagree about what a breakpoint is.
 */
export function useSpriteBreakpoints() {
  const emuApi = useEmuApi();
  const { ideCommandsService } = useAppServices();
  const openBreakpointDialog = useBreakpointDialog();
  const bpsVersion = useSelector((s) => s.emulatorState?.breakpointsVersion);
  const [breakpoints, setBreakpoints] = useState<Map<number, SpriteBreakpointState>>(new Map());

  const refresh = useCallback(async () => {
    const { breakpoints: all } = await emuApi.listBreakpoints();
    const map = new Map<number, SpriteBreakpointState>();
    for (const bp of all) {
      // --- A run-to target is not a breakpoint the table marks
      if (isSpriteBreakpoint(bp) && !bp.runTo) {
        map.set(bp.spriteIndex! & 0x7f, { disabled: !!bp.disabled, bp });
      }
    }
    setBreakpoints(map);
  }, [emuApi]);
  useEffect(() => {
    refresh().catch(() => {});
  }, [bpsVersion, refresh]);

  const toggle = useCallback(
    async (sprite: number) => {
      const spec = `sp:${formatSpriteIndex(sprite)}`;
      await ideCommandsService.executeCommand(
        breakpoints.has(sprite) ? `bp-del ${spec}` : `bp-set ${spec}`
      );
      await refresh();
    },
    [breakpoints, ideCommandsService, refresh]
  );

  const edit = useCallback(
    async (sprite: number) => {
      const existing = breakpoints.get(sprite)?.bp;
      if (existing && (await openBreakpointDialog(existing))) await refresh();
    },
    [breakpoints, openBreakpointDialog, refresh]
  );

  const runUntilWrite = useCallback(
    (sprite: number) => ideCommandsService.executeCommand(`run-to sp:${formatSpriteIndex(sprite)}`),
    [ideCommandsService]
  );

  return { breakpoints, toggle, edit, runUntilWrite };
}
