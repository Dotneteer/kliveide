import path from "path";
import fs from "fs";

import { app } from "electron";
import { ProjectNodeWithChildren } from "../renderer/appIde/project/project-node";
import {
  getKliveProjectStructure,
} from "./projects";
import {
  appSettings,
} from "./settings";
import { pathStartsWith } from "../common/utils/path-utils";

type DirectoryContentFilter = (p: string) => boolean;

/**
 * Gets the contents of the specified directory
 * @param root
 */
export async function getDirectoryContent (
  root: string,
  pred?: DirectoryContentFilter
): Promise<ProjectNodeWithChildren> {
  if (!path.isAbsolute(root)) {
    root = path.join(app.getPath("home"), root);
  }

  let fileEntryCount = 0;
  const folderSegments = root.split(path.sep);
  const lastFolder =
    folderSegments.length > 0
      ? folderSegments[folderSegments.length - 1]
      : root;
  return getFileEntryInfo(root, "", lastFolder);

  function getFileEntryInfo (
    entryPath: string,
    projectRelative: string,
    name: string
  ): ProjectNodeWithChildren {
    // --- Store the root node information
    const fileEntryInfo = fs.statSync(entryPath);
    const entry: ProjectNodeWithChildren = {
      isFolder: false,
      name,
      fullPath: entryPath.replace(/\\/g, "/"),
      projectPath: projectRelative,
      children: []
    };
    if (fileEntryInfo.isFile()) {
      fileEntryCount++;
      return entry;
    }
    if (fileEntryInfo.isDirectory()) {
      entry.isFolder = true;
      const names = fs.readdirSync(entryPath);
      for (const name of names) {
        if (fileEntryCount++ > 10240) break;
        const projectRelativeChild = path.join(projectRelative, name);
        if (pred(projectRelativeChild)) {
          entry.children.push(
            getFileEntryInfo(
              path.join(entryPath, name),
              projectRelativeChild,
              name
            )
          );
        }
      }
    }
    return entry;
  }
}

/**
 * Retrieves a directory content filter for a project file tree.
 * This filter sieves off the excluded project items.
 * @returns a DirectoryContentFilter promise
 */
export async function getProjectDirectoryContentFilter(
): Promise<DirectoryContentFilter> {
  if (!appSettings.excludedProjectItems) {
    appSettings.excludedProjectItems = [ ".git" ];
  }
  const proj = await getKliveProjectStructure();
  const ignored = appSettings.excludedProjectItems
    .concat(proj.ide.excludedProjectItems)
    .filter((value, index, array) => array.indexOf(value) === index)
    .map((v) => v.replace('/', path.sep));
  return (p: string) => !ignored.some(v => pathStartsWith(p, v));
}
