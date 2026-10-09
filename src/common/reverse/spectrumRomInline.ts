/*
 * The inline bytes after `RST $08` and `RST $28` in the 48K BASIC ROM, as instruction lengths for
 * the reachability walk (`.plans/REVERSE_ENGINEERING_TOOLS_PLAN.md` §4.4).
 *
 * The same rules Klive's own ZX Spectrum 48 custom disassembler decodes by
 * (`zx-spectrum-48-disassembler.ts`), restated as a length: `RST $08` is followed by one report code;
 * `RST $28` (and `CALL $335E` / `CALL $3362`) by calculator literals up to `end-calc` ($38) or
 * `jump` ($33). `stk-data` ($34) and the series literals ($86/$88/$8C) carry floating-point data
 * whose length its first byte encodes. Applies only where the bytes are the 48K BASIC ROM — the
 * caller gates it, as the disassembler is gated (`rom-gated-disassembler.ts`).
 */

/** The bytes a calculator literal's first byte says follow it. */
function literalLength(first: number): number {
  return (first >> 6) + 1 + ((first & 0x3f) === 0 ? 1 : 0);
}

/** The length of the calculator stream starting at `offset`, up to and including its terminator. */
function calculatorStreamLength(bytes: ArrayLike<number>, offset: number): number {
  let i = offset;
  let series = 0;
  while (i < bytes.length) {
    const code = bytes[i++];
    if (series > 0) {
      i += literalLength(code);
      series--;
      continue;
    }
    switch (code) {
      case 0x38: // end-calc
        return i - offset;
      case 0x33: // jump: the stream ends after its displacement
        return i + 1 - offset;
      case 0x00: // jump-true
      case 0x35: // dec-jr-nz
        i++;
        break;
      case 0x34: // stk-data
        series = 1;
        break;
      case 0x86:
      case 0x88:
      case 0x8c:
        series = code - 0x80;
        break;
    }
  }
  return i - offset;
}

/**
 * The length of the instruction at `offset` with its inline bytes, or `undefined` for an
 * instruction that has none (the table's length applies).
 */
export function spectrumRomInstructionLength(bytes: ArrayLike<number>, offset: number): number | undefined {
  const op = bytes[offset];
  if (op === 0xcf) return 2;
  if (op === 0xef) return 1 + calculatorStreamLength(bytes, offset + 1);
  if (op === 0xcd && bytes[offset + 2] === 0x33 && (bytes[offset + 1] === 0x5e || bytes[offset + 1] === 0x62)) {
    return 3 + calculatorStreamLength(bytes, offset + 3);
  }
  return undefined;
}
