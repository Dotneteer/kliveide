import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import type { IdeCommandResult } from "@renderer/abstractions/IdeCommandResult";

import { MI_ZXNEXT } from "@common/machines/constants";
import { INT_TIMELINE_PANEL_ID } from "@common/state/common-ids";
import { createSpecialDocument } from "@renderer/features/documents/specialDocuments";
import { IdeCommandBase, commandError, commandSuccess } from "@renderer/appIde/services/ide-commands";
import { t } from "@common/i18n/i18n";

/*
 * The ZX Spectrum Next interrupt debugging commands (`dev/plans/NEXT_INTERRUPTS_DEBUGGING_PLAN.md`).
 * Interrupt stops are breakpoints: `bp-set int:<kind>` lives with the other specs in
 * `BreakpointCommands.ts`.
 */

function requireNext(context: IdeCommandContext): IdeCommandResult | undefined {
  const machineId = context.service.machineService.getMachineInfo()?.machine?.machineId;
  return machineId === MI_ZXNEXT ? undefined : commandError(t("commands.interrupts.nextOnly"));
}

/** `show-int-timeline`: opens the Interrupt Timeline document (which starts recording). */
export class ShowInterruptTimelineCommand extends IdeCommandBase {
  readonly id = "show-int-timeline";
  get description() {
    return t("commands.interrupts.showTimelineDescription");
  }
  readonly usage = "show-int-timeline";
  readonly aliases = ["shintl"];

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    const refused = requireNext(context);
    if (refused) return refused;
    const documentHubService = context.service.projectService.getActiveDocumentHubService();
    if (documentHubService.isOpen(INT_TIMELINE_PANEL_ID)) {
      await documentHubService.setActiveDocument(INT_TIMELINE_PANEL_ID);
    } else {
      await documentHubService.openDocument(createSpecialDocument(INT_TIMELINE_PANEL_ID), undefined, false);
    }
    return commandSuccess;
  }
}

/** `hide-int-timeline`: closes the Interrupt Timeline document (which stops recording). */
export class HideInterruptTimelineCommand extends IdeCommandBase {
  readonly id = "hide-int-timeline";
  get description() {
    return t("commands.interrupts.hideTimelineDescription");
  }
  readonly usage = "hide-int-timeline";
  readonly aliases = ["hintl"];

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    const documentHubService = context.service.projectService.getActiveDocumentHubService();
    await documentHubService.closeDocument(INT_TIMELINE_PANEL_ID);
    return commandSuccess;
  }
}
