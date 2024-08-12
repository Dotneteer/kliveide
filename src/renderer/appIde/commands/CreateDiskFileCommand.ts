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

const availableDiskTypes = ["ss", "ds", "sse", "dse"];

export class CreateDiskFileCommand extends IdeCommandBase {
  readonly id = "crd";
  readonly description = "Creates a new disk file.";
  readonly usage = "crd <disk type> <disk name> [<disk folder>]";

  private diskType: string;
  private diskName: string;
  private diskFolder: string;

  prepareCommand (): void {
    delete this.diskType;
    delete this.diskName;
    delete this.diskFolder;
  }

  async validateArgs (
    context: IdeCommandContext
  ): Promise<ValidationMessage | ValidationMessage[]> {
    const args = context.argTokens;
    if (args.length !== 2 && args.length !== 3) {
      return validationError("This command must use 2 or 3 arguments");
    }

    // --- Check disk type
    const diskType = args[0].text.toLowerCase();
    if (!availableDiskTypes.find(dt => dt === diskType)) {
      return validationError(
        `Invalid disk type '${diskType}'. Use one of these: ${availableDiskTypes
          .map(dt => `'${dt}'`)
          .join(", ")}`
      );
    }
    this.diskType = diskType

    // --- Extract disk name
    this.diskName = args[1].text;
    if (args.length > 2) {
      this.diskFolder = args[2].text;
    }
    return [];
  }

  async doExecute (context: IdeCommandContext): Promise<IdeCommandResult> {
    const response = await context.mainApi.createDiskFile(
      this.diskType,
      this.diskFolder,
      this.diskName
    );
    if (response.type === "ErrorResponse") {
      return commandError(response.message);
    }
    writeSuccessMessage(
      context.output,
      `Disk file successfully created: ${response.path}`
    );
    return commandSuccess;
  }
}
