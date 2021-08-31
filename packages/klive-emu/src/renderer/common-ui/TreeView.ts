import { ITreeView, ITreeNode } from "./ITreeNode";
import { TreeNode } from "./TreeNode";

/**
 * This class implements a hierarchical tree.
 * @param TNode Node data type
 */
export class TreeView<TNode> implements ITreeView<TNode> {
  private _rootNode: ITreeNode<TNode> | undefined;

  // ========================================================================
  // Lifecycle methods

  /**
   * Instantiates the tree view with the specified root node.
   * @param root Root node to assign to the tree
   */
  constructor(root?: ITreeNode<TNode>) {
    this._rootNode = root;
    if (root) {
      (root as TreeNode<TNode>).setParentTree(this);
    }
  }

  // ========================================================================
  // Public properties and operations

  /**
   * Gets the root node of the tree
   */
  get rootNode(): ITreeNode<TNode> {
    return this._rootNode;
  }

  /**
   * The depth of the tree. If the root node has no children, its depth
   * is 0, otherwise it is 1 plus the maximum depth of its children.
   */
  get depth(): number {
    this._checkRootNodeAssigned();
    return this._rootNode.depth;
  }

  /**
   * Sets a new root node for the tree
   * @param node New root node of the tree
   */
  setRootNode(node: ITreeNode<TNode>): void {
    if (this._rootNode) {
      // --- Detach old root from the tree
      (this._rootNode as TreeNode<TNode>).setParentTree(undefined);
    }

    // --- Attach new root
    this._rootNode = node;
    (this._rootNode as TreeNode<TNode>).setParentTree(this);
  }

  /**
   * Gets the tree node at the specified index using depth-first-search (DFS) traversal.
   * Hidden and collapsed nodes are skipped. The root node's index is 0.
   * @param index Index of node to get.
   * @returns The node at the specified index, if exists; otherwise, `undefined`.
   */
  getViewNodeByIndex(index: number): ITreeNode<TNode> | undefined {
    this._checkRootNodeAssigned();
    let currentNode = this._rootNode;
    if (!currentNode) {
      return undefined;
    }
    while (true) {
      // --- If we're right at the indexed node and that is not hidden,
      // --- we found the node.
      if (index === 0 && !currentNode.isHidden) {
        return currentNode;
      }

      if (!currentNode.isExpanded) {
        // --- The node is not expanded, it counts 1.
        index--;

        // --- We move to the sibling of the node
        const parent = currentNode.parentNode;
        if (!parent) {
          // --- No parent, abort search
          return undefined;
        }

        // --- Obtain the parent's index of the current node
        const childIndex = parent.getChildren().indexOf(currentNode);
        if (childIndex < 0 || childIndex >= parent.childCount) {
          // --- No more children, abort the search
          return undefined;
        }

        // --- Go on with the sibling item
        currentNode = parent.getChild(childIndex + 1);
      } else {
        // --- Search the children of the current item
        let viewItemSum = 0;
        let found = false;
        for (let i = 0; i < currentNode.childCount; i++) {
          const child = currentNode.getChild(i);
          const oldViewItemSum = viewItemSum;
          viewItemSum += child.viewItemCount;
          if (viewItemSum >= index) {
            (currentNode = child), (index = index - oldViewItemSum - 1);
            found = true;
            break;
          }
        }
        if (!found) {
          return undefined;
        }
      }
    }
  }

  /**
   * Gets the set of view nodes between the start and end index.
   * @param start Start index (inclusive)
   * @param end End Index (inclusive)
   * @returns The list of view nodes in the specified range, may be an empty list.
   */
  getViewNodeRange(start: number, end: number): Array<ITreeNode<TNode>> {
    const nodeSet: Array<ITreeNode<TNode>> = [];
    let nextNode = this.getViewNodeByIndex(start);
    if (nextNode) {
      nodeSet.push(nextNode);
      for (let i = start; i < end; i++) {
        nextNode = nextNode.getNextViewNode();
        if (!nextNode) {
          break;
        }
        nodeSet.push(nextNode);
      }
    }
    return nodeSet;
  }

  // ========================================================================
  // Helpers

  /**
   * Throws an execption if the root node has not been assinged to this tree view.
   */
  private _checkRootNodeAssigned(): void {
    if (!this._rootNode) {
      throw new Error("Root node of this tree has not been set yet.");
    }
  }
}
