import { IdeCommandContext } from "../../abstractions/IdeCommandContext";
import { IdeCommandResult } from "../../abstractions/IdeCommandResult";
import { commandSuccessWith } from "../services/ide-commands";
import { CommandWithSingleStringBase } from "./CommandWithSimpleStringBase";
import {
  Z88DK_ALL,
  Z88DK_INSTALL_FOLDER
} from "@main/z88dk-integration/z88dk-config";

export class ResetZ88DkCommand extends CommandWithSingleStringBase {
  readonly id = "z88dk-reset";
  readonly description =
    "Resets Z88DK settings with the provided installation folder";
  readonly usage = "z88dk-reset <Full ZXBC executable path>";
  readonly aliases = ["z88dkr"];

  prepareCommand (): void {
    delete this.arg;
  }

  async doExecute (context: IdeCommandContext): Promise<IdeCommandResult> {
    if (this.arg) {
      await context.service.ideCommandsService.executeCommand(
        `set ${Z88DK_INSTALL_FOLDER} "${this.arg}"`
      );
      let cmdMessage = `Z88DK install folder set to ${this.arg}`;
      return commandSuccessWith(cmdMessage);
    } else {
      await context.service.ideCommandsService.executeCommand(
        `set ${Z88DK_ALL}`
      );
      return commandSuccessWith("Z88DK settings removed");
    }
  }
}
