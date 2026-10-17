import type { CommandArgumentInfo } from "@renderer/abstractions/IdeCommandInfo";
import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import type { IdeCommandResult } from "@renderer/abstractions/IdeCommandResult";
import type { ValidationMessage } from "@renderer/abstractions/ValidationMessage";
import type { ProgramAnnotations } from "@renderer/appIde/annotations/programAnnotations";

import {
  annotationMachineWarning,
  bankSpaceFor,
  type AnnotationMachine
} from "@common/annotations/bankSpace";
import {
  ANNOTATION_MACHINES,
  annotationMachineOf,
  createDefaultAnnotations,
  isAnnotationMachine
} from "@renderer/appIde/annotations/programAnnotations";
import {
  formatAnnotations,
  loadAnnotationSidecar
} from "@renderer/appIde/annotations/annotationSidecar";
import {
  peekAnnotationSession,
  seedAnnotationSession
} from "@renderer/appIde/annotations/annotationSession";
import {
  clearActiveAnnotationSet,
  getActiveAnnotationSet,
  setActiveAnnotationSet
} from "@renderer/appIde/annotations/activeAnnotationSet";
import { machineConfigOf } from "@renderer/appIde/annotations/useMachineBankSpace";
import { getRomPartitions } from "@renderer/appIde/annotations/romAnnotations";
import type { RomPartitionInfo } from "@renderer/appIde/annotations/romAnnotationLoader";
import {
  commandError,
  commandSuccess,
  commandSuccessWith,
  IdeCommandBase,
  validationError,
  writeMessage
} from "../services/ide-commands";
import { t } from "@common/i18n/i18n";

/*
 * The `ann-*` commands: which `.dis` file is the active annotation set
 * (`.plans/REVERSE_ENGINEERING_ANNOTATIONS_PLAN.md` §4.3).
 *
 * `nex-run`, `zx-snapshot`, a ZX80/ZX81 `tape-load` and opening a project each make a set active on
 * their own. These are for everything else: a tape-loaded Spectrum game, a program built outside a
 * project, or a second set kept for comparison.
 */

/** How much a set holds, for `ann-info`. */
export type AnnotationCounts = {
  banks: number;
  labels: number;
  comments: number;
  regions: number;
  breakpoints: number;
};

/** Count what a set holds. A region is counted only when it says more than "disassemble". */
export function countAnnotations(annotations: ProgramAnnotations): AnnotationCounts {
  const counts: AnnotationCounts = {
    banks: Object.keys(annotations.banks).length,
    labels: annotations.globalLabels?.length ?? 0,
    comments: 0,
    regions: 0,
    breakpoints:
      (annotations.debug?.breakpoints?.length ?? 0) +
      (annotations.debug?.labelBreakpoints?.length ?? 0)
  };
  for (const bank of Object.values(annotations.banks)) {
    counts.labels += bank.localLabels?.length ?? 0;
    counts.regions += bank.regions.filter((region) => region.type !== "disassemble").length;
    if (bank.comment) counts.comments++;
    for (const line of Object.values(bank.lineAnnotations ?? {})) {
      if (line.synopsis) counts.comments++;
      if (line.comment) counts.comments++;
    }
  }
  return counts;
}

/** The current machine's bank space id, read from the store. */
function currentAnnotationMachine(context: IdeCommandContext): AnnotationMachine | undefined {
  const emu = context.store.getState().emulatorState;
  return bankSpaceFor(emu?.machineId, machineConfigOf(emu?.machineId, emu?.modelId, emu?.config))
    ?.id;
}

/** A path relative to the open project's folder, as `tape-load` and the Explorer name files. */
function resolvePath(context: IdeCommandContext, file: string): string {
  const trimmed = file.trim();
  const folder = context.store.getState().project?.folderPath;
  const isAbsolute = /^([A-Za-z]:)?[\\/]/.test(trimmed);
  return isAbsolute || !folder ? trimmed : `${folder.replace(/[\\/]+$/, "")}/${trimmed}`;
}

function messageOf(err: unknown): string {
  const text = err instanceof Error ? err.message : String(err);
  return text.replace(/^(Error: )+/, "");
}

// ------------------------------------------------------------------------------------------------

type AnnOpenArgs = { file: string };

export class AnnotationOpenCommand extends IdeCommandBase<AnnOpenArgs> {
  readonly id = "ann-open";
  get description() {
    return t("commands.annSet.openDescription");
  }
  readonly usage = "ann-open <file>";
  readonly argumentInfo: CommandArgumentInfo = {
    mandatory: [{ name: "file", type: "string" }]
  };

  async validateCommandArgs(
    _context: IdeCommandContext,
    args: AnnOpenArgs
  ): Promise<ValidationMessage[]> {
    return args.file?.trim() ? [] : [validationError(t("commands.annSet.emptyPath"))];
  }

  async execute(context: IdeCommandContext, args: AnnOpenArgs): Promise<IdeCommandResult> {
    const path = resolvePath(context, args.file);
    const state = await loadAnnotationSidecar(context.service.projectService, { fullPath: path });
    if (state.status === "missing") {
      return commandError(t("commands.annSet.missing", { path }));
    }
    if (state.status !== "loaded" || !state.annotations) {
      const problems = state.diagnostics
        .filter((item) => item.severity === "error")
        .map((item) => `${item.path}: ${item.message}`);
      return commandError(
        t("commands.annSet.cannotUse", { path, problems: [state.message, ...problems].filter(Boolean).join("; ") })
      );
    }
    const machine = annotationMachineOf(state.annotations);
    seedAnnotationSession(path, state.annotations);
    setActiveAnnotationSet({ path, machine, reason: "command" });
    const warning = annotationMachineWarning(machine, currentAnnotationMachine(context));
    if (warning) writeMessage(context.output, t("commands.annSet.warning", { warning }), "yellow");
    return commandSuccessWith(t("commands.annSet.opened", { path, machine }));
  }
}

// ------------------------------------------------------------------------------------------------

type AnnNewArgs = { file: string; "-m"?: string };

export class AnnotationNewCommand extends IdeCommandBase<AnnNewArgs> {
  readonly id = "ann-new";
  get description() {
    return t("commands.annSet.newDescription");
  }
  readonly usage = `ann-new <file> [-m <${ANNOTATION_MACHINES.filter((m) => m !== "rom").join("|")}>]`;
  readonly argumentInfo: CommandArgumentInfo = {
    mandatory: [{ name: "file", type: "string" }],
    namedOptions: [{ name: "-m", type: "string" }]
  };

  async validateCommandArgs(
    context: IdeCommandContext,
    args: AnnNewArgs
  ): Promise<ValidationMessage[]> {
    const messages: ValidationMessage[] = [];
    if (!args.file?.trim()) {
      messages.push(validationError(t("commands.annSet.emptyPath")));
    } else if (!/\.dis$/i.test(args.file.trim())) {
      messages.push(validationError(t("commands.annSet.notDis")));
    }
    const machine = args["-m"];
    if (machine !== undefined) {
      if (!isAnnotationMachine(machine) || machine === "rom") {
        messages.push(
          validationError(
            t("commands.annSet.machineValues", {
              machines: ANNOTATION_MACHINES.filter((m) => m !== "rom").join(", ")
            })
          )
        );
      }
    } else if (!currentAnnotationMachine(context)) {
      messages.push(validationError(t("commands.annSet.notAnnotatableGiveM")));
    }
    return messages;
  }

  async execute(context: IdeCommandContext, args: AnnNewArgs): Promise<IdeCommandResult> {
    const path = resolvePath(context, args.file);
    const machine = (args["-m"] as AnnotationMachine | undefined) ?? currentAnnotationMachine(context)!;
    const existing = await loadAnnotationSidecar(context.service.projectService, { fullPath: path });
    if (existing.status !== "missing") {
      return commandError(t("commands.annSet.exists", { path }));
    }
    const annotations = createDefaultAnnotations({ machine, loadedBanks: [] });
    try {
      await context.service.projectService.saveFileContent(path, formatAnnotations(annotations));
    } catch (err) {
      return commandError(t("commands.common.cannotWriteFile", { file: path, message: messageOf(err) }));
    }
    seedAnnotationSession(path, annotations);
    setActiveAnnotationSet({ path, machine, reason: "command" });
    return commandSuccessWith(t("commands.annSet.created", { path, machine }));
  }
}

// ------------------------------------------------------------------------------------------------

export class AnnotationCloseCommand extends IdeCommandBase {
  readonly id = "ann-close";
  get description() {
    return t("commands.annSet.closeDescription");
  }
  readonly usage = "ann-close";

  async execute(): Promise<IdeCommandResult> {
    const active = getActiveAnnotationSet();
    if (!active) return commandSuccessWith(t("commands.annSet.noActive"));
    clearActiveAnnotationSet();
    return commandSuccessWith(t("commands.annSet.closed", { path: active.path }));
  }
}

// ------------------------------------------------------------------------------------------------

/**
 * What `ann-info` says about the ROM pages (§5.3): each page's identity, its sidecar (the working copy
 * or the shipped one) and the ones it inherits, whether it is editable, and for a page
 * the shipped annotations were byte-bound to (an inheriting ROM, or one Klive does not know, Q7),
 * how many of their labels bound.
 */
export function romAnnotationInfoLines(partitions: readonly RomPartitionInfo[]): string[] {
  const lines: string[] = [];
  for (const info of partitions) {
    const file = info.source.path?.split(/[\\/]/).pop() ?? t("commands.annSet.unknownFile");
    lines.push(t("commands.annSet.romPage", { page: String(info.partition), file, crc: info.source.crc32 }));
    if (info.layers.length === 0) lines.push(t("commands.annSet.noRomAnnotations"));
    for (const [i, layer] of info.layers.entries()) {
      const inherited = !(i === 0 && !layer.bound);
      const key =
        layer.kind === "working"
          ? inherited
            ? "commands.annSet.layerWorkingInherited"
            : "commands.annSet.layerWorking"
          : inherited
            ? "commands.annSet.layerShippedInherited"
            : "commands.annSet.layerShipped";
      lines.push(t(key, { path: layer.path }));
    }
    if (!info.hasWorkingCopy) {
      lines.push(t("commands.annSet.noWorkingCopy", { path: info.workingPath }));
    }
    for (const { sidecar, binding } of info.bindings) {
      lines.push(
        t("commands.annSet.labelsBound", { bound: binding.labelsBound, total: binding.labelsTotal, sidecar })
      );
    }
  }
  return lines;
}

export class AnnotationInfoCommand extends IdeCommandBase {
  readonly id = "ann-info";
  get description() {
    return t("commands.annSet.infoDescription");
  }
  readonly usage = "ann-info";

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    const active = getActiveAnnotationSet();
    const current = currentAnnotationMachine(context);
    if (!active) {
      writeMessage(context.output, t("commands.annSet.noActive"), "cyan");
    } else {
      writeMessage(context.output, t("commands.annSet.setLine", { path: active.path }), "cyan");
      if (active.hostPath) writeMessage(context.output, t("commands.annSet.annotates", { path: active.hostPath }));
      writeMessage(context.output, t("commands.annSet.madeActiveBy", { reason: active.reason }));

      // --- The session's copy is the current one; the file may be a write behind it.
      let annotations = peekAnnotationSession(active.path);
      let status = annotations ? "loaded" : "missing";
      if (!annotations) {
        const state = await loadAnnotationSidecar(context.service.projectService, {
          fullPath: active.path
        });
        status = state.status;
        annotations = state.annotations;
      }
      const machine = annotations ? annotationMachineOf(annotations) : active.machine;
      writeMessage(
        context.output,
        current
          ? t("commands.annSet.machineWithCurrent", { machine, current })
          : t("commands.annSet.machine", { machine })
      );
      if (status === "missing") {
        writeMessage(context.output, t("commands.annSet.notCreated"));
      } else if (!annotations) {
        writeMessage(context.output, t("commands.annSet.cannotRead", { status }), "red");
      } else {
        const counts = countAnnotations(annotations);
        writeMessage(context.output, t("commands.annSet.counts", { ...counts }));
      }
      const warning = annotationMachineWarning(machine, current);
      if (warning) writeMessage(context.output, t("commands.annSet.infoWarning", { warning }), "yellow");
    }
    for (const line of romAnnotationInfoLines(getRomPartitions())) {
      writeMessage(context.output, line);
    }
    return commandSuccess;
  }
}
