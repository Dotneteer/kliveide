import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import type { IdeCommandResult } from "@renderer/abstractions/IdeCommandResult";

import { MI_ZXNEXT } from "@common/machines/constants";
import { DMA_LOG_PANEL_ID } from "@common/state/common-ids";
import { createSpecialDocument } from "@renderer/features/documents/specialDocuments";
import { buildDmaModel } from "@renderer/features/dma/dmaViewModel";
import { formatDmaState } from "@renderer/features/dma/dmaText";
import { IdeCommandBase, commandError, commandSuccess, writeMessage } from "@renderer/appIde/services/ide-commands";
import { t } from "@common/i18n/i18n";

/**
 * `dma`: prints the ZX Spectrum Next DMA's state, the DMA panel's rows as text
 * (`dev/plans/NEXT_DMA_DEBUGGING_PLAN.md` §3.2). Reading it never changes the machine.
 */
export class DmaStateCommand extends IdeCommandBase {
  readonly id = "dma";
  get description() {
    return t("commands.dma.description");
  }
  readonly usage = "dma";

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    const machineId = context.service.machineService.getMachineInfo()?.machine?.machineId;
    if (machineId !== MI_ZXNEXT) return commandError(t("commands.dma.nextOnly"));
    const state = await context.emuApi.getDmaState();
    for (const line of formatDmaState(state, buildDmaModel(state))) {
      writeMessage(context.output, line);
    }
    return commandSuccess;
  }
}

/** `show-dma-log`: opens the DMA Port Log document, which records while it is open (§11.3). */
export class ShowDmaLogCommand extends IdeCommandBase {
  readonly id = "show-dma-log";
  get description() {
    return t("commands.dma.showLogDescription");
  }
  readonly usage = "show-dma-log";

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    const machineId = context.service.machineService.getMachineInfo()?.machine?.machineId;
    if (machineId !== MI_ZXNEXT) return commandError(t("commands.dma.nextOnly"));
    const documentHubService = context.service.projectService.getActiveDocumentHubService();
    if (documentHubService.isOpen(DMA_LOG_PANEL_ID)) {
      await documentHubService.setActiveDocument(DMA_LOG_PANEL_ID);
    } else {
      await documentHubService.openDocument(createSpecialDocument(DMA_LOG_PANEL_ID), undefined, false);
    }
    return commandSuccess;
  }
}

/** `hide-dma-log`: closes the DMA Port Log document, which stops its recording. */
export class HideDmaLogCommand extends IdeCommandBase {
  readonly id = "hide-dma-log";
  get description() {
    return t("commands.dma.hideLogDescription");
  }
  readonly usage = "hide-dma-log";

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    const documentHubService = context.service.projectService.getActiveDocumentHubService();
    await documentHubService.closeDocument(DMA_LOG_PANEL_ID);
    return commandSuccess;
  }
}
