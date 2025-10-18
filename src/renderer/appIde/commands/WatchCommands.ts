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
import { 
  addWatchAction, 
  removeWatchAction, 
  clearWatchAction 
} from "@common/state/actions";

// --- Watch type definitions
export type WatchType = "a" | "b" | "w" | "l" | "-w" | "-l" | "f" | "s";

type WatchSpecArgs = {
  watchSpec?: string;
  symbol?: string;
  type?: WatchType;
  length?: number;
};

type WatchSymbolArgs = {
  symbol: string;
};

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
      return [validationError("Watch specification cannot be empty")];
    }

    // Parse the watch specification: <name>[:<type>[:<length>]]
    const parts = spec.split(":");
    if (parts.length < 1 || parts.length > 3) {
      return [validationError("Invalid watch format. Use: <symbol>[:<type>[:<length>]]")];
    }

    const [symbol, type = "b", lengthStr] = parts;

    // Validate symbol name (basic identifier validation)
    if (!this.isValidSymbol(symbol)) {
      return [validationError("Invalid symbol name. Must be a valid identifier")];
    }

    // Validate type
    const validTypes: WatchType[] = ["a", "b", "w", "l", "-w", "-l", "f", "s"];
    if (!validTypes.includes(type as WatchType)) {
      return [validationError("Invalid type. Valid types: a, b, w, l, -w, -l, f, s")];
    }

    const watchType = type as WatchType;

    // Validate length specification
    let length: number | undefined;
    if (lengthStr !== undefined) {
      // Length is only allowed for array ("a") and string ("s") types
      if (watchType !== "a" && watchType !== "s") {
        return [validationError("Length specification is only allowed for array (a) and string (s) types")];
      }

      length = parseInt(lengthStr, 10);
      if (isNaN(length) || length <= 0 || length > 1024) {
        return [validationError("Length must be a positive number between 1 and 1024")];
      }
    } else {
      // Length is required for array and string types
      if (watchType === "a" || watchType === "s") {
        return [validationError("Length specification is required for array (a) and string (s) types")];
      }
    }

    // Store parsed values
    args.symbol = symbol;
    args.type = watchType;
    args.length = length;

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
  readonly description = "Adds a watch expression for a symbol";
  readonly usage = "w-add <symbol>[:<type>[:<length>]]";
  readonly aliases = ["w"];

  async execute(
    context: IdeCommandContext,
    args: WatchSpecArgs
  ): Promise<IdeCommandResult> {
    const watch: WatchInfo = {
      symbol: args.symbol!,
      type: args.type!,
      length: args.length
    };

    // Add watch to the Redux store
    context.store.dispatch(addWatchAction(watch), "ide");
    
    let typeDesc = this.getTypeDescription(watch.type);
    if (watch.length) {
      typeDesc += ` (${watch.length} bytes)`;
    }

    writeSuccessMessage(
      context.output,
      `Watch added: ${watch.symbol.toUpperCase()} [${typeDesc}]`
    );
    
    return commandSuccess;
  }

  private getTypeDescription(type: WatchType): string {
    switch (type) {
      case "a": return "byte array";
      case "b": return "8-bit";
      case "w": return "16-bit little-endian";
      case "l": return "32-bit little-endian";
      case "-w": return "16-bit big-endian";
      case "-l": return "32-bit big-endian";
      case "f": return "flag";
      case "s": return "string";
      default: return "unknown";
    }
  }
}

/**
 * Command to remove a watch expression by symbol name
 */
export class RemoveWatchCommand extends IdeCommandBase<WatchSymbolArgs> {
  readonly id = "w-del";
  readonly description = "Removes a watch expression by symbol name";
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
      return [validationError("Symbol name cannot be empty")];
    }

    // Basic identifier validation
    const identifierRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
    if (!identifierRegex.test(symbol)) {
      return [validationError("Invalid symbol name. Must be a valid identifier")];
    }

    return [];
  }

  async execute(
    context: IdeCommandContext,
    args: WatchSymbolArgs
  ): Promise<IdeCommandResult> {
    // Remove watch from the Redux store
    context.store.dispatch(removeWatchAction(args.symbol), "ide");
    
    writeSuccessMessage(
      context.output,
      `Watch removed: ${args.symbol.toUpperCase()}`
    );
    
    return commandSuccess;
  }
}

/**
 * Command to list all watch expressions
 */
export class ListWatchCommand extends IdeCommandBase {
  readonly id = "w-list";
  readonly description = "Lists all defined watch expressions";
  readonly usage = "w-list";
  readonly aliases = ["wl"];

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    // Retrieve watch expressions from Redux store
    const state = context.store.getState();
    const watchExpressions = state.watchExpressions || [];

    if (watchExpressions.length === 0) {
      writeMessage(context.output, "No watch expressions defined", "bright-blue");
    } else {
      writeMessage(context.output, "Defined watch expressions:", "bright-blue");
      
      watchExpressions.forEach((w, idx) => {
        writeMessage(context.output, `[${idx + 1}]: `, "bright-blue", false);
        writeMessage(context.output, w.symbol.toUpperCase(), "bright-magenta", false);
        writeMessage(context.output, ` (${this.getTypeDescription(w.type)}`, "cyan", false);
        
        if (w.length) {
          writeMessage(context.output, `, ${w.length} bytes`, "cyan", false);
        }
        
        if (w.address !== undefined) {
          writeMessage(context.output, `, addr: $${toHexa4(w.address)}`, "yellow", false);
          if (w.partition !== undefined) {
            writeMessage(context.output, `:${w.partition}`, "yellow", false);
          }
        } else {
          writeMessage(context.output, `, unresolved`, "red", false);
        }
        
        writeMessage(context.output, ")", "cyan");
      });
      
      writeMessage(
        context.output,
        `${watchExpressions.length} watch expression${watchExpressions.length !== 1 ? "s" : ""} defined`,
        "bright-blue"
      );
    }

    return commandSuccess;
  }

  private getTypeDescription(type: WatchType): string {
    switch (type) {
      case "a": return "byte array";
      case "b": return "8-bit";
      case "w": return "16-bit little-endian";
      case "l": return "32-bit little-endian";
      case "-w": return "16-bit big-endian";
      case "-l": return "32-bit big-endian";
      case "f": return "flag";
      case "s": return "string";
      default: return "unknown";
    }
  }
}

/**
 * Command to erase all watch expressions
 */
export class EraseAllWatchCommand extends IdeCommandBase {
  readonly id = "w-ea";
  readonly description = "Erases all watch expressions";
  readonly usage = "w-ea";
  readonly aliases = ["wea"];

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    // Get current watch expression count before clearing
    const state = context.store.getState();
    const removedCount = state.watchExpressions?.length || 0;
    
    // Clear all watch expressions from Redux store
    context.store.dispatch(clearWatchAction(), "ide");
    
    writeMessage(
      context.output,
      `${removedCount} watch expression${removedCount > 1 ? "s" : ""} removed.`,
      "green"
    );

    return commandSuccess;
  }
}