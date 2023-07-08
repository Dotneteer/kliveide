import { EmuListBreakpointsResponse } from "@common/messaging/main-to-emu";
import { FlagResponse } from "@common/messaging/messages-core";
import { IdeCommandContext } from "../abstractions/IdeCommandContext";
import { IdeCommandResult } from "../abstractions/IdeCommandResult";
import { ValidationMessage } from "../abstractions/ValidationMessage";
import { Token } from "../services/command-parser";
import {
  writeMessage,
  commandSuccess,
  toHexa4,
  writeSuccessMessage,
  validationError,
  commandError
} from "../services/interactive-commands";
import { CommandWithAddressBase } from "./CommandWithAddressBase";
import { CommandWithNoArgBase } from "./CommandWithNoArgsBase";

export class EraseAllBreakpointsCommand extends CommandWithNoArgBase {
  readonly id = "bp-ea";
  readonly description = "Erase all breakpoints";
  readonly usage = "bp-ea";
  readonly aliases = ["eab"];

  async doExecute (
    context: IdeCommandContext
  ): Promise<IdeCommandResult> {
    const bps = (await context.messenger.sendMessage({
      type: "EmuListBreakpoints"
    })) as EmuListBreakpointsResponse;
    (await context.messenger.sendMessage({
      type: "EmuEraseAllBreakpoints"
    })) as EmuListBreakpointsResponse;
    const bpCount = bps.breakpoints.length;
    writeMessage(
      context.output,
      `${bpCount} breakpoint${bpCount > 1 ? "s" : ""} removed.`,
      "green"
    );
    return commandSuccess;
  }
}

export class ListBreakpointsCommand extends CommandWithNoArgBase {
  readonly id = "bp-list";
  readonly description = "Erase all breakpoints";
  readonly usage = "bp-list";
  readonly aliases = ["bpl"];

  async doExecute (
    context: IdeCommandContext
  ): Promise<IdeCommandResult> {
    const bps = (await context.messenger.sendMessage({
      type: "EmuListBreakpoints"
    })) as EmuListBreakpointsResponse;
    if (bps.breakpoints.length) {
      let ordered = bps.breakpoints.sort((a, b) => b.address - a.address);
      ordered.forEach((bp, idx) => {
        writeMessage(context.output, `[${idx + 1}]: `, "bright-blue", false);
        writeMessage(
          context.output,
          `$${toHexa4(bp.address)} ${`(${bp.address})`.padEnd(8, " ")}`,
          "bright-magenta",
          false
        );
        writeMessage(context.output, bp.disabled ? " <disabled>" : "", "cyan");
      });
      writeMessage(
        context.output,
        `${ordered.length} breakpoint${ordered.length > 1 ? "s" : ""} set`,
        "bright-blue"
      );
    } else {
      writeMessage(context.output, "No breakpoints set", "bright-blue");
    }
    return commandSuccess;
  }
}

export class SetBreakpointCommand extends CommandWithAddressBase {
  readonly id = "bp-set";
  readonly description = "Erase all breakpoints";
  readonly usage = "bp-set";
  readonly aliases = ["bp"];

  protected readonly extraArgCount = undefined;

  async doExecute (
    context: IdeCommandContext
  ): Promise<IdeCommandResult> {
    const response = (await context.messenger.sendMessage({
      type: "EmuSetBreakpoint",
      bp: this.address
    })) as FlagResponse;
    writeSuccessMessage(
      context.output,
      `Breakpoint at address $${toHexa4(this.address)} ${
        response.flag ? "set" : "updated"
      }`
    );
    return commandSuccess;
  }
}

export class RemoveBreakpointCommand extends CommandWithAddressBase {
  readonly id = "bp-del";
  readonly description = "Erase all breakpoints";
  readonly usage = "bp-del";
  readonly aliases = ["bd"];

  protected readonly extraArgCount = undefined;

  async doExecute (
    context: IdeCommandContext
  ): Promise<IdeCommandResult> {
    const response = (await context.messenger.sendMessage({
      type: "EmuRemoveBreakpoint",
      bp: this.address
    })) as FlagResponse;
    if (response.flag) {
      writeSuccessMessage(
        context.output,
        `Breakpoint at address $${toHexa4(this.address)} removed`
      );
    } else {
      writeSuccessMessage(
        context.output,
        `No breakpoint has been set at address $${toHexa4(this.address)}`
      );
    }
    return commandSuccess;
  }
}

export class EnableBreakpointCommand extends CommandWithAddressBase {
  readonly id = "bp-en";
  readonly description = "Erase all breakpoints";
  readonly usage = "bp-en";
  readonly aliases = ["be"];

  enable: boolean;

  protected readonly extraArgCount = undefined;

  async validateArgs (
    _args: Token[]
  ): Promise<ValidationMessage | ValidationMessage[]> {
    const result = await super.validateArgs(_args);
    if (!Array.isArray(result) || result.length > 0) return result;

    this.enable = true;
    if (_args.length > 2) {
      return validationError("This command expects up to 2 arguments");
    } else if (_args.length === 2) {
      // --- The second argument can be only "-d"
      if (_args[1].text !== "-d") {
        return validationError(`Invalid argument value: ${_args[1].text}`);
      }
      this.enable = false;
    }
    return [];
  }

  async doExecute (
    context: IdeCommandContext
  ): Promise<IdeCommandResult> {
    const response = (await context.messenger.sendMessage({
      type: "EmuEnableBreakpoint",
      address: this.address,
      enable: this.enable
    })) as FlagResponse;
    if (response.flag) {
      writeSuccessMessage(
        context.output,
        `Breakpoint at address $${toHexa4(this.address)} ${
          this.enable ? "enabled" : "disabled"
        }`
      );
    } else {
      return commandError(
        `Breakpoint at address $${toHexa4(
          this.address
        )} does not exist, so it cannot be enabled or disabled`
      );
    }
    return commandSuccess;
  }
}
