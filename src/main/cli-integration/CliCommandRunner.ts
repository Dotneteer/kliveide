import { AssemblerErrorInfo } from "@abstractions/IZ80CompilerService";
import { SimpleAssemblerOutput } from "@main/compiler-integration/compiler-registry";
import { ExecaSyncError, execa } from "execa";

/**
 * This class is responsible for running the CLI commands that are passed to it.
 */
export class CliCommandRunner {
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
  ): Promise<SimpleAssemblerOutput | null> {
    try {
      const result = await execa(command, args, options);
      return {
        traceOutput: [`Executing ${result.command}`]
      };
    } catch (error: any) {
      if ("exitCode" in error) {
        let errorInfo = error as ExecaSyncError<string>;
        const traceOutput = [`Executing ${errorInfo.command}`];
        const hasErrorOutput = this.errorDetectorFn(errorInfo);
        if (!hasErrorOutput) {
          return {
            traceOutput,
            failed: errorInfo.shortMessage
          };
        }
        const lines = this.errorLineSplitterFn(errorInfo);
        const errors = lines.map((l) => this.parseErrorMessage(l)).filter((m) => m !== null);
        return errors.length > 0
          ? {
              traceOutput,
              errors
            }
          : {
              traceOutput,
              failed: error.message
            };
      }
    }
  }

  // --- Default error detector
  private errorDetector(error: ExecaSyncError<string>): boolean {
    return !!(error.failed || error.exitCode !== 0 || error.stderr);
  }

  // --- Default error message parser
  private parseErrorMessage(errorString: string): AssemblerErrorInfo | null {
    const filter = this.errorFilter;
    if (!filter) {
      return null;
    }

    const match = errorString.match(filter.regex);
    console.log("Filtering", errorString, match);
    return match
      ? {
          errorCode: filter.codeFilterIndex ? match[filter.codeFilterIndex] : "",
          filename: filter.filenameFilterIndex ? match[filter.filenameFilterIndex] : "",
          line: parseInt(filter.lineFilterIndex ? match[filter.lineFilterIndex] : "0"),
          startPosition: 0,
          endPosition: 0,
          startColumn: parseInt(filter.columnFilterIndex ? match[filter.columnFilterIndex] : "0"),
          endColumn: 0,
          message: filter.messageFilterIndex ? match[filter.messageFilterIndex] : "",
          isWarning: filter.warningFilterFn ? filter.warningFilterFn(errorString) : false
        }
      : null;
  }

  private errorLineSplitter(error: ExecaSyncError<string>): string[] {
    return (error.stdout + "\n" + error.stderr).split("\n");
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
export type ErrorOutputDetectorFn = (err: ExecaSyncError<string>) => boolean;

/**
 * Represents a function that can split error output into lines
 */
export type ErrorLineSplitterFn = (err: ExecaSyncError<string>) => string[];

/**
 * Represents a filter descriptor for an error output line
 */
export type ErrorFilterDescriptor = {
  regex: RegExp;
  codeFilterIndex?: number;
  filenameFilterIndex?: number;
  lineFilterIndex?: number;
  columnFilterIndex?: number;
  messageFilterIndex?: number;
  warningFilterFn?: (message: string) => boolean;
};
