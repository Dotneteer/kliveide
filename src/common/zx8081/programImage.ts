import {
  ZX80_TOKEN_CLOSE_PAREN,
  ZX80_TOKEN_OPEN_PAREN,
  ZX80_TOKEN_RANDOMISE,
  ZX80_TOKEN_REM,
  ZX8081_NEWLINE,
  ZX81_NUMBER_MARK,
  ZX81_TOKEN_RAND,
  ZX81_TOKEN_REM,
  ZX81_TOKEN_USR,
  zx8081CharCode,
  zx8081Digits
} from "./charset";

/**
 * Turns assembled machine code into the memory image a ZX81 `.p` or ZX80 `.o` file holds - the
 * bytes the ROM's LOAD reads (`.plans/ZX8081_CODE_INJECTION_PLAN.md` D3). Running code from the IDE
 * writes the same image into the machine, and Export writes it to a file, so what runs is byte for
 * byte what is exported.
 *
 * Two layouts:
 * - **REM container** (the default): the code goes in the body of `1 REM`, which starts at $4082 on
 *   the ZX81 (16514) and $402B on the ZX80; `2 RAND USR <entry>` calls it. The builder writes the
 *   system variables, both lines, an empty display file (ZX81) and the variables' end marker.
 * - **Full image**: when the code starts at the image base ($4009 on the ZX81, $4000 on the ZX80), the
 *   source spells out the system variables and the program itself; the builder only checks it.
 *
 * The layouts were checked against what the machines themselves store when the same lines are typed
 * on them (`test/zx8081-hw/program-image.test.ts`).
 */

/** A segment of assembled code, as `CodeToInject` and the compiler output carry it */
export type Zx8081CodeSegment = {
  startAddress: number;
  emittedCode: ArrayLike<number>;
  bank?: number;
};

export type Zx8081ImageOptions = {
  /** The RAM of the target machine in KB: decides the display file's shape and the fit check */
  ramKb: number;
  /**
   * ZX81 only: the program runs itself once loaded (NXTLIN points at the `RAND USR` line). Off for
   * injection, where the IDE types RUN.
   */
  autoRun?: boolean;
};

export type Zx8081ProgramImage = {
  isZx81: boolean;
  layout: "rem" | "full";
  /** The first address of the image: $4009 (ZX81) or $4000 (ZX80) */
  base: number;
  /** The image, `base` to `eLine - 1`: exactly a `.p`/`.o` file's contents */
  data: Uint8Array;
  /** E_LINE: the end of the image */
  eLine: number;
  /** Where the code is called (`RAND USR`); undefined for a full image without `.ent` */
  entry?: number;
};

/** The image builder's complaints, worded for the IDE's output */
export class Zx8081ImageError extends Error {}

/** The ZX81's image base (VERSN) and where its program starts */
export const ZX81_IMAGE_BASE = 0x4009;
export const ZX81_PROGRAM = 0x407d;
/** Where the body of `1 REM` starts on the ZX81: 16514 */
export const ZX81_REM_BODY = 0x4082;
/** The ZX80's image base and where its program starts */
export const ZX80_IMAGE_BASE = 0x4000;
export const ZX80_PROGRAM = 0x4028;
/** Where the body of `1 REM` starts on the ZX80: 16427 */
export const ZX80_REM_BODY = 0x402b;

/**
 * Room the ROM needs above E_LINE: the edit line, the calculator stack and the machine stack. A
 * program that leaves less cannot be edited or run.
 */
const WORKSPACE_RESERVE = 0x60;

/** The highest address BASIC may use: RAMTOP as the ROM sets it */
export function zx8081RamTop(ramKb: number): number {
  return ramKb <= 1 ? 0x4400 : 0x8000;
}

const hex4 = (value: number) => `$${value.toString(16).toUpperCase().padStart(4, "0")}`;

/**
 * Builds the program image for the ZX81 or the ZX80. Throws `Zx8081ImageError` when the code cannot
 * be laid out (see the layouts above).
 */
export function buildZx8081ProgramImage(
  segments: Zx8081CodeSegment[],
  entryAddress: number | undefined,
  isZx81: boolean,
  options: Zx8081ImageOptions
): Zx8081ProgramImage {
  const code = mergeSegments(segments);
  const base = isZx81 ? ZX81_IMAGE_BASE : ZX80_IMAGE_BASE;
  const remBody = isZx81 ? ZX81_REM_BODY : ZX80_REM_BODY;
  const machine = isZx81 ? "ZX81" : "ZX80";

  let image: Zx8081ProgramImage;
  if (code.start === base) {
    image = checkFullImage(code.bytes, base, isZx81, entryAddress);
  } else if (code.start >= remBody) {
    const entry = entryAddress ?? code.start;
    if (entry < code.start || entry >= code.start + code.bytes.length) {
      throw new Zx8081ImageError(
        `The entry address ${hex4(entry)} is outside the code (${hex4(code.start)}-${hex4(
          code.start + code.bytes.length - 1
        )}).`
      );
    }
    // --- The REM body runs from its fixed start to the end of the code, the gap zero-filled
    const body = new Uint8Array(code.start + code.bytes.length - remBody);
    body.set(code.bytes, code.start - remBody);
    image = isZx81
      ? buildZx81RemImage(body, entry, options)
      : buildZx80RemImage(body, entry);
  } else {
    throw new Zx8081ImageError(
      `The code starts at ${hex4(code.start)}, inside the ${machine}'s system variables and program ` +
        `area. Start it at ${hex4(remBody)} or above (it then goes into a 1 REM line), or at ` +
        `${hex4(base)} with the whole program image spelled out in the source.`
    );
  }

  if (image.eLine > 0x8000) {
    throw new Zx8081ImageError(
      `The program ends at ${hex4(image.eLine)}: a ${machine} cannot execute code above $7FFF.`
    );
  }
  const ramTop = zx8081RamTop(options.ramKb);
  if (image.eLine + WORKSPACE_RESERVE > ramTop) {
    throw new Zx8081ImageError(
      `The program (up to ${hex4(image.eLine)}) does not fit a ${options.ramKb}K ${machine}: ` +
        `the ROM needs room up to RAMTOP (${hex4(ramTop)}) for its workspace and stack.`
    );
  }
  return image;
}

/** The segments as one block of bytes; gaps zero-filled, later segments win an overlap */
function mergeSegments(segments: Zx8081CodeSegment[]): { start: number; bytes: Uint8Array } {
  const used = segments.filter((s) => s.emittedCode.length > 0);
  if (used.length === 0) throw new Zx8081ImageError("There is no code to put in the program.");
  if (used.some((s) => s.bank !== undefined)) {
    throw new Zx8081ImageError("The ZX80 and ZX81 have no memory banks: remove the .bank pragmas.");
  }
  const start = Math.min(...used.map((s) => s.startAddress));
  const end = Math.max(...used.map((s) => s.startAddress + s.emittedCode.length));
  const bytes = new Uint8Array(end - start);
  for (const s of used) bytes.set(Array.from(s.emittedCode), s.startAddress - start);
  return { start, bytes };
}

// ==========================================================================================
// ZX81

/** The ZX81's 5-byte floating-point form of a whole number 0-65535 */
export function zx81Float(value: number): number[] {
  if (value === 0) return [0, 0, 0, 0, 0];
  const bits = Math.floor(Math.log2(value)) + 1;
  // --- The mantissa is normalised so its top bit is 1; that bit's place holds the sign (0 = +)
  const mantissa = (value * 2 ** (32 - bits)) >>> 0;
  return [
    0x80 + bits,
    (mantissa >>> 24) & 0x7f,
    (mantissa >>> 16) & 0xff,
    (mantissa >>> 8) & 0xff,
    mantissa & 0xff
  ];
}

/** A ZX81 BASIC line: number (big-endian), body length (little-endian), body, NEWLINE */
function zx81Line(lineNo: number, body: ArrayLike<number>): number[] {
  const length = body.length + 1;
  return [lineNo >> 8, lineNo & 0xff, length & 0xff, length >> 8, ...Array.from(body), ZX8081_NEWLINE];
}

/** An empty display file: collapsed (just the line ends) on 1K, 24 blank lines on bigger RAM */
function zx81DisplayFile(ramKb: number): number[] {
  const line = ramKb <= 1 ? [ZX8081_NEWLINE] : [...new Array(32).fill(0), ZX8081_NEWLINE];
  const file = [ZX8081_NEWLINE];
  for (let i = 0; i < 24; i++) file.push(...line);
  return file;
}

/** Offsets of the ZX81 system variables in an image (address - $4009) */
const Z81 = {
  E_PPC: 0x400a,
  D_FILE: 0x400c,
  DF_CC: 0x400e,
  VARS: 0x4010,
  DEST: 0x4012,
  E_LINE: 0x4014,
  CH_ADD: 0x4016,
  X_PTR: 0x4018,
  STKBOT: 0x401a,
  STKEND: 0x401c,
  BERG: 0x401e,
  MEM: 0x401f,
  DF_SZ: 0x4022,
  S_TOP: 0x4023,
  LAST_K: 0x4025,
  DB_ST: 0x4027,
  MARGIN: 0x4028,
  NXTLIN: 0x4029,
  T_ADDR: 0x4030,
  FRAMES: 0x4034,
  PR_CC: 0x4038,
  S_POSN: 0x4039,
  CDFLAG: 0x403b,
  PRBUFF_END: 0x405c,
  MEMBOT: 0x405d
};

/**
 * The ZX81 system variables that say where things are: injection writes these into the running
 * machine and leaves the others (the keyboard, the frame counter, the display mode) as they are.
 */
export const ZX81_LAYOUT_SYSVARS: readonly number[] = [
  Z81.E_PPC,
  Z81.D_FILE,
  Z81.DF_CC,
  Z81.VARS,
  Z81.DEST,
  Z81.E_LINE,
  Z81.CH_ADD,
  Z81.X_PTR,
  Z81.STKBOT,
  Z81.STKEND,
  Z81.S_TOP
];

function buildZx81RemImage(
  body: Uint8Array,
  entry: number,
  options: Zx8081ImageOptions
): Zx8081ProgramImage {
  const line1 = zx81Line(1, [ZX81_TOKEN_REM, ...body]);
  const line2Address = ZX81_PROGRAM + line1.length;
  const line2 = zx81Line(2, [
    ZX81_TOKEN_RAND,
    ZX81_TOKEN_USR,
    ...zx8081Digits(entry),
    ZX81_NUMBER_MARK,
    ...zx81Float(entry)
  ]);
  const dFile = line2Address + line2.length;
  const display = zx81DisplayFile(options.ramKb);
  const vars = dFile + display.length;
  const eLine = vars + 1;

  const data = new Uint8Array(eLine - ZX81_IMAGE_BASE);
  const at = (address: number) => address - ZX81_IMAGE_BASE;
  const byte = (address: number, value: number) => (data[at(address)] = value & 0xff);
  const word = (address: number, value: number) => {
    byte(address, value);
    byte(address + 1, value >> 8);
  };

  // --- The system variables: where things are, and what the ROM leaves in the others after NEW
  byte(ZX81_IMAGE_BASE, 0); // VERSN
  word(Z81.E_PPC, 2);
  word(Z81.D_FILE, dFile);
  word(Z81.DF_CC, dFile + 1);
  word(Z81.VARS, vars);
  word(Z81.DEST, 0);
  word(Z81.E_LINE, eLine);
  // --- The edit line (cursor and NEWLINE) follows E_LINE; the calculator stack is empty after it
  word(Z81.CH_ADD, eLine + 2);
  word(Z81.X_PTR, 0);
  word(Z81.STKBOT, eLine + 2);
  word(Z81.STKEND, eLine + 2);
  byte(Z81.BERG, 0xff);
  word(Z81.MEM, Z81.MEMBOT);
  byte(Z81.DF_SZ, 2);
  word(Z81.S_TOP, 0);
  word(Z81.LAST_K, 0xffff);
  byte(Z81.DB_ST, 0);
  byte(Z81.MARGIN, 55);
  // --- A NEWLINE "line number" ($76xx) ends the program: pointing at the display file means stop
  word(Z81.NXTLIN, options.autoRun ? line2Address : dFile);
  word(Z81.T_ADDR, 0x0c8d);
  word(Z81.FRAMES, 0xffff);
  byte(Z81.PR_CC, 0xbc);
  byte(Z81.S_POSN, 33);
  byte(Z81.S_POSN + 1, 24);
  byte(Z81.CDFLAG, 0x40); // --- SLOW mode
  byte(Z81.PRBUFF_END, ZX8081_NEWLINE);

  data.set([...line1, ...line2, ...display, 0x80], at(ZX81_PROGRAM));
  return { isZx81: true, layout: "rem", base: ZX81_IMAGE_BASE, data, eLine, entry };
}

// ==========================================================================================
// ZX80

/** Offsets of the ZX80 system variables in an image (address - $4000) */
const Z80V = {
  ERR_NR: 0x4000,
  FLAGS: 0x4001,
  P_PTR: 0x4004,
  E_PPC: 0x4006,
  VARS: 0x4008,
  E_LINE: 0x400a,
  D_FILE: 0x400c,
  DF_EA: 0x400e,
  DF_END: 0x4010,
  DF_SZ: 0x4012,
  T_ADDR: 0x401a,
  S_POSN: 0x4024,
  CH_ADD: 0x4026
};

/** The ZX80 system variables that say where things are (see `ZX81_LAYOUT_SYSVARS`) */
export const ZX80_LAYOUT_SYSVARS: readonly number[] = [
  Z80V.P_PTR,
  Z80V.E_PPC,
  Z80V.VARS,
  Z80V.E_LINE,
  Z80V.D_FILE,
  Z80V.DF_EA,
  Z80V.DF_END
];

/**
 * A ZX80 BASIC line: number (big-endian), body, NEWLINE. There is no length: the ROM finds the next
 * line by the NEWLINE, so a body must not contain one.
 */
function zx80Line(lineNo: number, body: ArrayLike<number>): number[] {
  return [lineNo >> 8, lineNo & 0xff, ...Array.from(body), ZX8081_NEWLINE];
}

function buildZx80RemImage(body: Uint8Array, entry: number): Zx8081ProgramImage {
  const newline = body.indexOf(ZX8081_NEWLINE);
  if (newline >= 0) {
    throw new Zx8081ImageError(
      `The code has a $76 byte at ${hex4(ZX80_REM_BODY + newline)}. A ZX80 REM line cannot hold ` +
        `one (the ROM would take it for the end of the line): avoid the byte (HALT, LD (HL),(HL)) ` +
        `or spell out the whole program image from $4000.`
    );
  }
  const line1 = zx80Line(1, [ZX80_TOKEN_REM, ...body]);
  // --- `RANDOMISE USR(n)`: functions are letters on the ZX80, numbers their digits
  const usr = ["U", "S", "R"].map((ch) => zx8081CharCode(ch, false)!);
  const line2 = zx80Line(2, [
    ZX80_TOKEN_RANDOMISE,
    ...usr,
    ZX80_TOKEN_OPEN_PAREN,
    ...zx8081Digits(entry),
    ZX80_TOKEN_CLOSE_PAREN
  ]);
  const vars = ZX80_PROGRAM + line1.length + line2.length;
  const eLine = vars + 1;

  const data = new Uint8Array(eLine - ZX80_IMAGE_BASE);
  const byte = (address: number, value: number) => (data[address - ZX80_IMAGE_BASE] = value & 0xff);
  const word = (address: number, value: number) => {
    byte(address, value);
    byte(address + 1, value >> 8);
  };

  // --- The system variables as the ZX80 itself saves them (`test/zx8081-hw/fixtures/hi.o`); the
  // --- display file lies beyond E_LINE, is not saved, and the ROM rebuilds it
  byte(Z80V.ERR_NR, 0xff);
  byte(Z80V.FLAGS, 0x04);
  word(Z80V.P_PTR, eLine);
  word(Z80V.E_PPC, 2);
  word(Z80V.VARS, vars);
  word(Z80V.E_LINE, eLine);
  word(Z80V.D_FILE, eLine + 2);
  word(Z80V.DF_EA, eLine + 2 + 0x17);
  word(Z80V.DF_END, eLine + 2 + 0x17 + 3);
  byte(Z80V.DF_SZ, 2);
  word(Z80V.T_ADDR, 0x078e);
  byte(Z80V.S_POSN, 0x21);
  byte(Z80V.S_POSN + 1, 0x17);
  word(Z80V.CH_ADD, 0xffff);

  data.set([...line1, ...line2, 0x80], ZX80_PROGRAM - ZX80_IMAGE_BASE);
  return { isZx81: false, layout: "rem", base: ZX80_IMAGE_BASE, data, eLine, entry };
}

// ==========================================================================================
// Full images

function checkFullImage(
  bytes: Uint8Array,
  base: number,
  isZx81: boolean,
  entry: number | undefined
): Zx8081ProgramImage {
  const machine = isZx81 ? "ZX81" : "ZX80";
  const program = isZx81 ? ZX81_PROGRAM : ZX80_PROGRAM;
  if (base + bytes.length <= program) {
    throw new Zx8081ImageError(
      `A full ${machine} program image must run from ${hex4(base)} past the system variables ` +
        `(to ${hex4(program)} at least).`
    );
  }
  const word = (address: number) => bytes[address - base] | (bytes[address - base + 1] << 8);
  const eLine = word(isZx81 ? Z81.E_LINE : Z80V.E_LINE);
  const vars = word(isZx81 ? Z81.VARS : Z80V.VARS);
  const end = base + bytes.length;
  const problems: string[] = [];
  if (eLine !== end) {
    problems.push(`E_LINE is ${hex4(eLine)}, but the image ends at ${hex4(end)}`);
  }
  if (vars < program || vars >= end) {
    problems.push(`VARS (${hex4(vars)}) is not inside the image`);
  }
  if (isZx81) {
    const dFile = word(Z81.D_FILE);
    if (dFile < program || dFile >= vars) {
      problems.push(`D_FILE (${hex4(dFile)}) is not between the program and VARS`);
    }
  }
  if (problems.length > 0) {
    throw new Zx8081ImageError(
      `The ${machine} program image starting at ${hex4(base)} is inconsistent: ${problems.join("; ")}.`
    );
  }
  return { isZx81, layout: "full", base, data: bytes.slice(), eLine, entry };
}
