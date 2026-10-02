import { ZxSpectrumChars } from "@common/machines/char-codes";

/*
 * ZX Spectrum text from a tape - a header's file name, a BASIC string - turned into something a
 * label can show.
 *
 * A tape name is ten bytes of the Spectrum's own character set, not ASCII: `£` and `©` sit where
 * ASCII has a backtick and DEL, `$80`-`$8F` are block graphics, and a name may hold tokens and
 * control codes. Protection schemes use the last ones on purpose - a name that begins `16 01 00` is
 * `AT 1,0`, which moves the cursor before the name prints. `String.fromCharCode` turned all of these
 * into unreadable glyphs, so codes are written out in braces instead: `{AT 1,0}`.
 */

/* --- The quadrant graphics `$80`-`$8F`: bit 0 top right, bit 1 top left, bit 2 bottom right, bit 3
   --- bottom left. */
const BLOCK_GRAPHICS = " ▝▘▀▗▐▚▜▖▞▌▛▄▟▙█";

const CONTROL_NAMES: Record<number, string> = {
  0x10: "INK",
  0x11: "PAPER",
  0x12: "FLASH",
  0x13: "BRIGHT",
  0x14: "INVERSE",
  0x15: "OVER",
  0x16: "AT",
  0x17: "TAB"
};

const hex2 = (value: number) => value.toString(16).toUpperCase().padStart(2, "0");

/**
 * The display form of ZX Spectrum text.
 * @param bytes The characters
 * @param trimEnd Drop trailing spaces (a tape name is padded to ten characters)
 */
export function zxText(bytes: ArrayLike<number>, trimEnd = true): string {
  let text = "";
  let lastWasToken = false;
  for (let i = 0; i < bytes.length; i++) {
    const code = bytes[i];
    if (code >= 0x10 && code <= 0x17) {
      // --- A control code with its argument bytes (AT and TAB take two)
      const argCount = code >= 0x16 ? 2 : 1;
      const args: number[] = [];
      for (let a = 0; a < argCount && i + 1 < bytes.length; a++) args.push(bytes[++i]);
      text += `{${CONTROL_NAMES[code]} ${args.join(",")}}`;
      lastWasToken = false;
    } else if (code < 0x20) {
      text += `{$${hex2(code)}}`;
      lastWasToken = false;
    } else if (code === 0x60) {
      text += "£";
      lastWasToken = false;
    } else if (code === 0x7f) {
      text += "©";
      lastWasToken = false;
    } else if (code < 0x80) {
      text += String.fromCharCode(code);
      lastWasToken = false;
    } else if (code < 0x90) {
      text += BLOCK_GRAPHICS[code - 0x80];
      lastWasToken = false;
    } else if (code < 0xa5) {
      text += `{UDG ${String.fromCharCode(0x41 + code - 0x90)}}`;
      lastWasToken = false;
    } else {
      // --- A token prints with a space either side, as the ROM's LIST does
      const token = ZxSpectrumChars[code]?.t ?? `$${hex2(code)}`;
      text += `${lastWasToken || text === "" || text.endsWith(" ") ? "" : " "}${token} `;
      lastWasToken = true;
    }
  }
  return trimEnd ? text.replace(/\s+$/, "") : text;
}
