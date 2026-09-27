import type { FileLine, ListFileItem, SourceLevelDebugInfo } from "@abstractions/CompilerInfo";

/**
 * The source-level debug sidecar of a NEX (plan `.plans/ZXBASIC_COMPILER_PLAN.md` §8.5):
 * `<name>.nex.kbasic-debug.json`, written beside a NEX exported from a program with source-level
 * debug info. When that NEX is launched on its own (`nex-run`), the IDE sends the sidecar's info to
 * the emulator, so the program can be stepped at source level without rebuilding it.
 *
 * The sidecar names the NEX it belongs to by length and checksum: a NEX rebuilt by another tool, or
 * copied over, no longer matches, and its sidecar is ignored rather than trusted — stepping with
 * another program's statement table stops in the wrong places.
 *
 * Separate from the NEX viewer's own sidecar (breakpoints, labels): that one belongs to the file and
 * survives rebuilds; this one describes one build and is replaced with it.
 */
export const SOURCE_DEBUG_SIDECAR_SUFFIX = ".kbasic-debug.json";

const FORMAT = "klive-source-debug";
const VERSION = 1;

export type SourceDebugSidecar = {
  format: typeof FORMAT;
  version: number;
  /** The NEX this describes: its length and FNV-1a checksum. */
  nexLength: number;
  nexChecksum: number;
  sourceLevelDebug: SourceLevelDebugInfo;
  /**
   * The build's classic tables, so the IDE can show the launched program as if it had just built it:
   * source breakpoints resolve through them, and the editor and the source-level panels follow them.
   * Segments keep only their placement (the code is in the NEX).
   */
  program?: SidecarProgram;
};

export type SidecarProgram = {
  sourceFileList: { filename: string; includes: unknown[] }[];
  listFileItems: ListFileItem[];
  sourceMap: Record<number, FileLine>;
  segments: { startAddress: number; bank?: number; bankOffset?: number }[];
  modelType?: number;
  entryAddress?: number;
};

/** The tables of a build the sidecar keeps (segment placement only). */
export function sidecarProgramOf(output: {
  sourceFileList: { filename: string; includes?: unknown[] }[];
  listFileItems: ListFileItem[];
  sourceMap: Record<number, FileLine>;
  segments: { startAddress: number; bank?: number; bankOffset?: number }[];
  modelType?: number;
  entryAddress?: number;
}): SidecarProgram {
  return {
    sourceFileList: output.sourceFileList.map((f) => ({ filename: f.filename, includes: f.includes ?? [] })),
    listFileItems: output.listFileItems,
    sourceMap: output.sourceMap,
    segments: output.segments.map((seg) => ({
      startAddress: seg.startAddress,
      ...(seg.bank !== undefined ? { bank: seg.bank, bankOffset: seg.bankOffset ?? 0 } : {})
    })),
    ...(output.modelType !== undefined ? { modelType: output.modelType } : {}),
    ...(output.entryAddress !== undefined ? { entryAddress: output.entryAddress } : {})
  };
}

/** The sidecar's path for a NEX file's path. */
export function sourceDebugSidecarPath(nexPath: string): string {
  return nexPath + SOURCE_DEBUG_SIDECAR_SUFFIX;
}

/** FNV-1a, 32 bits: enough to tell one build of a NEX from another. */
export function nexChecksum(data: Uint8Array): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < data.length; i++) {
    hash ^= data[i];
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** The sidecar's text for a NEX and the source-level info of the build that produced it. */
export function createSourceDebugSidecar(nex: Uint8Array, info: SourceLevelDebugInfo, program?: SidecarProgram): string {
  const sidecar: SourceDebugSidecar = {
    format: FORMAT,
    version: VERSION,
    nexLength: nex.length,
    nexChecksum: nexChecksum(nex),
    sourceLevelDebug: info,
    ...(program ? { program } : {})
  };
  return JSON.stringify(sidecar);
}

/**
 * The source-level info of a sidecar, when it belongs to this NEX; otherwise why it cannot be used
 * (not a sidecar, a newer format, or another build of the NEX).
 */
export function readSourceDebugSidecar(
  text: string,
  nex: Uint8Array
): { info: SourceLevelDebugInfo; program?: SidecarProgram } | { error: string } {
  let parsed: Partial<SourceDebugSidecar>;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { error: "the file is not valid JSON" };
  }
  if (parsed?.format !== FORMAT || typeof parsed.version !== "number" || !parsed.sourceLevelDebug) {
    return { error: "the file is not a source-level debug sidecar" };
  }
  if (parsed.version > VERSION) return { error: `the sidecar's format version ${parsed.version} is newer than this Klive's (${VERSION})` };
  if (parsed.nexLength !== nex.length || parsed.nexChecksum !== nexChecksum(nex)) {
    return { error: "it was written for another build of this NEX" };
  }
  return { info: parsed.sourceLevelDebug, ...(parsed.program ? { program: parsed.program } : {}) };
}
