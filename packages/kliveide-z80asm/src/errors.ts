/**
 * Error message type description
 */
type ErrorText = { [key: string]: string };

/**
 * DEscribes the structure of error messages
 */
export interface ErrorMessage {
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
  | "Z1017";

export const errorMessages: ErrorText = {
  Z1001: "Invalid token at the end of the line: {{0}}",
  Z1002: "A line cannot start with this token: {{0}}",
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
  Z1017: "Invalid token at the start of the line: {{0}}",
};
