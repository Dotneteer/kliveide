import type { ILiteEvent } from "./ILiteEvent";

/**
 * This interface represents a node in a hierarchical tree.
 * @param TNode the item that represents information about the node.
 */
export interface ITreeNode<TNode> {
  /**
   * Tree node data
   */
  data: TNode;

  /**
   * This event is raised when this node has been changed. The event argument
   * is the new parent of the node.
   */
  readonly nodeChanged: ILiteEvent<void>;

  /**
   * This event is raised when a child of this node has been changed. The event argument
   * is the new parent of the node.
   */
  readonly childChanged: ILiteEvent<ITreeNode<TNode>>;

  /**
   * The parent of this node
   */
  readonly parentNode: ITreeNode<TNode> | undefined;

  /**
   * Gets the number of child nodes nested into this tree node.
   */
  readonly childCount: number;

  /**
   * Gets the set of child nodes. The retrieved value is a clone of the
   * child node's list. Updating that list does not change the original
   * list of child nodes.
   */
  get children(): Array<ITreeNode<TNode>>;

  /**
   * Appends a new child to this child node. Takes care of
   * avoiding circular references.
   * @param child The child to append to this child node.
   * @returns The number of child nodes after the operation.
   */
  appendChild(child: ITreeNode<TNode>): number;

  /**
   * Sorts the children of this node
   * @param sortFn Compare function to sort children
   */
  sortChildren(sortFn?: (item1: ITreeNode<TNode>, item2: ITreeNode<TNode>) => number): void;

  /**
   * Appends a new child to this child node. and then sorts children
   * @param child The child to append to this child node.
   * @param sortFn Compare function to sort children
   */
  insertAndSort(
    child: ITreeNode<TNode>,
    sortFn?: (item1: ITreeNode<TNode>, item2: ITreeNode<TNode>) => number
  ): void;

  /**
   * Inserts a child into this child node at the specified position.
   * Takes care of avoiding circular references.
   * @param index Insertion index.
   * @param child The child to insert into this child node.
   * @returns The number of child nodes after the operation.
   */
  insertChildAt(index: number, child: ITreeNode<TNode>): number;

  /**
   * Removes the specified child from this node.
   * @param child The child to append to remove.
   * @returns The removed child node, if found; otherwise, undefined.
   */
  removeChild(child: ITreeNode<TNode>): ITreeNode<TNode> | undefined;

  /**
   * Indicates that this tree node is expanded in its view
   */
  isExpanded: boolean;

  /**
   * Indicates if this node is hidden in its view
   */
  isHidden: boolean;

  /**
   * The depth level of the tree including hidden nodes
   */
  readonly level: number;

  /**
   * The depth of the tree node. If the node has no children, its depth
   * is 0, otherwise it is 1 plus the maximum depth of its children.
   */
  readonly depth: number;

  /**
   * The number of visible items.
   * @returns The number of items that would be shown in the
   * tree view for this node, including this item in its current
   * state, and its child nodes.
   */
  readonly viewItemCount: number;

  /**
   * Gets the next tree node at using depth-first-search (DFS) traversal.
   * Hidden and collapsed nodes are skipped.
   * @returns The next node, if exists; otherwise, `undefined`.
   */
  getNextViewNode(): ITreeNode<TNode> | undefined;

  /**
   * Expands this node and all children recursively
   */
  expandAll(): void;

  /**
   * Collapses this node and all children recursively
   */
  collapseAll(): void;

  /**
   * Traverses from the first parent to the root element and executes
   * the specified action on each node.
   * @param action Action to execute.
   * @param includeThis Should include this node in traversal?
   */
  forEachParent(action: (item: ITreeNode<TNode>) => void, includeThis?: boolean): void;

  /**
   * Traverses all child nodes in depth-first-search manner and executes
   * the specified action on each node.
   * @param action Action to execute.
   */
  forEachDescendant(action: (item: ITreeNode<TNode>) => void): void;
}

/**
 * This interface represents a hierarchical tree view.
 * @param TNode The node type of the tree view
 */
export interface ITreeView<TNode> {
  /**
   * Gets the root node of the tree
   */
  readonly rootNode: ITreeNode<TNode>;

  /**
   * The depth of the tree. If the root node has no children, its depth
   * is 0, otherwise it is 1 plus the maximum depth of its children.
   */
  readonly depth: number;

  /**
   * Indicates if the tree should display the root node, or only its children
   */
  readonly displayRootNode: boolean;

  /**
   * Gets the tree node at the specified index using depth-first-search (DFS) traversal.
   * Hidden and collapsed nodes are skipped. The root node's index is 0.
   * @param index Index of node to get.
   * @returns The node at the specified index, if exists; otherwise, `undefined`.
   */
  getViewNodeByIndex(index: number): ITreeNode<TNode> | undefined;

  /**
   * Builds the indexed list of visible nodes to display
   */
  buildIndex(): void;

  /**
   * Finds the index of the specified node
   * @param node Node to find
   * @returns Index, if node found; otherwise, -1
   */
  findIndex(node: ITreeNode<TNode>): number;

  /**
   * Gets the array of currently visible tree nodes
   */
  getVisibleNodes(): ITreeNode<TNode>[];
}
