/**
 * The common root error class
 */
export class ParserError extends Error {
  constructor (message: string, public code?: string) {
    super(message);

    // --- Set the prototype explicitly.
    Object.setPrototypeOf(this, ParserError.prototype);
  }
}

/**
 * Represents a parser error message
 */
export interface ParserErrorMessage {
  code: ErrorCodes;
  text: string;
  position: number;
  line: number;
  column: number;
}

/**
 * Represents a parser error codes
 */
export type ErrorCodes =
  | "K001"
  | "K002"
  | "K003"
  | "K004"
  | "K005"
  | "K006"
  | "K007"
  | "K008"
  | "K009"
  | "K010"
  | "K011"
  | "K012"
  | "K013"
  | "K014"
  | "K015"
  | "K016"
  | "K017"
  | "K018"
  | "K019"
  | "K020"
  | "K021"
  | "K022"
  | "K023"
  | "K024"
  | "K025"
  | "K026"

/**
 * Represents a parser error message descriptions
 */
type ErrorText = Record<ErrorCodes, string>;

/**
 * Parser error messages
 */
export const errorMessages: ErrorText = {
  K001: "An expression expected",
  K002: "Unexpected token: {0}",
  K003: "An identifier expected",
  K004: "'}' expected",
  K005: "']' expected",
  K006: "')' expected",
  K007: "Invalid object property name type",
  K008: "':' expected",
  K009: "'=' expected",
  K010: "Invalid arrow expression argument list",
  K011: "For loop variable must be initialized",
  K012: "'{' expected",
  K013: "'catch' or 'finally' expected",
  K014: "'(' or expected",
  K015: "'case' or 'default' expected",
  K016: "'default' case can be used only once within a switch statement",
  K017: "Invalid sequence expression",
  K018: "Invalid object literal",
  K019: "'function' or 'const' expected",
  K020: "'from' expected",
  K021: "A string literal expected",
  K022: "Identifier '{0}' is already imported",
  K023: "Function '{0}' is already defined in the module",
  K024: "'{0}' is already exported from the module",
  K025: "Cannot find module '{0}'",
  K026: "Module '{0}' does not export '{1}'" 
};
