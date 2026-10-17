import { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import { IdeCommandResult } from "@renderer/abstractions/IdeCommandResult";
import { commandError, commandSuccessWith, IdeCommandBase } from "../services/ide-commands";
import { SCRIPT_OUTPUT_VIEWER } from "@common/state/common-ids";
import { BUILD_FILE } from "@common/structs/project-const";
import { scriptDocumentId } from "@common/utils/script-utils";
import { isAbsolutePath } from "@renderer/appIde/project/project-node";
import { CommandArgumentInfo } from "@renderer/abstractions/IdeCommandInfo";
import { t } from "@common/i18n/i18n";

type RunScriptCommandArgs = {
  filePath: string;
};

export class RunScriptCommand extends IdeCommandBase<RunScriptCommandArgs> {
  readonly id = "script-run";
  get description() {
    return t("commands.script.runDescription");
  }
  readonly usage = "script-run <script file path>";
  readonly aliases = ["scr"];

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
        t(id < 0 ? "commands.script.alreadyRunning" : "commands.script.started", {
          script: args.filePath,
          id: String(Math.abs(id))
        })
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
  get description() {
    return t("commands.script.cancelDescription");
  }
  readonly usage = "script-cancel <script file path | script ID>";
  readonly aliases = ["sc"];

  readonly argumentInfo: CommandArgumentInfo = {
    mandatory: [{ name: "fileId" }]
  };

  readonly requiresProject = true;

  async execute(
    context: IdeCommandContext,
    args: CancelScriptCommandArgs
  ): Promise<IdeCommandResult> {
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
        t(stopped ? "commands.script.stopped" : "commands.script.notRunning", { script: String(arg) })
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
  get description() {
    return t("commands.script.outputDescription");
  }
  readonly usage = "script-output <script ID>";
  readonly aliases = ["so"];

  readonly argumentInfo: CommandArgumentInfo = {
    mandatory: [{ name: "scriptId", type: "number" }]
  };

  readonly requiresProject = true;

  async execute(
    context: IdeCommandContext,
    args: DisplayScriptOutputCommandArgs
  ): Promise<IdeCommandResult> {
    // --- Get the script output
    const scriptId = args.scriptId;
    const documentHubService = context.service.projectService.getActiveDocumentHubService();
    const scripts = context.store.getState().scripts;
    const thisScript = scripts.find((s) => s.id === scriptId);
    if (!thisScript) {
      return commandError(t("commands.script.notFound", { id: String(scriptId) }));
    }

    // --- Open the script output
    const docId = scriptDocumentId(scriptId);
    if (documentHubService.isOpen(docId)) {
      documentHubService.setActiveDocument(docId);
    } else {
      await documentHubService.openDocument(
        {
          id: scriptDocumentId(args.scriptId),
          name: t("commands.script.outputDocumentName", { script: thisScript.scriptFileName, id: String(scriptId) }),
          type: SCRIPT_OUTPUT_VIEWER,
          contents: scriptId.toString(),
          iconName: "note",
          iconFill: "--console-ansi-bright-green"
        },
        {}
      );
    }
    return commandSuccessWith(
      t("commands.script.outputDisplayed", { script: thisScript.scriptFileName, id: String(scriptId) })
    );
  }
}

type RunBuildScriptCommandArgs = {
  functionName: string;
};

export class RunBuildScriptCommand extends IdeCommandBase<RunBuildScriptCommandArgs> {
  readonly id = "run-build-function";
  get description() {
    return t("commands.script.buildFunctionDescription");
  }
  readonly usage = "run-build-function <function name>";
  readonly aliases = ["rbf"];

  readonly argumentInfo: CommandArgumentInfo = {
    mandatory: [{ name: "functionName" }]
  };

  readonly requiresProject = true;

  async execute(
    context: IdeCommandContext,
    args: RunBuildScriptCommandArgs
  ): Promise<IdeCommandResult> {
    // --- Check for function name syntax
    const functionName = args.functionName;
    if (!functionName.match(/^[$A-Z_][0-9A-Z_$]*$/i)) {
      return commandError(t("commands.script.invalidFunctionName", { name: functionName }));
    }

    // --- Check if the project is open
    if (!context.store.getState().project?.folderPath) {
      return commandError(t("commands.script.openProject"));
    }

    // --- Check if this project has a build file
    if (!context.store.getState().project?.hasBuildFile) {
      return commandError(t("commands.script.noBuildFile"));
    }

    // --- Check if build function exists
    try {
      const functions = await context.mainApi.getBuildFunctions();
      if (!functions.includes(functionName)) {
        return commandError(t("commands.script.functionNotFound", { name: functionName }));
      }
      // --- Get the current project's build file name
      const projectFolder = context.store.getState().project?.folderPath;
      const buildFileName = `${projectFolder}/${BUILD_FILE}`;

      // --- Create the script to run
      const script = `import { ${functionName} } from "./${BUILD_FILE}";\n\n${functionName}();`;

      let id = 0;
      try {
        context.output.clear();
        id = await context.service.scriptService.runScriptText(
          script,
          functionName,
          buildFileName,
          "build"
        );
        return commandSuccessWith(
          t(id < 0 ? "commands.script.alreadyRunning" : "commands.script.started", {
            script: functionName,
            id: String(Math.abs(id))
          }),
          id
        );
      } catch (err) {
        return commandError(err.message, id);
      }
    } catch (err) {
      return commandError(err.message);
    }
  }
}

async function checkScriptFile(
  filename: string,
  context: IdeCommandContext
): Promise<{ file?: string; error?: string }> {
  const projectFolder = context.store.getState().project?.folderPath;
  if (!projectFolder) {
    return { error: t("commands.script.openProject") };
  }

  // --- Check if the script file exists
  const filePath = isAbsolutePath(filename) ? filename : `${projectFolder}/${filename}`;
  try {
    await context.mainApi.readTextFile(filePath, null, "project");
  } catch (err) {
    return { error: err.message };
  }
  return { file: filePath };
}
