import { resolveCommandFilePath } from "./commandFilePath";
import type { CommandArgumentInfo } from "@renderer/abstractions/IdeCommandInfo";
import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import type { IdeCommandResult } from "@renderer/abstractions/IdeCommandResult";
import type { ValidationMessage } from "@renderer/abstractions/ValidationMessage";
import type { IDocumentHubService } from "@renderer/abstractions/IDocumentHubService";
import type { MainApi } from "@common/messaging/MainApi";

import { ROM_ANNOTATION_EDITOR } from "@common/state/common-ids";
import { formatRomSidecar, type Provenance } from "@common/roms/romAnnotationTools";
import { romPageIdentity } from "@common/roms/romIdentity";
import {
  SHIPPED_ROM_FOLDER,
  inheritedSidecarSource,
  readShippedIndex,
  workingCopyOf
} from "@renderer/appIde/annotations/romAnnotationLoader";
import { getRomPartitions, requestRomAnnotationsReload } from "@renderer/appIde/annotations/romAnnotations";
import {
  createWorkingCopy,
  workingCopyTargetOf,
  type WorkingCopyTarget
} from "@renderer/appIde/annotations/romWorkingCopy";
import { checkRomSidecar } from "@renderer/appIde/annotations/romSidecarCheck";
import { matchRomPages } from "@renderer/appIde/annotations/romSidecarMatch";
import { withProvenance } from "@renderer/appIde/annotations/romSidecarWriter";
import {
  flushAnnotationSession,
  peekAnnotationSession,
  updateAnnotationSession
} from "@renderer/appIde/annotations/annotationSession";
import { importRomNames, parseRomNameList } from "@renderer/appIde/annotations/romNameImport";
import { parseAnnotations } from "@renderer/appIde/annotations/programAnnotations";
import {
  commandError,
  commandSuccess,
  commandSuccessWith,
  IdeCommandBase,
  validationError,
  writeInfoMessage,
  writeMessage,
  writeSuccessMessage
} from "../services/ide-commands";
import { romExportVerdictText, runRomSourceExport } from "@renderer/appIde/annotations/romSourceExport";
import { t } from "@common/i18n/i18n";

/*
 * The `rom-ann-*` commands (`.plans/ROM_ANNOTATION_EDITING_PLAN.md` R7, R8).
 *
 * A ROM is named as Klive ships it (`sp48.rom`, `sp128-1.rom`), or by the path of a ROM file
 * (absolute, or relative to the open project). A multi-page file takes `-page <n>`.
 */

function fileNameOf(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

function pageOf(bytes: Uint8Array, page: number): Uint8Array | undefined {
  const start = page * 0x4000;
  return start < bytes.length ? bytes.subarray(start, Math.min(bytes.length, start + 0x4000)) : undefined;
}

/**
 * Where the working copy of a ROM page is, and what it starts from.
 *
 * A shipped ROM's name is looked up among the shipped ROMs first; anything else is read as a ROM
 * file. A page Klive ships a sidecar for is named after that sidecar whatever file it came from.
 */
export async function romTargetOf(
  context: IdeCommandContext,
  rom: string,
  page = 0
): Promise<WorkingCopyTarget | { error: string }> {
  const mainApi = context.mainApi;
  const isPath = /[\\/]/.test(rom);
  let bytes: Uint8Array | undefined;
  let path: string;
  if (!isPath) {
    path = `${SHIPPED_ROM_FOLDER}/${rom}`;
    bytes = await mainApi.readBinaryFile(path).catch(() => undefined);
  }
  if (!bytes) {
    const resolved = resolveCommandFilePath(context, rom);
    // --- A bare name that is not a shipped ROM is most likely one mistyped, so say that rather
    // --- than that no project is open; a path needs the project to mean anything
    if ("error" in resolved) return { error: isPath ? resolved.error : t("commands.romAnn.unknownRom", { rom }) };
    path = resolved.path;
    bytes = await mainApi.readBinaryFile(path).catch(() => undefined);
  }
  if (!bytes) return { error: t("commands.romAnn.unknownRom", { rom }) };
  const pageBytes = pageOf(bytes, page);
  if (!pageBytes) return { error: t("commands.romAnn.noPage", { rom, page: String(page) }) };

  const identity = romPageIdentity(pageBytes);
  const source = { ...identity, path, page };
  const working = await workingCopyOf(mainApi as any, source, await readShippedIndex(mainApi));
  return {
    workingPath: working.path,
    workingPage: working.page,
    ...(working.shippedSidecar ? { shippedSidecar: working.shippedSidecar } : {}),
    crc32: identity.crc32,
    size: identity.size,
    romName: working.shippedSidecar ? working.shippedSidecar.replace(/\.dis$/i, "") : fileNameOf(path)
  };
}

/** Open a ROM sidecar in the ROM annotation editor. */
export async function openRomAnnotationEditor(
  documentHubService: IDocumentHubService,
  sidecarPath: string
): Promise<void> {
  const id = `romAnnotations:${sidecarPath}`;
  if (documentHubService.isOpen(id)) {
    documentHubService.setActiveDocument(id);
    return;
  }
  await documentHubService.openDocument(
    { id, name: fileNameOf(sidecarPath), type: ROM_ANNOTATION_EDITOR, iconName: "note" },
    { sidecarPath },
    false
  );
}

/** Make the working copy of a ROM partition the IDE has loaded, and open it. For the live view. */
export async function startEditingRomPartition(
  mainApi: Pick<MainApi, "readTextFile" | "renameFileEntry">,
  projectService: Parameters<typeof createWorkingCopy>[1],
  documentHubService: IDocumentHubService,
  partition: number
): Promise<string> {
  const info = getRomPartitions().find((candidate) => candidate.partition === partition);
  if (!info) throw new Error(t("commands.romAnn.notIdentified"));
  const target = workingCopyTargetOf(info);
  const result = await createWorkingCopy(mainApi, projectService, target);
  if ("reason" in result && !info.hasWorkingCopy) throw new Error(result.reason);
  requestRomAnnotationsReload();
  await openRomAnnotationEditor(documentHubService, target.workingPath);
  return target.workingPath;
}

// ------------------------------------------------------------------------------------------------

type RomArgs = { rom?: string; "-page"?: number };

const ROM_ARGUMENTS: CommandArgumentInfo = {
  optional: [{ name: "rom", type: "string" }],
  namedOptions: [{ name: "-page", type: "number" }]
};

async function validateRom(args: RomArgs, mandatory: boolean): Promise<ValidationMessage[]> {
  const messages: ValidationMessage[] = [];
  if (mandatory && !args.rom?.trim()) messages.push(validationError(t("commands.romAnn.nameRom")));
  const page = args["-page"];
  if (page !== undefined && (!Number.isInteger(page) || page < 0 || page > 15)) {
    messages.push(validationError(t("commands.romAnn.pageValues")));
  }
  return messages;
}

export class RomAnnotationNewCommand extends IdeCommandBase<RomArgs> {
  readonly id = "rom-ann-new";
  get description() {
    return t("commands.romAnn.newDescription");
  }
  readonly usage = "rom-ann-new <rom> [-page <n>]";
  readonly argumentInfo = ROM_ARGUMENTS;

  validateCommandArgs(_context: IdeCommandContext, args: RomArgs): Promise<ValidationMessage[]> {
    return validateRom(args, true);
  }

  async execute(context: IdeCommandContext, args: RomArgs): Promise<IdeCommandResult> {
    const target = await romTargetOf(context, args.rom!, args["-page"] ?? 0);
    if ("error" in target) return commandError(target.error);
    const result = await createWorkingCopy(context.mainApi, context.service.projectService, target);
    if ("reason" in result) return commandError(t("commands.romAnn.newRefused", { reason: result.reason, rom: args.rom }));
    requestRomAnnotationsReload();
    await openRomAnnotationEditor(context.service.projectService.getActiveDocumentHubService(), result.path);
    return commandSuccessWith(
      result.from === "shipped"
        ? t("commands.romAnn.copiedShipped", { sidecar: target.shippedSidecar, path: result.path })
        : t("commands.romAnn.createdEmpty", { path: result.path, rom: target.romName })
    );
  }
}

export class RomAnnotationOpenCommand extends IdeCommandBase<RomArgs> {
  readonly id = "rom-ann-open";
  get description() {
    return t("commands.romAnn.openDescription");
  }
  readonly usage = "rom-ann-open <rom>|<sidecar.dis> [-page <n>]";
  readonly argumentInfo = ROM_ARGUMENTS;

  validateCommandArgs(_context: IdeCommandContext, args: RomArgs): Promise<ValidationMessage[]> {
    return validateRom(args, true);
  }

  async execute(context: IdeCommandContext, args: RomArgs): Promise<IdeCommandResult> {
    const hub = context.service.projectService.getActiveDocumentHubService();
    if (/\.dis$/i.test(args.rom!)) {
      const resolved = resolveCommandFilePath(context, args.rom!);
      if ("error" in resolved) return commandError(resolved.error);
      await openRomAnnotationEditor(hub, resolved.path);
      return commandSuccess;
    }
    const target = await romTargetOf(context, args.rom!, args["-page"] ?? 0);
    if ("error" in target) return commandError(target.error);
    const exists = await context.service.projectService
      .readFileContent(target.workingPath, false)
      .then((text) => typeof text === "string")
      .catch(() => false);
    if (exists) {
      await openRomAnnotationEditor(hub, target.workingPath);
      return commandSuccess;
    }
    if (target.shippedSidecar) {
      await openRomAnnotationEditor(hub, `${SHIPPED_ROM_FOLDER}/${target.shippedSidecar}`);
      return commandSuccessWith(
        t("commands.romAnn.openedReadOnly", { sidecar: target.shippedSidecar, rom: args.rom })
      );
    }
    return commandError(t("commands.romAnn.noAnnotations", { rom: args.rom }));
  }
}

/** The sidecar a `rom-ann-check` / `rom-ann-provenance` argument names. */
async function sidecarPathOf(context: IdeCommandContext, args: RomArgs): Promise<string | { error: string }> {
  if (args.rom && /\.dis$/i.test(args.rom)) {
    const resolved = resolveCommandFilePath(context, args.rom);
    return "error" in resolved ? resolved : resolved.path;
  }
  if (!args.rom) return { error: t("commands.romAnn.nameRomOrSidecar") };
  const target = await romTargetOf(context, args.rom, args["-page"] ?? 0);
  return "error" in target ? target : target.workingPath;
}

async function readText(context: IdeCommandContext, path: string): Promise<string | undefined> {
  const reader = path.startsWith(`${SHIPPED_ROM_FOLDER}/`)
    ? context.mainApi.readTextFile(path)
    : context.service.projectService.readFileContent(path, false);
  return Promise.resolve(reader)
    .then((text) => (typeof text === "string" ? text : undefined))
    .catch(() => undefined);
}

export class RomAnnotationCheckCommand extends IdeCommandBase<RomArgs> {
  readonly id = "rom-ann-check";
  get description() {
    return t("commands.romAnn.checkDescription");
  }
  readonly usage = "rom-ann-check <rom>|<sidecar.dis> [-page <n>]";
  readonly argumentInfo = ROM_ARGUMENTS;

  validateCommandArgs(_context: IdeCommandContext, args: RomArgs): Promise<ValidationMessage[]> {
    return validateRom(args, true);
  }

  async execute(context: IdeCommandContext, args: RomArgs): Promise<IdeCommandResult> {
    const path = await sidecarPathOf(context, args);
    if (typeof path !== "string") return commandError(path.error);
    await flushAnnotationSession(path);
    const text = await readText(context, path);
    if (text === undefined) return commandError(t("commands.romAnn.cannotReadMakeCopy", { path }));
    let raw: Record<string, any>;
    try {
      raw = JSON.parse(text);
    } catch (err) {
      return commandError(t("commands.romAnn.invalidJson", { path, message: (err as Error).message }));
    }
    const matches = await matchRomPages({ files: context.mainApi, emuApi: context.emuApi }, path, raw.pages ?? {});
    const check = await checkRomSidecar(
      text,
      (page) => matches.find((m) => m.page === page)?.bytes,
      inheritedSidecarSource({ files: context.mainApi, projectService: context.service.projectService })
    );
    const levels = Object.entries(check.levels)
      .map(([page, level]) => t("commands.romAnn.pageLevel", { page, level: String(level) }))
      .join(", ");
    writeMessage(
      context.output,
      t("commands.romAnn.checkHeader", {
        path,
        levels: levels || t("commands.romAnn.noPageMeasured"),
        recorded: String(check.recordedLevel)
      }),
      "cyan"
    );
    if (check.problems.length === 0) {
      writeSuccessMessage(context.output, t("commands.romAnn.readyToShip"));
      return commandSuccess;
    }
    for (const problem of check.problems) writeMessage(context.output, `  ${problem}`, "yellow");
    return commandError(t("commands.romAnn.problems", { count: check.problems.length }));
  }
}

type ProvenanceArgs = RomArgs & { offset?: number; kind?: string; provenance?: string };

export class RomAnnotationProvenanceCommand extends IdeCommandBase<ProvenanceArgs> {
  readonly id = "rom-ann-provenance";
  get description() {
    return t("commands.romAnn.provenanceDescription");
  }
  readonly usage = "rom-ann-provenance <rom>|<sidecar.dis> <offset> label|line|region observed|manual [-page <n>]";
  readonly argumentInfo: CommandArgumentInfo = {
    mandatory: [
      { name: "rom", type: "string" },
      { name: "offset", type: "number" },
      { name: "kind", type: "string" },
      { name: "provenance", type: "string" }
    ],
    namedOptions: [{ name: "-page", type: "number" }]
  };

  async validateCommandArgs(_context: IdeCommandContext, args: ProvenanceArgs): Promise<ValidationMessage[]> {
    const messages = await validateRom(args, true);
    if (!["label", "line", "region"].includes(String(args.kind))) {
      messages.push(validationError(t("commands.romAnn.kindValues")));
    }
    if (!["observed", "manual"].includes(String(args.provenance))) {
      messages.push(validationError(t("commands.romAnn.provenanceValues")));
    }
    return messages;
  }

  async execute(context: IdeCommandContext, args: ProvenanceArgs): Promise<IdeCommandResult> {
    const path = await sidecarPathOf(context, args);
    if (typeof path !== "string") return commandError(path.error);
    if (path.startsWith(`${SHIPPED_ROM_FOLDER}/`)) return commandError(t("commands.romAnn.shippedReadOnly"));
    // --- Provenance is not in the model: the file is the only copy, so no write may be in flight
    await flushAnnotationSession(path);
    const text = await readText(context, path);
    if (text === undefined) return commandError(t("commands.romAnn.cannotRead", { path }));
    const raw = JSON.parse(text);
    const page = args["-page"] ?? 0;
    const key = `${page}:${args.offset}:${args.kind}`;
    const next = withProvenance(raw, key, args.provenance as Exclude<Provenance, "derived">);
    if (!next) return commandError(t("commands.romAnn.noEntry", { path, kind: args.kind, page: String(page), offset: String(args.offset) }));
    await context.service.projectService.saveFileContent(path, formatRomSidecar(next));
    return commandSuccessWith(t("commands.romAnn.provenanceSet", { key, provenance: args.provenance }));
  }
}

type ImportNamesArgs = RomArgs & { list?: string };

export class RomAnnotationImportNamesCommand extends IdeCommandBase<ImportNamesArgs> {
  readonly id = "rom-ann-import-names";
  get description() {
    return t("commands.romAnn.importDescription");
  }
  readonly usage = "rom-ann-import-names <rom>|<sidecar.dis> <list file> [-page <n>]";
  readonly argumentInfo: CommandArgumentInfo = {
    mandatory: [
      { name: "rom", type: "string" },
      { name: "list", type: "string" }
    ],
    namedOptions: [{ name: "-page", type: "number" }]
  };

  async validateCommandArgs(_context: IdeCommandContext, args: ImportNamesArgs): Promise<ValidationMessage[]> {
    const messages = await validateRom(args, true);
    if (!args.list?.trim()) messages.push(validationError(t("commands.romAnn.nameList")));
    return messages;
  }

  async execute(context: IdeCommandContext, args: ImportNamesArgs): Promise<IdeCommandResult> {
    const path = await sidecarPathOf(context, args);
    if (typeof path !== "string") return commandError(path.error);
    if (path.startsWith(`${SHIPPED_ROM_FOLDER}/`)) return commandError(t("commands.romAnn.shippedReadOnly"));
    const page = args["-page"] ?? 0;

    const resolvedList = resolveCommandFilePath(context, args.list!);
    if ("error" in resolvedList) return commandError(resolvedList.error);
    const listPath = resolvedList.path;
    const listText = await Promise.resolve(context.service.projectService.readFileContent(listPath, false))
      .then((text) => (typeof text === "string" ? text : undefined))
      .catch(() => undefined);
    if (listText === undefined) return commandError(t("commands.romAnn.cannotRead", { path: listPath }));
    const list = parseRomNameList(listText);
    if (list.problems.length > 0) {
      for (const problem of list.problems) writeMessage(context.output, `  ${problem}`, "yellow");
      return commandError(t("commands.romAnn.notList", { path: listPath }));
    }

    // --- Provenance lives only in the file, so the file is written first, with no write in flight
    await flushAnnotationSession(path);
    const text = await readText(context, path);
    if (text === undefined) {
      return commandError(t("commands.romAnn.noWorkingCopy", { path, rom: args.rom }));
    }
    const raw = JSON.parse(text);
    const matches = await matchRomPages({ files: context.mainApi, emuApi: context.emuApi }, path, raw.pages ?? {});
    const bytes = matches.find((m) => m.page === page)?.bytes;
    if (!bytes) return commandError(t("commands.romAnn.noMatch", { page: String(page), path }));

    const result = importRomNames(raw, page, bytes.length, list.entries);
    if (result.text) {
      await context.service.projectService.saveFileContent(path, result.text);
      // --- An open page document holds the model: hand it the new one, which writes the same file
      // --- again (the labels are already there, so they keep their `manual` provenance)
      if (peekAnnotationSession(path)) {
        const parsed = parseAnnotations(result.text);
        if (parsed.annotations) {
          updateAnnotationSession(path, parsed.annotations, context.service.projectService);
          await flushAnnotationSession(path);
        }
      }
      requestRomAnnotationsReload();
    }

    for (const skip of result.skipped) {
      writeMessage(
        context.output,
        t("commands.romAnn.skipped", { name: skip.name, address: toHex4(skip.address), reason: skip.reason }),
        "yellow"
      );
    }
    for (const entry of result.added.filter((item) => item.from)) {
      writeMessage(context.output, t("commands.romAnn.renamed", { from: entry.from, name: entry.name }));
    }
    if (result.text) {
      const check = await checkRomSidecar(
        result.text,
        (p) => matches.find((m) => m.page === p)?.bytes,
        inheritedSidecarSource({ files: context.mainApi, projectService: context.service.projectService })
      );
      for (const problem of check.problems) writeMessage(context.output, `  ${problem}`, "yellow");
    }
    writeSuccessMessage(
      context.output,
      t("commands.romAnn.imported", { added: result.added.length, path, skipped: result.skipped.length })
    );
    return commandSuccess;
  }
}

type ExportArgs = RomArgs & { file?: string; "-open"?: boolean };

/**
 * `rom-ann-export`: every page of a ROM's annotations as one Klive Z80 source file, assembled
 * afterwards and compared with the ROM (`romSourceExport.ts`) — always: the verdict is the
 * command's result, a success only when the bytes are identical. The ROM annotation editor's "Export
 * as source" runs the same export.
 */
export class RomAnnotationExportCommand extends IdeCommandBase<ExportArgs> {
  readonly id = "rom-ann-export";
  get description() {
    return t("commands.romAnn.exportDescription");
  }
  readonly usage = "rom-ann-export <rom>|<sidecar.dis> <file> [-page <n>] [-open]";
  readonly argumentInfo: CommandArgumentInfo = {
    mandatory: [
      { name: "rom", type: "string" },
      { name: "file", type: "string" }
    ],
    namedOptions: [{ name: "-page", type: "number" }],
    commandOptions: ["-open"]
  };

  async validateCommandArgs(_context: IdeCommandContext, args: ExportArgs): Promise<ValidationMessage[]> {
    const messages = await validateRom(args, true);
    if (!args.file?.trim()) messages.push(validationError(t("commands.romAnn.nameExportFile")));
    return messages;
  }

  async execute(context: IdeCommandContext, args: ExportArgs): Promise<IdeCommandResult> {
    const resolvedFile = resolveCommandFilePath(context, args.file!);
    if ("error" in resolvedFile) return commandError(resolvedFile.error);
    const file = resolvedFile.path;
    let path = await sidecarPathOf(context, args);
    if (typeof path !== "string") return commandError(path.error);

    // --- The file as an open page document last wrote it
    await flushAnnotationSession(path);
    let text = await readText(context, path);
    // --- A ROM with no working copy is exported from its shipped sidecar, as rom-ann-open shows it
    if (text === undefined && args.rom && !/\.dis$/i.test(args.rom)) {
      const target = await romTargetOf(context, args.rom, args["-page"] ?? 0);
      if (!("error" in target) && target.shippedSidecar) {
        path = `${SHIPPED_ROM_FOLDER}/${target.shippedSidecar}`;
        text = await readText(context, path);
      }
    }
    if (text === undefined) return commandError(t("commands.romAnn.cannotRead", { path }));
    const parsed = parseAnnotations(text);
    if (!parsed.annotations) {
      return commandError(t("commands.romAnn.invalidJson", { path, message: parsed.diagnostics[0]?.message ?? "" }));
    }
    const raw = JSON.parse(text);
    const matches = await matchRomPages({ files: context.mainApi, emuApi: context.emuApi }, path, raw.pages ?? {});

    let run;
    try {
      run = await runRomSourceExport(
        context.mainApi,
        { path, annotations: parsed.annotations, matches, inherited: inheritedSidecarSource({ files: context.mainApi, projectService: context.service.projectService }) },
        file
      );
    } catch (err) {
      return commandError(t("commands.romAnn.exportFailed", { message: err instanceof Error ? err.message : String(err) }));
    }
    writeSuccessMessage(context.output, t("commands.romAnn.exported", { path, file }));
    if (run.missingPages.length) {
      writeMessage(
        context.output,
        t("commands.romAnn.exportLeftOut", { count: run.missingPages.length, pages: run.missingPages.join(", ") }),
        "yellow"
      );
    }
    run.notes.forEach((note) => writeInfoMessage(context.output, note));
    if (args["-open"]) {
      const quoted = file.replace(/"/g, '\\"');
      await context.service.ideCommandsService.executeCommand(`nav "${quoted}"`);
    }
    const verdictText = romExportVerdictText(run.verdict);
    return run.verdict.kind === "identical"
      ? commandSuccessWith(verdictText, { identical: true, file })
      : commandError(verdictText);
  }
}

function toHex4(value: number): string {
  return value.toString(16).toUpperCase().padStart(4, "0");
}

