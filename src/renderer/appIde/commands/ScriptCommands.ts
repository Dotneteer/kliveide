import { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import { CommandWithSingleStringBase } from "./CommandWithSimpleStringBase";
import { IdeCommandResult } from "@renderer/abstractions/IdeCommandResult";
import { commandSuccess, writeSuccessMessage } from "../services/ide-commands";

export class RunScriptCommand extends CommandWithSingleStringBase {
  readonly id = "script-run";
  readonly description = "Runs the specified script";
  readonly usage = "script-run <script file path>";
  readonly aliases = ["sr"];

  protected extraArgCount = 0;

  async doExecute (context: IdeCommandContext): Promise<IdeCommandResult> {
    writeSuccessMessage(context.output, `Script ${this.arg} started.`);
    return commandSuccess;
  }
}

export class CancelScriptCommand extends CommandWithSingleStringBase {
    readonly id = "script-cancel";
    readonly description = "Cancels the specified running script";
    readonly usage = "script-cancel <script file path | script ID>";
    readonly aliases = ["sc"];
  
    protected extraArgCount = 0;
  
    async doExecute (context: IdeCommandContext): Promise<IdeCommandResult> {
      const scriptId = parseInt(this.arg);
      writeSuccessMessage(context.output, `Script ${this.arg} canceled.`);
      return commandSuccess;
    }
  }
  