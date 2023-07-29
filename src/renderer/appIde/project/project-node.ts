import { ITreeNode, ITreeView, TreeNode, TreeView } from "@/renderer/core/tree-node";
import { customLanguagesRegistry, fileTypeRegistry } from "@/renderer/registry";
import { FileTypeEditor } from "../../abstractions/FileTypePattern";

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
   * Gets the project root relative path of this node
   */
  projectPath?: string;

  /**
   * The optional icon for the project node
   */
  icon?: string;

  /**
   * Node editor
   */
  editor?: string;

  /**
   * Node subtype
   */
  subType?: string;

  /**
   * Is the project node read-only?
   */
  isReadOnly?: boolean;

  /**
   * Is the node's file a binary file?
   */
  isBinary?: boolean;

  /**
   * Indicates if this node can be a build root
   */
  canBeBuildRoot?: boolean;

  /**
   * Optional properties
   */
  props?: Record<string, any>;

  /**
   * This project node should be open as permanent
   */
  openPermanent?: boolean;
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
    // --- Get the file type information
    const fileTypeEntry = getFileTypeEntry(node.name);
    if (fileTypeEntry) {
      node.icon = fileTypeEntry.icon;
      node.editor = fileTypeEntry.editor;
      node.subType = fileTypeEntry.subType;
      node.isReadOnly = fileTypeEntry.isReadOnly;
      node.isBinary = fileTypeEntry.isBinary;
      node.openPermanent = fileTypeEntry.openPermanent;
    }

    // --- Get the language information
    if (!node.isFolder) {
      const fileExt = getNodeExtension(node);
      const langServices = customLanguagesRegistry.filter(reg => reg.extensions.indexOf(fileExt) >= 0);
      if (langServices.length > 0) {
        node.canBeBuildRoot = langServices[0].allowBuildRoot;
      }
    }
    
    // --- Create the initial node
    const rootNode: ITreeNode<ProjectNode> = new TreeNode<ProjectNode>(node);

    // --- Recursively process child nodes
    let childNodes: ITreeNode<ProjectNode>[] = [];
    for (const child of node?.children ?? []) {
      childNodes.push(toTreeNode(child));
    }

    // --- Add child nodes alphabetically
    childNodes = childNodes.sort((a, b) => compareProjectNode(a.data, b.data));
    childNodes.forEach(cn => rootNode.appendChild(cn));

    // --- Drop the child nodes from the data
    delete node.children;

    // --- Done
    return rootNode;
  }
}

/**
 * Compares two project node accordig to their order in the file explorer
 * @param a First node
 * @param b Second node
 * @returns Comparison result
 */
export function compareProjectNode (a: ProjectNode, b: ProjectNode): number {
  const compType = a.isFolder ? (b.isFolder ? 0 : -1) : b.isFolder ? 1 : 0;
  if (compType) return compType;
  return a.name < b.name ? -1 : a.name > b.name ? 0 : 1;
}

/**
 * Gets the file type entry for the specified filename
 * @param filename Filename to get the file type entry for
 */
export function getFileTypeEntry(filename: string): FileTypeEditor | null {
  const nodeFile = getNodeFile(filename);
  for (const typeEntry of fileTypeRegistry) {
    let match = false;
    switch (typeEntry.matchType) {
      case "full":
        match = filename === typeEntry.pattern;
        break;
      case "starts":
        match = filename.startsWith(typeEntry.pattern);
        break;
      case "ends":
        match = filename.endsWith(typeEntry.pattern);
        break;
      case "contains":
        match = filename.indexOf(typeEntry.pattern) >= 0;
        break;
    }
    if (match) return typeEntry;
  }
  return null;
}

/**
 * Gets the icon for the specified filename
 * @param filename Filename to get the file type entry for
 */
export function getFileTypeIcon(filename: string): string | null {
  const typeEnty = getFileTypeEntry(filename);
  return typeEnty ? typeEnty.icon : null;
}