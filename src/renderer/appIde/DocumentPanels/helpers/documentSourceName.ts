/**
 * How a file's path reads in the tab of a document opened from it (a popped-out NEX or Z88 bank):
 * relative to the project folder when the file is in it, the full path otherwise.
 *
 * Every opener of a document names its tab the same way, for the same reason they share the id —
 * whichever opens it first names its tab. See `Next/nexBankDocument.ts`.
 * @param fullPath The file's host path
 * @param projectFolder The open project's folder, if any
 */
export function documentSourceName(fullPath: string, projectFolder?: string): string {
  if (projectFolder) {
    const folder = projectFolder.replace(/\\/g, "/").replace(/\/+$/, "");
    const path = fullPath.replace(/\\/g, "/");
    if (path.startsWith(`${folder}/`)) return path.substring(folder.length + 1);
  }
  return fullPath;
}
