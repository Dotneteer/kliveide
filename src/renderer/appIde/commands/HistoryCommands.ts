import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import type { IdeCommandResult } from "@renderer/abstractions/IdeCommandResult";
import type { CommandArgumentInfo } from "@renderer/abstractions/IdeCommandInfo";
import type { ValidationMessage } from "@renderer/abstractions/ValidationMessage";

import type { KliveCompilerOutput } from "@abstractions/CompilerInfo";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import type { Z80CpuState } from "@common/messaging/EmuApi";
import { MF_EXEC_HISTORY, MI_ZXNEXT } from "@common/machines/constants";
import { machineRegistry } from "@common/machines/machine-registry";
import {
  ADVANCED_DEBUGGING_OFF_MESSAGE,
  isAdvancedDebuggingEnabled
} from "@common/features/advancedDebugging";
import { HISTORY_PANEL_ID } from "@common/state/common-ids";
import { historyContextDecoder } from "@common/history/contexts";
import type { ExecutionHistoryInfo } from "@common/history/historyTypes";
import { decodeHistoryPage, type HistoryRecord, type HistoryRegisters } from "@common/history/historyRecord";
import {
  collectTrace,
  defaultTraceOptions,
  exportTrace,
  parseTraceColumns,
  traceFormatOfName,
  traceHeaderLines,
  VIEWER_TRACE_COLUMNS,
  type TraceExportOptions,
  type TraceFormat,
  type TraceMeta
} from "@common/history/historyExport";
import type { HistoryServiceSpan } from "@common/history/serviceSpans";
import { integerSymbolsOf } from "@common/utils/breakpoint-condition/integer-symbols";
import { createTraceResolvers, historyRegistersOf } from "@renderer/features/history/historyTrace";
import {
  historyReasonText,
  historyStepText,
  type HistoryNavigationOp
} from "@common/history/historyNavigation";
import {
  historyRowMatches,
  parseHistoryFilter,
  readFoldPreference
} from "@renderer/features/history/historyViewModel";
import { forkConfirmation } from "@common/history/reverseDebugText";
import { isInThePast } from "./reverseDebugFork";
import { createSpecialDocument } from "@renderer/features/documents/specialDocuments";
import { HistoryDisassemblyCache, historyLabelLookup } from "@renderer/features/history/historyDisassembly";
import {
  IdeCommandBase,
  commandError,
  commandSuccess,
  validationError,
  writeInfoMessage,
  writeMessage,
  writeSuccessMessage
} from "@renderer/appIde/services/ide-commands";

/*
 * The execution history's commands (`.plans/EXECUTION_HISTORY_VIEWER_PLAN.md` §4.5). They gate on
 * the `MF_EXEC_HISTORY` capability, not on a machine id, so G4.2 lights them up without changes,
 * and on the advanced-debugging switch (`@common/features/advancedDebugging`).
 */

/** Refuses a command on a machine that does not record history */
function requireHistory(context: IdeCommandContext): IdeCommandResult | undefined {
  if (!isAdvancedDebuggingEnabled(context.store.getState())) return commandError(ADVANCED_DEBUGGING_OFF_MESSAGE);
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

/** The message for a ring with nothing in it, as `history` and `history-export` say it */
function noHistoryText(info: ExecutionHistoryInfo | undefined): string {
  return info?.enabled ? "No history yet" : "No history: it is recorded only when the machine is started with debugging";
}

/** The compilation the IDE holds now: labels and source lines come from it (TRACE_EXPORT_PLAN D12) */
function currentCompilation(context: IdeCommandContext): KliveCompilerOutput | undefined {
  return context.store.getState().compilation?.result as KliveCompilerOutput | undefined;
}

function symbolsOf(compilation: KliveCompilerOutput | undefined): Record<string, unknown> | undefined {
  return (compilation as { symbols?: Record<string, unknown> } | undefined)?.symbols;
}

/** The disassembly, source, partition and context resolvers the document uses, for a command */
async function commandTraceResolvers(
  context: IdeCommandContext,
  info: ExecutionHistoryInfo,
  include?: (record: HistoryRecord, text: string) => boolean
) {
  const machineId = context.store.getState().emulatorState?.machineId;
  const compilation = currentCompilation(context);
  const labels = await context.emuApi.getPartitionLabels().catch(() => ({}) as Record<number, string>);
  return createTraceResolvers({
    machineId,
    historyMachineId: info.machineId,
    compilation,
    partitionLabels: labels ?? {},
    disassembly: new HistoryDisassemblyCache(machineId === MI_ZXNEXT, historyLabelLookup(symbolsOf(compilation))),
    include
  });
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
      writeInfoMessage(context.output, noHistoryText(info));
      return commandSuccess;
    }
    const count = Math.min(args?.count ?? 20, info.count);
    const from = info.newestSequence - count + 1;
    // --- One more on each side would be the state after; the newest's is the live CPU
    const page = await context.emuApi.getHistoryRecords(from, count);
    if (!page) return commandError("Could not read the execution history");
    const records = decodeHistoryPage(page);
    const cpu = (await context.emuApi.getCpuState({ present: true })) as Z80CpuState;
    const resolvers = await commandTraceResolvers(context, info);

    writeMessage(context.output, `${info.count.toLocaleString("en-US")} of ${info.capacity.toLocaleString("en-US")} recorded`, "cyan");
    // --- The viewer's columns through the exporter: one formatter for every text row (TRACE_EXPORT_PLAN D14)
    const lines = exportTrace(
      [records],
      { machineId: info.machineId, newestSequence: info.newestSequence, afterLast: historyRegistersOf(cpu) },
      [],
      { ...defaultTraceOptions("text"), columns: VIEWER_TRACE_COLUMNS, header: false, repeats: true },
      resolvers
    );
    for await (const line of lines) writeMessage(context.output, line);
    if (page.gone) writeInfoMessage(context.output, "The oldest requested records were overwritten while reading");
    return commandSuccess;
  }
}

// =================================================================================================
// Trace export (`.plans/TRACE_EXPORT_PLAN.md` §4.2, G4.5)

/** Records one read fetches (the document's `BULK_READ`, D11) */
const EXPORT_PAGE = 8192;
/** Progress goes to the output pane this often (T9) */
const EXPORT_PROGRESS = 16384;

export type HistoryExportArgs = {
  file: string;
  "-from"?: string;
  "-to"?: string;
  "-count"?: string;
  "-format"?: string;
  "-columns"?: string;
  "-filter"?: string;
  "-absolute"?: boolean;
  "-repeats"?: boolean;
  "-nointerrupts"?: boolean;
  "-nomarkers"?: boolean;
  "-noheader"?: boolean;
  "-bom"?: boolean;
  "-f"?: boolean;
};

/** A range endpoint as a sequence number: `-42` is the 42nd step back (−1 is the newest), `#1234` a sequence */
function targetSequence(text: string, newest: number): number | undefined {
  const op = parseHistoryTarget(text);
  if (!op) return undefined;
  if (op === "present") return newest;
  if (typeof op === "object" && "toSequence" in op) return op.toSequence;
  if (typeof op === "object" && "toPosition" in op) return newest - op.toPosition + 1;
  return undefined;
}

/** The range to export: inclusive sequences, clamped to the ring, with what the clamping lost (D5) */
export function resolveExportRange(
  info: Pick<ExecutionHistoryInfo, "oldestSequence" | "newestSequence">,
  args: Pick<HistoryExportArgs, "-from" | "-to" | "-count">
): { from: number; to: number; warnings: string[] } | string {
  const newest = info.newestSequence;
  const parse = (text: string | undefined, name: string): number | string | undefined => {
    if (text === undefined) return undefined;
    const value = targetSequence(String(text), newest);
    return value === undefined ? `${name}: use a step (-42) or a sequence number (#1234)` : value;
  };
  const fromArg = parse(args["-from"], "-from");
  if (typeof fromArg === "string") return fromArg;
  const toArg = parse(args["-to"], "-to");
  if (typeof toArg === "string") return toArg;
  let count: number | undefined;
  if (args["-count"] !== undefined) {
    count = Number(args["-count"]);
    if (!Number.isInteger(count) || count < 1) return "-count: use a positive whole number";
    if (toArg !== undefined && fromArg !== undefined) return "Use -to or -count with -from, not both";
  }
  let from: number;
  let to: number;
  if (count !== undefined && fromArg !== undefined) {
    from = fromArg;
    to = fromArg + count - 1;
  } else if (count !== undefined) {
    to = toArg ?? newest;
    from = to - count + 1;
  } else {
    from = fromArg ?? info.oldestSequence;
    to = toArg ?? newest;
  }
  const warnings: string[] = [];
  if (from < info.oldestSequence) {
    const gone = info.oldestSequence - Math.max(from, 0);
    warnings.push(
      `The ring starts at #${info.oldestSequence}; ${gone.toLocaleString("en-US")} earlier record${gone === 1 ? " is" : "s are"} gone`
    );
    from = info.oldestSequence;
  }
  if (to > newest) {
    warnings.push(`The newest record is #${newest}`);
    to = newest;
  }
  if (from > to) return "The range is empty";
  return { from, to, warnings };
}

/**
 * `history-export <file>`: writes a range of the execution history to a text or CSV trace, so two
 * runs can be compared with any diff tool (`.plans/TRACE_EXPORT_PLAN.md`)
 */
export class HistoryExportCommand extends IdeCommandBase<HistoryExportArgs> {
  readonly id = "history-export";
  readonly description =
    "Exports the execution history as a text or CSV trace (the extension picks the format; -f overwrites)";
  readonly usage = [
    "history-export <file> [-from <-n|#seq>] [-to <-n|#seq>] [-count <n>]",
    "  [-format text|csv] [-columns default|viewer|all|<id,id,...>]",
    "  [-absolute] [-repeats] [-nointerrupts] [-nomarkers] [-filter <text>] [-noheader] [-bom] [-f]",
    `  columns: seq, step, frame, tact, addr, bytes, instr, source, changes, regs, flags, ctx`
  ];
  readonly aliases = ["hexp"];
  readonly argumentInfo: CommandArgumentInfo = {
    mandatory: [{ name: "file", type: "string" }],
    namedOptions: [
      { name: "-from", type: "string" },
      { name: "-to", type: "string" },
      { name: "-count", type: "string" },
      { name: "-format", type: "string" },
      { name: "-columns", type: "string" },
      { name: "-filter", type: "string" }
    ],
    commandOptions: ["-absolute", "-repeats", "-nointerrupts", "-nomarkers", "-noheader", "-bom", "-f"]
  };

  async validateCommandArgs(_context: IdeCommandContext, args: HistoryExportArgs): Promise<ValidationMessage[]> {
    const messages: ValidationMessage[] = [];
    const file = args.file?.trim();
    if (!file) messages.push(validationError("The trace file path cannot be empty."));
    const format = args["-format"]?.toLowerCase();
    if (format !== undefined && format !== "text" && format !== "csv") {
      messages.push(validationError("-format: use text or csv"));
    } else if (format === undefined && file && !traceFormatOfName(file)) {
      messages.push(validationError("Use a .txt, .log, .trace or .csv file, or name the format with -format."));
    }
    if (args["-columns"] !== undefined) {
      const columns = parseTraceColumns(String(args["-columns"]));
      if (typeof columns === "string") messages.push(validationError(columns));
    }
    return messages;
  }

  async execute(context: IdeCommandContext, args: HistoryExportArgs): Promise<IdeCommandResult> {
    const refused = requireHistory(context);
    if (refused) return refused;
    // --- The ring changes on every instruction (D10)
    if (context.store.getState().emulatorState?.machineState === MachineControllerState.Running) {
      return commandError("Pause the machine first: the history changes while it runs");
    }
    const file = args.file.trim();
    const format = ((args["-format"]?.toLowerCase() as TraceFormat | undefined) ?? traceFormatOfName(file))!;
    const columns = args["-columns"] !== undefined ? parseTraceColumns(String(args["-columns"])) : undefined;
    if (typeof columns === "string") return commandError(columns);

    const info = await context.emuApi.getHistoryInfo();
    if (!info?.count) return commandError(noHistoryText(info));
    const range = resolveExportRange(info, args);
    if (typeof range === "string") return commandError(range);
    const { from, to } = range;

    if (!args["-f"] && (await fileExists(context, file))) {
      return commandError(`${file} already exists; use -f to replace it.`);
    }

    const options: TraceExportOptions = {
      ...defaultTraceOptions(format),
      ...(columns ? { columns } : {}),
      absolute: !!args["-absolute"],
      repeats: !!args["-repeats"],
      interrupts: args["-nointerrupts"] ? (args["-nomarkers"] ? "drop" : "dropWithMarkers") : "keep",
      header: !args["-noheader"],
      bom: !!args["-bom"]
    };

    // --- The filter is the document's (D8)
    const filterText = args["-filter"]?.trim();
    const compilation = currentCompilation(context);
    const filter = filterText ? parseHistoryFilter(filterText, integerSymbolsOf(symbolsOf(compilation))) : undefined;
    const include = filter && filter.kind !== "none"
      ? (record: HistoryRecord, text: string) => historyRowMatches(filter, record, text)
      : undefined;

    let edges: { first: HistoryRecord; last: HistoryRecord; after?: HistoryRegisters };
    let spans: HistoryServiceSpan[] = [];
    try {
      edges = await rangeEdges(context, info, from, to);
      if (options.interrupts !== "keep") spans = (await context.emuApi.getHistoryServiceSpans()) ?? [];
    } catch (err) {
      return commandError(messageOf(err));
    }

    const state = context.store.getState();
    const machineId = state.emulatorState?.machineId;
    const machine = machineRegistry.find((m) => m.machineId === machineId);
    const model = machine?.models?.find((m) => m.modelId === state.emulatorState?.modelId);
    const position = state.emulatorState?.historyPosition;
    const meta: TraceMeta = {
      machineId: info.machineId,
      newestSequence: info.newestSequence,
      afterLast: edges.after,
      appVersion: await context.mainApi.getAppVersion().catch(() => undefined),
      machineName: model?.displayName ?? machine?.displayName,
      range: { first: from, last: to, firstFrame: edges.first.frame, lastFrame: edges.last.frame },
      tactUnit: historyContextDecoder(info.machineId)?.frameTactUnit,
      mainFile: state.compilation?.filename?.split(/[\\/]/).pop(),
      cursorStep: position ? -position : undefined,
      filter: include ? filterText : undefined
    };

    const total = to - from + 1;
    const output = context.output;
    async function* pages(): AsyncGenerator<HistoryRecord[]> {
      let read = 0;
      for (let start = from; start <= to; start += EXPORT_PAGE) {
        const count = Math.min(EXPORT_PAGE, to - start + 1);
        const page = await context.emuApi.getHistoryRecords(start, count);
        // --- A trace with a hole in it would compare as a divergence that never happened (D11)
        if (!page || page.gone || page.firstSequence !== start) {
          throw new Error("Records were overwritten while reading; nothing was written");
        }
        const records = decodeHistoryPage(page);
        if (records.length !== count) throw new Error("Could not read the whole range; nothing was written");
        yield records;
        const before = read;
        read += records.length;
        if (total > EXPORT_PROGRESS && Math.floor(read / EXPORT_PROGRESS) > Math.floor(before / EXPORT_PROGRESS) && read < total) {
          writeMessage(output, `Exporting... ${read.toLocaleString("en-US")} of ${total.toLocaleString("en-US")} records`, "cyan");
        }
      }
    }

    let text: string;
    let lineCount: number;
    try {
      const resolvers = await commandTraceResolvers(context, info, include);
      ({ text, lines: lineCount } = await collectTrace(exportTrace(pages(), meta, spans, options, resolvers), options));
    } catch (err) {
      return commandError(`Could not export the history: ${messageOf(err)}`);
    }

    try {
      await context.mainApi.saveTextFile(file, text);
    } catch (err) {
      return commandError(`Could not write ${file}: ${messageOf(err)}`);
    }

    for (const warning of range.warnings) writeMessage(output, `Warning: ${warning}`, "yellow");
    // --- A CSV file has the column row only; its metadata goes here (Q6)
    if (format === "csv") for (const line of traceHeaderLines(meta, options)) writeMessage(output, line, "cyan");
    const headerLines = format === "csv" ? 1 : options.header ? traceHeaderLines(meta, options).length : 0;
    const rows = lineCount - headerLines;
    const frames = options.absolute
      ? `${edges.first.frame}–${edges.last.frame}`
      : `0–${edges.last.frame - edges.first.frame}`;
    const rowText = rows !== total ? `, ${rows.toLocaleString("en-US")} line${rows === 1 ? "" : "s"}` : "";
    writeSuccessMessage(
      output,
      `Exported ${total.toLocaleString("en-US")} record${total === 1 ? "" : "s"} (frames ${frames}${rowText}) to ${file}`
    );
    return commandSuccess;
  }
}

/** The range's first and last records, and the state after the last: the next record's, or the live CPU (T4) */
async function rangeEdges(
  context: IdeCommandContext,
  info: ExecutionHistoryInfo,
  from: number,
  to: number
): Promise<{ first: HistoryRecord; last: HistoryRecord; after?: HistoryRegisters }> {
  const read = async (sequence: number, count: number) => {
    const page = await context.emuApi.getHistoryRecords(sequence, count);
    if (!page || page.gone) throw new Error("Could not read the execution history");
    return decodeHistoryPage(page);
  };
  const [first] = await read(from, 1);
  const tail = await read(to, to < info.newestSequence ? 2 : 1);
  const last = tail[0];
  if (!first || !last) throw new Error("Could not read the execution history");
  const after =
    tail[1]?.regs ??
    (to === info.newestSequence
      ? historyRegistersOf((await context.emuApi.getCpuState({ present: true })) as Z80CpuState)
      : undefined);
  return { first, last, after };
}

/** Does the file exist? (Reading it is the only probe the main process offers) */
async function fileExists(context: IdeCommandContext, path: string): Promise<boolean> {
  try {
    await context.mainApi.readBinaryFile(path);
    return true;
  } catch {
    return false;
  }
}

/** An error's message; one that crossed the process boundary arrives as "Error: ..." text */
function messageOf(err: unknown): string {
  const text = err instanceof Error ? err.message : String(err);
  return text.replace(/^(Error: )+/, "");
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
  // --- Reverse Continue searches with progress and can be canceled (REVERSE_DEBUGGING_PLAN D15)
  const result =
    op === "reverseContinue"
      ? await context.emuApi.reverseContinue()
      : await context.emuApi.navigateHistory(op, { foldServices: readFoldPreference(machineId) });
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

/** `reverse-continue-cancel`: stops a running Reverse Continue search */
export class ReverseContinueCancelCommand extends IdeCommandBase {
  readonly id = "reverse-continue-cancel";
  readonly description = "Stops a running Reverse Continue search; the machine goes back where it started";
  readonly usage = "reverse-continue-cancel";
  readonly aliases = ["rcancel"];

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    if (!(await context.emuApi.cancelReverseContinue())) return commandError("No Reverse Continue search is running");
    writeInfoMessage(context.output, "Reverse continue: canceling");
    return commandSuccess;
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
export class HistoryTakeOverCommand extends IdeCommandBase<{ "-y"?: boolean }> {
  readonly id = "history-take-over";
  // --- Asks for a confirmation: never through automation (`.plans/COMMAND_LINE_AUTOMATION_PLAN.md` T5)
  readonly automation = "deny" as const;
  readonly description = "Takes over at the current point in the past: discards the recorded future (-y: without asking)";
  readonly usage = "history-take-over [-y]";
  readonly aliases = ["htake"];
  readonly argumentInfo: CommandArgumentInfo = { commandOptions: ["-y"] };

  async execute(context: IdeCommandContext, args: { "-y"?: boolean }): Promise<IdeCommandResult> {
    const refused = requireHistory(context);
    if (refused) return refused;
    if (!isInThePast(context.store)) {
      return commandError("Take over here works in the past of a reverse-debugging session (step back first)");
    }
    // --- A fork cannot be undone: ask, naming what the discarded future takes with it (D12, T4)
    if (!args?.["-y"]) {
      const text = forkConfirmation(await context.emuApi.getForkPreview());
      if (!(await context.mainApi.confirmAction(text.title, text.message, text.detail, text.confirmLabel))) {
        writeInfoMessage(context.output, "Take over here: canceled");
        return commandSuccess;
      }
    }
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
