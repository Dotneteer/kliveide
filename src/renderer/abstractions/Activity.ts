import type { ComponentType } from "react";

/**
 * Props handed to an activity's sidebar command menu.
 */
export type SideBarCommandsProps = {
  /**
   * Dismisses the menu.
   *
   * Call it from every item's `clicked` handler. The menu does not close itself on selection —
   * some commands are toggles, and closing those would make a multi-step adjustment impossible.
   */
  close: () => void;
};

/**
 * The contents of the "..." menu in a sidebar's title strip.
 *
 * A **component**, not a list of command descriptors. A sidebar command's label, enabled state and
 * often its very presence depend on live application state — whether a machine is running, whether
 * the project has build roots, how many breakpoints exist. A component reads that with the same
 * hooks the rest of the IDE uses (`useSelector`, `useAppServices`). A static descriptor list would
 * need a context object threaded from the registry through the header to reach any of it, and the
 * registry is a module-level constant with no access to a store.
 *
 * Render `ContextMenuItem`s from `@renderer/controls/ContextMenu`:
 *
 * ```tsx
 * const DebugCommands = ({ close }: SideBarCommandsProps) => {
 *   const dispatch = useDispatch();
 *   const count = useSelector((s) => s.debugger?.breakpoints?.length ?? 0);
 *   return (
 *     <ContextMenuItem
 *       text="Remove all breakpoints"
 *       disabled={count === 0}
 *       dangerous
 *       clicked={() => {
 *         close();
 *         dispatch(removeAllBreakpointsAction());
 *       }}
 *     />
 *   );
 * };
 * ```
 */
export type SideBarCommands = ComponentType<SideBarCommandsProps>;

/**
 * Describes an activity in the Activity bar
 */
export type Activity = {
  /**
   * The identifier of the activity.
   */
  readonly id: string;

  /**
   * Activity title
   */
  readonly title: string;

  /**
   * The name of the associated icon.
   */
  readonly iconName: string;

  /**
   * Commands for this sidebar, reached through a "..." button at the right of its title strip.
   *
   * **Omitting this renders no button at all** — which is the case for every activity today. The
   * button is not a permanent fixture that sometimes has an empty menu: a control that opens
   * nothing is worse than no control, so the strip stays clean until an activity has something to
   * put in it.
   *
   * The one case this cannot detect is an activity that defines `commands` whose items all happen
   * to be hidden right now; that renders a button over an empty menu. If a command set can empty
   * itself out completely, gate the whole activity's menu rather than each item.
   */
  readonly commands?: SideBarCommands;
};
