import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import type { IdeCommandResult } from "@renderer/abstractions/IdeCommandResult";
import type { ValidationMessage } from "@renderer/abstractions/ValidationMessage";
import type { CommandArgumentInfo } from "@renderer/abstractions/IdeCommandInfo";

import {
  writeMessage,
  commandSuccess,
  toHexa4,
  writeSuccessMessage,
  validationError,
  IdeCommandBase
} from "@renderer/appIde/services/ide-commands";
import { WatchInfo } from "@common/state/AppState";
import { addWatchAction, removeWatchAction, clearWatchAction } from "@common/state/actions";
import { saveProject } from "@renderer/appIde/utils/save-project";
import { t } from "@common/i18n/i18n";
import type { MessageKey } from "@common/i18n/keys.generated";

// --- Watch type definitions
export type WatchType = "a" | "b" | "w" | "l" | "-w" | "-l" | "f" | "s";

type WatchSpecArgs = {
  watchSpec?: string;
  symbol?: string;
  type?: WatchType;
  length?: number;
  direct?: boolean;
};

type WatchSymbolArgs = {
  symbol: string;
};

/** The catalog key of each watch type's description */
const WATCH_TYPE_KEYS: Record<WatchType, MessageKey> = {
  a: "commands.watch.type.array",
  b: "commands.watch.type.byte",
  w: "commands.watch.type.word",
  l: "commands.watch.type.long",
  "-w": "commands.watch.type.wordBe",
  "-l": "commands.watch.type.longBe",
  f: "commands.watch.type.flag",
  s: "commands.watch.type.string"
};

/** A watch type as `w-add` and `w-list` describe it */
function watchTypeDescription(type: WatchType): string {
  return t(WATCH_TYPE_KEYS[type] ?? "commands.watch.type.unknown");
}

/**
 * Writes the project file after a watch has been added, removed or cleared.
 *
 * Watches belong to the project, so every mutation persists — the same way the excluded-items
 * command does. Two details are deliberate:
 *
 * - **Not awaited.** `saveProject` sleeps a second before the IPC call, so awaiting it would stall
 *   every `w-add`/`w-del` (and the Watch panel's right-click delete, which runs `w-del`) for that
 *   whole second before the command reported success. Firing it off is safe for exactly the reasons
 *   `settings-utils.ts` gives where it does the same: `saveKliveProject` serializes its saves
 *   internally, so this one cannot be reordered against another, and it reports its own failures.
 * - **Unconditional.** `saveKliveProject` returns immediately when no project folder is open, so
 *   there is nothing to guard against on a bare machine.
 */
function persistWatches(context: IdeCommandContext): void {
  void saveProject(context.messenger);
}

/**
 * Base class for watch commands with common validation logic
 */
abstract class WatchWithSpecCommand extends IdeCommandBase<WatchSpecArgs> {
  argumentInfo: CommandArgumentInfo = {
    mandatory: [
      {
        name: "watchSpec"
      }
    ]
  };

  async validateCommandArgs(
    _context: IdeCommandContext,
    args: WatchSpecArgs
  ): Promise<ValidationMessage[]> {
    const spec = args.watchSpec?.trim() ?? "";

    if (!spec) {
      return [validationError(t("commands.watch.specEmpty"))];
    }

    // Check for optional direct flag ('>') at the beginning
    let direct = false;
    let specBody = spec;
    if (spec.startsWith(">")) {
      direct = true;
      specBody = spec.substring(1).trim();
      if (!specBody) {
        return [validationError(t("commands.watch.symbolEmptyAfterDirect"))];
      }
    }

    // Parse the watch specification: <name>[:<type>[:<length>]]
    const parts = specBody.split(":");
    if (parts.length < 1 || parts.length > 3) {
      return [validationError(t("commands.watch.invalidFormat"))];
    }

    const [symbol, type = "b", lengthStr] = parts;

    // Validate symbol name (basic identifier validation)
    if (!this.isValidSymbol(symbol)) {
      return [validationError(t("commands.watch.invalidSymbol"))];
    }

    // Validate type
    const validTypes: WatchType[] = ["a", "b", "w", "l", "-w", "-l", "f", "s"];
    if (!validTypes.includes(type as WatchType)) {
      return [validationError(t("commands.watch.invalidType"))];
    }

    const watchType = type as WatchType;

    // Validate length specification
    let length: number | undefined;
    if (lengthStr !== undefined) {
      // Length is only allowed for array ("a") and string ("s") types
      if (watchType !== "a" && watchType !== "s") {
        return [
          validationError(t("commands.watch.lengthNotAllowed"))
        ];
      }

      length = parseInt(lengthStr, 10);
      if (isNaN(length) || length <= 0 || length > 1024) {
        return [validationError(t("commands.watch.lengthRange"))];
      }
    } else {
      // Default length for array and string types when omitted
      if (watchType === "a" || watchType === "s") {
        length = 8;
      }
    }

    // Store parsed values
    args.symbol = symbol;
    args.type = watchType;
    args.length = length;
    args.direct = direct;

    return [];
  }

  private isValidSymbol(symbol: string): boolean {
    // Basic identifier validation: starts with letter or underscore, followed by letters, digits, or underscores
    const identifierRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
    return identifierRegex.test(symbol);
  }
}

/**
 * Command to add a new watch expression
 */
export class AddWatchCommand extends WatchWithSpecCommand {
  readonly id = "w-add";
  get description() {
    return t("commands.watch.add.description");
  }
  get usage(): string {
    return "w-add [>]<symbol>[:<type>[:<length>]]\n" + t("commands.usage.watchAdd.types");
  }
  readonly aliases = ["w"];

  async execute(context: IdeCommandContext, args: WatchSpecArgs): Promise<IdeCommandResult> {
    const watch: WatchInfo = {
      symbol: args.symbol!,
      type: args.type!,
      length: args.length,
      direct: args.direct
    };

    // Add watch to the Redux store
    context.store.dispatch(addWatchAction(watch), "ide");

    persistWatches(context);

    const symbol = watch.symbol.toUpperCase();
    const type = watchTypeDescription(watch.type);
    writeSuccessMessage(
      context.output,
      watch.length
        ? t("commands.watch.addedLength", { symbol, type, length: watch.length })
        : t("commands.watch.added", { symbol, type })
    );

    return commandSuccess;
  }

}

/**
 * Command to remove a watch expression by symbol name
 */
export class RemoveWatchCommand extends IdeCommandBase<WatchSymbolArgs> {
  readonly id = "w-del";
  get description() {
    return t("commands.watch.remove.description");
  }
  readonly usage = "w-del <symbol>";
  readonly aliases = ["wd"];

  readonly argumentInfo: CommandArgumentInfo = {
    mandatory: [
      {
        name: "symbol"
      }
    ]
  };

  async validateCommandArgs(
    _context: IdeCommandContext,
    args: WatchSymbolArgs
  ): Promise<ValidationMessage[]> {
    const symbol = args.symbol?.trim() ?? "";

    if (!symbol) {
      return [validationError(t("commands.watch.symbolEmpty"))];
    }

    // Basic identifier validation
    const identifierRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
    if (!identifierRegex.test(symbol)) {
      return [validationError(t("commands.watch.invalidSymbol"))];
    }

    return [];
  }

  async execute(context: IdeCommandContext, args: WatchSymbolArgs): Promise<IdeCommandResult> {
    // Remove watch from the Redux store
    context.store.dispatch(removeWatchAction(args.symbol), "ide");
    persistWatches(context);

    writeSuccessMessage(context.output, t("commands.watch.removed", { symbol: args.symbol.toUpperCase() }));

    return commandSuccess;
  }
}

/**
 * Command to list all watch expressions
 */
export class ListWatchCommand extends IdeCommandBase {
  readonly id = "w-list";
  get description() {
    return t("commands.watch.list.description");
  }
  readonly usage = "w-list";
  readonly aliases = ["wl"];

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    // Retrieve watch expressions from Redux store
    const state = context.store.getState();
    const watchExpressions = state.watchExpressions || [];
    // --- Named, not numbered: a partition printed as a raw index is not a notation any command
    // --- accepts back. Same reason `bp-list` needed fixing.
    const partitionLabels = await context.emuApi.getPartitionLabels();

    if (watchExpressions.length === 0) {
      writeMessage(context.output, t("commands.watch.list.none"), "bright-blue");
    } else {
      writeMessage(context.output, t("commands.watch.list.header"), "bright-blue");

      watchExpressions.forEach((w, idx) => {
        writeMessage(context.output, `[${idx + 1}]: `, "bright-blue", false);
        writeMessage(context.output, w.symbol.toUpperCase(), "bright-magenta", false);
        writeMessage(context.output, ` (${watchTypeDescription(w.type)}`, "cyan", false);

        if (w.length) {
          writeMessage(context.output, `, ${t("commands.watch.list.length", { length: w.length })}`, "cyan", false);
        }

        if (w.address !== undefined) {
          // --- `R0:$8000`, matching the order `bp-set` and the Breakpoints panel use. This used to
          // --- print the partition *after* the address, and as a raw index.
          const partition =
            w.partition !== undefined ? `${partitionLabels?.[w.partition] ?? "?"}:` : "";
          writeMessage(context.output, `, ${t("commands.watch.list.address", { address: `${partition}$${toHexa4(w.address)}` })}`, "yellow", false);
        } else {
          writeMessage(context.output, `, ${t("commands.watch.list.unresolved")}`, "red", false);
        }

        writeMessage(context.output, ")", "cyan");
      });

      writeMessage(
        context.output,
        t("commands.watch.list.count", { count: watchExpressions.length }),
        "bright-blue"
      );
    }

    return commandSuccess;
  }

}

/**
 * Command to erase all watch expressions
 */
export class EraseAllWatchCommand extends IdeCommandBase {
  readonly id = "w-ea";
  get description() {
    return t("commands.watch.eraseAll.description");
  }
  readonly usage = "w-ea";
  readonly aliases = ["wea"];

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    // Get current watch expression count before clearing
    const state = context.store.getState();
    const removedCount = state.watchExpressions?.length || 0;

    // Clear all watch expressions from Redux store
    context.store.dispatch(clearWatchAction(), "ide");
    persistWatches(context);

    writeMessage(
      context.output,
      t("commands.watch.eraseAll.done", { count: removedCount }),
      "green"
    );

    return commandSuccess;
  }
}
