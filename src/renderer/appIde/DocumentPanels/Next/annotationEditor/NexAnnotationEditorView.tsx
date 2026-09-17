import { Icon } from "@renderer/controls/Icon";
import { SmallIconButton } from "@renderer/controls/IconButton";
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
  type NexAnnotationEditorViewModel,
  type NexAnnotationMenuAction
} from "./NexAnnotationEditorViewModel";

type Dispatch = (intent: NexAnnotationEditorIntent) => void;

/**
 * The annotation controls in a popped-out bank's header: a warning indicator and the annotations
 * menu button.
 *
 * There is no Save. Annotations are written as they are made, so the warning is the only thing the
 * file has left to say — and it now says it only when something actually went wrong.
 *
 * Dumb by construction — it renders the view model and dispatches intents, and decides nothing. The
 * enablement rules all live in `selectViewModel`, which is why they can be asserted without a DOM.
 */
export const NexAnnotationToolbar = ({
  vm,
  onMenuRequested
}: {
  vm: NexAnnotationEditorViewModel;
  onMenuRequested: (event: React.MouseEvent) => void;
}) => {
  if (!vm.toolbar.visible) return null;

  return (
    <>
      {vm.toolbar.warning.kind === "warning" && (
        <span title={vm.toolbar.warning.title}>
          <Icon iconName="warning" fill="--status-error" width={16} height={16} />
        </span>
      )}
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
    case "goto-definition":
      return { type: "goToDefinitionRequested", rowIndex };
    case "manage-labels":
      return { type: "manageLabelsRequested" };
    case "manage-regions":
      return { type: "manageRegionsRequested" };
    case "bank-comment":
      return { type: "bankCommentRequested" };
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
