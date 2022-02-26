import * as path from "path";
import { exec } from "child_process";

import {
  IKliveCompiler,
  KliveCompilerOutput,
} from "@abstractions/compiler-registry";
import { AssemblerErrorInfo } from "@abstractions/z80-compiler-service";
import { __DARWIN__, __WIN32__ } from "../utils/electron-utils";

/**
 * Helper class to invoke compilers and communicate with the IDE
 */
export abstract class CompilerBase implements IKliveCompiler {
  /**
   * The unique ID of the compiler
   */
  abstract readonly id: string;

  /**
   * Compiled language
   */
  abstract readonly language: string;

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
  abstract processErrorMessage(data: string): AssemblerErrorInfo | string;

  /**
   * Executes the ZXBC command
   * @param cmdArgs Commad-line arguments
   * @param outChannel Output channel
   */
  async executeCommandLine(
    execPath: string,
    cmdArgs: string,
    _options?: any
  ): Promise<(AssemblerErrorInfo | string)[] | string | null> {
    const workdir = path.dirname(execPath);
    const filename = path.basename(execPath);
    const args = cmdArgs.split("\\").join("/")
    const cmd = `${__DARWIN__ ? execPath : filename} ${args}`;
    return new Promise<(AssemblerErrorInfo | string)[] | string | null>(
      (resolve, reject) => {
        const process = exec(
          cmd,
          {
            cwd: workdir,
          },
          (error, _stdout, stderr) => {
            if (process.exitCode !== 0) {
              const errorText = `The process exited with code ${process.exitCode}. ${error || stderr}`;
              resolve(errorText);
            }
            const processedMessages = this.processErrorString(error ? error.toString() : stderr);
            if (error || processedMessages.length > 0) {
              resolve(processedMessages);
              return;
            }
            resolve(null);
          }
        );
        if (!process?.pid) {
          throw new Error(
            `Cannot run the process with the specified path (${execPath})`
          );
        }
      }
    );
  }

  private processErrorString(data: string): (AssemblerErrorInfo | string)[] {
    // --- String for further processing
    return data
      .toString()
      .split(/\r?\n/)
      .map((s) => this.processErrorMessage(s));
  }
}
