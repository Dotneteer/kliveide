import * as path from "path";
import * as fs from "fs";
import { mainStore } from "./main-store";
import { BUILD_FILE } from "../common/structs/project-const";
import { isModuleErrors, parseKsxModule } from "../common/ksx/ksx-module";
import { mainScriptManager } from "./ksx-runner/MainScriptManager";
import { setIdeStatusMessageAction } from "../common/state/actions";
import { FunctionDeclaration } from "@common/ksx/source-tree";

export async function processBuildFile (): Promise<void> {
  collectedBuildTasks.length = 0;

  // --- Obtain the project folder
  const projectState = mainStore.getState().project;
  const projectFolder = projectState?.folderPath;
  if (!projectFolder) {
    return;
  }

  // --- Obtain the build file
  const buildFilePath = path.join(projectFolder, BUILD_FILE);
  if (!fs.existsSync(buildFilePath)) {
    return;
  }

  // --- Parse the build file
  const buildContents = fs.readFileSync(buildFilePath, "utf-8");
  const buildModule = "build";
  const parsedBuildFile = await parseKsxModule(
    buildModule,
    buildContents,
    module => mainScriptManager.resolveModule(buildModule, module),
    packageName => mainScriptManager.resolvePackage(packageName)
  );

  if (isModuleErrors(parsedBuildFile)) {
    mainStore.dispatch(
      setIdeStatusMessageAction("Build file processing failed")
    );
    return;
  }

  // --- Process the build file
  mainStore.dispatch(setIdeStatusMessageAction("Processing build file", true));
  if (parsedBuildFile.exports) {
    Object.keys(parsedBuildFile.exports).forEach((key: any) => {
      const exp = parsedBuildFile.exports[key];
      if (exp.type !== "FunctionDeclaration" || !exp.isExported) {
        return;
      }

      // --- This is a build task
      let displayName = key;
      let separatorBefore = false;
      const predefined = predefinedTasks[key];
      if (predefined) {
        displayName = predefined.displayName;
        separatorBefore = predefined.separatorBefore;
      } else {
        const funcDecl = exp as FunctionDeclaration;
        if (
          funcDecl.statement.type === "BlockStatement" &&
          funcDecl.statement.statements.length > 0
        ) {
          const firstStatement = funcDecl.statement.statements[0];
          if (
            firstStatement.type === "ExpressionStatement" &&
            firstStatement.expression.type === "Literal" &&
            typeof firstStatement.expression.value === "string"
          ) {
            displayName = firstStatement.expression.value;
            if (displayName.startsWith("|")) {
              separatorBefore = true;
              displayName = displayName.substring(1).trim();
            }
          }
        }
      }

      // --- Add the task to the list
      collectedBuildTasks.push({
        id: key,
        displayName,
        separatorBefore
      });
    });
  }

  // --- Done
  mainStore.dispatch(setIdeStatusMessageAction("Build file processed", true));
}

type PredefinedBuildTaskDescriptor = {
  displayName: string;
  separatorBefore?: boolean;
  ideCommand: string;
}

const predefinedTasks: Record<string, PredefinedBuildTaskDescriptor> = {
  buildCode: {
    displayName: "Build project",
    separatorBefore: true,
    ideCommand: "compile"
  },
  injectCode: {
    displayName: "Inject code into the machine",
    ideCommand: "inject"
  },
  runCode: {
    displayName: "Run",
    separatorBefore: true,
    ideCommand: "run"
  },
  debugCode: {
    displayName: "Debug",
    ideCommand: "debug"
  },
  exportCode: {
    displayName: "Export artifacts",
    separatorBefore: true,
    ideCommand: "export"
  }
};

type BuildTaskDescriptor = {
  id: string;
  displayName?: string;
  separatorBefore?: boolean;
};

export const collectedBuildTasks: BuildTaskDescriptor[] = [];
