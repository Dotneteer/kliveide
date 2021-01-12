import { Cz88KeyboardLayout } from "./cz88-keys";
import { defaultZ88KeyboardLayout } from "./key-layout-default";

/**
 * Defines the SE/FI keys that differ from the default layout
 */
const seLayoutDiff: Cz88KeyboardLayout = {
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
  SBracketL: {
    key: "\u00c5", /* Å */
    symbol: "|",
    secondSymbol: "\\"
  },
  SBracketR: {
    key: "\'",
    symbol: "\"",
    secondSymbol: "`"
  },
  Semicolon: {
    key: "\u00d6", /* Ö */
    symbol: "[",
    secondSymbol: "{"
  },
  Quote: {
    key: "\u00c4", /* Ä */
    symbol: "]",
    secondSymbol: "}"
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
 * The Swedish/Finish (SE/FI) Z88 keyboard layout
 */
export const seZ88KeyboardLayout = {...defaultZ88KeyboardLayout, ...seLayoutDiff }
