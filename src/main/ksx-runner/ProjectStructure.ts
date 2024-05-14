import { sendFromMainToIde } from "../../common/messaging/MainToIdeMessenger";
import { collectedBuildTasks } from "../../main/build";

export type ProjectTreeNode = {
  depth: number;
  name: string;
  fullPath: string;
  projectPath: string;
  isFolder: boolean;
  isReadonly: boolean;
  isBinary: boolean;
  canBeBuildRoot: boolean;
  children?: ProjectTreeNode[];
};

export type ProjectStructure = {
  rootPath: string;
  hasBuildFile: boolean;
  buildRoot?: string;
  buildFunctions: string[];
  children: ProjectTreeNode[];
};

export async function createProjectStructure (
): Promise<ProjectStructure> {
  const response = await sendFromMainToIde({
    type: "IdeGetProjectStructure"
  });
  if (response.type === "ErrorResponse") {
    throw new Error(response.message);
  }
  if (response.type !== "IdeGetProjectStructureResponse") {
    throw new Error("Unexpected response type");
  }

  // --- Collect build functions
  const buildFunctions = collectedBuildTasks.map(bt => bt.id);
  return { ...response.projectStructure, buildFunctions };
}
