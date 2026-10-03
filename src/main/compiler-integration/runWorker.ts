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
import { backgroundIntelActions } from "./backgroundIntel";
import { __DARWIN__ } from "@main/electron-utils";

export const COMPILER_WORKER_FILE = "compilerWorker";

export type CompilerWorkerData = {
  filePath: string;
  language: string;
  options?: CompilerOptions;
  state: AppState;
  /**
   * The open `.zxbas` file: when the build root does not include it, the worker checks it as a root
   * of its own for language intelligence (`.plans/BASIC_EDITOR_INTELLIGENCE_PLAN.md` E14).
   */
  basicActiveFile?: string;
};

export type CompilationCompleted = {
  success: boolean;
  errors: AssemblerErrorInfo[];
};

export function runBackgroundCompileWorker(
  input: CompilerWorkerData
): Promise<CompilationCompleted> {
  return new Promise((resolve, reject) => {
    const workerPath = resolveWorkerPath(); // match the actual filename
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
      // --- Intel first, so the editor sees the new snapshot when the compile is reported finished.
      // --- A result with errors keeps the last good snapshot; warnings do not count (plan E4).
      for (const action of backgroundIntelActions(input.language, result)) mainStore.dispatch(action);
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
 * @param workerPath The relative path to the worker script (without extension)
 * @returns The absolute path to the worker script file
 */
function resolveWorkerPath(): string {
  // __dirname is the directory of this file (runWorker.ts)
  // Workers are typically in the same directory or a subdirectory

  // For production build
  let jsPath = path.resolve(__dirname, `${COMPILER_WORKER_FILE}.js`);
  if (fs.existsSync(jsPath)) return jsPath;
  const tsPath = path.resolve(__dirname, `${COMPILER_WORKER_FILE}.ts`);
  if (fs.existsSync(tsPath)) return tsPath;
  jsPath = path.resolve(__dirname, `${COMPILER_WORKER_FILE}.js`);
  if (fs.existsSync(jsPath)) return jsPath;

  throw new Error(`Worker script not found: ${jsPath} or ${tsPath}`);
}
