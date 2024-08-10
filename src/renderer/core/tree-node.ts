import type { ILiteEvent } from "@abstractions/ILiteEvent";
import type { ITreeNode, ITreeView } from "@abstractions/ITreeNode";

import { LiteEvent } from "@emu/utils/lite-event";

/**
 * This class implements a tree node.
 * @param TNode The type of tree nodes
 */
export class TreeNode<TNode> implements ITreeNode<TNode> {
  private _parentNode: ITreeNode<TNode> | undefined;
  private _nodeChanged = new LiteEvent<void>();
  private _childChanged = new LiteEvent<ITreeNode<TNode>>();
  private _children: Array<ITreeNode<TNode>> = [];
  private _level = 0;
  private _depth = 0;
  private _isExpanded = true;
  private _isHidden = false;
  private _viewItemCount = 0;

  /**
   * Instantiated a new node with the specified data.
   * @param data
   */
  constructor (data: TNode) {
    this.data = data;
    this._viewItemCount = 1;
  }

  /**
   * Tree node data
   */
  data: TNode;

  /**
   * This event is raised when this node has been changed. The event argument
   * is the new parent of the node.
   */
  get nodeChanged (): ILiteEvent<void> {
    return this._nodeChanged;
  }

  /**
   * This event is raised when a child of this node has been changed. The event argument
   * is the new parent of the node.
   */
  get childChanged (): ILiteEvent<ITreeNode<TNode>> {
    return this._childChanged;
  }

  /**
   * Retrieves the string representation of the node's data.
   */
  toString (): string {
    const name = this.data && this.data.toString ? this.data.toString() : "";
    return name;
  }

  /**
   * The parent of this node
   */
  get parentNode (): ITreeNode<TNode> | undefined {
    return this._parentNode;
  }
  set parentNode (value: ITreeNode<TNode> | undefined) {
    if (this._parentNode !== value) {
      this._parentNode = value;
      this._raiseNodeChanged();
    }
  }

  /**
   * Gets the number of child nodes nested into this tree node.
   */
  get childCount (): number {
    return this._children.length;
  }

  /**
   * Gets the set of child nodes. The retrieved value is a clone of the
   * child node's list. Updating that list does not change the original
   * list of child nodes.
   */
  get children (): Array<ITreeNode<TNode>> {
    return this._children.slice(0);
  }

  /**
   * Gets the child with the specified index.
   * @param index Child index
   */
  getChild (index: number): ITreeNode<TNode> {
    if (index < 0 || index >= this._children.length) {
      throw new Error(
        `Children index ${index} is out of range 0..${
          this._children.length - 1
        }`
      );
    }
    return this._children[index];
  }

  /**
   * Appends a new child to this child node. Takes care of
   * avoiding circular references.
   * @param child The child to append to this child node.
   * @returns The number of child nodes after the operation.
   */
  appendChild (child: ITreeNode<TNode>): number {
    return this._insertChild(this._children.length, child);
  }

  /**
   * Sorts the children of this node
   * @param sortFn Compare function to sort children
   */
  sortChildren (
    sortFn?: (item1: ITreeNode<TNode>, item2: ITreeNode<TNode>) => number
  ): void {
    if (sortFn) {
      this._children = this._children.sort(sortFn);
    }
  }

  /**
   * Appends a new child to this child node. and then sorts children
   * @param child The child to append to this child node.
   * @param sortFn Compare function to sort children
   */
  insertAndSort (
    child: ITreeNode<TNode>,
    sortFn?: (item1: ITreeNode<TNode>, item2: ITreeNode<TNode>) => number
  ): void {
    this.appendChild(child);
    this.sortChildren(sortFn);
  }

  /**
   * Inserts a child into this child node at the specified position.
   * Takes care of avoiding circular references.
   * @param index Insertion index.
   * @param child The child to insert into this child node.
   * @returns The number of child nodes after the operation.
   */
  insertChildAt (index: number, child: ITreeNode<TNode>): number {
    return this._insertChild(index, child);
  }

  /**
   * Removes the specified child from this node.
   * @param child The child to append to remove.
   * @returns The removed child node, if found; otherwise, undefined.
   */
  removeChild (child: ITreeNode<TNode>): ITreeNode<TNode> | undefined {
    const index = this._children.indexOf(child);
    if (index < 0) {
      return undefined;
    }
    return this._removeChild(index);
  }

  /**
   * Indicates that this tree node is expanded in its view
   */
  get isExpanded (): boolean {
    return this._isExpanded;
  }
  set isExpanded (value: boolean) {
    if (value !== this._isExpanded) {
      this._isExpanded = value;
      this.calculateViewItemCount();
      this._raiseNodeChanged();
    }
  }

  /**
   * Indicates if this node is hidden in its view
   */
  get isHidden (): boolean {
    return this._isHidden;
  }
  set isHidden (value: boolean) {
    if (value !== this._isHidden) {
      this._isHidden = value;
      this.calculateViewItemCount();
      this._raiseNodeChanged();
    }
  }

  /**
   * The depth level of the tree including hidden nodes
   */
  get level (): number {
    return this._level;
  }

  /**
   * The depth of the tree node. If the node has no children, its depth
   * is 0, otherwise it is 1 plus the maximum depth of its children.
   */
  get depth (): number {
    return this._depth;
  }

  /**
   * The number of visible items.
   * @returns The number of items that would be shown in the
   * tree view for this node, including this item in its current
   * state, and its child nodes.
   */
  get viewItemCount (): number {
    return this._viewItemCount;
  }

  /**
   * Gets the next tree node at using depth-first-search (DFS) traversal.
   * Hidden and collapsed nodes are skipped.
   * @returns The next node, if exists; otherwise, `undefined`.
   */
  getNextViewNode (): ITreeNode<TNode> | undefined {
    // --- Try to retrieve the first visible child
    if (this.isExpanded && !this.isHidden) {
      const child = this._getFirstVisibleChild();
      if (child) {
        return child;
      }
    }

    // --- No visible child, let's check the parent hierarchy up to the root
    let childNode: ITreeNode<TNode> = this;
    let parentNode = this.parentNode;
    while (parentNode) {
      const childIndex = parentNode.children.indexOf(childNode);
      // --- Check just for the sake of safety
      if (childIndex < 0) {
        throw new Error("This node is not on it's parent child list!");
      }

      // --- Get a visible sibling
      const sibling = (parentNode as TreeNode<TNode>)._getFirstVisibleChild(
        childIndex + 1
      );
      if (sibling) {
        return sibling;
      }

      // --- This level completed, step back to an upper level
      childNode = parentNode;
      parentNode = childNode.parentNode;
    }

    // --- We traversed the entire chain with no next node
    return undefined;
  }

  /**
   * Traverses from the first parent to the root element and executes
   * the specified action on each node.
   * @param action Action to execute.
   * @param includeThis Should include this node in traversal?
   */
  forEachParent (
    action: (item: ITreeNode<TNode>) => void,
    includeThis: boolean = false
  ): void {
    let currentNode: ITreeNode<TNode> = includeThis ? this : this._parentNode;
    while (currentNode) {
      action(currentNode);
      currentNode = currentNode.parentNode;
    }
  }

  /**
   * Traverses all child nodes and then their child nodes recursively. Executes
   * the specified action on each node.
   * @param action Action to execute.
   */
  forEachDescendant (action: (item: ITreeNode<TNode>) => void): void {
    for (const child of this._children) {
      action(child);
      child.forEachDescendant(action);
    }
  }

  /**
   * Expands this node and all children recursively
   */
  expandAll (): void {
    this._isExpanded = true;
    this._children.forEach(c => c.expandAll());
  }

  /**
   * Collapses this node and all children recursively
   */
  collapseAll (): void {
    this._isExpanded = false;
    this._children.forEach(c => c.collapseAll());
  }

  // ========================================================================
  // Helpers

  private _raiseNodeChanged (): void {
    this._nodeChanged.fire();
  }

  /**
   * Inserts a child node to the children list into the specified position.
   * @param index Index to insert the child
   * @param child Child to insert
   * @returns The number of child nodes after this operation.
   */
  private _insertChild (index: number, child: ITreeNode<TNode>): number {
    // TODO: Check for circular reference
    if (index < 0 || index > this._children.length) {
      throw new Error(
        `Children index ${index} is out of range 0..${this._children.length}`
      );
    }

    // --- Insert the child
    this._children.splice(index, 0, child);

    // --- Attach parents
    (child as TreeNode<TNode>).parentNode = this;

    // --- Recalculate level and depth
    (child as TreeNode<TNode>)._level = this._level + 1;
    child.forEachDescendant(c => {
      (c as TreeNode<TNode>)._level = c.parentNode.level + 1;
    });
    this._depth = this._calcDepth();
    child.forEachParent(p => {
      (p as TreeNode<TNode>)._depth = (p as TreeNode<TNode>)._calcDepth();
    });

    // --- The view item count may have changed
    this.calculateViewItemCount();

    // --- Done
    this._raiseNodeChanged();
    return this._children.length;
  }

  /**
   * Removes the specified child from this node.
   * @param index Index of child to remove.
   * @returns The removed child node.
   */
  private _removeChild (index: number): ITreeNode<TNode> {
    if (index < 0 || index >= this._children.length) {
      throw new Error(
        `Children index ${index} is out of range 0..${
          this._children.length - 1
        }`
      );
    }

    // --- Remove the child
    const child = this._children.splice(index, 1)[0];

    // --- Detach parents
    (child as TreeNode<TNode>).parentNode = undefined;

    // --- Recalculate level and depth
    (child as TreeNode<TNode>)._level = 0;
    child.forEachDescendant(c => {
      (c as TreeNode<TNode>)._level = c.parentNode.level + 1;
    });
    this._depth = this._calcDepth();
    child.forEachParent(p => {
      (p as TreeNode<TNode>)._depth = (p as TreeNode<TNode>)._calcDepth();
    });

    // --- The view item count may have changed
    this.calculateViewItemCount();

    // --- Done
    this._raiseNodeChanged();
    return child;
  }

  /**
   * Gets the first visible child of this node
   * @param index Start index to use
   */
  private _getFirstVisibleChild (
    index: number = 0
  ): ITreeNode<TNode> | undefined {
    while (index < this.childCount) {
      const child = this.getChild(index);
      if (!child.isHidden) {
        return child;
      }
      index++;
    }
    return undefined;
  }

  /**
   * Calculates the `viewItemCount` property value
   */
  calculateViewItemCount (): void {
    const oldViewItemCount = this._viewItemCount;

    // --- Hidden items
    if (this._isHidden) {
      this._viewItemCount = 0;
    } else {
      // --- Visible items
      this._viewItemCount = 1;

      // --- Expanded visible items
      if (this._isExpanded) {
        for (const child of this._children) {
          this._viewItemCount += (child as TreeNode<TNode>)._viewItemCount;
        }
      }
    }

    // --- Now, do this for the entire parent chain
    if (oldViewItemCount !== this._viewItemCount) {
      this.forEachParent(parent =>
        (parent as TreeNode<TNode>).calculateViewItemCount()
      );
    }
  }

  /**
   * Calculates the depth of this node
   */
  private _calcDepth (): number {
    if (this._children.length === 0) {
      return 0;
    }
    let maxDepth = 0;
    for (const child of this._children) {
      const childDepth = child.depth;
      if (childDepth > maxDepth) {
        maxDepth = childDepth;
      }
    }
    return maxDepth + 1;
  }
}

/**
 * This class implements a hierarchical tree.
 * @param TNode Node data type
 */
export class TreeView<TNode> implements ITreeView<TNode> {
  private _rootNode: ITreeNode<TNode> | undefined;
  private _visibleNodes: ITreeNode<TNode>[];

  // ========================================================================
  // Lifecycle methods

  /**
   * Instantiates the tree view with the specified root node.
   * @param root Root node to assign to the tree
   */
  constructor (root?: ITreeNode<TNode>, public readonly displayRootNode = true) {
    this._rootNode = root;
    this.buildIndex();
  }

  // ========================================================================
  // Public properties and operations

  /**
   * Gets the root node of the tree
   */
  get rootNode (): ITreeNode<TNode> {
    return this._rootNode;
  }

  /**
   * The depth of the tree. If the root node has no children, its depth
   * is 0, otherwise it is 1 plus the maximum depth of its children.
   */
  get depth (): number {
    this._checkRootNodeAssigned();
    return this._rootNode.depth;
  }

  /**
   * Gets the tree node at the specified index using depth-first-search (DFS) traversal.
   * Hidden and collapsed nodes are skipped. The root node's index is 0.
   * @param index Index of node to get.
   * @returns The node at the specified index, if exists; otherwise, `undefined`.
   */
  getViewNodeByIndex (index: number): ITreeNode<TNode> | undefined {
    this._checkRootNodeAssigned();
    return this._visibleNodes[index];
  }

  /**
   * Builds the indexed list of visible nodes to display
   */
  buildIndex (): void {
    this._checkRootNodeAssigned();

    // --- Store the node indexes here
    const indexes: ITreeNode<TNode>[] = [];
    if (this._rootNode) {
      visitNode(this._rootNode);
    }

    this._visibleNodes = indexes;

    function visitNode (node: ITreeNode<TNode>): void {
      if (node.isHidden) return;
      indexes.push(node);

      if (!node.isExpanded) return;
      node.children.forEach(child => visitNode(child));
    }
  }

  /**
   * Finds the index of the specified node
   * @param node Node to find
   * @returns Index, if node found; otherwise, -1
   */
  findIndex (node: ITreeNode<TNode>): number {
    return this._visibleNodes.indexOf(node);
  }

  /**
   * Gets the array of currently visible tree nodes
   */
  getVisibleNodes (): ITreeNode<TNode>[] {
    return this._visibleNodes.slice(0);
  }

  // ========================================================================
  // Helpers

  /**
   * Throws an execption if the root node has not been assinged to this tree view.
   */
  private _checkRootNodeAssigned (): void {
    if (!this._rootNode) {
      throw new Error("Root node of this tree has not been set yet.");
    }
  }
}
