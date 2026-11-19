/*
 * The ZX Spectrum Next DMA as the IDE sees it (`dev/plans/NEXT_DMA_DEBUGGING_PLAN.md` §3.2): the DMA
 * panel's snapshot, its decoder, and the pure helpers the view model and the tests share. Pure: used by
 * the emulator process (which decodes) and the renderer (which reads the types).
 *
 * The byte layout is the core's (`zxnext-dma.c` `zxnextGetDmaStatePtr`);
 * `test/wasm/zxNext/wasm-next-dma-state.test.ts` pins it against it. The register meanings are those of
 * `dmaDecoder.ts` and of `dev/vendor/next-fpga/3.02.01/src/device/dma.vhd`.
 */

import type { DmaFieldRole } from "./dmaDecoder";

/** The snapshot's size in bytes */
export const NEXT_DMA_STATE_SIZE = 64;

/** The transfer state machine (`dmaSeq`) */
export type DmaSeq = "idle" | "start" | "transfer" | "burstWait";
const DMA_SEQS: DmaSeq[] = ["idle", "start", "transfer", "burstWait"];

/** The address step after each byte (WR1/WR2 D5-D4: 00 down, 01 up, 1x fixed) */
export type DmaAddressStep = "down" | "up" | "fixed";

/** The operating mode as written (WR4 D6-D5); `byte` behaves as `continuous` */
export type DmaOperatingMode = "byte" | "continuous" | "burst" | "reserved";
const DMA_OPERATING_MODES: DmaOperatingMode[] = ["byte", "continuous", "burst", "reserved"];

/** The read sequence's seven entries, numbered as the read mask's bits */
export const DMA_READ_ENTRIES = ["status", "counterLo", "counterHi", "portALo", "portAHi", "portBLo", "portBHi"] as const;
export type DmaReadEntry = (typeof DMA_READ_ENTRIES)[number];

/** The register write sequencer's states (`zxnext-dma.c` `DMA_WR_*`) */
export const DmaWrSeq = {
  Idle: 0,
  R0Byte0: 1,
  R0Byte1: 2,
  R0Byte2: 3,
  R0Byte3: 4,
  R1Byte0: 5,
  R1Byte1: 6,
  R2Byte0: 7,
  R2Byte1: 8,
  R3Byte0: 9,
  R3Byte1: 10,
  R4Byte0: 11,
  R4Byte1: 12,
  /** WR4 D4 without a port B address: no handler in dma.vhd, deaf until reset */
  R4Byte2Deaf: 13,
  R6Byte0: 14,
  /** The follow bytes of a zxnDDMA command (core 3.03) */
  Ddma: 15
} as const;

/** One DMA port as the panel shows it */
export type DmaPortState = {
  /** The start address WR0 (port A) or WR4 (port B) wrote */
  start: number;
  /** The working address: where the next byte comes from or goes to */
  working: number;
  isIo: boolean;
  step: DmaAddressStep;
  /** The timing byte's D1-D0 */
  timingCode: number;
  /** Clocks a read or write cycle of this port takes */
  cycleClocks: number;
};

/** Core 3.03's zxnDDMA settings */
export type DmaDdmaState = {
  /** `$DF`: bit 0 physical, 1 2D, 2 transparent, 3 fill, 4 Layer 2 X,Y, 5 hidden screen */
  flags: number;
  /** `$D7`, `$DB`: bits 23-16 of the start addresses */
  extA: number;
  extB: number;
  /** The working addresses' bits 23-16 (source, destination) */
  srcHi: number;
  destHi: number;
  rowLength: number;
  rowCount: number;
  strideA: number;
  strideB: number;
  transparent: number;
  fill: number;
  /** The current rectangle position */
  row: number;
  rowByte: number;
  /** A zxnDDMA command waiting for its follow bytes: the command and how many came of how many */
  command: number;
  commandBytes: number;
  commandBytesReceived: number;
};

/** The DMA's state at a pause */
export type NextDmaState = {
  /** The dialect: the port touched last ($6B zxnDMA, $0B Z80 DMA) */
  dialect: "zxn" | "z80";
  seq: DmaSeq;
  busRequested: boolean;
  busAcknowledged: boolean;
  /** WR0 D2 */
  aToB: boolean;
  portA: DmaPortState;
  portB: DmaPortState;
  /** WR0's block length as written */
  blockLength: number;
  /** The byte counter (counts up from 0, or from $FFFF in Z80 DMA mode) */
  counter: number;
  prescaler: number;
  operatingMode: DmaOperatingMode;
  autoRestart: boolean;
  readMask: number;
  /** The read sequence's next entry */
  nextRead: DmaReadEntry;
  /** Status bit 5 is 1: the end of the block has not been reached */
  endOfBlockN: boolean;
  /** Status bit 0: a byte has moved in the transfer under way */
  atLeastOne: boolean;
  /** The register write sequencer and the base byte it belongs to */
  wrSeq: number;
  regTemp: number;
  /** A start address was written after the last `$CF` */
  startsSinceLoad: boolean;
  /** Latched at the last enable: bit 0 = without a load after new starts, bit 1 = after a finished block */
  enableNote: number;
  /** The DMA let go of the bus for an interrupt enabled in `$CC`-`$CE` */
  wasDelayed: boolean;
  /** An interrupt enabled in `$CC`-`$CE` is requesting or in service now */
  delayActive: boolean;
  /** The CPU speed: 0 = 3.5, 1 = 7, 2 = 14, 3 = 28 MHz */
  cpuSpeed: number;
  /** Present on core 3.03 and later */
  ddma?: DmaDdmaState;
  /** The NextRegs that switch the DMA's ports and its stepping aside */
  nextRegs: { r82: number; r85: number; rC0: number; rCC: number; rCD: number; rCE: number };
  /** The 28 MHz master clocks of a frame (for the frozen-time estimate); a CPU clock is 8 >> cpuSpeed of them */
  tactsInFrame: number;
};

/** The values the snapshot does not hold, read beside it */
export type NextDmaStateExtras = {
  nextReg82: number;
  nextReg85: number;
  nextRegC0: number;
  nextRegCC: number;
  nextRegCD: number;
  nextRegCE: number;
  tactsInFrame: number;
};

const word = (b: Uint8Array, at: number) => b[at] | (b[at + 1] << 8);

const addressStep = (mode: number): DmaAddressStep => (mode === 0 ? "down" : mode === 1 ? "up" : "fixed");

/** Clocks a read or write cycle takes for a timing byte's D1-D0: 00 and 11 = 4, 01 = 3, 10 = 2 */
export const dmaCycleClocks = (timingCode: number): number =>
  (timingCode & 0x03) === 1 ? 3 : (timingCode & 0x03) === 2 ? 2 : 4;

/** Decodes the core's 64-byte snapshot (`zxnextGetDmaStatePtr`) */
export function decodeDmaState(bytes: Uint8Array, extras: NextDmaStateExtras): NextDmaState {
  const aToB = bytes[4] !== 0;
  const src = word(bytes, 24);
  const dest = word(bytes, 26);
  const port = (start: number, working: number, isIo: number, mode: number, timing: number): DmaPortState => ({
    start,
    working,
    isIo: isIo !== 0,
    step: addressStep(mode),
    timingCode: timing & 0x03,
    cycleClocks: dmaCycleClocks(timing)
  });
  const rdSeq = bytes[15];
  return {
    dialect: bytes[0] ? "z80" : "zxn",
    seq: DMA_SEQS[bytes[1] & 0x03],
    busRequested: bytes[2] !== 0,
    busAcknowledged: bytes[3] !== 0,
    aToB,
    portA: port(word(bytes, 16), aToB ? src : dest, bytes[5], bytes[6], bytes[7]),
    portB: port(word(bytes, 18), aToB ? dest : src, bytes[8], bytes[9], bytes[10]),
    blockLength: word(bytes, 20),
    counter: word(bytes, 22),
    prescaler: bytes[11],
    operatingMode: DMA_OPERATING_MODES[bytes[12] & 0x03],
    autoRestart: bytes[13] !== 0,
    readMask: bytes[14],
    nextRead: DMA_READ_ENTRIES[rdSeq < 7 ? rdSeq : 0],
    endOfBlockN: bytes[28] !== 0,
    atLeastOne: bytes[29] !== 0,
    wrSeq: bytes[30],
    regTemp: bytes[31],
    startsSinceLoad: bytes[32] !== 0,
    enableNote: bytes[33],
    wasDelayed: bytes[34] !== 0,
    delayActive: bytes[35] !== 0,
    cpuSpeed: bytes[60] & 0x03,
    ddma:
      bytes[37] !== 0
        ? {
            flags: bytes[38],
            extA: bytes[39],
            extB: bytes[40],
            srcHi: bytes[41],
            destHi: bytes[42],
            transparent: bytes[43],
            fill: bytes[44],
            command: bytes[45],
            commandBytes: bytes[46],
            commandBytesReceived: bytes[47],
            rowLength: word(bytes, 48),
            rowCount: word(bytes, 50),
            strideA: word(bytes, 52),
            strideB: word(bytes, 54),
            rowByte: word(bytes, 56),
            row: word(bytes, 58)
          }
        : undefined,
    nextRegs: {
      r82: extras.nextReg82 & 0xff,
      r85: extras.nextReg85 & 0xff,
      rC0: extras.nextRegC0 & 0xff,
      rCC: extras.nextRegCC & 0xff,
      rCD: extras.nextRegCD & 0xff,
      rCE: extras.nextRegCE & 0xff
    },
    tactsInFrame: extras.tactsInFrame
  };
}

/** The status byte a read would give: `00E1101T` */
export const dmaStatusByte = (s: Pick<NextDmaState, "endOfBlockN" | "atLeastOne">): number =>
  0x1a | (s.endOfBlockN ? 0x20 : 0) | (s.atLeastOne ? 0x01 : 0);

/** The register group a write sequencer state belongs to */
export type DmaPendingGroup = "WR0" | "WR1" | "WR2" | "WR3" | "WR4" | "WR6" | "zxnDDMA";

/** What the write sequencer still expects: the group and the roles of the bytes to come, in order */
export type DmaPendingFollowers = {
  group: DmaPendingGroup;
  roles: (DmaFieldRole | "ddma")[];
};

/**
 * The follow bytes the DMA still expects, from its write sequencer state and the base byte
 * (`zxnextDmaWritePort`); undefined when it expects a base byte or is deaf. A WR1/WR2 timing byte may
 * announce one more byte, which is not known before it arrives: only the timing byte is listed.
 */
export function dmaPendingFollowers(
  s: Pick<NextDmaState, "wrSeq" | "regTemp" | "ddma">
): DmaPendingFollowers | undefined {
  const t = s.regTemp;
  const pick = (cond: boolean, role: DmaFieldRole) => (cond ? [role] : []);
  switch (s.wrSeq) {
    case DmaWrSeq.R0Byte0:
      return { group: "WR0", roles: ["portALo", ...pick(!!(t & 0x10), "portAHi"), ...pick(!!(t & 0x20), "lengthLo"), ...pick(!!(t & 0x40), "lengthHi")] };
    case DmaWrSeq.R0Byte1:
      return { group: "WR0", roles: ["portAHi", ...pick(!!(t & 0x20), "lengthLo"), ...pick(!!(t & 0x40), "lengthHi")] };
    case DmaWrSeq.R0Byte2:
      return { group: "WR0", roles: ["lengthLo", ...pick(!!(t & 0x40), "lengthHi")] };
    case DmaWrSeq.R0Byte3:
      return { group: "WR0", roles: ["lengthHi"] };
    case DmaWrSeq.R1Byte0:
      return { group: "WR1", roles: ["timing"] };
    case DmaWrSeq.R1Byte1:
      return { group: "WR1", roles: ["timingExtra"] };
    case DmaWrSeq.R2Byte0:
      return { group: "WR2", roles: ["timing"] };
    case DmaWrSeq.R2Byte1:
      return { group: "WR2", roles: ["prescaler"] };
    case DmaWrSeq.R3Byte0:
      return { group: "WR3", roles: ["mask", ...pick(!!(t & 0x10), "match")] };
    case DmaWrSeq.R3Byte1:
      return { group: "WR3", roles: ["match"] };
    case DmaWrSeq.R4Byte0:
      return { group: "WR4", roles: ["portBLo", ...pick(!!(t & 0x08), "portBHi")] };
    case DmaWrSeq.R4Byte1:
      return { group: "WR4", roles: ["portBHi"] };
    case DmaWrSeq.R6Byte0:
      return { group: "WR6", roles: ["readMask"] };
    case DmaWrSeq.Ddma: {
      const left = Math.max(1, (s.ddma?.commandBytes ?? 1) - (s.ddma?.commandBytesReceived ?? 0));
      return { group: "zxnDDMA", roles: Array.from({ length: left }, () => "ddma" as const) };
    }
    default:
      return undefined;
  }
}

/** The CPU clock at a speed setting (0 = 3.5 MHz ... 3 = 28 MHz) */
export const dmaCpuHz = (cpuSpeed: number) => 3_500_000 << (cpuSpeed & 0x03);

/** The prescaler's pacing at a CPU speed (`dev/plans/NEXT_DMA_DEBUGGING_PLAN.md` §3.4) */
export type DmaPacing = {
  /** 875 kHz ÷ P */
  nominalHz: number;
  /** The wait in CPU clocks from the start of a byte: 32 × P master clocks */
  waitClocks: number;
  /** The wait is longer than the byte, so the prescaler sets the pace */
  effective: boolean;
  /** CPU clocks from one byte to the next when effective: the wait + 3 */
  periodClocks: number;
  /** The byte rate the exact period gives */
  exactHz: number;
};

/**
 * The prescaler's pacing (no wait states): the timer counts 28 MHz time, 8/4/2/1 per CPU clock at
 * 3.5/7/14/28 MHz, and the next byte comes 3 CPU clocks after it reaches 32 × P. Undefined for P = 0.
 */
export function dmaPacing(prescaler: number, cpuSpeed: number, byteClocks: number): DmaPacing | undefined {
  if (!prescaler) return undefined;
  const scale = 8 >> (cpuSpeed & 0x03);
  const waitClocks = (32 * prescaler) / scale;
  const effective = waitClocks > byteClocks;
  const periodClocks = waitClocks + 3;
  return {
    nominalHz: 875_000 / prescaler,
    waitClocks,
    effective,
    periodClocks,
    exactHz: dmaCpuHz(cpuSpeed) / periodClocks
  };
}

/** The CPU clocks one byte takes without wait states: a read and a write (a 3.03 fill has no read) */
export function dmaByteClocks(s: Pick<NextDmaState, "aToB" | "portA" | "portB" | "ddma">): number {
  const source = s.aToB ? s.portA : s.portB;
  const dest = s.aToB ? s.portB : s.portA;
  const fill = !!s.ddma && (s.ddma.flags & 0x08) !== 0;
  return (fill ? 0 : source.cycleClocks) + dest.cycleClocks;
}

/** How many bytes the block moves: N (zxnDMA) or N + 1 (Z80 DMA); 0 moves one; a 3.03 rectangle */
export function dmaBytesToMove(s: Pick<NextDmaState, "dialect" | "blockLength" | "ddma">): number {
  if (s.ddma && (s.ddma.flags & 0x02) !== 0) {
    return Math.max(1, s.ddma.rowLength) * Math.max(1, s.ddma.rowCount);
  }
  if (s.blockLength === 0) return 1;
  return s.dialect === "z80" ? s.blockLength + 1 : s.blockLength;
}

/** How many bytes the block has moved: the counter from its start (0 or $FFFF) */
export function dmaBytesMoved(s: Pick<NextDmaState, "dialect" | "counter" | "ddma">): number {
  if (s.ddma && (s.ddma.flags & 0x02) !== 0) {
    return s.ddma.row * Math.max(1, s.ddma.rowLength) + s.ddma.rowByte;
  }
  return s.dialect === "z80" ? (s.counter + 1) & 0xffff : s.counter;
}
