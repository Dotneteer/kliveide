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
import { flushAnnotationSession } from "@renderer/appIde/annotations/annotationSession";
import {
  commandError,
  commandSuccess,
  commandSuccessWith,
  IdeCommandBase,
  validationError,
  writeMessage,
  writeSuccessMessage
} from "../services/ide-commands";

/*
 * The `rom-ann-*` commands (`.plans/ROM_ANNOTATION_EDITING_PLAN.md` R7, R8).
 *
 * A ROM is named as Klive ships it (`sp48.rom`, `sp128-1.rom`), or by the path of a ROM file
 * (absolute, or relative to the open project). A multi-page file takes `-page <n>`.
 */

/** A path relative to the open project's folder, as the other file commands take them. */
function resolvePath(context: IdeCommandContext, file: string): string {
  const trimmed = file.trim();
  const folder = context.store.getState().project?.folderPath;
  const isAbsolute = /^([A-Za-z]:)?[\\/]/.test(trimmed);
  return isAbsolute || !folder ? trimmed : `${folder.replace(/[\\/]+$/, "")}/${trimmed}`;
}

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
  } else {
    path = resolvePath(context, rom);
  }
  if (!bytes) {
    path = resolvePath(context, rom);
    bytes = await mainApi.readBinaryFile(path).catch(() => undefined);
  }
  if (!bytes) return { error: `${rom} is neither a ROM Klive ships nor a ROM file that can be read.` };
  const pageBytes = pageOf(bytes, page);
  if (!pageBytes) return { error: `${rom} has no page ${page}.` };

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
  if (!info) throw new Error("This ROM page has not been identified yet.");
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
  if (mandatory && !args.rom?.trim()) messages.push(validationError("Name a ROM (sp48.rom) or a ROM file."));
  const page = args["-page"];
  if (page !== undefined && (!Number.isInteger(page) || page < 0 || page > 15)) {
    messages.push(validationError("-page: a page number from 0 to 15"));
  }
  return messages;
}

export class RomAnnotationNewCommand extends IdeCommandBase<RomArgs> {
  readonly id = "rom-ann-new";
  readonly description =
    "Makes a working copy of a ROM's annotations (in <Klive home>/RomAnnotations) and opens it for editing";
  readonly usage = "rom-ann-new <rom> [-page <n>]";
  readonly argumentInfo = ROM_ARGUMENTS;

  validateCommandArgs(_context: IdeCommandContext, args: RomArgs): Promise<ValidationMessage[]> {
    return validateRom(args, true);
  }

  async execute(context: IdeCommandContext, args: RomArgs): Promise<IdeCommandResult> {
    const target = await romTargetOf(context, args.rom!, args["-page"] ?? 0);
    if ("error" in target) return commandError(target.error);
    const result = await createWorkingCopy(context.mainApi, context.service.projectService, target);
    if ("reason" in result) return commandError(`${result.reason} Open it with rom-ann-open ${args.rom}.`);
    requestRomAnnotationsReload();
    await openRomAnnotationEditor(context.service.projectService.getActiveDocumentHubService(), result.path);
    return commandSuccessWith(
      result.from === "shipped"
        ? `Copied the shipped ${target.shippedSidecar} to ${result.path}. Its ROM pages are now edited there.`
        : `Created ${result.path}, an empty sidecar for ${target.romName}. Its ROM page is now edited there.`
    );
  }
}

export class RomAnnotationOpenCommand extends IdeCommandBase<RomArgs> {
  readonly id = "rom-ann-open";
  readonly description =
    "Opens a ROM's annotations in the ROM annotation editor: its working copy, or the shipped sidecar read-only";
  readonly usage = "rom-ann-open <rom>|<sidecar.dis> [-page <n>]";
  readonly argumentInfo = ROM_ARGUMENTS;

  validateCommandArgs(_context: IdeCommandContext, args: RomArgs): Promise<ValidationMessage[]> {
    return validateRom(args, true);
  }

  async execute(context: IdeCommandContext, args: RomArgs): Promise<IdeCommandResult> {
    const hub = context.service.projectService.getActiveDocumentHubService();
    if (/\.dis$/i.test(args.rom!)) {
      await openRomAnnotationEditor(hub, resolvePath(context, args.rom!));
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
        `${target.shippedSidecar} opened read-only. rom-ann-new ${args.rom} makes a working copy to edit.`
      );
    }
    return commandError(`${args.rom} has no annotations yet. rom-ann-new ${args.rom} creates them.`);
  }
}

/** The sidecar a `rom-ann-check` / `rom-ann-provenance` argument names. */
async function sidecarPathOf(context: IdeCommandContext, args: RomArgs): Promise<string | { error: string }> {
  if (args.rom && /\.dis$/i.test(args.rom)) return resolvePath(context, args.rom);
  if (!args.rom) return { error: "Name a ROM (sp48.rom), a ROM file or a sidecar." };
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
  readonly description =
    "Checks whether a ROM's working copy could be copied into src/public/roms as it is (the checks CI makes)";
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
    if (text === undefined) return commandError(`${path} cannot be read. rom-ann-new makes a working copy.`);
    let raw: Record<string, any>;
    try {
      raw = JSON.parse(text);
    } catch (err) {
      return commandError(`${path} is not valid JSON: ${(err as Error).message}`);
    }
    const matches = await matchRomPages({ files: context.mainApi, emuApi: context.emuApi }, path, raw.pages ?? {});
    const check = await checkRomSidecar(text, (page) => matches.find((m) => m.page === page)?.bytes);
    const levels = Object.entries(check.levels)
      .map(([page, level]) => `page ${page}: level ${level}`)
      .join(", ");
    writeMessage(context.output, `${path} (${levels || "no page measured"}; records level ${check.recordedLevel})`, "cyan");
    if (check.problems.length === 0) {
      writeSuccessMessage(context.output, "Ready to ship: copy it into src/public/roms/ unchanged.");
      return commandSuccess;
    }
    for (const problem of check.problems) writeMessage(context.output, `  ${problem}`, "yellow");
    return commandError(`${check.problems.length} problem(s) keep it from being shipped as it is.`);
  }
}

type ProvenanceArgs = RomArgs & { offset?: number; kind?: string; provenance?: string };

export class RomAnnotationProvenanceCommand extends IdeCommandBase<ProvenanceArgs> {
  readonly id = "rom-ann-provenance";
  readonly description =
    "Sets the provenance (observed or manual) of a label, line comment or region in a ROM's working copy";
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
      messages.push(validationError("The entry kind is label, line or region."));
    }
    if (!["observed", "manual"].includes(String(args.provenance))) {
      messages.push(validationError("The provenance is observed or manual (derived is the formatter's)."));
    }
    return messages;
  }

  async execute(context: IdeCommandContext, args: ProvenanceArgs): Promise<IdeCommandResult> {
    const path = await sidecarPathOf(context, args);
    if (typeof path !== "string") return commandError(path.error);
    if (path.startsWith(`${SHIPPED_ROM_FOLDER}/`)) return commandError("A shipped sidecar is never edited here.");
    // --- Provenance is not in the model: the file is the only copy, so no write may be in flight
    await flushAnnotationSession(path);
    const text = await readText(context, path);
    if (text === undefined) return commandError(`${path} cannot be read.`);
    const raw = JSON.parse(text);
    const page = args["-page"] ?? 0;
    const key = `${page}:${args.offset}:${args.kind}`;
    const next = withProvenance(raw, key, args.provenance as Exclude<Provenance, "derived">);
    if (!next) return commandError(`${path} has no ${args.kind} at page ${page}, offset ${args.offset}.`);
    await context.service.projectService.saveFileContent(path, formatRomSidecar(next));
    return commandSuccessWith(`${key} is now ${args.provenance}.`);
  }
}
