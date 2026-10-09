import type { CommandArgumentInfo } from "@renderer/abstractions/IdeCommandInfo";
import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import type { IdeCommandResult } from "@renderer/abstractions/IdeCommandResult";
import type { ValidationMessage } from "@renderer/abstractions/ValidationMessage";

import { COMMAND_RESULT_EDITOR } from "@state/common-ids";
import { describeProposal } from "@common/reverse/proposal";
import {
  IdeCommandBase,
  commandError,
  commandSuccess,
  validationError,
  writeInfoMessage,
  writeSuccessMessage
} from "../services/ide-commands";
import { OutputPaneBuffer } from "../ToolArea/OutputPaneBuffer";
import {
  applyDetection,
  DEFAULT_DETECTION_REQUEST,
  runDetection,
  undoLastDetection,
  canUndoDetection,
  type DetectionRequest,
  type DetectionScope
} from "../reverse/detection";
import { detectionContextFor, detectionUnavailableReason } from "../reverse/detectionEnvironment";

type AnnDetectArgs = {
  target?: string;
  "-mode"?: string;
  "-unknown"?: string;
  "-reach"?: boolean;
  "-text"?: boolean;
  "-words"?: boolean;
  "-noscreen"?: boolean;
  "-apply"?: boolean;
  "-undo"?: boolean;
};

let resultIndex = 1;

/** Read the target argument: a bank number (decimal or `$hex`), `rom`, `all`, or none (paged). */
export function parseDetectionScope(target: string | number | undefined): DetectionScope | undefined {
  if (target === undefined || target === "") return { kind: "paged" };
  if (typeof target === "number") return Number.isInteger(target) && target >= 0 ? { kind: "bank", bank: target } : undefined;
  const text = target.trim().toLowerCase();
  if (text === "rom") return { kind: "rom" };
  if (text === "all") return { kind: "all" };
  if (text === "paged") return { kind: "paged" };
  const value = text.startsWith("$") ? parseInt(text.slice(1), 16) : /^[0-9]+$/.test(text) ? parseInt(text, 10) : NaN;
  return Number.isInteger(value) && value >= 0 ? { kind: "bank", bank: value } : undefined;
}

/**
 * `ann-detect`: classify bytes as code or data from code coverage, and propose regions for the
 * active annotations (`.plans/REVERSE_ENGINEERING_TOOLS_PLAN.md` §4.6, G7.3).
 *
 * Without `-apply` it only reports, in the output and a result document. With `-apply` it writes the
 * proposal as one update; `-undo` puts back what the last apply replaced, and `-mode clear` removes
 * every detected region for good.
 */
export class AnnDetectCommand extends IdeCommandBase<AnnDetectArgs> {
  readonly id = "ann-detect";
  readonly description =
    "Detects code and data from code coverage and proposes regions for the active annotations";
  readonly aliases = ["detect"];
  readonly usage = [
    "ann-detect [<bank>|rom|all] [-mode fill|replace|clear] [-reach] [-text] [-words]",
    "           [-unknown keep|bytes] [-noscreen] [-apply]",
    "ann-detect -undo"
  ];
  readonly argumentInfo: CommandArgumentInfo = {
    optional: [{ name: "target", type: "string" }],
    namedOptions: [
      { name: "-mode", type: "string" },
      { name: "-unknown", type: "string" }
    ],
    commandOptions: ["-reach", "-text", "-words", "-noscreen", "-apply", "-undo"]
  };

  async validateCommandArgs(context: IdeCommandContext, args: AnnDetectArgs): Promise<ValidationMessage[]> {
    const messages: ValidationMessage[] = [];
    if (args["-undo"]) return messages;
    const reason = detectionUnavailableReason(context.store.getState());
    if (reason) messages.push(validationError(reason));
    if (!parseDetectionScope(args.target)) messages.push(validationError("Name a bank number, rom or all."));
    const mode = args["-mode"]?.toLowerCase();
    if (mode !== undefined && mode !== "fill" && mode !== "replace" && mode !== "clear") {
      messages.push(validationError("-mode: use fill, replace or clear"));
    }
    const unknown = args["-unknown"]?.toLowerCase();
    if (unknown !== undefined && unknown !== "keep" && unknown !== "bytes") {
      messages.push(validationError("-unknown: use keep or bytes"));
    }
    return messages;
  }

  async execute(context: IdeCommandContext, args: AnnDetectArgs): Promise<IdeCommandResult> {
    const projectService = context.service.projectService;
    if (args["-undo"]) {
      if (!canUndoDetection()) return commandError("There is no detection to undo in this session.");
      const paths = await undoLastDetection(projectService);
      writeSuccessMessage(context.output, `Restored the annotations before the last detection: ${paths.join(", ")}`);
      return commandSuccess;
    }

    const detection = detectionContextFor(context.store.getState(), projectService);
    if (!detection) return commandError("This machine's memory cannot be annotated.");
    const request: DetectionRequest = {
      ...DEFAULT_DETECTION_REQUEST,
      scope: parseDetectionScope(args.target)!,
      mode: (args["-mode"]?.toLowerCase() as DetectionRequest["mode"]) ?? "fill",
      reach: !!args["-reach"],
      text: !!args["-text"],
      words: !!args["-words"],
      unknown: (args["-unknown"]?.toLowerCase() as DetectionRequest["unknown"]) ?? "keep",
      screen: !args["-noscreen"]
    };

    let run;
    try {
      run = await runDetection(context.emuApi, detection, request);
    } catch (err) {
      return commandError(`Detection failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (run.problem && run.targets.length === 0) return commandError(run.problem);

    const buffer = new OutputPaneBuffer(0x1_0000);
    for (const target of run.targets) {
      const lines = describeProposal(target.proposal, target.name);
      writeInfoMessage(context.output, lines[0]);
      lines.forEach((line) => buffer.writeLine(line));
      buffer.writeLine("");
    }
    await context.service.projectService.getActiveDocumentHubService().openDocument(
      {
        id: `annDetect-${resultIndex++}`,
        name: "Detected code and data",
        type: COMMAND_RESULT_EDITOR,
        iconName: "disassembly-icon",
        iconFill: "--console-ansi-bright-green",
        contents: { title: `Result of running '${context.commandtext.trim()}'`, buffer } as any
      },
      false
    );

    if (!args["-apply"]) {
      writeInfoMessage(context.output, "Nothing was written. Add -apply to write the proposal.");
      return commandSuccess;
    }
    const { written, problems } = await applyDetection(run.targets, detection);
    problems.forEach((problem) => writeInfoMessage(context.output, problem));
    if (written.length === 0) return commandError("Nothing was written.");
    writeSuccessMessage(
      context.output,
      `Applied to ${written.join(", ")}. Undo with 'ann-detect -undo'; remove detected regions with -mode clear.`
    );
    return commandSuccess;
  }
}
