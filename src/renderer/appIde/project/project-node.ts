import type { ProjectNode, ProjectNodeWithChildren } from "@abstractions/ProjectNode";
import type { ITreeNode, ITreeView } from "@abstractions/ITreeNode";

import { TreeNode, TreeView } from "@renderer/core/tree-node";
import { customLanguagesRegistry, fileTypeRegistry, unknownFileType } from "@renderer/registry";
import { FileTypeEditor } from "../../abstractions/FileTypePattern";
import { getIsWindows } from "@renderer/os-utils";
import { Store } from "@common/state/redux-light";
import { AppState } from "@common/state/AppState";
import { createSettingsReader } from "@common/utils/SettingsReader";
import { LANGUAGE_SETTINGS } from "@common/structs/project-const";

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
  if (segments.length > 1) {
    segments = segments.slice(0, -1);
  }
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

export function buildProjectTree(
  root: ProjectNodeWithChildren,
  store: Store<AppState>,
  expandedList?: string[]
): ITreeView<ProjectNode> {
  return new TreeView<ProjectNode>(toTreeNode(root), false);

  function toTreeNode(node: ProjectNodeWithChildren): ITreeNode<ProjectNode> {
    // --- Get the file type information
    const fileTypeEntry = getFileTypeEntry(node.name, store) ?? unknownFileType;
    if (fileTypeEntry) {
      node.icon = fileTypeEntry.icon;
      node.iconFill = fileTypeEntry.iconFill;
      node.editor = fileTypeEntry.editor;
      node.subType = fileTypeEntry.subType;
      node.isReadOnly = fileTypeEntry.isReadOnly;
      node.isBinary = fileTypeEntry.isBinary;
      node.openPermanent = fileTypeEntry.openPermanent;
      node.canBeBuildRoot = !!fileTypeEntry.canBeBuildRoot;
    }

    // --- Get the language information
    if (!node.isFolder) {
      const nodeFullPath = typeof node === "string" ? node : node.fullPath;
      node.canBeBuildRoot ||= customLanguagesRegistry
        .filter((reg) => reg.extensions.some((ext) => nodeFullPath.endsWith(ext)))
        .some((reg) => reg.allowBuildRoot);
    }

    // --- Recursively process child nodes
    let childNodes: ITreeNode<ProjectNode>[] = [];
    for (const child of node?.children ?? []) {
      childNodes.push(toTreeNode(child));
    }

    // --- Drop the child nodes from the data
    delete node.children;

    // --- Create the initial node
    const rootNode: ITreeNode<ProjectNode> = new TreeNode<ProjectNode>(node);

    let visibleChildrenCount = 0;

    // --- Add child nodes alphabetically
    childNodes = childNodes.sort((a, b) => compareProjectNode(a.data, b.data));
    childNodes.forEach((cn) => {
      if (!cn.isHidden) ++visibleChildrenCount;
      rootNode.appendChild(cn);
    });

    // --- Handle visibility
    let isVisible = (!node.isFolder && fileTypeEntry) || node.isFolder;
    rootNode.isHidden = !isVisible;

    // --- Handle expanded state
    rootNode.isExpanded = node === root || (expandedList?.includes(node.projectPath ?? "") ?? true);

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
export function compareProjectNode(a: ProjectNode, b: ProjectNode): number {
  const compType = a.isFolder ? (b.isFolder ? 0 : -1) : b.isFolder ? 1 : 0;
  if (compType) return compType;
  return a.name < b.name ? -1 : a.name > b.name ? 0 : 1;
}

/**
 * Gets the file type entry for the specified filename
 * @param filename Filename to get the file type entry for
 */
export function getFileTypeEntry(filename: string, store: Store<AppState>): FileTypeEditor | null {
  if (!filename) return null;

  // --- Get the language extensions
  const reader = createSettingsReader(store);
  const languageExts = reader.readSetting(LANGUAGE_SETTINGS);
  const languageHash: Record<string, string[]> = {};

  if (languageExts && typeof languageExts === "object" && !Array.isArray(languageExts)) {
    Object.keys(languageExts).forEach((key) => {
      const value = languageExts[key];
      if (typeof value !== "string") return;
      languageHash[key] = value.split("|").map((v) => v.trim());
    });
  }

  // --- Check for language extensions
  let languageFound = "";
  const hashes = Object.keys(languageHash);
  for (const hash of hashes) {
    if (languageHash[hash].some((ext) => filename.endsWith(ext))) {
      languageFound = hash;
      break;
    }
  }

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
        match = filename.endsWith(typeEntry.pattern) || languageFound === typeEntry.subType;
        break;
      case "contains":
        match = filename.indexOf(typeEntry.pattern) >= 0;
        break;
    }
    if (match) return typeEntry;
  }
  return null;
}

export function isAbsolutePath(path: string): boolean {
  if (getIsWindows()) {
    // In Windows, an absolute path starts with a drive letter followed by ':' or a server share ('\\')
    return /^[a-zA-Z]:/.test(path) || path.startsWith("\\\\");
  } else {
    // In POSIX (Linux/Mac), an absolute path starts with '/'
    return path.startsWith("/");
  }
}
