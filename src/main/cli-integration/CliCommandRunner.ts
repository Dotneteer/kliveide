import { ExecaChildProcess, execa } from "execa";
/**
 * This class is responsible for running the CLI commands that are passed to it.
 */
export class CliCommandRunner {
  async execute(
    command: string,
    args: string[],
    options?: RunnerOptions
  ): Promise<ExecaChildProcess> {
    return await execa(command, args, options);
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
