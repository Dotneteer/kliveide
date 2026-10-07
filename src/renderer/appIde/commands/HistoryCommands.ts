import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import type { IdeCommandResult } from "@renderer/abstractions/IdeCommandResult";
import type { CommandArgumentInfo } from "@renderer/abstractions/IdeCommandInfo";

import type { KliveCompilerOutput } from "@abstractions/CompilerInfo";
import type { Z80CpuState } from "@common/messaging/EmuApi";
import { MF_EXEC_HISTORY, MI_ZXNEXT } from "@common/machines/constants";
import { machineRegistry } from "@common/machines/machine-registry";
import { HISTORY_PANEL_ID } from "@common/state/common-ids";
import { historyContextDecoder } from "@common/history/contexts";
import { decodeHistoryPage, HistoryKind } from "@common/history/historyRecord";
import { formatHistoryRow } from "@common/history/historyRow";
import { formatRegisterDiff, registerDiff } from "@common/history/registerDiff";
import { createSpecialDocument } from "@renderer/features/documents/specialDocuments";
import { HistoryDisassemblyCache, historyLabelLookup } from "@renderer/features/history/historyDisassembly";
import { locateSource } from "@renderer/appIde/utils/source-location";
import {
  IdeCommandBase,
  commandError,
  commandSuccess,
  writeInfoMessage,
  writeMessage,
  writeSuccessMessage
} from "@renderer/appIde/services/ide-commands";

/*
 * The execution history's commands (`.plans/EXECUTION_HISTORY_VIEWER_PLAN.md` §4.5). They gate on
 * the `MF_EXEC_HISTORY` capability, not on a machine id, so G4.2 lights them up without changes.
 */

/** Refuses a command on a machine that does not record history */
function requireHistory(context: IdeCommandContext): IdeCommandResult | undefined {
  const machineId = context.service.machineService.getMachineInfo()?.machine?.machineId;
  const supported = !!machineRegistry.find((m) => m.machineId === machineId)?.features?.[MF_EXEC_HISTORY];
  return supported ? undefined : commandError("This machine does not record execution history");
}

/** `show-history`: opens the Execution History document. */
export class ShowHistoryCommand extends IdeCommandBase {
  readonly id = "show-history";
  readonly description = "Displays the Execution History";
  readonly usage = "show-history";
  readonly aliases = ["shhist"];

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    const refused = requireHistory(context);
    if (refused) return refused;
    const documentHubService = context.service.projectService.getActiveDocumentHubService();
    if (documentHubService.isOpen(HISTORY_PANEL_ID)) {
      await documentHubService.setActiveDocument(HISTORY_PANEL_ID);
    } else {
      await documentHubService.openDocument(createSpecialDocument(HISTORY_PANEL_ID), undefined, false);
    }
    return commandSuccess;
  }
}

/** `hide-history`: closes the Execution History document. */
export class HideHistoryCommand extends IdeCommandBase {
  readonly id = "hide-history";
  readonly description = "Hides the Execution History";
  readonly usage = "hide-history";
  readonly aliases = ["hhist"];

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    const documentHubService = context.service.projectService.getActiveDocumentHubService();
    await documentHubService.closeDocument(HISTORY_PANEL_ID);
    return commandSuccess;
  }
}

/** `history-clear`: empties the history ring. */
export class ClearExecutionHistoryCommand extends IdeCommandBase {
  readonly id = "history-clear";
  readonly description = "Clears the execution history";
  readonly usage = "history-clear";
  readonly aliases = ["hclr"];

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    const refused = requireHistory(context);
    if (refused) return refused;
    await context.emuApi.clearHistory();
    writeSuccessMessage(context.output, "Execution history cleared");
    return commandSuccess;
  }
}

/** `history [n]`: prints the newest n records (20 by default) to the output. */
export class HistoryCommand extends IdeCommandBase<{ count?: number }> {
  readonly id = "history";
  readonly description = "Prints the newest execution history records (20 by default)";
  readonly usage = "history [<count>]";
  readonly argumentInfo: CommandArgumentInfo = {
    optional: [{ name: "count", type: "number", minValue: 1, maxValue: 10000 }]
  };

  async execute(context: IdeCommandContext, args: { count?: number }): Promise<IdeCommandResult> {
    const refused = requireHistory(context);
    if (refused) return refused;
    const info = await context.emuApi.getHistoryInfo();
    if (!info?.count) {
      writeInfoMessage(
        context.output,
        info?.enabled
          ? "No history yet"
          : "No history: it is recorded only when the machine is started with debugging"
      );
      return commandSuccess;
    }
    const count = Math.min(args?.count ?? 20, info.count);
    const from = info.newestSequence - count + 1;
    // --- One more on each side would be the state after; the newest's is the live CPU
    const page = await context.emuApi.getHistoryRecords(from, count);
    if (!page) return commandError("Could not read the execution history");
    const records = decodeHistoryPage(page);
    const cpu = await context.emuApi.getCpuState();
    const machineId = context.store.getState().emulatorState?.machineId;
    const compilation = context.store.getState().compilation?.result as KliveCompilerOutput | undefined;
    const symbols = (compilation as { symbols?: Record<string, unknown> } | undefined)?.symbols;
    const disassembly = new HistoryDisassemblyCache(machineId === MI_ZXNEXT, historyLabelLookup(symbols));
    const decoder = historyContextDecoder(info.machineId);
    const labels = await context.emuApi.getPartitionLabels().catch(() => ({}) as Record<number, string>);

    writeMessage(context.output, `${info.count.toLocaleString("en-US")} of ${info.capacity.toLocaleString("en-US")} recorded`, "cyan");
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      const after = i + 1 < records.length ? records[i + 1].regs : (cpu as Z80CpuState);
      const instruction = await disassembly.disassemble(r);
      const partition = decoder?.partitionFor(r.context, r.regs.pc);
      const location =
        r.kind === HistoryKind.Instruction
          ? locateSource(compilation, r.regs.pc, undefined, { partition, machineId })
          : undefined;
      writeMessage(
        context.output,
        formatHistoryRow({
          record: r,
          step: r.sequence - info.newestSequence - 1,
          machineId: info.machineId,
          instruction: instruction?.text,
          length: instruction?.length,
          source: location ? `${location.filename.split(/[\\/]/).pop()}:${location.line}` : undefined,
          changes: r.kind === HistoryKind.Instruction ? formatRegisterDiff(registerDiff(r.regs, after)) : undefined,
          partitionLabel: partition === undefined ? undefined : labels[partition]
        })
      );
    }
    if (page.gone) writeInfoMessage(context.output, "The oldest requested records were overwritten while reading");
    return commandSuccess;
  }
}
