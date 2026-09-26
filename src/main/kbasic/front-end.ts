import { DiagnosticBag } from "./diagnostics";
import type { Program } from "./syntax/ast";
import { parse } from "./syntax/parser";
import { preprocess, type FileReader, type PreprocessorOptions, type PreprocessResult } from "./syntax/preprocessor";
import { SourceSet } from "./syntax/source";

export type FrontEndResult = {
  sources: SourceSet;
  preprocessed: PreprocessResult;
  program: Program;
  diagnostics: DiagnosticBag;
};

/** Preprocesses and parses a build root: the compiler's front end up to the syntax tree. */
export function parseProgram(
  rootPath: string,
  rootText: string,
  reader: FileReader,
  options: PreprocessorOptions = {},
  diagnostics = new DiagnosticBag()
): FrontEndResult {
  const sources = new SourceSet();
  const root = sources.add(rootPath, rootText);
  const preprocessed = preprocess(sources, root, reader, diagnostics, options);
  const program = parse(preprocessed, diagnostics);
  return { sources, preprocessed, program, diagnostics };
}
