import type { BinarySegment } from "@abstractions/CompilerInfo";

/*
 * A banked Boriel BASIC program (`--split-modules`, `.plans/BORIEL_BASIC_INTEGRATION_PLAN.md` §7) as
 * Klive's segments. zxbc refuses `-f bin` for a banked build, so the program comes out of the file it
 * does write - a `.z80` snapshot on the 128K, the `.nex` on the Next - as 16K RAM banks. What belongs
 * to the program there (`.ai/boriel/dbg-observed.md`, "Banking"):
 *
 *   - the resident part, from the origin up to the paging window at $C000 (banks 5 and 2);
 *   - each bank `codebank.banks` lists that holds anything, from the window's start.
 *
 * Neither file says how long each part is. zxbc's `.dbg` does, in sum: `binaryLength` and
 * `binaryChecksum` cover the resident part, then the banks in ascending order. Each part is trimmed
 * of trailing zeros and the checksum decides; zeros that were real data are put back, a part at a
 * time, until it matches.
 */

/** The paging window banked modules run in, on the 128K and the Next alike (`codebank.window`). */
export const BANK_WINDOW = 0xc000;
const BANK_SIZE = 0x4000;

/** One part of a banked program. `bank` is the 16K RAM bank; undefined for the resident part. */
export type BankedPart = { bank?: number; startAddress: number; bytes: Uint8Array };

/** The 32-bit FNV-1a hash zxbc records as `binaryChecksum` (`.ai/boriel/dbg-observed.md`). */
export function fnv1a32(bytes: Uint8Array): number {
  let hash = 0x811c9dc5;
  for (const b of bytes) hash = Math.imul(hash ^ b, 0x01000193) >>> 0;
  return hash >>> 0;
}

/**
 * The 16K banks a `codebank.banks` list names. On the 128K an id is the bank itself; on the Next it
 * is the bank's first 8K page, always even.
 */
export function programBankIds(codebank: any, arch: string): number[] {
  const ids: number[] = (codebank?.banks ?? []).map((b: any) => b.id).filter((id: any) => typeof id === "number");
  return [...new Set(ids.map((id) => (arch === "zxnext" ? id >> 1 : id)))].sort((a, b) => a - b);
}

/** The bank holding a 48K-shaped address below the window: 5 at $4000, 2 at $8000. */
const residentBankOf = (address: number) => (address < 0x8000 ? 5 : 2);

/**
 * The program's parts in `ram` (16K banks by number), checked against the `.dbg`'s length and
 * checksum; or why they cannot be found.
 */
export function extractBankedProgram(
  ram: ReadonlyMap<number, Uint8Array>,
  origin: number,
  bankIds: number[],
  binaryLength: number,
  binaryChecksum: number
): BankedPart[] | string {
  if (origin < 0x4000 || origin >= BANK_WINDOW) return `the origin $${hex(origin)} is not below the paging window`;

  // --- The candidates: the resident area, then every listed bank the file holds, in checksum order
  const resident = new Uint8Array(BANK_WINDOW - origin);
  for (let a = origin; a < BANK_WINDOW; a++) resident[a - origin] = ram.get(residentBankOf(a))?.[a & 0x3fff] ?? 0;
  const areas: BankedPart[] = [{ startAddress: origin, bytes: resident }];
  for (const bank of bankIds) {
    const bytes = ram.get(bank);
    if (bytes && bytes.some((b) => b !== 0)) areas.push({ bank, startAddress: BANK_WINDOW, bytes: bytes.subarray(0, BANK_SIZE) });
  }

  const trimmed = areas.map((a) => usedLength(a.bytes));
  const deficit = binaryLength - trimmed.reduce((s, n) => s + n, 0);
  if (deficit < 0) return `the banks hold ${-deficit} bytes more than the debug file's program`;

  // --- Trailing zeros that are the program's: all on one part (a zero-filled array at a module's end)
  const attempts: number[][] = deficit === 0 ? [trimmed] : trimmed.map((_, i) => trimmed.map((n, j) => (i === j ? n + deficit : n)));
  for (const lengths of attempts) {
    if (lengths.some((n, i) => n > areas[i].bytes.length)) continue;
    const parts = areas.map((a, i) => ({ ...a, bytes: a.bytes.subarray(0, lengths[i]) }));
    if (fnv1a32(concat(parts.map((p) => p.bytes))) === binaryChecksum) return parts.filter((p) => p.bytes.length > 0);
  }
  return "the program in zxbc's output does not match its debug file (checksum mismatch)";
}

/** The parts as Klive segments: the resident one at its address, a bank one at its bank's start. */
export function bankedSegments(parts: BankedPart[]): BinarySegment[] {
  return parts.map((p) => ({
    startAddress: p.startAddress,
    emittedCode: Array.from(p.bytes),
    ...(p.bank !== undefined ? { bank: p.bank, bankOffset: p.startAddress - BANK_WINDOW } : {})
  })) as BinarySegment[];
}

/** The index of the segment a `.dbg` partition is in: a 16K bank on the 128K, an 8K page on the Next. */
export function segmentOfPartition(segments: BinarySegment[], partition: number | undefined, arch: string): number {
  if (partition === undefined) return 0;
  const bank = arch === "zxnext" ? partition >> 1 : partition;
  const index = segments.findIndex((s) => s.bank === bank);
  return index < 0 ? 0 : index;
}

function usedLength(bytes: Uint8Array): number {
  let n = bytes.length;
  while (n > 0 && bytes[n - 1] === 0) n--;
  return n;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

const hex = (n: number) => n.toString(16).toUpperCase().padStart(4, "0");
