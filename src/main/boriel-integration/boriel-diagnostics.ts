import path from "path";

import type { AssemblerErrorInfo } from "@abstractions/CompilerInfo";

/*
 * zxbc's diagnostics (`.ai/boriel/cli-and-diagnostics.md`), one per line:
 *
 *   <file>:<line>: error: [E342] Unexpected end of line
 *   <file>:<line>: warning: [W150] Variable 'grid' is never used
 *   <file>:<line>: error: file 'missing.bas' not found
 *
 * There is no column, so a marker covers the whole line. Argument errors (exit code 2) are free text
 * on stderr ("zxbc: error: ..."): they become one error on the build root's first line.
 */

const LINE = /^(.*?):(\d+): (error|warning): (?:\[([EW]\d+)\] )?(.*)$/;

/**
 * Parses zxbc's diagnostics. A relative file name is resolved against `baseFolder` (zxbc reports
 * files in the form it was given them; Klive passes absolute paths, so this is a safety net).
 */
export function parseZxbcDiagnostics(text: string, baseFolder: string): AssemblerErrorInfo[] {
  const result: AssemblerErrorInfo[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const match = LINE.exec(raw.trimEnd());
    if (!match) continue;
    const [, file, line, severity, code, message] = match;
    result.push({
      errorCode: code ?? (severity === "error" ? "ZXBC" : "ZXBC-W"),
      filename: path.isAbsolute(file) ? file : path.resolve(baseFolder, file),
      line: Number(line),
      startPosition: 0,
      endPosition: null,
      startColumn: 0,
      endColumn: null,
      message,
      ...(severity === "warning" ? { isWarning: true } : {})
    });
  }
  return result;
}

/** A problem that is about the build as a whole (zxbc missing, argument error, timeout). */
export function buildError(filename: string, errorCode: string, message: string): AssemblerErrorInfo {
  return {
    errorCode,
    filename,
    line: 1,
    startPosition: 0,
    endPosition: null,
    startColumn: 0,
    endColumn: null,
    message
  };
}

/** The meaningful lines of zxbc's free-text stderr (the usage text it prints first is dropped). */
export function argumentErrorText(stderr: string): string {
  const lines = stderr.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const errorLine = lines.find((l) => /^zxbc: error:/.test(l));
  return (errorLine ?? lines[lines.length - 1] ?? "zxbc failed").replace(/^zxbc: error:\s*/, "");
}
