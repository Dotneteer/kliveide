import { CommandArgumentInfo } from "@renderer/abstractions/IdeCommandInfo";
import { IdeCommandContext } from "../../abstractions/IdeCommandContext";
import { IdeCommandResult } from "../../abstractions/IdeCommandResult";
import {
  writeSuccessMessage,
  commandSuccess,
  IdeCommandBase,
  commandError
} from "../services/ide-commands";

type ShellCommandArgs = {
  filename: string;
};

export class ShellCommand extends IdeCommandBase<ShellCommandArgs> {
  readonly id = "sh";
  readonly description = "Opens a file in the shell with its associated program";
  readonly usage = "sh <filename>";
  readonly aliases = [];
  readonly argumentInfo: CommandArgumentInfo = {
    mandatory: [{ name: "filename", type: "string" }]
  };

  async execute(context: IdeCommandContext, args: ShellCommandArgs): Promise<IdeCommandResult> {
    try {
      const result = await context.mainApi.openWithShell(args.filename);
      if (result.error) {
        return commandError(result.error);
      }
      writeSuccessMessage(context.output, `Executing shell command: ${result.path}`);
      return commandSuccess;
    } catch (err) {
      return commandError(err.message);
    }
  }
}
