import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import type { IdeCommandResult } from "@renderer/abstractions/IdeCommandResult";

import { MI_ZXNEXT } from "@common/machines/constants";
import { DMA_LOG_PANEL_ID, DMA_TIMELINE_PANEL_ID, DMA_TRANSFERS_PANEL_ID } from "@common/state/common-ids";
import { createSpecialDocument } from "@renderer/features/documents/specialDocuments";
import { buildDmaModel } from "@renderer/features/dma/dmaViewModel";
import { formatDmaState } from "@renderer/features/dma/dmaText";
import { setDmaOverlaySelection } from "@renderer/features/dma/dmaOverlayStore";
import { IdeCommandBase, commandError, commandSuccess, writeMessage, writeSuccessMessage } from "@renderer/appIde/services/ide-commands";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import type { DmaStepMode } from "@common/zxnext/dma/dmaStops";
import type { MessageKey } from "@common/i18n/keys.generated";
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

/** Why a DMA step cannot start now, or undefined when it can (§12.3) */
async function dmaStepRefusal(context: IdeCommandContext, mode: DmaStepMode): Promise<MessageKey | undefined> {
  const machineId = context.service.machineService.getMachineInfo()?.machine?.machineId;
  if (machineId !== MI_ZXNEXT) return "commands.dma.nextOnly";
  const emuState = context.store.getState().emulatorState;
  if (emuState?.machineState === MachineControllerState.Running && !emuState?.isDebugging) {
    return "commands.dma.stepRunningNormal";
  }
  const state = await context.emuApi.getDmaState();
  const active = state.seq !== "idle" || state.busRequested;
  if (mode === "release" ? !state.busAcknowledged && !active : !active) return "commands.dma.stepIdle";
  return undefined;
}

/** The three DMA steps: one command class, three ids */
abstract class DmaStepCommandBase extends IdeCommandBase {
  protected abstract readonly mode: DmaStepMode;
  protected abstract readonly stepping: MessageKey;

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    const refused = await dmaStepRefusal(context, this.mode);
    if (refused) return commandError(t(refused));
    await context.emuApi.stepDma(this.mode);
    writeSuccessMessage(context.output, t(this.stepping));
    return commandSuccess;
  }
}

/** `step-dma`: runs the machine in debug mode until the DMA moves its next byte (§12.3). */
export class StepDmaCommand extends DmaStepCommandBase {
  readonly id = "step-dma";
  get description() {
    return t("commands.dma.stepDescription");
  }
  readonly usage = "step-dma";
  protected readonly mode = "byte" as const;
  protected readonly stepping = "commands.dma.steppingByte" as const;
}

/** `step-dma-block`: runs the machine in debug mode until the DMA ends its block (§12.3). */
export class StepDmaBlockCommand extends DmaStepCommandBase {
  readonly id = "step-dma-block";
  get description() {
    return t("commands.dma.stepBlockDescription");
  }
  readonly usage = "step-dma-block";
  protected readonly mode = "block" as const;
  protected readonly stepping = "commands.dma.steppingBlock" as const;
}

/** `step-dma-release`: runs the machine in debug mode until the DMA lets go of the bus (§12.3). */
export class StepDmaReleaseCommand extends DmaStepCommandBase {
  readonly id = "step-dma-release";
  get description() {
    return t("commands.dma.stepReleaseDescription");
  }
  readonly usage = "step-dma-release";
  protected readonly mode = "release" as const;
  protected readonly stepping = "commands.dma.steppingRelease" as const;
}

/** `show-dma-timeline`: opens the DMA Bus Timeline document, which records while it is open (§13.2). */
export class ShowDmaTimelineCommand extends IdeCommandBase {
  readonly id = "show-dma-timeline";
  get description() {
    return t("commands.dma.showTimelineDescription");
  }
  readonly usage = "show-dma-timeline";

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    const machineId = context.service.machineService.getMachineInfo()?.machine?.machineId;
    if (machineId !== MI_ZXNEXT) return commandError(t("commands.dma.nextOnly"));
    const documentHubService = context.service.projectService.getActiveDocumentHubService();
    if (documentHubService.isOpen(DMA_TIMELINE_PANEL_ID)) {
      await documentHubService.setActiveDocument(DMA_TIMELINE_PANEL_ID);
    } else {
      await documentHubService.openDocument(createSpecialDocument(DMA_TIMELINE_PANEL_ID), undefined, false);
    }
    return commandSuccess;
  }
}

/** `hide-dma-timeline`: closes the DMA Bus Timeline document, which stops its recording. */
export class HideDmaTimelineCommand extends IdeCommandBase {
  readonly id = "hide-dma-timeline";
  get description() {
    return t("commands.dma.hideTimelineDescription");
  }
  readonly usage = "hide-dma-timeline";

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    const documentHubService = context.service.projectService.getActiveDocumentHubService();
    await documentHubService.closeDocument(DMA_TIMELINE_PANEL_ID);
    return commandSuccess;
  }
}

/** `show-dma-transfers`: opens the DMA Transfers document, which records while it is open (§14.2). */
export class ShowDmaTransfersCommand extends IdeCommandBase {
  readonly id = "show-dma-transfers";
  get description() {
    return t("commands.dma.showTransfersDescription");
  }
  readonly usage = "show-dma-transfers";

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    const machineId = context.service.machineService.getMachineInfo()?.machine?.machineId;
    if (machineId !== MI_ZXNEXT) return commandError(t("commands.dma.nextOnly"));
    const documentHubService = context.service.projectService.getActiveDocumentHubService();
    if (documentHubService.isOpen(DMA_TRANSFERS_PANEL_ID)) {
      await documentHubService.setActiveDocument(DMA_TRANSFERS_PANEL_ID);
    } else {
      await documentHubService.openDocument(createSpecialDocument(DMA_TRANSFERS_PANEL_ID), undefined, false);
    }
    return commandSuccess;
  }
}

/** `hide-dma-transfers`: closes the DMA Transfers document, which stops its recording and the overlay. */
export class HideDmaTransfersCommand extends IdeCommandBase {
  readonly id = "hide-dma-transfers";
  get description() {
    return t("commands.dma.hideTransfersDescription");
  }
  readonly usage = "hide-dma-transfers";

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    setDmaOverlaySelection(undefined);
    const documentHubService = context.service.projectService.getActiveDocumentHubService();
    await documentHubService.closeDocument(DMA_TRANSFERS_PANEL_ID);
    try {
      await context.emuApi.setDmaTransfersRecording(false);
    } catch {
      // --- not a Next, or no machine: nothing records
    }
    return commandSuccess;
  }
}
