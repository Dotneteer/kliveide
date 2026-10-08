/*
 * The 16-byte history context of the +2A/+3/+2E/+3E core (`spp3eHistoryContext` at the end of
 * `spp3e.c`, `.plans/EXECUTION_HISTORY_ALL_CORES_PLAN.md` §3):
 *   0    port $7FFD   1 port $1FFD
 *   2-5  the partition of each 16K slot, a signed byte (the core's own partition table, which is
 *        what the live machine's `getPartition` returns, special paging included - D4)
 *   6    bit 0 a special (all-RAM) paging mode is on
 */

export type SpP3eHistoryContext = {
  port7ffd: number;
  port1ffd: number;
  /** The partition of each 16K slot */
  slots: number[];
  specialPaging: boolean;
};

export function decodeSpP3eContext(context: Uint8Array): SpP3eHistoryContext {
  return {
    port7ffd: context[0],
    port1ffd: context[1],
    slots: [0, 1, 2, 3].map((slot) => signed(context[2 + slot])),
    specialPaging: (context[6] & 0x01) !== 0
  };
}

export function spp3ePartitionFor(context: Uint8Array, address: number): number | undefined {
  return signed(context[2 + ((address >>> 14) & 0x03)]);
}

export function describeSpP3eContext(context: Uint8Array, partitionLabels: Record<number, string> = {}): string {
  const c = decodeSpP3eContext(context);
  const label = (p: number) => partitionLabels[p] ?? String(p);
  const parts = [
    `Slots ${c.slots.map((p, i) => `${i}:${label(p)}`).join(" ")}`,
    `$7FFD=${hex2(c.port7ffd)} $1FFD=${hex2(c.port1ffd)}`
  ];
  if (c.specialPaging) parts.push("special paging");
  return parts.join(" · ");
}

function signed(byte: number): number {
  return byte >= 0x80 ? byte - 0x100 : byte;
}

function hex2(value: number): string {
  return `$${value.toString(16).toUpperCase().padStart(2, "0")}`;
}
