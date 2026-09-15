import type { DisassemblyOperandLabelResolver } from "@renderer/appIde/disassemblers/common-types";
import type { NexFileAnnotations } from "./nexAnnotations";

import { getBankAnnotation } from "./nexAnnotations";

/*
 * A NEX's hand-made labels, in the **live** disassembly.
 *
 * The annotated listing of a popped-out bank already names things: it knows which bank it is showing
 * and looks every operand up in that bank's label table. The live Disassembly view knows neither —
 * it works in Z80 addresses and its banks change under it — so the same routine that reads
 * `call DrawSprite` in the pop-out reads `call $C100` while the program is actually running, which
 * is the moment the name is worth most.
 *
 * What makes it possible is that the live view already resolves the current paging, as one 8K page
 * per slot (`resolveMem64kPartitions`). This module is the inverse of that map — address to bank
 * site — plus the lookup that turns a site into a name.
 *
 * Pure, so the whole decision is testable without a machine, a document or a listing. See
 * `.plans/NEX_DEBUGGING_PLAN.md` §13.1.
 */

/** Where a Z80 address falls, in the NEX's own terms. */
export type LiveBankSite = { bank: number; bankOffset: number };

/**
 * The 16K bank and offset a Z80 address is currently in, or `undefined` when nothing is paged there.
 *
 * The inverse of the live paging map. `mem64kPartitions` holds one **8K page** per 8K slot — that is
 * what a Next partition is, after Q9 — so the 16K bank is the page halved, and which half of the
 * bank the address is in is the page's low bit. Offsets within an 8K page and within a bank's half
 * are the same thing, which is why only that one bit has to be recovered.
 *
 * @param mem64kPartitions from `resolveMem64kPartitions`: eight entries, one per 8K slot
 */
export function bankSiteAtAddress(
  mem64kPartitions: (number | undefined)[] | undefined,
  address: number
): LiveBankSite | undefined {
  const slot = (address >> 13) & 0x07;
  const page = mem64kPartitions?.[slot];
  // --- A negative page is a ROM or DivMMC partition, which is not one of the NEX's banks.
  if (page === undefined || page < 0) return undefined;

  return {
    bank: page >> 1,
    bankOffset: (page & 0x01) * 0x2000 + (address & 0x1fff)
  };
}

/**
 * The label a NEX's annotations give this address, or `undefined`.
 *
 * A **global** label's value is a 16-bit address, so it is compared against the address as given —
 * it means the same thing whatever is paged in. A **local** label's value is bank-relative, so it
 * only applies while its bank is actually at that address, which is what makes this worth
 * recomputing as the program pages.
 *
 * Global wins when both match. It is the more specific claim of the two: a global label names one
 * place in the address space, while a local one names a place in a bank that could be anywhere.
 */
export function findNexLabelForAddress(
  annotations: NexFileAnnotations | undefined,
  mem64kPartitions: (number | undefined)[] | undefined,
  address: number
): string | undefined {
  if (!annotations) return undefined;

  const target = address & 0xffff;
  const global = annotations.globalLabels?.find((label) => label.value === target);
  if (global) return global.name;

  const site = bankSiteAtAddress(mem64kPartitions, target);
  if (!site) return undefined;

  return getBankAnnotation(annotations, site.bank)?.localLabels?.find(
    (label) => label.value === site.bankOffset
  )?.name;
}

/**
 * An operand resolver for the live view, backed by a NEX's annotations.
 *
 * Returns `undefined` for anything it cannot name, which leaves the disassembler's own rendering
 * alone — the resolver is asked about *every* 16-bit operand, most of which are not addresses of
 * anything at all.
 *
 * `undefined` for the whole resolver when there are no annotations to consult, so the caller can
 * pass it straight through: an absent resolver is cheaper than one that always declines, and it
 * keeps the live view byte-for-byte as it was when no NEX is loaded.
 */
export function createNexLiveOperandLabelResolver(
  annotations: NexFileAnnotations | undefined,
  mem64kPartitions: (number | undefined)[] | undefined
): DisassemblyOperandLabelResolver | undefined {
  if (!annotations) return undefined;

  return ({ operandValue }) =>
    operandValue === undefined
      ? undefined
      : findNexLabelForAddress(annotations, mem64kPartitions, operandValue);
}
