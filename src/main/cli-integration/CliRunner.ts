import { ExecaSyncError, execa } from "execa";
import type { AssemblerErrorInfo, SimpleAssemblerOutput } from "@abstractions/CompilerInfo";

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
      const result = await execa(command, args, options);
      
      return {
        traceOutput: [`Executing ${result.command}`],
        stdout: result.stdout,
        stderr: result.stderr
      };
    } catch (error: any) {
      if ("exitCode" in error) {
        let errorInfo = error as any;
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
              traceOutput,
              failed: error.message,
              stdout: errorInfo.stdout,
              stderr: errorInfo.stderr
            };
      }
      return {
        traceOutput: [`Executing ${command}`],
        failed: error.tosString()
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
