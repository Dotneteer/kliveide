import { runtimeBundle } from "./runtime/generated/runtime-bundle";

/**
 * Klive BASIC's standard library (plan §6.4): `#include <name.bas>` finds these files first, under a
 * path of their own so that the IDE and the debug tables can tell them from the user's files.
 */
export const LIBRARY_FOLDER = "<kbasic-stdlib>";

/** A library file by the name `#include <...>` gives, or undefined. */
export function libraryFile(name: string): { path: string; text: string } | undefined {
  const file = runtimeBundle.stdlib.find((f) => f.name.toLowerCase() === name.toLowerCase());
  return file ? { path: `${LIBRARY_FOLDER}/${file.name}`, text: file.text } : undefined;
}

/** Whether a source path is a library file's. */
export function isLibraryPath(path: string): boolean {
  return path.startsWith(`${LIBRARY_FOLDER}/`);
}

/** Whether upstream documents a library of this name (one Klive BASIC may not have written yet). */
export function isDocumentedLibrary(name: string): boolean {
  return runtimeBundle.documented.some((n) => n.toLowerCase() === name.toLowerCase());
}
