import { CommandArgumentInfo } from "@renderer/abstractions/IdeCommandInfo";
import { IdeCommandContext } from "../../abstractions/IdeCommandContext";
import { IdeCommandResult } from "../../abstractions/IdeCommandResult";
import { commandSuccess, commandSuccessWith, IdeCommandBase } from "../services/ide-commands";
import { Z88DK_ALL, Z88DK_INSTALL_FOLDER } from "@main/z88dk-integration/z88dk-config";
import { Z88DK_INTEGRATION_DIALOG } from "@common/messaging/dialog-ids";
import { openRendererDialog } from "@renderer/controls/overlay/dialogRequestBridge";
import { t } from "@common/i18n/i18n";

type ResetZ88DkCommandArgs = {
  z88dkPath: string;
};

/** Sets (or, without an argument, removes) the z88dk settings directly; for scripts. */
export class ResetZ88DkCommand extends IdeCommandBase<ResetZ88DkCommandArgs> {
  readonly id = "z88dk-reset";
  get description() {
    return t("commands.z88dk.resetDescription");
  }
  readonly usage = "z88dk-reset [<z88dk installation folder>]";
  readonly aliases = ["z88dkr"];

  readonly argumentInfo: CommandArgumentInfo = {
    optional: [{ name: "z88dkPath" }]
  };

  async execute(
    context: IdeCommandContext,
    args: ResetZ88DkCommandArgs
  ): Promise<IdeCommandResult> {
    if (args.z88dkPath) {
      await context.service.ideCommandsService.executeCommand(
        `set ${Z88DK_INSTALL_FOLDER} "${args.z88dkPath}"`
      );
      return commandSuccessWith(t("commands.z88dk.folderSet", { path: args.z88dkPath }));
    } else {
      await context.service.ideCommandsService.executeCommand(`set ${Z88DK_ALL}`);
      return commandSuccessWith(t("commands.z88dk.removed"));
    }
  }
}

/** Opens the z88dk integration dialog (`.plans/Z88DK_INTEGRATION_PLAN.md` §4.2). */
export class SetupZ88DkCommand extends IdeCommandBase {
  readonly id = "z88dk-setup";
  // --- Opens a modal dialog: never through automation
  readonly automation = "deny" as const;
  get description() {
    return t("commands.z88dk.setupDescription");
  }
  readonly usage = "z88dk-setup";
  readonly aliases = [];

  async execute(): Promise<IdeCommandResult> {
    await openRendererDialog("ide", Z88DK_INTEGRATION_DIALOG);
    return commandSuccess;
  }
}
