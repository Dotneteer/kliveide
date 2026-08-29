import {
  NEW_PROJECT_DIALOG,
  EXPORT_CODE_DIALOG,
  CREATE_DISK_DIALOG
} from "@common/messaging/dialog-ids";
import { IdeCommandContext } from "../../abstractions/IdeCommandContext";
import { IdeCommandResult } from "../../abstractions/IdeCommandResult";
import { commandSuccess, commandError, IdeCommandBase } from "../services/ide-commands";
import { CommandArgumentInfo } from "@renderer/abstractions/IdeCommandInfo";
import { openRendererDialog } from "@renderer/controls/overlay/dialogRequestBridge";
import { MessageSource } from "@common/messaging/messages-core";

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
    const dialogInfo = publicDialogIds[args.dialogId];
    if (dialogInfo) {
      if (dialogInfo.source === "emu") {
        await context.emuApi.displayDialog(dialogInfo.dialogId);
      } else {
        await openRendererDialog("ide", dialogInfo.dialogId);
      }
      return commandSuccess;
    }
    return commandError(`Unknown dialog ID: ${args.dialogId}`);
  }
}

type PublicDialogInfo = {
  source: Extract<MessageSource, "ide" | "emu">;
  dialogId: number;
};

export const publicDialogIds: Record<string, PublicDialogInfo> = {
  newProject: { source: "ide", dialogId: NEW_PROJECT_DIALOG },
  export: { source: "ide", dialogId: EXPORT_CODE_DIALOG },
  createDisk: { source: "emu", dialogId: CREATE_DISK_DIALOG }
};
