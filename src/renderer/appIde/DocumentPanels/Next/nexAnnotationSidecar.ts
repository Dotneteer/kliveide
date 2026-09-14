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
  NexAnnotationBankView,
  NexDebugState,
  NexFileAnnotations,
  NEX_ANNOTATION_SCHEMA_VERSION,
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

export function getAnnotatedLastViewForBank(
  annotations: NexFileAnnotations | undefined,
  bank: number
): NexAnnotationBankView | undefined {
  return annotations ? getBankAnnotation(annotations, bank)?.lastView : undefined;
}

export function getAnnotatedDecimalViewForBank(
  annotations: NexFileAnnotations | undefined,
  bank: number,
  fallbackDecimalView: boolean
): boolean {
  const bankAnnotation = annotations ? getBankAnnotation(annotations, bank) : undefined;
  return bankAnnotation?.decimalView ?? fallbackDecimalView;
}

export function formatNexAnnotations(annotations: NexFileAnnotations): string {
  return `${JSON.stringify(annotations, null, 2)}\n`;
}

/*
 * The sidecar holds two subtrees with two different save policies, and neither writer may clobber
 * the other.
 *
 * - **annotations** (`source`, `globalLabels`, `banks`) are dirty-tracked and written when the user
 *   asks — the contract `.docs/nex-annotations.md` describes.
 * - **`debug`** (the bank breakpoints) is written the moment it changes, because a breakpoint lost
 *   because nobody pressed Save is a bug rather than a policy.
 *
 * Writing the whole in-memory model from either side would therefore be wrong in one direction or
 * the other: a breakpoint would flush half-finished annotation edits, and an annotation save would
 * revert a breakpoint set since it loaded. Both writers read the file, replace only their own keys,
 * and write back — which also means a key this build does not know about survives a round trip.
 *
 * See `.plans/NEX_DEBUGGING_PLAN.md` §4.5.
 */

const ANNOTATION_KEYS = ["schemaVersion", "source", "globalLabels", "banks"] as const;

/** The sidecar's current contents as raw JSON, or `{}` when it does not exist or cannot be parsed. */
async function readRawSidecar(
  projectService: Pick<IProjectService, "readFileContent">,
  fullPath: string
): Promise<Record<string, unknown>> {
  try {
    const contents = await projectService.readFileContent(fullPath, false);
    if (typeof contents !== "string") return {};
    const parsed = JSON.parse(contents);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    // --- Missing or unreadable: the write that follows creates it.
    return {};
  }
}

/**
 * Write the annotation subtree, preserving whatever `debug` is on disk.
 *
 * The version is stamped from the model, which is the current one — so a v1 file becomes v2 here,
 * on the first save, and not merely by being opened.
 */
export async function saveNexAnnotationSubtree(
  projectService: Pick<IProjectService, "readFileContent" | "saveFileContent">,
  fullPath: string,
  annotations: NexFileAnnotations
): Promise<void> {
  const raw = await readRawSidecar(projectService, fullPath);
  const merged: Record<string, unknown> = { ...raw };
  for (const key of ANNOTATION_KEYS) {
    if (annotations[key] === undefined) {
      delete merged[key];
    } else {
      merged[key] = annotations[key];
    }
  }
  await projectService.saveFileContent(fullPath, formatRawSidecar(merged));
}

/**
 * Write the `debug` subtree, preserving the annotations on disk.
 *
 * An empty state removes the key rather than writing `{}`, so a file with nothing to debug reads the
 * same as it did before breakpoints existed.
 */
export async function saveNexDebugSubtree(
  projectService: Pick<IProjectService, "readFileContent" | "saveFileContent">,
  fullPath: string,
  debug: NexDebugState | undefined
): Promise<void> {
  const raw = await readRawSidecar(projectService, fullPath);
  const merged: Record<string, unknown> = { ...raw };
  if (!debug?.breakpoints?.length) {
    delete merged.debug;
  } else {
    merged.debug = debug;
  }
  // --- A file that only ever held annotations still has to declare the schema that describes the
  // --- key just added to it.
  merged.schemaVersion = NEX_ANNOTATION_SCHEMA_VERSION;
  await projectService.saveFileContent(fullPath, formatRawSidecar(merged));
}

/** The sidecar's on-disk formatting: the same shape `formatNexAnnotations` writes. */
function formatRawSidecar(value: Record<string, unknown>): string {
  return `${JSON.stringify(value, null, 2)}\n`;
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
