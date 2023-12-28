import { getAllMachineModels } from "@common/machines/machine-registry";
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

export class NewProjectCommand extends IdeCommandBase {
  readonly id = "newp";
  readonly description = "Creates a new Klive project.";
  readonly usage = "newp <machine ID> <project name> [<project folder>]";
  readonly aliases = ["np"];

  private machineId: string;
  private projectName: string;
  private projectFolder: string;

  async validateArgs (
    context: IdeCommandContext
  ): Promise<ValidationMessage | ValidationMessage[]> {
    const args = context.argTokens;
    if (args.length !== 2 && args.length !== 3) {
      return validationError("This command must use 2 or 3 arguments");
    }

    // --- Extract machine ID
    this.machineId = args[0].text;
    const machineTypes = getAllMachineModels();
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

  async doExecute (context: IdeCommandContext): Promise<IdeCommandResult> {
    const response = await context.messenger.sendMessage({
      type: "MainCreateKliveProject",
      machineId: this.machineId,
      // TODO extract modelId
      modelId: undefined,
      projectName: this.projectName,
      projectFolder: this.projectFolder
    });
    if (response.type === "ErrorResponse") {
      return commandError(response.message);
    }
    if (response.type !== "MainCreateKliveProjectResponse") {
      return commandError(`Unexpected response type: ${response.type}`);
    }
    if (response.errorMessage) {
      return commandError(response.errorMessage);
    }
    writeSuccessMessage(
      context.output,
      `Klive project successfully created in ${response.path}`
    );
    return commandSuccess;
  }
}
