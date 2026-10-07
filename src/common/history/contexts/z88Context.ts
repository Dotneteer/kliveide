/*
 * The Cambridge Z88's 16-byte history context (`z88HistoryContext` at the end of `z88.c`,
 * `.plans/EXECUTION_HISTORY_ALL_CORES_PLAN.md` §3):
 *   0-3  SR0-SR3, the segment registers
 *   4-11 the bank behind each 8K page, which covers the split segment 0
 *   12   COM.RAMS (bit 2): bank $20 rather than $00 at $0000-$1FFF
 *
 * The Z88's `getPartition` names no partition yet, so neither does the decoder (D4); the banks are
 * in the detail pane's text instead.
 */

export type Z88HistoryContext = {
  segments: number[];
  /** The bank behind each 8K page */
  pageBanks: number[];
  rams: boolean;
};

export function decodeZ88Context(context: Uint8Array): Z88HistoryContext {
  return {
    segments: Array.from(context.subarray(0, 4)),
    pageBanks: Array.from(context.subarray(4, 12)),
    rams: (context[12] & 0x04) !== 0
  };
}

export function z88PartitionFor(_context: Uint8Array, _address: number): number | undefined {
  return undefined;
}

export function describeZ88Context(context: Uint8Array): string {
  const c = decodeZ88Context(context);
  const parts = [
    c.segments.map((bank, i) => `SR${i}=${hex2(bank)}`).join(" "),
    `Pages ${c.pageBanks.map((bank, i) => `${i}:${hex2(bank)}`).join(" ")}`
  ];
  if (c.rams) parts.push("RAMS");
  return parts.join(" · ");
}

function hex2(value: number): string {
  return `$${value.toString(16).toUpperCase().padStart(2, "0")}`;
}
