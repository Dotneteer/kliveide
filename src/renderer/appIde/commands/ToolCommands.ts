import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import type { IdeCommandResult } from "@renderer/abstractions/IdeCommandResult";

import {
  IdeCommandBase,
  commandError,
  commandSuccess,
  writeSuccessMessage
} from "@renderer/appIde/services/ide-commands";
import { outputPaneRegistry } from "@renderer/registry";
import {
  MEMORY_PANEL_ID,
  DISASSEMBLY_PANEL_ID
} from "@common/state/common-ids";
import { CommandArgumentInfo } from "@renderer/abstractions/IdeCommandInfo";
import { SETTING_IDE_ACTIVE_OUTPUT_PANE, SETTING_IDE_ACTIVE_TOOL, SETTING_IDE_SHOW_TOOLS } from "@common/settings/setting-const";
import { createSpecialDocument } from "@renderer/features/documents/specialDocuments";
import { revealWhenMounted } from "@renderer/appIde/navigation/addressNavigationAdapters";
import { t } from "@common/i18n/i18n";
import type { NavigationLocator } from "@renderer/abstractions/NavigationLocation";
import { parseGoToTarget, GO_TO_ERROR_KEYS } from "@renderer/features/memoryMap/goToTarget";
import { cpuAddressOf } from "@renderer/features/memoryMap/memoryMapModel";
import { buildLabelsOfCompilation } from "@renderer/appIde/annotations/symbolResolver";
import { annotationRoutineLabelsForState } from "@renderer/appIde/annotations/useAddressSymbols";

/**
 * Where `show-memory <target>` and `show-disass <target>` go (`dev/plans/MEMORY_DISASSEMBLY_VIEWS_PLAN.md`
 * phase 6): the views' Go to language - a number (decimal, or `$`/`0x`/`%` as everywhere in the
 * command prompt), a register, a label, or `PART:offset` in the breakpoint syntax.
 * @returns The locator to reveal, or the message saying why there is none
 */
async function resolveViewTarget(
  context: IdeCommandContext,
  text: string,
  view: "memory" | "disassembly"
): Promise<{ locator: NavigationLocator } | { error: string }> {
  const emuApi = context.emuApi;
  const [labels, info, contents] = await Promise.all([
    emuApi.getPartitionLabels().catch(() => ({}) as Record<number, string>),
    emuApi.getPartitionInfo().catch(() => undefined),
    emuApi.getMemoryContents().catch(() => undefined)
  ]);
  const state = context.store.getState();
  const named = [
    ...buildLabelsOfCompilation(state.compilation?.result, state.emulatorState?.machineId),
    ...(() => {
      try {
        return annotationRoutineLabelsForState(state);
      } catch {
        return [];
      }
    })()
  ];
  const size = (id: number) => info?.partitions.find((p) => p.id === id)?.size;
  const registers = contents
    ? { PC: contents.pc, SP: contents.sp, HL: contents.hl, DE: contents.de, BC: contents.bc, IX: contents.ix, IY: contents.iy }
    : undefined;
  const result = parseGoToTarget(text, {
    decimal: true,
    registers,
    partitionLabels: labels,
    partitionSize: size,
    slotPartitions: contents?.slotPartitions,
    labels: named
  });
  if ("error" in result) {
    return { error: result.error === "empty" ? t(GO_TO_ERROR_KEYS.unknown) : t(GO_TO_ERROR_KEYS[result.error]) };
  }
  const target = result.target;
  if (target.kind === "address") {
    return { locator: { kind: "address", address: target.address & 0xffff, fullView: true } };
  }
  if (view === "memory") {
    return { locator: { kind: "address", address: target.offset, segment: target.partition, fullView: false } };
  }
  // --- The Disassembly view lists a partition at an Origin: where it is paged in, else $0000
  const paged = cpuAddressOf(contents?.slotPartitions, target.partition, 0, size(target.partition) ?? 0x4000);
  const base = paged !== undefined ? paged & 0xe000 : 0;
  return {
    locator: { kind: "address", address: (base + target.offset) & 0xffff, segment: target.partition, fullView: false, base }
  };
}

type SelectOutputArgs = {
  paneId: string;
};

export class SelectOutputPaneCommand extends IdeCommandBase<SelectOutputArgs> {
  readonly id = "outp";
  get description() {
    return t("commands.outp.description");
  }
  readonly usage = "outp <paneId>";
  readonly argumentInfo?: CommandArgumentInfo = {
    mandatory: [{ name: "paneId" }]
  };

  async execute(context: IdeCommandContext, args: SelectOutputArgs): Promise<IdeCommandResult> {
    // --- Check if the specified panel exists
    if (!outputPaneRegistry.find((p) => p.id === args.paneId)) {
      return commandError(t("commands.outp.unknown", { id: args.paneId }));
    }

    // --- Select the panel
    await context.mainApi.setGlobalSettingsValue(SETTING_IDE_SHOW_TOOLS, true);
    await context.mainApi.setGlobalSettingsValue(SETTING_IDE_ACTIVE_OUTPUT_PANE, args.paneId);
    await context.mainApi.setGlobalSettingsValue(SETTING_IDE_ACTIVE_TOOL, "output");

    // --- Done.
    writeSuccessMessage(context.output, t("commands.outp.displayed", { id: args.paneId }));
    return commandSuccess;
  }
}

/**
 * `show-memory [<address>]`: displays the machine memory panel and, with an address, reveals it there
 * (in the 64K view) — the sibling of `show-disass <address>` the graphics finder's *Show in memory*
 * runs (`dev/patterns/reverse-engineering-tools.md`, "Graphics finder").
 */
export class ShowMemoryCommand extends IdeCommandBase<{ address?: string }> {
  readonly id = "show-memory";
  get description() {
    return t("commands.memoryPanel.showDescription");
  }
  readonly usage = "show-memory [<address> | <label> | <register> | <partition>:<offset>]";
  readonly aliases = ["shmem"];
  readonly argumentInfo: CommandArgumentInfo = {
    optional: [{ name: "address", type: "string" }]
  };

  async execute(context: IdeCommandContext, args?: { address?: string }): Promise<IdeCommandResult> {
    const target = args?.address !== undefined ? await resolveViewTarget(context, args.address, "memory") : undefined;
    if (target && "error" in target) return commandError(target.error);
    const documentHubService = context.service.projectService.getActiveDocumentHubService();
    if (documentHubService.isOpen(MEMORY_PANEL_ID)) {
      await documentHubService.setActiveDocument(MEMORY_PANEL_ID);
    } else {
      await documentHubService.openDocument(
        createSpecialDocument(MEMORY_PANEL_ID),
        undefined,
        false
      );
    }
    if (target && "locator" in target) {
      await revealWhenMounted(documentHubService, MEMORY_PANEL_ID, target.locator);
    }
    return commandSuccess;
  }
}

export class HideMemoryCommand extends IdeCommandBase {
  readonly id = "hide-memory";
  get description() {
    return t("commands.memoryPanel.hideDescription");
  }
  readonly usage = "hide-memory";
  readonly aliases = ["hmem"];

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    const documentHubService = context.service.projectService.getActiveDocumentHubService();
    await documentHubService.closeDocument(MEMORY_PANEL_ID);
    return commandSuccess;
  }
}

/**
 * `show-disass [<address>]`: displays the live disassembly panel and, with an address, reveals it
 * there (in the 64K view). The reusable "Show in Disassembly" entry point: any view that knows an
 * address runs this command (`dev/plans/ASSERTIONS_WATCHPOINTS_ONE_SHOT_PLAN.md` §4.8).
 */
export class ShowDisassemblyCommand extends IdeCommandBase<{ address?: string }> {
  readonly id = "show-disass";
  get description() {
    return t("commands.disass.showDescription");
  }
  readonly usage = "show-disass [<address> | <label> | <register> | <partition>:<offset>]";
  readonly aliases = ["shdis"];
  readonly argumentInfo: CommandArgumentInfo = {
    optional: [{ name: "address", type: "string" }]
  };

  async execute(context: IdeCommandContext, args: { address?: string }): Promise<IdeCommandResult> {
    const target = args?.address !== undefined ? await resolveViewTarget(context, args.address, "disassembly") : undefined;
    if (target && "error" in target) return commandError(target.error);
    const documentHubService = context.service.projectService.getActiveDocumentHubService();
    if (documentHubService.isOpen(DISASSEMBLY_PANEL_ID)) {
      await documentHubService.setActiveDocument(DISASSEMBLY_PANEL_ID);
    } else {
      await documentHubService.openDocument(
        createSpecialDocument(DISASSEMBLY_PANEL_ID),
        undefined,
        false
      );
    }
    if (target && "locator" in target) {
      await revealWhenMounted(documentHubService, DISASSEMBLY_PANEL_ID, target.locator);
    }
    return commandSuccess;
  }
}

export class HideDisassemblyCommand extends IdeCommandBase {
  readonly id = "hide-disass";
  get description() {
    return t("commands.disass.hideDescription");
  }
  readonly usage = "hide-disass";
  readonly aliases = ["hdis"];

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    const documentHubService = context.service.projectService.getActiveDocumentHubService();
    await documentHubService.closeDocument(DISASSEMBLY_PANEL_ID);
    return commandSuccess;
  }
}
