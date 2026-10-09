import fs from "fs";
import path from "path";

/*
 * What the CLI's verbs read and write, passed in so the tests can run them in-process.
 */
export type CliIo = {
  /** Writes a line to standard output */
  out(text: string): void;
  /** Writes a line to standard error */
  err(text: string): void;
  /** Writes raw bytes to standard output */
  outBytes(data: Uint8Array): void;
  /** Writes a file (relative paths resolve against `cwd`) */
  writeFile(file: string, data: Uint8Array | string): string;
  env: NodeJS.ProcessEnv;
  cwd: string;
  /** Standard output is a terminal (`klive test` picks its reporter by it; UNIT_TESTS_CLI_PLAN T6) */
  isTty?: boolean;
  /**
   * Settles when the user presses Ctrl+C (`events` streams until then). Only `events` asks: a
   * listener for the signal would otherwise stop Ctrl+C from ending any other verb.
   */
  waitForInterrupt(): Promise<void>;
};

/** The real process's streams */
export function processIo(): CliIo {
  return {
    out: (text) => process.stdout.write(text + "\n"),
    err: (text) => process.stderr.write(text + "\n"),
    outBytes: (data) => process.stdout.write(data),
    writeFile: (file, data) => {
      const full = path.resolve(process.cwd(), file);
      fs.writeFileSync(full, data);
      return full;
    },
    env: process.env,
    cwd: process.cwd(),
    isTty: !!process.stdout.isTTY,
    waitForInterrupt: () =>
      new Promise<void>((resolve) => {
        process.once("SIGINT", () => resolve());
        process.once("SIGTERM", () => resolve());
      })
  };
}
