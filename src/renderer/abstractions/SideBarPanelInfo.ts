import type { ComponentType } from "react";
import type { PanelRenderer } from "./PanelRenderer";

/**
 * Props handed to a panel header's badge.
 */
export type SideBarPanelBadgeProps = {
  /** The panel the badge belongs to, so one badge component can serve several panels. */
  panelId: string;
  /** Whether the panel is currently expanded — a badge may want to say more when collapsed. */
  expanded: boolean;
};

/**
 * A small annotation rendered at the right of a panel header, before the chevron's title.
 *
 * A **component**, for the same reason `SideBarCommands` is one: a badge is almost always a live
 * count or state word — breakpoints set, watch expressions, whether the PSG is muted — and it has
 * to read the store to know it.
 *
 * Render `SideBarBadge` (`@renderer/appIde/SideBar/SideBarBadge`), which supplies the pill and
 * handles the empty case:
 *
 * ```tsx
 * const BreakpointsBadge = ({ panelId }: SideBarPanelBadgeProps) => {
 *   const count = useSelector((s) => s.debugger?.breakpoints?.length ?? 0);
 *   return <SideBarBadge count={count} title={`${count} breakpoints`} />;
 * };
 * ```
 *
 * `SideBarBadge` renders nothing for a zero or absent count, so a badge does not have to test for
 * its own emptiness — which matters, because a badge reading "0" is worse than no badge: it draws
 * the eye to a panel precisely when there is nothing in it.
 */
export type SideBarPanelBadge = ComponentType<SideBarPanelBadgeProps>;

/**
 * Describes a particular side bar panel
 */
export type SideBarPanelInfo = {
  /**
   * The ID of the panel
   */
  readonly id: string;
  /**
   * The title of the side bar panel
   */
  readonly title: string;

  /**
   * The host activity of the side bar panel
   */
  readonly hostActivity: string;

  /**
   * The function that renders the side bar panel
   */
  readonly renderer: PanelRenderer;

  /**
   * Whether the panel's content should be wrapped in a `ScrollViewer`. Defaults to `true`.
   *
   * Set this to `false` for panels that scroll themselves — anything rendering a
   * `VirtualizedList`, which supplies its own `ScrollViewer`. Nesting one inside another leaves
   * the virtualizer without a bounded viewport to measure against.
   *
   * Previously named `noScrollViewer`, whose sense was inverted: `noScrollViewer: false`
   * *suppressed* the viewer. The behaviour is unchanged; only the name now matches it.
   */
  readonly useScrollViewer?: boolean;

  /**
   * An optional annotation for this panel's header — typically a count.
   *
   * No panel defines one today, and a panel without it renders exactly as before: the slot
   * collapses, so nothing shifts and no space is reserved.
   */
  readonly badge?: SideBarPanelBadge;

  /**
   * Is the panel expanded when initializing?
   */
  readonly expandedOnInit?: boolean;

  /**
   * The initial size of the panel
   */
  readonly initialSize?: number;

  /**
   * The machine IDs this panel is restricted to
   */
  readonly restrictTo?: string[];

  /**
   * The features required for this panel
   */
  readonly requireFeature?: string[];

  /**
   * The configuration values required for this panel
   */
  readonly requireConfig?: string[];
};
