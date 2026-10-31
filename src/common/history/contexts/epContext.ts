/*
 * The Enterprise 64/128's 16-byte history context (`epHistoryContext` in `ep.c`,
 * `.plans/ENTERPRISE_PLAN.md` §11):
 *   0-3  the page registers B0h-B3h: the segment each 16K page showed
 *   4    bit 0 the Enterprise 128
 *   5    DAVE's BFh as last written
 *
 * The partitions are the machine's segments, numbered as DAVE numbers them (0-255,
 * `EpWasmV2Machine.getPartitionLabels`), so an address's partition is its page register.
 */

export type EpHistoryContext = {
  /** The segment each 16K page showed */
  pages: [number, number, number, number];
  is128: boolean;
  bf: number;
};

export function decodeEpContext(context: Uint8Array): EpHistoryContext {
  return {
    pages: [context[0], context[1], context[2], context[3]],
    is128: (context[4] & 0x01) !== 0,
    bf: context[5]
  };
}

/** The segment the page register of an address held */
export function epPartitionFor(context: Uint8Array, address: number): number | undefined {
  return context[((address & 0xffff) >> 14) & 3];
}

function hex2(value: number): string {
  return value.toString(16).toUpperCase().padStart(2, "0");
}

export function describeEpContext(context: Uint8Array, partitionLabels?: Record<number, string>): string {
  const c = decodeEpContext(context);
  const pages = c.pages.map((segment) => partitionLabels?.[segment] ?? hex2(segment)).join(" ");
  return `Enterprise ${c.is128 ? "128" : "64"} BF ${hex2(c.bf)}h [${pages}]`;
}
