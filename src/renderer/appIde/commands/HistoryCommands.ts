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
import {
  historyReasonText,
  historyStepText,
  type HistoryNavigationOp
} from "@common/history/historyNavigation";
import { readFoldPreference } from "@renderer/features/history/historyViewModel";
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
    const cpu = await context.emuApi.getCpuState({ present: true });
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

// =================================================================================================
// Lite step back (`.plans/LITE_STEP_BACK_PLAN.md` §4.5, G4.3): the history cursor. Navigation is
// not a machine command (D4); it moves what the IDE shows, never the machine.

/** Moves the history cursor and reports where it went, or why it did not */
async function navigate(
  context: IdeCommandContext,
  op: HistoryNavigationOp,
  name: string
): Promise<IdeCommandResult> {
  const refused = requireHistory(context);
  if (refused) return refused;
  const machineId = context.store.getState().emulatorState?.machineId;
  const result = await context.emuApi.navigateHistory(op, { foldServices: readFoldPreference(machineId) });
  const info = await context.emuApi.getHistoryInfo();
  for (const note of result.notes ?? []) writeMessage(context.output, note, "yellow");
  if (result.reason === "running" || result.reason === "noHistory" || result.reason === "empty") {
    return commandError(historyReasonText(result, info?.count) ?? "Cannot move in the history");
  }
  const reason = historyReasonText(result, info?.count);
  if (reason) writeInfoMessage(context.output, reason);
  if (result.uncertain) {
    writeMessage(context.output, "Call/return pairing uncertain here: SP does not match the call", "yellow");
  }
  if (!result.moved) return commandSuccess;
  if (result.position === 0) {
    writeSuccessMessage(context.output, `${name}: back at the present`);
    return commandSuccess;
  }
  const cpu = await context.emuApi.getCpuState();
  const hit = result.breakpoint ? ` (breakpoint ${result.breakpoint})` : "";
  writeSuccessMessage(
    context.output,
    `${name}: history step ${historyStepText(result.position)} at PC=$${cpu.pc.toString(16).toUpperCase().padStart(4, "0")}${hit}`
  );
  return commandSuccess;
}

/** `step-back`: to the previous instruction (or statement) in the history */
export class StepBackCommand extends IdeCommandBase {
  readonly id = "step-back";
  readonly description = "Steps back to the previous instruction in the execution history";
  readonly usage = "step-back";
  readonly aliases = ["stb"];

  execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    return navigate(context, "back", "Step back");
  }
}

/** `step-forward`: to the next instruction in the history; past the newest, the present */
export class StepForwardCommand extends IdeCommandBase {
  readonly id = "step-forward";
  readonly description = "Steps forward through the execution history, up to the present";
  readonly usage = "step-forward";
  readonly aliases = ["stf"];

  execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    return navigate(context, "forward", "Step forward");
  }
}

/** `step-back-over`: as step-back, but a call that returned is passed over to its CALL */
export class StepBackOverCommand extends IdeCommandBase {
  readonly id = "step-back-over";
  readonly description = "Steps back over a call that returned, to the call instruction";
  readonly usage = "step-back-over";
  readonly aliases = ["stbo"];

  execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    return navigate(context, "backOver", "Reverse step over");
  }
}

/** `step-back-out`: to the call that entered the current routine */
export class StepBackOutCommand extends IdeCommandBase {
  readonly id = "step-back-out";
  readonly description = "Steps back out of the current routine, to the call that entered it";
  readonly usage = "step-back-out";
  readonly aliases = ["stbu"];

  execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    return navigate(context, "backOut", "Reverse step out");
  }
}

/** `reverse-continue`: back to the previous hit of an enabled execution breakpoint */
export class ReverseContinueCommand extends IdeCommandBase {
  readonly id = "reverse-continue";
  readonly description = "Goes back to the previous breakpoint hit in the execution history";
  readonly usage = "reverse-continue";
  readonly aliases = ["rcont"];

  execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    return navigate(context, "reverseContinue", "Reverse continue");
  }
}

/** `history-present`: leaves the history and shows the live machine again */
export class HistoryPresentCommand extends IdeCommandBase {
  readonly id = "history-present";
  readonly description = "Returns from the execution history to the present";
  readonly usage = "history-present";
  readonly aliases = ["hpres"];

  execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    return navigate(context, "present", "Return to present");
  }
}

/**
 * `history-take-over`: the point the machine stands at in the past becomes the present
 * (`.plans/REVERSE_DEBUGGING_PLAN.md` D12): the recorded future goes, and live input resumes
 */
export class HistoryTakeOverCommand extends IdeCommandBase {
  readonly id = "history-take-over";
  readonly description = "Takes over at the current point in the past: discards the recorded future";
  readonly usage = "history-take-over";
  readonly aliases = ["htake"];

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    const refused = requireHistory(context);
    if (refused) return refused;
    if (!(await context.emuApi.takeOverHere())) {
      return commandError("Take over here works in the past of a reverse-debugging session (step back first)");
    }
    const cpu = await context.emuApi.getCpuState();
    writeSuccessMessage(
      context.output,
      `Took over at PC=$${cpu.pc.toString(16).toUpperCase().padStart(4, "0")}: this is the present now`
    );
    return commandSuccess;
  }
}

/** `history-goto <-n | #seq>`: to a step (−42) or a record's sequence number (#1234) */
export class HistoryGotoCommand extends IdeCommandBase<{ target: string }> {
  readonly id = "history-goto";
  readonly description = "Moves the history cursor to a step (-42) or a record sequence number (#1234)";
  readonly usage = "history-goto <-n | #sequence>";
  readonly argumentInfo: CommandArgumentInfo = {
    mandatory: [{ name: "target", type: "string" }]
  };

  execute(context: IdeCommandContext, args: { target: string }): Promise<IdeCommandResult> {
    const op = parseHistoryTarget(String(args?.target ?? ""));
    if (!op) return Promise.resolve(commandError("Use a step (-42) or a sequence number (#1234)"));
    return navigate(context, op, "Go to");
  }
}

/** `-42` (or `−42`, or `42`) is a step back from the present; `#1234` a sequence number */
export function parseHistoryTarget(text: string): HistoryNavigationOp | undefined {
  const t = text.trim().replace("−", "-");
  const seq = /^#(\d+)$/.exec(t);
  if (seq) return { toSequence: Number(seq[1]) };
  const step = /^-?(\d+)$/.exec(t);
  if (step) {
    const n = Number(step[1]);
    return n === 0 ? "present" : { toPosition: n };
  }
  return undefined;
}
