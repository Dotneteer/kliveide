import { app } from "electron";
import path from "path";

/**
 * Resolves the specified path using the public folder as relative root
 * @param toResolve Path to resolve
 * @returns Resolved path
 */
export function resolveHomeFilePath(toResolve: string): string {
  return path.isAbsolute(toResolve) ? toResolve : path.join(app.getPath("home"), toResolve);
}

