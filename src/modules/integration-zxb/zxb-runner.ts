import * as path from "path";
import { exec } from "child_process";
import {
  ZXBC_DEBUG_ARRAY,
  ZXBC_DEBUG_MEMORY,
  ZXBC_ENABLE_BREAK,
  ZXBC_EXECUTABLE_PATH,
  ZXBC_EXPLICIT_VARIABLES,
  ZXBC_HEAP_SIZE,
  ZXBC_MACHINE_CODE_ORIGIN,
  ZXBC_ONE_AS_ARRAY_BASE_INDEX,
  ZXBC_ONE_AS_STRING_BASE_INDEX,
  ZXBC_OPTIMIZATION_LEVEL,
  ZXBC_SINCLAIR,
  ZXBC_STRICT_BOOL,
  ZXBC_STRICT_MODE,
} from "./zxb-config";
import { getSettingsService } from "@core/service-registry";
import { IOutputBuffer } from "@abstractions/output-pane-service";

/**
 * Generates the command-line arguments to run ZXBC.EXE
 * @param outputFile Output file to generate
 * @param rawArgs Raw arguments from the code
 */
export async function createZxbCommandLineArgs(
  inputFile: string,
  outputFile: string,
  rawArgs: string | null
): Promise<string> {
  const configObject = await getSettingsService().getConfiguration("current");
  const argRoot = `${inputFile} --output ${outputFile} --asm `;
  let additional = rawArgs ? rawArgs.trim() : "";
  if (!additional) {
    const arrayBaseOne = configObject.get(
      ZXBC_ONE_AS_ARRAY_BASE_INDEX
    ) as boolean;
    additional = arrayBaseOne ? "--array-base=1 " : "";
    const optimize = configObject.get(ZXBC_OPTIMIZATION_LEVEL) as number;
    additional += `--optimize ${optimize ?? 2} `;
    const orgValue = configObject.get(ZXBC_MACHINE_CODE_ORIGIN) as number;
    additional += `--org ${orgValue ?? 0x8000} `;
    const heapSize = configObject.get(ZXBC_HEAP_SIZE) as number;
    additional += `--heap-size ${heapSize ?? 4096} `;
    const sinclair = configObject.get(ZXBC_SINCLAIR) as boolean;
    additional += sinclair ? "--sinclair " : "";
    const stringBaseOne = configObject.get(
      ZXBC_ONE_AS_STRING_BASE_INDEX
    ) as boolean;
    additional += stringBaseOne ? "--string-base=1 " : "";
    const debugMemory = configObject.get(ZXBC_DEBUG_MEMORY) as boolean;
    additional += debugMemory ? "--debug-memory " : "";
    const debugArray = configObject.get(ZXBC_DEBUG_ARRAY) as boolean;
    additional += debugArray ? "--debug-array " : "";
    const strictBool = configObject.get(ZXBC_STRICT_BOOL) as boolean;
    additional += strictBool ? "--strict-bool " : "";
    const strictMode = configObject.get(ZXBC_STRICT_MODE) as boolean;
    additional += strictMode ? "--strict " : "";
    const enableBreak = configObject.get(ZXBC_ENABLE_BREAK) as boolean;
    additional += enableBreak ? "--enable-break " : "";
    const explicit = configObject.get(ZXBC_EXPLICIT_VARIABLES) as boolean;
    additional += explicit ? "--explicit " : "";
  }
  return (argRoot + additional).trim();
}

/**
 * Executes the ZXBC command
 * @param cmdArgs Commad-line arguments
 * @param outChannel Output channel
 */
export async function execZxbc(
  cmdArgs: string,
  outChannel: IOutputBuffer
): Promise<string | null> {
  const configObject = await getSettingsService().getConfiguration("current");
  const execPath = configObject.get(ZXBC_EXECUTABLE_PATH) as string;
  if (execPath.trim() === "") {
    throw new Error(
      "ZXBC executable path is not set, cannot start the compiler."
    );
  }

  const workdir = path.dirname(execPath);
  const filename = path.basename(execPath);
  const cmd = `${filename} ${cmdArgs.split("\\").join("/")}`;
  if (outChannel) {
    outChannel.color("bright-blue");
    outChannel.writeLine(`Executing ${cmd}`)
  }
  return new Promise<string | null>((resolve, reject) => {
    const process = exec(
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
    if (!process?.pid) {
      throw new Error(
        `Cannot run the ZXBC utility with your specified path (${execPath})`
      );
    }
  });
}
