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
import { getBreakpointAddressSpec, getBreakpointDisplayKey } from "@common/utils/breakpoints";
import { formatHitSpec, isLogpoint, parseHitSpec } from "@common/utils/breakpoint-filters";
import { isAnnotationBreakpoint } from "@common/utils/breakpoint-scope";
import {
  compileLogTemplate,
  logGroupOf
} from "@common/utils/breakpoint-condition/logpoint-template";
import { setLogpointGroupsAction } from "@common/state/actions";
import { saveProject } from "@renderer/appIde/utils/save-project";
import { compileCondition } from "@common/utils/breakpoint-condition/condition-checker";
import { conditionMachineFacts } from "@common/utils/breakpoint-condition/condition-machine";
import type {
  ConditionAccessKind,
  ConditionDiagnostic
} from "@common/utils/breakpoint-condition/condition-types";
import { mergedConditionSymbols } from "@renderer/appIde/utils/condition-symbols";
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
    // --- Logpoints read from `LOGPOINT` comments belong to the build: listed apart, read-only
    const ordered = bps.breakpoints.filter((bp) => !isAnnotationBreakpoint(bp));
    const comments = bps.breakpoints.filter((bp) => isAnnotationBreakpoint(bp));
    if (ordered.length) {
      ordered.forEach((bp, idx) => {
        /*
         * The first line is `bp-set` syntax: everything after `[n]: ` pasted back into `bp-set`
         * recreates the breakpoint (plan §4.3) - the address spec, its kind options, the hit rule
         * and the condition, which is last because `-if` takes the rest of the line. What `bp-set`
         * cannot say (disabled, the live count, a condition's state) goes on a second line.
         */
        writeMessage(context.output, `[${idx + 1}]: `, "bright-blue", false);
        writeMessage(context.output, breakpointCommandSpec(bp, partitionLabels), "bright-magenta");
        const status = breakpointStatusText(bp);
        if (status) writeMessage(context.output, `     ${status}`, bp.conditionError ? "bright-red" : "cyan");
      });
      writeMessage(
        context.output,
        `${ordered.length} breakpoint${ordered.length > 1 ? "s" : ""} set`,
        "bright-blue"
      );
    } else {
      writeMessage(context.output, "No breakpoints set", "bright-blue");
    }
    if (comments.length) {
      writeMessage(
        context.output,
        "LOGPOINT comments (from the last build; edit the comment and rebuild to change one):",
        "bright-blue"
      );
      comments.forEach((bp) => {
        const at = getBreakpointAddressSpec({ address: bp.address, partition: bp.partition }, partitionLabels);
        writeMessage(context.output, `  [${bp.resource}]:${bp.line} @ ${at}: `, "bright-blue", false);
        writeMessage(context.output, bp.logMessage ?? "", "bright-magenta");
        const status = breakpointStatusText(bp);
        if (status) writeMessage(context.output, `     ${status}`, bp.logError ? "bright-red" : "cyan");
      });
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
  /** The hit-count rule as typed (`10`, `>=10`, `*10`, ...). */
  "-hit"?: string;
  /** The condition: the raw rest of the line after `-if`. */
  "-if"?: string;
  /** A logpoint's message template (`.plans/LOGPOINTS_PLAN.md` §4.4), quotes removed. */
  "-log"?: string;
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
      },
      {
        name: "-hit"
      },
      {
        name: "-log"
      }
    ],
    // --- `bp-del` and `bp-en` accept and ignore `-if`/`-hit`/`-log`, so a `bp-list` line edits
    // --- into any
    rawTailOption: "-if"
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
  readonly usage = [
    "bp-set <address-spec> [-r] [-w] [-i] [-o] [-c] [-m <mask>] [-v <value>] [-log \"<template>\"] [-hit <spec>] [-if <condition>]",
    "-log: log the message and continue instead of stopping (a logpoint), e.g. -log \"[LOOP] B={B} HL={HL:hex16}\"",
    "-hit: stop on hit N (N or =N), after it (>N), from it (>=N), before it (<N), up to it (<=N), every Nth (*N)",
    "-if: must be last; the rest of the line is the condition, e.g. -if A == $FF && !ZF"
  ];
  readonly aliases = ["bp"];

  /** Warnings of the condition validated last (unknown labels), printed when the breakpoint is set. */
  private conditionWarnings: ConditionDiagnostic[] = [];
  /** Warnings of the log template validated last. */
  private logWarnings: ConditionDiagnostic[] = [];

  async validateCommandArgs(
    context: IdeCommandContext,
    args: BreakpointWithAddressArgs
  ): Promise<ValidationMessage[]> {
    const messages = await super.validateCommandArgs(context, args);
    this.conditionWarnings = [];
    this.logWarnings = [];
    if (messages.some((m) => m.type === ValidationMessageType.Error)) return messages;
    const facts = conditionMachineFacts(
      context.service.machineService.getMachineInfo()?.machine?.machineId,
      this.partitionLabels
    );

    if (args["-log"] !== undefined) {
      const template = (args["-log"] = unescapeLogOption(String(args["-log"])));
      if (!template.trim()) {
        return [validationError("The -log option needs a message template")];
      }
      const result = compileLogTemplate(template, "klive", {
        ...facts,
        accessKind: accessKindOfArgs(args),
        symbols: mergedConditionSymbols()
      });
      if (result.errors.length) {
        return conditionErrorMessages(template, result.errors[0], "Log template error");
      }
      this.logWarnings = result.warnings;
    }

    if (args["-hit"] !== undefined) {
      const hit = parseHitSpec(String(args["-hit"]));
      if ("error" in hit) return [validationError(hit.error)];
    }

    if (args["-if"] !== undefined) {
      const condition = args["-if"];
      if (!condition.trim()) {
        return [validationError("The -if option needs a condition after it")];
      }
      const result = compileCondition(condition, {
        // --- The same machine the address spec was validated against
        ...facts,
        accessKind: accessKindOfArgs(args),
        symbols: mergedConditionSymbols()
      });
      if (result.errors.length) {
        return conditionErrorMessages(condition, result.errors[0]);
      }
      this.conditionWarnings = result.warnings;
    }
    return messages;
  }

  async execute(
    context: IdeCommandContext,
    args: BreakpointWithAddressArgs
  ): Promise<IdeCommandResult> {
    const bpDef = breakpointFromArgs(args);
    // --- `bp-set` states the whole breakpoint (C13): without `-if`/`-hit` it clears them
    if (args["-if"] !== undefined) bpDef.condition = args["-if"];
    // --- And without `-log` it is a stopping breakpoint again (L2)
    if (args["-log"] !== undefined) bpDef.logMessage = args["-log"];
    if (args["-hit"] !== undefined) {
      const hit = parseHitSpec(String(args["-hit"]));
      if (!("error" in hit)) Object.assign(bpDef, hit);
    }
    const flag = await context.emuApi.setBreakpoint(bpDef);
    let addrKey = getBreakpointDisplayKey(bpDef, this.partitionLabels);
    const hitSpec = formatHitSpec(bpDef);
    writeSuccessMessage(
      context.output,
      `${bpDef.logMessage ? "Logpoint" : "Breakpoint"} at address ${addrKey}` +
        `${(args["-i"] || args["-o"]) && args["-m"] ? " /$" + toHexa4(args["-m"]) : ""}` +
        `${flag ? " set" : " updated"}` +
        `${bpDef.logMessage ? ` -log ${quoteLogTemplate(bpDef.logMessage)}` : ""}` +
        `${hitSpec ? ` -hit ${hitSpec}` : ""}` +
        `${bpDef.condition ? ` -if ${bpDef.condition}` : ""}`
    );
    for (const warning of this.conditionWarnings) {
      writeMessage(context.output, `Warning (column ${warning.start + 1}): ${warning.message}`, "yellow");
    }
    for (const warning of this.logWarnings) {
      writeMessage(
        context.output,
        `Warning (log template column ${warning.start + 1}): ${warning.message}`,
        "yellow"
      );
    }
    return commandSuccess;
  }
}

/**
 * `bp-reset-hits [<address-spec>]`: zero one breakpoint's hit counter, or every counter (C12).
 */
export class ResetBreakpointHitsCommand extends BreakpointWithAddressCommand {
  readonly id = "bp-reset-hits";
  readonly description = "Resets the hit counter of a breakpoint, or of all breakpoints";
  readonly usage = "bp-reset-hits [<address-spec>] [-r] [-w] [-i] [-o] [-m <mask>] [-v <value>]";
  readonly aliases = ["bprh"];

  readonly argumentInfo: CommandArgumentInfo = {
    optional: [
      {
        name: "addrSpec"
      }
    ],
    commandOptions: ["-r", "-w", "-i", "-o", "-c"],
    namedOptions: [
      { name: "-m", type: "number" },
      { name: "-v", type: "number" },
      { name: "-hit" },
      { name: "-log" }
    ],
    rawTailOption: "-if"
  };

  async validateCommandArgs(
    context: IdeCommandContext,
    args: BreakpointWithAddressArgs
  ): Promise<ValidationMessage[]> {
    if (args.addrSpec === undefined) return [];
    return super.validateCommandArgs(context, args);
  }

  async execute(
    context: IdeCommandContext,
    args: BreakpointWithAddressArgs
  ): Promise<IdeCommandResult> {
    if (args.addrSpec === undefined) {
      await context.emuApi.resetBreakpointHits();
      writeSuccessMessage(context.output, "All breakpoint hit counters reset");
      return commandSuccess;
    }
    const bpDef = breakpointFromArgs(args);
    const addrKey = getBreakpointDisplayKey(bpDef, this.partitionLabels);
    if (!(await context.emuApi.resetBreakpointHits(bpDef))) {
      return commandError(`Breakpoint ${addrKey} does not exist`);
    }
    writeSuccessMessage(context.output, `Hit counter of breakpoint ${addrKey} reset`);
    return commandSuccess;
  }
}

/** The condition-language kind of the breakpoint a set of `bp-*` arguments describes. */
function accessKindOfArgs(args: BreakpointWithAddressArgs): ConditionAccessKind {
  if (args.nextReg !== undefined) return "nextReg";
  if (args["-r"] || args["-w"]) return "memory";
  if (args["-i"] || args["-o"]) return "io";
  return "exec";
}

/**
 * A condition error as the command line shows it: the message with its column, then the condition
 * with a caret line under the offending range (§4.3).
 */
export function conditionErrorMessages(
  condition: string,
  error: ConditionDiagnostic,
  what = "Condition error"
): ValidationMessage[] {
  const width = Math.max(1, error.end - error.start);
  return [
    validationError(`${what} at column ${error.start + 1}: ${error.message}`),
    { type: ValidationMessageType.Info, message: `  ${condition}` },
    { type: ValidationMessageType.Info, message: `  ${" ".repeat(error.start)}${"^".repeat(width)}` }
  ];
}

/**
 * A breakpoint as `bp-set` arguments: the address spec, its kind options, the hit rule and the
 * condition. Pasted back into `bp-set` it recreates the breakpoint.
 */
export function breakpointCommandSpec(
  bp: BreakpointInfo,
  partitionLabels: Record<number, string>
): string {
  const parts = [getBreakpointAddressSpec(bp, partitionLabels)];
  if (bp.memoryRead) parts.push("-r");
  if (bp.memoryWrite) parts.push("-w");
  if (bp.ioRead) parts.push("-i");
  if (bp.ioWrite) parts.push("-o");
  if ((bp.ioRead || bp.ioWrite) && bp.ioMask !== undefined && bp.ioMask !== 0xffff) {
    parts.push(`-m $${toHexa4(bp.ioMask)}`);
  }
  if (bp.nextRegCopper) parts.push("-c");
  if (bp.logMessage) parts.push(`-log ${quoteLogTemplate(bp.logMessage)}`);
  const hitSpec = formatHitSpec(bp);
  if (hitSpec) parts.push(`-hit ${hitSpec}`);
  if (bp.condition?.trim()) parts.push(`-if ${bp.condition}`);
  return parts.join(" ");
}

/** What `bp-set` cannot say about a breakpoint: disabled, the live count, a condition's state. */
export function breakpointStatusText(bp: BreakpointInfo): string {
  const parts: string[] = [];
  if (bp.disabled) parts.push("<disabled>");
  if (bp.currentHits !== undefined) parts.push(`(hits: ${bp.currentHits})`);
  if (bp.conditionInactive) parts.push(`<inactive: ${bp.conditionInactive}>`);
  if (bp.conditionError) parts.push(`<condition error: ${bp.conditionError}>`);
  if (bp.logError) parts.push(`<log template error: ${bp.logError}>`);
  return parts.join(" ");
}

/** A template as a `-log` value: double-quoted, `"` and `\` escaped (the tokenizer's escapes). */
export function quoteLogTemplate(template: string): string {
  return `"${template.replace(/[\\"]/g, (c) => `\\${c}`)}"`;
}

/** A `-log` value as typed: the tokenizer strips the quotes but leaves `\"` and `\\` escaped. */
export function unescapeLogOption(value: string): string {
  return value.replace(/\\(["\\])/g, "$1");
}

// ================================================================================================
// Logpoint groups (`.plans/LOGPOINTS_PLAN.md` §4.4)

/** Every group the current logpoints name, with how many each holds. */
function knownLogGroups(bps: BreakpointInfo[]): Map<string, number> {
  const groups = new Map<string, number>();
  for (const bp of bps) {
    if (!isLogpoint(bp)) continue;
    const group = logGroupOf(bp.logMessage);
    groups.set(group, (groups.get(group) ?? 0) + 1);
  }
  return groups;
}

type LogGroupsArgs = { rest?: string[]; "-d"?: boolean };

/**
 * `lp-en [<group> ...] [-d]`: with no groups, switch all logging on (or off with `-d`); with groups,
 * log only those (or, with `-d`, stop logging those and keep the rest).
 */
export class EnableLogpointGroupsCommand extends IdeCommandBase<LogGroupsArgs> {
  readonly id = "lp-en";
  readonly description = "Enables or disables logpoint groups";
  readonly usage = [
    "lp-en [<group> ...] [-d]",
    "no groups: all logpoints log (-d: none does); groups: only those log (-d: those stop logging)"
  ];
  readonly aliases = ["lpe"];

  readonly argumentInfo: CommandArgumentInfo = {
    allowRest: true,
    commandOptions: ["-d"]
  };

  async execute(context: IdeCommandContext, args: LogGroupsArgs): Promise<IdeCommandResult> {
    const named = (args.rest ?? []).map((g) => String(g).replace(/^\[|\]$/g, "").toUpperCase());
    const current = context.store.getState().logpointGroups ?? { enabled: true };
    let next: { enabled: boolean; groups?: string[] };
    if (named.length === 0) {
      next = { enabled: !args["-d"] };
    } else if (!args["-d"]) {
      next = { enabled: true, groups: named };
    } else {
      const known = knownLogGroups((await context.emuApi.listBreakpoints()).breakpoints);
      const on = !current.enabled ? [] : (current.groups ?? [...known.keys()]);
      next = { enabled: true, groups: on.filter((g) => !named.includes(g)) };
    }
    context.store.dispatch(setLogpointGroupsAction(next));
    void saveProject(context.messenger);
    writeSuccessMessage(context.output, `Logging: ${describeLogGroups(next)}`);
    return commandSuccess;
  }
}

/** `lp-groups`: every group the logpoints name, whether it logs, and how many logpoints it holds. */
export class ListLogpointGroupsCommand extends IdeCommandBase {
  readonly id = "lp-groups";
  readonly description = "Lists the logpoint groups";
  readonly usage = "lp-groups";
  readonly aliases = ["lpg"];

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    const state = context.store.getState().logpointGroups ?? { enabled: true };
    const known = knownLogGroups((await context.emuApi.listBreakpoints()).breakpoints);
    for (const group of state.groups ?? []) if (!known.has(group)) known.set(group, 0);
    writeMessage(context.output, `Logging: ${describeLogGroups(state)}`, "bright-blue");
    if (known.size === 0) {
      writeMessage(context.output, "No logpoints set", "bright-blue");
      return commandSuccess;
    }
    for (const [group, count] of [...known.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      const on = logGroupOn(state, group);
      writeMessage(context.output, `  [${group}] `, "bright-magenta", false);
      writeMessage(context.output, on ? "on " : "off", on ? "green" : "bright-black", false);
      writeMessage(context.output, `  ${count} logpoint${count === 1 ? "" : "s"}`, "cyan");
    }
    return commandSuccess;
  }
}

/** Does the group switch let this group log? */
export function logGroupOn(state: { enabled: boolean; groups?: string[] }, group: string): boolean {
  return state.enabled && (!state.groups || state.groups.includes(group.toUpperCase()));
}

function describeLogGroups(state: { enabled: boolean; groups?: string[] }): string {
  if (!state.enabled) return "off";
  if (!state.groups) return "all groups";
  return state.groups.length ? `only ${state.groups.join(", ")}` : "no group";
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
      },
      {
        name: "-hit"
      },
      {
        name: "-log"
      }
    ],
    rawTailOption: "-if"
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
