import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import type { IdeCommandResult } from "@renderer/abstractions/IdeCommandResult";
import type { ValidationMessage } from "@renderer/abstractions/ValidationMessage";
import type { CommandArgumentInfo } from "@renderer/abstractions/IdeCommandInfo";

import { ValidationMessageType } from "@renderer/abstractions/ValidationMessageType";
import {
  writeMessage,
  commandSuccess,
  toHexa4,
  writeSuccessMessage,
  validationError,
  commandError,
  IdeCommandBase,
  getNumericTokenValue
} from "@renderer/appIde/services/ide-commands";
import { getBreakpointKey } from "@common/utils/breakpoints";
import { parseCommand, TokenType } from "@renderer/appIde/services/command-parser";
import { MF_BANK, MF_ROM } from "@common/machines/constants";
import { createEmuApi } from "@common/messaging/EmuApi";

export class EraseAllBreakpointsCommand extends IdeCommandBase {
  readonly id = "bp-ea";
  readonly description = "Erase all breakpoints";
  readonly usage = "bp-ea";
  readonly aliases = ["eab"];

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    const bps = await context.emuApi.listBreakpoints();
    await context.emuApi.eraseAllBreakpoints();
    const bpCount = bps.breakpoints.length;
    writeMessage(
      context.output,
      `${bpCount} breakpoint${bpCount > 1 ? "s" : ""} removed.`,
      "green"
    );

    return commandSuccess;
  }
}

export class ListBreakpointsCommand extends IdeCommandBase {
  readonly id = "bp-list";
  readonly description = "Lists all breakpoints";
  readonly usage = "bp-list";
  readonly aliases = ["bpl"];

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    const bps = await context.emuApi.listBreakpoints();
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

type BreakpointWithAddressArgs = {
  addrSpec?: string;
  address?: number;
  partition?: number;
  resource?: string;
  line?: number;
  "-d"?: boolean;
  "-r"?: boolean;
  "-w"?: boolean;
  "-ir"?: boolean;
  "-iw"?: boolean;
  "-pm"?: number;
};

abstract class BreakpointWithAddressCommand extends IdeCommandBase<BreakpointWithAddressArgs> {
  argumentInfo: CommandArgumentInfo = {
    mandatory: [
      {
        name: "addrSpec"
      }
    ],
    commandOptions: ["-r", "-w", "-ir", "-iw"],
    namedOptions: [
      {
        name: "-pm",
        type: "number"
      }
    ]
  };

  partitionLabels: string[];

  async validateCommandArgs(
    context: IdeCommandContext,
    args: BreakpointWithAddressArgs
  ): Promise<ValidationMessage[]> {
    this.partitionLabels = await createEmuApi(context.messenger).getPartitionLabels();
    const addrArg = args.addrSpec?.trim() ?? "";
    let messages: ValidationMessage[] = [];

    // --- Validate address and partition
    if (addrArg.startsWith("[")) {
      const addrInfo = context.service.projectService.getBreakpointAddressInfo(addrArg);
      if (!addrInfo) {
        return [validationError(`Invalid breakpoint address ${addrArg}`)];
      }

      args.resource = addrInfo.resource;
      args.line = addrInfo.line;
    } else {
      // --- Parse the addSpec argument to find out its type
      const argToken = parseCommand(args.addrSpec)[0];
      const plainText = argToken.text.replace("'", "").replace("_", "");
      try {
        switch (argToken.type) {
          case TokenType.DecimalLiteral:
            args.address = parseInt(plainText, 10);
            break;
          case TokenType.BinaryLiteral:
            args.address = parseInt(plainText.substring(1), 2);
            break;
          case TokenType.HexadecimalLiteral:
            args.address = parseInt(plainText.substring(1), 16);
            break;
          default:
            const segments = addrArg.toLowerCase().split(":");
            if (segments.length === 2) {
              // --- Check for partition support
              const { machine } = context.service.machineService.getMachineInfo();
              const roms = machine.features?.[MF_ROM] ?? 0;
              const banks = machine.features?.[MF_BANK] ?? 0;
              if (!roms && !banks) {
                messages = [
                  {
                    type: ValidationMessageType.Error,
                    message: "This model does not support partitions"
                  }
                ];
                break;
              }

              // --- Extract partition information
              const partition = await createEmuApi(context.messenger).parsePartitionLabel(
                segments[0]
              );
              if (partition === undefined) {
                messages = [{ type: ValidationMessageType.Error, message: "Invalid partition" }];
                break;
              }

              args.partition = partition;

              // --- Extract address
              const tokens = parseCommand(segments[1]);
              if (tokens.length !== 1) {
                messages = [{ type: ValidationMessageType.Error, message: "Invalid address" }];
                break;
              }
              const valueInfo = getNumericTokenValue(tokens[0]);
              if (valueInfo.messages) {
                messages = [{ type: ValidationMessageType.Error, message: "Invalid address" }];
                break;
              }

              // --- Return with the info
              args.address = valueInfo.value;
            } else {
              messages = [{ type: ValidationMessageType.Error, message: "Invalid address" }];
            }
            break;
        }
      } catch (err) {
        console.error(err);
        messages = [{ type: ValidationMessageType.Error, message: "Invalid numeric value" }];
      }
    }

    // --- Validate options
    let bpOptions =
      (args["-r"] ? 1 : 0) + (args["-w"] ? 1 : 0) + (args["-ir"] ? 1 : 0) + (args["-iw"] ? 1 : 0);
    if (bpOptions > 1) {
      return [validationError("You can use only one of the -r, -w, -ir, -iw options")];
    }
    if (args["-pm"] && !args["-ir"] && !args["-iw"]) {
      return [validationError("You can use the -pm option only with the -ir or -iw option")];
    }
    if (args.partition !== undefined && (args["-ir"] || args["-iw"])) {
      return [validationError("You cannot use partition with I/O breakpoints")];
    }

    // --- Done.
    return messages;
  }
}

export class SetBreakpointCommand extends BreakpointWithAddressCommand {
  readonly id = "bp-set";
  readonly description = "Sets a breakpoint at the specified address";
  readonly usage = "bp-set <address> [-r] [-w] [-ir] [-iw] [-pm <port mask>] ";
  readonly aliases = ["bp"];

  async execute(
    context: IdeCommandContext,
    args: BreakpointWithAddressArgs
  ): Promise<IdeCommandResult> {
    const flag = await context.emuApi.setBreakpoint({
      address: args.address,
      resource: args.resource,
      partition: args.partition,
      line: args.line,
      exec: !(args["-r"] || args["-w"]),
      memoryRead: args["-r"],
      memoryWrite: args["-w"],
      ioRead: args["-ir"],
      ioWrite: args["-iw"],
      ioMask: args["-pm"]
    });
    let addrKey = getBreakpointKey(
      {
        address: args.address,
        partition: args.partition,
        resource: args.resource,
        line: args.line,
        memoryRead: args["-r"],
        memoryWrite: args["-w"],
        ioRead: args["-ir"],
        ioWrite: args["-iw"],
        ioMask: args["-pm"]
      },
      this.partitionLabels
    );
    writeSuccessMessage(
      context.output,
      `Breakpoint at address ${addrKey}` +
        `${(args["-ir"] || args["-iw"]) && args["-pm"] ? " /$" + toHexa4(args["-pm"]) : ""}` +
        `${flag ? " set" : " updated"}`
    );
    return commandSuccess;
  }
}

export class RemoveBreakpointCommand extends BreakpointWithAddressCommand {
  readonly id = "bp-del";
  readonly description = "Removes the breakpoint from the specified address";
  readonly usage = "bp-del <address> [-r] [-w] [-ir] [-iw]";
  readonly aliases = ["bd"];

  async execute(
    context: IdeCommandContext,
    args: BreakpointWithAddressArgs
  ): Promise<IdeCommandResult> {
    const flag = await context.emuApi.removeBreakpoint({
      address: args.address,
      partition: args.partition,
      resource: args.resource,
      line: args.line,
      exec: !(args["-r"] || args["-w"]),
      memoryRead: args["-r"],
      memoryWrite: args["-w"],
      ioRead: args["-ir"],
      ioWrite: args["-iw"]
    });
    let addrKey = getBreakpointKey(
      {
        address: args.address,
        partition: args.partition,
        resource: args.resource,
        line: args.line,
        memoryRead: args["-r"],
        memoryWrite: args["-w"],
        ioRead: args["-ir"],
        ioWrite: args["-iw"]
      },
      this.partitionLabels
    );
    if (flag) {
      writeSuccessMessage(context.output, `Breakpoint at address ${addrKey} removed`);
    } else {
      writeSuccessMessage(context.output, `No breakpoint has been set at address ${addrKey}`);
    }
    return commandSuccess;
  }
}

export class EnableBreakpointCommand extends BreakpointWithAddressCommand {
  readonly id = "bp-en";
  readonly description = "Enables/disables a breakpoint";
  readonly usage = "bp-en <address> [-r] [-w] [-ir] [-iw] [-d]";
  readonly aliases = ["be"];

  readonly argumentInfo: CommandArgumentInfo = {
    mandatory: [
      {
        name: "addrSpec"
      }
    ],
    commandOptions: ["-r", "-w", "-ir", "-iw", "-d"]
  };

  async execute(
    context: IdeCommandContext,
    args: BreakpointWithAddressArgs
  ): Promise<IdeCommandResult> {
    const flag = await context.emuApi.enableBreakpoint(
      {
        address: args.address,
        partition: args.partition,
        resource: args.resource,
        line: args.line,
        exec: !(args["-r"] || args["-w"]),
        memoryRead: args["-r"],
        memoryWrite: args["-w"],
        ioRead: args["-ir"],
        ioWrite: args["-iw"]
      },
      !args["-d"]
    );
    let addrKey = getBreakpointKey(
      {
        address: args.address,
        partition: args.partition,
        resource: args.resource,
        line: args.line,
        memoryRead: args["-r"],
        memoryWrite: args["-w"],
        ioRead: args["-ir"],
        ioWrite: args["-iw"]
      },
      this.partitionLabels
    );
    if (flag) {
      writeSuccessMessage(
        context.output,
        `Breakpoint at address ${addrKey} ${args["-d"] ? "disabled" : "enabled"}`
      );
    } else {
      return commandError(
        `Breakpoint at address $${toHexa4(
          args.address
        )} does not exist, so it cannot be enabled or disabled`
      );
    }
    return commandSuccess;
  }
}
