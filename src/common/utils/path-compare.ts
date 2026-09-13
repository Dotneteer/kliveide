/**
 * Path comparison helpers shared by settings-driven UI.
 *
 * Settings can carry either separator: a path typed by the user keeps the shape
 * they typed, while the main process always hands back forward slashes. These
 * helpers put both shapes into one form so they can be compared.
 */

// --- Turns Windows separators into the forward slashes every probe result uses.
export function normalizeSeparators(path: string): string {
  return path.replaceAll("\\", "/");
}

export function removeTrailingSeparators(path: string): string {
  return path.replace(/[\\/]+$/, "");
}

// --- The folder part of a path, in normalized form. Returns "" when the path
// --- has no folder component.
export function getPathFolder(path: string): string {
  const normalized = normalizeSeparators(path);
  const lastSeparator = normalized.lastIndexOf("/");
  return lastSeparator >= 0 ? normalized.substring(0, lastSeparator) : "";
}

// --- Two paths name the same file when only their separators (or, on Windows,
// --- their casing) differ. A settings path and a probed one routinely differ
// --- that way, and treating them as different files would leave a passed
// --- re-test looking like it belonged to something else.
export function isSamePath(
  left: string | undefined,
  right: string | undefined,
  isWindows: boolean
): boolean {
  if (!left || !right) return false;
  const leftPath = removeTrailingSeparators(normalizeSeparators(left));
  const rightPath = removeTrailingSeparators(normalizeSeparators(right));
  return isWindows ? leftPath.toLowerCase() === rightPath.toLowerCase() : leftPath === rightPath;
}
