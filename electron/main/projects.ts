import { app } from "electron";
import * as fs from "fs";
import * as path from "path";

const KLIVE_PROJET_ROOT = "KliveProjects";
const CODE_FOLDER = "code";
const PROJECT_FILE = "klive.project";

type ProjectCreationResult = {
  path?: string;
  errorMessage?: string;
};

/**
 * Creates a new project in the specified folder
 * @param machineId Machine ID of the project
 * @param projectName Name of the project subfolder
 * @param projectFolder Project home directory
 */
export function createKliveProject (
  machineId: string,
  projectName: string,
  projectFolder?: string
): ProjectCreationResult {
  const projPath = projectFolder
    ? path.isAbsolute(projectFolder)
      ? projectFolder
      : path.join(app.getPath("home"), KLIVE_PROJET_ROOT, projectFolder)
    : path.join(app.getPath("home"), KLIVE_PROJET_ROOT);
  const fullProjectFolder = path.join(projPath,  projectName);
  try {
    // --- Check if the folder exists
    if (fs.existsSync(fullProjectFolder)) {
      return {
        errorMessage: `Cannot create Klive project. Folder ${fullProjectFolder} already exists.`
      }
    }

    // --- Create the project folder
    fs.mkdirSync(fullProjectFolder, { recursive: true});

    // --- Create subfolders
    const codeFolder = path.join(fullProjectFolder, CODE_FOLDER);
    fs.mkdirSync(codeFolder, { recursive: true});

    // --- Create project files
    const projectFile = path.join(fullProjectFolder, PROJECT_FILE);
    const project = {};
    fs.writeFileSync(projectFile, JSON.stringify(project, null, 2));
  } catch (err) {
    return {
      errorMessage: err.toString()
    }
  }

  return {
    path: fullProjectFolder
  }
}
