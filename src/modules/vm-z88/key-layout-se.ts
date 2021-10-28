import { Cz88KeyboardLayout } from "./cz88-keys";
import { defaultZ88KeyboardLayout } from "./key-layout-default";

/**
 * Defines the SE/FI keys that differ from the default layout
 */
const seLayoutDiff: Cz88KeyboardLayout = {
  /* 1st (top) row */
  Minus: {
    key: "=",
    symbol: "<"
  },
  Equal: {
    key: "+",
    symbol: ">"
  },
  Backslash: {
    key: "/",
    symbol: "?"
  },
  /* 2nd row */
  SBracketL: {
    key: "\u00c5", /* Å */
    symbol: "|",
    secondSymbol: "\\",
    special: "dk",
  },
  SBracketR: {
    key: "\'",
    symbol: "\"",
    secondSymbol: "`"
  },
  /* 3rd row */
  Semicolon: {
    key: "\u00d6", /* Ö */
    symbol: "[",
    secondSymbol: "{",
    special: "dk",
  },
  Quote: {
    key: "\u00c4", /* Ä */
    symbol: "]",
    secondSymbol: "}",
    special: "dk",
  },
  /* 4th row */
  Comma: {
    key: ",",
    symbol: ";"
  },
  Period: {
    key: ".",
    symbol: ":"
  },
  Slash: {
    key: "-",
    symbol: "_"
  }
}

/**
 * The Swedish/Finish (SE/FI) Z88 keyboard layout
 */
export const seZ88KeyboardLayout = {...defaultZ88KeyboardLayout, ...seLayoutDiff }
