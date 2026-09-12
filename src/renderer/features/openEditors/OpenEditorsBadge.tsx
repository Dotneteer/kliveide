import { SideBarBadge } from "@renderer/appIde/SideBar/SideBarBadge";
import { useOpenEditors } from "./useOpenEditors";
import type { SideBarPanelBadgeProps } from "@renderer/abstractions/SideBarPanelInfo";

/**
 * How many editors are open, shown on the Open Editors panel header.
 *
 * Counts the rows of `useOpenEditors` rather than the documents of the active hub: the badge is
 * most useful exactly when the panel is collapsed, and a number that disagrees with the list it
 * summarises is worse than no number. `SideBarBadge` renders nothing for a zero count, so the
 * header stays quiet while nothing is open.
 */
export const OpenEditorsBadge = ({}: SideBarPanelBadgeProps) => {
  const count = useOpenEditors().length;
  return (
    <SideBarBadge count={count} title={`${count} open editor${count === 1 ? "" : "s"}`} />
  );
};
