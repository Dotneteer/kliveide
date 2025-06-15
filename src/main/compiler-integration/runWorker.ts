import { Worker } from "worker_threads";
import path from "path";
import fs from "fs";
import {
  AssemblerErrorInfo,
  CompilerOptions,
  KliveCompilerOutput
} from "@abstractions/CompilerInfo";
import { mainStore } from "@main/main-store";
import { endBackgroundCompileAction } from "@common/state/actions";
import { AppState } from "@common/state/AppState";
import { __DARWIN__ } from "@main/electron-utils";

export const COMPILER_WORKER_FILE = "compilerWorker";

export type CompilerWorkerData = {
  filePath: string;
  language: string;
  options?: CompilerOptions;
  state: AppState;
};

export type CompilationCompleted = {
  success: boolean;
  errors: AssemblerErrorInfo[];
};

export function runBackgroundCompileWorker(
  workerFilePath: string,
  input: CompilerWorkerData
): Promise<CompilationCompleted> {
  return new Promise((resolve, reject) => {
    const workerPath = resolveWorkerPath(workerFilePath); // match the actual filename
    const worker = new Worker(workerPath, {
      workerData: input
    });

    const errorFile = "/Users/dotneteer/klive-error.txt";
    fs.writeFileSync(errorFile, `Worker created with path: ${workerPath}\n`);

    worker.on("message", (result: KliveCompilerOutput) => {
      const errorFile = "/Users/dotneteer/klive-error.txt";
      fs.writeFileSync(errorFile, `Worker message arrived.`);
      const backgroundResult =
        (result.errors ?? []).length > 0
          ? {
              success: false,
              errors: result.errors
            }
          : {
              success: true,
              errors: []
            };
      mainStore.dispatch(endBackgroundCompileAction(backgroundResult));
      resolve(backgroundResult);
    });

    worker.on("error", (err) => {
      const errorFile = "/Users/dotneteer/klive-error.txt";
      fs.writeFileSync(errorFile, `Worker error: ${JSON.stringify(err)}`);
      mainStore.dispatch(
        endBackgroundCompileAction({
          success: false,
          errors: []
        })
      );
      reject(err);
    });

    worker.on("exit", (code) => {
      if (code !== 0) {
        mainStore.dispatch(
          endBackgroundCompileAction({
            success: false,
            errors: []
          })
        );
        reject(new Error(`Worker exited with code ${code}`));
      }
    });
  });
}

/**
 * Resolves the absolute path to a worker script, handling platform-specific quirks.
 * @param workerPath The relative path to the worker script (without extension)
 * @returns The absolute path to the worker script file
 */
function resolveWorkerPath(workerPath: string): string {
  // __dirname is the directory of this file (runWorker.ts)
  // Workers are typically in the same directory or a subdirectory

  // For production build
  let jsPath = path.resolve(__dirname, `${COMPILER_WORKER_FILE}.js`);
  if (fs.existsSync(jsPath)) return jsPath;
  const tsPath = path.resolve(__dirname, `${COMPILER_WORKER_FILE}.ts`);
  if (fs.existsSync(tsPath)) return tsPath;
  jsPath = path.resolve(__dirname, `${COMPILER_WORKER_FILE}.js`);
  const errorFile = "/Users/dotneteer/klive-error.txt";
  fs.writeFileSync(errorFile, `Worker path: ${jsPath}\n`);
  if (fs.existsSync(jsPath)) return jsPath;

  throw new Error(`Worker script not found: ${jsPath} or ${tsPath}`);
}
