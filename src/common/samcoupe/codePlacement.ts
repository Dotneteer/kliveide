/*
 * Where injected or exported SAM Coupé code goes (`dev/plans/SAM_COUPE_PLAN.md` §12). One set of rules for
 * Run, Debug and Export, so what Run executes is what Export writes.
 *
 * SAM BASIC's paging (the ROM's, after boot): section A ROM0, section B page 0 (the system variables and
 * BASIC's stack), section C page HMPR. A program runs with HMPR = 1: page 1 at 8000h and page 2 at C000h,
 * the convention of pyz80 and `.sbt` files (STORAGE_FIRMWARE_SOFTWARE.md §6).
 *
 *   - a segment with a `.bank` goes to that page (0-31) at its offset;
 *   - otherwise 8000h-BFFFh is page 1, C000h-FFFFh page 2, and 4000h-7FFFh page 0 (BASIC's memory: the
 *     system variables are there, so only with care);
 *   - nothing below 4000h (ROM0).
 * The entry point is the `.org` of the first segment unless the build names one; it must be in 4000h-FFFFh.
 */

export const SAM_CODE_DEFAULT_PAGE = 1;
export const SAM_CODE_DEFAULT_ADDRESS = 0x8000;
/** The HMPR a program runs with: page 1 in section C, page 2 in section D */
export const SAM_RUN_HMPR = 0x01;

export type SamSegment = { startAddress: number; emittedCode: ArrayLike<number>; bank?: number; bankOffset?: number };

/** A run of bytes in one page */
export type SamPagedBlock = { page: number; offset: number; bytes: Uint8Array };

export type SamPlacementProblem =
  | { code: "empty" }
  | { code: "rom"; address: number }
  | { code: "badPage"; page: number }
  | { code: "entry"; entry: number };

export type SamPlacement = {
  /** The blocks, each inside one page */
  blocks: SamPagedBlock[];
  /** The CPU address to start at, with HMPR = 1 */
  entry: number;
  /** Whether some code is in page 0 (4000h-7FFFh), over BASIC's system variables */
  usesPage0: boolean;
};

export function isSamPlacementProblem(value: SamPlacement | SamPlacementProblem): value is SamPlacementProblem {
  return "code" in value;
}

/** The page a CPU address is in under Run's paging, or undefined for ROM0 */
export function samRunPageOf(address: number): number | undefined {
  if (address < 0x4000) return undefined;
  if (address < 0x8000) return 0;
  return address < 0xc000 ? 1 : 2;
}

/**
 * Splits the segments into page blocks
 * @returns the placement, or the first problem
 */
export function placeSamCode(segments: readonly SamSegment[], entryAddress: number | undefined): SamPlacement | SamPlacementProblem {
  const withCode = segments.filter((s) => s.emittedCode.length > 0);
  if (!withCode.length) return { code: "empty" };
  const blocks: SamPagedBlock[] = [];
  let usesPage0 = false;
  for (const s of withCode) {
    const bytes = Uint8Array.from(Array.from(s.emittedCode));
    if (s.bank !== undefined) {
      if (s.bank < 0 || s.bank > 31) return { code: "badPage", page: s.bank };
      let page = s.bank;
      let offset = s.bankOffset ?? 0;
      for (let i = 0; i < bytes.length; ) {
        const take = Math.min(bytes.length - i, 0x4000 - offset);
        blocks.push({ page: page & 31, offset, bytes: bytes.subarray(i, i + take) });
        i += take;
        page++;
        offset = 0;
      }
      continue;
    }
    for (let i = 0; i < bytes.length; ) {
      const address = (s.startAddress + i) & 0xffff;
      const page = samRunPageOf(address);
      if (page === undefined) return { code: "rom", address };
      if (page === 0) usesPage0 = true;
      const offset = address & 0x3fff;
      const take = Math.min(bytes.length - i, 0x4000 - offset, 0x10000 - address);
      blocks.push({ page, offset, bytes: bytes.subarray(i, i + take) });
      i += take;
    }
  }
  const first = withCode.find((s) => s.bank === undefined) ?? withCode[0];
  const entry = entryAddress ?? (first.bank === undefined ? first.startAddress : SAM_CODE_DEFAULT_ADDRESS);
  if (entry < 0x4000 || entry > 0xffff) return { code: "entry", entry };
  return { blocks, entry, usesPage0 };
}

/** The placement's message for a problem (shown as the build's error) */
export function describeSamPlacementProblem(problem: SamPlacementProblem): string {
  const hex = (v: number) => v.toString(16).toUpperCase().padStart(4, "0");
  switch (problem.code) {
    case "empty":
      return "There is no code to run.";
    case "rom":
      return `Code at $${hex(problem.address)} would be in the ROM (0000h-3FFFh); SAM code goes at 4000h-FFFFh (8000h is page 1).`;
    case "badPage":
      return `Page ${problem.page} does not exist on a SAM Coupé (pages 0-31).`;
    default:
      return `The entry point $${hex(problem.entry)} is in the ROM; it must be in 4000h-FFFFh.`;
  }
}

/**
 * The placement as one contiguous file for the boot loader and the export: from the lowest page/offset to
 * the highest, gaps filled with zeros. Returns the start page, offset (8000h-BFFFh form) and the bytes.
 */
export function samLinearImage(placement: SamPlacement): { startPage: number; startOffset: number; data: Uint8Array } {
  const linear = (b: SamPagedBlock) => b.page * 0x4000 + b.offset;
  const start = Math.min(...placement.blocks.map(linear));
  const end = Math.max(...placement.blocks.map((b) => linear(b) + b.bytes.length));
  const data = new Uint8Array(end - start);
  for (const b of placement.blocks) data.set(b.bytes, linear(b) - start);
  return { startPage: Math.floor(start / 0x4000), startOffset: 0x8000 + (start & 0x3fff), data };
}

/** The page and 8000h-form offset of a CPU address under Run's paging (the exec address of a file) */
export function samExecPageForm(address: number): { page: number; offset: number } {
  const page = samRunPageOf(address) ?? 0;
  return { page, offset: 0x8000 + (address & 0x3fff) };
}
