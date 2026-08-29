import { PROJECT_FILE } from "@common/structs/project-const";
import { ITreeNode } from "@abstractions/ITreeNode";
import { ProjectNode } from "@abstractions/ProjectNode";

export type ExplorerSelectionDirection = -1 | 1;

type ExplorerKeyboardCommandArgs = {
  focusedIndex: number;
  key: string;
  visibleNodes: ITreeNode<ProjectNode>[];
  onDelete: (node: ITreeNode<ProjectNode>) => void;
  onFocusChange: (index: number) => void;
  onLeafActivate?: (node: ITreeNode<ProjectNode>) => void;
  onRememberExpandedItems: () => void;
  onSelectionChange: (index: number) => void;
  onTreeChanged: () => void;
};

export function handleExplorerKeyboardCommand({
  focusedIndex,
  key,
  visibleNodes,
  onDelete,
  onFocusChange,
  onLeafActivate,
  onRememberExpandedItems,
  onSelectionChange,
  onTreeChanged
}: ExplorerKeyboardCommandArgs): boolean {
  if (!visibleNodes?.length) return false;

  if (key === "ArrowDown" || key === "ArrowUp") {
    const direction = key === "ArrowDown" ? 1 : -1;
    const nextFocused = getNextExplorerSelection(focusedIndex, visibleNodes.length, direction);
    onFocusChange(nextFocused);
    return true;
  }

  const focusedNode = visibleNodes[focusedIndex];

  // Space toggles branches without selecting them; leaves become selected and activated.
  if (key === " ") {
    if (toggleExplorerFolderNode(focusedNode)) {
      onTreeChanged();
      onRememberExpandedItems();
    } else if (focusedNode) {
      onSelectionChange(focusedIndex);
      onLeafActivate?.(focusedNode);
    }
    return true;
  }

  if (key === "Delete") {
    if (canDeleteExplorerNode(focusedNode)) {
      onDelete(focusedNode);
    }
    return true;
  }

  return false;
}

export function getNextExplorerSelection(
  selected: number,
  nodeCount: number,
  direction: ExplorerSelectionDirection
): number {
  if (nodeCount <= 0) return -1;
  if (selected < 0) return direction > 0 ? 0 : nodeCount - 1;
  return Math.min(Math.max(selected + direction, 0), nodeCount - 1);
}

export function toggleExplorerFolderNode(
  node?: ITreeNode<ProjectNode> | null
): boolean {
  if (!node?.data.isFolder) return false;
  node.isExpanded = !node.isExpanded;
  return true;
}

export function canDeleteExplorerNode(node?: ITreeNode<ProjectNode> | null): boolean {
  if (!node || !node.parentNode) return false;
  return !isProjectFileNode(node);
}

function isProjectFileNode(node: ITreeNode<ProjectNode>): boolean {
  return !node.data.isFolder && node.data.name === PROJECT_FILE && node.level === 1;
}
