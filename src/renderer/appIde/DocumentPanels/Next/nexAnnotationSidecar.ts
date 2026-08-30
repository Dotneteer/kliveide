import { ProjectNode } from "@abstractions/ProjectNode";
import { AppState } from "@common/state/AppState";
import { Store } from "@common/state/redux-light";
import { IDocumentHubService } from "@renderer/abstractions/IDocumentHubService";
import { IProjectService } from "@renderer/abstractions/IProjectService";
import { ProjectDocumentState } from "@renderer/abstractions/ProjectDocumentState";
import { getFileTypeEntry, getNodeFile } from "@renderer/appIde/project/project-node";
import {
  CreateDefaultNexAnnotationsOptions,
  NexAnnotationDiagnostic,
  NexFileAnnotations,
  createDefaultNexAnnotations,
  getBankAnnotation,
  getNexAnnotationPath,
  getNexBankAddressOffset,
  parseNexAnnotations
} from "./nexAnnotations";

export type NexAnnotationSidecarPaths = {
  fullPath: string;
  projectPath?: string;
};

export type NexAnnotationSidecarState = {
  status: "missing" | "loaded" | "invalid" | "error";
  paths: NexAnnotationSidecarPaths;
  annotations?: NexFileAnnotations;
  diagnostics: NexAnnotationDiagnostic[];
  message?: string;
};

export function getNexAnnotationSidecarPaths(
  document: ProjectDocumentState
): NexAnnotationSidecarPaths | undefined {
  const sourceFullPath = document.node?.fullPath ?? document.path ?? document.id;
  if (!sourceFullPath) {
    return undefined;
  }

  const sourceProjectPath = document.node?.projectPath;
  return {
    fullPath: getNexAnnotationPath(sourceFullPath),
    projectPath: sourceProjectPath ? getNexAnnotationPath(sourceProjectPath) : undefined
  };
}

export function getAnnotatedDisassemblyOffsetForBank(
  annotations: NexFileAnnotations | undefined,
  bank: number,
  fallbackOffset: number
): number {
  const bankAnnotation = annotations ? getBankAnnotation(annotations, bank) : undefined;
  return bankAnnotation ? getNexBankAddressOffset(bankAnnotation.offsetIndex) : fallbackOffset;
}

export function formatNexAnnotations(annotations: NexFileAnnotations): string {
  return `${JSON.stringify(annotations, null, 2)}\n`;
}

export async function loadNexAnnotationSidecar(
  projectService: Pick<IProjectService, "readFileContent">,
  paths: NexAnnotationSidecarPaths,
  loadedBanks: number[]
): Promise<NexAnnotationSidecarState> {
  try {
    // The sidecar can be added or removed independently of the cached NEX file.
    const contents = await projectService.readFileContent(paths.fullPath, false);
    if (typeof contents !== "string") {
      return {
        status: "error",
        paths,
        diagnostics: [],
        message: "Annotation file is not a text file."
      };
    }

    const parseResult = parseNexAnnotations(contents, { loadedBanks });
    if (parseResult.annotations) {
      return {
        status: "loaded",
        paths,
        annotations: parseResult.annotations,
        diagnostics: parseResult.diagnostics
      };
    }
    return {
      status: "invalid",
      paths,
      diagnostics: parseResult.diagnostics,
      message: "Annotation file contains validation errors."
    };
  } catch (err) {
    if (isMissingFileError(err)) {
      return {
        status: "missing",
        paths,
        diagnostics: [],
        message: "No annotation sidecar file found."
      };
    }
    return {
      status: "error",
      paths,
      diagnostics: [],
      message: getErrorMessage(err)
    };
  }
}

export async function createNexAnnotationSidecar(
  projectService: Pick<IProjectService, "readFileContent" | "saveFileContent">,
  paths: NexAnnotationSidecarPaths,
  options: CreateDefaultNexAnnotationsOptions
): Promise<NexAnnotationSidecarState> {
  const existing = await loadNexAnnotationSidecar(projectService, paths, options.loadedBanks);
  if (existing.status !== "missing") {
    return {
      ...existing,
      message: existing.message ?? "Annotation file already exists."
    };
  }

  const annotations = createDefaultNexAnnotations(options);
  await projectService.saveFileContent(paths.fullPath, formatNexAnnotations(annotations));
  return {
    status: "loaded",
    paths,
    annotations,
    diagnostics: []
  };
}

export async function openNexAnnotationSidecarDocument(
  projectService: Pick<IProjectService, "getDocumentForProjectNode" | "getNodeForFile">,
  documentHubService: Pick<IDocumentHubService, "getDocument" | "openDocument" | "setActiveDocument">,
  paths: NexAnnotationSidecarPaths,
  store: Store<AppState>
): Promise<void> {
  const openDocument = documentHubService.getDocument(paths.fullPath);
  if (openDocument) {
    await documentHubService.setActiveDocument(openDocument.id);
    return;
  }

  const node = projectService.getNodeForFile(paths.fullPath)?.data
    ?? createNexAnnotationProjectNode(paths, store);
  const document = await projectService.getDocumentForProjectNode(node);
  await documentHubService.openDocument(document, undefined, true);
}

export function createNexAnnotationProjectNode(
  paths: NexAnnotationSidecarPaths,
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

function isMissingFileError(err: unknown): boolean {
  const message = getErrorMessage(err).toLowerCase();
  return message.includes("file does not exist") || message.includes("enoent");
}

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
