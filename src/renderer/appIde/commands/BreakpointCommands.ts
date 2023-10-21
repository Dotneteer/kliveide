import { IdeCommandContext } from "../../abstractions/IdeCommandContext";
import { IdeCommandResult } from "../../abstractions/IdeCommandResult";
import { ValidationMessage } from "../../abstractions/ValidationMessage";
import {
  writeMessage,
  commandSuccess,
  toHexa4,
  writeSuccessMessage,
  validationError,
  commandError,
  IdeCommandBase,
  getPartitionedValue
} from "../services/ide-commands";
import { CommandWithNoArgBase } from "./CommandWithNoArgsBase";
import { getBreakpointKey } from "@common/utils/breakpoints";

export class EraseAllBreakpointsCommand extends CommandWithNoArgBase {
  readonly id = "bp-ea";
  readonly description = "Erase all breakpoints";
  readonly usage = "bp-ea";
  readonly aliases = ["eab"];

  async doExecute (context: IdeCommandContext): Promise<IdeCommandResult> {
    const bps = await context.messenger.sendMessage({
      type: "EmuListBreakpoints"
    });
    if (bps.type === "ErrorResponse") {
      return commandError(`EmuListBreakpoints call failed: ${bps.message}`);
    } else if (bps.type !== "EmuListBreakpointsResponse") {
      return commandError(`Unexpected message response type: '${bps.type}'`);
    } else {
      const eraseResp = await context.messenger.sendMessage({
        type: "EmuEraseAllBreakpoints"
      });
      if (eraseResp.type === "ErrorResponse") {
        return commandError(
          `EmuEraseAllBreakpoints call failed: ${eraseResp.message}`
        );
      }
      if (eraseResp.type !== "EmuListBreakpointsResponse") {
        return commandError(
          `Unexpected message response type: '${eraseResp.type}'`
        );
      }
      const bpCount = bps.breakpoints.length;
      writeMessage(
        context.output,
        `${bpCount} breakpoint${bpCount > 1 ? "s" : ""} removed.`,
        "green"
      );
    }
    return commandSuccess;
  }
}

export class ListBreakpointsCommand extends CommandWithNoArgBase {
  readonly id = "bp-list";
  readonly description = "Lists all breakpoints";
  readonly usage = "bp-list";
  readonly aliases = ["bpl"];

  async doExecute (context: IdeCommandContext): Promise<IdeCommandResult> {
    const bps = await context.messenger.sendMessage({
      type: "EmuListBreakpoints"
    });
    if (bps.type === "ErrorResponse") {
      return commandError(`EmuListBreakpoints call failed: ${bps.message}`);
    }
    if (bps.type !== "EmuListBreakpointsResponse") {
      return commandError(`Unexpected message response type: '${bps.type}'`);
    }
    if (bps.breakpoints.length) {
      let ordered = bps.breakpoints;
      ordered.forEach((bp, idx) => {
        let addrKey = getBreakpointKey(bp);
        if (addrKey.startsWith("[")) {
          `${addrKey} `;
        } else {
          `$${toHexa4(bp.address)} ${`(${bp.address})`.padEnd(8, " ")}`;
        }
        writeMessage(context.output, `[${idx + 1}]: `, "bright-blue", false);
        writeMessage(context.output, addrKey, "bright-magenta", false);
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

abstract class BreakpointWithAddressCommand extends IdeCommandBase {
  protected address?: number;
  protected partition?: number;
  protected resource?: string;
  protected line?: number;

  prepareCommand (): void {
    this.address = this.resource = this.line = undefined;
  }

  async validateArgs (
    context: IdeCommandContext
  ): Promise<ValidationMessage | ValidationMessage[]> {
    if (context.argTokens.length < 1) {
      return validationError("This command expects at least one argument");
    }

    const token = context.argTokens[0];
    const addrArg = token.text.trim();
    if (addrArg.startsWith("[")) {
      const addrInfo =
        context.service.projectService.getBreakpointAddressInfo(addrArg);
      if (!addrInfo) {
        return validationError(`Invalid breakpoint address ${addrArg}`);
      }

      this.resource = addrInfo.resource;
      this.line = addrInfo.line;
    } else {
      // --- Address resource
      const { value, partition, partitionType, messages } =
        getPartitionedValue(token);
      if (value === null) {
        return messages;
      }
      if (value < 0 || value > 0x1_0000) {
        return validationError(
          `Argument value must be between ${0} and ${0x1_0000}`
        );
      }

      // --- Test partition validity
      this.address = value;
      this.partition = partitionType === "R" ? -(partition + 1) : partition;
      if (partition !== undefined) {
        const roms = context.machineInfo.roms ?? 0;
        const banks = context.machineInfo.banks ?? 0;
        if (
          (roms === 0 && this.partition < 0) ||
          (banks === 0 && this.partition >= 0)
        ) {
          return validationError(
            `The current machine (${context.machineInfo.machineId}) does not support memory pages`
          );
        }
        if (
          (this.partition < 0 && this.partition < -roms) ||
          (this.partition >= 0 && this.partition > banks)
        ) {
          return validationError(
            `Invalid partition (${
              partitionType === "R" ? "R" : ""
            }${partition}) for the current machine (${
              context.machineInfo.machineId
            })`
          );
        }
      }
    }
    return [];
  }
}

export class SetBreakpointCommand extends BreakpointWithAddressCommand {
  readonly id = "bp-set";
  readonly description = "Sets a breakpoint at the specified address";
  readonly usage = "bp-set <address>";
  readonly aliases = ["bp"];

  async doExecute (context: IdeCommandContext): Promise<IdeCommandResult> {
    const response = await context.messenger.sendMessage({
      type: "EmuSetBreakpoint",
      breakpoint: {
        address: this.address,
        resource: this.resource,
        partition: this.partition,
        line: this.line,
        exec: true
      }
    });
    if (response.type === "ErrorResponse") {
      return commandError(response.message);
    }
    if (response.type !== "FlagResponse") {
      return commandError(`Invalid response type: '${response.type}'`);
    }
    let addrKey = getBreakpointKey({
      address: this.address,
      partition: this.partition,
      resource: this.resource,
      line: this.line
    });
    writeSuccessMessage(
      context.output,
      `Breakpoint at address ${addrKey} ${response.flag ? "set" : "updated"}`
    );
    return commandSuccess;
  }
}

export class RemoveBreakpointCommand extends BreakpointWithAddressCommand {
  readonly id = "bp-del";
  readonly description = "Removes the breakpoint from the specified address";
  readonly usage = "bp-del <address>";
  readonly aliases = ["bd"];

  async doExecute (context: IdeCommandContext): Promise<IdeCommandResult> {
    const response = await context.messenger.sendMessage({
      type: "EmuRemoveBreakpoint",
      breakpoint: {
        address: this.address,
        partition: this.partition,
        resource: this.resource,
        line: this.line,
        exec: true
      }
    });
    if (response.type === "ErrorResponse") {
      return commandError(response.message);
    }
    if (response.type !== "FlagResponse") {
      return commandError(`Invalid response type: '${response.type}'`);
    }
    let addrKey = getBreakpointKey({
      address: this.address,
      partition: this.partition,
      resource: this.resource,
      line: this.line
    });
    if (response.flag) {
      writeSuccessMessage(
        context.output,
        `Breakpoint at address ${addrKey} removed`
      );
    } else {
      writeSuccessMessage(
        context.output,
        `No breakpoint has been set at address ${addrKey}`
      );
    }
    return commandSuccess;
  }
}

export class EnableBreakpointCommand extends BreakpointWithAddressCommand {
  readonly id = "bp-en";
  readonly description = "Enables/disables a breakpoint";
  readonly usage = "bp-en <address> [-d]";
  readonly aliases = ["be"];

  enable: boolean;

  async validateArgs (
    context: IdeCommandContext
  ): Promise<ValidationMessage | ValidationMessage[]> {
    const result = await super.validateArgs(context);
    if (!Array.isArray(result) || result.length > 0) return result;

    this.enable = true;
    const args = context.argTokens;
    if (args.length > 2) {
      return validationError("This command expects up to 2 arguments");
    } else if (args.length === 2) {
      // --- The second argument can be only "-d"
      if (args[1].text !== "-d") {
        return validationError(`Invalid argument value: ${args[1].text}`);
      }
      this.enable = false;
    }
    return [];
  }

  async doExecute (context: IdeCommandContext): Promise<IdeCommandResult> {
    const response = await context.messenger.sendMessage({
      type: "EmuEnableBreakpoint",
      breakpoint: {
        address: this.address,
        partition: this.partition,
        resource: this.resource,
        line: this.line,
        exec: true
      },
      enable: this.enable
    });
    if (response.type === "ErrorResponse") {
      return commandError(response.message);
    }
    if (response.type !== "FlagResponse") {
      return commandError(`Invalid response type: '${response.type}'`);
    }
    let addrKey = getBreakpointKey({
      address: this.address,
      partition: this.partition,
      resource: this.resource,
      line: this.line
    });
    if (response.flag) {
      writeSuccessMessage(
        context.output,
        `Breakpoint at address ${addrKey} ${
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
