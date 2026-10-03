// src/main/compileWorker.ts
import { parentPort, workerData } from "worker_threads";
import { createCompilerRegistry } from "./compiler-registry";
import { CompilerOptions, KliveCompilerOutput } from "@abstractions/CompilerInfo";
import { CompilerWorkerData } from "./runWorker";
import { AppState } from "@common/state/AppState";
import { KBasicCompiler } from "@main/kbasic/KBasicCompiler";
import { basicIntelOf } from "./backgroundIntel";

async function compileFile(state: AppState, filename: string, language: string, options?: CompilerOptions) {
  const registry = createCompilerRegistry();
  const compiler = registry.getCompiler(language);
  if (!compiler) {
    throw new Error(
      `No compiler is registered for build root file ${filename}. ` +
        "Are you sure you use the right file extension?"
    );
  }

  compiler?.setAppState(state);
  const result = (await (compiler.checkFile
    ? compiler.checkFile(filename, options)
    : compiler.compileFile(filename, options))) as KliveCompilerOutput;
  return result;
}

/**
 * The open `.zxbas` file, checked as a root of its own when the build root's snapshot does not
 * include it (`.plans/BASIC_EDITOR_INTELLIGENCE_PLAN.md` E14): one extra front-end run, only then.
 */
function addActiveFileIntel(state: AppState, result: KliveCompilerOutput, activeFile: string | undefined): KliveCompilerOutput {
  if (!activeFile || !result || typeof result !== "object") return result;
  const same = (a: string) => a.replace(/\\/g, "/").toLowerCase() === activeFile.replace(/\\/g, "/").toLowerCase();
  if (basicIntelOf(result).some((b) => b.files.some((f) => same(f.path)))) return result;
  const compiler = new KBasicCompiler();
  compiler.setAppState(state);
  const intel = compiler.analyseFile(activeFile);
  return intel ? ({ ...result, basicIntel: [...basicIntelOf(result), intel] } as KliveCompilerOutput) : result;
}

if (parentPort) {
  const { filePath, language, options, state, basicActiveFile } = workerData as CompilerWorkerData;
  compileFile(state, filePath, language, options)
    .then((result) => {
      parentPort.postMessage(addActiveFileIntel(state, result, basicActiveFile));
    })
    .catch((err) => {
      parentPort?.postMessage(`Error: ${err.message}`);
    });
}
