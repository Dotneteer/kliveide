// src/main/compileWorker.ts
import { parentPort, workerData } from "worker_threads";
import { createCompilerRegistry } from "./compiler-registry";
import { CompilerOptions, KliveCompilerOutput } from "@abstractions/CompilerInfo";
import { CompilerWorkerData } from "./runWorker";
import { Store } from "@common/state/redux-light";
import { AppState } from "@common/state/AppState";

async function compileFile(store: Store<AppState>, filename: string, language: string, options?: CompilerOptions) {
  const registry = createCompilerRegistry(store);
  const compiler = registry.getCompiler(language);
  if (!compiler) {
    throw new Error(
      `No compiler is registered for build root file ${filename}. ` +
        "Are you sure you use the right file extension?"
    );
  }
  // Add a timeout: reject if not finished in 5 seconds

  console.log("Compiling file:", filename);
  const result = (await compiler.compileFile(filename, options)) as Promise<KliveCompilerOutput>;
  console.log("Compilation completed:", result);
  return result;
}

if (parentPort) {
  const { filePath, language, options, store } = workerData as CompilerWorkerData;
  compileFile(store, filePath, language, options)
    .then((result) => {
      console.log("Compilation result:", result);
      parentPort.postMessage(result);
    })
    .catch((err) => {
      parentPort?.postMessage(`Error: ${err.message}`);
    });
}
