import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import type { IdeCommandResult } from "@renderer/abstractions/IdeCommandResult";
import type { CommandArgumentInfo } from "@renderer/abstractions/IdeCommandInfo";

import { MI_ZXNEXT } from "@common/machines/constants";
import { NEXTREGS_PANEL_ID } from "@common/state/common-ids";
import { createSpecialDocument } from "@renderer/features/documents/specialDocuments";
import { requestNextRegReveal } from "@renderer/features/nextRegs/nextRegReveal";
import { IdeCommandBase, commandError, commandSuccess } from "@renderer/appIde/services/ide-commands";
import { t } from "@common/i18n/i18n";

/*
 * The Next Registers document's commands. The Debug sidebar's Next Registers panel pops out
 * through `show-nextregs`, and so does View › Machine Views › Next Registers.
 */

/**
 * `show-nextregs [<reg>]`: opens the Next Registers document and, with a register number, selects
 * that register and scrolls it into view.
 */
export class ShowNextRegsCommand extends IdeCommandBase<{ reg?: number }> {
  readonly id = "show-nextregs";
  get description() {
    return t("commands.nextRegs.showDescription");
  }
  readonly usage = "show-nextregs [<reg>]";
  readonly aliases = ["shnr"];
  readonly argumentInfo: CommandArgumentInfo = {
    optional: [{ name: "reg", type: "number", minValue: 0, maxValue: 0xff }]
  };

  async execute(context: IdeCommandContext, args: { reg?: number }): Promise<IdeCommandResult> {
    const machineId = context.service.machineService.getMachineInfo()?.machine?.machineId;
    if (machineId !== MI_ZXNEXT) return commandError(t("commands.nextRegs.nextOnly"));
    if (args?.reg !== undefined) requestNextRegReveal(args.reg);
    const documentHubService = context.service.projectService.getActiveDocumentHubService();
    if (documentHubService.isOpen(NEXTREGS_PANEL_ID)) {
      await documentHubService.setActiveDocument(NEXTREGS_PANEL_ID);
    } else {
      await documentHubService.openDocument(createSpecialDocument(NEXTREGS_PANEL_ID), undefined, false);
    }
    return commandSuccess;
  }
}

/** `hide-nextregs`: closes the Next Registers document. */
export class HideNextRegsCommand extends IdeCommandBase {
  readonly id = "hide-nextregs";
  get description() {
    return t("commands.nextRegs.hideDescription");
  }
  readonly usage = "hide-nextregs";
  readonly aliases = ["hnr"];

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    const documentHubService = context.service.projectService.getActiveDocumentHubService();
    await documentHubService.closeDocument(NEXTREGS_PANEL_ID);
    return commandSuccess;
  }
}
