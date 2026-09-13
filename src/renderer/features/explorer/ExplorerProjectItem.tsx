import classnames from "classnames";
import type { FocusEvent, MouseEvent, ReactNode } from "react";
import { ITreeNode } from "@abstractions/ITreeNode";
import { ProjectNode } from "@abstractions/ProjectNode";
import { Icon } from "@controls/Icon";
import { SpaceFiller } from "@controls/SpaceFiller";
import { LabelSeparator } from "@renderer/controls/layout/LabelSeparator";
import styles from "./ExplorerPanel.module.scss";

/**
 * The row's three size tiers.
 *
 * One size for everything on a row was the previous rule, and it inverted the hierarchy: at
 * `EXPLORER_ICON_SIZE = 20` against a 10.8px label, the chevron — pure chrome, carrying one bit of
 * information — was drawn twice the size of the filename the row exists to show. The tiers below
 * say what each mark is worth instead:
 *
 * - `NODE_TWISTY_SIZE` — chrome. The expand chevron, and the column files reserve in its place.
 * - `NODE_GLYPH_SIZE` — content. The home/folder/file glyph and the trailing badges, which name
 *   what the row *is*. Still the largest mark on the row, just no longer by a factor of two.
 * - the label itself, at `1em` of the panel font size (see `.explorerPanel` in the stylesheet).
 *
 * These no longer match `TAB_ICON_SIZE` in DocumentTab.tsx, and that is deliberate: a tab is a
 * standalone target sized against the tab strip, a tree row is one of forty stacked items sized
 * against its own label. `.item` in ExplorerPanel.module.scss is sized to fit `NODE_GLYPH_SIZE`;
 * if you change one, check the other.
 */
const NODE_GLYPH_SIZE = 16;
const NODE_TWISTY_SIZE = 14;

/**
 * Horizontal step per tree level.
 *
 * Also the spacing between indent guides, since a guide marks an ancestor's twisty column — see
 * `renderIndentGuides` below, which is the only place the two are related by arithmetic.
 */
const NODE_INDENT = 14;

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
  const isFolder = node.data.isFolder;
  // --- Collapsed only: see `.childCount` in the stylesheet for why an expanded folder shows none.
  const childCount = isFolder && !node.isExpanded ? node.children?.length ?? 0 : 0;

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
      {renderIndentGuides(node.level)}
      <div className={styles.indent} style={{ width: (node.level + 1) * NODE_INDENT }}></div>
      {showHomeIcon ? (
        <HomeNodeIcon isExpanded={node.isExpanded} isSelected={isSelected} />
      ) : isFolder ? (
        <FolderNodeIcon isExpanded={node.isExpanded} isSelected={isSelected} />
      ) : (
        <FileNodeIcon iconName={node.data.icon} iconFill={node.data.iconFill} />
      )}
      <LabelSeparator width={7} />
      <span className={classnames(styles.name, { [styles.folderName]: isFolder })}>
        {isFolder ? node.data.name : <FileName name={node.data.name} />}
      </span>
      <div className={styles.indent} style={{ width: 8 }}></div>
      <SpaceFiller />
      {childCount > 0 && <span className={styles.childCount}>{childCount}</span>}
      {isRoot && isKliveProject && canShowExcludedItems && (
        <div
          className={styles.iconRight}
          onClick={(e) => {
            e.stopPropagation();
            onExcludedItemsClick();
          }}
        >
          <Icon
            xclass={styles.actionButton}
            iconName="exclude"
            width={NODE_GLYPH_SIZE}
            height={NODE_GLYPH_SIZE}
          />
        </div>
      )}
      {!isFolder && isBuildRoot && (
        <div className={styles.iconRight}>
          <Icon
            iconName="combine"
            fill="--console-ansi-bright-green"
            width={NODE_GLYPH_SIZE}
            height={NODE_GLYPH_SIZE}
          />
        </div>
      )}
    </div>
  );
}

/**
 * One 1px rule per ancestor level, each on the centre line of that ancestor's twisty.
 *
 * A row at level L has its own twisty at `(L + 1) * NODE_INDENT`, so the ancestor at level `l` has
 * its centre at `(l + 1) * NODE_INDENT + NODE_TWISTY_SIZE / 2` — which is where the guide standing
 * in for it goes. A row draws guides for its ancestors only (`l < level`), never for itself, so
 * each guide column ends with the subtree it belongs to instead of running the height of the panel.
 *
 * The root row (level 0) draws none.
 */
function renderIndentGuides(level: number): ReactNode {
  if (level <= 0) return null;
  const guides: ReactNode[] = [];
  for (let l = 0; l < level; l++) {
    const left = (l + 1) * NODE_INDENT + Math.round(NODE_TWISTY_SIZE / 2);
    guides.push(<span key={l} className={styles.guide} style={{ left }} aria-hidden="true" />);
  }
  return guides;
}

/**
 * A filename with its extension dimmed away from its stem.
 *
 * The stem is what tells two files apart; the extension usually repeats what the coloured glyph
 * beside it already said. Split at the *first* dot, not the last, so `main.kz80.asm` reads as
 * `main` + `.kz80.asm` rather than `main.kz80` + `.asm` — the whole compound suffix is the type.
 * A leading dot (`.gitignore`) is not an extension, so those stay whole.
 */
function FileName({ name }: { name: string }) {
  const dot = name.indexOf(".");
  if (dot <= 0) return <>{name}</>;
  return (
    <>
      {name.substring(0, dot)}
      <span className={styles.extension}>{name.substring(dot)}</span>
    </>
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
      <Icon
        iconName="home"
        fill="--console-ansi-bright-magenta"
        width={NODE_GLYPH_SIZE}
        height={NODE_GLYPH_SIZE}
      />
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
        width={NODE_GLYPH_SIZE}
        height={NODE_GLYPH_SIZE}
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
      <span
        className={styles.nodeIconPlaceholder}
        style={{ width: NODE_TWISTY_SIZE, height: NODE_TWISTY_SIZE }}
        aria-hidden="true"
      />
      <Icon
        iconName={iconName ?? "file-code"}
        fill={iconFill ?? "--fill-explorer-icon"}
        width={NODE_GLYPH_SIZE}
        height={NODE_GLYPH_SIZE}
      />
    </span>
  );
}

function ExpandIcon({ isExpanded, isSelected }: ExpandableNodeIconProps) {
  return (
    <Icon
      iconName={isExpanded ? "chevron-down" : "chevron-right"}
      width={NODE_TWISTY_SIZE}
      height={NODE_TWISTY_SIZE}
      fill={isSelected ? "--color-chevron-selected" : "--color-chevron"}
    />
  );
}
