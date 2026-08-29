import classnames from "classnames";
import type { FocusEvent, MouseEvent } from "react";
import { ITreeNode } from "@abstractions/ITreeNode";
import { ProjectNode } from "@abstractions/ProjectNode";
import { Icon } from "@controls/Icon";
import { SpaceFiller } from "@controls/SpaceFiller";
import { LabelSeparator } from "@renderer/controls/layout/LabelSeparator";
import styles from "./ExplorerPanel.module.scss";

type ExplorerProjectItemProps = {
  canShowExcludedItems: boolean;
  focused: boolean;
  itemRef?: (element: HTMLDivElement | null) => void;
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
  onFocus: (event: FocusEvent<HTMLDivElement>) => void;
  onSelect: () => void;
};

export function ExplorerProjectItem({
  canShowExcludedItems,
  focused,
  itemRef,
  isBuildRoot,
  isKliveProject,
  isRoot,
  isSelected,
  node,
  onActivate,
  onContextMenu,
  onDoubleClick,
  onExcludedItemsClick,
  onFocus,
  onSelect,
  tabIndex
}: ExplorerProjectItemProps) {
  const showHomeIcon = isRoot && isKliveProject;

  return (
    <div
      ref={itemRef}
      className={classnames(styles.item, {
        [styles.selected]: isSelected,
        [styles.focused]: focused
      })}
      tabIndex={tabIndex}
      onContextMenu={(e) => onContextMenu(e, node)}
      onFocus={onFocus}
      onMouseDown={(e) => {
        if (e.button === 0) {
          onSelect();
        }
      }}
      onClick={onActivate}
      onDoubleClick={onDoubleClick}
    >
      <div className={styles.indent} style={{ width: (node.level + 1) * 16 }}></div>
      {showHomeIcon ? (
        <HomeNodeIcon isExpanded={node.isExpanded} isSelected={isSelected} />
      ) : node.data.isFolder ? (
        <FolderNodeIcon isExpanded={node.isExpanded} isSelected={isSelected} />
      ) : (
        <FileNodeIcon iconName={node.data.icon} iconFill={node.data.iconFill} />
      )}
      <LabelSeparator width={0} />
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

type ExpandableNodeIconProps = {
  isExpanded: boolean;
  isSelected: boolean;
};

// Home nodes represent the Klive project root and keep only the expand affordance plus Home glyph.
function HomeNodeIcon({ isExpanded, isSelected }: ExpandableNodeIconProps) {
  return (
    <span className={styles.nodeIconGroup}>
      <ExpandIcon isExpanded={isExpanded} isSelected={isSelected} />
      <Icon iconName="home" fill="--console-ansi-bright-magenta" width={16} height={16} />
    </span>
  );
}

// Folder nodes show both expansion state and folder state as one aligned icon group.
function FolderNodeIcon({ isExpanded, isSelected }: ExpandableNodeIconProps) {
  return (
    <span className={styles.nodeIconGroup}>
      <ExpandIcon isExpanded={isExpanded} isSelected={isSelected} />
      <Icon
        iconName={isExpanded ? "folder-opened" : "folder"}
        fill="--fill-explorer-icon"
        width={16}
        height={16}
      />
    </span>
  );
}

type FileNodeIconProps = {
  iconFill?: string;
  iconName?: string;
};

// File nodes reserve the expand icon column so children align under their parent folder glyphs.
function FileNodeIcon({ iconFill, iconName }: FileNodeIconProps) {
  return (
    <span className={styles.nodeIconGroup}>
      <span className={styles.nodeIconPlaceholder} aria-hidden="true" />
      <Icon
        iconName={iconName ?? "file-code"}
        fill={iconFill ?? "--fill-explorer-icon"}
        width={16}
        height={16}
      />
    </span>
  );
}

function ExpandIcon({ isExpanded, isSelected }: ExpandableNodeIconProps) {
  return (
    <Icon
      iconName={isExpanded ? "chevron-down" : "chevron-right"}
      width={16}
      height={16}
      fill={isSelected ? "--color-chevron-selected" : "--color-chevron"}
    />
  );
}
