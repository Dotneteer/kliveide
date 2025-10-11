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
import { WatchpointInfo } from "@common/state/AppState";
import { 
  addWatchpointAction, 
  removeWatchpointAction, 
  clearWatchpointsAction 
} from "@common/state/actions";

// --- Watchpoint type definitions
export type WatchpointType = "a" | "b" | "w" | "l" | "-w" | "-l" | "f" | "s";

type WatchpointSpecArgs = {
  watchpointSpec?: string;
  symbol?: string;
  type?: WatchpointType;
  length?: number;
};

type WatchpointSymbolArgs = {
  symbol: string;
};

/**
 * Base class for watchpoint commands with common validation logic
 */
abstract class WatchpointWithSpecCommand extends IdeCommandBase<WatchpointSpecArgs> {
  argumentInfo: CommandArgumentInfo = {
    mandatory: [
      {
        name: "watchpointSpec"
      }
    ]
  };

  async validateCommandArgs(
    _context: IdeCommandContext,
    args: WatchpointSpecArgs
  ): Promise<ValidationMessage[]> {
    const spec = args.watchpointSpec?.trim() ?? "";
    
    if (!spec) {
      return [validationError("Watchpoint specification cannot be empty")];
    }

    // Parse the watchpoint specification: <name>[:<type>[:<length>]]
    const parts = spec.split(":");
    if (parts.length < 1 || parts.length > 3) {
      return [validationError("Invalid watchpoint format. Use: <symbol>[:<type>[:<length>]]")];
    }

    const [symbol, type = "b", lengthStr] = parts;

    // Validate symbol name (basic identifier validation)
    if (!this.isValidSymbol(symbol)) {
      return [validationError("Invalid symbol name. Must be a valid identifier")];
    }

    // Validate type
    const validTypes: WatchpointType[] = ["a", "b", "w", "l", "-w", "-l", "f", "s"];
    if (!validTypes.includes(type as WatchpointType)) {
      return [validationError("Invalid type. Valid types: a, b, w, l, -w, -l, f, s")];
    }

    const watchpointType = type as WatchpointType;

    // Validate length specification
    let length: number | undefined;
    if (lengthStr !== undefined) {
      // Length is only allowed for array ("a") and string ("s") types
      if (watchpointType !== "a" && watchpointType !== "s") {
        return [validationError("Length specification is only allowed for array (a) and string (s) types")];
      }

      length = parseInt(lengthStr, 10);
      if (isNaN(length) || length <= 0 || length > 1024) {
        return [validationError("Length must be a positive number between 1 and 1024")];
      }
    } else {
      // Length is required for array and string types
      if (watchpointType === "a" || watchpointType === "s") {
        return [validationError("Length specification is required for array (a) and string (s) types")];
      }
    }

    // Store parsed values
    args.symbol = symbol;
    args.type = watchpointType;
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
 * Command to add a new watchpoint
 */
export class AddWatchpointCommand extends WatchpointWithSpecCommand {
  readonly id = "wp-add";
  readonly description = "Adds a watchpoint for a symbol";
  readonly usage = "wp-add <symbol>[:<type>[:<length>]]";
  readonly aliases = ["wp"];

  async execute(
    context: IdeCommandContext,
    args: WatchpointSpecArgs
  ): Promise<IdeCommandResult> {
    const watchpoint: WatchpointInfo = {
      symbol: args.symbol!,
      type: args.type!,
      length: args.length
    };

    // Add watchpoint to the Redux store
    context.store.dispatch(addWatchpointAction(watchpoint), "ide");
    
    let typeDesc = this.getTypeDescription(watchpoint.type);
    if (watchpoint.length) {
      typeDesc += ` (${watchpoint.length} bytes)`;
    }

    writeSuccessMessage(
      context.output,
      `Watchpoint added: ${watchpoint.symbol.toUpperCase()} [${typeDesc}]`
    );
    
    return commandSuccess;
  }

  private getTypeDescription(type: WatchpointType): string {
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
 * Command to remove a watchpoint by symbol name
 */
export class RemoveWatchpointCommand extends IdeCommandBase<WatchpointSymbolArgs> {
  readonly id = "wp-del";
  readonly description = "Removes a watchpoint by symbol name";
  readonly usage = "wp-del <symbol>";
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
    args: WatchpointSymbolArgs
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
    args: WatchpointSymbolArgs
  ): Promise<IdeCommandResult> {
    // Remove watchpoint from the Redux store
    context.store.dispatch(removeWatchpointAction(args.symbol), "ide");
    
    writeSuccessMessage(
      context.output,
      `Watchpoint removed: ${args.symbol.toUpperCase()}`
    );
    
    return commandSuccess;
  }
}

/**
 * Command to list all watchpoints
 */
export class ListWatchpointsCommand extends IdeCommandBase {
  readonly id = "wp-list";
  readonly description = "Lists all defined watchpoints";
  readonly usage = "wp-list";
  readonly aliases = ["wpl"];

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    // Retrieve watchpoints from Redux store
    const state = context.store.getState();
    const watchpoints = state.watchpoints || [];

    if (watchpoints.length === 0) {
      writeMessage(context.output, "No watchpoints defined", "bright-blue");
    } else {
      writeMessage(context.output, "Defined watchpoints:", "bright-blue");
      
      watchpoints.forEach((wp, idx) => {
        writeMessage(context.output, `[${idx + 1}]: `, "bright-blue", false);
        writeMessage(context.output, wp.symbol.toUpperCase(), "bright-magenta", false);
        writeMessage(context.output, ` (${this.getTypeDescription(wp.type)}`, "cyan", false);
        
        if (wp.length) {
          writeMessage(context.output, `, ${wp.length} bytes`, "cyan", false);
        }
        
        if (wp.address !== undefined) {
          writeMessage(context.output, `, addr: $${toHexa4(wp.address)}`, "yellow", false);
          if (wp.partition !== undefined) {
            writeMessage(context.output, `:${wp.partition}`, "yellow", false);
          }
        } else {
          writeMessage(context.output, `, unresolved`, "red", false);
        }
        
        writeMessage(context.output, ")", "cyan");
      });
      
      writeMessage(
        context.output,
        `${watchpoints.length} watchpoint${watchpoints.length !== 1 ? "s" : ""} defined`,
        "bright-blue"
      );
    }

    return commandSuccess;
  }

  private getTypeDescription(type: WatchpointType): string {
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
 * Command to erase all watchpoints
 */
export class EraseAllWatchpointsCommand extends IdeCommandBase {
  readonly id = "wp-ea";
  readonly description = "Erases all watchpoints";
  readonly usage = "wp-ea";
  readonly aliases = ["wea"];

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    // Get current watchpoint count before clearing
    const state = context.store.getState();
    const removedCount = state.watchpoints?.length || 0;
    
    // Clear all watchpoints from Redux store
    context.store.dispatch(clearWatchpointsAction(), "ide");
    
    writeMessage(
      context.output,
      `${removedCount} watchpoint${removedCount > 1 ? "s" : ""} removed.`,
      "green"
    );

    return commandSuccess;
  }
}