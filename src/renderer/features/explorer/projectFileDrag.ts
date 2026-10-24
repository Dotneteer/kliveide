/*
 * Project files dragged out of the explorer (.plans/DISK_IMAGES_AND_FILE_SYSTEMS_PLAN.md, B4): the
 * row puts the file's full path on the drag under its own type, so a drop target (the Disk Explorer)
 * tells a project file from text or an OS file.
 */
export const PROJECT_FILE_DRAG_MIME = "application/x-klive-project-file";

/** The project files a drop carries, then the OS files (their paths, when the preload gives them) */
export function droppedFilePaths (transfer: DataTransfer | null | undefined): string[] {
  if (!transfer) return [];
  const project = transfer.getData(PROJECT_FILE_DRAG_MIME);
  if (project) return project.split("\n").filter(Boolean);
  const getPath = (window as unknown as { api?: { getPathForFile?: (file: File) => string } }).api?.getPathForFile;
  if (!getPath) return [];
  return Array.from(transfer.files ?? [])
    .map((file) => getPath(file))
    .filter((p): p is string => !!p);
}

/** Does a drag carry files a drop target can take? */
export function carriesFiles (transfer: DataTransfer | null | undefined): boolean {
  const types = Array.from(transfer?.types ?? []);
  return types.includes(PROJECT_FILE_DRAG_MIME) || types.includes("Files");
}
