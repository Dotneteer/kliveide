import { IProjectService } from "@renderer/abstractions/IProjectService";
import { ProjectDocumentState } from "@renderer/abstractions/ProjectDocumentState";
import {
  CreateDefaultAnnotationsOptions,
  AnnotationDiagnostic,
  AnnotationBankView,
  AnnotationDebugState,
  ProgramAnnotations,
  NEXT_ANNOTATION_SCHEMA_VERSION,
  isAnnotationMachine,
  schemaVersionFor,
  createDefaultAnnotations,
  getBankAnnotation,
  getAnnotationPath,
  getBankAddressOffset,
  parseAnnotations,
  toSidecarBanks
} from "./programAnnotations";

export type AnnotationSidecarPaths = {
  fullPath: string;
  projectPath?: string;
};

export type AnnotationSidecarState = {
  status: "missing" | "loaded" | "invalid" | "error";
  paths: AnnotationSidecarPaths;
  annotations?: ProgramAnnotations;
  diagnostics: AnnotationDiagnostic[];
  message?: string;
};

export function getAnnotationSidecarPaths(
  document: ProjectDocumentState
): AnnotationSidecarPaths | undefined {
  const sourceFullPath = document.node?.fullPath ?? document.path ?? document.id;
  if (!sourceFullPath) {
    return undefined;
  }

  const sourceProjectPath = document.node?.projectPath;
  return {
    fullPath: getAnnotationPath(sourceFullPath),
    projectPath: sourceProjectPath ? getAnnotationPath(sourceProjectPath) : undefined
  };
}

export function getAnnotatedDisassemblyOffsetForBank(
  annotations: ProgramAnnotations | undefined,
  bank: number,
  fallbackOffset: number
): number {
  const bankAnnotation = annotations ? getBankAnnotation(annotations, bank) : undefined;
  return bankAnnotation ? getBankAddressOffset(bankAnnotation.offsetIndex) : fallbackOffset;
}

export function getAnnotatedLastViewForBank(
  annotations: ProgramAnnotations | undefined,
  bank: number
): AnnotationBankView | undefined {
  return annotations ? getBankAnnotation(annotations, bank)?.lastView : undefined;
}

/**
 * The view a popped-out bank should open in: Sprites when the sidecar says it was showing, otherwise
 * the listing view it remembers.
 */
export function getAnnotatedPopOutViewForBank(
  annotations: ProgramAnnotations | undefined,
  bank: number
): AnnotationBankView | "sprites" | undefined {
  const bankAnnotation = annotations ? getBankAnnotation(annotations, bank) : undefined;
  return bankAnnotation?.sprites?.active ? "sprites" : bankAnnotation?.lastView;
}

export function getAnnotatedDecimalViewForBank(
  annotations: ProgramAnnotations | undefined,
  bank: number,
  fallbackDecimalView: boolean
): boolean {
  const bankAnnotation = annotations ? getBankAnnotation(annotations, bank) : undefined;
  return bankAnnotation?.decimalView ?? fallbackDecimalView;
}

export function formatAnnotations(annotations: ProgramAnnotations): string {
  return `${JSON.stringify(toSidecarAnnotations(annotations), null, 2)}\n`;
}

/**
 * The model in its stored form. Regions are the only part whose in-memory shape differs from the
 * file's: `copper`/`dma` are written as `bytes` + `decode` (`toSidecarRegion`), so the file stays
 * readable by shipped builds.
 */
function toSidecarAnnotations(annotations: ProgramAnnotations): Record<string, unknown> {
  return annotations.banks
    ? { ...annotations, banks: toSidecarBanks(annotations.banks) }
    : { ...annotations };
}

/*
 * The sidecar holds two subtrees with two writers, and neither may clobber the other.
 *
 * - **annotations** (`source`, `globalLabels`, `banks`) are written by the annotation session.
 * - **`debug`** (the bank breakpoints) is written by the breakpoint path.
 *
 * Both write the moment their half changes — the contract `.docs/annotations.md` describes.
 * Sharing a policy is not the same as sharing a writer: writing the whole in-memory model from
 * either side would still revert whatever the other had written since it loaded, and the two run
 * independently and concurrently. So each reads the file, replaces only its own keys, and writes
 * back — which also means a key this build does not know about survives a round trip.
 *
 * See `.plans/NEX_DEBUGGING_PLAN.md` §4.5.
 */

const ANNOTATION_KEYS = ["schemaVersion", "machine", "source", "globalLabels", "banks"] as const;

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
export async function saveAnnotationSubtree(
  projectService: Pick<IProjectService, "readFileContent" | "saveFileContent">,
  fullPath: string,
  annotations: ProgramAnnotations
): Promise<void> {
  const raw = await readRawSidecar(projectService, fullPath);
  const merged: Record<string, unknown> = { ...raw };
  const stored = toSidecarAnnotations(annotations);
  for (const key of ANNOTATION_KEYS) {
    if (stored[key] === undefined) {
      delete merged[key];
    } else {
      merged[key] = stored[key];
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
export async function saveDebugSubtree(
  projectService: Pick<IProjectService, "readFileContent" | "saveFileContent">,
  fullPath: string,
  debug: AnnotationDebugState | undefined
): Promise<void> {
  const raw = await readRawSidecar(projectService, fullPath);
  const merged: Record<string, unknown> = { ...raw };

  /*
   * Empty means *both* halves empty.
   *
   * This tested `breakpoints` alone, which was right while that was the only half: a sidecar whose
   * only debug state was a label-anchored breakpoint had its `debug` key deleted, losing it. The
   * subtree is written wholesale, so every half it can hold has to be counted here — and each half
   * is omitted when it is empty, so a file with only one of them does not carry an empty array for
   * the other.
   */
  const written: AnnotationDebugState = {};
  if (debug?.breakpoints?.length) written.breakpoints = debug.breakpoints;
  if (debug?.labelBreakpoints?.length) written.labelBreakpoints = debug.labelBreakpoints;

  if (Object.keys(written).length === 0) {
    delete merged.debug;
  } else {
    merged.debug = written;
  }
  // --- A file that only ever held annotations still has to declare the schema that describes the
  // --- key just added to it.
  // --- A schema 3 file (one with `machine`) stays 3: stamping 2 on it would turn a 48K sidecar into
  // --- one an older build reads as a Next's.
  merged.schemaVersion = isAnnotationMachine(merged.machine)
    ? schemaVersionFor(merged.machine)
    : NEXT_ANNOTATION_SCHEMA_VERSION;
  await projectService.saveFileContent(fullPath, formatRawSidecar(merged));
}

/** The sidecar's on-disk formatting: the same shape `formatAnnotations` writes. */
function formatRawSidecar(value: Record<string, unknown>): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export async function loadAnnotationSidecar(
  projectService: Pick<IProjectService, "readFileContent">,
  paths: AnnotationSidecarPaths,
  loadedBanks?: number[]
): Promise<AnnotationSidecarState> {
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

    const parseResult = parseAnnotations(contents, { loadedBanks });
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

export async function createAnnotationSidecar(
  projectService: Pick<IProjectService, "readFileContent" | "saveFileContent">,
  paths: AnnotationSidecarPaths,
  options: CreateDefaultAnnotationsOptions
): Promise<AnnotationSidecarState> {
  const existing = await loadAnnotationSidecar(projectService, paths, options.loadedBanks);
  if (existing.status !== "missing") {
    return {
      ...existing,
      message: existing.message ?? "Annotation file already exists."
    };
  }

  const annotations = createDefaultAnnotations(options);
  await projectService.saveFileContent(paths.fullPath, formatAnnotations(annotations));
  return {
    status: "loaded",
    paths,
    annotations,
    diagnostics: []
  };
}

function isMissingFileError(err: unknown): boolean {
  const message = getErrorMessage(err).toLowerCase();
  return message.includes("file does not exist") || message.includes("enoent");
}

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
