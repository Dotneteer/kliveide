/**
 * Error message type description
 */
type ErrorText = { [key: string]: string };

/**
 * DEscribes the structure of error messages
 */
export interface ParserErrorMessage {
  code: ErrorCodes;
  text: string;
  position: number;
  line: number;
  column: number;
}

export type ErrorCodes =
  | "Z1001"
  | "Z1002"
  | "Z1003"
  | "Z1004"
  | "Z1005"
  | "Z1006"
  | "Z1007"
  | "Z1008"
  | "Z1009"
  | "Z1010"
  | "Z1011"
  | "Z1012"
  | "Z1013"
  | "Z1014"
  | "Z1015"
  | "Z1016"
  | "Z1017"
  | "Z1018"
  | "Z1019"
  | "Z1020"
  | "Z1021"
  | "Z1022"
  | "Z2000"
  | "Z2001"
  | "Z2002"
  | "Z2003"
  | "Z2004"
  | "Z2005"
  | "Z2006"
  | "Z2007"
  | "Z2008"
  | "Z2009"
  | "Z2010"
  | "Z2011"
  | "Z2012"
  | "Z2013"
  | "Z2014"
  | "Z2015"
  | "Z2016"
  | "Z2017"
  | "Z2018"
  | "Z2019"
  | "Z2020"
  | "Z2021"
  | "Z2022"
  | "Z2023"

  | "Z3000"
  | "Z3001";

export const errorMessages: ErrorText = {
  Z1001: "Invalid token at the end of the line: {0}",
  Z1002: "A line cannot start with this token: {0}",
  Z1003: "An expression expected",
  Z1004: "An identifier expected",
  Z1005: "Cannot parse an integer literal",
  Z1006: "A string literal expected",
  Z1007: "A comma expected",
  Z1008: "DE register expected",
  Z1009: "B register expected",
  Z1010: "A register expected",
  Z1011: "D register expected",
  Z1012: "E register expected",
  Z1013: "'(' expected",
  Z1014: "')' expected",
  Z1015: "'}}' expected",
  Z1016: "Operand expected",
  Z1017: "Invalid token at the start of the line: {0}",
  Z1018: "An identifier or symbol expected",
  Z1019: "'=' expected",
  Z1020: "'to' expected",
  Z1021: "A byte-emitting pragma expected",
  Z1022: "BC, DE, HL, or SP expected",

  Z2000: "The current assembly address overflew $FFFF",
  Z2001: "The emitted code overflows the segment/bank.",
  Z2002: "The .ZXBASIC pragma should be used before any other pragma or instruction.",
  Z2003: "Missing #endif directive",
  Z2004: "Cannot find include file: '{0}'",
  Z2005: "Include file '{0}' is included more than once into the same parent source file",
  Z2006: "Include file '{0}' causes circular file reference",
  Z2007: "Error reading include file: '{0}' ({1})",
  Z2008: "An #ifmod or #ifnmod directive cen be used only with these identifiers: 'SPECTRUM48', 'SPECTRUM128', 'SPECTRUMP3', 'NEXT'.",
  Z2009: "Unexpected #else directive",
  Z2010: "Unexpected #endif directive",
  Z2011: "A MODEL pragma can be used only once.",
  Z2012: "A MODEL pragma can have only these values: 'SPECTRUM48', 'SPECTRUM128', 'SPECTRUMP3', 'NEXT'.",
  Z2013: "The .struct size of {0} is {1} byte(s). The invocation wants to emit {2} bytes.",
  Z2014: "The .struct definition of {0} does not have a field named {1}.",
  Z2015: "Field assignment instruction cannot be used outside of .struct invocation.",
  Z2016: "An EQU pragma must have a label",
  Z2017: "Label '{0}' is already defined",
  Z2018: "The .BANK pragma cannot have a label.",
  Z2019: "The .BANK pragma's value must be between 0 and 7.",
  Z2020: "The .BANK pragma's offset value must be between 0 and #03fff.",
  Z2021: "The .BANK pragma cannot be used with the ZX Spectrum 48 model type.",
  Z2022: "You have already used the .BANK pragma for bank {0}.",
  Z2023: "Unexpected error when emitting code for mnemonic '{0}'.",

  Z3000: "Identifier '{0}' is not defined yet.",
  Z3001: "Expression evaluation error: {0}",
};
