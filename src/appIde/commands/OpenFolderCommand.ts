import { IdeCommandContext } from "../abstractions/IdeCommandContext";
import { IdeCommandResult } from "../abstractions/IdeCommandResult";
import { ValidationMessage } from "../abstractions/ValidationMessage";
import { Token } from "../services/command-parser";
import {
  IdeCommandBase,
  validationError,
  commandError,
  writeSuccessMessage,
  commandSuccess
} from "../services/ide-commands";

export class OpenFolderCommand extends IdeCommandBase {
  readonly id = "open";
  readonly description = "Opens a folder in the IDE";
  readonly usage = "open <project folder>";
  readonly aliases = ["op"];

  private projectFolder: string;

  async validateArgs (
    args: Token[]
  ): Promise<ValidationMessage | ValidationMessage[]> {
    if (args.length !== 1) {
      return validationError("This command expects a path as its argument");
    }

    // --- Extract project name
    this.projectFolder = args[0].text;
    return [];
  }

  async doExecute (
    context: IdeCommandContext
  ): Promise<IdeCommandResult> {
    const result = await context.messenger.sendMessage({
      type: "MainOpenFolder",
      folder: this.projectFolder
    });
    if (result.type === "ErrorResponse") {
      return commandError(result.message);
    }
    writeSuccessMessage(
      context.output,
      `Project in folder ${this.projectFolder} opened.`
    );
    return commandSuccess;
  }
}
