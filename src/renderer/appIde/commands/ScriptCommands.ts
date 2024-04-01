import { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import { CommandWithSingleStringBase } from "./CommandWithSimpleStringBase";
import { IdeCommandResult } from "@renderer/abstractions/IdeCommandResult";
import {
  commandError,
  commandSuccessWith,
  writeSuccessMessage
} from "../services/ide-commands";
import path from "path";
import { SCRIPT_OUTPUT_VIEWER } from "@common/state/common-ids";

export class RunScriptCommand extends CommandWithSingleStringBase {
  readonly id = "script-run";
  readonly description = "Runs the specified script";
  readonly usage = "script-run <script file path>";
  readonly aliases = ["sr"];

  protected extraArgCount = 0;

  async doExecute (context: IdeCommandContext): Promise<IdeCommandResult> {
    // --- Check if the script file exists
    const checkResult = await checkScriptFile(this.arg, context);
    if (checkResult.error) {
      return commandError(checkResult.error);
    }
    try {
      const id = await context.service.scriptService.runScript(
        checkResult.file!
      );
      return commandSuccessWith(
        `Script ${this.arg} (with ID ${Math.abs(id)}) ${
          id < 0 ? "is already running" : "has been started"
        }.`
      );
    } catch (err) {
      return commandError(err.message);
    }
  }
}

export class CancelScriptCommand extends CommandWithSingleStringBase {
  readonly id = "script-cancel";
  readonly description = "Cancels the specified running script";
  readonly usage = "script-cancel <script file path | script ID>";
  readonly aliases = ["sc"];

  protected extraArgCount = 0;

  async doExecute (context: IdeCommandContext): Promise<IdeCommandResult> {
    // --- Check if the script file exists
    const scriptId = parseInt(this.arg, 10);
    let arg: number | string = this.arg;
    if (isNaN(scriptId)) {
      const checkResult = await checkScriptFile(this.arg, context);
      if (checkResult.error) {
        return commandError(checkResult.error);
      }
    } else {
      arg = scriptId;
    }
    try {
      const stopped = await context.service.scriptService.cancelScript(arg);
      return commandSuccessWith(
        stopped
          ? `Script ${arg} has been stopped.`
          : `Script ${arg} did not run.`
      );
    } catch (err) {
      return commandError(err.message);
    }
  }
}

export class DisplayScriptOutputCommand extends CommandWithSingleStringBase {
  readonly id = "script-output";
  readonly description = "Displays the output of the specified script";
  readonly usage = "script-output <script ID>";
  readonly aliases = ["so"];

  protected extraArgCount = 0;

  async doExecute (context: IdeCommandContext): Promise<IdeCommandResult> {
    // --- Check if the script file exists
    const scriptId = parseInt(this.arg, 10);
    if (isNaN(scriptId)) {
      return commandError(`A script ID expected, but got '${this.arg}'`);
    }

    // --- Get the script output
    const documentHubService =
      context.service.projectService.getActiveDocumentHubService();
    const scripts = context.store.getState().scripts;
    const thisScript = scripts.find(s => s.id === scriptId);
    if (!thisScript) {
      return commandError(`Script with ID ${scriptId} not found`);
    }

    // --- Open the script output
    const docId = `ScriptOutput-${scriptId}`;
    if (documentHubService.isOpen(docId)) {
      documentHubService.setActiveDocument(docId);
    } else {
      await documentHubService.openDocument(
        {
          id: `ScriptOutput-${scriptId}`,
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

async function checkScriptFile (
  filename: string,
  context: IdeCommandContext
): Promise<{ file?: string; error?: string }> {
  const projectFolder = context.store.getState().project?.folderPath;
  if (!projectFolder) {
    return { error: "Open a project first. Only then you can run scripts." };
  }

  // --- Check if the script file exists
  const filePath = path.isAbsolute(filename)
    ? filename
    : path.join(projectFolder, filename);
  const response = await context.messenger.sendMessage({
    type: "MainReadTextFile",
    path: filePath,
    resolveIn: "project"
  });
  if (response.type === "ErrorResponse") {
    return { error: response.message };
  }
  return { file: filePath };
}
