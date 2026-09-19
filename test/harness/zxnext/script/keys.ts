/*
 * Key names for the session's `keyDown` / `keyUp`: the 40 keys of the Spectrum matrix and the Next's
 * 16 extra membrane keys, as the machines' `setKeyStatus` codes (SpectrumKeyCode 0-39, NextExtraKeyCode
 * 40-55).
 */

const MATRIX_ROWS = [
  ["CAPS", "Z", "X", "C", "V"],
  ["A", "S", "D", "F", "G"],
  ["Q", "W", "E", "R", "T"],
  ["1", "2", "3", "4", "5"],
  ["0", "9", "8", "7", "6"],
  ["P", "O", "I", "U", "Y"],
  ["ENTER", "L", "K", "J", "H"],
  ["SPACE", "SYM", "M", "N", "B"]
] as const;

/** In `o_extended_keys` bit order (membrane.vhd): code 40 + index. */
const EXTRA_KEYS = [
  "EXTEND", "UP", "CAPS LOCK", "GRAPH", "TRUE VIDEO", "INV VIDEO", "BREAK", "EDIT",
  ";", '"', ",", ".", "DELETE", "RIGHT", "LEFT", "DOWN"
] as const;

export type MatrixKey = (typeof MATRIX_ROWS)[number][number];
export type ExtraKey = (typeof EXTRA_KEYS)[number];
export type NextKey = MatrixKey | ExtraKey;

export const MATRIX_KEYS: readonly MatrixKey[] = MATRIX_ROWS.flat();
export const NEXT_EXTRA_KEYS: readonly ExtraKey[] = EXTRA_KEYS;

export function keyCode(key: NextKey): number {
  const matrix = MATRIX_KEYS.indexOf(key as MatrixKey);
  if (matrix >= 0) return matrix;
  const extra = EXTRA_KEYS.indexOf(key as ExtraKey);
  if (extra >= 0) return 40 + extra;
  throw new Error(`Unknown key '${key}'`);
}
