export type ProjectNode = {
  depth: number;
  name: string;
  fullPath: string;
  projectPath: string;
  isFolder: boolean;
  isReadonly: boolean;
  isBinary: boolean;
  canBeBuildRoot: boolean;
  children?: ProjectNode[];
};

export type ProjectStructure = {
  rootPath: string;
  hasBuildFile: boolean;
  buildFunctions: string[];
  nodes: ProjectNode[];
}
