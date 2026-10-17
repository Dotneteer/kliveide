import type { CommandArgumentInfo } from "@renderer/abstractions/IdeCommandInfo";
import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import type { IdeCommandResult } from "@renderer/abstractions/IdeCommandResult";
import type { ValidationMessage } from "@renderer/abstractions/ValidationMessage";

import { describeProposal } from "@common/reverse/proposal";
import {
  IdeCommandBase,
  commandError,
  commandSuccess,
  validationError,
  writeInfoMessage,
  writeSuccessMessage
} from "../services/ide-commands";
import { applyDetection } from "../reverse/detection";
import { detectionContextFor } from "../reverse/detectionEnvironment";
import { buildSkoolExport, buildSkoolImport, type SkoolExportScope } from "../reverse/skoolRun";
import { exportContextFor } from "./ExportAsmCommand";
import { t } from "@common/i18n/i18n";

/*
 * SkoolKit import and export (`.plans/REVERSE_ENGINEERING_TOOLS_PLAN.md` §6.4, G7.5). The formats
 * are read and written from SkoolKit's documentation only (R7). A skool file of a Spectrum ROM is
 * the user's own data when they import it into their own ROM layer; nothing here writes a shipped
 * sidecar (R8).
 */

type SkoolImportArgs = { file: string; "-ctl"?: boolean; "-mode"?: string; "-apply"?: boolean };

export class SkoolImportCommand extends IdeCommandBase<SkoolImportArgs> {
  readonly id = "skool-import";
  get description() {
    return t("commands.skool.importDescription");
  }
  readonly aliases = [];
  readonly usage = "skool-import <file> [-ctl] [-mode fill|replace] [-apply]";
  readonly argumentInfo: CommandArgumentInfo = {
    mandatory: [{ name: "file", type: "string" }],
    namedOptions: [{ name: "-mode", type: "string" }],
    commandOptions: ["-ctl", "-apply"]
  };

  async validateCommandArgs(_context: IdeCommandContext, args: SkoolImportArgs): Promise<ValidationMessage[]> {
    const mode = args["-mode"]?.toLowerCase();
    return mode !== undefined && mode !== "fill" && mode !== "replace"
      ? [validationError(t("commands.skool.modeValues"))]
      : [];
  }

  async execute(context: IdeCommandContext, args: SkoolImportArgs): Promise<IdeCommandResult> {
    const detection = detectionContextFor(context.store.getState(), context.service.projectService);
    if (!detection) return commandError(t("commands.common.notAnnotatable"));
    let text: string;
    try {
      text = await context.mainApi.readTextFile(args.file);
    } catch (err) {
      return commandError(
        t("commands.common.cannotReadFile", { file: args.file, message: err instanceof Error ? err.message : String(err) })
      );
    }
    // --- The format follows the extension, unless -ctl says otherwise
    const path = args["-ctl"] && !/\.ctl$/i.test(args.file) ? `${args.file}.ctl` : args.file;
    const mode = (args["-mode"]?.toLowerCase() as "fill" | "replace") ?? "fill";
    const run = await buildSkoolImport(context.emuApi, detection, path, text, mode, (lines, z80n) =>
      context.mainApi.assembleLines(lines, z80n)
    );
    for (const note of run.notes ?? []) writeInfoMessage(context.output, note);
    if (run.problem && run.targets.length === 0) return commandError(run.problem);
    for (const target of run.targets) {
      writeInfoMessage(context.output, describeProposal(target.proposal, target.name)[0]);
    }
    if (!args["-apply"]) {
      writeInfoMessage(context.output, t("commands.skool.dryRun"));
      return commandSuccess;
    }
    const { written, problems } = await applyDetection(run.targets, detection);
    problems.forEach((problem) => writeInfoMessage(context.output, problem));
    if (!written.length) return commandError(t("commands.common.nothingWritten"));
    writeSuccessMessage(context.output, t("commands.skool.imported", { paths: written.join(", ") }));
    return commandSuccess;
  }
}

type SkoolExportArgs = {
  file: string;
  from?: number;
  to?: number;
  "-ctl"?: boolean;
  "-bank"?: string;
  "-split"?: boolean;
};

export class SkoolExportCommand extends IdeCommandBase<SkoolExportArgs> {
  readonly id = "skool-export";
  get description() {
    return t("commands.skool.exportDescription");
  }
  readonly aliases = [];
  readonly usage = "skool-export <file> [-ctl] [<from> <to>] [-bank <n>|all] [-split]";
  readonly argumentInfo: CommandArgumentInfo = {
    mandatory: [{ name: "file", type: "string" }],
    optional: [
      { name: "from", type: "number", minValue: 0, maxValue: 0xffff },
      { name: "to", type: "number", minValue: 0, maxValue: 0xffff }
    ],
    namedOptions: [{ name: "-bank", type: "string" }],
    commandOptions: ["-ctl", "-split"]
  };

  async validateCommandArgs(_context: IdeCommandContext, args: SkoolExportArgs): Promise<ValidationMessage[]> {
    const messages: ValidationMessage[] = [];
    if (args["-bank"] === undefined && (args.from === undefined || args.to === undefined)) {
      messages.push(validationError(t("commands.skool.rangeOrBank")));
    }
    const bank = args["-bank"];
    if (bank !== undefined && bank !== "all" && !/^(\$[0-9a-f]+|[0-9]+)$/i.test(String(bank))) {
      messages.push(validationError(t("commands.skool.bankValues")));
    }
    return messages;
  }

  async execute(context: IdeCommandContext, args: SkoolExportArgs): Promise<IdeCommandResult> {
    const exportContext = exportContextFor(context.store.getState(), context);
    if (!exportContext) return commandError(t("commands.common.notAnnotatable"));
    const bankArg = args["-bank"] !== undefined ? String(args["-bank"]) : undefined;
    const scope: SkoolExportScope =
      bankArg === "all"
        ? { kind: "all" }
        : bankArg !== undefined
          ? { kind: "bank", bank: bankArg.startsWith("$") ? parseInt(bankArg.slice(1), 16) : parseInt(bankArg, 10) }
          : { kind: "range", from: args.from!, to: args.to! };
    const format = args["-ctl"] || /\.ctl$/i.test(args.file) ? "ctl" : "skool";
    let files;
    try {
      files = await buildSkoolExport(context.emuApi, exportContext, scope, format, !!args["-split"]);
    } catch (err) {
      return commandError(t("commands.exportAsm.failed", { message: err instanceof Error ? err.message : String(err) }));
    }
    for (const file of files) {
      const path = file.suffix ? args.file.replace(/(\.[^./\\]+)?$/, (ext) => `${file.suffix}${ext}`) : args.file;
      await context.mainApi.saveTextFile(path, file.text);
      writeSuccessMessage(context.output, t("commands.skool.exported", { format, path }));
    }
    return commandSuccess;
  }
}
