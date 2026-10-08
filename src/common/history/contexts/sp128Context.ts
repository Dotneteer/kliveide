/*
 * The 16-byte history context of the 128K core (`sp128HistoryContext` at the end of `sp128.c`,
 * `.plans/EXECUTION_HISTORY_ALL_CORES_PLAN.md` §3), shared by the ZX Spectrum 128K, the Pentagon 128
 * and the Scorpion ZS-256 (D5):
 *   0    port $7FFD   1 the selected ROM   2 the selected RAM bank
 *   3    bit 0 the Beta 128 has TR-DOS paged in, bit 1 paging is locked
 *   4    the timing profile (0 128K, 1 Pentagon, 2 Scorpion)   5 the Scorpion's port $1FFD
 *   8-11 the partition of each 16K slot, a signed byte, as the live machine's `getPartition` names
 *        it - so the decoder needs no rule of its own for TR-DOS or the Scorpion's maps (D4)
 */

const PROFILES = ["128K", "Pentagon", "Scorpion"];

export type Sp128HistoryContext = {
  port7ffd: number;
  selectedRom: number;
  selectedBank: number;
  trdosPaged: boolean;
  pagingLocked: boolean;
  profile: number;
  port1ffd: number;
  /** The partition of each 16K slot */
  slots: number[];
};

export function decodeSp128Context(context: Uint8Array): Sp128HistoryContext {
  return {
    port7ffd: context[0],
    selectedRom: context[1],
    selectedBank: context[2],
    trdosPaged: (context[3] & 0x01) !== 0,
    pagingLocked: (context[3] & 0x02) !== 0,
    profile: context[4],
    port1ffd: context[5],
    slots: [0, 1, 2, 3].map((slot) => signed(context[8 + slot]))
  };
}

export function sp128PartitionFor(context: Uint8Array, address: number): number | undefined {
  return signed(context[8 + ((address >>> 14) & 0x03)]);
}

export function describeSp128Context(context: Uint8Array, partitionLabels: Record<number, string> = {}): string {
  const c = decodeSp128Context(context);
  const label = (p: number) => partitionLabels[p] ?? String(p);
  const parts = [
    `Slots ${c.slots.map((p, i) => `${i}:${label(p)}`).join(" ")}`,
    c.profile === 2 ? `$7FFD=${hex2(c.port7ffd)} $1FFD=${hex2(c.port1ffd)}` : `$7FFD=${hex2(c.port7ffd)}`
  ];
  if (c.trdosPaged) parts.push("TR-DOS paged in");
  if (c.pagingLocked) parts.push("paging locked");
  parts.push(PROFILES[c.profile] ?? `profile ${c.profile}`);
  return parts.join(" · ");
}

function signed(byte: number): number {
  return byte >= 0x80 ? byte - 0x100 : byte;
}

function hex2(value: number): string {
  return `$${value.toString(16).toUpperCase().padStart(2, "0")}`;
}
