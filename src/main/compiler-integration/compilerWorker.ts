// src/main/compileWorker.ts
import { parentPort, workerData } from "worker_threads";
import { createCompilerRegistry } from "./compiler-registry";
import { CompilerOptions, KliveCompilerOutput } from "@abstractions/CompilerInfo";
import { CompilerWorkerData } from "./runWorker";
import { AppState } from "@common/state/AppState";

async function compileFile(state: AppState, filename: string, language: string, options?: CompilerOptions) {
  const registry = createCompilerRegistry(state);
  const compiler = registry.getCompiler(language);
  if (!compiler) {
    throw new Error(
      `No compiler is registered for build root file ${filename}. ` +
        "Are you sure you use the right file extension?"
    );
  }
  // Add a timeout: reject if not finished in 5 seconds

  compiler?.setAppState(state);
  const result = (await compiler.compileFile(filename, options)) as Promise<KliveCompilerOutput>;
  return result;
}

if (parentPort) {
  const { filePath, language, options, state } = workerData as CompilerWorkerData;
  compileFile(state, filePath, language, options)
    .then((result) => {
      parentPort.postMessage(result);
    })
    .catch((err) => {
      parentPort?.postMessage(`Error: ${err.message}`);
    });
}
