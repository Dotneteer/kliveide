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
  "C01" | "C02";

export const errorMessages: ErrorText = {
  // --- Missing or faulty tokens
  C01: "Missing command name",
  C02: "...",
};
