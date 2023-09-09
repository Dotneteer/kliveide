import { IdeCommandContext } from "../../abstractions/IdeCommandContext";
import { IdeCommandResult } from "../../abstractions/IdeCommandResult";
import { ValidationMessage } from "../../abstractions/ValidationMessage";
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
    context: IdeCommandContext
  ): Promise<ValidationMessage | ValidationMessage[]> {
    const args = context.argTokens;
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
    const response = await context.messenger.sendMessage({
      type: "MainOpenFolder",
      folder: this.projectFolder
    });
    if (response.type === "ErrorResponse") {
      return commandError(response.message);
    }
    writeSuccessMessage(
      context.output,
      `Project in folder ${this.projectFolder} opened.`
    );
    return commandSuccess;
  }
}
