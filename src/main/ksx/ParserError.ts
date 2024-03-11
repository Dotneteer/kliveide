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
  | "W001"
  | "W002"
  | "W003"
  | "W004"
  | "W005"
  | "W006"
  | "W007"
  | "W008"
  | "W009"
  | "W010"
  | "W011"
  | "W012"
  | "W013"
  | "W014"
  | "W015"
  | "W016"
  | "W017"
  | "W018"
  | "W019"
  | "W020"
  | "W021"
  | "W022";

/**
 * Represents a parser error message descriptions
 */
type ErrorText = Record<string, string>;

/**
 * Parser error messages
 */
export const errorMessages: ErrorText = {
  W001: "An expression expected",
  W002: "Unexpected token: {0}",
  W003: "An identifier expected",
  W004: "'}' expected",
  W005: "']' expected",
  W006: "')' expected",
  W007: "Invalid object property name type",
  W008: "':' expected",
  W009: "'=' expected",
  W010: "Invalid arrow expression argument list",
  W011: "For loop variable must be initialized",
  W012: "'{' expected",
  W013: "'catch' or 'finally' expected",
  W014: "'(' or expected",
  W015: "'case' or 'default' expected",
  W016: "'default' case can be used only once within a switch statement",
  W017: "Invalid sequence expression",
  W018: "Invalid object literal",
  W019: "'function' or 'const' expected",
  W020: "'from' expected",
  W021: "A string literal expected",
  W022: "Identifier '{0}' is already imported"
};
