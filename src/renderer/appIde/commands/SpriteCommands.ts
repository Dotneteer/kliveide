import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import type { IdeCommandResult } from "@renderer/abstractions/IdeCommandResult";
import type { CommandArgumentInfo } from "@renderer/abstractions/IdeCommandInfo";

import { MI_ZXNEXT } from "@common/machines/constants";
import { SPRITES_PANEL_ID } from "@common/state/common-ids";
import { createSpecialDocument } from "@renderer/features/documents/specialDocuments";
import {
  requestSpriteReveal,
  type SpriteRevealRequest
} from "@renderer/features/sprites/spriteReveal";
import { serializeSprFile } from "@renderer/features/sprite-editor/sprite-file";
import {
  IdeCommandBase,
  commandError,
  commandSuccess,
  commandSuccessWith
} from "@renderer/appIde/services/ide-commands";

/*
 * The Sprite Inspector's commands (`.plans/SPRITE_INSPECTOR_PLAN.md` D11): two commands, one
 * document. Both open `$sprites`, each focused on its own view.
 */

async function openSpriteInspector(
  context: IdeCommandContext,
  request: SpriteRevealRequest
): Promise<IdeCommandResult> {
  const machineId = context.service.machineService.getMachineInfo()?.machine?.machineId;
  if (machineId !== MI_ZXNEXT) {
    return commandError("Hardware sprites exist on the ZX Spectrum Next only");
  }
  requestSpriteReveal(request);
  const documentHubService = context.service.projectService.getActiveDocumentHubService();
  if (documentHubService.isOpen(SPRITES_PANEL_ID)) {
    await documentHubService.setActiveDocument(SPRITES_PANEL_ID);
  } else {
    await documentHubService.openDocument(createSpecialDocument(SPRITES_PANEL_ID), undefined, false);
  }
  return commandSuccess;
}

/** `show-sprites [<index>]`: opens the Sprite Inspector on its Sprites view, selecting a sprite. */
export class ShowSpritesCommand extends IdeCommandBase<{ index?: number }> {
  readonly id = "show-sprites";
  readonly description = "Displays the Sprite Inspector's sprite table, optionally selecting a sprite";
  readonly usage = "show-sprites [<index>]";
  readonly aliases = ["shspr"];
  readonly argumentInfo: CommandArgumentInfo = {
    optional: [{ name: "index", type: "number", minValue: 0, maxValue: 127 }]
  };

  async execute(context: IdeCommandContext, args: { index?: number }): Promise<IdeCommandResult> {
    return openSpriteInspector(context, { view: "sprites", index: args?.index });
  }
}

/** `show-patterns [<index>]`: opens the Sprite Inspector on its Patterns view, selecting a pattern. */
export class ShowPatternsCommand extends IdeCommandBase<{ index?: number }> {
  readonly id = "show-patterns";
  readonly description =
    "Displays the Sprite Inspector's pattern memory, optionally selecting an 8-bit pattern (0-63)";
  readonly usage = "show-patterns [<index>]";
  readonly aliases = ["shpat"];
  readonly argumentInfo: CommandArgumentInfo = {
    optional: [{ name: "index", type: "number", minValue: 0, maxValue: 63 }]
  };

  async execute(context: IdeCommandContext, args: { index?: number }): Promise<IdeCommandResult> {
    return openSpriteInspector(context, { view: "patterns", index: args?.index });
  }
}

/**
 * The 16K pattern RAM as a `.spr` file: 64 8-bit patterns of 256 bytes. The bytes are the same
 * whatever format the Patterns view shows; a 4-bit pattern is half of one of these
 * (`.plans/SPRITE_INSPECTOR_PLAN.md` D15).
 */
export function patternRamAsSpr(patterns: Uint8Array): Uint8Array {
  return serializeSprFile(
    Array.from({ length: 64 }, (_, i) => patterns.subarray(i * 256, i * 256 + 256))
  );
}

const DEFAULT_EXPORT_NAME = "pattern-ram";

/**
 * `export-patterns [<file>] [-f] [-o]`: writes the ZX Spectrum Next's sprite pattern RAM to a `.spr`
 * file. A relative path is in the project folder; with no file, the next free `pattern-ram.spr`,
 * `pattern-ram-2.spr`, ... there. `-f` replaces an existing file; `-o` opens it in the sprite editor.
 */
export class ExportPatternsCommand extends IdeCommandBase<{
  file?: string;
  "-f"?: boolean;
  "-o"?: boolean;
}> {
  readonly id = "export-patterns";
  readonly description = "Exports the ZX Spectrum Next's sprite pattern RAM as a .spr file";
  readonly usage = "export-patterns [<file>] [-f] [-o]";
  readonly aliases = ["exppat"];
  readonly argumentInfo: CommandArgumentInfo = {
    optional: [{ name: "file", type: "string" }],
    commandOptions: ["-f", "-o"]
  };

  async execute(
    context: IdeCommandContext,
    args: { file?: string; "-f"?: boolean; "-o"?: boolean }
  ): Promise<IdeCommandResult> {
    const machineId = context.service.machineService.getMachineInfo()?.machine?.machineId;
    if (machineId !== MI_ZXNEXT) {
      return commandError("Hardware sprites exist on the ZX Spectrum Next only");
    }
    const folder = context.store.getState()?.project?.folderPath;
    const requested = args.file?.trim();
    if (requested && !/\.spr$/i.test(requested)) {
      return commandError("The file to write must be a .spr file.");
    }
    const isAbsolute = (p: string) => p.startsWith("/") || /^[a-zA-Z]:[\\/]/.test(p);
    if ((!requested || !isAbsolute(requested)) && !folder) {
      return commandError("No project is open: give an absolute .spr path.");
    }
    const inProject = (name: string) => (isAbsolute(name) ? name : `${folder}/${name}`);

    let file: string;
    if (requested) {
      file = inProject(requested);
      if (!args["-f"] && (await fileExists(context, file))) {
        return commandError(`${file} already exists; use -f to replace it.`);
      }
    } else {
      let n = 1;
      do {
        file = inProject(`${DEFAULT_EXPORT_NAME}${n === 1 ? "" : `-${n}`}.spr`);
        n++;
      } while (await fileExists(context, file));
    }

    let bytes: Uint8Array;
    try {
      bytes = patternRamAsSpr((await context.emuApi.getNextSpriteState()).patterns);
    } catch (err) {
      return commandError(`Could not read the pattern RAM: ${messageOf(err)}`);
    }
    try {
      await context.mainApi.saveBinaryFile(file, bytes);
    } catch (err) {
      return commandError(`Could not write ${file}: ${messageOf(err)}`);
    }

    if (args["-o"] && folder && file.startsWith(`${folder}/`)) {
      await openWhenListed(context, file);
    }
    return commandSuccessWith(`Pattern RAM (64 patterns) saved to ${file}.`, { file });
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

/** Opens a just-written project file once the explorer lists it (the folder watcher is async). */
async function openWhenListed(context: IdeCommandContext, file: string): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt++) {
    if (context.service.projectService.getNodeForFile(file)) {
      await context.service.ideCommandsService.executeCommand(`nav "${file}"`);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

function messageOf(err: unknown): string {
  const text = err instanceof Error ? err.message : String(err);
  return text.replace(/^(Error: )+/, "");
}
