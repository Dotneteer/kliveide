import * as fs from "fs";

/**
 * Converts a ZX Spectrum string to intrinsic string
 * @param input ZX Spectrum string to convert
 */
export function convertSpectrumString (input: string): string {
  let result = "";
  let state: StrParseState = StrParseState.Normal;
  let collect = 0;
  for (const ch of input) {
    switch (state) {
      case StrParseState.Normal:
        if (ch === "\\") {
          state = StrParseState.Backslash;
        } else {
          result += ch;
        }
        break;

      case StrParseState.Backslash:
        state = StrParseState.Normal;
        switch (ch) {
          case "i": // INK
            result += String.fromCharCode(0x10);
            break;
          case "p": // PAPER
            result += String.fromCharCode(0x11);
            break;
          case "f": // FLASH
            result += String.fromCharCode(0x12);
            break;
          case "b": // BRIGHT
            result += String.fromCharCode(0x13);
            break;
          case "I": // INVERSE
            result += String.fromCharCode(0x14);
            break;
          case "o": // OVER
            result += String.fromCharCode(0x15);
            break;
          case "a": // AT
            result += String.fromCharCode(0x16);
            break;
          case "t": // TAB
            result += String.fromCharCode(0x17);
            break;
          case "P": // Pound sign
            result += String.fromCharCode(0x60);
            break;
          case "C": // Copyright sign
            result += String.fromCharCode(0x7f);
            break;
          case "0":
            result += String.fromCharCode(0x00);
            break;
          case "x":
            state = StrParseState.X;
            break;
          default:
            result += ch;
            break;
        }
        break;

      case StrParseState.X:
        if (
          (ch >= "0" && ch <= "9") ||
          (ch >= "a" && ch <= "f") ||
          (ch >= "A" && ch <= "F")
        ) {
          collect = parseInt(ch, 16);
          state = StrParseState.Xh;
        } else {
          result += "x";
          state = StrParseState.Normal;
        }
        break;

      case StrParseState.Xh:
        if (
          (ch >= "0" && ch <= "9") ||
          (ch >= "a" && ch <= "f") ||
          (ch >= "A" && ch <= "F")
        ) {
          collect = collect * 0x10 + parseInt(ch, 16);
          result += String.fromCharCode(collect);
          state = StrParseState.Normal;
        } else {
          result += String.fromCharCode(collect);
          result += ch;
          state = StrParseState.Normal;
        }
        break;
    }
  }

  // --- Handle the final machine state
  switch (state) {
    case StrParseState.Backslash:
      result += "\\";
      break;
    case StrParseState.X:
      result += "x";
      break;
    case StrParseState.Xh:
      result += String.fromCharCode(collect);
      break;
  }
  return result;
}

/**
 * States of the string parsing
 */
enum StrParseState {
  Normal,
  Backslash,
  X,
  Xh
}

/**
 * Reads the text of the specified file
 * @param filename File name
 * @param Handles UTF-8 with and without BOM header
 */
export function readTextFile (filename: string): string {
  const sourceText = fs.readFileSync(filename, "utf8");
  if (sourceText.length < 4) {
    return sourceText;
  }
  return sourceText.charCodeAt(0) >= 0xbf00 ? sourceText.substr(1) : sourceText;
}
