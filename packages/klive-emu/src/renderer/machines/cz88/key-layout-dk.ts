import { Cz88KeyboardLayout } from "./cz88-keys";
import { defaultZ88KeyboardLayout } from "./key-layout-default";

/**
 * Defines the Danish/Norwegian keys that differ from the default Z88 UK layout
 */
const dkLayoutDiff: Cz88KeyboardLayout = {
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
    symbol: "]",
    secondSymbol: "}",
    special: "dk",
  },
  SBracketR: {
    key: "\'",
    symbol: "\""
  },
  /* 3rd row */
  Semicolon: {
    key: "\u00c6", /* Æ */
    symbol: "[",
    secondSymbol: "{",
    special: "dk",
  },
  Quote: {
    key: "\u00d8", /* Ø */
    symbol: "\\",
    secondSymbol: "|",
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
 * The DK+NO Z88 keyboard layout
 */
export const dkZ88KeyboardLayout = {...defaultZ88KeyboardLayout, ...dkLayoutDiff }
