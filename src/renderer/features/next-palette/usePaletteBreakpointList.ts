import { useCallback, useEffect, useState } from "react";

import type { BreakpointInfo } from "@abstractions/BreakpointInfo";
import { isPaletteStop } from "@common/utils/breakpoint-scope";
import { useEmuApi } from "@renderer/core/EmuApi";
import { useSelector } from "@renderer/core/RendererProvider";

/**
 * The `pal:` breakpoints, re-read whenever the breakpoint list changes. The Next Palettes panel marks
 * devices with it; `usePaletteBreakpoints` adds the actions. Kept apart so the panel does not pull in
 * the breakpoint dialog.
 */
export function usePaletteBreakpointList(): { breakpoints: BreakpointInfo[]; refresh: () => Promise<void> } {
  const emuApi = useEmuApi();
  const bpsVersion = useSelector((s) => s.emulatorState?.breakpointsVersion);
  const [breakpoints, setBreakpoints] = useState<BreakpointInfo[]>([]);

  const refresh = useCallback(async () => {
    const { breakpoints: all } = await emuApi.listBreakpoints();
    setBreakpoints(all.filter((bp) => isPaletteStop(bp)));
  }, [emuApi]);
  useEffect(() => {
    refresh().catch(() => {});
  }, [bpsVersion, refresh]);

  return { breakpoints, refresh };
}
