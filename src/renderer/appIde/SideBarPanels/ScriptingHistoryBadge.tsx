import { useSelector } from "@renderer/core/RendererProvider";
import { isScriptCompleted } from "@common/utils/script-utils";
import { SideBarBadge } from "../SideBar/SideBarBadge";
import type { SideBarPanelBadgeProps } from "@renderer/abstractions/SideBarPanelInfo";

/**
 * How many scripts are still running.
 *
 * A *running* script is the only thing in this panel worth watching from a collapsed header — the
 * history itself is a log, and a count of everything that ever ran is trivia rather than the "fact
 * worth watching" `SideBarBadge`'s convention asks for. It is also the one number here that moves
 * on its own, which is what makes it a badge and not a filter-row count like `SysVarsPanel`'s.
 *
 * `accent` rather than `neutral`: unlike the Watch and Breakpoints badges, this is not a standing
 * fact about how the workspace is configured but a transient "something is happening right now".
 *
 * Scripts are renderer state, so this is a selector and nothing else — no fetch, and no refresh
 * contract to get wrong. Compare `BreakpointsBadge`, whose data lives in the emulator.
 */
export const ScriptingHistoryBadge = ({}: SideBarPanelBadgeProps) => {
  // --- The count, not the array: a number compares by value, so an unrelated store update cannot
  // --- re-render this header. `ScriptingHistoryPanel` selects the list because it draws the items.
  const running = useSelector(
    (s) => s.scripts?.filter((script) => !isScriptCompleted(script.status)).length ?? 0
  );

  // --- `count`, not `children`: `children` bypasses the component's zero-guard, and a badge
  // --- reading "0" on a panel with nothing running is exactly what that guard exists to prevent.
  return (
    <SideBarBadge
      count={running}
      tone="accent"
      title={`${running} script${running === 1 ? "" : "s"} running`}
    />
  );
};
