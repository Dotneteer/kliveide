import fs from "fs";
import path from "path";

import type { AssemblerErrorInfo } from "@abstractions/CompilerInfo";


/*
 * zcc's diagnostics as Klive's (`.plans/Z88DK_INTEGRATION_PLAN.md` §5.1). Observed forms (v2.4):
 *
 *   main.c:3:13: error: Invalid expression              compiler (sccz80), with a column
 *   main.c:5:33: fatal error: Unknown symbol: x         compiler, fatal
 *   bad.asm:5: error: syntax error                      assembler (z80asm), no column
 *   bad.asm:4: warning: integer range: $12c             assembler warning
 *   main.c::main::1::2:4: error: undefined symbol: _f   linker: file::function::level::block:line
 *   inc.c:1: file 'nofile.h' not found                  preprocessor (ucpp), no severity word
 *     ^---- _f                                          context of the line above (skipped)
 *   Compilation aborted                                 summary (skipped)
 *
 * A location in a file that is not the project's (a library module: `stdio/fputc_callee.c::...`)
 * is reported against the build root with no line, its own location kept in the message.
 */

const LOCATED = /^(.+?)(?:::[^:]*::\d+::\d+)?:(\d+)(?::(\d+))?: (fatal error|error|warning|note): (.*)$/;
const PREPROCESSOR = /^(.+?):(\d+): (.+)$/;

export function parseZccDiagnostics(output: string, cwd: string, buildRoot: string): AssemblerErrorInfo[] {
  const result: AssemblerErrorInfo[] = [];
  for (const raw of (output ?? "").split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (!line.trim() || /^\s+\^----/.test(line) || /^Compilation aborted/.test(line)) continue;
    let match = LOCATED.exec(line);
    if (match) {
      const [, file, lineNo, column, severity, message] = match;
      result.push(diagnostic(file, Number(lineNo), column ? Number(column) - 1 : 0, severity, message, cwd, buildRoot));
      continue;
    }
    match = PREPROCESSOR.exec(line);
    if (match && !/^\s/.test(line) && /\.(c|h|asm|inc|s)$/i.test(match[1])) {
      result.push(diagnostic(match[1], Number(match[2]), 0, "error", match[3], cwd, buildRoot));
    }
  }
  return result;
}

function diagnostic(
  file: string,
  lineNo: number,
  column: number,
  severity: string,
  message: string,
  cwd: string,
  buildRoot: string
): AssemblerErrorInfo {
  const isWarning = severity === "warning" || severity === "note";
  const absolute = path.isAbsolute(file) ? file : path.resolve(cwd, file);
  const known = fs.existsSync(absolute);
  return {
    errorCode: isWarning ? "ZCC-W" : "ZCC",
    filename: known ? absolute : buildRoot,
    line: known && lineNo > 0 ? lineNo : -1,
    startPosition: 0,
    endPosition: 0,
    startColumn: known ? column : 0,
    endColumn: 0,
    message: known ? message : `${message} (in ${file}:${lineNo})`,
    ...(isWarning ? { isWarning: true } : {})
  };
}

/** An error at the build root's top: for problems that stop the build before zcc reports any. */
export function z88dkBuildError(filename: string, message: string, errorCode = "ZCC"): AssemblerErrorInfo {
  return {
    errorCode,
    filename,
    line: -1,
    startPosition: 0,
    endPosition: 0,
    startColumn: 0,
    endColumn: 0,
    message
  };
}
