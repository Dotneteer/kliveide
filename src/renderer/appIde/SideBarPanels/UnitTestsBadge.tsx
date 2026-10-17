import { useSelector } from "@renderer/core/RendererProvider";
import { SideBarBadge } from "../SideBar/SideBarBadge";
import type { SideBarPanelBadgeProps } from "@renderer/abstractions/SideBarPanelInfo";
import { useT } from "@common/i18n/useT";

/**
 * The failure count on the Unit Tests panel's header (`.plans/Z80_UNIT_TESTS_PLAN.md` D13): tests
 * that failed or ended in an error in their last run. The count is selected, not the results, so the
 * badge re-renders only when the number changes.
 */
export const UnitTestsBadge = ({}: SideBarPanelBadgeProps) => {
  const t = useT();
  const failures = useSelector((s) =>
    Object.values(s.unitTests?.results ?? {}).reduce((n, r) => (r.status === "passed" ? n : n + 1), 0)
  );
  return (
    <SideBarBadge count={failures} tone="error" title={t("panels.side.badge.failingTests", { count: failures })} />
  );
};
