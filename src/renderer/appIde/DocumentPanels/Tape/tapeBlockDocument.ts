import { documentSourceName } from "../helpers/documentSourceName";
import { analyzeTape, blockPayload, type TapeBlockInfo } from "./tapeView";

/*
 * The identity of a tape block's pop-out documents (`.plans/TAPE_VIEWER_PLAN.md` §4.5).
 *
 * Keyed by the tape's **full path**, not its project path - the lesson of `Next/nexBankDocument.ts`,
 * where openers keyed by different paths opened one bank as two documents.
 *
 * Two kinds of document: a memory/disassembly dump (`STATIC_MEMORY_DUMP_VIEWER`, through
 * `openStaticMemoryDump`, which adds its own `memoryDump-` prefix), and a BASIC listing or screen
 * (`TAPE_BLOCK_VIEWER`).
 */

/** The dump id of block `index` of the tape at `fullPath` */
export function tapeBlockDumpId(fullPath: string, index: number): string {
  return `tapeBlockDump${fullPath}:${index}`;
}

/** The tab title of a block's documents: `<path> - Block #n`, plus the view for a listing */
export function tapeBlockTitle(
  fullPath: string,
  index: number,
  projectFolder?: string,
  view?: "basic" | "screen"
): string {
  const suffix = view === "basic" ? " (BASIC)" : view === "screen" ? " (Screen)" : "";
  return `${documentSourceName(fullPath, projectFolder)} - Block #${index}${suffix}`;
}

/** The document id of a block's BASIC listing or screen */
export function tapeBlockViewDocumentId(
  fullPath: string,
  index: number,
  view: "basic" | "screen"
): string {
  return `tapeBlock-${view}${fullPath}:${index}`;
}

/** The document id `openStaticMemoryDump` gives a tape block: `memoryDump-` + `tapeBlockDumpId` */
const TAPE_BLOCK_DOCUMENT_ID = /^memoryDump-tapeBlockDump(.+):(\d+)$/;

/** The tape and block a block's dump was opened for, from its id */
export function parseTapeBlockDocumentId(
  documentId: string
): { path: string; index: number } | undefined {
  const match = TAPE_BLOCK_DOCUMENT_ID.exec(documentId);
  return match ? { path: match[1], index: Number(match[2]) } : undefined;
}

/**
 * A block's payload, read back from its tape file: what reopening a closed block dump needs (Go
 * Back to a block that was closed). `undefined` when the file no longer has such a block.
 *
 * Re-analyses the file each time rather than caching it as `nexBankReveal.ts` does: a tape is small,
 * and a reopen is one user action, so a cache would only add a way to show stale bytes.
 */
export async function readTapeBlockBytes(
  path: string,
  index: number,
  readFile: (path: string) => Promise<Uint8Array>
): Promise<Uint8Array | undefined> {
  const { analysis } = analyzeTape(await readFile(path));
  const block: TapeBlockInfo | undefined = analysis?.blocks[index];
  return block ? blockPayload(block) : undefined;
}
