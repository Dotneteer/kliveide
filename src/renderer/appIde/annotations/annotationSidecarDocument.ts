import { ProjectNode } from "@abstractions/ProjectNode";
import { AppState } from "@common/state/AppState";
import { Store } from "@common/state/redux-light";
import { IDocumentHubService } from "@renderer/abstractions/IDocumentHubService";
import { IProjectService } from "@renderer/abstractions/IProjectService";
import { getFileTypeEntry, getNodeFile } from "@renderer/appIde/project/project-node";
import type { AnnotationSidecarPaths } from "./annotationSidecar";

/*
 * Opening a sidecar as a document. Kept apart from `annotationSidecar.ts` because it needs the
 * project's file-type registry, which reaches the editors; the model, the session and the sidecar
 * reader stay free of UI so a command or a hook can use them anywhere.
 */

export async function openAnnotationSidecarDocument(
  projectService: Pick<IProjectService, "getDocumentForProjectNode" | "getNodeForFile">,
  documentHubService: Pick<IDocumentHubService, "getDocument" | "openDocument" | "setActiveDocument">,
  paths: AnnotationSidecarPaths,
  store: Store<AppState>
): Promise<void> {
  const openDocument = documentHubService.getDocument(paths.fullPath);
  if (openDocument) {
    await documentHubService.setActiveDocument(openDocument.id);
    return;
  }

  const node = projectService.getNodeForFile(paths.fullPath)?.data
    ?? createAnnotationProjectNode(paths, store);
  const document = await projectService.getDocumentForProjectNode(node);
  await documentHubService.openDocument(document, undefined, true);
}

export function createAnnotationProjectNode(
  paths: AnnotationSidecarPaths,
  store: Store<AppState>
): ProjectNode {
  const name = getNodeFile(paths.fullPath);
  const fileType = getFileTypeEntry(name, store);
  return {
    isFolder: false,
    name,
    fullPath: paths.fullPath,
    projectPath: paths.projectPath,
    icon: fileType?.icon,
    iconFill: fileType?.iconFill,
    editor: fileType?.editor,
    subType: fileType?.subType,
    isReadOnly: fileType?.isReadOnly,
    isBinary: fileType?.isBinary,
    openPermanent: fileType?.openPermanent,
    canBeBuildRoot: !!fileType?.canBeBuildRoot
  };
}

