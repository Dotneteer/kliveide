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
  getNumericTokenValue,
  toHexa2
} from "@renderer/appIde/services/ide-commands";
import { getBreakpointDisplayKey } from "@common/utils/breakpoints";
import {
  NEX_BANK_LAST_OFFSET,
  NEX_MAX_BANK
} from "@renderer/appIde/DocumentPanels/Next/nexAnnotations";
import { parseCommand, TokenType } from "@renderer/appIde/services/command-parser";
import { MF_BANK, MF_ROM, MI_ZXNEXT } from "@common/machines/constants";
import { createEmuApi } from "@common/messaging/EmuApi";
import { BreakpointInfo } from "@abstractions/BreakpointInfo";

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
    // --- Listing a breakpoint in a notation `bp-set` would not accept back is what the storage /
    // --- display key split exists to prevent; this command is the one that used to do it.
    const partitionLabels = await context.emuApi.getPartitionLabels();
    if (bps.breakpoints.length) {
      let ordered = bps.breakpoints;
      ordered.forEach((bp, idx) => {
        // --- Two template literals were evaluated and discarded here, doing nothing. They are
        // --- gone; the key below is the whole address column.
        const addrKey = getBreakpointDisplayKey(bp, partitionLabels);
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

/**
 * Exported for `RunToCursorCommand`, which is a one-shot breakpoint plus a resume and must accept
 * exactly the address grammar `bp-set` does — including the bank-relative `<bank>:+<offset>` form.
 * A second parser for the same syntax is how the two would come to disagree.
 */
export type BreakpointWithAddressArgs = {
  addrSpec?: string;
  address?: number;
  partition?: number;
  bank?: number;
  bankOffset?: number;
  resource?: string;
  line?: number;
  "-d"?: boolean;
  "-r"?: boolean;
  "-w"?: boolean;
  "-i"?: boolean;
  "-o"?: boolean;
  "-m"?: number;
  /** The Next Register a `nr:<register>` spec named. */
  nextReg?: number;
  /** Also break on copper writes (NextReg breakpoints only). */
  "-c"?: boolean;
  /** Break only on this written value (NextReg breakpoints only); `-m` masks the comparison. */
  "-v"?: number;
};

/**
 * One numeric literal in exactly the forms the command tokenizer accepts (`$07`, `7`, `%00000111`),
 * or `undefined` when the text is not one.
 *
 * Wraps the tokenizer rather than matching a regex, so a spec's parts accept what every other
 * numeric argument accepts and cannot drift from it.
 */
function parseNumericSpec(text: string): number | undefined {
  try {
    const tokens = parseCommand(text);
    if (tokens.length !== 1) return undefined;
    const info = getNumericTokenValue(tokens[0]);
    return info && !info.messages ? info.value : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The breakpoint the three `bp-*` commands operate on, from one parsed argument set.
 *
 * Extracted from the three identical literals that used to sit in `bp-set`, `bp-del` and `bp-en`.
 * They had to stay in step by hand, and a field added to two of the three is a silent bug: the
 * breakpoint the command builds is also the key it looks up by, so `bp-del` missing a field
 * removes nothing and reports "no breakpoint has been set".
 */
function breakpointFromArgs(args: BreakpointWithAddressArgs): BreakpointInfo {
  const isNextReg = args.nextReg !== undefined;
  return {
    address: args.address,
    partition: args.partition,
    bank: args.bank,
    bankOffset: args.bankOffset,
    resource: args.resource,
    line: args.line,
    nextReg: args.nextReg,
    nextRegValue: args["-v"],
    // --- `-m` is the port mask for an I/O breakpoint and the value mask for a NextReg one, so each
    // --- kind takes it and the other must not, or a mask meant for one would arrive as the other.
    nextRegMask: isNextReg && args["-v"] !== undefined ? args["-m"] : undefined,
    nextRegCopper: args["-c"],
    exec: !(args["-r"] || args["-w"] || args["-i"] || args["-o"] || isNextReg),
    memoryRead: args["-r"],
    memoryWrite: args["-w"],
    ioRead: args["-i"],
    ioWrite: args["-o"],
    ioMask: isNextReg ? undefined : args["-m"]
  };
}

export abstract class BreakpointWithAddressCommand extends IdeCommandBase<BreakpointWithAddressArgs> {
  argumentInfo: CommandArgumentInfo = {
    mandatory: [
      {
        name: "addrSpec"
      }
    ],
    commandOptions: ["-r", "-w", "-i", "-o", "-c"],
    namedOptions: [
      {
        name: "-m",
        type: "number"
      },
      {
        name: "-v",
        type: "number"
      }
    ]
  };

  partitionLabels: Record<number, string> = {};

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
              const { machine } = context.service.machineService.getMachineInfo();

              /*
               * `nr:<register>` - a NextReg write breakpoint.
               *
               * Tested before the partition-support gate below, because a register is not a place:
               * it needs no ROM or bank pages, and falling into that gate would reject it on a
               * machine without partitions with a message about partitions.
               *
               * `nr` cannot shadow a partition label. The Next's are `R0`-`R3`, `X0`/`X1`, `Q0`/`Q1`,
               * `DM`, `M0`-`MF` and one or two hex digits (`parseNextPartitionLabel`), and `nr` is
               * none of those - `n` and `r` are not hex digits.
               */
              if (segments[0] === "nr") {
                if (machine.machineId !== MI_ZXNEXT) {
                  messages = [
                    validationError("NextReg breakpoints are supported on the ZX Spectrum Next only")
                  ];
                  break;
                }

                /*
                 * `nr:<register>[=<value>[/<mask>]]`.
                 *
                 * The optional tail is not a convenience - it is what makes the shape round-trip.
                 * A filtered breakpoint's display key *is* `NR:$07=$03/$0F`, and
                 * `BreakpointIndicator` splices that string straight into `bp-del <spec>`, so a
                 * parser that stopped at the register would leave a dot the user could not click
                 * away. That is the bug `getBreakpointAddressSpec` exists to have fixed for
                 * bank-relative watchpoints, arriving again in a new shape.
                 *
                 * `-v` / `-m` remain the way a human types the same thing; the inline form wins,
                 * because it is the one a command built from a listing carries.
                 */
                const equalsAt = segments[1].indexOf("=");
                const regText = equalsAt < 0 ? segments[1] : segments[1].substring(0, equalsAt);
                const filterText = equalsAt < 0 ? undefined : segments[1].substring(equalsAt + 1);

                // --- Parsed apart from the outer try/catch, as the bank-relative branch below is,
                // --- so garbage reports as an invalid *register* instead of the generic
                // --- "Invalid numeric value".
                const regValue = parseNumericSpec(regText);
                if (regValue === undefined) {
                  messages = [validationError("Invalid Next Register number")];
                  break;
                }
                if (regValue < 0 || regValue > 0xff) {
                  messages = [
                    validationError("A Next Register number must be between $00 and $FF")
                  ];
                  break;
                }

                if (filterText !== undefined) {
                  const slashAt = filterText.indexOf("/");
                  const valueText = slashAt < 0 ? filterText : filterText.substring(0, slashAt);
                  const maskText = slashAt < 0 ? undefined : filterText.substring(slashAt + 1);

                  const filterValue = parseNumericSpec(valueText);
                  if (filterValue === undefined) {
                    messages = [validationError("Invalid NextReg value filter")];
                    break;
                  }

                  let filterMask: number | undefined;
                  if (maskText !== undefined) {
                    filterMask = parseNumericSpec(maskText);
                    if (filterMask === undefined) {
                      messages = [validationError("Invalid NextReg value mask")];
                      break;
                    }
                  }

                  // --- Committed only now that the whole tail parsed. Assigning `-v` as soon as it
                  // --- was read left a half-built argument set behind on a bad mask: `nextReg`
                  // --- unset but `-v` set, which the cross-checks below then reported as "-v only
                  // --- with a NextReg breakpoint" - an answer about the wrong mistake.
                  args["-v"] = filterValue;
                  if (filterMask !== undefined) args["-m"] = filterMask;
                }

                args.nextReg = regValue;
                break;
              }

              // --- Check for partition support
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

              // --- `<bank>:+<offset>` — bank-relative: an offset inside a ZX Spectrum Next 16K
              // --- bank, firing wherever that bank is paged. `+` cannot begin an address literal
              // --- (`$`, a digit or `%`), so this cannot be confused with the absolute
              // --- `<partition>:<address>` form, and no existing spelling changes meaning.
              if (segments[1].startsWith("+")) {
                if (machine.machineId !== MI_ZXNEXT) {
                  messages = [
                    validationError("Bank-relative breakpoints are supported on the ZX Spectrum Next only")
                  ];
                  break;
                }

                // --- The bank is a 16K bank number in plain hex, *not* a partition label: the
                // --- label map describes 8K pages, and routing a bank through it is how the two
                // --- index spaces got confused. See `.plans/NEX_DEBUGGING_PLAN.md` §4.1.
                const bank = parseInt(segments[0], 16);
                if (!Number.isInteger(bank) || bank < 0 || bank > NEX_MAX_BANK) {
                  messages = [validationError(`Invalid bank (expected $00-$${toHexa2(NEX_MAX_BANK)})`)];
                  break;
                }

                // --- Parsing is guarded here rather than by the outer `catch`, so that garbage in
                // --- the offset reports as an invalid *bank offset* instead of the generic
                // --- "Invalid numeric value" the absolute form falls back to.
                let offsetValue: number | undefined;
                try {
                  const offsetTokens = parseCommand(segments[1].substring(1));
                  if (offsetTokens.length === 1) {
                    const offsetInfo = getNumericTokenValue(offsetTokens[0]);
                    if (!offsetInfo.messages) {
                      offsetValue = offsetInfo.value;
                    }
                  }
                } catch {
                  offsetValue = undefined;
                }
                if (offsetValue === undefined) {
                  messages = [validationError("Invalid bank offset")];
                  break;
                }
                const offsetInfo = { value: offsetValue };
                if (offsetInfo.value < 0 || offsetInfo.value > NEX_BANK_LAST_OFFSET) {
                  messages = [
                    validationError(`Bank offset must be between $0000 and $${toHexa4(NEX_BANK_LAST_OFFSET)}`)
                  ];
                  break;
                }

                args.bank = bank;
                args.bankOffset = offsetInfo.value;
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

    /*
     * A spec that did not parse gets its own answer.
     *
     * The option cross-checks below all `return` their own message, so without this an unparsed
     * spec is reported as an option mistake - `bp-set nr:zzz -v $03` said "-v only with a NextReg
     * breakpoint" rather than "Invalid Next Register number". The user is told about the first
     * thing that was wrong, not the first thing that was noticed.
     */
    if (messages.some((m) => m.type === ValidationMessageType.Error)) {
      return messages;
    }

    // --- Validate options
    let bpOptions =
      (args["-r"] ? 1 : 0) + (args["-w"] ? 1 : 0) + (args["-i"] ? 1 : 0) + (args["-o"] ? 1 : 0);
    if (bpOptions > 1) {
      return [validationError("You can use only one of the -r, -w, -i, -o options")];
    }

    /*
     * The NextReg rules. A NextReg breakpoint watches a machine event rather than a location, so
     * every option that names *where* to watch is meaningless on it, and the two that describe the
     * value it filters on are meaningless without it.
     */
    const isNextReg = args.nextReg !== undefined;
    if (isNextReg && bpOptions > 0) {
      return [
        validationError("A NextReg breakpoint watches a register, not memory or a port")
      ];
    }
    if (args["-v"] !== undefined && !isNextReg) {
      return [validationError("You can use the -v option only with a NextReg breakpoint")];
    }
    if (args["-c"] && !isNextReg) {
      return [validationError("You can use the -c option only with a NextReg breakpoint")];
    }
    if (isNextReg && args["-m"] !== undefined && args["-v"] === undefined) {
      // --- `-m` masks the comparison `-v` makes; on its own there is nothing to compare.
      return [validationError("The -m option needs a -v value to mask")];
    }
    if (isNextReg && args["-v"] !== undefined && (args["-v"] < 0 || args["-v"] > 0xff)) {
      return [validationError("A NextReg value must be between $00 and $FF")];
    }
    if (isNextReg && args["-m"] !== undefined && (args["-m"] < 0 || args["-m"] > 0xff)) {
      return [validationError("A NextReg value mask must be between $00 and $FF")];
    }

    if (args["-m"] && !args["-i"] && !args["-o"] && !isNextReg) {
      return [
        validationError("You can use the -m option only with the -i, -o or nr: forms")
      ];
    }
    if (args.partition !== undefined && (args["-i"] || args["-o"])) {
      return [validationError("You cannot use partition with I/O breakpoints")];
    }
    if (args.bankOffset !== undefined && (args["-i"] || args["-o"])) {
      // --- An I/O breakpoint watches a port, which has no bank.
      return [validationError("You cannot use a bank offset with I/O breakpoints")];
    }

    // --- Done.
    return messages;
  }
}

export class SetBreakpointCommand extends BreakpointWithAddressCommand {
  readonly id = "bp-set";
  readonly description = "Sets a breakpoint at the specified address";
  readonly usage = "bp-set <address-spec> [-r] [-w] [-i] [-o] [-c] [-m <mask>] [-v <value>]";
  readonly aliases = ["bp"];

  async execute(
    context: IdeCommandContext,
    args: BreakpointWithAddressArgs
  ): Promise<IdeCommandResult> {
    const bpDef = breakpointFromArgs(args);
    const flag = await context.emuApi.setBreakpoint(bpDef);
    let addrKey = getBreakpointDisplayKey(bpDef, this.partitionLabels);
    writeSuccessMessage(
      context.output,
      `Breakpoint at address ${addrKey}` +
        `${(args["-i"] || args["-o"]) && args["-m"] ? " /$" + toHexa4(args["-m"]) : ""}` +
        `${flag ? " set" : " updated"}`
    );
    return commandSuccess;
  }
}

export class RemoveBreakpointCommand extends BreakpointWithAddressCommand {
  readonly id = "bp-del";
  readonly description = "Removes the breakpoint from the specified address";
  readonly usage = "bp-del <address-spec> [-r] [-w] [-i] [-o] [-c] [-m <mask>] [-v <value>]";
  readonly aliases = ["bd"];

  async execute(
    context: IdeCommandContext,
    args: BreakpointWithAddressArgs
  ): Promise<IdeCommandResult> {
    const bpDef: BreakpointInfo = breakpointFromArgs(args);
    const flag = await context.emuApi.removeBreakpoint(bpDef);
    let addrKey = getBreakpointDisplayKey(bpDef, this.partitionLabels);
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
  readonly usage = "bp-en <address-spec> [-r] [-w] [-i] [-o] [-d] [-c] [-m <mask>] [-v <value>]";
  readonly aliases = ["be"];

  readonly argumentInfo: CommandArgumentInfo = {
    mandatory: [
      {
        name: "addrSpec"
      }
    ],
    commandOptions: ["-r", "-w", "-i", "-o", "-d", "-c"],
    namedOptions: [
      {
        name: "-m",
        type: "number"
      },
      {
        name: "-v",
        type: "number"
      }
    ]
  };

  async execute(
    context: IdeCommandContext,
    args: BreakpointWithAddressArgs
  ): Promise<IdeCommandResult> {
    const bpDef: BreakpointInfo = breakpointFromArgs(args);
    const flag = await context.emuApi.enableBreakpoint(bpDef, !args["-d"]);
    let addrKey = getBreakpointDisplayKey(bpDef, this.partitionLabels);
    if (flag) {
      writeSuccessMessage(
        context.output,
        `Breakpoint at address ${addrKey} ${args["-d"] ? "disabled" : "enabled"}`
      );
    } else {
      // --- `addrKey`, not `$${toHexa4(args.address)}`: a bank-relative, source-bound or NextReg
      // --- breakpoint has no `address`, so that spelling printed `$NAN` for three of the five
      // --- shapes the command already accepted.
      return commandError(
        `Breakpoint ${addrKey} does not exist, so it cannot be enabled or disabled`
      );
    }
    return commandSuccess;
  }
}
