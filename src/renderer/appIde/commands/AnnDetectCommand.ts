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
import { t } from "@common/i18n/i18n";

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
  get description() {
    return t("commands.annDetect.description");
  }
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
    if (!parseDetectionScope(args.target)) messages.push(validationError(t("commands.annDetect.targetValues")));
    const mode = args["-mode"]?.toLowerCase();
    if (mode !== undefined && mode !== "fill" && mode !== "replace" && mode !== "clear") {
      messages.push(validationError(t("commands.annDetect.modeValues")));
    }
    const unknown = args["-unknown"]?.toLowerCase();
    if (unknown !== undefined && unknown !== "keep" && unknown !== "bytes") {
      messages.push(validationError(t("commands.annDetect.unknownValues")));
    }
    return messages;
  }

  async execute(context: IdeCommandContext, args: AnnDetectArgs): Promise<IdeCommandResult> {
    const projectService = context.service.projectService;
    if (args["-undo"]) {
      if (!canUndoDetection()) return commandError(t("commands.annDetect.nothingToUndo"));
      const paths = await undoLastDetection(projectService);
      writeSuccessMessage(context.output, t("commands.annDetect.restored", { paths: paths.join(", ") }));
      return commandSuccess;
    }

    const detection = detectionContextFor(context.store.getState(), projectService);
    if (!detection) return commandError(t("commands.common.notAnnotatable"));
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
      return commandError(t("commands.annDetect.failed", { message: err instanceof Error ? err.message : String(err) }));
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
        name: t("commands.annDetect.documentName"),
        type: COMMAND_RESULT_EDITOR,
        iconName: "disassembly-icon",
        iconFill: "--console-ansi-bright-green",
        contents: { title: t("commands.common.resultTitle", { command: context.commandtext.trim() }), buffer } as any
      },
      false
    );

    if (!args["-apply"]) {
      writeInfoMessage(context.output, t("commands.annDetect.dryRun"));
      return commandSuccess;
    }
    const { written, problems } = await applyDetection(run.targets, detection);
    problems.forEach((problem) => writeInfoMessage(context.output, problem));
    if (written.length === 0) return commandError(t("commands.common.nothingWritten"));
    writeSuccessMessage(
      context.output,
      t("commands.annDetect.applied", { paths: written.join(", ") })
    );
    return commandSuccess;
  }
}
