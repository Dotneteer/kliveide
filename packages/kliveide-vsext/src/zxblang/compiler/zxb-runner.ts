import * as vscode from "vscode";
import * as path from "path";
import { exec } from "child_process";
import {
  KLIVEIDE,
  ZXB_DEBUG_ARRAY,
  ZXB_DEBUG_MEMORY,
  ZXB_ENABLE_BREAK,
  ZXB_EXECUTABLE_PATH,
  ZXB_EXPLICIT_VARIABLES,
  ZXB_HEAP_SIZE,
  ZXB_MACHINE_CODE_ORIGIN,
  ZXB_ONE_AS_ARRAY_BASE_INDEX,
  ZXB_ONE_AS_STRING_BASE_INDEX,
  ZXB_OPTIMIZATION_LEVEL,
  ZXB_SINCLAIR,
  ZXB_STRICT_BOOL,
  ZXB_STRICT_MODE,
} from "../../config/sections";

/**
 * Generates the command-line arguments to run ZXB.EXE
 * @param outputFile Output file to generate
 * @param rawArgs Raw arguments from the code
 */
export function createZxbCommandLineArgs(
  inputFile: string,
  outputFile: string,
  rawArgs: string | null
): string {
  const argRoot = `${inputFile} --output ${outputFile} --asm `;
  let additional = rawArgs ? rawArgs.trim() : "";
  if (!additional) {
    const config = vscode.workspace.getConfiguration(KLIVEIDE);
    const arrayBaseOne = config.get(ZXB_ONE_AS_ARRAY_BASE_INDEX) as boolean;
    additional = arrayBaseOne ? "--array-base=1 " : "";
    const optimize = config.get(ZXB_OPTIMIZATION_LEVEL) as number;
    additional += `--optimize ${optimize ?? 2} `;
    const orgValue = config.get(ZXB_MACHINE_CODE_ORIGIN) as number;
    additional += `--org ${orgValue ?? 0x8000} `;
    const heapSize = config.get(ZXB_HEAP_SIZE) as number;
    additional += `--heap-size ${heapSize ?? 4096}`;
    const sinclair = config.get(ZXB_SINCLAIR) as boolean;
    additional += sinclair ? "--sinclair " : "";
    const stringBaseOne = config.get(ZXB_ONE_AS_STRING_BASE_INDEX) as boolean;
    additional += stringBaseOne ? "--string-base=1 " : "";
    const debugMemory = config.get(ZXB_DEBUG_MEMORY) as boolean;
    additional += debugMemory ? "--debug-memory " : "";
    const debugArray = config.get(ZXB_DEBUG_ARRAY) as boolean;
    additional += debugArray ? "--debug-array " : "";
    const strictBool = config.get(ZXB_STRICT_BOOL) as boolean;
    additional += strictBool ? "--strict-bool " : "";
    const strictMode = config.get(ZXB_STRICT_MODE) as boolean;
    additional += strictMode ? "--strict " : "";
    const enableBreak = config.get(ZXB_ENABLE_BREAK) as boolean;
    additional += enableBreak ? "--enable-break " : "";
    const explicit = config.get(ZXB_EXPLICIT_VARIABLES) as boolean;
    additional += explicit ? "--explicit " : "";
  }
  return (argRoot + additional).trim();
}

/**
 * Executes the ZXB command
 * @param cmdArgs Commad-line arguments
 * @param outChannel Output channel
 */
export async function execZxbc(
  cmdArgs: string,
  outChannel: vscode.OutputChannel
): Promise<string | null> {
  const config = vscode.workspace.getConfiguration(KLIVEIDE);
  const execPath = config.get(ZXB_EXECUTABLE_PATH) as string;
  if (execPath.trim() === "") {
    vscode.window.showErrorMessage(
      "ZXB executable path is not set, cannot start the compiler."
    );
    return;
  }

  const workdir = path.dirname(execPath);
  const execFile = path.basename(execPath);
  const cmd = `${execFile} ${cmdArgs.split("\\").join("/")}`;
  outChannel.appendLine(`Executing ${cmd}`);
  return new Promise<string | null>((resolve, reject) => {
    exec(
      cmd,
      {
        cwd: workdir,
      },
      (error, _stdout, stderr) => {
        if (error) {
          reject(stderr);
          return;
        }
        resolve(null);
      }
    );
  });
}
