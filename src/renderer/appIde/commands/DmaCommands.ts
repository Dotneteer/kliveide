import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import type { IdeCommandResult } from "@renderer/abstractions/IdeCommandResult";

import { MI_ZXNEXT } from "@common/machines/constants";
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
