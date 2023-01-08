import { EmuListBreakpointsResponse } from "@messaging/main-to-emu";
import { FlagResponse } from "@messaging/messages-core";
import {
  InteractiveCommandContext,
  InteractiveCommandResult
} from "../abstractions";
import {
  commandSuccess,
  toHexa4,
  writeMessage,
  writeSuccessMessage
} from "../services/interactive-commands";
import { CommandWithNoArgBase } from "./CommandWithNoArgsBase";
import { CommandWithSingleIntegerBase } from "./CommandWithSingleIntegerBase";

export class EraseAllBreakpointsCommand extends CommandWithNoArgBase {
  readonly id = "bp-ea";
  readonly description = "Erase all breakpoints";
  readonly usage = "bp-ea";
  readonly aliases = ["eab"];

  async doExecute (
    context: InteractiveCommandContext
  ): Promise<InteractiveCommandResult> {
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
    context: InteractiveCommandContext
  ): Promise<InteractiveCommandResult> {
    const bps = (await context.messenger.sendMessage({
      type: "EmuListBreakpoints"
    })) as EmuListBreakpointsResponse;
    if (bps.breakpoints.length) {
      let ordered = bps.breakpoints.sort((a, b) => b.address - a.address);
      ordered.forEach((bp, idx) => {
        writeMessage(context.output, `[${idx + 1}]: `, "bright-blue", false);
        writeMessage(
          context.output,
          `$${toHexa4(bp.address)} (${bp.address})`,
          "bright-magenta"
        );
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

export class SetBreakpointCommand extends CommandWithSingleIntegerBase {
  readonly id = "bp-set";
  readonly description = "Erase all breakpoints";
  readonly usage = "bp-set";
  readonly aliases = ["bp"];

  protected readonly minValue = 0;
  protected readonly maxValue = 65535;

  async doExecute (
    context: InteractiveCommandContext
  ): Promise<InteractiveCommandResult> {
    const response = (await context.messenger.sendMessage({
      type: "EmuSetBreakpoint",
      bp: this.arg
    })) as FlagResponse;
    writeSuccessMessage(
      context.output,
      `Breakpoint at address $${toHexa4(this.arg)} ${
        response.flag ? "set" : "updated"
      }`
    );
    return commandSuccess;
  }
}

export class RemoveBreakpointCommand extends CommandWithSingleIntegerBase {
  readonly id = "bp-del";
  readonly description = "Erase all breakpoints";
  readonly usage = "bp-del";
  readonly aliases = ["bd"];

  protected readonly minValue = 0;
  protected readonly maxValue = 65535;

  async doExecute (
    context: InteractiveCommandContext
  ): Promise<InteractiveCommandResult> {
    const response = (await context.messenger.sendMessage({
      type: "EmuRemoveBreakpoint",
      bp: this.arg
    })) as FlagResponse;
    if (response.flag) {
      writeSuccessMessage(
        context.output,
        `Breakpoint at address $${toHexa4(this.arg)} removed`
      );
    } else {
      writeSuccessMessage(
        context.output,
        `No breakpoint has been set at address $${toHexa4(this.arg)}`
      );
    }
    return commandSuccess;
  }
}
