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
   * The type of the project node
   */
  type?: ProjectNodeType;

  /**
   * Indicates if this node is a build root
   */
  buildRoot?: boolean;

  /**
   * Optional extender properties
   */
  extenderProps?: Record<string, any>;
};

/**
 * This enumeration describes project node types
 */
export enum ProjectNodeType {
  Unknown = -1,
  None = 0,
}

/**
 * Gets the folder of the specified project node
 * @param node Project node
 * @returns Extension part of the project node
 */
export function getNodeDir(node: ProjectNode | string): string {
  const fullPath = typeof node === "string" ? node : node.fullPath;
  const segments = fullPath.split("/");
  return segments.slice(0, -1).join("/");
}

/**
 * Gets the filename of the specified project node
 * @param node Project node
 * @returns Extension part of the project node
 */
export function getNodeFile(node: ProjectNode | string): string {
  const fullPath = typeof node === "string" ? node : node.fullPath;
  const segments = fullPath.split("/");
  return segments.length > 0 ? segments[segments.length - 1] : "";
}

/**
 * Gets the extension of the specified project node
 * @param node Project node
 * @returns Extension part of the project node
 */
export function getNodeExtension(node: ProjectNode | string): string {
  const filename = getNodeFile(node);
  if (!filename) {
    return "";
  }
  const fileParts = filename.split(".");
  return fileParts.length > 0 ? "." + fileParts.slice(1).join(".") : "";
}
