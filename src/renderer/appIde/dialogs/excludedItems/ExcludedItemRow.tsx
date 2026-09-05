import classnames from "classnames";
import { useState } from "react";

import { TabButton } from "@renderer/controls/TabButton";
import { TooltipFactory, useTooltipRef } from "@renderer/controls/Tooltip";

import type { ExcludedItemViewModel } from "./ExcludedItemsViewModel";
import styles from "./ExcludedProjectItemsDialog.module.scss";

export type ExcludedItemRowProps = {
  item: ExcludedItemViewModel;
  onRemove?: () => void;
};

/**
 * One row of an exclusion list.
 *
 * The hover and tooltip-offset state is genuinely local presentation — it
 * describes where the pointer is, not anything the dialog decides — so it stays
 * here rather than in the model.
 */
export const ExcludedItemRow = ({ item, onRemove }: ExcludedItemRowProps) => {
  const ref = useTooltipRef();
  const [mouseOver, setMouseOver] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const removable = item.removable && !!onRemove;

  return (
    <div
      className={classnames(styles.listItem, { [styles.disabled]: !removable })}
      data-testid="excluded-item"
      onMouseEnter={() => setMouseOver(true)}
      onMouseLeave={() => setMouseOver(false)}
    >
      <div className={styles.listItemTitle}>
        <span
          ref={ref}
          onMouseOver={(e) => {
            // --- Centres the tooltip on the pointer rather than on the row,
            // --- which matters for a path wider than the dialog.
            const rc = (e.target as HTMLElement)?.getBoundingClientRect();
            setOffset({
              x: rc ? e.clientX - 0.5 * (rc.left + rc.right) : 0,
              ...offset
            });
          }}
        >
          {item.value}
        </span>
      </div>
      {/* --- Absent rather than disabled for a global item: the old row hid the
          --- button whenever it was disabled anyway, and a wrapper with the
          --- click on it is addressable, which TabButton's bare div is not. */}
      {removable && (
        <div data-testid="excluded-item-remove" onClick={() => onRemove?.()}>
          <TabButton iconName="close" hide={!mouseOver} />
        </div>
      )}

      <TooltipFactory
        refElement={ref.current}
        placement="top"
        offsetX={offset.x}
        offsetY={offset.y}
        isShown={mouseOver}
        content={item.id}
      />
    </div>
  );
};
