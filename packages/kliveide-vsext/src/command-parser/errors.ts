/**
 * The common root class of all parser error objects
 */
export class KliveCommandError extends Error {
  /**
   * Instantiates a custom parser error object
   * @param message Error message
   * @param code Optional code to identify the message
   */
  constructor(message: string, public code?: string) {
    super(message);

    // --- Set the prototype explicitly.
    Object.setPrototypeOf(this, KliveCommandError.prototype);
  }
}

/**
 * Error message type description
 */
type ErrorText = Record<string, string>;

/**
 * Describes the structure of error messages
 */
export interface ParserErrorMessage {
  code: ErrorCodes;
  text: string;
  position: number;
}

export type ErrorCodes =
  // --- Missing or faulty tokens
  "C01" | "C02" | "C03" | "C04" | "C05" | "C06" | "C07" | "C08" | "C09";

export const errorMessages: ErrorText = {
  // --- Missing or faulty tokens
  C01: "Missing command name",
  C02: "Unknown SB command modifier: {0}",
  C03: "Decimal or hexadecimal literal expected",
  C04: "Colon expected",
  C05: "'hit' or 'val' expected",
  C06: "Command ends with an unexpected token: {0}",
  C07: "Only memory and I/O breakpoints may have 'hit', 'val' parameters",
  C08: "Only I/O breakpoints may have 'mask' parameters",
  C09: "Only execution flow breakpoints may have a partition"
};
