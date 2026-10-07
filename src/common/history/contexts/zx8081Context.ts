/*
 * The ZX80/ZX81's 16-byte history context (`zx8081HistoryContext` at the end of `zx8081.c`,
 * `.plans/EXECUTION_HISTORY_ALL_CORES_PLAN.md` §3):
 *   0    bits 0-1 the RAM (0 1K, 1 16K, 3 64K), bit 4 the ZX81 ULA, bit 5 the 8K ZX81 ROM, bit 6 NTSC
 *   1    bit 0 the ZX81's NMI generator is on (the ROM's SLOW mode while it shows a picture)
 * There is no banking: no address is in a partition, as the live machine's `getPartition` says (D4).
 */

const RAM = ["1K", "16K", "32K", "64K"];

export type Zx8081HistoryContext = {
  ram: string;
  zx81Ula: boolean;
  zx81Rom: boolean;
  ntsc: boolean;
  nmiGenerator: boolean;
};

export function decodeZx8081Context(context: Uint8Array): Zx8081HistoryContext {
  return {
    ram: RAM[context[0] & 0x03],
    zx81Ula: (context[0] & 0x10) !== 0,
    zx81Rom: (context[0] & 0x20) !== 0,
    ntsc: (context[0] & 0x40) !== 0,
    nmiGenerator: (context[1] & 0x01) !== 0
  };
}

export function zx8081PartitionFor(_context: Uint8Array, _address: number): number | undefined {
  return undefined;
}

export function describeZx8081Context(context: Uint8Array): string {
  const c = decodeZx8081Context(context);
  const parts = [`${c.zx81Ula ? "ZX81" : "ZX80"} ${c.ram}${c.zx81Ula === c.zx81Rom ? "" : c.zx81Rom ? ", 8K ROM" : ", 4K ROM"}`];
  if (c.zx81Ula) parts.push(c.nmiGenerator ? "NMI generator on (SLOW)" : "NMI generator off");
  if (c.ntsc) parts.push("NTSC");
  return parts.join(" · ");
}
