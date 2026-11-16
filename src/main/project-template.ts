import fs from "fs";
import path from "path";
import { PROJECT_MERGE_FILE } from "@common/structs/project-const";
import type { TemplateConflict } from "@common/structs/project-conversion";

/**
 * Project templates (`src/public/project-templates/<machine>/<template>/`).
 *
 * A template is a folder of files copied into a project folder. Entries whose name starts with
 * `__$` are the template's metadata, never copied: `__$klive.project` is merged into the new
 * project file.
 *
 * The module touches only the file system, so creating a project and making an existing folder a
 * project (`dev/plans/PLAIN_FOLDER_TO_PROJECT_PLAN.md` §3.4) share one copy rule, and it is tested
 * without Electron.
 */

/** Template entries with this prefix are metadata, never copied */
export const TEMPLATE_META_PREFIX = "__$";

/** What a copy did */
export type TemplateCopyResult = {
  /** Files written, relative, with forward slashes */
  written: string[];
  /** Files left alone because something already existed there */
  skipped: string[];
};

/**
 * Lists the files a template copies, relative to the template folder, with forward slashes,
 * sorted. Metadata entries (`__$*`) are left out at every level.
 * @param templateFolder The template's folder; it must exist
 */
export function listTemplateFiles(templateFolder: string): string[] {
  const result: string[] = [];
  const walk = (folder: string, relative: string) => {
    for (const name of fs.readdirSync(folder).sort()) {
      if (name.startsWith(TEMPLATE_META_PREFIX)) continue;
      const fullPath = path.join(folder, name);
      const relPath = relative ? `${relative}/${name}` : name;
      if (fs.lstatSync(fullPath).isDirectory()) {
        walk(fullPath, relPath);
      } else {
        result.push(relPath);
      }
    }
  };
  // --- Throws for a missing folder, like the copy always did: a template that is not there is an
  // --- error, not an empty template
  if (fs.lstatSync(templateFolder).isDirectory()) {
    walk(templateFolder, "");
  }
  return result;
}

/**
 * Finds the template files that would land on an existing item in the target folder. Nothing is
 * written.
 * @param templateFolder The template's folder
 * @param targetFolder The folder the template would be copied into
 */
export function findTemplateConflicts(
  templateFolder: string,
  targetFolder: string
): TemplateConflict[] {
  const conflicts: TemplateConflict[] = [];
  for (const relPath of listTemplateFiles(templateFolder)) {
    const state = targetState(targetFolder, relPath);
    if (state !== "free") {
      conflicts.push({ path: relPath, canOverwrite: state === "file" });
    }
  }
  return conflicts;
}

/**
 * Copies a template's files into a folder, creating the subfolders it needs.
 *
 * A file that would replace an existing file is written only when `overwrite` names it (or is
 * `"all"`). A file whose place is taken by a folder, or whose parent path is taken by a file, is
 * never written.
 * @param templateFolder The template's folder
 * @param targetFolder The folder to copy into; it must exist
 * @param overwrite The relative paths of existing files to replace, or `"all"`
 */
export function copyTemplate(
  templateFolder: string,
  targetFolder: string,
  overwrite: Iterable<string> | "all" = []
): TemplateCopyResult {
  const allowed = overwrite === "all" ? undefined : new Set(overwrite);
  const result: TemplateCopyResult = { written: [], skipped: [] };
  for (const relPath of listTemplateFiles(templateFolder)) {
    const state = targetState(targetFolder, relPath);
    const write =
      state === "free" || (state === "file" && (allowed === undefined || allowed.has(relPath)));
    if (!write) {
      result.skipped.push(relPath);
      continue;
    }
    const target = path.join(targetFolder, ...relPath.split("/"));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, new Uint8Array(fs.readFileSync(path.join(templateFolder, ...relPath.split("/")))));
    result.written.push(relPath);
  }
  return result;
}

/**
 * Reads the template's project file fragment. A template without one, or with one that is not a
 * JSON object, adds nothing.
 * @param templateFolder The template's folder
 */
export function readTemplateMerge(templateFolder: string): Record<string, any> {
  try {
    const mergeFile = path.join(templateFolder, PROJECT_MERGE_FILE);
    if (!fs.existsSync(mergeFile)) return {};
    const contents = JSON.parse(fs.readFileSync(mergeFile, "utf8"));
    return contents && typeof contents === "object" && !Array.isArray(contents) ? contents : {};
  } catch {
    return {};
  }
}

/**
 * What is at a template file's place in the target folder: nothing (`free`), a file the template
 * may replace (`file`), or something it may not replace (`blocked`: a folder there, or a file where
 * one of its parent folders should be).
 */
function targetState(targetFolder: string, relPath: string): "free" | "file" | "blocked" {
  const parts = relPath.split("/");
  let current = targetFolder;
  for (let i = 0; i < parts.length; i++) {
    current = path.join(current, parts[i]);
    if (!fs.existsSync(current)) return "free";
    const isDirectory = fs.statSync(current).isDirectory();
    const isLast = i === parts.length - 1;
    if (isLast) return isDirectory ? "blocked" : "file";
    if (!isDirectory) return "blocked";
  }
  return "free";
}
