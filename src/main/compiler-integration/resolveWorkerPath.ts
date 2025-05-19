// src/main/resolveWorkerPath.ts
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Resolves a worker path depending on dev vs production mode.
 * @param relativePathWithoutExtension e.g. './compileWorker'
 */
export function resolveWorkerPath(relativePathWithoutExtension: string): string {
  const ext = ".js";
  const fullPath = path.join(__dirname, `${relativePathWithoutExtension}${ext}`);
  return fullPath;
}
