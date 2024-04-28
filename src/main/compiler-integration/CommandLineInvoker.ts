import { AssemblerErrorInfo } from "@abstractions/IZ80CompilerService";
import path from 'path';
import { exec } from "child_process";
import { __DARWIN__, __LINUX__ } from "../../electron/electron-utils";

export abstract class CommandLineInvoker {
      /**
   * Executes the ZXBC command
   * @param cmdArgs Commad-line arguments
   * @param outChannel Output channel
   */
  async executeCommandLine (
    execPath: string,
    cmdArgs: string,
    envPath?: string,
    _options?: any
  ): Promise<(AssemblerErrorInfo | string)[] | string | null> {
    const workdir = path.dirname(execPath);
    const filename = path.basename(execPath);
    const args = cmdArgs.split("\\").join("/");
    const cmd = `${__DARWIN__ || __LINUX__ ? execPath : filename} ${args}`;
    console.log("cmd", cmd);
    return new Promise<(AssemblerErrorInfo | string)[] | string | null>(
      resolve => {
        const childProcess = exec(
          cmd,
          {
            cwd: workdir,
            env: envPath
              ? { ...process.env, PATH: envPath }
              : { ...process.env }
          },
          (error, stdout, stderr) => {
            let processedMessages: (AssemblerErrorInfo | string)[] = [];
            if (childProcess.exitCode !== 0) {
              processedMessages.push(
                `The process exited with code ${childProcess.exitCode}.`
              );
            }
            processedMessages.push(
              ...this.processErrorString(
                stdout + (error ? error.toString() : stderr)
              )
            );
            const errorCount = processedMessages.filter(
              msg => typeof msg !== "string" && !msg.isWarning
            ).length;
            if (error || errorCount > 0) {
              resolve(processedMessages);
              return;
            }
            resolve(null);
          }
        );
        console.log("cp", childProcess?.pid);
        if (!childProcess?.pid) {
          throw new Error(
            `Cannot run the process with the specified path (${execPath}), cmd: ${cmd}`
          );
        }
      }
    );
  }

    /**
   * Processes a compiler error and turns it into an assembly error information
   * or plain string
   * @param data Message data to process
   */
  abstract processErrorMessage(data: string): AssemblerErrorInfo | string;


  private processErrorString (data: string): (AssemblerErrorInfo | string)[] {
    // --- String for further processing
    return data
      .toString()
      .split(/\r?\n/)
      .map(s => this.processErrorMessage(s));
  }
}