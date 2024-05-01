import {
  NEW_PROJECT_DIALOG,
  EXPORT_CODE_DIALOG,
  CREATE_DISK_DIALOG
} from "@common/messaging/dialog-ids";
import { IdeCommandContext } from "../../abstractions/IdeCommandContext";
import { IdeCommandResult } from "../../abstractions/IdeCommandResult";
import {
  commandSuccess,
  commandError
} from "../services/ide-commands";
import { CommandWithSingleStringBase } from "./CommandWithSimpleStringBase";
import { displayDialogAction } from "@common/state/actions";

export class DisplayDialogCommand extends CommandWithSingleStringBase {
  readonly id = "display-dialog";
  readonly description = "Displays the spceified dialog";
  readonly usage = "display-dialog <dialogId>";
  readonly aliases = [];

  async doExecute (context: IdeCommandContext): Promise<IdeCommandResult> {
    if (this.arg in publicDialogIds) {
      context.store.dispatch(displayDialogAction(publicDialogIds[this.arg]));
      return commandSuccess;
    }
    return commandError(`Unknown dialog ID: ${this.arg}`);
  }
}

export const publicDialogIds: Record<string, number> = {
  newProject: NEW_PROJECT_DIALOG,
  export: EXPORT_CODE_DIALOG,
  createDisk: CREATE_DISK_DIALOG
};
