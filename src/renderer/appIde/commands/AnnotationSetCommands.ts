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
  readonly description = "Makes an annotation (.dis) file the active annotation set";
  readonly usage = "ann-open <file>";
  readonly argumentInfo: CommandArgumentInfo = {
    mandatory: [{ name: "file", type: "string" }]
  };

  async validateCommandArgs(
    _context: IdeCommandContext,
    args: AnnOpenArgs
  ): Promise<ValidationMessage[]> {
    return args.file?.trim() ? [] : [validationError("The annotation file path cannot be empty.")];
  }

  async execute(context: IdeCommandContext, args: AnnOpenArgs): Promise<IdeCommandResult> {
    const path = resolvePath(context, args.file);
    const state = await loadAnnotationSidecar(context.service.projectService, { fullPath: path });
    if (state.status === "missing") {
      return commandError(`${path} does not exist; use ann-new to create it.`);
    }
    if (state.status !== "loaded" || !state.annotations) {
      const problems = state.diagnostics
        .filter((item) => item.severity === "error")
        .map((item) => `${item.path}: ${item.message}`);
      return commandError(
        `${path} cannot be used: ${[state.message, ...problems].filter(Boolean).join("; ")}`
      );
    }
    const machine = annotationMachineOf(state.annotations);
    seedAnnotationSession(path, state.annotations);
    setActiveAnnotationSet({ path, machine, reason: "command" });
    const warning = annotationMachineWarning(machine, currentAnnotationMachine(context));
    if (warning) writeMessage(context.output, `Warning: ${warning}`, "yellow");
    return commandSuccessWith(`${path} is the active annotation set (${machine}).`);
  }
}

// ------------------------------------------------------------------------------------------------

type AnnNewArgs = { file: string; "-m"?: string };

export class AnnotationNewCommand extends IdeCommandBase<AnnNewArgs> {
  readonly id = "ann-new";
  readonly description =
    "Creates an annotation (.dis) file and makes it the active annotation set (-m names the bank space)";
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
      messages.push(validationError("The annotation file path cannot be empty."));
    } else if (!/\.dis$/i.test(args.file.trim())) {
      messages.push(validationError("An annotation file is named <something>.dis."));
    }
    const machine = args["-m"];
    if (machine !== undefined) {
      if (!isAnnotationMachine(machine) || machine === "rom") {
        messages.push(
          validationError(
            `-m must be one of ${ANNOTATION_MACHINES.filter((m) => m !== "rom").join(", ")}.`
          )
        );
      }
    } else if (!currentAnnotationMachine(context)) {
      messages.push(validationError("This machine's memory cannot be annotated; give -m."));
    }
    return messages;
  }

  async execute(context: IdeCommandContext, args: AnnNewArgs): Promise<IdeCommandResult> {
    const path = resolvePath(context, args.file);
    const machine = (args["-m"] as AnnotationMachine | undefined) ?? currentAnnotationMachine(context)!;
    const existing = await loadAnnotationSidecar(context.service.projectService, { fullPath: path });
    if (existing.status !== "missing") {
      return commandError(`${path} already exists; use ann-open to make it active.`);
    }
    const annotations = createDefaultAnnotations({ machine, loadedBanks: [] });
    try {
      await context.service.projectService.saveFileContent(path, formatAnnotations(annotations));
    } catch (err) {
      return commandError(`Could not write ${path}: ${messageOf(err)}`);
    }
    seedAnnotationSession(path, annotations);
    setActiveAnnotationSet({ path, machine, reason: "command" });
    return commandSuccessWith(`${path} created; it is the active annotation set (${machine}).`);
  }
}

// ------------------------------------------------------------------------------------------------

export class AnnotationCloseCommand extends IdeCommandBase {
  readonly id = "ann-close";
  readonly description = "Deactivates the active annotation set";
  readonly usage = "ann-close";

  async execute(): Promise<IdeCommandResult> {
    const active = getActiveAnnotationSet();
    if (!active) return commandSuccessWith("No annotation set is active.");
    clearActiveAnnotationSet();
    return commandSuccessWith(`${active.path} is no longer the active annotation set.`);
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
    const file = info.source.path?.split(/[\\/]/).pop() ?? "unknown file";
    lines.push(`ROM page ${info.partition} (${file}, CRC ${info.source.crc32}):`);
    if (info.layers.length === 0) lines.push("  no ROM annotations");
    for (const [i, layer] of info.layers.entries()) {
      const role = layer.kind === "working" ? "working copy" : "shipped";
      lines.push(`  ${i === 0 && !layer.bound ? role : `${role}, inherited`}: ${layer.path}`);
    }
    if (!info.hasWorkingCopy) {
      lines.push(`  working copy: none (rom-ann-new makes ${info.workingPath}, which makes the page editable)`);
    }
    for (const { sidecar, binding } of info.bindings) {
      lines.push(`  ${binding.labelsBound} of ${binding.labelsTotal} labels of ${sidecar} bound to these bytes`);
    }
  }
  return lines;
}

export class AnnotationInfoCommand extends IdeCommandBase {
  readonly id = "ann-info";
  readonly description =
    "Shows the active annotation set: its file, machine and what it holds, and the ROM annotations in use";
  readonly usage = "ann-info";

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    const active = getActiveAnnotationSet();
    const current = currentAnnotationMachine(context);
    if (!active) {
      writeMessage(context.output, "No annotation set is active.", "cyan");
    } else {
      writeMessage(context.output, `Annotation set: ${active.path}`, "cyan");
      if (active.hostPath) writeMessage(context.output, `  annotates: ${active.hostPath}`);
      writeMessage(context.output, `  made active by: ${active.reason}`);

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
      writeMessage(context.output, `  machine: ${machine}${current ? ` (this machine: ${current})` : ""}`);
      if (status === "missing") {
        writeMessage(context.output, "  not created yet: the first label or comment creates it");
      } else if (!annotations) {
        writeMessage(context.output, `  cannot be read (${status})`, "red");
      } else {
        const counts = countAnnotations(annotations);
        writeMessage(
          context.output,
          `  ${counts.labels} label(s), ${counts.comments} comment(s), ${counts.regions} region(s) ` +
            `in ${counts.banks} bank(s); ${counts.breakpoints} breakpoint(s)`
        );
      }
      const warning = annotationMachineWarning(machine, current);
      if (warning) writeMessage(context.output, `  Warning: ${warning}`, "yellow");
    }
    for (const line of romAnnotationInfoLines(getRomPartitions())) {
      writeMessage(context.output, line);
    }
    return commandSuccess;
  }
}
