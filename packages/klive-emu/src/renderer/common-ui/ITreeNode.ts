import { ILiteEvent } from "@core/LiteEvent";

/**
 * This interface represents a node in a hierarchical tree.
 * @param TNode the item that represents information about the node.
 */
export interface ITreeNode<TNode> {
  /**
   * Tree node data
   */
  nodeData: TNode;

  /**
   * The parent of this node
   */
  readonly parentNode: ITreeNode<TNode> | undefined;

  /**
   * This event is raised when this node's parent has been changed. The event argument
   * is the new parent of the node.
   */
  readonly parentNodeChanged: ILiteEvent<ITreeNode<TNode> | undefined>;

  /**
   * The parent tree of this node
   */
  readonly parentTree: ITreeView<TNode> | undefined;

  /**
   * This event is raised when this node's parent tree has been changed. The
   * event argument is the new tree of this node.
   */
  readonly parentTreeChanged: ILiteEvent<ITreeView<TNode> | undefined>;

  /**
   * Gets the number of child nodes nested into this tree node.
   */
  readonly childCount: number;

  /**
   * Gets the set of child nodes. The retrieved value is a clone of the
   * child node's list. Updating that list does not change the original
   * list of child nodes.
   */
  getChildren(): Array<ITreeNode<TNode>>;

  /**
   * Gets the child with the specified index.
   * @param index Child index
   */
  getChild(index: number): ITreeNode<TNode>;

  /**
   * Calculates the `viewItemCount` property value
   */
  calculateViewItemCount(): void;

  /**
   * Appends a new child to this child node. Takes care of
   * avoiding circular references.
   * @param child The child to append to this child node.
   * @returns The number of child nodes after the operation.
   */
  appendChild(child: ITreeNode<TNode>): number;

  /**
   * Inserts a child into this child node at the specified position.
   * Takes care of avoiding circular references.
   * @param index Insertion index.
   * @param child The child to insert into this child node.
   * @returns The number of child nodes after the operation.
   */
  insertChildAt(index: number, child: ITreeNode<TNode>): number;

  /**
   * Takes over the specified children
   * @param children Children to take over
   */
  takeOverChildren(children: Array<ITreeNode<TNode>>): void;

  /**
   * This event is raised when a new child has been added to this node. The
   * event argument is a tuple of two values. The first is the new node, the
   * second is its index in the child list.
   */
  readonly childAdded: ILiteEvent<[ITreeNode<TNode>, number]>;

  /**
   * Removes the specified child from this node.
   * @param child The child to append to remove.
   * @returns The removed child node, if found; otherwise, undefined.
   */
  removeChild(child: ITreeNode<TNode>): ITreeNode<TNode> | undefined;

  /**
   * Removes the child at the specified index from this node.
   * @param index Insertion index.
   * @returns The remove child node
   */
  removeChildAt(index: number): ITreeNode<TNode>;

  /**
   * This event is raised when a child has been removed from this node. The
   * event argument is the removed child.
   */
  readonly childRemoved: ILiteEvent<ITreeNode<TNode>>;

  /**
   * Tests is the specified node is in the tree starting with this node.
   * This tree node is included in the test.
   * @param node Child to test
   * @returns True, if the node is in the tree; otherwise, false.
   */
  isInTree(node: ITreeNode<TNode>): boolean;

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
   * Traverses from the first parent to the root element and executes
   * the specified action on each node.
   * @param action Action to execute.
   * @param includeThis Should include this node in traversal?
   */
  forEachParent(
    action: (item: ITreeNode<TNode>) => void,
    includeThis?: boolean
  ): void;

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
   * Sets a new root node for the tree
   * @param node New root node of the tree
   */
  setRootNode(node: ITreeNode<TNode>): void;

  /**
   * Gets the tree node at the specified index using depth-first-search (DFS) traversal.
   * Hidden and collapsed nodes are skipped. The root node's index is 0.
   * @param index Index of node to get.
   * @returns The node at the specified index, if exists; otherwise, `undefined`.
   */
  getViewNodeByIndex(index: number): ITreeNode<TNode> | undefined;

  /**
   * Gets the set of view nodes between the start and end index.
   * @param start Start index (inclusive)
   * @param end End Index (inclusive)
   * @returns The list of view nodes in the specified range, may be an empty list.
   */
  getViewNodeRange(start: number, end: number): Array<ITreeNode<TNode>>;
}
