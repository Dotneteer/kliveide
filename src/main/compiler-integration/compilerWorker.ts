// src/main/compileWorker.ts
import { parentPort, workerData } from "worker_threads";

async function compileFile(filePath: string): Promise<string> {
  await new Promise((resolve) => setTimeout(resolve, 3000));
  return `Compiled ${filePath}`;
}

if (parentPort) {
  const { filePath } = workerData as { filePath: string };
  compileFile(filePath)
    .then((result) => {
      parentPort.postMessage(result);
    })
    .catch((err) => {
      parentPort?.postMessage(`Error: ${err.message}`);
    });
}
