import { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import { IdeCommandResult } from "@renderer/abstractions/IdeCommandResult";
import { commandError, commandSuccessWith, IdeCommandBase } from "../services/ide-commands";
import { SCRIPT_OUTPUT_VIEWER } from "@common/state/common-ids";
import { BUILD_FILE } from "@common/structs/project-const";
import { scriptDocumentId } from "@common/utils/script-utils";
import { isAbsolutePath } from "../project/project-node";
import { CommandArgumentInfo } from "@renderer/abstractions/IdeCommandInfo";

type RunScriptCommandArgs = {
  filePath: string;
};

export class RunScriptCommand extends IdeCommandBase<RunScriptCommandArgs> {
  readonly id = "script-run";
  readonly description = "Runs the specified script";
  readonly usage = "script-run <script file path>";
  readonly aliases = ["sr"];

  readonly argumentInfo: CommandArgumentInfo = {
    mandatory: [{ name: "filePath" }]
  };

  readonly requiresProject = true;

  async execute(context: IdeCommandContext, args: RunScriptCommandArgs): Promise<IdeCommandResult> {
    // --- Check if the script file exists
    const checkResult = await checkScriptFile(args.filePath, context);
    if (checkResult.error) {
      return commandError(checkResult.error);
    }
    try {
      const id = await context.service.scriptService.runScript(checkResult.file!);
      return commandSuccessWith(
        `Script ${args.filePath} (with ID ${Math.abs(id)}) ${
          id < 0 ? "is already running" : "has been started"
        }.`
      );
    } catch (err) {
      return commandError(err.message);
    }
  }
}

type CancelScriptCommandArgs = {
  fileId: string;
};

export class CancelScriptCommand extends IdeCommandBase<CancelScriptCommandArgs> {
  readonly id = "script-cancel";
  readonly description = "Cancels the specified running script";
  readonly usage = "script-cancel <script file path | script ID>";
  readonly aliases = ["sc"];

  readonly argumentInfo: CommandArgumentInfo = {
    mandatory: [{ name: "fileId" }]
  };

  readonly requiresProject = true;

  async execute(context: IdeCommandContext, args: CancelScriptCommandArgs): Promise<IdeCommandResult> {
    // --- Check if the script file exists
    const scriptId = parseInt(args.fileId, 10);
    let arg: number | string = args.fileId;
    if (isNaN(scriptId)) {
      const checkResult = await checkScriptFile(args.fileId, context);
      if (checkResult.error) {
        return commandError(checkResult.error);
      }
    } else {
      arg = scriptId;
    }
    try {
      const stopped = await context.service.scriptService.cancelScript(arg);
      return commandSuccessWith(
        stopped ? `Script ${arg} has been stopped.` : `Script ${arg} did not run.`
      );
    } catch (err) {
      return commandError(err.message);
    }
  }
}

type DisplayScriptOutputCommandArgs = {
  scriptId: number;
};


export class DisplayScriptOutputCommand extends IdeCommandBase<DisplayScriptOutputCommandArgs> {
  readonly id = "script-output";
  readonly description = "Displays the output of the specified script";
  readonly usage = "script-output <script ID>";
  readonly aliases = ["so"];

  readonly argumentInfo: CommandArgumentInfo = {
    mandatory: [{ name: "scriptId", type: "number" }]
  };

  readonly requiresProject = true;

  async execute(context: IdeCommandContext, args: DisplayScriptOutputCommandArgs): Promise<IdeCommandResult> {
    // --- Get the script output
    const scriptId = args.scriptId;
    const documentHubService = context.service.projectService.getActiveDocumentHubService();
    const scripts = context.store.getState().scripts;
    const thisScript = scripts.find((s) => s.id === scriptId);
    if (!thisScript) {
      return commandError(`Script with ID ${scriptId} not found`);
    }

    // --- Open the script output
    const docId = scriptDocumentId(scriptId);
    if (documentHubService.isOpen(docId)) {
      documentHubService.setActiveDocument(docId);
    } else {
      await documentHubService.openDocument(
        {
          id: scriptDocumentId(args.scriptId),
          name: `${thisScript.scriptFileName} (ID: ${scriptId}) output`,
          type: SCRIPT_OUTPUT_VIEWER,
          contents: scriptId.toString(),
          iconName: "note",
          iconFill: "--console-ansi-bright-green"
        },
        {}
      );
    }
    return commandSuccessWith(
      `Output of script ${thisScript.scriptFileName} (ID: ${scriptId}) displayed.`
    );
  }
}

type RunBuildScriptCommandArgs = {
  functionName: string;
};

export class RunBuildScriptCommand extends IdeCommandBase<RunBuildScriptCommandArgs> {
  readonly id = "run-build-function";
  readonly description = "Runs the specified build script function";
  readonly usage = "run-build-function <function name>";
  readonly aliases = ["rbf"];

  readonly argumentInfo: CommandArgumentInfo = {
    mandatory: [{ name: "functionName" }]
  };

  readonly requiresProject = true;

  async execute(context: IdeCommandContext, args: RunBuildScriptCommandArgs): Promise<IdeCommandResult> {
    // --- Check for function name syntax
    const functionName = args.functionName;
    if (!functionName.match(/^[$A-Z_][0-9A-Z_$]*$/i)) {
      return commandError(`Invalid function name syntax: '${functionName}'`);
    }

    // --- Check if the project is open
    if (!context.store.getState().project?.folderPath) {
      return commandError("Open a project first. Only then you can run scripts.");
    }

    // --- Check if this project has a build file
    if (!context.store.getState().project?.hasBuildFile) {
      return commandError("This project has no build file.");
    }

    // --- Check if build function exists
    const buildFunctionsResponse = await context.mainApi.getBuildFunctions();
    if (buildFunctionsResponse.type === "ErrorResponse") {
      return commandError(buildFunctionsResponse.message);
    }
    if (!buildFunctionsResponse.functions.includes(functionName)) {
      return commandError(`Function '${functionName}' not found in the build file.`);
    }

    // --- Get the current project's build file name
    const projectFolder = context.store.getState().project?.folderPath;
    const buildFileName = `${projectFolder}/${BUILD_FILE}`;

    // --- Create the script to run
    const script = `import { ${functionName} } from "./${BUILD_FILE}";\n\n${functionName}();`;

    let id = 0;
    try {
      id = await context.service.scriptService.runScriptText(
        script,
        functionName,
        buildFileName,
        "build"
      );
      return commandSuccessWith(
        `Script ${functionName} (with ID ${Math.abs(id)}) ${
          id < 0 ? "is already running" : "has been started"
        }.`,
        id
      );
    } catch (err) {
      return commandError(err.message, id);
    }
  }
}

async function checkScriptFile(
  filename: string,
  context: IdeCommandContext
): Promise<{ file?: string; error?: string }> {
  const projectFolder = context.store.getState().project?.folderPath;
  if (!projectFolder) {
    return { error: "Open a project first. Only then you can run scripts." };
  }

  // --- Check if the script file exists
  const filePath = isAbsolutePath(filename) ? filename : `${projectFolder}/${filename}`;
  const response = await context.mainApi.readTextFile(filePath, null, "project");
  if (response.type === "ErrorResponse") {
    return { error: response.message };
  }
  return { file: filePath };
}
