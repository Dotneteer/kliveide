import { TokenType } from "./TokenType";

/**
 * Represents a token in the source stream
 */
export type Token = {
  // The raw text of the token
  readonly text: string;

  // The type of the token
  readonly type: TokenType;

  // The location of the token
  readonly location: TokenLocation;
};

/**
 * Represents the location of a token in the source stream
 */
export interface TokenLocation {
  // Start position in the source stream
  readonly startPosition: number;

  // End position (exclusive) in the source stream
  readonly endPosition: number;

  // Start line number
  readonly startLine: number;

  // End line number of the token
  readonly endLine: number;

  // Start column number of the token
  readonly startColumn: number;

  // End column number of the token
  readonly endColumn: number;
}
