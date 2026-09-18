import { createSession, displayFileAddress, next8ToHex, type CoreName, type NextTestSession } from "../../harness/zxnext";

/*
 * Shared setup for the ULA screen tests (catalogue §4.8).
 *
 * Buffer geometry (test/harness/zxnext/core/beam.ts): paper row r is buffer row 48 + r, paper x is
 * buffer x 96 + 2x, the border is x 0-95 / 608-719 and rows 0-47 / 240-287.
 */

export const PAPER_TOP = 48;
export const PAPER_LEFT = 96;

/** A session with the CPU parked (DI; JR $), so nothing but the test changes the hardware. */
export async function parkedSession(core: CoreName): Promise<NextTestSession> {
  const s = await createSession(core);
  await s.loadCode(" .org $8000\n di\n jr $");
  return s;
}

/**
 * Writes 8-bit palette entries through $40/$41. `select` is the $43 value used for the writes (bits 6-4
 * pick the palette: $00 first ULA, $40 second ULA, $10 first Layer 2, $30 first tilemap); $43 is left at
 * `select`, which also sets the displayed-palette bits in 3-1.
 */
export function writePalette(s: NextTestSession, entries: Array<[number, number]>, select = 0x00): NextTestSession {
  s.setNextReg(0x43, select);
  for (const [index, value] of entries) s.setNextReg(0x40, index).setNextReg(0x41, value);
  return s;
}

/** Fills the 6144-byte display file with `bitmap` and the 768 attributes with `attr`. */
export function fillScreen(s: NextTestSession, bitmap: number, attr: number): NextTestSession {
  return s.poke(0x4000, new Array(0x1800).fill(bitmap)).poke(0x5800, new Array(768).fill(attr));
}

/** Pokes one character cell: 8 bitmap bytes and the attribute. */
export function pokeCell(s: NextTestSession, charRow: number, col: number, bitmap: number | number[], attr: number): NextTestSession {
  for (let line = 0; line < 8; line++) {
    s.poke(displayFileAddress(charRow * 8 + line, col), Array.isArray(bitmap) ? bitmap[line] : bitmap);
  }
  return s.poke(0x5800 + charRow * 32 + col, attr);
}

/** The distinct colours in a buffer rectangle (inclusive), sorted and comma-joined. */
export function colours(s: NextTestSession, x: [number, number], y: [number, number]): string {
  const seen = new Set<string>();
  for (let yy = y[0]; yy <= y[1]; yy++) for (let xx = x[0]; xx <= x[1]; xx++) seen.add(s.pixel(xx, yy));
  return [...seen].sort().join(",");
}

/** The buffer colour of an 8-bit NextReg colour value. */
export const hex8 = next8ToHex;

/**
 * 32 distinct 8-bit colours for ULA palette entries 0-31, none equal to $E3 (the reset value of the
 * global transparency $14 and the fallback $4A), so no ULA pixel is transparent by accident.
 */
export const DISTINCT_32: number[] = (() => {
  const out: number[] = [];
  for (let i = 0; out.length < 32; i++) {
    const v = (i * 37 + 5) & 0xff;
    if (v !== 0xe3 && !out.includes(v)) out.push(v);
  }
  return out;
})();
