import { Cz88KeyboardLayout } from "./cz88-keys";
import { defaultZ88KeyboardLayout } from "./key-layout-default";

/**
 * Defines the Spanish (ES) keys that differ from the default layout
 */
const esLayoutDiff: Cz88KeyboardLayout = {
  /* 1st (top) row */
  N1: {
    key: "1",
    symbol: "\u00a1", /* ¡ */
    secondSymbol: "\\"
  },
  N2: {
    key: "2",
    symbol: "\u00bf",  /* ¿ */
    secondSymbol: "@"
  },
  N3: {
    key: "3",
    symbol: "#",
    secondSymbol: "\u00a3" /* £ */
  },
  N4: {
    key: "4",
    symbol: "$",
    secondSymbol: "|"
  },
  N5: {
    key: "5",
    symbol: "%",
    secondSymbol: "~"
  },
  N6: {
    key: "6",
    symbol: "/",
    secondSymbol: "^"
  },
  N7: {
    key: "7",
    symbol: "&",
    secondSymbol: "{"
  },
  N8: {
    key: "8",
    symbol: "*",
    secondSymbol: "}"
  },
  N9: {
    key: "9",
    symbol: "(",
    secondSymbol: "["
  },
  N0: {
    key: "0",
    symbol: ")",
    secondSymbol: "]"
  },
  Equal: {
    key: "=",
    symbol: "+",
    secondSymbol: "\u20ac" /* € (Euro) */
  },
  Backslash: {
    key: "\u00c7" /* Ç */
  },
  /* 2nd row */
  SBracketL: {
    key: "\u00b4",    /* ´ (acute accent) */
    symbol: "\u00a8"  /* ¨ (Diaeresis) */
  },
  SBracketR: {
    key: "\u0060",    /* ` (grave accent) */
    symbol: "\u005E"  /* ^ (Circumflex accent) */
  },
  /* 3rd row */
  Semicolon: {
    key: "\u00d1"     /* Ñ */
  },
  Quote: {
    key: ";",
    symbol: ":"
  },
  Pound: {
    key: "<",
    symbol: ">"
  },
  /* 4th row*/
  Comma: {
    key: ",",
    symbol: "?"
  },
  Period: {
    key: ".",
    symbol: "!"
  },
  Slash: {
    key: "\'",
    symbol: "\""
  }
}

/**
 * The Spanish (ES) Z88 keyboard layout
 */
export const esZ88KeyboardLayout = {...defaultZ88KeyboardLayout, ...esLayoutDiff }
