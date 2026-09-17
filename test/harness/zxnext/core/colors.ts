/**
 * Colour notation used in `case.json`.
 *
 * - `#RRGGBB`            what the pixel buffer holds, verbatim.
 * - `rgb333:R,G,B`       a 9-bit Next colour, three 0..7 components.
 * - `next8:0xNN`         an 8-bit RRRGGGBB NextReg value ($41, $4A, ...). The 9th (lowest) blue bit
 *                        is the OR of the two blue bits, as the Next expands 8-bit writes.
 *
 * Expected colours in a case are written in *hardware* terms (the value a register receives), so
 * the expectation does not quietly borrow the emulator's own conversion code. 3→8 bit expansion
 * `v<<5 | v<<2 | v>>1` gives the ULA colours Klive shows (5 → $B6, 7 → $FF).
 */
export function expand3(v: number): number {
  return ((v << 5) | (v << 2) | (v >> 1)) & 0xff;
}

export function rgb333ToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((c) => expand3(c & 7).toString(16).padStart(2, "0")).join("").toUpperCase();
}

export function next8ToHex(value: number): string {
  const r = (value >> 5) & 7;
  const g = (value >> 2) & 7;
  const bb = value & 3;
  const b = (bb << 1) | (bb !== 0 ? 1 : 0);
  return rgb333ToHex(r, g, b);
}

/** The ZX Spectrum ULA colours 0..7 (non-bright) as Klive's default Next palette shows them. */
export const ULA_COLORS = [0, 1, 2, 3, 4, 5, 6, 7].map((c) =>
  rgb333ToHex(c & 2 ? 5 : 0, c & 4 ? 5 : 0, c & 1 ? 5 : 0)
);

export function parseColor(spec: string): string {
  const s = spec.trim();
  if (/^#[0-9a-f]{6}$/i.test(s)) return s.toUpperCase();
  let m = /^rgb333:\s*([0-7])\s*,\s*([0-7])\s*,\s*([0-7])$/i.exec(s);
  if (m) return rgb333ToHex(+m[1], +m[2], +m[3]);
  m = /^next8:\s*(0x[0-9a-f]{1,2}|\$[0-9a-f]{1,2}|\d+)$/i.exec(s);
  if (m) return next8ToHex(parseInt(m[1].replace("$", "0x"), m[1].match(/^(0x|\$)/i) ? 16 : 10));
  m = /^ula:\s*([0-7])$/i.exec(s);
  if (m) return ULA_COLORS[+m[1]];
  throw new Error(`Unrecognised colour '${spec}' (use #RRGGBB, rgb333:R,G,B, next8:0xNN or ula:N)`);
}
