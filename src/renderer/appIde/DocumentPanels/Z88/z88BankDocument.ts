import { toHexa2 } from "@renderer/appIde/services/ide-commands";
import { documentSourceName } from "../helpers/documentSourceName";
import { parseZ88Snapshot } from "@common/z88/z88Snapshot";
import { mapZ88SnapshotToKlive } from "@common/z88/z88SnapshotMapping";
import { z88ViewedCards } from "./z88SnapshotView";

/*
 * The identity of a `.z88` snapshot bank's pop-out document (`.plans/Z88_SLOT_BROWSER_PLAN.md` §4.4).
 *
 * Keyed by the file's **full path**, not its project path: the lesson of `Next/nexBankDocument.ts`,
 * where openers keyed by different paths opened one bank as two documents. Only the viewer opens a
 * Z88 bank today, but a debugger reveal (a natural follow-up) would know only the full path.
 *
 * `openStaticMemoryDump` adds its own `memoryDump-` prefix; this is the part the callers pass it.
 */

/** The dump id of bank `bank` of the snapshot at `fullPath` (host path). */
export function z88BankDumpId(fullPath: string, bank: number): string {
  return `z88BankDump${fullPath}:${bank}`;
}

/** The tab title of a snapshot bank's document: `<path> - Bank $NN`. */
export function z88BankDumpTitle(fullPath: string, bank: number, projectFolder?: string): string {
  return `${documentSourceName(fullPath, projectFolder)} - Bank $${toHexa2(bank)}`;
}

/** The document id `openStaticMemoryDump` gives a snapshot bank: `memoryDump-` + `z88BankDumpId`. */
const Z88_BANK_DOCUMENT_ID = /^memoryDump-z88BankDump(.+):(\d+)$/;

/** The snapshot file and bank a bank document was opened for, from its id. */
export function parseZ88BankDocumentId(
  documentId: string
): { path: string; bank: number } | undefined {
  const match = Z88_BANK_DOCUMENT_ID.exec(documentId);
  return match ? { path: match[1], bank: Number(match[2]) } : undefined;
}

/**
 * A bank's bytes, read back from its `.z88` file: what reopening a closed bank document needs (Go
 * Back to a bank that was closed). `undefined` when the file no longer has that bank.
 * @param path The snapshot's host path
 * @param bank The bank number, as the viewer listed it
 * @param readFile Reads a binary file
 */
export async function readZ88BankBytes(
  path: string,
  bank: number,
  readFile: (path: string) => Promise<Uint8Array>
): Promise<Uint8Array | undefined> {
  const snapshot = parseZ88Snapshot(await readFile(path));
  const cards = z88ViewedCards({ snapshot, mapping: mapZ88SnapshotToKlive(snapshot) });
  return cards.flatMap((card) => card.banks).find((b) => b.bank === bank)?.bytes;
}
