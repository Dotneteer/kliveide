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
import { DISK_FOLDER } from "@common/structs/project-const";

const availableDiskTypes = ["ss", "ds", "sse", "dse"];

type CreateDiskFileCommandArgs = {
  diskType: string;
  diskName: string;
  diskFolder?: string;
  "-p"?: boolean;
};

export class CreateDiskFileCommand extends IdeCommandBase<CreateDiskFileCommandArgs> {
  readonly id = "crd";
  readonly description = "Creates a new disk file.";
  readonly usage = "crd <disk type> <disk name> [<disk folder>] [-p]";

  readonly argumentInfo: CommandArgumentInfo = {
    mandatory: [{ name: "diskType" }, { name: "diskName" }],
    optional: [{ name: "diskFolder" }],
    commandOptions: ["-p"]
  };

  async validateCommandArgs(_: IdeCommandContext, args: any): Promise<ValidationMessage[]> {
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
    let folder = args.diskFolder;
    if (args["-p"]) {
      // --- Create a disk file in the project folder
      const projectFolder = context.store.getState()?.project?.folderPath;
      if (projectFolder) {
        folder = folder
          ? `${projectFolder}/${DISK_FOLDER}/${folder}`
          : `${projectFolder}/${DISK_FOLDER}`;
      }
    }
    try {
      const result = await context.mainApiAlt.createDiskFile(folder, args.diskName, args.diskType);
      writeSuccessMessage(context.output, `Disk file successfully created: ${result}`);
      return commandSuccess;
    } catch (err) {
      return commandError(err.toString());
    }
  }
}
