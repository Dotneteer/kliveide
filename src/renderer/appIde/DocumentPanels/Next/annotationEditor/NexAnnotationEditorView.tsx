import { Icon } from "@renderer/controls/Icon";
import { SmallIconButton } from "@renderer/controls/IconButton";
import { LabelSeparator } from "@renderer/controls/layout/LabelSeparator";
import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuSeparator
} from "@renderer/controls/ContextMenu";
import type { IContextMenuApi, ContextMenuState } from "@renderer/controls/ContextMenu";

import type { NexAnnotationEditorIntent } from "./NexAnnotationEditorIntents";
import {
  ANNOTATIONS_MENU_TITLE,
  regionTypeOfAction,
  SAVE_ANNOTATIONS_TITLE,
  type NexAnnotationEditorViewModel,
  type NexAnnotationMenuAction
} from "./NexAnnotationEditorViewModel";

type Dispatch = (intent: NexAnnotationEditorIntent) => void;

/**
 * The annotation controls in a popped-out bank's header: a warning indicator, Save, and the
 * annotations menu button.
 *
 * Dumb by construction — it renders the view model and dispatches intents, and decides nothing. The
 * enablement rules all live in `selectViewModel`, which is why they can be asserted without a DOM.
 */
export const NexAnnotationToolbar = ({
  vm,
  dispatch,
  onMenuRequested
}: {
  vm: NexAnnotationEditorViewModel;
  dispatch: Dispatch;
  onMenuRequested: (event: React.MouseEvent) => void;
}) => {
  if (!vm.toolbar.visible) return null;

  return (
    <>
      <LabelSeparator width={8} />
      {vm.toolbar.warning.kind === "warning" && (
        <span title={vm.toolbar.warning.title}>
          <Icon iconName="warning" fill="--status-error" width={16} height={16} />
        </span>
      )}
      <SmallIconButton
        iconName="save"
        title={SAVE_ANNOTATIONS_TITLE}
        enable={vm.toolbar.saveEnabled}
        fill={vm.toolbar.saveHighlighted ? "--status-warning" : undefined}
        clicked={() => dispatch({ type: "saveRequested" })}
      />
      <SmallIconButton
        iconName="note"
        title={ANNOTATIONS_MENU_TITLE}
        enable={vm.toolbar.menuEnabled}
        clicked={onMenuRequested}
      />
    </>
  );
};

/**
 * The annotations menu, rendered from `vm.menu`.
 *
 * The entries and their enablement are data from the view model, so adding an action is a change in
 * one place rather than three. A click conceals the menu first and then dispatches: the dialogs that
 * follow are modal, and a menu left open would sit under them.
 */
export const NexAnnotationMenu = ({
  vm,
  dispatch,
  state,
  api,
  rowIndex
}: {
  vm: NexAnnotationEditorViewModel;
  dispatch: Dispatch;
  state: ContextMenuState;
  api: IContextMenuApi;
  rowIndex?: number;
}) => (
  <ContextMenu state={state} onClickOutside={api.conceal}>
    {vm.menu.map((entry, index) =>
      entry.kind === "separator" ? (
        <ContextMenuSeparator key={index} />
      ) : (
        <ContextMenuItem
          key={entry.id}
          text={entry.text}
          disabled={entry.disabled}
          /*
            * The key that also reaches this action, in the menu's own trailing slot.
            *
            * Discoverability is the whole cost of choosing bare letters: nothing about the listing
            * suggests that a lone `N` does anything, so the menu has to say so. The hint comes from
            * the same table the keyboard handler matches against, so the two cannot drift.
            */
          trailing={entry.shortcut}
          clicked={() => {
            api.conceal();
            dispatch(intentForAction(entry.id, rowIndex));
          }}
        />
      )
    )}
  </ContextMenu>
);

/** Which intent a menu entry stands for. */
export function intentForAction(
  action: NexAnnotationMenuAction,
  rowIndex?: number
): NexAnnotationEditorIntent {
  const regionType = regionTypeOfAction(action);
  if (regionType) return { type: "regionTypeMarked", regionType, rowIndex };

  switch (action) {
    case "manage-labels":
      return { type: "manageLabelsRequested" };
    case "manage-regions":
      return { type: "manageRegionsRequested" };
    case "synopsis":
      return { type: "synopsisCommentRequested", rowIndex };
    case "comment":
      return { type: "endOfLineCommentRequested", rowIndex };
    case "global-label":
      return { type: "labelRequested", scope: "global", rowIndex };
    case "local-label":
      return { type: "labelRequested", scope: "local", rowIndex };
    case "operand-label":
      return { type: "operandLabelRequested", rowIndex };
    default:
      return { type: "rowAnnotationsCleared", rowIndex };
  }
}
