import { CommandArgumentInfo } from "@renderer/abstractions/IdeCommandInfo";
import { IdeCommandContext } from "../../abstractions/IdeCommandContext";
import { IdeCommandResult } from "../../abstractions/IdeCommandResult";
import { ValidationMessage } from "../../abstractions/ValidationMessage";
import {
  validationError,
  commandError,
  writeSuccessMessage,
  commandSuccess,
  IdeCommandBase
} from "../services/ide-commands";

const availableDiskTypes = ["ss", "ds", "sse", "dse"];

type CreateDiskFileCommandArgs = {
  diskType: string;
  diskName: string;
  diskFolder?: string;
};

export class CreateDiskFileCommand extends IdeCommandBase<CreateDiskFileCommandArgs> {
  readonly id = "crd";
  readonly description = "Creates a new disk file.";
  readonly usage = "crd <disk type> <disk name> [<disk folder>]";

  readonly argumentInfo: CommandArgumentInfo = {
    mandatory: [{ name: "diskType" }, { name: "diskName" }],
    optional: [{ name: "diskFolder" }]
  };

  validateCommandArgs(_: IdeCommandContext, args: any): ValidationMessage[] {
    if (!availableDiskTypes.find((dt) => dt === args.diskType)) {
      return [
        validationError(
          `Invalid disk type '${args.diskType}'. Use one of these: ${availableDiskTypes
            .map((dt) => `'${dt}'`)
            .join(", ")}`
        )
      ];
    }
    return [];
  }

  async execute(
    context: IdeCommandContext,
    args: CreateDiskFileCommandArgs
  ): Promise<IdeCommandResult> {
    const response = await context.mainApi.createDiskFile(
      args.diskFolder,
      args.diskName,
      args.diskType,
    );
    if (response.type === "ErrorResponse") {
      return commandError(response.message);
    }
    writeSuccessMessage(context.output, `Disk file successfully created: ${response.path}`);
    return commandSuccess;
  }
}
