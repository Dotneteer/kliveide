import { Cz88KeyboardLayout } from "./cz88-keys";
import { defaultZ88KeyboardLayout } from "./key-layout-default";

/**
 * Defines the german keys that differ from the default layout
 */
const deLayoutDiff: Cz88KeyboardLayout = {
  /* 1st (top) row */
  N1: {
    key: "1",
    symbol: "!",
    secondSymbol: "\\"
  },
  N2: {
    key: "2",
    symbol: "\"",
    secondSymbol: "@"
  },
  N3: {
    key: "3",
    symbol: "\u00a7", /* § */
    secondSymbol: "\u00a3", /* £ */
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
    symbol: "&",
    secondSymbol: "\u00b0" /* ° */
  },
  N7: {
    key: "7",
    symbol: "/",
    secondSymbol: "{"
  },
  N8: {
    key: "8",
    symbol: "(",
    secondSymbol: "}"
  },
  N9: {
    key: "9",
    symbol: ")",
    secondSymbol: "["
  },
  N0: {
    key: "0",
    symbol: "=",
    secondSymbol: "]"
  },
    Minus: {
    key: "\u00df", /* ß */
    symbol: "?",
    secondSymbol: "\u20ac" /* € */
  },
  Equal: {
    key: "´",
    symbol: "`"
  },
  Backslash: {
    key: "<",
    symbol: ">"
  },
  /* 2nd row */
  Y: {
    key: "Z"
  },
  SBracketL: {
    key: "\u00dc" /* Ü */
  },
  SBracketR: {
    key: "+",
    symbol: "*"
  },
  /* 3rd row */
  Semicolon: {
    key: "\u00d6" /* Ö */
  },
  Quote: {
    key: "\u00c4" /* Ä */
  },
  Pound: {
    key: "#",
    symbol: "^"
  },
  /* 4th row */
  Z: {
    key: "Y"
  },
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
 * The German (DE) Z88 keyboard layout
 */
export const deZ88KeyboardLayout = {...defaultZ88KeyboardLayout, ...deLayoutDiff }
