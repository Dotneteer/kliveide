import { MainCreateKliveProjectResponse } from "@common/messaging/any-to-main";
import { InteractiveCommandContext } from "../abstractions/InteractiveCommandContext";
import { InteractiveCommandResult } from "../abstractions/InteractiveCommandResult";
import { ValidationMessage } from "../abstractions/ValidationMessage";
import { Token } from "../services/command-parser";
import {
  InteractiveCommandBase,
  validationError,
  commandError,
  writeSuccessMessage,
  commandSuccess
} from "../services/interactive-commands";

export class NewProjectCommand extends InteractiveCommandBase {
  readonly id = "newp";
  readonly description = "Creates a new Klive project.";
  readonly usage = "newp <machine ID> <project name> [<project folder>]";
  readonly aliases = ["np"];

  private machineId: string;
  private projectName: string;
  private projectFolder: string;

  async validateArgs (
    args: Token[]
  ): Promise<ValidationMessage | ValidationMessage[]> {
    if (args.length !== 2 && args.length !== 3) {
      return validationError("This command must use 2 or 3 arguments");
    }

    // --- Extract machine ID
    this.machineId = args[0].text;
    if (this.machineId !== "sp48") {
      return validationError(`Cannot find machine type '${args[0].text}'`);
    }

    // --- Extract project name
    this.projectName = args[1].text;
    if (args.length > 2) {
      this.projectFolder = args[2].text;
    }
    return [];
  }

  async doExecute (
    context: InteractiveCommandContext
  ): Promise<InteractiveCommandResult> {
    const result = (await context.messenger.sendMessage({
      type: "MainCreateKliveProject",
      machineId: this.machineId,
      projectName: this.projectName,
      projectFolder: this.projectFolder
    })) as MainCreateKliveProjectResponse;
    if (result.errorMessage) {
      return commandError(result.errorMessage);
    }
    writeSuccessMessage(
      context.output,
      `Klive project successfully created in ${result.path}`
    );
    return commandSuccess;
  }
}
