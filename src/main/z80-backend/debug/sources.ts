/**
 * The front end's source files as the debug builders read them: a span's file and offsets become a
 * reported file name, line and column (after the front end's `#line` mapping, if it has one).
 * Klive BASIC's `SourceSet` satisfies it as it is.
 */
export type SourceLocation = { fileName: string; line: number; column: number };

export type SourceFileView = {
  readonly name: string;
  /** The file's text (the validator checks statement spans against it). */
  readonly text: string;
  location(offset: number): SourceLocation;
};

export type SourceFiles = {
  get(file: number): SourceFileView;
};
