/*
 * Where a `.nex` file has to be before NextZXOS can load it, kept free of dependencies so the main
 * process and the node test project can both use it.
 *
 * Launching a NEX is not an in-memory injection: the file is copied into the emulated SD card image
 * and NextZXOS is then driven to type `.nexload <path>` at its own command line. So a launch needs
 * two path forms — the host file to copy, and the card-relative path to type.
 */

/**
 * The folder on the SD card that Klive copies launchable files into.
 *
 * The build-and-run path has always used this (`_klive/<name>.nex`), so an arbitrary NEX launch uses
 * it too rather than inventing a second convention: one folder keeps Klive's files out of the way of
 * the user's own, and keeps the `.nexload` line short enough to type reliably through the emulated
 * keyboard.
 */
export const NEX_SD_FOLDER = "_klive";

/** Does this path name a NEX file? Extension test only — it does not look at the contents. */
export function isNexFilePath(path: string | undefined): boolean {
  return !!path && path.trim().toLowerCase().endsWith(".nex");
}

/**
 * The file name part of a host path.
 *
 * Split on both separators rather than using `path.basename`: this module stays dependency-free, and
 * a project opened on Windows can carry `\` in paths that reach code running anywhere.
 */
export function hostFileName(hostPath: string): string {
  const normalized = hostPath.replace(/\\/g, "/");
  const lastSlash = normalized.lastIndexOf("/");
  return lastSlash < 0 ? normalized : normalized.substring(lastSlash + 1);
}

/**
 * The card-relative path a host `.nex` file will occupy once copied, which is also the argument
 * `.nexload` is given.
 *
 * Always forward slashes: this string is consumed by NextZXOS, not by the host filesystem.
 */
export function nexSdCardTarget(hostPath: string): string {
  return `${NEX_SD_FOLDER}/${hostFileName(hostPath)}`;
}
