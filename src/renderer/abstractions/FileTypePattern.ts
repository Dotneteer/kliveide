export type PatternMatchType = "starts" | "contains" | "ends" | "full";

export type FileTypePattern = {
  matchType?: PatternMatchType;
  pattern: string;
  icon?: string;
  iconFill?: string;
};

export type FileTypeEditor = FileTypePattern & {
  editor: string;
  subType?: string;
  isReadOnly?: boolean;
  isBinary?: boolean;
  openPermanent?: boolean;
}
