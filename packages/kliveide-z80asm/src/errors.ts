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
  | "Z1007";

export const errorMessages: ErrorText = {
  Z1001: "Invalid token at the end of the line: {{0}}",
  Z1002: "A line cannot start with this token: {{0}}",
  Z1003: "An expression expected",
  Z1004: "An identifier expected",
  Z1005: "Cannot parse an integer literal",
  Z1006: "A string literal expected",
  Z1007: "A comma expected",
};
