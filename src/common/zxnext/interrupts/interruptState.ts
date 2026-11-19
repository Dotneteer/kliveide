/**
 * The ZX Spectrum Next interrupt system as the IDE sees it (`dev/plans/NEXT_INTERRUPTS_DEBUGGING_PLAN.md`):
 * the Interrupts panel's snapshot and the interrupt event ring's records, with the decoders that turn
 * the core's bytes into them. Pure: shared by the emulator process (which decodes) and the renderer
 * (which reads the types and the source table).
 *
 * The byte layouts are the core's (`zxnext-interrupts.c` `zxnextInterruptsSnapshot`,
 * `zxnext-int-events.c`); `test/wasm/zxNext/wasm-next-interrupt-state.test.ts` pins them against it.
 */

/** The daisy chain's fourteen sources, in priority order (index 0 is the highest) */
export const NEXT_INT_SOURCE_COUNT = 14;

/** The chain index of each source (zxnext.vhd ~1897) */
export const NextIntSource = {
  Line: 0,
  Uart0Rx: 1,
  Uart1Rx: 2,
  Ctc0: 3,
  Ctc1: 4,
  Ctc2: 5,
  Ctc3: 6,
  Ula: 11,
  Uart0Tx: 12,
  Uart1Tx: 13
} as const;

/** Each source's stable id (used in i18n keys, breakpoint specs and the timeline's lanes) */
export const NEXT_INT_SOURCE_IDS = [
  "line",
  "uart0rx",
  "uart1rx",
  "ctc0",
  "ctc1",
  "ctc2",
  "ctc3",
  "ctc4",
  "ctc5",
  "ctc6",
  "ctc7",
  "ula",
  "uart0tx",
  "uart1tx"
] as const;

export type NextIntSourceId = (typeof NEXT_INT_SOURCE_IDS)[number];

/** The sources' hardware names: not translated (they are the chips' and the manual's names) */
export const NEXT_INT_SOURCE_NAMES = [
  "Line",
  "UART 0 Rx",
  "UART 1 Rx",
  "CTC 0",
  "CTC 1",
  "CTC 2",
  "CTC 3",
  "CTC 4",
  "CTC 5",
  "CTC 6",
  "CTC 7",
  "ULA",
  "UART 0 Tx",
  "UART 1 Tx"
] as const;

/** CTC channels 4-7 have places in the chain but no hardware: they never fire */
export function isReservedIntSource(index: number): boolean {
  return index >= 7 && index <= 10;
}

/** The sources NextReg `$20` can request: its bit for each, or undefined */
export function nextReg20BitOf(index: number): number | undefined {
  if (index === NextIntSource.Line) return 0x80;
  if (index === NextIntSource.Ula) return 0x40;
  if (index >= NextIntSource.Ctc0 && index <= NextIntSource.Ctc3) return 1 << (index - NextIntSource.Ctc0);
  return undefined;
}

/** The status register (`$C8`-`$CA`) and the value whose written 1s clear a source's status bit */
export function statusClearWriteOf(index: number): { reg: number; value: number } | undefined {
  if (index === NextIntSource.Line) return { reg: 0xc8, value: 0x02 };
  if (index === NextIntSource.Ula) return { reg: 0xc8, value: 0x01 };
  if (index >= 3 && index <= 10) return { reg: 0xc9, value: 1 << (index - 3) };
  if (index === NextIntSource.Uart0Rx) return { reg: 0xca, value: 0x03 };
  if (index === NextIntSource.Uart1Rx) return { reg: 0xca, value: 0x30 };
  if (index === NextIntSource.Uart0Tx) return { reg: 0xca, value: 0x04 };
  if (index === NextIntSource.Uart1Tx) return { reg: 0xca, value: 0x40 };
  return undefined;
}

/** The vector a source supplies in hardware IM2 mode: `$C0` bits 7-5, its index, a 0 */
export function vectorOf(vectorBase: number, index: number): number {
  return (vectorBase & 0xe0) | ((index & 0x0f) << 1);
}

export type NextIntSourceState = {
  index: number;
  /** The source's interrupt enable (`$C4`-`$C6`, a CTC channel's control word bit 7) */
  enabled: boolean;
  /** Its status bit (`$C8`-`$CA`): latched by the event, or held by a pending request */
  status: boolean;
  /** A request is pending (requesting, or in service until the RETI) */
  pending: boolean;
  /** The CPU acknowledged it and its RETI has not come yet */
  inService: boolean;
  /** The word at `I * 256 + vector`: the handler an IM 2 acknowledge would jump to */
  handler: number;
};

/** The NMI arbiter's states (zxnext.vhd ~2046-2130) */
export type NextNmiArbiterState = "idle" | "fetch" | "hold" | "end";

export type NextNmiState = {
  state: NextNmiArbiterState;
  /** The device the arbiter chose, while one is active */
  source?: "multiface" | "divmmc";
  pendingMultiface: boolean;
  pendingDivMmc: boolean;
  signal: boolean;
  /** `$C0` bit 3 */
  stackless: boolean;
  /** A stackless NMI was taken: the next RETN returns to `returnAddress` */
  stacklessArmed: boolean;
  /** `$C2`/`$C3`: recorded on every NMI */
  returnAddress: number;
  /** `$06` bit 3: the M1 button (and `$02` bit 3) may raise a Multiface NMI */
  allowMultiface: boolean;
  /** `$06` bit 4: the DRIVE button (and `$02` bit 2) may raise a DivMMC NMI */
  allowDivMmc: boolean;
  /** `$D8` bit 0: the +3 FDC port trap */
  ioTrap: boolean;
};

/** The Interrupts panel's snapshot (plan §3.1). Reading it never changes the machine. */
export type NextInterruptState = {
  /** `$C0` bit 0 */
  hwIm2Mode: boolean;
  /** `$C0` bits 7-5 */
  vectorBase: number;
  /** The vector the last acknowledge read (`$FF` in pulse mode) */
  lastVector: number;
  /** The /INT line a harness or peripheral holds */
  intSignal: boolean;
  /** A CTC, `$20` or ULA-exception pulse is running now */
  pulseActive: boolean;
  /** The pulse's length in CPU T-states (32 or 36) */
  pulseLength: number;
  /** `$22`/`$23`: the line the line interrupt rings for */
  lineInterrupt: number;
  /** `$C4` bit 7 */
  expansionBusEnabled: boolean;
  cpu: { im: number; iff1: boolean; iff2: boolean; i: number; pc: number; sp: number };
  /** How many interrupt frames the Call Stack holds (the Z80 core's interrupt depth) */
  interruptDepth: number;
  sources: NextIntSourceState[];
  nmi: NextNmiState;
  /** The event ring: on or off, events written since the last clear, its capacity */
  recording: { enabled: boolean; count: number; capacity: number };
};

/** The raw values the snapshot bytes do not hold, read beside them */
export type NextInterruptStateExtras = {
  pc: number;
  sp: number;
  interruptDepth: number;
  nextReg06: number;
  nextRegD8: number;
  recording: { enabled: boolean; count: number; capacity: number };
};

/** Decodes the core's 96-byte snapshot (`zxnextInterruptsSnapshot`) */
export function decodeInterruptState(bytes: Uint8Array, extras: NextInterruptStateExtras): NextInterruptState {
  const sources: NextIntSourceState[] = [];
  for (let i = 0; i < NEXT_INT_SOURCE_COUNT; i++) {
    const b = bytes[i];
    sources.push({
      index: i,
      enabled: (b & 0x01) !== 0,
      status: (b & 0x02) !== 0,
      pending: (b & 0x04) !== 0,
      inService: (b & 0x08) !== 0,
      handler: bytes[40 + i * 2] | (bytes[41 + i * 2] << 8)
    });
  }
  const nmiStates: NextNmiArbiterState[] = ["idle", "fetch", "hold", "end"];
  const nmiSource = bytes[27];
  return {
    hwIm2Mode: bytes[16] !== 0,
    vectorBase: bytes[17] & 0xe0,
    lastVector: bytes[18],
    intSignal: bytes[19] !== 0,
    pulseActive: bytes[20] !== 0,
    lineInterrupt: bytes[24] | ((bytes[25] & 0x01) << 8),
    expansionBusEnabled: bytes[23] !== 0,
    pulseLength: bytes[37],
    cpu: {
      im: bytes[34] & 0x03,
      iff1: bytes[35] !== 0,
      iff2: bytes[36] !== 0,
      i: bytes[38],
      pc: extras.pc & 0xffff,
      sp: extras.sp & 0xffff
    },
    interruptDepth: extras.interruptDepth,
    sources,
    nmi: {
      state: nmiStates[bytes[26] & 0x03],
      source: nmiSource & 0x01 ? "multiface" : nmiSource & 0x02 ? "divmmc" : undefined,
      pendingMultiface: (bytes[28] & 0x01) !== 0,
      pendingDivMmc: (bytes[28] & 0x02) !== 0,
      signal: bytes[29] !== 0,
      stackless: bytes[30] !== 0,
      stacklessArmed: bytes[31] !== 0,
      returnAddress: bytes[32] | (bytes[33] << 8),
      allowMultiface: (extras.nextReg06 & 0x08) !== 0,
      allowDivMmc: (extras.nextReg06 & 0x10) !== 0,
      ioTrap: (extras.nextRegD8 & 0x01) !== 0
    },
    recording: extras.recording
  };
}

// ---------------------------------------------------------------------------------------------------
// The event ring

/** The kinds of the core's event records (`ZXNEXT_IEV_*`) */
export const NextIntEventKind = {
  Request: 1,
  Acknowledge: 2,
  End: 3,
  Reti: 4,
  RetiIgnored: 5,
  RetnInService: 6,
  Lost: 7,
  Wait: 8,
  Nmi: 9,
  NmiEnd: 10
} as const;

export type NextIntEventKindValue = (typeof NextIntEventKind)[keyof typeof NextIntEventKind];

/** The record's source for an NMI (`ZXNEXT_IEV_SRC_NMI_*`), and for a source nobody knows */
export const NEXT_INT_SRC_NMI_MULTIFACE = 0x20;
export const NEXT_INT_SRC_NMI_DIVMMC = 0x21;
export const NEXT_INT_SRC_NMI_OTHER = 0x22;
export const NEXT_INT_SRC_UNKNOWN = 0xff;

/** The record's flags (`ZXNEXT_IEVF_*`) */
export const NextIntEventFlag = {
  Enabled: 0x01,
  Software: 0x02,
  Pulse: 0x04,
  Stackless: 0x08
} as const;

/** The CPU's effective speed when the event happened (flags bits 5-4): 0 3.5 MHz .. 3 28 MHz */
export function eventCpuSpeed(e: { flags: number }): number {
  return (e.flags >> 4) & 0x03;
}

/** 28 MHz clocks per CPU T-state at an event's speed */
export function clocksPerT(e: { flags: number }): number {
  return 8 >> eventCpuSpeed(e);
}

export const NEXT_INT_EVENT_RECORD_SIZE = 16;

/** The interrupt event an `int:` stop stopped on, with the partition its PC was in */
export type InterruptStopEvent = NextIntEvent & { partition?: number };

export type NextIntEvent = {
  /** The record's sequence number since the ring was last cleared */
  seq: number;
  frame: number;
  /** The position in the frame in 28 MHz clocks */
  pos28: number;
  kind: NextIntEventKindValue;
  source: number;
  vector: number;
  flags: number;
  pc: number;
  sp: number;
};

/** The ring's records, oldest first, and what the timeline needs to place them */
export type NextInterruptEvents = {
  enabled: boolean;
  capacity: number;
  /** Records written since the last clear; the ring holds the last `capacity` of them */
  count: number;
  /** The sequence number of the first record in `records` */
  firstSeq: number;
  /** The records, 16 bytes each, oldest first (a copy) */
  records: Uint8Array;
  /** The frame the machine is in now, and its position in 28 MHz clocks */
  currentFrame: number;
  currentPos28: number;
  /** The raster: 7 MHz HCs per line and lines per frame */
  totalHc: number;
  totalVc: number;
};

export function decodeInterruptEvent(records: Uint8Array, index: number, seq: number): NextIntEvent {
  const o = index * NEXT_INT_EVENT_RECORD_SIZE;
  const u32 = (at: number) =>
    (records[at] | (records[at + 1] << 8) | (records[at + 2] << 16) | (records[at + 3] << 24)) >>> 0;
  return {
    seq,
    frame: u32(o),
    pos28: u32(o + 4),
    kind: records[o + 8] as NextIntEventKindValue,
    source: records[o + 9],
    vector: records[o + 10],
    flags: records[o + 11],
    pc: records[o + 12] | (records[o + 13] << 8),
    sp: records[o + 14] | (records[o + 15] << 8)
  };
}

export function decodeInterruptEvents(events: NextInterruptEvents): NextIntEvent[] {
  const n = Math.floor(events.records.length / NEXT_INT_EVENT_RECORD_SIZE);
  const result: NextIntEvent[] = new Array(n);
  for (let i = 0; i < n; i++) result[i] = decodeInterruptEvent(events.records, i, events.firstSeq + i);
  return result;
}

/** Copies the ring's records written since `since` (all held ones by default), oldest first */
export function copyRingRecords(
  ring: Uint8Array,
  capacity: number,
  count: number,
  since = 0,
  recordSize = NEXT_INT_EVENT_RECORD_SIZE
): { firstSeq: number; records: Uint8Array } {
  const first = Math.max(since, count - capacity, 0);
  const n = Math.max(0, count - first);
  const out = new Uint8Array(n * recordSize);
  for (let k = 0; k < n; ) {
    const slot = (first + k) % capacity;
    const run = Math.min(n - k, capacity - slot);
    out.set(ring.subarray(slot * recordSize, (slot + run) * recordSize), k * recordSize);
    k += run;
  }
  return { firstSeq: first, records: out };
}
