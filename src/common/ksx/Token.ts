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

