import { Cz88KeyboardLayout } from "./cz88-keys";

/**
 * The default Z88 keyboard layout
 * Property: Z88 key name
 * Value: UI key attributes:
 *   keyword: "keyword-like" button
 *   key: Main key (bottom left)
 *   symbol: Symbol key (top-right)
 *   secondSymbol: Second symbolkey (bottom-right)
 */
export const defaultZ88KeyboardLayout: Cz88KeyboardLayout = {
  /* 1st (top) row */
  Escape: {
    keyword: "ESC",
  },
  N1: {
    key: "1",
    symbol: "!",
  },
  N2: {
    key: "2",
    symbol: "@"
  },
  N3: {
    key: "3",
    symbol: "#"
  },
  N4: {
    key: "4",
    symbol: "$"
  },
  N5: {
    key: "5",
    symbol: "%"
  },
  N6: {
    key: "6",
    symbol: "^"
  },
  N7: {
    key: "7",
    symbol: "&"
  },
  N8: {
    key: "8",
    symbol: "*"
  },
  N9: {
    key: "9",
    symbol: "("
  },
  N0: {
    key: "0",
    symbol: ")"
  },
  Minus: {
    key: "-",
    symbol: "_"
  },
  Equal: {
    key: "=",
    symbol: "+"
  },
  Backslash: {
    key: "\\",
    symbol: "|"
  },
  Delete: {
    keyword: "DEL"
  },
  /* 2nd row */
  Tab: {
    keyword: "TAB"
  },
  Q: {
    key: "Q"
  },
  W: {
    key: "W"
  },
  E: {
    key: "E"
  },
  R: {
    key: "R"
  },
  T: {
    key: "T"
  },
  Y: {
    key: "Y"
  },
  U: {
    key: "U"
  },
  I: {
    key: "I"
  },
  O: {
    key: "O"
  },
  P: {
    key: "P"
  },
  SBracketL: {
    key: "[",
    symbol: "{"
  },
  SBracketR: {
    key: "]",
    symbol: "}"
  },
  /* 3rd row */
  Diamond: {
    keyword: "\u25c7"
  },
  A: {
    key: "A"
  },
  S: {
    key: "S"
  },
  D: {
    key: "D"
  },
  F: {
    key: "F"
  },
  G: {
    key: "G"
  },
  H: {
    key: "H"
  },
  J: {
    key: "J"
  },
  K: {
    key: "K"
  },
  L: {
    key: "L"
  },
  Semicolon: {
    key: ";",
    symbol: ":"
  },
  Quote: {
    key: "\'",
    symbol: "\""
  },
  Pound: {
    key: "\u00a3", /* £ */
    symbol: "~",
    secondSymbol: "\u20ac" /* € */
  },
  /* 4th row */
  ShiftL: {
    keyword: "SHIFT"
  },
  Z: {
    key: "Z"
  },
  X: {
    key: "X"
  },
  C: {
    key: "C"
  },
  V: {
    key: "V"
  },
  B: {
    key: "B"
  },
  N: {
    key: "N"
  },
  M: {
    key: "M"
  },
  Comma: {
    key: ",",
    symbol: "<"
  },
  Period: {
    key: ".",
    symbol: ">"
  },
  Slash: {
    key: "/",
    symbol: "?"
  },
  ShiftR: {
    keyword: "SHIFT"
  },
  Up: {
    keyword: "\u21e7"
  },
  /* 5th row */
  Index: {
    keyword: "INDEX"
  },
  Menu: {
    keyword: "MENU"
  },
  Help: {
    keyword: "HELP"
  },
  Square: {
    keyword: "\u25fb"
  },
  Space: {
    keyword: "SPACE"
  },
  Left: {
    keyword: "\u21e6"
  },
  Right: {
    keyword: "\u21e8"
  },
  Down: {
    keyword: "\u21e9"
  },
};
