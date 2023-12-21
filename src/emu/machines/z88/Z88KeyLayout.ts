/**
 * Represents the view of a Z88 key
 */
export interface Z88KeyView {
  key?: string;
  keyword?: string;
  symbol?: string;
  secondSymbol?: string;
  special?: string;
}

/**
 * Represents a keyboard layout
 */
export type Z88KeyboardLayout = Record<string, Z88KeyView>;

/**
 * The default Z88 keyboard layout
 * Property: Z88 key name
 * Value: UI key attributes:
 *   keyword: "keyword-like" button
 *   key: Main key (bottom left)
 *   symbol: Symbol key (top-right)
 *   secondSymbol: Second symbolkey (bottom-right)
 */
export const defaultZ88KeyboardLayout: Z88KeyboardLayout = {
  /* 1st (top) row */
  Escape: {
    keyword: "ESC"
  },
  N1: {
    key: "1",
    symbol: "!"
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
    key: "'",
    symbol: '"'
  },
  Pound: {
    key: "\u00a3" /* £ */,
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
    keyword: "⬆︎"
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
    keyword: "⬅︎"
  },
  Right: {
    keyword: "➡︎"
  },
  Down: {
    keyword: "⬇︎"
  }
};

/**
 * Defines the German keys that differ from the default layout
 */
const deLayoutDiff: Z88KeyboardLayout = {
  /* 1st (top) row */
  N1: {
    key: "1",
    symbol: "!",
    secondSymbol: "\\"
  },
  N2: {
    key: "2",
    symbol: '"',
    secondSymbol: "@"
  },
  N3: {
    key: "3",
    symbol: "\u00a7" /* § */,
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
    key: "\u00df" /* ß */,
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
};

/**
 * The German (DE) Z88 keyboard layout
 */
export const deZ88KeyboardLayout = {
  ...defaultZ88KeyboardLayout,
  ...deLayoutDiff
};

/**
 * Defines the Danish/Norwegian keys that differ from the default Z88 UK layout
 */
const dkLayoutDiff: Z88KeyboardLayout = {
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
    key: "\u00c5" /* Å */,
    symbol: "]",
    secondSymbol: "}",
    special: "dk"
  },
  SBracketR: {
    key: "'",
    symbol: '"'
  },
  /* 3rd row */
  Semicolon: {
    key: "\u00c6" /* Æ */,
    symbol: "[",
    secondSymbol: "{",
    special: "dk"
  },
  Quote: {
    key: "\u00d8" /* Ø */,
    symbol: "\\",
    secondSymbol: "|",
    special: "dk"
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
};

/**
 * The DK+NO Z88 keyboard layout
 */
export const dkZ88KeyboardLayout = {
  ...defaultZ88KeyboardLayout,
  ...dkLayoutDiff
};

/**
 * Defines the Spanish (ES) keys that differ from the default layout
 */
const esLayoutDiff: Z88KeyboardLayout = {
  /* 1st (top) row */
  N1: {
    key: "1",
    symbol: "\u00a1" /* ¡ */,
    secondSymbol: "\\"
  },
  N2: {
    key: "2",
    symbol: "\u00bf" /* ¿ */,
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
    key: "\u00b4" /* ´ (acute accent) */,
    symbol: "\u00a8" /* ¨ (Diaeresis) */
  },
  SBracketR: {
    key: "\u0060" /* ` (grave accent) */,
    symbol: "\u005E" /* ^ (Circumflex accent) */
  },
  /* 3rd row */
  Semicolon: {
    key: "\u00d1" /* Ñ */
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
    key: "'",
    symbol: '"'
  }
};

/**
 * The Spanish (ES) Z88 keyboard layout
 */
export const esZ88KeyboardLayout = {
  ...defaultZ88KeyboardLayout,
  ...esLayoutDiff
};

/**
 * Defines the french keys that differ from the default layout
 */
const frLayoutDiff: Z88KeyboardLayout = {
  /* 1st (top) row */
  N1: {
    key: "&",
    symbol: "1",
    secondSymbol: "\\"
  },
  N2: {
    key: "\u00e9" /* é */,
    symbol: "2",
    secondSymbol: "@"
  },
  N3: {
    key: '"',
    symbol: "3",
    secondSymbol: "#"
  },
  N4: {
    key: "'",
    symbol: "4",
    secondSymbol: "|"
  },
  N5: {
    key: "(",
    symbol: "5",
    secondSymbol: "~"
  },
  N6: {
    key: "\u00a7" /* § */,
    symbol: "6",
    secondSymbol: "^"
  },
  N7: {
    key: "\u00e8" /* è */,
    symbol: "7",
    secondSymbol: "{"
  },
  N8: {
    key: "!",
    symbol: "8",
    secondSymbol: "}"
  },
  N9: {
    key: "\u00e7" /* ç */,
    symbol: "9",
    secondSymbol: "["
  },
  N0: {
    key: "\u00e0" /* à */,
    symbol: "0",
    secondSymbol: "]"
  },
  Minus: {
    key: ")",
    symbol: "\u00b0" /* ° */,
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
    key: "M"
  },
  Quote: {
    key: "\u00f9" /* ù */,
    symbol: "%"
  },
  Pound: {
    key: "\u005E" /* ^ (Circumflex accent) */,
    symbol: "\u00a8" /* ¨ (Diaeresis) */
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
    symbol: "\u00a3" /* £ */,
    secondSymbol: "\u20ac" /* € */
  }
};

/**
 * The French (FR) Z88 keyboard layout
 */
export const frZ88KeyboardLayout = {
  ...defaultZ88KeyboardLayout,
  ...frLayoutDiff
};

/**
 * Defines the SE/FI keys that differ from the default layout
 */
const seLayoutDiff: Z88KeyboardLayout = {
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
    key: "\u00c5" /* Å */,
    symbol: "|",
    secondSymbol: "\\",
    special: "dk"
  },
  SBracketR: {
    key: "'",
    symbol: '"',
    secondSymbol: "`"
  },
  /* 3rd row */
  Semicolon: {
    key: "\u00d6" /* Ö */,
    symbol: "[",
    secondSymbol: "{",
    special: "dk"
  },
  Quote: {
    key: "\u00c4" /* Ä */,
    symbol: "]",
    secondSymbol: "}",
    special: "dk"
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
};

/**
 * The Swedish/Finish (SE/FI) Z88 keyboard layout
 */
export const seZ88KeyboardLayout = {
  ...defaultZ88KeyboardLayout,
  ...seLayoutDiff
};
