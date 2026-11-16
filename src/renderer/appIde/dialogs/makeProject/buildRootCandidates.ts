import type { ITreeView } from "@abstractions/ITreeNode";
import type { ProjectNode } from "@abstractions/ProjectNode";

/**
 * The files of the Explorer's tree that can be a build root (the same rule as the Explorer's
 * Promote to Build Root), as folder-relative paths.
 */
export function buildRootCandidatesOf(tree: ITreeView<ProjectNode> | undefined): string[] {
  const candidates: string[] = [];
  tree?.rootNode?.forEachDescendant((node) => {
    const data = node.data;
    if (data && !data.isFolder && data.canBeBuildRoot && data.projectPath) {
      candidates.push(data.projectPath.replace(/^\/+/, ""));
    }
  });
  return candidates;
}
