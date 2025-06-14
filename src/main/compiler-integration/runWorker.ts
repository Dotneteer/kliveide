import { Worker } from "worker_threads";
import path from "path";
import { AssemblerErrorInfo, CompilerOptions, KliveCompilerOutput } from "@abstractions/CompilerInfo";
import { mainStore } from "@main/main-store";
import { endBackgroundCompileAction } from "@common/state/actions";
import { AppState } from "@common/state/AppState";

export type CompilerWorkerData = {
  filePath: string;
  language: string;
  options?: CompilerOptions;
  state: AppState
};

export type CompilationCompleted = {
  success: boolean;
  errors: AssemblerErrorInfo[];
};

export function runBackgroundCompileWorker(
  input: CompilerWorkerData
): Promise<CompilationCompleted> {
  return new Promise((resolve, reject) => {
    const workerPath = resolveWorkerPath("./compileWorker"); // no extension needed

    const worker = new Worker(workerPath, {
      workerData: input
    });

    worker.on("message", (result: KliveCompilerOutput) => {
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
 * @param relativePath The relative path to the worker script (without extension)
 * @returns The absolute path to the worker script file
 */
function resolveWorkerPath(relativePath: string): string {
  // __dirname is the directory of this file (runWorker.ts)
  // Workers are typically in the same directory or a subdirectory
  // Try .js first (for production), then .ts (for dev)
  const jsPath = path.resolve(__dirname, `${relativePath}.js`);
  const tsPath = path.resolve(__dirname, `${relativePath}.ts`);
  const fs = require("fs");
  if (fs.existsSync(jsPath)) return jsPath;
  if (fs.existsSync(tsPath)) return tsPath;
  throw new Error(`Worker script not found: ${jsPath} or ${tsPath}`);
}
