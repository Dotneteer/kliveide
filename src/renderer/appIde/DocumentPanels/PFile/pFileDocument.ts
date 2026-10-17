import { documentSourceName } from "../helpers/documentSourceName";
import { analyzeProgramFile } from "./oFileView";
import { P_FILE_REGION_NAMES, type PFileRegionKind } from "./pFileView";

/*
 * The identity of a `.P` (or ZX80 `.O`) file part's pop-out documents, as `Tape/tapeBlockDocument.ts` is for tape
 * blocks: keyed by the file's full path and the part's kind, which names the same bytes however the
 * file is opened.
 *
 * A memory/disassembly dump goes through `openStaticMemoryDump` (which adds `memoryDump-`), a BASIC
 * listing or a screen through the tape block viewer (`TAPE_BLOCK_VIEWER`) in its ZX81 or ZX80 form.
 */

const KINDS: PFileRegionKind[] = ["sysvars", "program", "display", "variables", "data", "extra"];

/** The dump id of a part of the `.P` file at `fullPath` */
export function pFileRegionDumpId(fullPath: string, kind: PFileRegionKind): string {
  return `pFileRegionDump${fullPath}:${kind}`;
}

/**
 * The tab title of a part's documents: `<path> - BASIC program` for its memory, `<path> - Listing`
 * and `<path> - Screen` for the views only one part has
 */
export function pFileRegionTitle(
  fullPath: string,
  kind: PFileRegionKind,
  projectFolder?: string,
  view?: "basic" | "screen"
): string {
  const what = view === "basic" ? "Listing" : view === "screen" ? "Screen" : P_FILE_REGION_NAMES[kind];
  return `${documentSourceName(fullPath, projectFolder)} - ${what}`;
}

/** The document id of a part's BASIC listing or screen */
export function pFileRegionViewDocumentId(
  fullPath: string,
  kind: PFileRegionKind,
  view: "basic" | "screen"
): string {
  return `pFileRegion-${view}${fullPath}:${kind}`;
}

const P_FILE_REGION_DOCUMENT_ID = new RegExp(`^memoryDump-pFileRegionDump(.+):(${KINDS.join("|")})$`);

/** The file and part a part's dump was opened for, from its id */
export function parsePFileRegionDocumentId(
  documentId: string
): { path: string; kind: PFileRegionKind } | undefined {
  const match = P_FILE_REGION_DOCUMENT_ID.exec(documentId);
  return match ? { path: match[1], kind: match[2] as PFileRegionKind } : undefined;
}

/**
 * A part's bytes and address, read back from its file: what reopening a closed part dump needs (Go
 * Back to a part that was closed). `undefined` when the file no longer has such a part.
 */
export async function readPFileRegion(
  path: string,
  kind: PFileRegionKind,
  readFile: (path: string) => Promise<Uint8Array>
): Promise<{ bytes: Uint8Array; start: number } | undefined> {
  const { analysis } = analyzeProgramFile(await readFile(path), path);
  const region = analysis?.regions.find((r) => r.kind === kind);
  return region ? { bytes: region.bytes, start: region.start } : undefined;
}
