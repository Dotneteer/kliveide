import { HistoryKind, type HistoryRecord } from "../historyRecord";

/*
 * The ZX Spectrum Next's 16-byte history context (written by `zxnextHistoryContext` and
 * `zxnextHistoryDmaHold` at the end of `zxnext.c`; `.plans/EXECUTION_HISTORY_VIEWER_PLAN.md` §4.3).
 *
 * An instruction's context carries the *partition* of each 8K slot as the Next's `getPartition`
 * returns it, not the raw MMU registers: ROM, DivMMC, Multiface and Alt ROM overlay slots 0-1
 * whatever MMU0/1 say, and the partition is what source mapping needs (trap T13). It is captured
 * before the opcode fetch, so it names the memory the fetch read.
 */

/** The byte that stands for "no partition" */
const NO_PARTITION = 224;

/** A decoded instruction context */
export type ZxNextHistoryContext = {
  /** The partition of each 8K slot (`undefined`: nothing a partition names is paged there) */
  slots: (number | undefined)[];
  port7ffd: number;
  port1ffd: number;
  portDffd: number;
  divMmcE3: number;
  divMmcMapped: boolean;
  multifacePaged: boolean;
  altRom: boolean;
  romInSlot0: boolean;
  /** NextReg $07 effective speed: 0 = 3.5 MHz ... 3 = 28 MHz */
  cpuSpeed: number;
};

/** A decoded DMA hold context */
export type ZxNextDmaHoldContext = {
  source: number;
  destination: number;
  /** Bytes the transfer still has to move */
  left: number;
  aToB: boolean;
  burst: boolean;
  sourceIsIo: boolean;
  destinationIsIo: boolean;
};

/** Decodes one slot byte into a partition */
export function decodeZxNextSlot(byte: number): number | undefined {
  if (byte < NO_PARTITION) return byte;
  if (byte >= 233) return byte - 256;
  return undefined;
}

export function decodeZxNextContext(context: Uint8Array): ZxNextHistoryContext {
  const flags = context[12];
  return {
    slots: Array.from({ length: 8 }, (_, i) => decodeZxNextSlot(context[i])),
    port7ffd: context[8],
    port1ffd: context[9],
    portDffd: context[10],
    divMmcE3: context[11],
    divMmcMapped: (flags & 0x01) !== 0,
    multifacePaged: (flags & 0x02) !== 0,
    altRom: (flags & 0x04) !== 0,
    romInSlot0: (flags & 0x08) !== 0,
    cpuSpeed: context[13] & 0x03
  };
}

export function decodeZxNextDmaHold(context: Uint8Array): ZxNextDmaHoldContext {
  const flags = context[6];
  return {
    source: context[0] | (context[1] << 8),
    destination: context[2] | (context[3] << 8),
    left: context[4] | (context[5] << 8),
    aToB: (flags & 0x01) !== 0,
    burst: (flags & 0x02) !== 0,
    sourceIsIo: (flags & 0x04) !== 0,
    destinationIsIo: (flags & 0x08) !== 0
  };
}

/**
 * The partition an address was in when the record was made - what the live machine's
 * `getPartition(address)` returned at that moment
 */
export function zxNextPartitionFor(context: Uint8Array, address: number): number | undefined {
  return decodeZxNextSlot(context[(address >>> 13) & 0x07]);
}

const SPEEDS = ["3.5 MHz", "7 MHz", "14 MHz", "28 MHz"];

/** The detail pane's description of an instruction context */
export function describeZxNextContext(context: Uint8Array, partitionLabels: Record<number, string> = {}): string {
  const c = decodeZxNextContext(context);
  const slot = (p: number | undefined) => (p === undefined ? "--" : (partitionLabels[p] ?? String(p)));
  const parts = [
    `Slots ${c.slots.map((p, i) => `${i}:${slot(p)}`).join(" ")}`,
    `$7FFD=${hex2(c.port7ffd)} $1FFD=${hex2(c.port1ffd)} $DFFD=${hex2(c.portDffd)}`,
    `DivMMC ${c.divMmcMapped ? "mapped" : "off"} ($E3=${hex2(c.divMmcE3)})`
  ];
  if (c.multifacePaged) parts.push("Multiface paged");
  if (c.altRom) parts.push("Alt ROM");
  parts.push(SPEEDS[c.cpuSpeed]);
  return parts.join(" · ");
}

/** The row text of a DMA hold (D15): "DMA held the bus for 3,072 T ($4000 → $C000, 0 left)" */
export function describeZxNextDmaHold(record: Pick<HistoryRecord, "repeat" | "context" | "kind">): string {
  if (record.kind !== HistoryKind.DmaHold) return "";
  const d = decodeZxNextDmaHold(record.context);
  const port = (address: number, io: boolean) => (io ? `port $${hex4(address)}` : `$${hex4(address)}`);
  return (
    `DMA held the bus for ${record.repeat.toLocaleString("en-US")} T ` +
    `(${port(d.source, d.sourceIsIo)} → ${port(d.destination, d.destinationIsIo)}, ${d.left.toLocaleString("en-US")} left)`
  );
}

function hex2(value: number): string {
  return `$${value.toString(16).toUpperCase().padStart(2, "0")}`;
}

function hex4(value: number): string {
  return value.toString(16).toUpperCase().padStart(4, "0");
}
