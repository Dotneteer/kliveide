import { DialogRow } from "@renderer/controls/DialogRow";
import { VirtualizedList } from "@renderer/controls/VirtualizedList";

import { ExcludedItemRow } from "./ExcludedItemRow";
import type { ExcludedItemsIntent } from "./ExcludedItemsIntents";
import type { ExcludedItemsViewModel } from "./ExcludedItemsViewModel";
import styles from "./ExcludedProjectItemsDialog.module.scss";

export type ExcludedItemsViewProps = {
  vm: ExcludedItemsViewModel;
  dispatch: (intent: ExcludedItemsIntent) => void;
};

/**
 * The Excluded Items dialog body: the project's own list, which can be pruned,
 * and the application-wide one, which is shown for context.
 */
export const ExcludedItemsView = ({ vm, dispatch }: ExcludedItemsViewProps) => (
  <>
    <DialogRow label={vm.projectList.label}>
      <div className={styles.listWrapper} data-testid="project-excludes">
        <VirtualizedList
          items={vm.projectList.items}
          renderItem={(idx) => (
            <ExcludedItemRow
              item={vm.projectList.items[idx]}
              onRemove={() =>
                dispatch({
                  type: "itemRemovalRequested",
                  id: vm.projectList.items[idx].id
                })
              }
            />
          )}
        />
      </div>
    </DialogRow>
    <DialogRow label={vm.globalList.label}>
      <div className={styles.listWrapper} data-testid="global-excludes">
        <VirtualizedList
          items={vm.globalList.items}
          renderItem={(idx) => <ExcludedItemRow item={vm.globalList.items[idx]} />}
        />
      </div>
    </DialogRow>
  </>
);
