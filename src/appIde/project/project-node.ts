import { ITreeNode, ITreeView, TreeNode, TreeView } from "@/core/tree-node";

/**
 * This interface represents a project node for transferring data
 * between the main and renderer processes
 */
export type ProjectNode = {
  /**
   * Indicates if the node is a folder
   */
  isFolder: boolean;

  /**
   * The name of the node
   */
  name: string;

  /**
   * Gets the full path of this node
   */
  fullPath?: string;

  /**
   * The optional icon for the project node
   */
  icon?: string;

  /**
   * Is the project node read-only?
   */
  isReadOnly?: boolean;

  /**
   * Optional properties
   */
  props?: Record<string, any>;
};

/**
 * A set of hierarchical project nodes
 */
export type ProjectNodeWithChildren = ProjectNode & {
  children: ProjectNodeWithChildren[];
};

/**
 * Gets the folder of the specified project node
 * @param node Project node
 * @returns Extension part of the project node
 */
export function getNodeDir (node: ProjectNode | string): string {
  const fullPath = typeof node === "string" ? node : node.fullPath;
  const segments = fullPath.split("/");
  return segments.slice(0, -1).join("/");
}

/**
 * Gets the filename of the specified project node
 * @param node Project node
 * @returns Extension part of the project node
 */
export function getNodeFile (node: ProjectNode | string): string {
  const fullPath = typeof node === "string" ? node : node.fullPath;
  const segments = fullPath.split("/");
  return segments.length > 0 ? segments[segments.length - 1] : "";
}

/**
 * Gets the extension of the specified project node
 * @param node Project node
 * @returns Extension part of the project node
 */
export function getNodeExtension (node: ProjectNode | string): string {
  const filename = getNodeFile(node);
  if (!filename) {
    return "";
  }
  const fileParts = filename.split(".");
  return fileParts.length > 0 ? "." + fileParts.slice(1).join(".") : "";
}

export function buildProjectTree (
  root: ProjectNodeWithChildren
): ITreeView<ProjectNode> {
  return new TreeView<ProjectNode>(toTreeNode(root), false);

  function toTreeNode (node: ProjectNodeWithChildren): ITreeNode<ProjectNode> {
    // --- Create the initial node
    const rootNode: ITreeNode<ProjectNode> = new TreeNode<ProjectNode>(node);

    // --- Recursively process child nodes
    let childNodes: ITreeNode<ProjectNode>[] = [];
    for (const child of node?.children ?? []) {
      childNodes.push(toTreeNode(child));
    }

    // --- Add child nodes alphabetically
    childNodes = childNodes.sort((a, b) => {
      if (a.data.name < b.data.name) return -1;
      if (a.data.name > b.data.name) return 1;
      return 0;
    });
    childNodes.forEach(cn => rootNode.appendChild(cn));

    // --- Drop the child nodes from the data
    delete node.children;

    // --- Done
    return rootNode;
  }
}
