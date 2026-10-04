import { documentSourceName } from "../helpers/documentSourceName";
import { parseSpectrumSnapshot } from "@common/spectrum/snapshot/parseSpectrumSnapshot";

/*
 * The identity of a ZX Spectrum snapshot's RAM bank pop-out document, as the Z88 viewer's
 * (`z88BankDocument.ts`) and the NEX viewer's: keyed by the snapshot's **full path**, so every opener
 * names one bank the same way, and readable back from the file, so Go Back can reopen a bank
 * document that was closed.
 *
 * `openStaticMemoryDump` adds its own `memoryDump-` prefix; this is the part the callers pass it.
 */

/** The dump id of RAM bank `bank` of the snapshot at `fullPath` (host path). */
export function spectrumBankDumpId(fullPath: string, bank: number): string {
  return `spectrumBankDump${fullPath}:${bank}`;
}

/** The tab title of a snapshot bank's document: `<path> - Bank N`. */
export function spectrumBankDumpTitle(fullPath: string, bank: number, projectFolder?: string): string {
  return `${documentSourceName(fullPath, projectFolder)} - Bank ${bank}`;
}

/** The document id `openStaticMemoryDump` gives a snapshot bank: `memoryDump-` + `spectrumBankDumpId`. */
const SPECTRUM_BANK_DOCUMENT_ID = /^memoryDump-spectrumBankDump(.+):(\d+)$/;

/** The snapshot file and bank a bank document was opened for, from its id. */
export function parseSpectrumBankDocumentId(
  documentId: string
): { path: string; bank: number } | undefined {
  const match = SPECTRUM_BANK_DOCUMENT_ID.exec(documentId);
  return match ? { path: match[1], bank: Number(match[2]) } : undefined;
}

/**
 * A bank's bytes, read back from its snapshot file: what reopening a closed bank document needs (Go
 * Back to a bank that was closed). `undefined` when the file no longer holds that bank.
 * @param path The snapshot's host path (its extension picks the format)
 * @param bank The RAM bank number, 0-7
 * @param readFile Reads a binary file
 */
export async function readSpectrumBankBytes(
  path: string,
  bank: number,
  readFile: (path: string) => Promise<Uint8Array>
): Promise<Uint8Array | undefined> {
  return parseSpectrumSnapshot(path, await readFile(path)).ram.get(bank);
}

