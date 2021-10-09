import { ITreeNode, ITreeView } from "./ITreeNode";
import { ILiteEvent, LiteEvent } from "@core/LiteEvent";

/**
 * This class implements a tree node.
 * @param TNode The type of tree nodes
 */
export class TreeNode<TNode> implements ITreeNode<TNode> {
  private _parentNode: ITreeNode<TNode> | undefined;
  private _parentTree: ITreeView<TNode> | undefined;
  private _children: Array<ITreeNode<TNode>> = [];
  private _level = 0;
  private _depth = 0;
  private _isExpanded = true;
  private _isHidden = false;
  private _viewItemCount = 0;
  private _parentNodeChanged = new LiteEvent<ITreeNode<TNode> | undefined>();
  private _parentTreeChanged = new LiteEvent<ITreeView<TNode> | undefined>();
  private _childAdded = new LiteEvent<[ITreeNode<TNode>, number]>();
  private _childRemoved = new LiteEvent<ITreeNode<TNode>>();

  /**
   * Instantiated a new node with the specified data.
   * @param nodeData
   */
  constructor(nodeData: TNode) {
    this.nodeData = nodeData;
    this._viewItemCount = 1;
  }

  /**
   * Tree node data
   */
  nodeData: TNode;

  /**
   * Retrieves the string representation of the node's data.
   */
  toString(): string {
    const name =
      this.nodeData && this.nodeData.toString ? this.nodeData.toString() : "";
    return name;
  }

  /**
   * The parent of this node
   */
  get parentNode(): ITreeNode<TNode> | undefined {
    return this._parentNode;
  }
  set parentNode(value: ITreeNode<TNode> | undefined) {
    if (this._parentNode !== value) {
      this._parentNode = value;
      this._parentNodeChanged.fire(value);
    }
  }

  /**
   * This event is raised when this node's parent has been changed. The event argument
   * is the new child.
   */
  get parentNodeChanged(): ILiteEvent<ITreeNode<TNode> | undefined> {
    return this._parentNodeChanged;
  }

  /**
   * The parent tree of this node
   */
  get parentTree(): ITreeView<TNode> | undefined {
    return this._parentTree;
  }

  /**
   * Sets the parent tree of this node.
   * @param value The new parent tree value
   */
  setParentTree(value: ITreeView<TNode> | undefined) {
    if (this._parentTree !== value) {
      this._parentTree = value;
      this.forEachDescendant(
        (child) => ((child as TreeNode<TNode>)._parentTree = value)
      );
      this._parentTreeChanged.fire(value);
    }
  }

  /**
   * This event is raised when this node's parent tree has been changed. The
   * event argument is the new tree of this node.
   */
  get parentTreeChanged(): ILiteEvent<ITreeView<TNode> | undefined> {
    return this._parentTreeChanged;
  }

  /**
   * Gets the number of child nodes nested into this tree node.
   */
  get childCount(): number {
    return this._children.length;
  }

  /**
   * Gets the set of child nodes. The retrieved value is a clone of the
   * child node's list. Updating that list does not change the original
   * list of child nodes.
   */
  getChildren(): Array<ITreeNode<TNode>> {
    return this._children.slice(0);
  }

  /**
   * Gets the child with the specified index.
   * @param index Child index
   */
  getChild(index: number): ITreeNode<TNode> {
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
  appendChild(child: ITreeNode<TNode>): number {
    return this._insertChild(this._children.length, child);
  }

  /**
   * Inserts a child into this child node at the specified position.
   * Takes care of avoiding circular references.
   * @param index Insertion index.
   * @param child The child to insert into this child node.
   * @returns The number of child nodes after the operation.
   */
  insertChildAt(index: number, child: ITreeNode<TNode>): number {
    return this._insertChild(index, child);
  }

  /**
   * Takes over the specified children
   * @param children Children to take over
   */
  takeOverChildren(children: Array<ITreeNode<TNode>>): void {
    this._children = [];
    for (const child of children) {
      // --- Insert the child
      this._children.push(child);

      // --- Attach parents
      (child as TreeNode<TNode>).parentNode = this;
      if (this.parentTree) {
        (child as TreeNode<TNode>).setParentTree(this.parentTree);
      }

      // --- Recalculate level and depth
      (child as TreeNode<TNode>)._level = this._level + 1;
      child.forEachDescendant((c) => {
        (c as TreeNode<TNode>)._level = c.parentNode.level + 1;
      });
      this._depth = this._calcDepth();
      child.forEachParent((p) => {
        (p as TreeNode<TNode>)._depth = (p as TreeNode<TNode>)._calcDepth();
      });

      // --- The view item count may have changed
      this.calculateViewItemCount();
    }
  }

  /**
   * This event is raised when a new child has been added to this node. The
   * event argument is a tuple of two values. The first is the new node, the
   * second is its index in the child list.
   */
  get childAdded(): ILiteEvent<[ITreeNode<TNode>, number]> {
    return this._childAdded;
  }

  /**
   * Removes the specified child from this node.
   * @param child The child to append to remove.
   * @returns The removed child node, if found; otherwise, undefined.
   */
  removeChild(child: ITreeNode<TNode>): ITreeNode<TNode> | undefined {
    const index = this._children.indexOf(child);
    if (index < 0) {
      return undefined;
    }
    return this._removeChild(index);
  }

  /**
   * Removes the child at the specified index from this node.
   * @param index Insertion index.
   * @returns The removed child node.
   */
  removeChildAt(index: number): ITreeNode<TNode> {
    return this._removeChild(index);
  }

  /**
   * This event is raised when a child has been removed from this node. The
   * event argument is the removed child.
   */
  get childRemoved(): ILiteEvent<ITreeNode<TNode>> {
    return this._childRemoved;
  }

  /**
   * Tests is the specified node is in the tree starting with this node.
   * This tree node is included in the test.
   * @param node Child to test
   * @returns True, if the node is in the tree; otherwise, false.
   */
  isInTree(node: ITreeNode<TNode>): boolean {
    return node === this || this._children.some((c) => c.isInTree(node));
  }

  /**
   * Indicates that this tree node is expanded in its view
   */
  get isExpanded(): boolean {
    return this._isExpanded;
  }
  set isExpanded(value: boolean) {
    if (value !== this._isExpanded) {
      this._isExpanded = value;
      this.calculateViewItemCount();
    }
  }

  /**
   * Indicates if this node is hidden in its view
   */
  get isHidden(): boolean {
    return this._isHidden;
  }
  set isHidden(value: boolean) {
    if (value !== this._isHidden) {
      this._isHidden = value;
      this.calculateViewItemCount();
    }
  }

  /**
   * The depth level of the tree including hidden nodes
   */
  get level(): number {
    return this._level;
  }

  /**
   * The depth of the tree node. If the node has no children, its depth
   * is 0, otherwise it is 1 plus the maximum depth of its children.
   */
  get depth(): number {
    return this._depth;
  }

  /**
   * The number of visible items.
   * @returns The number of items that would be shown in the
   * tree view for this node, including this item in its current
   * state, and its child nodes.
   */
  get viewItemCount(): number {
    return this._viewItemCount;
  }

  /**
   * Gets the next tree node at using depth-first-search (DFS) traversal.
   * Hidden and collapsed nodes are skipped.
   * @returns The next node, if exists; otherwise, `undefined`.
   */
  getNextViewNode(): ITreeNode<TNode> | undefined {
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
      const childIndex = parentNode.getChildren().indexOf(childNode);
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
  forEachParent(
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
  forEachDescendant(action: (item: ITreeNode<TNode>) => void): void {
    for (const child of this._children) {
      action(child);
      child.forEachDescendant(action);
    }
  }

  // ========================================================================
  // Helpers

  /**
   * Inserts a child node to the children list into the specified position.
   * @param index Index to insert the child
   * @param child Child to insert
   * @returns The number of child nodes after this operation.
   */
  private _insertChild(index: number, child: ITreeNode<TNode>): number {
    if (child.parentNode) {
      throw new Error("The child node is attached to another parent.");
    }
    if (child.parentTree) {
      throw new Error("The child node is attached to another tree view.");
    }
    if (child.isInTree(this)) {
      throw new Error("Adding this child would cause a circular reference.");
    }
    if (index < 0 || index > this._children.length) {
      throw new Error(
        `Children index ${index} is out of range 0..${this._children.length}`
      );
    }

    // --- Insert the child
    this._children.splice(index, 0, child);

    // --- Attach parents
    (child as TreeNode<TNode>).parentNode = this;
    if (this.parentTree) {
      (child as TreeNode<TNode>).setParentTree(this.parentTree);
    }

    // --- Recalculate level and depth
    (child as TreeNode<TNode>)._level = this._level + 1;
    child.forEachDescendant((c) => {
      (c as TreeNode<TNode>)._level = c.parentNode.level + 1;
    });
    this._depth = this._calcDepth();
    child.forEachParent((p) => {
      (p as TreeNode<TNode>)._depth = (p as TreeNode<TNode>)._calcDepth();
    });

    // --- The view item count may have changed
    this.calculateViewItemCount();

    // --- Done
    this._childAdded.fire([child, index]);
    return this._children.length;
  }

  /**
   * Removes the specified child from this node.
   * @param index Index of child to remove.
   * @returns The removed child node.
   */
  private _removeChild(index: number): ITreeNode<TNode> {
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
    (child as TreeNode<TNode>).setParentTree(undefined);

    // --- Recalculate level and depth
    (child as TreeNode<TNode>)._level = 0;
    child.forEachDescendant((c) => {
      (c as TreeNode<TNode>)._level = c.parentNode.level + 1;
    });
    this._depth = this._calcDepth();
    child.forEachParent((p) => {
      (p as TreeNode<TNode>)._depth = (p as TreeNode<TNode>)._calcDepth();
    });

    // --- The view item count may have changed
    this.calculateViewItemCount();

    // --- Done
    this._childRemoved.fire(child);
    return child;
  }

  /**
   * Gets the first visible child of this node
   * @param index Start index to use
   */
  private _getFirstVisibleChild(
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
  calculateViewItemCount(): void {
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
      this.forEachParent((parent) =>
        (parent as TreeNode<TNode>).calculateViewItemCount()
      );
    }
  }

  /**
   * Calculates the depth of this node
   */
  private _calcDepth(): number {
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
