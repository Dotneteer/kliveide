import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import { t } from "@common/i18n/i18n";

/** A file path a command can use, or why it cannot use the one it was given. */
export type CommandFilePath = { path: string } | { error: string };

/** Whether a path is absolute: `/…`, `\…` or a Windows drive (`C:\…`, `C:/…`). */
export function isAbsoluteFilePath(file: string): boolean {
  return /^([A-Za-z]:)?[\\/]/.test(file);
}

/**
 * A path given to a command that reads or writes the user's files (the annotation commands): an
 * absolute path as it is, a relative one under the open project's folder, as the Explorer and `nav`
 * name files.
 *
 * With no project open a relative path is refused. Passed on as it was, the main process would
 * resolve it against the app's own folder — the repository's `src/public` in development, the app's
 * resources when packaged — which is how an `ann-new zx80.rom.dis` once wrote an annotation set
 * there.
 */
export function resolveCommandFilePath(context: IdeCommandContext, file: string): CommandFilePath {
  const trimmed = file.trim();
  if (isAbsoluteFilePath(trimmed)) return { path: trimmed };
  const folder = context.store.getState().project?.folderPath;
  if (!folder) return { error: t("commands.common.relativePathNoProject", { file: trimmed }) };
  return { path: `${folder.replace(/[\\/]+$/, "")}/${trimmed}` };
}
