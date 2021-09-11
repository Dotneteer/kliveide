/**
 * Represents the contents of the new project data
 */
export type NewProjectData = {
  machineType: string;
  projectPath: string;
  projectName: string;
  open: boolean;
};

/**
 * Represents the data about a new folder or file
 */
export type NewFileData = {
  root: string;
  name: string;
  error: boolean;
}
