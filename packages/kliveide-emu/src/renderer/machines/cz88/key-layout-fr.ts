import { Cz88KeyboardLayout } from "./cz88-keys";
import { defaultZ88KeyboardLayout } from "./key-layout-default";

/**
 * Defines the FR keys that differ from the default layout
 */
const frLayoutDiff: Cz88KeyboardLayout = {
  /* 1st (top) row */
  N1: {
    key: "&",
    symbol: "1",
    secondSymbol: "\\"
  },
  N2: {
    key: "\u00e9",  /* é */
    symbol: "2",
    secondSymbol: "@"
  },
  N3: {
    key: "\"",
    symbol: "3",
    secondSymbol: "#"
  },
  N4: {
    key: "\'",
    symbol: "4",
    secondSymbol: "|"
  },
  N5: {
    key: "(",
    symbol: "5",
    secondSymbol: "~"
  },
  N6: {
    key: "\u00a7", /* § */
    symbol: "6",
    secondSymbol: "^"
  },
  N7: {
    key: "\u00e8", /* è */
    symbol: "7",
    secondSymbol: "{"
  },
  N8: {
    key: "!",
    symbol: "8",
    secondSymbol: "}"
  },
  N9: {
    key: "\u00e7", /* ç */
    symbol: "9",
    secondSymbol: "["
  },
  N0: {
    key: "\u00e0", /* à */
    symbol: "0",
    secondSymbol: "]"
  },
    Minus: {
    key: ")",
    symbol: "\u00b0", /* ° */
    secondSymbol: "`"
  },
  Equal: {
    key: "-",
    symbol: "_"
  },
  Backslash: {
    key: "<",
    symbol: ">"
  },
  /* 2nd row */
  Q: {
    key: "A"
  },
  W: {
    key: "S"
  },
  SBracketL: {
    key: "*",
    symbol: "\u00ef" /* ï */
  },
  SBracketR: {
    key: "=",
    symbol: "+"
  },
  /* 3rd row */
  A: {
    key: "Q"
  },
  Semicolon: {
    key: "M",
  },
  Quote: {
    key: "\u00f9", /* ù */
    symbol: "%"
  },
  Pound: {
    key: "\u005E",    /* ^ (Circumflex accent) */
    symbol: "\u00a8"  /* ¨ (Diaeresis) */
  },
  /* 4th row */
  Z: {
    key: "W"
  },
  M: {
    key: ",",
    symbol: "?"
  },
  Comma: {
    key: ";",
    symbol: "."
  },
  Period: {
    key: ":",
    symbol: "/"
  },
  Slash: {
    key: "$",
    symbol: "\u00a3", /* £ */
    secondSymbol: "\u20ac" /* € */
  }
}

/**
 * The French (FR) Z88 keyboard layout
 */
export const frZ88KeyboardLayout = {...defaultZ88KeyboardLayout, ...frLayoutDiff }
