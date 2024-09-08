import {
  NEW_PROJECT_DIALOG,
  EXPORT_CODE_DIALOG,
  CREATE_DISK_DIALOG
} from "@common/messaging/dialog-ids";
import { IdeCommandContext } from "../../abstractions/IdeCommandContext";
import { IdeCommandResult } from "../../abstractions/IdeCommandResult";
import { commandSuccess, commandError, IdeCommandBase } from "../services/ide-commands";
import { displayDialogAction } from "@common/state/actions";
import { CommandArgumentInfo } from "@renderer/abstractions/IdeCommandInfo";

type DialogCommandArgs = {
  dialogId: string;
};

export class DisplayDialogCommand extends IdeCommandBase<DialogCommandArgs> {
  readonly id = "display-dialog";
  readonly description = "Displays the spceified dialog";
  readonly usage = "display-dialog <dialogId>";
  readonly aliases = [];
  readonly noInteractiveUsage = true;

  readonly argumentInfo: CommandArgumentInfo = {
    mandatory: [{ name: "dialogId" }]
  };

  async execute(context: IdeCommandContext, args: DialogCommandArgs): Promise<IdeCommandResult> {
    if (args.dialogId in publicDialogIds) {
      context.store.dispatch(displayDialogAction(publicDialogIds[args.dialogId]));
      return commandSuccess;
    }
    return commandError(`Unknown dialog ID: ${args.dialogId}`);
  }
}

export const publicDialogIds: Record<string, number> = {
  newProject: NEW_PROJECT_DIALOG,
  export: EXPORT_CODE_DIALOG,
  createDisk: CREATE_DISK_DIALOG
};
