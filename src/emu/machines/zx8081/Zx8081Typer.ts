import { ZX8081_KEY } from "./Zx8081KeyCode";

/**
 * The keys that type a character, after CLK's `CharacterMapper` tables (MIT; Copyright (c) 2015 Thomas Harte - the full notice is in
 * THIRD_PARTY_NOTICES.md). Letters are unshifted (the ROMs show capitals); the ROM's cursor mode
 * decides whether a letter becomes a keyword, so a typed string is keystrokes, not text.
 */
const common: Record<string, string[]> = {
  "\b": ["Shift", "N0"],
  "\n": ["NewLine"],
  "\r": ["NewLine"],
  " ": ["Space"],
  $: ["Shift", "U"],
  "(": ["Shift", "I"],
  ")": ["Shift", "O"],
  "-": ["Shift", "J"],
  "+": ["Shift", "K"],
  "=": ["Shift", "L"],
  ":": ["Shift", "Z"],
  ";": ["Shift", "X"],
  "?": ["Shift", "C"],
  "/": ["Shift", "V"],
  "<": ["Shift", "N"],
  ">": ["Shift", "M"],
  ",": ["Shift", "Period"],
  "£": ["Shift", "Space"],
  ".": ["Period"]
};

const zx81: Record<string, string[]> = { ...common, '"': ["Shift", "P"], "*": ["Shift", "B"] };
const zx80: Record<string, string[]> = { ...common, '"': ["Shift", "Y"], "*": ["Shift", "P"] };

/**
 * The key codes that type `ch` on a ZX81 or ZX80 (the first is the shift when there is one), or
 * undefined for a character the keyboard cannot type.
 */
export function zx8081KeysForCharacter(ch: string, isZx81: boolean): number[] | undefined {
  const table = isZx81 ? zx81 : zx80;
  let names = table[ch];
  if (!names) {
    const upper = ch.toUpperCase();
    if (/^[A-Z]$/.test(upper)) names = [upper];
    else if (/^[0-9]$/.test(ch)) names = [`N${ch}`];
  }
  return names?.map((name) => ZX8081_KEY[name]);
}

/** A string as key chords; throws on a character the keyboard cannot type */
export function zx8081KeysForText(text: string, isZx81: boolean): number[][] {
  return [...text].map((ch) => {
    const keys = zx8081KeysForCharacter(ch, isZx81);
    if (!keys) throw new Error(`The ${isZx81 ? "ZX81" : "ZX80"} keyboard cannot type '${ch}'`);
    return keys;
  });
}

/** The auto-load commands (CLK's static analyser): `LOAD ""` on the ZX81, `LOAD` on the ZX80 */
export const ZX81_LOAD_COMMAND = 'J""\n';
export const ZX80_LOAD_COMMAND = "W\n";
/** And the auto-RUN once the load finished: `RUN` is R in K mode on both */
export const ZX8081_RUN_COMMAND = "R\n";
