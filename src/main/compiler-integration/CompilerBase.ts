import * as path from "path";
import { spawn } from "child_process";

import {
  IKliveCompiler,
  isAssemblerError,
  KliveCompilerOutput,
} from "@abstractions/compiler-registry";
import { AssemblerErrorInfo } from "@abstractions/z80-compiler-service";
import { sendFromMainToIde } from "@core/messaging/message-sending";

/**
 * Helper class to invoke compilers and communicate with the IDE
 */
export abstract class CompilerBase implements IKliveCompiler {
  /**
   * The unique ID of the compiler
   */
  abstract readonly id: string;

  /**
   * Indicates if the compiler supports Klive compiler output
   */
  readonly providesKliveOutput = true;

  /**
   * Compiles the Z80 Assembly code in the specified file into Z80
   * binary code.
   * @param filename Z80 assembly source file (absolute path)
   * @param options Compiler options. If not defined, the compiler uses the default options.
   * @returns Output of the compilation
   */
  abstract compileFile(
    filename: string,
    options?: Record<string, any>
  ): Promise<KliveCompilerOutput>;

  /**
   * Processes the message data and returns as a string
   * @param data
   */
  processMessage(data: string): string {
    return data;
  }

  /**
   * Processes a compiler error and turns it into an assembly error information
   * or plain string
   * @param data Message data to process
   */
  abstract processErrorMessage(data: any): AssemblerErrorInfo | string;

  /**
   * The compiler receives a standard message
   * @param data Message data
   */
  onMessage(data: any): Promise<void> {
    return this.handleMessage(data, false);
  }

  /**
   * The compiler receives an error message
   * @param data Message data
   */
  async onErrorMessage(data: any): Promise<void> {
    return this.handleMessage(data, true);
  }

  /**
   * Tests if the specified code is an error code
   * @param exitCode
   */
  exitCodeIsError(exitCode: number): boolean {
    return !!exitCode;
  }

  async executeCommandLine(
    execPath: string,
    cmdArgs: string,
    options?: any
  ): Promise<string | null> {
    const workdir = path.dirname(execPath);
    const filename = path.basename(execPath);
    return new Promise<string | null>((resolve, reject) => {
      const runner = spawn(filename, [cmdArgs], {
        cwd: workdir,
        shell: true,
        ...options,
      });
      runner.stdout.on("data", async (data) => await this.onMessage(data));
      runner.stderr.on("data", async (data) => await this.onErrorMessage(data));
      runner.on("error", async (err) => {
        // --- Wait a little time to ensure that all error messages are delivered
        await new Promise((r) => setTimeout(r, 200));
        reject(err);
      });
      runner.on("exit", async (code) => {
        // --- Wait a little time to ensure that all error messages are delivered
        await new Promise((r) => setTimeout(r, 200));

        if (this.exitCodeIsError(code)) {
          reject(`Exit code: ${code}`);
        } else {
          resolve(null);
        }
      });
    });
  }

  private async handleMessage(data: any, isError: boolean): Promise<void> {
    if (!data) {
      // --- Nothing to process
      return;
    }

    if (isAssemblerError(data)) {
      // --- Native warning or error
      await sendFromMainToIde({
        type: "CompilerMessage",
        message: data,
        isError: !data.isWarning,
      });
      return;
    }

    // --- String for further processing
    const segments = data.toString().split(/\r?\n/);
    for (const segment of segments) {
      const message = isError
        ? this.processErrorMessage(segment)
        : this.processMessage(segment);
      await sendFromMainToIde({
        type: "CompilerMessage",
        message: message,
        isError: isAssemblerError(message) ? !message.isWarning : isError,
      });
    }
  }
}
