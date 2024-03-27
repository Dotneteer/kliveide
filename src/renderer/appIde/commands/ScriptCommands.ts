import { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import { CommandWithSingleStringBase } from "./CommandWithSimpleStringBase";
import { IdeCommandResult } from "@renderer/abstractions/IdeCommandResult";
import { commandError, commandSuccessWith } from "../services/ide-commands";
import path from "path";

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
      const id = await context.service.scriptService.runScript(checkResult.file!);
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
      return commandSuccessWith(stopped ? `Script ${arg} has been stopped.` :
        `Script ${arg} did not run.`
      );
    } catch (err) {
      return commandError(err.message);
    }
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
