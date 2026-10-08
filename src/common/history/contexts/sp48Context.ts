/*
 * The ZX Spectrum 48K/16K's 16-byte history context (`sp48HistoryContext` at the end of `sp48.c`,
 * `.plans/EXECUTION_HISTORY_ALL_CORES_PLAN.md` §3): byte 0 is the model (0 16K, 1 48K); the rest
 * is zero. The 48K has no paging, so no address is in a partition - as the live machine's
 * `getPartition` says (D4).
 */

export function sp48PartitionFor(_context: Uint8Array, _address: number): number | undefined {
  return undefined;
}

export function describeSp48Context(context: Uint8Array): string {
  return context[0] === 0 ? "ZX Spectrum 16K" : "ZX Spectrum 48K";
}
