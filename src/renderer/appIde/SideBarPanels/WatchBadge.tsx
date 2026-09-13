import { useSelector } from "@renderer/core/RendererProvider";
import { SideBarBadge } from "../SideBar/SideBarBadge";
import type { SideBarPanelBadgeProps } from "@renderer/abstractions/SideBarPanelInfo";

/**
 * How many watch expressions are defined, shown on the Watch panel's header.
 *
 * Unlike `BreakpointsBadge`, this needs no fetching and no refresh contract: watch expressions are
 * renderer state (`AppState.watchExpressions`), so a selector is the whole implementation. The two
 * badges look different because the data underneath them genuinely is — not because one of them is
 * doing it the long way.
 *
 * The length is selected rather than the array, deliberately. `useSelector((s) =>
 * s.watchExpressions || [])` — as `WatchPanel` does, because it needs the items — allocates a fresh
 * `[]` on every state change while the list is empty, so a referential-equality check never matches
 * and the badge would re-render on every unrelated store update. A number compares by value.
 */
export const WatchBadge = ({}: SideBarPanelBadgeProps) => {
  const count = useSelector((s) => s.watchExpressions?.length ?? 0);
  return (
    <SideBarBadge
      count={count}
      title={`${count} watch expression${count === 1 ? "" : "s"}`}
    />
  );
};
