import { ExecaSyncError, execa } from "execa";
import type { AssemblerErrorInfo, SimpleAssemblerOutput } from "@abstractions/CompilerInfo";
import { stripAnsi } from "./ansi";

/**
 * Environment that asks the child not to colourise its output.
 *
 * execa gives the child no TTY, which is enough to quiet most tools on its own — but nothing
 * *guarantees* it. Anything that force-colours, or that inherits a `FORCE_COLOR` from the
 * environment Klive itself was launched in, still emits escape sequences. `NO_COLOR` is the
 * cross-tool convention (no-color.org); `FORCE_COLOR=0` turns off the `supports-color` override
 * that would otherwise beat it for Node-based tools.
 *
 * This is the cheap half of the fix. `stripAnsi` is the half that does not depend on the child
 * cooperating.
 */
const NO_COLOUR_ENV = { NO_COLOR: "1", FORCE_COLOR: "0" } as const;

// --- Anything can be thrown; this always produces something a user can read.
function toErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "string" && error) return error;
  const message = (error as { message?: unknown })?.message;
  return typeof message === "string" && message ? message : fallback;
}

/**
 * This class is responsible for running the CLI commands that are passed to it.
 */
export class CliRunner {
  private errorFilter?: ErrorFilterDescriptor;
  private errorDetectorFn?: ErrorOutputDetectorFn;
  private errorLineSplitterFn: ErrorLineSplitterFn;

  constructor() {
    this.errorDetectorFn = this.errorDetector;
    this.errorLineSplitterFn = this.errorLineSplitter;
  }

  /**
   * Sets the error filter for the runner
   * @param filter Error filter descriptor
   */
  setErrorFilter(filter: ErrorFilterDescriptor): void {
    this.errorFilter = filter;
  }

  /**
   * Sets the error detector function for the runner
   * @param fn Error detector function
   */
  setErrorDetectorFn(fn: ErrorOutputDetectorFn): void {
    this.errorDetectorFn = fn;
  }

  /**
   * Sets the error line splitter function for the runner
   * @param fn Error line splitter function
   */
  setErrorLineSplitterFn(fn: ErrorLineSplitterFn): void {
    this.errorLineSplitterFn = fn;
  }

  /**
   * Executes the specified command
   * @param command Command to execute
   * @param args Arguments of the command
   * @param options Execution options
   * @returns Output of the command
   */
  async execute(
    command: string,
    args: string[],
    options?: RunnerOptions
  ): Promise<CompilerResult | null> {
    try {
      const result = await execa(command, args, {
        ...options,
        env: { ...options?.env, ...NO_COLOUR_ENV }
      });

      return {
        traceOutput: [`Executing ${result.command}`],
        stdout: stripAnsi(result.stdout),
        stderr: stripAnsi(result.stderr)
      };
    } catch (error: any) {
      if ("exitCode" in error) {
        /*
         * Sanitize once, before anything reads the output.
         *
         * `errorLineSplitterFn` and `parseErrorMessage` run the per-compiler regex over these
         * strings to recover a filename, line and column. A colourised filename stops matching and
         * the diagnostic loses its navigation link, so the strip has to happen ahead of the split
         * rather than on the way out.
         *
         * A copy rather than a mutation: this is execa's error object, and its own fields may be
         * getters. The four the code below reads are re-stated explicitly so the spread cannot
         * silently drop one that execa defines as non-enumerable — `message` is exactly that case.
         */
        const errorInfo = {
          ...error,
          exitCode: error.exitCode,
          command: error.command,
          failed: error.failed,
          message: stripAnsi(error.message),
          shortMessage: stripAnsi(error.shortMessage),
          stdout: stripAnsi(error.stdout),
          stderr: stripAnsi(error.stderr)
        } as any;
        const traceOutput = [`Executing ${errorInfo.command}`];
        const hasErrorOutput = this.errorDetectorFn(errorInfo);
        if (!hasErrorOutput) {
          return {
            traceOutput,
            failed: errorInfo.shortMessage,
            stdout: errorInfo.stdout,
            stderr: errorInfo.stderr
          };
        }
        const lines = this.errorLineSplitterFn(errorInfo);
        const errors = lines.map((l) => this.parseErrorMessage(l)).filter((m) => m !== null);
        
        return errors.length > 0
          ? {
              traceOutput,
              errors,
              stdout: errorInfo.stdout,
              stderr: errorInfo.stderr
            }
          : {
              /*
               * `errorInfo.message`, not `error.message`. execa embeds the child's stdout *and*
               * stderr verbatim in the message, so this is the single widest path by which raw
               * escape sequences reached an output buffer — `commandError` writes it straight into
               * the build pane through `writeLines`.
               */
              traceOutput,
              failed: errorInfo.message,
              stdout: errorInfo.stdout,
              stderr: errorInfo.stderr
            };
      }
      // --- No exit code means the process never started: a missing, unusable or
      // --- unexecutable binary. There is no output to interpret, only the
      // --- spawn error itself.
      return {
        traceOutput: [`Executing ${command}`],
        failed: stripAnsi(toErrorMessage(error, `Could not execute ${command}`))
      };
    }
  }

  // --- Default error detector
  private errorDetector(error: ExecaSyncError): boolean {
    return !!(error.failed || error.exitCode !== 0 || error.stderr);
  }

  // --- Default error message parser
  private parseErrorMessage(errorString: string): AssemblerErrorInfo | null {
    const filter = this.errorFilter;
    if (!filter) {
      return null;
    }

    const match = errorString.match(filter.regex);
    const getMatch = (index: number): string =>
      match ? (index >= 0 ? match[index] : match[match.length - index]) : "";

    const hasLineNo = filter.hasLineInfo ? filter.hasLineInfo(match) : true;
    const isWarning =
      filter.warningFilterIndex &&
      getMatch(filter.warningFilterIndex) === (filter.warningText ?? "warning");

    return match
      ? {
          errorCode: filter.codeFilterIndex
            ? getMatch(filter.codeFilterIndex)
            : isWarning
              ? "Warning"
              : "Error",
          filename: filter.filenameFilterIndex ? getMatch(filter.filenameFilterIndex) : "",
          line: hasLineNo
            ? parseInt(filter.lineFilterIndex ? getMatch(filter.lineFilterIndex) : "0")
            : -1,
          startPosition: 0,
          endPosition: 0,
          startColumn: parseInt(
            filter.columnFilterIndex ? getMatch(filter.columnFilterIndex) : "0"
          ),
          endColumn: 0,
          message: filter.messageFilterIndex ? getMatch(filter.messageFilterIndex) : "",
          isWarning
        }
      : null;
  }

  private errorLineSplitter(error: ExecaSyncError): string[] {
    // Normalize line endings to '\n' for consistent splitting
    const normalizedOutput = (error.stdout + "\n" + error.stderr).replace(/\r\n/g, "\n");
    return normalizedOutput.split("\n");
  }
}

/**
 * Represents the options of a runner
 */
export type RunnerOptions = {
  /**
   * Prefer locally installed binaries when looking for a binary to execute.
   * @default `false`
   */
  readonly preferLocal?: boolean;

  /**
   * Preferred path to find locally installed binaries in (use with `preferLocal`).
   * @default process.cwd()
   */
  readonly localDir?: string | URL;

  /**
   * Path to the Node.js executable to use in child processes.
   * This can be either an absolute path or a path relative to the `cwd` option.
   * Requires `preferLocal` to be `true`.
   * For example, this can be used together with
   * [`get-node`](https://github.com/ehmicky/get-node) to run a specific Node.js version
   * in a child process.
   * @default process.execPath
   */
  readonly execPath?: string;

  /**
   * Strip the final [newline character](https://en.wikipedia.org/wiki/Newline) from the output.
   * @default true
   */
  readonly stripFinalNewline?: boolean;

  /**
   * Set to `false` if you don't want to extend the environment variables when providing the `env` property.
   * @default true
   */
  readonly extendEnv?: boolean;

  /**
   * Current working directory of the child process.
   * @default process.cwd()
   */
  readonly cwd?: string | URL;

  /**
   * Environment key-value pairs. Extends automatically from `process.env`. Set `extendEnv` to
   * `false` if you don't want this.
   * @default process.env
   */
  readonly env?: NodeJS.ProcessEnv;

  /**
   * Run the command inside a shell. Useful when the executable is a shell script or
   * requires the user's PATH (e.g. when launched from an Electron process).
   * @default false
   */
  readonly shell?: boolean;
};

/**
 * Represents a function that can detect error output
 */
export type ErrorOutputDetectorFn = (err: any) => boolean;

/**
 * Represents a function that can split error output into lines
 */
export type ErrorLineSplitterFn = (err: any) => string[];

/**
 * Represents a filter descriptor for an error output line
 */
export type ErrorFilterDescriptor = {
  regex: RegExp;
  hasLineInfo?: (match: RegExpMatchArray) => boolean;
  codeFilterIndex?: number;
  filenameFilterIndex?: number;
  lineFilterIndex?: number;
  columnFilterIndex?: number;
  messageFilterIndex?: number;
  warningFilterIndex?: number;
  warningText?: string;
};

export type OptionResult = {
  command: string;
  args: string[];
  errors: Record<string, string[]>;
};

export type CompilerResult = SimpleAssemblerOutput & {
  outFile?: string;
  contents?: Uint8Array;
  errorCount?: number;
  stdout?: string;
  stderr?: string;
};

export type CompilerFunction = (
  filename: string,
  options?: Record<string, any>,
  target?: string
) => Promise<CompilerResult | null>;

/**
 * Describes an option that can be passed to a utility process
 */
export type CmdLineOptionDescriptor = {
  optionName?: string;
  description: string;
  type: "string" | "number" | "boolean";
  isArray?: boolean;
};

/**
 * Describes a set of options that can be passed to a utility process
 */
export type CmdLineOptionSet = Record<string, CmdLineOptionDescriptor>;
