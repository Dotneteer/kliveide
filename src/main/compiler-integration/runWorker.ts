// src/main/runWorker.ts
import { Worker } from "worker_threads";
import { resolveWorkerPath } from "./resolveWorkerPath";

export function runWorker<TInput, TResult>(input: TInput, timeoutMs = 0): Promise<TResult> {
  return new Promise((resolve, reject) => {
    const workerPath = resolveWorkerPath("./compileWorker"); // no extension needed

    const worker = new Worker(workerPath, {
      workerData: input
    });

    let timeoutHandle: NodeJS.Timeout;

    // Timeout handler: terminate worker and reject
    timeoutHandle = setTimeout(() => {
      reject(new Error(`Worker timed out`));
      worker.terminate().catch((err) => {
        reject(new Error(`Worker timed out and termination failed: ${err}`));
      });
    }, timeoutMs);

    worker.on("message", (result: TResult) => {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      resolve(result);
    });

    worker.on("error", (err) => {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      reject(err);
    });

    worker.on("exit", (code) => {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      if (code !== 0) reject(new Error(`Worker exited with code ${code}`));
    });
  });
}
