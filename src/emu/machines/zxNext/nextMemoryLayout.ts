/*
 * The ZX Spectrum Next's physical memory layout and the paging facts derived from it.
 *
 * Neutral: shared by both cores (the TypeScript `MemoryDevice` and the WASM machine, whose C core uses
 * the same layout), the IDE and the tests. Nothing here depends on either emulator.
 */

/* Offsets of the memory areas in the Next's flat physical memory */
export const OFFS_NEXT_ROM = 0x00_0000;
export const OFFS_DIVMMC_ROM = 0x01_0000;
export const OFFS_MULTIFACE_MEM = 0x01_4000;
export const OFFS_ALT_ROM_0 = 0x01_8000;
export const OFFS_ALT_ROM_1 = 0x01_c000;
export const OFFS_DIVMMC_RAM = 0x02_0000;
export const OFFS_DIVMMC_RAM_BANK_3 = 0x02_0000 + (3 << 13);
export const OFFS_NEXT_RAM = 0x04_0000;
export const OFFS_BANK_05 = 0x05_4000; // Bank 5 (normal screen) = OFFS_NEXT_RAM + (5 << 14)
export const OFFS_BANK_07 = 0x05_c000; // Bank 7 (shadow screen) = OFFS_NEXT_RAM + (7 << 14)
export const OFFS_ERR_PAGE = 2048 * 1024;

/**
 * The label for an 8K page that is not backed by any partition.
 *
 * Not a partition, so it has no index and no entry in `getPartitionLabels()`; this is the bank
 * column's empty state. See `.plans/PARTITION_NAMING_UNIFICATION_PLAN.md` §8, decision 1.
 */
export const UNPAGED_PARTITION_LABEL = "UN";

/**
 * The four 16K banks visible in **all-RAM mode**, or `undefined` when the machine is not in it.
 *
 * The ZX Spectrum +3's special paging configurations, which the Next inherits: with all-RAM mode on,
 * the two configuration bits pick one of four fixed arrangements of RAM banks across the whole 64K,
 * ROM included.
 *
 * A pure function of the reported `$1FFD` value rather than a method, because **two** machines have
 * to answer it — the interpreted `MemoryDevice` from its own state, and the WASM Next from the
 * core's stored `$1FFD`. Only the first ever did, so the Memory Mapping panel's "All RAM" row read
 * `Off` on the machine people actually run.
 *
 * The encoding is the stored `$1FFD` value: all-RAM mode in bit 0, the configuration in bits 1-2.
 */
export function allRamBanksFor(port1ffdValue: number): number[] | undefined {
  if (!(port1ffdValue & 0x01)) return undefined;
  switch ((port1ffdValue >> 1) & 0x03) {
    case 0:
      return [0, 1, 2, 3];
    case 1:
      return [4, 5, 6, 7];
    case 2:
      return [4, 5, 6, 3];
    default:
      return [4, 7, 6, 3];
  }
}

/**
 * The **16K bank** to report for a page, given the partition mapped there.
 *
 * A Next partition is an 8K page (Q9), so a 16K bank is `partition >> 1`. The interpreted
 * `MemoryDevice` has always reported it that way — `setPageInfo(..., bank8k >> 1, bank8k)` — but the
 * WASM Next passed the partition index straight through, so its page rows printed the *8K* number
 * under a field named `bank16k`. The Memory Mapping panel shows both columns, which meant the same
 * number twice with one of them labelled "16K bank".
 *
 * Negative partitions (the ROMs, the alt ROMs, DivMMC) are passed through unchanged: they are not
 * RAM banks and have no 16K bank, and the panel renders anything negative as `--`. `undefined` — an
 * unpaged page — becomes `0xff`, the placeholder the interpreted machine uses for the same case.
 */
export function bank16kForPartition(partition: number | undefined): number {
  if (partition === undefined) return 0xff;
  return partition >= 0 ? partition >> 1 : partition;
}

/** Memory information about an 8K page: offsets into the Next's physical memory, and its banks. */
export type MemoryPageInfo = {
  readOffset: number;
  writeOffset: number | null;
  bank16k?: number;
  bank8k?: number;
};
