import type { NexAnnotationOffsetIndex } from "./nexAnnotations";
import type { NexHeader } from "./nexFileLoader";

/*
 * Where a NEX file's banks are when it starts running.
 *
 * A NEX is loaded by NextZXOS, which pages three of its banks into fixed places before handing over:
 * bank 5 at `$4000`, bank 2 at `$8000`, and the header's entry bank at `$C000`. That is the map the
 * viewer uses to label a bank with the address it will be seen at, and the map a breakpoint at the
 * NEX's entry point has to be resolved through.
 *
 * These lived inside `NexFileViewerPanel.tsx` — private to a React component, even though they are
 * facts about the file format. They were moved out because three other things need the same answer:
 * the entry-point stop, the pre-launch validation, and the live bank view.
 *
 * See `.plans/NEX_DEBUGGING_PLAN.md` §11.1.
 */

/** The 16K bank NextZXOS pages into `$4000` for a NEX. */
export const NEX_SLOT_1_BANK = 5;
/** The 16K bank NextZXOS pages into `$8000` for a NEX. */
export const NEX_SLOT_2_BANK = 2;

export const NEX_SLOT_1_START = 0x4000;
export const NEX_SLOT_2_START = 0x8000;
export const NEX_SLOT_3_START = 0xc000;

/**
 * The bank visible at a Z80 address when the NEX starts, or `undefined` below `$4000`.
 *
 * Nothing of the file is at `$0000..$3FFF`: that is ROM when the program is handed control, which is
 * why an entry point down there is not something a bank breakpoint can name.
 */
export function getMappedBankForAddress(
  header: NexHeader,
  address: number
): number | undefined {
  const normalizedAddress = address & 0xffff;
  if (normalizedAddress < NEX_SLOT_1_START) {
    return undefined;
  }
  if (normalizedAddress < NEX_SLOT_2_START) {
    return NEX_SLOT_1_BANK;
  }
  if (normalizedAddress < NEX_SLOT_3_START) {
    return NEX_SLOT_2_BANK;
  }
  return header.entryBank;
}

/** The address a bank will be seen at when the NEX starts; `$0000` for one that is not paged in. */
export function getDefaultDisassemblyOffsetForBank(bank: number, header: NexHeader): number {
  if (bank === header.entryBank) {
    return NEX_SLOT_3_START;
  }
  if (bank === NEX_SLOT_1_BANK) {
    return NEX_SLOT_1_START;
  }
  if (bank === NEX_SLOT_2_BANK) {
    return NEX_SLOT_2_START;
  }
  return 0x0000;
}

/** The same answer as the sidecar's `offsetIndex`: the 16K slot, 0 to 3. */
export function getDefaultDisassemblyOffsetIndexForBank(
  bank: number,
  header: NexHeader
): NexAnnotationOffsetIndex {
  return (getDefaultDisassemblyOffsetForBank(bank, header) / 0x4000) as NexAnnotationOffsetIndex;
}

/** The bank the program counter points into when the NEX starts. */
export function getProgramCounterBank(header: NexHeader): number | undefined {
  return getMappedBankForAddress(header, header.programCounter);
}

/** The bank the stack pointer points into when the NEX starts. */
export function getStackPointerBank(header: NexHeader): number | undefined {
  return getMappedBankForAddress(header, header.stackPointer);
}

/**
 * Where a breakpoint on the NEX's entry point goes: a bank, and an offset inside it.
 *
 * `undefined` when the entry point is below `$4000` — that is ROM at hand-over, so there is no bank
 * of the file to break in, and asking for a stop there would arm a breakpoint that could never fire
 * on the program's own code.
 */
export function getEntryPointBreakpointSite(
  header: NexHeader
): { bank: number; bankOffset: number } | undefined {
  const bank = getProgramCounterBank(header);
  if (bank === undefined) return undefined;
  return { bank, bankOffset: header.programCounter & 0x3fff };
}
