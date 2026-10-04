/*
 * The Blink's LCD pointer registers decoded to the memory they point at (issue #1417).
 *
 * Each register holds the top bits of a 22-bit address - an 8-bit bank and an offset in the bank -
 * shifted down by the alignment the table needs. The arithmetic is OZvm's `BlinkLcd`, and the C
 * renderer (`z88-screen.c`) uses the same:
 *
 * | Register          | Bits | Alignment | Address        |
 * |-------------------|------|-----------|----------------|
 * | PB0 (LORES0)      | 13   | 512       | value << 9     |
 * | PB1 (LORES1)      | 10   | 4K        | value << 12    |
 * | PB2 (HIRES0)      | 9    | 8K        | value << 13    |
 * | PB3 (HIRES1)      | 11   | 2K        | value << 11    |
 * | SBF (Screen Base) | 11   | 2K        | value << 11    |
 *
 * The 24-bit form is `bank << 16 | offset` (the bank in the top byte, then the 16-bit offset), the
 * extended address OZ, OZvm and the memory views use: SBF $0127 is $243800, bank $24 offset $3800.
 */

/** A decoded LCD pointer */
export type Z88ScreenPointer = {
  /** The bank (0-255) */
  bank: number;
  /** The offset in the bank (0-$3FFF) */
  offset: number;
  /** `bank << 16 | offset`, the 24-bit extended address */
  ext24: number;
};

function fromExt24(ext24: number): Z88ScreenPointer {
  return { bank: (ext24 >>> 16) & 0xff, offset: ext24 & 0x3fff, ext24 };
}

/** PB0, LORES0: the 64 user-defined 6x8 characters */
export function z88Pb0Address(value: number): Z88ScreenPointer {
  return fromExt24(((((value << 3) & 0xf700) | ((value << 1) & 0x003f)) << 8) >>> 0);
}

/** PB1, LORES1: the 448 6x8 characters of the OZ fonts */
export function z88Pb1Address(value: number): Z88ScreenPointer {
  return fromExt24(((((value << 6) & 0xff00) | ((value << 4) & 0x0030)) << 8) >>> 0);
}

/** PB2, HIRES0: the 768 8x8 characters of the PipeDream map */
export function z88Pb2Address(value: number): Z88ScreenPointer {
  return fromExt24(((((value << 7) & 0xff00) | ((value << 5) & 0x0020)) << 8) >>> 0);
}

/** PB3, HIRES1: the 256 8x8 characters of the OZ window font */
export function z88Pb3Address(value: number): Z88ScreenPointer {
  return fromExt24(((((value << 5) & 0xff00) | ((value << 3) & 0x0038)) << 8) >>> 0);
}

/** SBF, the Screen Base File: the (character, attribute) pairs of the LCD, 256 bytes per text row */
export function z88SbfAddress(value: number): Z88ScreenPointer {
  return fromExt24(((((value << 5) & 0xff00) | ((value << 3) & 0x0038)) << 8) >>> 0);
}

/** The size of the Screen Base File for an LCD of `sch` text rows: 256 bytes a row (2K on 64 lines) */
export function z88SbfSize(sch: number): number {
  return sch * 256;
}

/** A 24-bit extended address as OZvm prints it: six hex digits and `h` (`243800h`) */
export function formatZ88Ext24(ext24: number): string {
  return `${(ext24 & 0xffffff).toString(16).toUpperCase().padStart(6, "0")}h`;
}
