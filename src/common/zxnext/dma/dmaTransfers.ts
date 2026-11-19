/*
 * The DMA Transfers (`dev/plans/NEXT_DMA_DEBUGGING_PLAN.md` §14): the core's ring of transfers, decoded,
 * and the address ranges each one read and wrote. Pure: shared by the emulator process (which copies
 * the ring) and the renderer. The record layout is `zxnext-dma.c`'s (`zxnextDmaXferBegin`).
 */

export const NEXT_DMA_TRANSFER_RECORD_SIZE = 64;

/** The ring's records as the machine hands them over (`IZxNextIdeMachine.getDmaTransfers`) */
export type NextDmaTransfers = {
  enabled: boolean;
  capacity: number;
  /** Transfers started since the last clear (only ever grows) */
  count: number;
  /** The sequence number of the first record in `records` */
  firstSeq: number;
  records: Uint8Array;
};

/** How a transfer ended; "running" while it has not */
/** "stopped": the recording was switched off while it ran */
export type DmaTransferEnd = "running" | "endOfBlock" | "disabled" | "reset" | "machineReset" | "stopped";
const END_KINDS: DmaTransferEnd[] = ["running", "endOfBlock", "disabled", "reset", "machineReset", "stopped"];

/** The DMA's address modes (WR1/WR2 D5-D4): 0 decrement, 1 increment, 2 and 3 fixed */
export type DmaAddressMode = "decrement" | "increment" | "fixed";
const ADDRESS_MODES: DmaAddressMode[] = ["decrement", "increment", "fixed", "fixed"];

/** WR4 D6-D5: 0 byte, 1 continuous, 2 burst (3 behaves as continuous on the Next) */
export type DmaTransferMode = "byte" | "continuous" | "burst";
const TRANSFER_MODES: DmaTransferMode[] = ["byte", "continuous", "burst", "continuous"];

export type DmaTransferPort = {
  start: number;
  io: boolean;
  mode: DmaAddressMode;
};

/** zxnDDMA's mode flags ($DF) */
export const DDMA_PHYSICAL = 0x01;
export const DDMA_2D = 0x02;
export const DDMA_TRANSPARENT = 0x04;
export const DDMA_FILL = 0x08;

export type DmaTransfer = {
  /** The transfer's number since the ring was cleared */
  seq: number;
  frame: number;
  /** The enable's position in its frame, 28 MHz clocks */
  pos28: number;
  /** Where it ended; undefined while running */
  endFrame?: number;
  endPos28?: number;
  /** Bytes moved, every block of an auto-restarting transfer included */
  bytes: number;
  /** 28 MHz clocks the DMA held the bus for it */
  held28: number;
  portA: DmaTransferPort;
  portB: DmaTransferPort;
  /** The block length as written (WR0) */
  length: number;
  /** The enabling instruction's address; undefined when the host enabled it or it was joined */
  pc?: number;
  /** It was already running when the recording started: its PC and the bytes before are unknown */
  joined: boolean;
  aToB: boolean;
  mode: DmaTransferMode;
  autoRestart: boolean;
  /** Programmed through $0B (Zilog mode: a block is length + 1 bytes) */
  zilog: boolean;
  /** A pulse-mode interrupt began and ended while it held the bus: the CPU never saw it */
  intLost: boolean;
  /** Enabled with start addresses written after the last load: it used the old working addresses */
  notLoaded: boolean;
  prescaler: number;
  end: DmaTransferEnd;
  /** Blocks restarted by auto restart (saturates at 255) */
  restarts: number;
  /** zxnDDMA's flags and parameters (0 on a core without it) */
  ddma: {
    flags: number;
    extA: number;
    extB: number;
    fill: number;
    rowLength: number;
    rowCount: number;
    strideA: number;
    strideB: number;
  };
  /** The CPU speed at the enable: 0 = 3.5 MHz ... 3 = 28 MHz */
  speed: number;
};

export function decodeDmaTransfers(t: Pick<NextDmaTransfers, "records" | "firstSeq">): DmaTransfer[] {
  const b = t.records;
  const n = Math.floor(b.length / NEXT_DMA_TRANSFER_RECORD_SIZE);
  const out: DmaTransfer[] = [];
  for (let i = 0; i < n; i++) {
    const o = i * NEXT_DMA_TRANSFER_RECORD_SIZE;
    const u16 = (at: number) => b[o + at] | (b[o + at + 1] << 8);
    const u32 = (at: number) => (u16(at) | (u16(at + 2) << 16)) >>> 0;
    const port = (cfg: number, start: number): DmaTransferPort => ({
      start,
      io: (cfg & 0x01) !== 0,
      mode: ADDRESS_MODES[(cfg >> 1) & 0x03]
    });
    const flags = b[o + 34];
    const end = END_KINDS[b[o + 36]] ?? "running";
    out.push({
      seq: t.firstSeq + i,
      frame: u32(0),
      pos28: u32(4),
      endFrame: end === "running" ? undefined : u32(8),
      endPos28: end === "running" ? undefined : u32(12),
      bytes: u32(16),
      held28: u32(20),
      portA: port(b[o + 32], u16(24)),
      portB: port(b[o + 33], u16(26)),
      length: u16(28),
      pc: flags & 0x20 || b[o + 47] & 0x01 ? undefined : u16(30),
      joined: (b[o + 47] & 0x01) !== 0,
      aToB: (flags & 0x01) !== 0,
      mode: TRANSFER_MODES[(flags >> 1) & 0x03],
      autoRestart: (flags & 0x08) !== 0,
      zilog: (flags & 0x10) !== 0,
      intLost: (flags & 0x40) !== 0,
      notLoaded: (flags & 0x80) !== 0,
      prescaler: b[o + 35],
      end,
      restarts: b[o + 37],
      ddma: {
        flags: b[o + 38],
        extA: b[o + 39],
        extB: b[o + 40],
        fill: b[o + 41],
        rowLength: u16(42),
        rowCount: u16(44),
        strideA: u16(48),
        strideB: u16(50)
      },
      speed: b[o + 46] & 0x03
    });
  }
  return out;
}

/** 28 MHz clocks to CPU T-states at a speed (a T-state is 8 >> speed clocks) */
export const xferClocksToT = (clocks: number, speed: number) => clocks / (8 >> (speed & 0x03));

/** The source and destination of a transfer */
export const sourcePort = (t: DmaTransfer) => (t.aToB ? t.portA : t.portB);
export const destPort = (t: DmaTransfer) => (t.aToB ? t.portB : t.portA);

/** Bytes in one block: Zilog mode moves length + 1, a zxnDDMA rectangle row length x rows */
export function blockBytes(t: DmaTransfer): number {
  if (t.ddma.flags & DDMA_2D) return Math.max(1, t.ddma.rowLength) * Math.max(1, t.ddma.rowCount);
  return t.zilog ? t.length + 1 : t.length;
}

/** An inclusive address range; 24-bit in physical mode, 16-bit otherwise */
export type DmaRange = { from: number; to: number };

/** What one side of a transfer touched */
export type DmaSide =
  | { kind: "port"; port: number }
  | { kind: "fill"; value: number }
  | { kind: "memory"; physical: boolean; ranges: DmaRange[] };

/** The ranges `count` bytes from `start` cover, stepping by `mode`, wrapped at `size` */
function stepRanges(start: number, count: number, mode: DmaAddressMode, size: number): DmaRange[] {
  if (count <= 0) return [];
  if (mode === "fixed") return [{ from: start, to: start }];
  const n = Math.min(count, size);
  if (mode === "increment") {
    const to = start + n - 1;
    return to < size ? [{ from: start, to }] : [{ from: start, to: size - 1 }, { from: 0, to: to - size }];
  }
  const from = start - n + 1;
  return from >= 0 ? [{ from, to: start }] : [{ from: 0, to: start }, { from: size + from, to: size - 1 }];
}

/** Merges overlapping and adjacent ranges */
function mergeRanges(ranges: DmaRange[]): DmaRange[] {
  const sorted = [...ranges].sort((a, b) => a.from - b.from);
  const out: DmaRange[] = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r.from <= last.to + 1) last.to = Math.max(last.to, r.to);
    else out.push({ ...r });
  }
  return out;
}

/**
 * What one side touched: its port, the fill value, or the memory ranges of the bytes moved so far (one
 * block's worth once a block has restarted). A rectangle's rows step by the side's stride.
 */
function sideOf(t: DmaTransfer, source: boolean, blockMoved?: number): DmaSide {
  const p = source ? sourcePort(t) : destPort(t);
  if (source && t.ddma.flags & DDMA_FILL) return { kind: "fill", value: t.ddma.fill };
  if (p.io) return { kind: "port", port: p.start };
  const physical = (t.ddma.flags & DDMA_PHYSICAL) !== 0;
  const isA = source === t.aToB;
  const start = physical ? (((isA ? t.ddma.extA : t.ddma.extB) & 0x3f) << 16) | p.start : p.start;
  const size = physical ? 0x400000 : 0x10000;
  const moved =
    blockMoved !== undefined ? blockMoved : t.restarts > 0 ? blockBytes(t) : Math.min(t.bytes, Math.max(1, blockBytes(t)));
  if (!(t.ddma.flags & DDMA_2D)) return { kind: "memory", physical, ranges: stepRanges(start, moved, p.mode, size) };
  const rowLength = Math.max(1, t.ddma.rowLength);
  const stride = isA ? t.ddma.strideA : t.ddma.strideB;
  const ranges: DmaRange[] = [];
  for (let row = 0, left = moved; left > 0; row++, left -= rowLength) {
    const rowStart = (start + row * stride) % size;
    ranges.push(...stepRanges(rowStart, Math.min(left, rowLength), p.mode, size));
  }
  return { kind: "memory", physical, ranges: mergeRanges(ranges) };
}

/** What the source and destination touched; `blockMoved` limits them to the block under way's bytes */
export const transferSource = (t: DmaTransfer, blockMoved?: number) => sideOf(t, true, blockMoved);
export const transferDestination = (t: DmaTransfer, blockMoved?: number) => sideOf(t, false, blockMoved);

/**
 * What the Memory panel tints for a selected transfer (§14.2): the 16-bit ranges it read and wrote, and
 * while it runs the working addresses (`next`). A running transfer shows the block under way only, up to
 * the byte the DMA's counter has reached (`working.blockMoved`), so an auto-restarting one shows its
 * progress. Physical (zxnDDMA) ranges and ports are left out.
 */
export type DmaMemoryOverlay = {
  seq: number;
  read: DmaRange[];
  written: DmaRange[];
  nextRead?: number;
  nextWrite?: number;
};

export function memoryOverlayOf(
  t: DmaTransfer,
  working?: { source: number; destination: number; blockMoved?: number }
): DmaMemoryOverlay {
  const running = t.end === "running";
  const blockMoved = running ? working?.blockMoved : undefined;
  const src = transferSource(t, blockMoved);
  const dst = transferDestination(t, blockMoved);
  const cpuRanges = (s: DmaSide) => (s.kind === "memory" && !s.physical ? s.ranges : []);
  return {
    seq: t.seq,
    read: cpuRanges(src),
    written: cpuRanges(dst),
    nextRead: running && src.kind === "memory" && !src.physical ? working?.source : undefined,
    nextWrite: running && dst.kind === "memory" && !dst.physical ? working?.destination : undefined
  };
}

/** The last transfer that wrote `address` (a CPU address), newest first; undefined when none did */
export function lastTransferWriting(transfers: readonly DmaTransfer[], address: number): DmaTransfer | undefined {
  for (let i = transfers.length - 1; i >= 0; i--) {
    const d = transferDestination(transfers[i]);
    if (d.kind === "memory" && !d.physical && d.ranges.some((r) => address >= r.from && address <= r.to)) {
      return transfers[i];
    }
  }
  return undefined;
}
