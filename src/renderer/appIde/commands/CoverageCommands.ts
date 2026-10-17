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
import { t, uiLocale } from "@common/i18n/i18n";
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
export function coverageOffMessage(): string {
  return t("commands.coverage.off", { setting: ADVANCED_DEBUGGING_SETTING });
}

/** A percentage with one decimal, in the display language's number format (a human figure) */
function percent1(value: number): string {
  return value.toLocaleString(uiLocale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

const notKept = () => t("commands.coverage.notKept");
const layoutUnknown = () => t("commands.coverage.layoutUnknown");

/** Refuses a command on a machine whose core does not profile */
function requireProfile(context: IdeCommandContext): IdeCommandResult | undefined {
  if (!isAdvancedDebuggingEnabled(context.store.getState())) return commandError(coverageOffMessage());
  const machineId = context.service.machineService.getMachineInfo()?.machine?.machineId;
  const supported = !!machineRegistry.find((m) => m.machineId === machineId)?.features?.[MF_PROFILE];
  return supported ? undefined : commandError(notKept());
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
  get description() {
    return t("commands.coverage.description");
  }
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
      messages.push(validationError(t("commands.coverage.useOneOf", { choices: SUBCOMMANDS.join(", ") })));
      return messages;
    }
    if ((action === "export" || action === "load") && !args.file?.trim()) {
      messages.push(validationError(t("commands.coverage.needsFile", { action })));
    }
    if (action === "export" && args.file) {
      const format = args["-format"]?.toLowerCase();
      if (format !== undefined && format !== "lcov" && format !== "csv" && format !== "kcov") {
        messages.push(validationError(t("commands.coverage.formatInvalid")));
      } else if (format === undefined && !coverageFormatOfName(args.file)) {
        messages.push(validationError(t("commands.coverage.formatUnknown")));
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
        if (!status) return commandError(notKept());
        writeSuccessMessage(
          context.output,
          status.counters ? t("commands.coverage.on") : t("commands.coverage.onFlagsOnly")
        );
        return commandSuccess;
      }
      case "off":
        await context.emuApi.setProfiling(false);
        writeSuccessMessage(context.output, t("commands.coverage.offDone"));
        return commandSuccess;
      case "reset":
        await context.emuApi.resetProfile();
        writeSuccessMessage(context.output, t("commands.coverage.cleared"));
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
    if (!status) return commandError(notKept());
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
        const totals = coverageTotals(all);
        const args = {
          covered: totals.covered,
          lines: totals.lines,
          partial: totals.partial,
          percent: percent1(totals.lines ? (100 * totals.covered) / totals.lines : 0)
        };
        writeMessage(
          context.output,
          totals.partial ? t("commands.coverage.sourcePartial", args) : t("commands.coverage.source", args),
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
      return commandError(t("commands.coverage.fileExists", { file }));
    }
    const status = await context.emuApi.getProfileStatus();
    if (!status) return commandError(notKept());
    const layout = profileLayoutOf(status.machineId);
    if (!layout) return commandError(layoutUnknown());

    let text: string;
    let summary: string;
    if (format === "lcov") {
      const compilation = currentCompilation(context);
      const model = buildCoverageModel(compilation, status.machineId);
      if (!model.points.length) return commandError(t("commands.coverage.lcovNeedsSource"));
      const sample = await context.emuApi.getProfileSample(
        model.points.map((p) => p.address),
        model.points.map((p) => p.partition),
        true
      );
      if (!sample) return commandError(t("commands.coverage.readFailed"));
      const files = lcovFilesOf(lineCoverage(model, sample.flags, sample.exec), context.store.getState().project?.folderPath);
      text = toLcov(files);
      const lines = files.reduce((n, f) => n + f.lines.length, 0);
      const hit = files.reduce((n, f) => n + f.lines.filter((l) => l.hits > 0).length, 0);
      summary = t("commands.coverage.exportedLcov", { hit, lines, files: files.length, file });
    } else {
      const touched = await context.emuApi.getProfileTouched();
      if (!touched) return commandError(t("commands.coverage.readFailed"));
      if (format === "csv") {
        const labels = await context.emuApi.getPartitionLabels().catch(() => ({}));
        text = toCoverageCsv(touched.bytes, layout, labels, !!args["-norom"]);
      } else {
        text = toKcov(status.machineId, layout, status, touched.bytes);
      }
      summary = t("commands.coverage.exportedBytes", {
        format: format.toUpperCase(),
        bytes: touched.bytes.length,
        file
      });
    }
    try {
      await context.mainApi.saveTextFile(file, text);
    } catch (err) {
      return commandError(t("commands.coverage.writeFailed", { file, error: messageOf(err) }));
    }
    writeSuccessMessage(context.output, summary);
    return commandSuccess;
  }

  private async load(context: IdeCommandContext, file: string): Promise<IdeCommandResult> {
    const status = await context.emuApi.getProfileStatus();
    if (!status) return commandError(notKept());
    const layout = profileLayoutOf(status.machineId);
    if (!layout) return commandError(layoutUnknown());
    let text: string;
    try {
      text = await context.mainApi.readTextFile(file);
    } catch (err) {
      return commandError(t("commands.coverage.readFileFailed", { file, error: messageOf(err) }));
    }
    const run = parseKcov(text, layout);
    if (typeof run === "string") return commandError(run);
    const merged = await context.emuApi.mergeProfile(run.bytes, { instructions: run.instructions, timeTotal: run.timeTotal });
    if (!merged) return commandError(t("commands.coverage.mergeFailed"));
    writeSuccessMessage(context.output, t("commands.coverage.merged", { bytes: run.bytes.length, file }));
    return commandSuccess;
  }

  private async smc(context: IdeCommandContext): Promise<IdeCommandResult> {
    const touched = await context.emuApi.getProfileTouched(PF_SELF_MODIFIED);
    if (!touched) return commandError(notKept());
    const layout = profileLayoutOf(touched.info.machineId);
    if (!layout) return commandError(layoutUnknown());
    const labels = await context.emuApi.getPartitionLabels().catch(() => ({}) as Record<number, string>);
    const labelAt = nearestLabelLookup(currentCompilation(context), layout.partitionSize);
    const runs = findSmcRuns(touched.bytes, layout, labelAt);
    if (!runs.length) {
      writeInfoMessage(
        context.output,
        touched.info.enabled || touched.info.instructions
          ? t("commands.coverage.smcNone")
          : t("commands.coverage.smcNoneNotRecorded")
      );
      return commandSuccess;
    }
    writeMessage(context.output, t("commands.coverage.smcRuns", { count: runs.length }), "cyan");
    for (const run of runs) {
      const where = run.partition !== undefined ? `${labels[run.partition] ?? run.partition}:` : "";
      const length = run.to - run.from + 1;
      const label = run.label ? ` ${run.label}${run.labelOffset ? `+${run.labelOffset}` : ""}` : "";
      const location = `${where}$${toHexa4(run.address)}`;
      const line =
        run.writes !== undefined
          ? t("commands.coverage.smcRunCounted", {
              location,
              length,
              label,
              writes: run.writes,
              executions: run.executions ?? 0
            })
          : t("commands.coverage.smcRun", { location, length, label });
      writeMessage(context.output, `  ${line}`);
    }
    return commandSuccess;
  }
}

/** `coverage-reset` (`covr`): clears the coverage - the one coverage command worth a short alias */
export class CoverageResetCommand extends IdeCommandBase {
  readonly id = "coverage-reset";
  get description() {
    return t("commands.coverage.reset.description");
  }
  readonly usage = "coverage-reset";
  readonly aliases = ["covr"];

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    const refused = requireProfile(context);
    if (refused) return refused;
    await context.emuApi.resetProfile();
    writeSuccessMessage(context.output, t("commands.coverage.cleared"));
    return commandSuccess;
  }
}

/** `memory-heat <off|exec|read|write|all>`: the memory view's Heat selector, for scripts (D15) */
export class MemoryHeatCommand extends IdeCommandBase<{ mode: string }> {
  readonly id = "memory-heat";
  get description() {
    return t("commands.coverage.heat.description");
  }
  readonly usage = "memory-heat <off|exec|read|write|all>";
  readonly argumentInfo: CommandArgumentInfo = { mandatory: [{ name: "mode", type: "string" }] };

  async validateCommandArgs(_context: IdeCommandContext, args: { mode: string }): Promise<ValidationMessage[]> {
    return HEAT_MODES.includes(args.mode?.toLowerCase() as HeatMode)
      ? []
      : [validationError(t("commands.coverage.useOneOf", { choices: HEAT_MODES.join(", ") }))];
  }

  async execute(context: IdeCommandContext, args: { mode: string }): Promise<IdeCommandResult> {
    const mode = args.mode.toLowerCase() as HeatMode;
    if (mode !== "off") {
      const refused = requireProfile(context);
      if (refused) return refused;
    }
    context.store.dispatch(setMemoryHeatModeAction(mode));
    writeSuccessMessage(context.output, t("commands.coverage.heat.set", { mode }));
    return commandSuccess;
  }
}

/** `coverage status`'s lines about the profile itself (pure, so it is tested without an IDE) */
export function coverageStatusLines(status: ProfileStatus): string[] {
  const lines: string[] = [];
  lines.push(
    t("commands.coverage.status.state", {
      state: !status.enabled ? "off" : status.counters ? "on" : "flags",
      muted: status.muted ? "yes" : "no"
    })
  );
  lines.push(t("commands.coverage.status.instructions", { count: status.instructions }));
  if (status.counters || status.pagesUsed) {
    lines.push(t("commands.coverage.status.pool", { used: status.pagesUsed, total: status.poolPages }));
  }
  if (status.pagesDropped) {
    lines.push(
      t("commands.coverage.status.dropped", { count: status.pagesDropped, first: status.firstDroppedPage })
    );
  }
  if (status.timeTotal) {
    const pct = (v: number) => `${percent1((100 * v) / status.timeTotal)}%`;
    // --- HALT, INT ack, NMI ack and DMA are hardware names: they stay as they are (D9)
    const parts = [t("commands.coverage.status.timeTotal", { total: status.timeTotal, unit: status.timeUnit })];
    if (status.timeHalt) parts.push(`HALT ${pct(status.timeHalt)}`);
    if (status.timeIntAck) parts.push(`INT ack ${pct(status.timeIntAck)}`);
    if (status.timeNmiAck) parts.push(`NMI ack ${pct(status.timeNmiAck)}`);
    if (status.timeDma) parts.push(`DMA ${pct(status.timeDma)}`);
    if (status.timeSnooze) parts.push(t("commands.coverage.status.timeSnooze", { percent: pct(status.timeSnooze) }));
    lines.push(t("commands.coverage.status.time", { parts: parts.join(", ") }));
  }
  if (status.abandonedInstructions) {
    lines.push(t("commands.coverage.status.abandoned", { count: status.abandonedInstructions }));
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
