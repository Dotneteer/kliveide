import type {
  NexAnnotationRegion,
  NexAnnotationRegionType,
  NexFileAnnotations
} from "./nexAnnotations";
import { getBankAnnotation, getNexBankAddressOffset, NEX_BANK_SIZE } from "./nexAnnotations";

/*
 * What the NEX viewer's bank browser says about each bank, derived without a DOM.
 *
 * Everything here reads the bank's bytes and the annotation model; nothing decides how it is drawn.
 */

/** Bytes of a bank per region type. Sums to the bank size (regions cover it completely). */
export type NexBankContentMix = Record<NexAnnotationRegionType, number>;

export const NEX_REGION_TYPES: NexAnnotationRegionType[] = ["disassemble", "bytes", "words", "skip"];

export function bankContentMix(regions: NexAnnotationRegion[] | undefined): NexBankContentMix {
  const mix: NexBankContentMix = { disassemble: 0, bytes: 0, words: 0, skip: 0 };
  for (const region of regions ?? []) {
    const start = Math.max(0, region.start);
    const end = Math.min(NEX_BANK_SIZE - 1, region.end);
    if (end >= start) mix[region.type] += end - start + 1;
  }
  return mix;
}

/** A share of the bank, as a whole percentage, for display. */
export function contentMixPercent(mix: NexBankContentMix, type: NexAnnotationRegionType): number {
  const total = NEX_REGION_TYPES.reduce((sum, t) => sum + mix[t], 0);
  return total ? Math.round((mix[type] * 100) / total) : 0;
}

/** A label that lands in a bank, with the address it is listed at. */
export type NexBankLabel = {
  name: string;
  address: number;
  scope: "global" | "local";
};

/**
 * The labels that name places in this bank, in address order.
 *
 * Local labels always belong to it, at the bank's listing address plus their offset. A global label
 * belongs to it when its 16-bit value falls in the window the bank is listed at — the same window the
 * pop-out's disassembly shows, so the labels here are the ones that appear there.
 */
export function bankLabels(
  annotations: NexFileAnnotations | undefined,
  bank: number,
  listedAt: number
): NexBankLabel[] {
  if (!annotations) return [];
  const bankAnnotation = getBankAnnotation(annotations, bank);
  const base = bankAnnotation ? getNexBankAddressOffset(bankAnnotation.offsetIndex) : listedAt;
  const labels: NexBankLabel[] = [
    ...(bankAnnotation?.localLabels ?? []).map((label) => ({
      name: label.name,
      address: (base + label.value) & 0xffff,
      scope: "local" as const
    })),
    ...(annotations.globalLabels ?? [])
      .filter((label) => label.value >= base && label.value < base + NEX_BANK_SIZE)
      .map((label) => ({ name: label.name, address: label.value, scope: "global" as const }))
  ];
  return labels.sort((a, b) => a.address - b.address || a.name.localeCompare(b.name));
}

/** A bank whose every byte is zero: loaded, but holding nothing. */
export function isEmptyBank(bytes: ArrayLike<number>): boolean {
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] !== 0) return false;
  }
  return true;
}

/**
 * Whether the annotation file says anything about this bank beyond its defaults: a comment, a local
 * label, or regions other than the single whole-bank disassembly a new sidecar starts with.
 */
export function isAnnotatedBank(annotations: NexFileAnnotations | undefined, bank: number): boolean {
  const bankAnnotation = annotations ? getBankAnnotation(annotations, bank) : undefined;
  if (!bankAnnotation) return false;
  if (bankAnnotation.comment) return true;
  if (bankAnnotation.localLabels?.length) return true;
  const regions = bankAnnotation.regions;
  return !(
    regions.length === 1 &&
    regions[0].type === "disassemble" &&
    regions[0].start === 0 &&
    regions[0].end === NEX_BANK_SIZE - 1
  );
}
