export type PatternMatchType = "starts" | "contains" | "ends" | "full";

export type FileTypePattern = {
  matchType?: PatternMatchType;
  pattern: string;
};

export type FileTypeEditor = FileTypePattern & {
  editor: string;
  subType?: string;
}
