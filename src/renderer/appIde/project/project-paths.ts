import type { ProjectNode } from "@abstractions/ProjectNode";

/**
 * Pure path helpers for project nodes.
 *
 * Split out of `project-node.ts` because that module reaches the editor
 * registry — and through it Monaco — while these four are plain string
 * manipulation. Anything that only needs to take a path apart, including the
 * headless model layer of a dialog, should import from here.
 */

/**
 * Gets the folder of the specified project node
 * @param node Project node
 * @returns Extension part of the project node
 */
export function getNodeDir(node: ProjectNode | string): string {
  const fullPath = typeof node === "string" ? node : node.fullPath;
  const segments = fullPath.split("/").slice(0, -1);
  return fullPath ? segments.join("/") : "";
}

/**
 * Gets the filename of the specified project node
 * @param node Project node
 * @returns Filename + extension part of the project node
 */
export function getNodeFile(node: ProjectNode | string): string {
  const fullPath = typeof node === "string" ? node : node.fullPath;
  let segments = fullPath.split("/");
  // if (segments.length > 1) {
  //   segments = segments.slice(0, -1);
  // }
  return fullPath && segments.length > 0 ? segments[segments.length - 1] : "";
}

/**
 * Gets the extension of the specified project node
 * @param node Project node
 * @returns Extension part of the project node
 */
export function getNodeName(node: ProjectNode | string): string {
  const filename = getNodeFile(node);
  if (!filename) {
    return "";
  }
  const fileParts = filename.split(".");
  return fileParts.length > 0 ? fileParts[0] : "";
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
