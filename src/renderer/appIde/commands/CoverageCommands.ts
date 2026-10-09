import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import type { IdeCommandResult } from "@renderer/abstractions/IdeCommandResult";
import type { CommandArgumentInfo } from "@renderer/abstractions/IdeCommandInfo";
import type { ValidationMessage } from "@renderer/abstractions/ValidationMessage";

import type { KliveCompilerOutput } from "@abstractions/CompilerInfo";
import { MF_PROFILE } from "@common/machines/constants";
import { machineRegistry } from "@common/machines/machine-registry";
import { ADVANCED_DEBUGGING_SETTING, isAdvancedDebuggingEnabled } from "@common/features/advancedDebugging";
import { profileLayoutOf } from "@common/profile/layouts";
import { profileLocationOf } from "@common/profile/layouts/profileLayout";
import type { ProfileStatus } from "@common/profile/profileTypes";
import { PF_SELF_MODIFIED } from "@common/profile/profileTypes";
import { parseKcov, toCoverageCsv, toKcov, toLcov } from "@common/profile/coverageExport";
import { findSmcRuns } from "@common/profile/smcReport";
import { setMemoryHeatModeAction } from "@common/state/actions";
import { buildCoverageModel, coverageTotals, lcovFilesOf, lineCoverage } from "@common/profile/coverageModel";
import { HEAT_MODES, type HeatMode } from "@renderer/features/coverage/heatModel";
import {
  IdeCommandBase,
  commandError,
  commandSuccess,
  toHexa4,
  validationError,
  writeInfoMessage,
  writeMessage,
  writeSuccessMessage
} from "@renderer/appIde/services/ide-commands";

/*
 * Code coverage and the heat map (`.plans/CODE_COVERAGE_AND_HEAT_MAP_PLAN.md` D15, D16): one command
 * family, `coverage on|off|reset|status|export|load|smc`, and `memory-heat <mode>` for scripts. They
 * gate on the `MF_PROFILE` capability, not on a machine id, and on the advanced-debugging switch.
 */

/** What a coverage command says with the advanced-debugging switch off */
export const COVERAGE_OFF_MESSAGE =
  "Code coverage is part of advanced debugging, which is turned off. Turn it on with " +
  `'set -u ${ADVANCED_DEBUGGING_SETTING} 1', then restart Klive.`;

/** Refuses a command on a machine whose core does not profile */
function requireProfile(context: IdeCommandContext): IdeCommandResult | undefined {
  if (!isAdvancedDebuggingEnabled(context.store.getState())) return commandError(COVERAGE_OFF_MESSAGE);
  const machineId = context.service.machineService.getMachineInfo()?.machine?.machineId;
  const supported = !!machineRegistry.find((m) => m.machineId === machineId)?.features?.[MF_PROFILE];
  return supported ? undefined : commandError("This machine does not keep code coverage");
}

/** The compilation the IDE holds now: the source lines come from it */
function currentCompilation(context: IdeCommandContext): KliveCompilerOutput | undefined {
  return context.store.getState().compilation?.result as KliveCompilerOutput | undefined;
}

const SUBCOMMANDS = ["on", "off", "reset", "status", "export", "load", "smc"] as const;
type CoverageSubcommand = (typeof SUBCOMMANDS)[number];

type CoverageArgs = {
  action: string;
  file?: string;
  "-format"?: string;
  "-nocounts"?: boolean;
  "-norom"?: boolean;
  "-f"?: boolean;
};

type ExportFormat = "lcov" | "csv" | "kcov";

/** The export format a file name implies */
export function coverageFormatOfName(file: string): ExportFormat | undefined {
  const lower = file.toLowerCase();
  if (lower.endsWith(".info") || lower.endsWith(".lcov")) return "lcov";
  if (lower.endsWith(".csv")) return "csv";
  if (lower.endsWith(".kcov") || lower.endsWith(".json")) return "kcov";
  return undefined;
}

/**
 * `coverage on|off|reset|status`, `coverage export <file> [-format lcov|csv|kcov]`, `coverage load
 * <file>` and `coverage smc`
 */
export class CoverageCommand extends IdeCommandBase<CoverageArgs> {
  readonly id = "coverage";
  readonly description = "Code coverage and the memory heat map: on, off, reset, status, export, load, smc";
  readonly usage = [
    "coverage on [-nocounts] | off | reset | status",
    "coverage export <file> [-format lcov|csv|kcov] [-norom] [-f]",
    "coverage load <file>",
    "coverage smc"
  ];
  readonly aliases = ["cov"];
  readonly argumentInfo: CommandArgumentInfo = {
    mandatory: [{ name: "action", type: "string" }],
    optional: [{ name: "file", type: "string" }],
    namedOptions: [{ name: "-format", type: "string" }],
    commandOptions: ["-nocounts", "-norom", "-f"]
  };

  async validateCommandArgs(_context: IdeCommandContext, args: CoverageArgs): Promise<ValidationMessage[]> {
    const messages: ValidationMessage[] = [];
    const action = args.action?.toLowerCase() as CoverageSubcommand;
    if (!SUBCOMMANDS.includes(action)) {
      messages.push(validationError(`Use one of: ${SUBCOMMANDS.join(", ")}`));
      return messages;
    }
    if ((action === "export" || action === "load") && !args.file?.trim()) {
      messages.push(validationError(`coverage ${action} needs a file`));
    }
    if (action === "export" && args.file) {
      const format = args["-format"]?.toLowerCase();
      if (format !== undefined && format !== "lcov" && format !== "csv" && format !== "kcov") {
        messages.push(validationError("-format: use lcov, csv or kcov"));
      } else if (format === undefined && !coverageFormatOfName(args.file)) {
        messages.push(validationError("Use a .info/.lcov, .csv or .kcov file, or name the format with -format."));
      }
    }
    return messages;
  }

  async execute(context: IdeCommandContext, args: CoverageArgs): Promise<IdeCommandResult> {
    const refused = requireProfile(context);
    if (refused) return refused;
    switch (args.action.toLowerCase() as CoverageSubcommand) {
      case "on": {
        const status = await context.emuApi.setProfiling(true, args["-nocounts"] ? false : undefined);
        if (!status) return commandError("This machine does not keep code coverage");
        writeSuccessMessage(
          context.output,
          `Code coverage is on${status.counters ? "" : " (flags only, no counts)"}`
        );
        return commandSuccess;
      }
      case "off":
        await context.emuApi.setProfiling(false);
        writeSuccessMessage(context.output, "Code coverage is off; what it recorded stays until a reset");
        return commandSuccess;
      case "reset":
        await context.emuApi.resetProfile();
        writeSuccessMessage(context.output, "Code coverage cleared");
        return commandSuccess;
      case "status":
        return this.status(context);
      case "export":
        return this.export(context, args);
      case "load":
        return this.load(context, args.file!.trim());
      case "smc":
        return this.smc(context);
    }
  }

  private async status(context: IdeCommandContext): Promise<IdeCommandResult> {
    const status = await context.emuApi.getProfileStatus();
    if (!status) return commandError("This machine does not keep code coverage");
    for (const line of coverageStatusLines(status)) writeMessage(context.output, line, "cyan");
    const compilation = currentCompilation(context);
    const model = buildCoverageModel(compilation, status.machineId);
    if (model.points.length) {
      const sample = await context.emuApi.getProfileSample(
        model.points.map((p) => p.address),
        model.points.map((p) => p.partition)
      );
      if (sample) {
        const all = [...lineCoverage(model, sample.flags).values()].flatMap((m) => [...m.values()]);
        const t = coverageTotals(all);
        const pct = t.lines ? ((100 * t.covered) / t.lines).toFixed(1) : "0.0";
        writeMessage(
          context.output,
          `Source: ${t.covered.toLocaleString("en-US")} of ${t.lines.toLocaleString("en-US")} lines covered (${pct}%)` +
            (t.partial ? `, ${t.partial.toLocaleString("en-US")} partly` : ""),
          "cyan"
        );
      }
    }
    return commandSuccess;
  }

  private async export(context: IdeCommandContext, args: CoverageArgs): Promise<IdeCommandResult> {
    const file = args.file!.trim();
    const format = ((args["-format"]?.toLowerCase() as ExportFormat | undefined) ?? coverageFormatOfName(file))!;
    if (!args["-f"] && (await fileExists(context, file))) {
      return commandError(`${file} already exists; use -f to replace it.`);
    }
    const status = await context.emuApi.getProfileStatus();
    if (!status) return commandError("This machine does not keep code coverage");
    const layout = profileLayoutOf(status.machineId);
    if (!layout) return commandError("This machine's coverage layout is unknown");

    let text: string;
    let summary: string;
    if (format === "lcov") {
      const compilation = currentCompilation(context);
      const model = buildCoverageModel(compilation, status.machineId);
      if (!model.points.length) return commandError("LCOV needs source lines: build the program first");
      const sample = await context.emuApi.getProfileSample(
        model.points.map((p) => p.address),
        model.points.map((p) => p.partition),
        true
      );
      if (!sample) return commandError("Could not read the coverage");
      const files = lcovFilesOf(lineCoverage(model, sample.flags, sample.exec), context.store.getState().project?.folderPath);
      text = toLcov(files);
      const lines = files.reduce((n, f) => n + f.lines.length, 0);
      const hit = files.reduce((n, f) => n + f.lines.filter((l) => l.hits > 0).length, 0);
      summary = `${hit.toLocaleString("en-US")} of ${lines.toLocaleString("en-US")} lines hit in ${files.length} file${files.length === 1 ? "" : "s"}`;
    } else {
      const touched = await context.emuApi.getProfileTouched();
      if (!touched) return commandError("Could not read the coverage");
      if (format === "csv") {
        const labels = await context.emuApi.getPartitionLabels().catch(() => ({}));
        text = toCoverageCsv(touched.bytes, layout, labels, !!args["-norom"]);
      } else {
        text = toKcov(status.machineId, layout, status, touched.bytes);
      }
      summary = `${touched.bytes.length.toLocaleString("en-US")} touched byte${touched.bytes.length === 1 ? "" : "s"}`;
    }
    try {
      await context.mainApi.saveTextFile(file, text);
    } catch (err) {
      return commandError(`Could not write ${file}: ${messageOf(err)}`);
    }
    writeSuccessMessage(context.output, `Exported coverage (${format.toUpperCase()}, ${summary}) to ${file}`);
    return commandSuccess;
  }

  private async load(context: IdeCommandContext, file: string): Promise<IdeCommandResult> {
    const status = await context.emuApi.getProfileStatus();
    if (!status) return commandError("This machine does not keep code coverage");
    const layout = profileLayoutOf(status.machineId);
    if (!layout) return commandError("This machine's coverage layout is unknown");
    let text: string;
    try {
      text = await context.mainApi.readTextFile(file);
    } catch (err) {
      return commandError(`Could not read ${file}: ${messageOf(err)}`);
    }
    const run = parseKcov(text, layout);
    if (typeof run === "string") return commandError(run);
    const merged = await context.emuApi.mergeProfile(run.bytes, { instructions: run.instructions, timeTotal: run.timeTotal });
    if (!merged) return commandError("Could not merge the coverage");
    writeSuccessMessage(
      context.output,
      `Merged ${run.bytes.length.toLocaleString("en-US")} touched byte${run.bytes.length === 1 ? "" : "s"} from ${file}`
    );
    return commandSuccess;
  }

  private async smc(context: IdeCommandContext): Promise<IdeCommandResult> {
    const touched = await context.emuApi.getProfileTouched(PF_SELF_MODIFIED);
    if (!touched) return commandError("This machine does not keep code coverage");
    const layout = profileLayoutOf(touched.info.machineId);
    if (!layout) return commandError("This machine's coverage layout is unknown");
    const labels = await context.emuApi.getPartitionLabels().catch(() => ({}) as Record<number, string>);
    const labelAt = nearestLabelLookup(currentCompilation(context), layout.partitionSize);
    const runs = findSmcRuns(touched.bytes, layout, labelAt);
    if (!runs.length) {
      writeInfoMessage(
        context.output,
        touched.info.enabled || touched.info.instructions
          ? "No self-modifying code found"
          : "No self-modifying code found: coverage has not recorded anything (coverage on)"
      );
      return commandSuccess;
    }
    writeMessage(context.output, `${runs.length} self-modified run${runs.length === 1 ? "" : "s"}:`, "cyan");
    for (const run of runs) {
      const where = run.partition !== undefined ? `${labels[run.partition] ?? run.partition}:` : "";
      const length = run.to - run.from + 1;
      const label = run.label ? ` ${run.label}${run.labelOffset ? `+${run.labelOffset}` : ""}` : "";
      const counts =
        run.writes !== undefined ? ` (written ${run.writes.toLocaleString("en-US")}, executed ${(run.executions ?? 0).toLocaleString("en-US")})` : "";
      writeMessage(context.output, `  ${where}$${toHexa4(run.address)}, ${length} byte${length === 1 ? "" : "s"}${label}${counts}`);
    }
    return commandSuccess;
  }
}

/** `coverage-reset` (`covr`): clears the coverage - the one coverage command worth a short alias */
export class CoverageResetCommand extends IdeCommandBase {
  readonly id = "coverage-reset";
  readonly description = "Clears code coverage and the heat map";
  readonly usage = "coverage-reset";
  readonly aliases = ["covr"];

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    const refused = requireProfile(context);
    if (refused) return refused;
    await context.emuApi.resetProfile();
    writeSuccessMessage(context.output, "Code coverage cleared");
    return commandSuccess;
  }
}

/** `memory-heat <off|exec|read|write|all>`: the memory view's Heat selector, for scripts (D15) */
export class MemoryHeatCommand extends IdeCommandBase<{ mode: string }> {
  readonly id = "memory-heat";
  readonly description = "Sets the memory view's heat map: off, exec, read, write or all";
  readonly usage = "memory-heat <off|exec|read|write|all>";
  readonly argumentInfo: CommandArgumentInfo = { mandatory: [{ name: "mode", type: "string" }] };

  async validateCommandArgs(_context: IdeCommandContext, args: { mode: string }): Promise<ValidationMessage[]> {
    return HEAT_MODES.includes(args.mode?.toLowerCase() as HeatMode)
      ? []
      : [validationError(`Use one of: ${HEAT_MODES.join(", ")}`)];
  }

  async execute(context: IdeCommandContext, args: { mode: string }): Promise<IdeCommandResult> {
    const mode = args.mode.toLowerCase() as HeatMode;
    if (mode !== "off") {
      const refused = requireProfile(context);
      if (refused) return refused;
    }
    context.store.dispatch(setMemoryHeatModeAction(mode));
    writeSuccessMessage(context.output, `Memory heat map: ${mode}`);
    return commandSuccess;
  }
}

/** `coverage status`'s lines about the profile itself (pure, so it is tested without an IDE) */
export function coverageStatusLines(status: ProfileStatus): string[] {
  const n = (v: number) => v.toLocaleString("en-US");
  const lines: string[] = [];
  lines.push(
    `Coverage is ${status.enabled ? "on" : "off"}${status.enabled && !status.counters ? " (flags only, no counts)" : ""}` +
      (status.muted ? "; a replay is running, nothing counts" : "")
  );
  lines.push(`${n(status.instructions)} instruction${status.instructions === 1 ? "" : "s"} counted`);
  if (status.counters || status.pagesUsed) {
    lines.push(`Counter pool: ${n(status.pagesUsed)} of ${n(status.poolPages)} 8K pages used`);
  }
  if (status.pagesDropped) {
    lines.push(
      `${n(status.pagesDropped)} page${status.pagesDropped === 1 ? "" : "s"} found the pool full and keep flags only` +
        ` (the first: physical page ${status.firstDroppedPage})`
    );
  }
  if (status.timeTotal) {
    const pct = (v: number) => `${((100 * v) / status.timeTotal).toFixed(1)}%`;
    const parts = [`total ${n(status.timeTotal)} ${status.timeUnit}`];
    if (status.timeHalt) parts.push(`HALT ${pct(status.timeHalt)}`);
    if (status.timeIntAck) parts.push(`INT ack ${pct(status.timeIntAck)}`);
    if (status.timeNmiAck) parts.push(`NMI ack ${pct(status.timeNmiAck)}`);
    if (status.timeDma) parts.push(`DMA ${pct(status.timeDma)}`);
    if (status.timeSnooze) parts.push(`snooze ${pct(status.timeSnooze)}`);
    lines.push(`Time: ${parts.join(", ")}`);
  }
  if (status.abandonedInstructions) {
    lines.push(`Includes ${n(status.abandonedInstructions)} instructions from an abandoned future (Take over here)`);
  }
  return lines;
}

/**
 * The nearest label at or before an address, from the compilation's symbols. A banked byte's
 * offset is tried in every window its partition could be paged at; the closest label wins.
 */
function nearestLabelLookup(
  compilation: KliveCompilerOutput | undefined,
  partitionSize: number
): ((address: number, partition: number | undefined) => { name: string; address: number } | undefined) | undefined {
  const symbols = (compilation as { symbols?: Record<string, unknown> } | undefined)?.symbols;
  if (!symbols) return undefined;
  const labels: { name: string; address: number }[] = [];
  for (const [key, info] of Object.entries(symbols)) {
    const s = info as { name?: string; type?: number; value?: { _value?: unknown } };
    const value = s?.value?._value;
    // --- SymbolType.Label
    if (s?.type !== 1 || typeof value !== "number" || value < 0 || value > 0xffff) continue;
    labels.push({ name: s.name ?? key, address: value });
  }
  if (!labels.length) return undefined;
  labels.sort((a, b) => a.address - b.address);
  const at = (address: number) => {
    let found: { name: string; address: number } | undefined;
    for (const l of labels) {
      if (l.address > address) break;
      found = l;
    }
    return found;
  };
  return (address, partition) => {
    if (partition === undefined) return at(address);
    let best: { name: string; address: number } | undefined;
    for (let base = 0; base < 0x10000; base += partitionSize) {
      const candidate = at(base + (address % partitionSize));
      if (candidate && (!best || base + (address % partitionSize) - candidate.address < base + (address % partitionSize) - best.address)) {
        best = { name: candidate.name, address: candidate.address - base };
      }
    }
    return best;
  };
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

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message.replace(/^Error: /, "") : String(err);
}

/** Where a profile offset lives, as `coverage smc` and the CSV name it */
export function describeProfileOffset(machineId: string, offset: number, labels: Record<number, string>): string {
  const layout = profileLayoutOf(machineId);
  const location = layout ? profileLocationOf(layout, offset) : undefined;
  if (!location) return `#${offset.toString(16)}`;
  return location.partition !== undefined
    ? `${labels[location.partition] ?? location.partition}:$${toHexa4(location.address)}`
    : `$${toHexa4(location.address)}`;
}
