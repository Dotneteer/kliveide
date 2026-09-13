import { useEffect, useState } from "react";
import { useSelector } from "@renderer/core/RendererProvider";
import { useEmuApi } from "@renderer/core/EmuApi";
import { SideBarBadge } from "../SideBar/SideBarBadge";
import type { SideBarPanelBadgeProps } from "@renderer/abstractions/SideBarPanelInfo";

/**
 * How many breakpoints are set, shown on the Breakpoints panel's header.
 *
 * The badge earns its keep mainly while the panel is **collapsed**: that is the state in which the
 * sidebar currently gives no hint whether a panel is worth opening, and "are any breakpoints armed"
 * is a question a debugger user asks constantly.
 *
 * It cannot read a store slice, because breakpoints do not live in one. They are owned by the
 * emulator's `DebugSupport` and reached over IPC; the renderer store carries only
 * `breakpointsVersion`, a counter `DebugSupport` bumps on every mutation (set, remove, enable,
 * erase, resolve). So the count is fetched, and that counter is what says when to fetch it again.
 *
 * Note what this deliberately does *not* do: `BreakpointsPanel` additionally refreshes on
 * `useEmuStateListener`, i.e. on a timer while the machine runs. It has to, because the data it
 * draws (disassembly at the breakpoint address, the resolved address, the current PC) changes as
 * the machine executes even when the breakpoint list does not. A *count* changes only when the list
 * does, and every one of those paths bumps the version — so polling here would buy nothing and cost
 * an IPC round trip per tick, per open sidebar, forever.
 */
export const BreakpointsBadge = ({}: SideBarPanelBadgeProps) => {
  const emuApi = useEmuApi();
  const bpsVersion = useSelector((s) => s.emulatorState?.breakpointsVersion);
  // --- A machine change swaps the whole breakpoint set without necessarily bumping the version.
  const machineId = useSelector((s) => s.emulatorState?.machineId);
  const [counts, setCounts] = useState({ total: 0, disabled: 0 });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const state = await emuApi.listBreakpoints();
        // --- The badge unmounts when the user switches activity, and the reply can land after
        // --- that; without this guard React warns and, worse, a stale reply could overwrite a
        // --- newer one when two versions land out of order.
        if (cancelled) return;
        const bps = state?.breakpoints ?? [];
        setCounts({ total: bps.length, disabled: bps.filter((bp) => bp.disabled).length });
      } catch {
        // --- No machine yet, or the emulator is mid-restart. A header badge is not the place to
        // --- surface that: the panel below it reports emulator trouble already.
        if (!cancelled) setCounts({ total: 0, disabled: 0 });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [emuApi, bpsVersion, machineId]);

  return (
    <SideBarBadge
      count={counts.total}
      title={
        counts.disabled
          ? `${counts.total} breakpoints, ${counts.disabled} disabled`
          : `${counts.total} breakpoint${counts.total === 1 ? "" : "s"}`
      }
    />
  );
};
