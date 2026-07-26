import classnames from "classnames";
import type { MouseEvent } from "react";
import { ITreeNode } from "@abstractions/ITreeNode";
import { ProjectNode } from "@abstractions/ProjectNode";
import { Icon } from "@controls/Icon";
import { SpaceFiller } from "@controls/SpaceFiller";
import { LabelSeparator } from "@renderer/controls/layout/LabelSeparator";
import styles from "./ExplorerPanel.module.scss";

type ExplorerProjectItemProps = {
  canShowExcludedItems: boolean;
  focused: boolean;
  isBuildRoot: boolean;
  isKliveProject: boolean;
  isRoot: boolean;
  isSelected: boolean;
  node: ITreeNode<ProjectNode>;
  tabIndex: number;
  onActivate: () => void;
  onContextMenu: (event: MouseEvent, node: ITreeNode<ProjectNode>) => void;
  onDoubleClick: () => void;
  onExcludedItemsClick: () => void;
  onSelect: () => void;
};

export function ExplorerProjectItem({
  canShowExcludedItems,
  focused,
  isBuildRoot,
  isKliveProject,
  isRoot,
  isSelected,
  node,
  onActivate,
  onContextMenu,
  onDoubleClick,
  onExcludedItemsClick,
  onSelect,
  tabIndex
}: ExplorerProjectItemProps) {
  return (
    <div
      className={classnames(styles.item, {
        [styles.selected]: isSelected,
        [styles.focused]: focused
      })}
      tabIndex={tabIndex}
      onContextMenu={(e) => onContextMenu(e, node)}
      onMouseDown={(e) => {
        if (e.button === 0) {
          onSelect();
        }
      }}
      onClick={onActivate}
      onDoubleClick={onDoubleClick}
    >
      <div className={styles.indent} style={{ width: (node.level + 1) * 16 }}></div>
      {node.data.isFolder && (
        <Icon
          iconName={node.isExpanded ? "chevron-down" : "chevron-right"}
          width={16}
          height={16}
          fill={isSelected ? "--color-chevron-selected" : "--color-chevron"}
        />
      )}
      {!node.data.isFolder && (
        <Icon
          iconName={node.data.icon ?? "file-code"}
          fill={node.data.iconFill ?? "--fill-explorer-icon"}
          width={16}
          height={16}
        />
      )}
      {isRoot && isKliveProject && (
        <Icon iconName="home" fill="--console-ansi-bright-magenta" width={16} height={16} />
      )}
      <LabelSeparator width={8} />
      <span className={styles.name}>{node.data.name}</span>
      <div className={styles.indent} style={{ width: 8 }}></div>
      <SpaceFiller />
      {isRoot && isKliveProject && canShowExcludedItems && (
        <div
          className={styles.iconRight}
          onClick={(e) => {
            e.stopPropagation();
            onExcludedItemsClick();
          }}
        >
          <Icon xclass={styles.actionButton} iconName="exclude" width={16} height={16} />
        </div>
      )}
      {!node.data.isFolder && isBuildRoot && (
        <div className={styles.iconRight}>
          <Icon iconName="combine" fill="--console-ansi-bright-green" width={16} height={16} />
        </div>
      )}
    </div>
  );
}
