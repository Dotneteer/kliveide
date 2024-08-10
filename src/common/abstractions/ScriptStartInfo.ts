/**
 * Represents the information required to start a script.
 */
export type ScriptStartInfo = {
  id?: number;
  target?: string;
  contents?: string;
  hasParseError?: boolean;
};
