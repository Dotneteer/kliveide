import { annotationRoutineLabelsForState } from "@renderer/appIde/annotations/useAddressSymbols";
import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import type { IdeCommandResult } from "@renderer/abstractions/IdeCommandResult";
import type { CommandArgumentInfo } from "@renderer/abstractions/IdeCommandInfo";
import type { ValidationMessage } from "@renderer/abstractions/ValidationMessage";

import type { DebuggableOutput, KliveCompilerOutput } from "@abstractions/CompilerInfo";
import { MF_PROFILE } from "@common/machines/constants";
import { machineRegistry } from "@common/machines/machine-registry";
import { ADVANCED_DEBUGGING_SETTING, isAdvancedDebuggingEnabled } from "@common/features/advancedDebugging";
import {
  profileFormatOfName,
  toAddressCsv,
  toCallgrind,
  toFlatCsv,
  toFuse,
  toSpeedscope,
  type ProfileExportFormat
} from "@common/profile/profileExport";
import { compilationLabels } from "@common/profile/routineMap";
import { PROFILER_PANEL_ID } from "@common/state/common-ids";
import type { ProfileStatus } from "@common/profile/profileTypes";
import { createSpecialDocument } from "@renderer/features/documents/specialDocuments";
import {
  buildProfilerModel,
  cpuAddressResolver,
  formatPct,
  formatTime,
  readProfileSnapshot,
  topTableLines,
  type ProfilerModel,
  type TopSort
} from "@renderer/features/profiler/profilerModel";
import {
  IdeCommandBase,
  commandError,
  commandSuccess,
  toHexa4,
  validationError,
  writeMessage,
  writeSuccessMessage
} from "@renderer/appIde/services/ide-commands";
import { t, uiLocale } from "@common/i18n/i18n";

/*
 * The profiler's commands (`.plans/PROFILER_PLAN.md` D16): `profile start|stop|reset|status|top|
 * export`, the `profile-start`/`profile-stop` shortcuts (`pst`, `psp`) and `show-profiler`. They gate
 * on the `MF_PROFILE` capability (D17) and on the advanced-debugging switch, as `coverage` does.
 */

/** What a profile command says with the advanced-debugging switch off */
export function profilerOffMessage(): string {
  return t("commands.profile.off", { setting: ADVANCED_DEBUGGING_SETTING });
}

const noProfile = () => t("commands.profile.notKept");

/** Refuses a command on a machine whose core does not profile */
function requireProfile(context: IdeCommandContext): IdeCommandResult | undefined {
  if (!isAdvancedDebuggingEnabled(context.store.getState())) return commandError(profilerOffMessage());
  const machineId = context.service.machineService.getMachineInfo()?.machine?.machineId;
  const supported = !!machineRegistry.find((m) => m.machineId === machineId)?.features?.[MF_PROFILE];
  return supported ? undefined : commandError(noProfile());
}

function currentCompilation(context: IdeCommandContext): KliveCompilerOutput | undefined {
  return context.store.getState().compilation?.result as KliveCompilerOutput | undefined;
}

/**
 * A `-at`/`-until` value (D2): a number (`$8000`, `#8000`, `0x8000`, `8000h`, `%1000...`, decimal)
 * or a label of the current build, a Klive BASIC SUB/FUNCTION included
 */
export function resolveProfileAddress(text: string, compilation: KliveCompilerOutput | undefined): number | undefined {
  const trimmed = text.trim();
  const number = parseAddressLiteral(trimmed);
  if (number !== undefined) return number;
  const name = trimmed.toLowerCase();
  const labels = compilationLabels(compilation as Partial<DebuggableOutput> & { symbols?: Record<string, unknown> }, undefined);
  const label = labels.find((l) => l.name.toLowerCase() === name);
  if (label) return label.address;
  const callable = (compilation as Partial<DebuggableOutput> | undefined)?.sourceLevelDebug?.callables.find(
    (c) => c.name.toLowerCase() === name
  );
  if (callable) return callable.entryAddress;
  // --- A symbol of any kind the build defined (an EQU naming an entry point, say)
  const symbols = (compilation as { symbols?: Record<string, { value?: { _value?: unknown } }> } | undefined)?.symbols;
  const value = symbols?.[name]?.value?._value;
  return typeof value === "number" && value >= 0 && value <= 0xffff ? value : undefined;
}

function parseAddressLiteral(t: string): number | undefined {
  let m: RegExpMatchArray | null;
  let value: number | undefined;
  if ((m = t.match(/^[$#]([0-9a-f]{1,4})$/i)) || (m = t.match(/^0x([0-9a-f]{1,4})$/i)) || (m = t.match(/^([0-9][0-9a-f]{0,4})h$/i))) {
    value = parseInt(m[1], 16);
  } else if ((m = t.match(/^%([01]{1,16})$/))) {
    value = parseInt(m[1], 2);
  } else if (/^[0-9]{1,5}$/.test(t)) {
    value = parseInt(t, 10);
  }
  return value !== undefined && value <= 0xffff ? value : undefined;
}

type StartArgs = { "-calls"?: boolean; "-at"?: string; "-until"?: string };

/** Starts a window (D1, D2): `-calls` adds the call graph, `-at`/`-until` arm its markers */
async function startProfiling(context: IdeCommandContext, args: StartArgs): Promise<IdeCommandResult> {
  const refused = requireProfile(context);
  if (refused) return refused;
  const compilation = currentCompilation(context);
  const at = args["-at"] !== undefined ? resolveProfileAddress(args["-at"], compilation) : undefined;
  const until = args["-until"] !== undefined ? resolveProfileAddress(args["-until"], compilation) : undefined;
  if (args["-at"] !== undefined && at === undefined) {
    return commandError(t("commands.profile.unknownAt", { value: args["-at"] }));
  }
  if (args["-until"] !== undefined && until === undefined) {
    return commandError(t("commands.profile.unknownUntil", { value: args["-until"] }));
  }
  const status = await context.emuApi.startProfiling({ calls: !!args["-calls"], at, until });
  if (!status) return commandError(noProfile());
  writeSuccessMessage(
    context.output,
    t("commands.profile.started", {
      calls: args["-calls"] ? "yes" : "no",
      at: at !== undefined ? `$${toHexa4(at)}` : "none",
      until: until !== undefined ? `$${toHexa4(until)}` : "none",
      after: at !== undefined ? "yes" : "no"
    })
  );
  return commandSuccess;
}

async function stopProfiling(context: IdeCommandContext): Promise<IdeCommandResult> {
  const refused = requireProfile(context);
  if (refused) return refused;
  const status = await context.emuApi.stopProfiling();
  if (!status) return commandError(noProfile());
  writeSuccessMessage(context.output, t("commands.profile.stopped", { time: formatTime(status.timeTotal, status) }));
  return commandSuccess;
}

const START_ARGS: CommandArgumentInfo = {
  namedOptions: [
    { name: "-at", type: "string" },
    { name: "-until", type: "string" }
  ],
  commandOptions: ["-calls"]
};

const SUBCOMMANDS = ["start", "stop", "reset", "status", "top", "export"] as const;
type ProfileSubcommand = (typeof SUBCOMMANDS)[number];

type ProfileArgs = StartArgs & {
  action: string;
  arg?: string;
  "-by"?: string;
  "-format"?: string;
  "-addresses"?: boolean;
  "-waiting"?: boolean;
  "-f"?: boolean;
};

/**
 * `profile start [-calls] [-at <addr>] [-until <addr>]`, `profile stop|reset|status`,
 * `profile top [n] [-by self|inclusive|calls]`, `profile export <file> [-format ...]`
 */
export class ProfileCommand extends IdeCommandBase<ProfileArgs> {
  readonly id = "profile";
  get description() {
    return t("commands.profile.description");
  }
  readonly usage = [
    "profile start [-calls] [-at <address|label>] [-until <address|label>]",
    "profile stop | reset | status",
    "profile top [n] [-by self|inclusive|calls] [-waiting]",
    "profile export <file> [-format fuse|csv|callgrind|speedscope] [-addresses] [-f]"
  ];
  readonly aliases = ["prof"];
  readonly argumentInfo: CommandArgumentInfo = {
    mandatory: [{ name: "action", type: "string" }],
    optional: [{ name: "arg", type: "string" }],
    namedOptions: [
      { name: "-at", type: "string" },
      { name: "-until", type: "string" },
      { name: "-by", type: "string" },
      { name: "-format", type: "string" }
    ],
    commandOptions: ["-calls", "-addresses", "-waiting", "-f"]
  };

  async validateCommandArgs(_context: IdeCommandContext, args: ProfileArgs): Promise<ValidationMessage[]> {
    const action = args.action?.toLowerCase() as ProfileSubcommand;
    if (!SUBCOMMANDS.includes(action)) {
      return [validationError(t("commands.profile.useOneOf", { choices: SUBCOMMANDS.join(", ") }))];
    }
    const messages: ValidationMessage[] = [];
    if (action === "top") {
      if (args.arg !== undefined && !/^[1-9][0-9]*$/.test(args.arg)) messages.push(validationError(t("commands.profile.topCount")));
      const by = args["-by"]?.toLowerCase();
      if (by !== undefined && by !== "self" && by !== "inclusive" && by !== "calls") {
        messages.push(validationError(t("commands.profile.byInvalid")));
      }
    }
    if (action === "export") {
      if (!args.arg?.trim()) {
        messages.push(validationError(t("commands.profile.exportNeedsFile")));
      } else {
        const format = args["-format"]?.toLowerCase();
        if (format !== undefined && !["fuse", "csv", "callgrind", "speedscope"].includes(format)) {
          messages.push(validationError(t("commands.profile.formatInvalid")));
        } else if (format === undefined && !profileFormatOfName(args.arg)) {
          messages.push(validationError(t("commands.profile.formatUnknown")));
        }
      }
    }
    if (action !== "start" && (args["-at"] !== undefined || args["-until"] !== undefined || args["-calls"])) {
      messages.push(validationError(t("commands.profile.startOnly")));
    }
    return messages;
  }

  async execute(context: IdeCommandContext, args: ProfileArgs): Promise<IdeCommandResult> {
    const refused = requireProfile(context);
    if (refused) return refused;
    switch (args.action.toLowerCase() as ProfileSubcommand) {
      case "start":
        return startProfiling(context, args);
      case "stop":
        return stopProfiling(context);
      case "reset":
        await context.emuApi.resetProfile();
        writeSuccessMessage(context.output, t("commands.profile.cleared"));
        return commandSuccess;
      case "status":
        return this.status(context);
      case "top":
        return this.top(context, args);
      case "export":
        return this.export(context, args);
    }
  }

  private async status(context: IdeCommandContext): Promise<IdeCommandResult> {
    const status = await context.emuApi.getProfileStatus();
    if (!status) return commandError(noProfile());
    for (const line of profileStatusLines(status)) writeMessage(context.output, line, "cyan");
    return commandSuccess;
  }

  private async model(context: IdeCommandContext, hideWaiting = true): Promise<ProfilerModel | string> {
    const snapshot = await readProfileSnapshot(context.emuApi);
    if (!snapshot) return noProfile();
    const model = buildProfilerModel(snapshot, currentCompilation(context), {
      hideWaiting,
      annotationLabels: annotationRoutineLabelsForState(context.store.getState())
    });
    return model ?? t("commands.profile.layoutUnknown");
  }

  private async top(context: IdeCommandContext, args: ProfileArgs): Promise<IdeCommandResult> {
    const model = await this.model(context, !args["-waiting"]);
    if (typeof model === "string") return commandError(model);
    if (!model.flat.rows.length) {
      writeMessage(context.output, t("commands.profile.empty"), "cyan");
      return commandSuccess;
    }
    const by = (args["-by"]?.toLowerCase() as TopSort | undefined) ?? "self";
    if (by === "inclusive" && !model.graph) {
      return commandError(t("commands.profile.inclusiveNeedsCalls"));
    }
    for (const line of topTableLines(model, args.arg ? parseInt(args.arg, 10) : 10, by)) writeMessage(context.output, line);
    return commandSuccess;
  }

  private async export(context: IdeCommandContext, args: ProfileArgs): Promise<IdeCommandResult> {
    const file = args.arg!.trim();
    const format = ((args["-format"]?.toLowerCase() as ProfileExportFormat | undefined) ?? profileFormatOfName(file))!;
    if (!args["-f"] && (await fileExists(context, file))) {
      return commandError(t("commands.profile.fileExists", { file }));
    }
    const model = await this.model(context, !args["-waiting"]);
    if (typeof model === "string") return commandError(model);
    const { status } = model.snapshot;
    const text = profileExportText(model, format, { addresses: !!args["-addresses"], name: programName(context) });
    if (text === undefined) {
      return commandError(t("commands.profile.formatNeedsCalls", { format }));
    }
    try {
      await context.mainApi.saveTextFile(file, text);
    } catch (err) {
      return commandError(
        t("commands.profile.writeFailed", {
          file,
          error: err instanceof Error ? err.message.replace(/^Error: /, "") : String(err)
        })
      );
    }
    writeSuccessMessage(
      context.output,
      t("commands.profile.exported", { format, time: formatTime(status.timeTotal, status), file })
    );
    return commandSuccess;
  }
}

/** The text of an export (D13); undefined for speedscope without a call graph */
export function profileExportText(
  model: ProfilerModel,
  format: ProfileExportFormat,
  options: { addresses?: boolean; name?: string } = {}
): string | undefined {
  const { status } = model.snapshot;
  const meta = { name: options.name ?? status.machineId, timeUnit: status.timeUnit, total: status.timeTotal };
  const tableContext = { timeUnit: status.timeUnit, partitionLabel: model.partitionLabel };
  switch (format) {
    case "fuse":
      return toFuse(model.snapshot.bytes, model.layout, cpuAddressResolver(model.layout, model.snapshot.slotOffsets));
    case "csv":
      return options.addresses ? toAddressCsv(model.addresses, tableContext) : toFlatCsv(model.flat, tableContext);
    case "callgrind":
      return toCallgrind(model.graph, model.flat, meta);
    case "speedscope":
      return model.graph ? JSON.stringify(toSpeedscope(model.graph, meta)) : undefined;
  }
}

/** The project's build root, which names the exported profile */
function programName(context: IdeCommandContext): string | undefined {
  const root = context.store.getState().project?.buildRoots?.[0];
  return root ? root.replace(/\\/g, "/").split("/").pop() : undefined;
}

/** `profile status`'s lines (pure, so it is tested without an IDE) */
export function profileStatusLines(status: ProfileStatus): string[] {
  const lines: string[] = [];
  lines.push(
    t("commands.profile.status.state", {
      enabled: status.enabled ? "yes" : "no",
      start: status.enabled && status.armedStart >= 0 ? `$${toHexa4(status.armedStart)}` : "none",
      stop: status.enabled && status.armedStop >= 0 ? `$${toHexa4(status.armedStop)}` : "none",
      calls: status.callsOn ? "yes" : "no",
      muted: status.muted ? "yes" : "no"
    })
  );
  lines.push(
    t("commands.profile.status.measured", {
      time: formatTime(status.timeTotal, status),
      count: status.instructions
    })
  );
  if (status.frameTicks && status.timeTotal) {
    lines.push(
      t("commands.profile.status.frames", {
        frames: (status.timeTotal / status.frameTicks).toLocaleString(uiLocale(), {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }),
        ticks: status.frameTicks,
        unit: status.timeUnit
      })
    );
  }
  if (status.timeTotal && status.timeHalt) {
    lines.push(t("commands.profile.status.halt", { percent: formatPct((100 * status.timeHalt) / status.timeTotal) }));
  }
  if (status.calls || status.interrupts || status.callsOn) {
    const graph = { calls: status.calls, interrupts: status.interrupts, pairs: status.edgesUsed, open: status.depth };
    lines.push(
      status.depth ? t("commands.profile.status.graphOpen", graph) : t("commands.profile.status.graph", graph)
    );
    if (status.stackResyncs) {
      lines.push(`  ${t("commands.profile.status.resyncs", { count: status.stackResyncs })}`);
    }
    if (status.depthOverflows) {
      lines.push(`  ${t("commands.profile.status.overflows", { count: status.depthOverflows })}`);
    }
    if (status.edgesDropped) {
      lines.push(`  ${t("commands.profile.status.edgesDropped", { count: status.edgesDropped })}`);
    }
  }
  return lines;
}

/** `profile-start` (`pst`): `profile start`, the one profile command worth a short alias */
export class ProfileStartCommand extends IdeCommandBase<StartArgs> {
  readonly id = "profile-start";
  get description() {
    return t("commands.profile.start.description");
  }
  readonly usage = "profile-start [-calls] [-at <address|label>] [-until <address|label>]";
  readonly aliases = ["pst"];
  readonly argumentInfo = START_ARGS;

  async execute(context: IdeCommandContext, args: StartArgs): Promise<IdeCommandResult> {
    return startProfiling(context, args);
  }
}

/** `profile-stop` (`psp`): stops profiling; the data stays */
export class ProfileStopCommand extends IdeCommandBase {
  readonly id = "profile-stop";
  get description() {
    return t("commands.profile.stop.description");
  }
  readonly usage = "profile-stop";
  readonly aliases = ["psp"];

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    return stopProfiling(context);
  }
}

/** `show-profiler`: opens the Profiler document (D14) */
export class ShowProfilerCommand extends IdeCommandBase {
  readonly id = "show-profiler";
  get description() {
    return t("commands.profile.show.description");
  }
  readonly usage = "show-profiler";
  readonly aliases = ["shprof"];

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    const refused = requireProfile(context);
    if (refused) return refused;
    const documentHubService = context.service.projectService.getActiveDocumentHubService();
    if (documentHubService.isOpen(PROFILER_PANEL_ID)) {
      await documentHubService.setActiveDocument(PROFILER_PANEL_ID);
    } else {
      await documentHubService.openDocument(createSpecialDocument(PROFILER_PANEL_ID), undefined, false);
    }
    return commandSuccess;
  }
}

/** `hide-profiler`: closes the Profiler document */
export class HideProfilerCommand extends IdeCommandBase {
  readonly id = "hide-profiler";
  get description() {
    return t("commands.profile.hide.description");
  }
  readonly usage = "hide-profiler";
  readonly aliases = ["hprof"];

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    await context.service.projectService.getActiveDocumentHubService().closeDocument(PROFILER_PANEL_ID);
    return commandSuccess;
  }
}

async function fileExists(context: IdeCommandContext, path: string): Promise<boolean> {
  try {
    await context.mainApi.readBinaryFile(path);
    return true;
  } catch {
    return false;
  }
}
