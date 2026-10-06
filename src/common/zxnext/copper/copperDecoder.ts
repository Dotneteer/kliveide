/*
 * The ZX Spectrum Next Copper instruction decoder.
 *
 * One pure module (no React, no Node) shared by everything that shows a Copper word: the Copper
 * side-bar panel, the Copper List document, the debugger's stop message, the Breakpoints panel and
 * the assembler's `.copper` hover. See `.plans/COPPER_DEBUGGING_PLAN.md` §4.1.
 *
 * Encoding (`_input/next-fpga/src/video/copper.vhd`; the C core mirrors it in `zxnext-copper.c`):
 *
 *   WAIT  1HHHHHHL LLLLLLLL   line L (9 bits, compared with `cvc`), horizontal position H (6 bits)
 *   MOVE  0RRRRRRR VVVVVVVV   NextReg R ($00-$7F) <- V; R = 0 is a NOP (no write pulse)
 *
 * A WAIT is satisfied when `cvc == line && hc_ula >= H*8 + 12`. `hc_ula` 0 is twelve pixels before
 * paper x 0, so H*8 is the paper x the WAIT releases at; Klive's visual-test macros
 * (`test/visual/copper/_include/copper-macros.z80asm`) use the same arithmetic. `$FFFF`
 * (WAIT 511,63) never matches and is the HALT idiom.
 */
import { getNextRegDescriptor } from "@emu/machines/zxNext/nextRegDescriptors";
import { isFlagSlice, sliceMask, sliceText, sliceValue } from "../nextRegSlices";

/** Copper list RAM size in bytes, and in instructions. */
export const COPPER_RAM_BYTES = 0x800;
export const COPPER_LIST_LENGTH = 0x400;

/** The HALT idiom: WAIT 511,63. */
export const COPPER_HALT_WORD = 0xffff;

export type CopperInstruction =
  | {
      kind: "wait";
      index: number;
      word: number;
      line: number;
      hpos: number;
      /** The `hc_ula` the WAIT releases at: hpos*8 + 12. */
      hc: number;
      /** The paper x the WAIT releases at: hpos*8. */
      paperX: number;
    }
  | { kind: "move"; index: number; word: number; reg: number; value: number; regName?: string }
  /** MOVE to register 0: no write pulse; the value is ignored. */
  | { kind: "nop"; index: number; word: number; value: number }
  /** WAIT 511,63 */
  | { kind: "halt"; index: number; word: number };

export type CopperInstructionKind = CopperInstruction["kind"];

/** The beam geometry of the live timing mode (trap T4): never a constant. */
export type CopperTiming = {
  /** Number of `cvc` lines in a frame */
  lines: number;
  /** Number of `hc_ula` positions in a line */
  hcs: number;
};

/** The 50 Hz geometry; a default for tests and for a machine that cannot report its own. */
export const COPPER_TIMING_50HZ: CopperTiming = { lines: 311, hcs: 456 };

export type CopperListSummary = {
  /** Instructions up to and including the last non-zero word (0 for an empty list). */
  usedLength: number;
  /** Index of the first HALT within the used part, if any. */
  haltIndex?: number;
  /** Whether a HALT terminates the used part of the list. */
  terminated: boolean;
  /** The trailing run of zero words (NOPs) after the used part. */
  trailingNops: number;
  /** WAITs (other than the HALT idiom) that can never match under the given timing (trap T5). */
  parks: number[];
  /** WAITs whose line is earlier than the previous WAIT's line (they wait for the next frame). */
  orderWarnings: number[];
};

/**
 * Decodes one Copper word.
 * @param index The list index (0..$3FF)
 * @param word The 16-bit word, high byte first as the Copper reads it
 */
export function decodeCopperWord(index: number, word: number): CopperInstruction {
  word &= 0xffff;
  if (word === COPPER_HALT_WORD) {
    return { kind: "halt", index, word };
  }
  if (word & 0x8000) {
    const line = word & 0x1ff;
    const hpos = (word >> 9) & 0x3f;
    return { kind: "wait", index, word, line, hpos, hc: hpos * 8 + 12, paperX: hpos * 8 };
  }
  const reg = (word >> 8) & 0x7f;
  const value = word & 0xff;
  if (reg === 0) {
    return { kind: "nop", index, word, value };
  }
  return { kind: "move", index, word, reg, value, regName: getNextRegDescriptor(reg)?.description };
}

/** Reads the big-endian word at a list index from Copper RAM. */
export function copperWordAt(ram: Uint8Array, index: number): number {
  const at = (index & 0x3ff) * 2;
  return ((ram[at] ?? 0) << 8) | (ram[at + 1] ?? 0);
}

/** Decodes the whole list RAM: always 1024 entries (a short array is padded with zero words). */
export function decodeCopperList(ram: Uint8Array): CopperInstruction[] {
  const result: CopperInstruction[] = [];
  for (let i = 0; i < COPPER_LIST_LENGTH; i++) {
    result.push(decodeCopperWord(i, copperWordAt(ram, i)));
  }
  return result;
}

/** Whether a WAIT can never match under a timing: its line or its position is past the frame. */
export function isCopperWaitPark(
  instr: Extract<CopperInstruction, { kind: "wait" }>,
  timing: CopperTiming
): boolean {
  return instr.line >= timing.lines || instr.hc >= timing.hcs;
}

/**
 * Analyzes a decoded list: its used length, termination, trailing NOPs, never-matching WAITs and
 * WAITs out of raster order.
 */
export function analyzeCopperList(
  list: CopperInstruction[],
  timing: CopperTiming = COPPER_TIMING_50HZ
): CopperListSummary {
  let usedLength = 0;
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].word !== 0) {
      usedLength = i + 1;
      break;
    }
  }
  let haltIndex: number | undefined;
  const parks: number[] = [];
  const orderWarnings: number[] = [];
  let lastWaitLine: number | undefined;
  for (let i = 0; i < usedLength; i++) {
    const instr = list[i];
    if (instr.kind === "halt") {
      haltIndex = i;
      break;
    }
    if (instr.kind !== "wait") continue;
    if (isCopperWaitPark(instr, timing)) {
      parks.push(i);
    } else {
      if (lastWaitLine !== undefined && instr.line < lastWaitLine) {
        orderWarnings.push(i);
      }
      lastWaitLine = instr.line;
    }
  }
  return {
    usedLength,
    haltIndex,
    terminated: haltIndex !== undefined,
    trailingNops: list.length - usedLength,
    parks,
    orderWarnings
  };
}

// ---------------------------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------------------------

const hex = (value: number, digits: number) => value.toString(16).toUpperCase().padStart(digits, "0");

/** `$00B`: a list index. */
export const formatCopperIndex = (index: number) => `$${hex(index & 0x3ff, 3)}`;

/** `$BE78`: a Copper word. */
export const formatCopperWord = (word: number) => `$${hex(word & 0xffff, 4)}`;

/** The mnemonic: WAIT, MOVE, NOP or HALT. */
export const copperMnemonic = (instr: CopperInstruction) => instr.kind.toUpperCase();

/**
 * The operands, as the `.copper` pragma would take them. WAIT operands are decimal (a line and a
 * horizontal position), unless `hex` is set; MOVE operands are hex, unless `hex` is `false`.
 */
export function formatCopperOperands(instr: CopperInstruction, opts?: { hex?: boolean }): string {
  switch (instr.kind) {
    case "wait":
      return opts?.hex
        ? `$${hex(instr.line, 3)}, $${hex(instr.hpos, 2)}`
        : `${instr.line}, ${instr.hpos}`;
    case "move":
      return opts?.hex === false
        ? `${instr.reg}, ${instr.value}`
        : `$${hex(instr.reg, 2)}, $${hex(instr.value, 2)}`;
    default:
      return "";
  }
}

/** `WAIT 120, 31`, `MOVE $41, $FC`, `NOP`, `HALT`. */
export function formatCopperInstruction(instr: CopperInstruction, opts?: { hex?: boolean }): string {
  const operands = formatCopperOperands(instr, opts);
  return operands ? `${copperMnemonic(instr)} ${operands}` : copperMnemonic(instr);
}

/**
 * What a MOVE's value means for its register: the register's slice text where it has slices,
 * otherwise nothing beyond the register name.
 */
export function describeCopperMoveValue(reg: number, value: number): string | undefined {
  const descriptor = getNextRegDescriptor(reg);
  if (!descriptor?.slices?.length) return undefined;
  const parts: string[] = [];
  for (const slice of descriptor.slices) {
    if (isFlagSlice(slice)) {
      if (sliceValue(value, slice) && slice.description) parts.push(slice.description);
    } else if (sliceMask(slice) !== 0) {
      const named = slice.valueSet?.[sliceValue(value, slice)];
      if (named) parts.push(named);
      else if (slice.description) parts.push(sliceText(value, slice) + ` = ${sliceValue(value, slice)}`);
    }
  }
  return parts.length ? parts.join("; ") : undefined;
}

/**
 * The colour a palette-value MOVE writes, as CSS `#rrggbb`, or `undefined` for other registers.
 * `$41` is RRRGGGBB; a MOVE to `$44` is shown by the same 8 bits because a single MOVE cannot know
 * whether it is the first byte (RRRGGGBB) or the second (the blue LSB) of the 9-bit pair.
 */
export function copperMoveSwatch(reg: number, value: number): string | undefined {
  if (reg !== 0x41 && reg !== 0x44) return undefined;
  const r3 = (value >> 5) & 0x07;
  const g3 = (value >> 2) & 0x07;
  const b2 = value & 0x03;
  // --- 8-bit to 9-bit: the blue LSB is the OR of the two blue bits (the Next's own rule)
  const b3 = (b2 << 1) | (b2 ? 1 : 0);
  const to8 = (c3: number) => Math.round((c3 * 255) / 7);
  return `#${hex(to8(r3), 2)}${hex(to8(g3), 2)}${hex(to8(b3), 2)}`.toLowerCase();
}

/**
 * The meaning column: `line 120 · x 248`, `Palette Value (8 bit) ← $FC`, `NOP (value $12 ignored)`,
 * `halt until the next restart`.
 */
export function describeCopperInstruction(
  instr: CopperInstruction,
  timing?: CopperTiming
): string {
  switch (instr.kind) {
    case "wait": {
      const base = `line ${instr.line} · x ${instr.paperX}`;
      return timing && isCopperWaitPark(instr, timing) ? `${base} · never matches` : base;
    }
    case "move": {
      const name = instr.regName ?? `NextReg $${hex(instr.reg, 2)}`;
      const detail = describeCopperMoveValue(instr.reg, instr.value);
      return `${name} ← $${hex(instr.value, 2)}${detail ? ` (${detail})` : ""}`;
    }
    case "nop":
      return instr.value ? `NOP (value $${hex(instr.value, 2)} ignored)` : "NOP";
    case "halt":
      return "halt until the next restart";
  }
}

/**
 * The shape of an instruction, used to match live Copper RAM against assembled `.copper` blocks
 * (plan D8): WAIT vs MOVE plus the register, ignoring the operands the CPU may patch at runtime.
 */
export function copperShapeOf(word: number): string {
  const instr = decodeCopperWord(0, word);
  switch (instr.kind) {
    case "move":
      return `M${instr.reg}`;
    case "nop":
      return "N";
    case "halt":
      return "H";
    case "wait":
      return "W";
  }
}
