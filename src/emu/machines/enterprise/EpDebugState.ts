/*
 * NICK's and DAVE's state as the debugger shows it (`.plans/ENTERPRISE_PLAN.md` §11, the NICK and
 * DAVE panels), read from the WASM core and decoded. The test harness (`test/harness/enterprise/`)
 * reads NICK and DAVE through the same functions.
 *
 * Facts: `_input/enterprise128/NICK_VIDEO.md` (§3, the LPB), `DAVE_MEMORY_IO.md` (§4 interrupts, §5
 * sound, §8 BFh). This module imports no core code: the renderer imports its types.
 */

import { EP_PHYS_VRAM } from "./epMachineInfo";

type CoreFunction = (...args: number[]) => number;

/** The NICK exports the readers use (`EpWasmV2Exports` has them all) */
export type EpNickExports = Record<
  | "epNickGetPort"
  | "epNickGetLptBase"
  | "epNickGetLptAddress"
  | "epNickGetLpbByte"
  | "epNickGetLd1"
  | "epNickGetLd2"
  | "epNickGetLinesLeft"
  | "epNickGetSlot"
  | "epNickGetLine"
  | "epNickGetState"
  | "epNickGetDataBus",
  CoreFunction
>;

/** The DAVE exports the readers use */
export type EpDaveExports = Record<
  "epGetB4" | "epGetIntEnable" | "epGetIntLatch" | "epGetBf" | "epGetDaveRegister",
  CoreFunction
>;

// ================================================================================================
// NICK

/** NICK's registers and counters as the core keeps them */
export type EpNickCore = {
  /** Ports 80h-83h as last written (FIXBIAS, BORDER, LPL, LPH) */
  ports: number[];
  lptBase: number;
  /** The LPT pointer: the address of the LPB NICK is showing */
  lptAddress: number;
  /** The current LPB's bytes, as fetched so far this line (slots 0-7 fetch two bytes each) */
  lpb: number[];
  ld1: number;
  ld2: number;
  /** Lines left in the current block (0: the next line starts a new block) */
  linesLeft: number;
  /** The slot that runs next (0-56) and the lines since vertical sync started */
  slot: number;
  line: number;
  displayOn: boolean;
  vsyncOn: boolean;
  /** The mode latched at the left margin (MB bits 3-1) */
  mode: number;
  /** The last byte NICK fetched (the floating video bus) */
  dataBus: number;
};

/** One Line Parameter Block, decoded (`NICK_VIDEO.md` §3.2) */
export type EpLpb = {
  address: number;
  /** Its 16 bytes */
  bytes: number[];
  /** 256 - SC: the lines of the block */
  lines: number;
  /** MB bits 3-1: 0 VSYNC, 1 PIXEL, 2 ATTRIBUTE, 3 CH256, 4 CH128, 5 CH64, 6 unused, 7 LPIXEL */
  mode: number;
  /** MB bits 6-5: 0 two colours, 1 four, 2 sixteen, 3 256 */
  colours: number;
  vres: boolean;
  vint: boolean;
  reload: boolean;
  /** The margins (6-bit slot numbers) */
  lm: number;
  rm: number;
  /** LM bit 7 and bit 6 (bitmap modes) */
  msbAlt: boolean;
  lsbAlt: boolean;
  /** RM bit 6 and bit 7 (character modes; the core's `EP_ALTIND1_BIT`) */
  altInd1: boolean;
  altInd0: boolean;
  ld1: number;
  ld2: number;
  /** COL0-COL7 */
  palette: number[];
};

/** The modes' names, by MB bits 3-1 */
export const EP_NICK_MODE_NAMES = ["VSYNC", "PIXEL", "ATTR", "CH256", "CH128", "CH64", "INVALID", "LPIXEL"];

/** The colours a colour mode shows, by MB bits 6-5 */
export const EP_NICK_COLOUR_COUNTS = [2, 4, 16, 256];

/** Decodes the 16 bytes of an LPB found at `address` */
export function decodeEpLpb(address: number, bytes: ArrayLike<number>): EpLpb {
  const b = Array.from({ length: 16 }, (_, i) => (bytes[i] ?? 0) & 0xff);
  return {
    address,
    bytes: b,
    lines: 256 - b[0],
    mode: (b[1] >> 1) & 7,
    colours: (b[1] >> 5) & 3,
    vres: (b[1] & 0x10) !== 0,
    vint: (b[1] & 0x80) !== 0,
    reload: (b[1] & 0x01) !== 0,
    lm: b[2] & 0x3f,
    rm: b[3] & 0x3f,
    msbAlt: (b[2] & 0x80) !== 0,
    lsbAlt: (b[2] & 0x40) !== 0,
    altInd1: (b[3] & 0x40) !== 0,
    altInd0: (b[3] & 0x80) !== 0,
    ld1: b[4] | (b[5] << 8),
    ld2: b[6] | (b[7] << 8),
    palette: b.slice(8)
  };
}

/** Reads NICK's registers and counters from the core */
export function readEpNickCore(w: EpNickExports): EpNickCore {
  const state = w.epNickGetState();
  return {
    ports: [0, 1, 2, 3].map((i) => w.epNickGetPort(i)),
    lptBase: w.epNickGetLptBase(),
    lptAddress: w.epNickGetLptAddress(),
    lpb: Array.from({ length: 16 }, (_, i) => w.epNickGetLpbByte(i)),
    ld1: w.epNickGetLd1(),
    ld2: w.epNickGetLd2(),
    linesLeft: w.epNickGetLinesLeft(),
    slot: w.epNickGetSlot(),
    line: w.epNickGetLine(),
    displayOn: (state & 1) !== 0,
    vsyncOn: (state & 2) !== 0,
    mode: (state >> 4) & 7,
    dataBus: w.epNickGetDataBus()
  };
}

/** The LPB at `address` of NICK's 64K, read through `vram` */
export function readEpLpbAt(vram: (address: number) => number, address: number): EpLpb {
  return decodeEpLpb(
    address,
    Array.from({ length: 16 }, (_, i) => vram((address + i) & 0xffff))
  );
}

/** The most blocks an LPT list holds: a table without a RELOAD block stops here */
export const EP_LPT_MAX_BLOCKS = 64;

/** The LPT from `base` to the RELOAD block (at most `EP_LPT_MAX_BLOCKS` blocks) */
export function readEpLpt(vram: (address: number) => number, base: number): EpLpb[] {
  const blocks: EpLpb[] = [];
  let address = base & 0xffff;
  for (let i = 0; i < EP_LPT_MAX_BLOCKS; i++) {
    const block = readEpLpbAt(vram, address);
    blocks.push(block);
    if (block.reload) break;
    address = (address + 16) & 0xffff;
  }
  return blocks;
}

/** NICK, for the NICK panel */
export type EpNickDebugState = EpNickCore & {
  /** The current LPB, decoded from the bytes NICK fetched */
  current: EpLpb;
  /** The LPT from its base to the RELOAD block; `currentIndex` is the block at the LPT pointer (-1: none) */
  lpt: EpLpb[];
  currentIndex: number;
  /** Port 80h bits 4-0 (palette entries 8-15 are FIXBIAS * 8 + 0-7) and port 81h */
  fixBias: number;
  border: number;
  /** Every colour byte's RGBA as the picture shows it (0xAABBGGRR words, 256 of them) */
  rgb: number[];
};

/** Builds the NICK panel's state from the core's registers, NICK's 64K and the colour table */
export function buildEpNickDebugState(
  core: EpNickCore,
  vram: (address: number) => number,
  rgb: (colour: number) => number
): EpNickDebugState {
  const lpt = readEpLpt(vram, core.lptBase);
  return {
    ...core,
    current: decodeEpLpb(core.lptAddress, core.lpb),
    lpt,
    currentIndex: lpt.findIndex((b) => b.address === core.lptAddress),
    fixBias: core.ports[0] & 0x1f,
    border: core.ports[1],
    rgb: Array.from({ length: 256 }, (_, i) => rgb(i) >>> 0)
  };
}

/** NICK's panel state read from a core: its exports and its physical memory (NICK's 64K at `EP_PHYS_VRAM`) */
export function readEpNickDebugState(
  w: EpNickExports & Record<"epNickGetRgb", CoreFunction>,
  memory: Uint8Array
): EpNickDebugState {
  return buildEpNickDebugState(
    readEpNickCore(w),
    (address) => memory[EP_PHYS_VRAM + (address & 0xffff)],
    (colour) => w.epNickGetRgb(colour)
  );
}

/** A colour byte as a CSS colour, from the state's RGBA table */
export function epColourCss(rgb: readonly number[] | undefined, colour: number): string {
  const word = rgb?.[colour & 0xff] ?? 0;
  const r = word & 0xff;
  const g = (word >> 8) & 0xff;
  const b = (word >> 16) & 0xff;
  return `rgb(${r}, ${g}, ${b})`;
}

// ================================================================================================
// DAVE

/** DAVE's registers as the core keeps them */
export type EpDaveCore = {
  /** B4h as read: the sources' levels (bits 0/2/4/6) and the latches (1/3/5/7) */
  b4: number;
  /** The enables as written to B4h (bits 0/2/4/6) */
  enable: number;
  /** The latches (bits 1/3/5/7) */
  latch: number;
  /** BFh as last written */
  bf: number;
  /** A0h-AFh as last written */
  registers: number[];
};

/** Reads DAVE's registers from the core */
export function readEpDaveCore(w: EpDaveExports): EpDaveCore {
  return {
    b4: w.epGetB4(),
    enable: w.epGetIntEnable(),
    latch: w.epGetIntLatch(),
    bf: w.epGetBf(),
    registers: Array.from({ length: 16 }, (_, i) => w.epGetDaveRegister(i))
  };
}

/** One interrupt source (B4h): the selectable one, 1 Hz, INT1 (NICK's VINT), INT2 */
export type EpDaveInterrupt = {
  enabled: boolean;
  latched: boolean;
  /** The source's level as B4h reads it (a divider's square wave, or the input pin) */
  level: boolean;
};

/** A tone channel (A0h-A5h, its sync bit in A7h, its volumes in A8h-AFh) */
export type EpDaveTone = {
  /** The 12-bit code n */
  code: number;
  /** The pure tone's frequency: the tick / 2 / (n + 1) */
  frequency: number;
  /** Bits 5-4: 0 none, 1 the 4-bit poly, 2 the 5-bit one, 3 the 7-bit (or the variable one) */
  distortion: number;
  highPass: boolean;
  ring: boolean;
  sync: boolean;
  left: number;
  right: number;
};

/** The noise channel (A6h, A8h-AFh) */
export type EpDaveNoise = {
  /** Bits 1-0: 0 31.25 kHz, 1 channel 0, 2 channel 1, 3 channel 2 */
  clock: number;
  /** Bits 3-2: the variable poly's length in bits (17, 15, 11 or 9) */
  polyBits: number;
  /** Bit 4: the 7-bit and variable polys swapped */
  swapPolys: boolean;
  lowPass: boolean;
  highPass: boolean;
  ring: boolean;
  left: number;
  right: number;
};

/** DAVE, for the DAVE panel */
export type EpDaveDebugState = EpDaveCore & {
  /** B0h-B3h: the segment each page shows, and its label */
  pages: number[];
  pageLabels: string[];
  /** The selectable source, 1 Hz, INT1, INT2 */
  interrupts: EpDaveInterrupt[];
  /** A7h bits 6-5: 0 1 kHz, 1 50 Hz, 2 tone channel 0, 3 tone channel 1 */
  intSelect: number;
  /** BFh bit 0: 16K on-board RAM (only FFh is video RAM) */
  ram16K: boolean;
  /** BFh bit 1: a 12 MHz input (DAVE divides by 48, not 32) */
  clock12MHz: boolean;
  /** BFh bits 3-2: 0 wait on every access, 1 on M1 only, 2-3 no waits */
  waitMode: number;
  /** DAVE's tick in Hz: 250 000, or 166 667 with BFh bit 1 */
  tickHz: number;
  tones: EpDaveTone[];
  noise: EpDaveNoise;
  /** A7h bits 3 and 4: a side outputs its channel 0 volume (A8h / ACh) as a D/A level */
  dacLeft: boolean;
  dacRight: boolean;
};

/** DAVE's panel state read from a core, with the pages' segment labels (`getPartitionLabels`) */
export function readEpDaveDebugState(
  w: EpDaveExports & Record<"epGetPageRegister", CoreFunction>,
  segmentLabels: Record<number, string>
): EpDaveDebugState {
  const pages = [0, 1, 2, 3].map((page) => w.epGetPageRegister(page) & 0xff);
  return buildEpDaveDebugState(
    readEpDaveCore(w),
    pages,
    pages.map((segment) => segmentLabels[segment] ?? segment.toString(16).toUpperCase().padStart(2, "0"))
  );
}

/** DAVE's input clock (8 MHz) */
const DAVE_INPUT_HZ = 8_000_000;
const NOISE_POLY_BITS = [17, 15, 11, 9];

/** Decodes DAVE's registers for the panel; `pages`/`pageLabels` come from the memory side */
export function buildEpDaveDebugState(core: EpDaveCore, pages: number[], pageLabels: string[]): EpDaveDebugState {
  const r = core.registers;
  const clock12MHz = (core.bf & 0x02) !== 0;
  const tickHz = DAVE_INPUT_HZ / (clock12MHz ? 48 : 32);
  const tones = [0, 1, 2].map((ch): EpDaveTone => {
    const code = ((r[ch * 2 + 1] & 0x0f) << 8) | r[ch * 2];
    return {
      code,
      frequency: tickHz / 2 / (code + 1),
      distortion: (r[ch * 2 + 1] >> 4) & 3,
      highPass: (r[ch * 2 + 1] & 0x40) !== 0,
      ring: (r[ch * 2 + 1] & 0x80) !== 0,
      sync: (r[7] & (1 << ch)) !== 0,
      left: r[8 + ch] & 0x3f,
      right: r[12 + ch] & 0x3f
    };
  });
  return {
    ...core,
    pages,
    pageLabels,
    interrupts: [0, 1, 2, 3].map((i) => ({
      enabled: (core.enable & (1 << (2 * i))) !== 0,
      latched: (core.latch & (2 << (2 * i))) !== 0,
      level: (core.b4 & (1 << (2 * i))) !== 0
    })),
    intSelect: (r[7] >> 5) & 3,
    ram16K: (core.bf & 0x01) !== 0,
    clock12MHz,
    waitMode: (core.bf >> 2) & 3,
    tickHz,
    tones,
    noise: {
      clock: r[6] & 3,
      polyBits: NOISE_POLY_BITS[(r[6] >> 2) & 3],
      swapPolys: (r[6] & 0x10) !== 0,
      lowPass: (r[6] & 0x20) !== 0,
      highPass: (r[6] & 0x40) !== 0,
      ring: (r[6] & 0x80) !== 0,
      left: r[11] & 0x3f,
      right: r[15] & 0x3f
    },
    dacLeft: (r[7] & 0x08) !== 0,
    dacRight: (r[7] & 0x10) !== 0
  };
}
