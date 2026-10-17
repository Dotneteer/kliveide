import { bankSpaceFor } from "@common/annotations/bankSpace";
import { getActiveAnnotationSet } from "@renderer/appIde/annotations/activeAnnotationSet";
import { getRomPartitions } from "@renderer/appIde/annotations/romAnnotations";
import { mergeRomLayers } from "@renderer/appIde/annotations/symbolResolver";
import { machineConfigOf } from "@renderer/appIde/annotations/useMachineBankSpace";
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
import {
  getBreakpointAddressSpec,
  getBreakpointDisplayKey,
  reinstallAnnotationBreakpoints
} from "@common/utils/breakpoints";
import { formatHitSpec, isLogpoint, parseHitSpec } from "@common/utils/breakpoint-filters";
import { isAnnotationBreakpoint } from "@common/utils/breakpoint-scope";
import {
  parseSpriteAttrList,
  SPRITE_ATTR_ALL,
  SPRITE_INDEX_MAX
} from "@common/zxnext/sprites/spriteBreakpoints";
import {
  compileLogTemplate,
  logGroupOf
} from "@common/utils/breakpoint-condition/logpoint-template";
import { setLogpointGroupsAction, setSourceCommentsAction } from "@common/state/actions";
import { kliveConditionText } from "@common/utils/breakpoint-condition/dezog/dezog-printer";
import { saveProject } from "@renderer/appIde/utils/save-project";
import {
  breakpointCommandSpec,
  breakpointStatusText,
  quoteLogTemplate
} from "@common/utils/breakpoint-spec";
import { compileCondition } from "@common/utils/breakpoint-condition/condition-checker";
import { conditionMachineFacts } from "@common/utils/breakpoint-condition/condition-machine";
import type {
  ConditionAccessKind,
  ConditionDiagnostic
} from "@common/utils/breakpoint-condition/condition-types";
import { mergedConditionSymbols } from "@renderer/appIde/utils/condition-symbols";
import { ANNOTATION_BANK_LAST_OFFSET } from "@renderer/appIde/annotations/programAnnotations";
import { parseCommand, TokenType } from "@renderer/appIde/services/command-parser";
import { MF_BANK, MF_ROM, MI_ZXNEXT } from "@common/machines/constants";
import { createEmuApi } from "@common/messaging/EmuApi";
import { BreakpointInfo } from "@abstractions/BreakpointInfo";
import { t } from "@common/i18n/i18n";
import type { MessageKey } from "@common/i18n/keys.generated";

export class EraseAllBreakpointsCommand extends IdeCommandBase {
  readonly id = "bp-ea";
  get description() {
    return t("commands.bp.eraseAll.description");
  }
  readonly usage = "bp-ea";
  readonly aliases = ["eab"];

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    const bps = await context.emuApi.listBreakpoints();
    await context.emuApi.eraseAllBreakpoints();
    const bpCount = bps.breakpoints.length;
    writeMessage(context.output, t("commands.bp.eraseAll.done", { count: bpCount }), "green");

    return commandSuccess;
  }
}

export class ListBreakpointsCommand extends IdeCommandBase {
  readonly id = "bp-list";
  get description() {
    return t("commands.bp.list.description");
  }
  readonly usage = "bp-list";
  readonly aliases = ["bpl"];

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    const bps = await context.emuApi.listBreakpoints();
    // --- Listing a breakpoint in a notation `bp-set` would not accept back is what the storage /
    // --- display key split exists to prevent; this command is the one that used to do it.
    const partitionLabels = await context.emuApi.getPartitionLabels();
    // --- Breakpoints read from DeZog comments belong to the build: listed apart, read-only
    const ordered = bps.breakpoints.filter((bp) => !isAnnotationBreakpoint(bp));
    const comments = bps.breakpoints.filter(
      (bp) => isAnnotationBreakpoint(bp) && !bp.annotationKind
    );
    const assertions = bps.breakpoints.filter((bp) => bp.annotationKind === "ASSERTION");
    const watchpoints = bps.breakpoints.filter((bp) => bp.annotationKind === "WPMEM");
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
      writeMessage(context.output, t("commands.bp.list.count", { count: ordered.length }), "bright-blue");
    } else {
      writeMessage(context.output, t("commands.bp.list.none"), "bright-blue");
    }
    if (comments.length) {
      writeMessage(
        context.output,
        t("commands.bp.list.logpointComments"),
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
    if (assertions.length) {
      writeMessage(
        context.output,
        t("commands.bp.list.assertionComments"),
        "bright-blue"
      );
      assertions.forEach((bp) => {
        const at = getBreakpointAddressSpec({ address: bp.address, partition: bp.partition }, partitionLabels);
        writeMessage(context.output, `  [${bp.resource}]:${bp.line} @ ${at}: `, "bright-blue", false);
        writeMessage(context.output, `ASSERTION ${bp.annotationText ?? ""}`, "bright-magenta");
        // --- The Klive reading, so C precedence is visible (R2)
        if (bp.annotationText) {
          writeMessage(context.output, `     ${t("commands.bp.list.readAs", { condition: kliveConditionText(bp.annotationText) })}`, "cyan");
        }
        const status = breakpointStatusText(bp);
        if (status) writeMessage(context.output, `     ${status}`, bp.conditionError ? "bright-red" : "cyan");
      });
    }
    if (watchpoints.length) {
      writeMessage(
        context.output,
        t("commands.bp.list.wpmemComments"),
        "bright-blue"
      );
      watchpoints.forEach((bp) => {
        const at = getBreakpointAddressSpec({ address: bp.address, partition: bp.partition }, partitionLabels);
        const range = bp.length && bp.length > 1 ? ` -len ${bp.length}` : "";
        writeMessage(context.output, `  [${bp.resource}]:${bp.line} @ ${at}${range} ${bp.memoryRead ? "-r" : "-w"}: `, "bright-blue", false);
        writeMessage(context.output, `WPMEM ${bp.annotationText ?? ""}`, "bright-magenta");
        const status = breakpointStatusText(bp);
        if (status) writeMessage(context.output, `     ${status}`, "cyan");
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
  /** The Copper list index of a `cu:` breakpoint (ZX Spectrum Next only), `$000-$3FF`. */
  copperIndex?: number;
  /** The sprite of an `sp:` breakpoint (ZX Spectrum Next only), `$00-$7F`. */
  spriteIndex?: number;
  /** The attribute bytes an `sp:` breakpoint watches, as typed (`0,2`, `0-3`). */
  "-attr"?: string;
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
  /** A one-shot: removed the first time it stops the machine (G1.6, O1). `bp-set` only. */
  "-once"?: boolean;
  /** The bytes a memory breakpoint watches from its address (S10). Part of the identity. */
  "-len"?: number;
  /** The build symbol a `WS:<symbol>` spec anchors a watchpoint to (W3). */
  watchSymbol?: string;
  /**
   * The annotation label a `<bank>:<label>` spec anchors the breakpoint to, and the sidecar whose
   * label table it is looked up in: the active annotation set's
   * (`.plans/REVERSE_ENGINEERING_ANNOTATIONS_PLAN.md` §4.6).
   */
  label?: string;
  labelFile?: string;
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
  const isCopper = args.copperIndex !== undefined;
  const isSprite = args.spriteIndex !== undefined;
  const attrMask = isSprite && args["-attr"] !== undefined ? parseSpriteAttrList(args["-attr"]) : undefined;
  return {
    address: args.address,
    partition: args.partition,
    bank: args.bank,
    bankOffset: args.bankOffset,
    resource: args.resource,
    line: args.line,
    watchSymbol: args.watchSymbol,
    ...(args.label !== undefined ? { label: args.label, labelFile: args.labelFile } : {}),
    nextReg: args.nextReg,
    nextRegValue: args["-v"],
    // --- `-m` is the port mask for an I/O breakpoint and the value mask for a NextReg one, so each
    // --- kind takes it and the other must not, or a mask meant for one would arrive as the other.
    nextRegMask: isNextReg && args["-v"] !== undefined ? args["-m"] : undefined,
    nextRegCopper: args["-c"],
    copperIndex: args.copperIndex,
    spriteIndex: args.spriteIndex,
    // --- All five bytes is the default, so it is not stored
    spriteAttrMask: attrMask !== undefined && attrMask !== SPRITE_ATTR_ALL ? attrMask : undefined,
    exec: !(args["-r"] || args["-w"] || args["-i"] || args["-o"] || isNextReg || isCopper || isSprite),
    memoryRead: args["-r"],
    memoryWrite: args["-w"],
    ioRead: args["-i"],
    ioWrite: args["-o"],
    ioMask: isNextReg ? undefined : args["-m"],
    // --- Part of a memory range's identity, so `bp-del`/`bp-en` need it as much as `bp-set` does
    ...((args["-r"] || args["-w"]) && args["-len"] !== undefined && args["-len"] > 1
      ? { length: args["-len"] }
      : {})
  };
}

/**
 * What a label spec names: a ROM label resolved now to its address (and, on a machine with
 * partitions, the ROM partition it is paged as), or a bank label left to resolve against the active
 * annotation set's labels as they change — a label-anchored breakpoint, persisted in that sidecar.
 */
function resolveAnnotationLabelSpec(
  context: IdeCommandContext,
  machineId: string,
  firstPart: string,
  name: string
): Partial<BreakpointWithAddressArgs> | { error: string } {
  const emu = context.store.getState().emulatorState;
  const bankSpace = bankSpaceFor(machineId, machineConfigOf(machineId, emu?.modelId, emu?.config));
  if (!bankSpace) return { error: t("commands.bp.label.notAnnotatable") };

  if (firstPart.toUpperCase() === "ROM") {
    for (const info of getRomPartitions()) {
      const merged = mergeRomLayers(info.layers);
      const label = merged?.bankAnnotation.localLabels?.find((candidate) => candidate.name === name);
      if (!label) continue;
      // --- The ROM is paged at the bottom of the address space on every annotated machine
      const partitioned = bankSpace.partitionOf({ bank: 0, offset: 0 }) !== undefined;
      return {
        address: label.value,
        ...(partitioned ? { partition: info.partition } : {})
      };
    }
    return { error: t("commands.bp.label.noRomLabel", { name }) };
  }

  const bank = /^[0-9A-Fa-f]{1,2}$/.test(firstPart) ? parseInt(firstPart, 16) : undefined;
  if (bank === undefined || bank > bankSpace.maxBank) {
    return { error: t("commands.bp.label.invalidBankOrRom", { maxBank: toHexa2(bankSpace.maxBank) }) };
  }
  const active = getActiveAnnotationSet();
  if (!active) {
    return { error: t("commands.bp.label.noActiveSet") };
  }
  return { label: name, labelFile: active.path, bank };
}

export abstract class BreakpointWithAddressCommand extends IdeCommandBase<BreakpointWithAddressArgs> {
  argumentInfo: CommandArgumentInfo = {
    mandatory: [
      {
        name: "addrSpec"
      }
    ],
    commandOptions: ["-r", "-w", "-i", "-o", "-c", "-once"],
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
        name: "-len",
        type: "number"
      },
      {
        name: "-hit"
      },
      {
        name: "-log"
      },
      {
        name: "-attr"
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
    if (/^ws:/i.test(addrArg)) {
      // --- `WS:<symbol>`: a watchpoint anchored to a build symbol (W3), the form `bp-list` prints
      // --- for one made from a Watch row, so the line pastes back
      const symbol = addrArg.substring(3).trim();
      if (!/^[A-Za-z_][A-Za-z0-9_.]*$/.test(symbol)) {
        return [validationError(t("commands.bp.invalidSymbol", { spec: addrArg }))];
      }
      if (!args["-r"] && !args["-w"]) {
        return [validationError(t("commands.bp.watchSymbolNeedsAccess"))];
      }
      args.watchSymbol = symbol;
    } else if (addrArg.startsWith("[")) {
      const addrInfo = context.service.projectService.getBreakpointAddressInfo(addrArg);
      if (!addrInfo) {
        return [validationError(t("commands.bp.invalidSourceAddress", { spec: addrArg }))];
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
               * `ROM:<name>` and `<bank>:<label>` - a breakpoint named by an annotation label
               * (`.plans/REVERSE_ENGINEERING_ANNOTATIONS_PLAN.md` §4.6, §5.5). Told apart from
               * `<partition>:<address>` by the second part being an identifier: an address literal
               * starts with `$`, `%` or a digit.
               */
              const [firstPart, namePart] = addrArg.split(":");
              if (
                /^(rom|[0-9a-f]{1,2})$/i.test(firstPart) &&
                /^[A-Za-z_][A-Za-z0-9_]*$/.test(namePart)
              ) {
                const resolved = resolveAnnotationLabelSpec(
                  context,
                  machine.machineId,
                  firstPart,
                  namePart
                );
                if ("error" in resolved) {
                  messages = [validationError(resolved.error)];
                  break;
                }
                Object.assign(args, resolved);
                break;
              }

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
              /*
               * `cu:<index>` - a Copper-instruction breakpoint (`.plans/COPPER_DEBUGGING_PLAN.md`
               * §4.8). Before the partition gate for the same reason as `nr:`; `cu` cannot shadow a
               * partition label either (`u` is not a hex digit).
               */
              if (segments[0] === "cu") {
                if (machine.machineId !== MI_ZXNEXT) {
                  messages = [
                    validationError(t("commands.bp.copper.nextOnly"))
                  ];
                  break;
                }
                const index = parseNumericSpec(segments[1]);
                if (index === undefined) {
                  messages = [validationError(t("commands.bp.copper.invalidIndex"))];
                  break;
                }
                if (index < 0 || index > 0x3ff) {
                  messages = [validationError(t("commands.bp.copper.indexRange"))];
                  break;
                }
                args.copperIndex = index;
                break;
              }

              /*
               * `sp:<sprite>` - a sprite-attribute breakpoint
               * (`.plans/SPRITE_ATTRIBUTE_BREAKPOINTS_PLAN.md`). Before the partition gate for the
               * same reason as `nr:`; `sp` cannot shadow a partition label (`s`, `p` are not hex).
               */
              if (segments[0] === "sp") {
                if (machine.machineId !== MI_ZXNEXT) {
                  messages = [
                    validationError(t("commands.bp.sprite.nextOnly"))
                  ];
                  break;
                }
                const sprite = parseNumericSpec(segments[1]);
                if (sprite === undefined) {
                  messages = [validationError(t("commands.bp.sprite.invalidIndex"))];
                  break;
                }
                if (sprite < 0 || sprite > SPRITE_INDEX_MAX) {
                  messages = [validationError(t("commands.bp.sprite.indexRange"))];
                  break;
                }
                args.spriteIndex = sprite;
                break;
              }

              if (segments[0] === "nr") {
                if (machine.machineId !== MI_ZXNEXT) {
                  messages = [
                    validationError(t("commands.bp.nextReg.nextOnly"))
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
                  messages = [validationError(t("commands.bp.nextReg.invalidNumber"))];
                  break;
                }
                if (regValue < 0 || regValue > 0xff) {
                  messages = [
                    validationError(t("commands.bp.nextReg.numberRange"))
                  ];
                  break;
                }

                if (filterText !== undefined) {
                  const slashAt = filterText.indexOf("/");
                  const valueText = slashAt < 0 ? filterText : filterText.substring(0, slashAt);
                  const maskText = slashAt < 0 ? undefined : filterText.substring(slashAt + 1);

                  const filterValue = parseNumericSpec(valueText);
                  if (filterValue === undefined) {
                    messages = [validationError(t("commands.bp.nextReg.invalidValueFilter"))];
                    break;
                  }

                  let filterMask: number | undefined;
                  if (maskText !== undefined) {
                    filterMask = parseNumericSpec(maskText);
                    if (filterMask === undefined) {
                      messages = [validationError(t("commands.bp.nextReg.invalidValueMask"))];
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

              // --- `<bank>:+<offset>` — bank-relative: an offset inside a 16K bank, firing
              // --- wherever that bank is paged. `+` cannot begin an address literal (`$`, a digit
              // --- or `%`), so this cannot be confused with the absolute `<partition>:<address>`
              // --- form, and no existing spelling changes meaning. Every machine with a bank space
              // --- has them: the Next, the 128K family, the 48K and the Timex (banks 5, 2, 0).
              if (segments[1].startsWith("+")) {
                const bankSpace = bankSpaceFor(machine.machineId);
                if (!bankSpace?.bankBreakpoints) {
                  messages = [
                    validationError(t("commands.bp.bank.notSupported"))
                  ];
                  break;
                }

                // --- The bank is a 16K bank number in plain hex, *not* a partition label: on the
                // --- Next the label map describes 8K pages, and routing a bank through it is how
                // --- the two index spaces got confused. See `.plans/NEX_DEBUGGING_PLAN.md` §4.1.
                const bank = parseInt(segments[0], 16);
                if (!Number.isInteger(bank) || bank < 0 || bank > bankSpace.maxBank) {
                  messages = [
                    validationError(t("commands.bp.bank.invalid", { maxBank: toHexa2(bankSpace.maxBank) }))
                  ];
                  break;
                }
                if (bankSpace.candidateAddresses({ bank, offset: 0 }).length === 0) {
                  messages = [validationError(t("commands.bp.bank.notInMemory", { bank: toHexa2(bank) }))];
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
                  messages = [validationError(t("commands.bp.bank.invalidOffset"))];
                  break;
                }
                const offsetInfo = { value: offsetValue };
                if (offsetInfo.value < 0 || offsetInfo.value > ANNOTATION_BANK_LAST_OFFSET) {
                  messages = [
                    validationError(t("commands.bp.bank.offsetRange", { max: toHexa4(ANNOTATION_BANK_LAST_OFFSET) }))
                  ];
                  break;
                }

                args.bank = bank;
                args.bankOffset = offsetInfo.value;
                break;
              }

              // --- Check for partition support
              const roms = machine.features?.[MF_ROM] ?? 0;
              const banks = machine.features?.[MF_BANK] ?? 0;
              if (!roms && !banks) {
                messages = [
                  {
                    type: ValidationMessageType.Error,
                    message: t("commands.bp.noPartitions")
                  }
                ];
                break;
              }

              // --- Extract partition information
              const partition = await createEmuApi(context.messenger).parsePartitionLabel(
                segments[0]
              );
              if (partition === undefined) {
                messages = [{ type: ValidationMessageType.Error, message: t("commands.bp.invalidPartition") }];
                break;
              }

              args.partition = partition;

              // --- Extract address
              const tokens = parseCommand(segments[1]);
              if (tokens.length !== 1) {
                messages = [{ type: ValidationMessageType.Error, message: t("commands.bp.invalidAddress") }];
                break;
              }
              const valueInfo = getNumericTokenValue(tokens[0]);
              if (valueInfo.messages) {
                messages = [{ type: ValidationMessageType.Error, message: t("commands.bp.invalidAddress") }];
                break;
              }

              // --- Return with the info
              args.address = valueInfo.value;
            } else {
              messages = [{ type: ValidationMessageType.Error, message: t("commands.bp.invalidAddress") }];
            }
            break;
        }
      } catch (err) {
        console.error(err);
        messages = [{ type: ValidationMessageType.Error, message: t("commands.bp.invalidNumber") }];
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
      return [validationError(t("commands.bp.oneAccessOption"))];
    }

    /*
     * The NextReg rules. A NextReg breakpoint watches a machine event rather than a location, so
     * every option that names *where* to watch is meaningless on it, and the two that describe the
     * value it filters on are meaningless without it.
     */
    const isNextReg = args.nextReg !== undefined;
    if (
      args.copperIndex !== undefined &&
      (bpOptions > 0 || args["-c"] || args["-v"] !== undefined || args["-m"] !== undefined)
    ) {
      return [
        validationError(t("commands.bp.copper.noAccessOptions"))
      ];
    }
    if (
      args.spriteIndex !== undefined &&
      (bpOptions > 0 || args["-c"] || args["-v"] !== undefined || args["-m"] !== undefined)
    ) {
      return [
        validationError(t("commands.bp.sprite.noAccessOptions"))
      ];
    }
    if (args["-attr"] !== undefined) {
      if (args.spriteIndex === undefined) {
        return [validationError(t("commands.bp.attr.spriteOnly"))];
      }
      if (parseSpriteAttrList(String(args["-attr"])) === undefined) {
        return [
          validationError(t("commands.bp.attr.bytes"))
        ];
      }
    }
    if (isNextReg && bpOptions > 0) {
      return [
        validationError(t("commands.bp.nextReg.noAccessOptions"))
      ];
    }
    if (args["-v"] !== undefined && !isNextReg) {
      return [validationError(t("commands.bp.nextReg.valueOnly"))];
    }
    if (args["-c"] && !isNextReg) {
      return [validationError(t("commands.bp.nextReg.copperOnly"))];
    }
    if (isNextReg && args["-m"] !== undefined && args["-v"] === undefined) {
      // --- `-m` masks the comparison `-v` makes; on its own there is nothing to compare.
      return [validationError(t("commands.bp.nextReg.maskNeedsValue"))];
    }
    if (isNextReg && args["-v"] !== undefined && (args["-v"] < 0 || args["-v"] > 0xff)) {
      return [validationError(t("commands.bp.nextReg.valueRange"))];
    }
    if (isNextReg && args["-m"] !== undefined && (args["-m"] < 0 || args["-m"] > 0xff)) {
      return [validationError(t("commands.bp.nextReg.maskRange"))];
    }

    if (args["-m"] && !args["-i"] && !args["-o"] && !isNextReg) {
      return [
        validationError(t("commands.bp.maskIoOnly"))
      ];
    }
    if (args.partition !== undefined && (args["-i"] || args["-o"])) {
      return [validationError(t("commands.bp.partitionIo"))];
    }
    if (args.bankOffset !== undefined && (args["-i"] || args["-o"])) {
      // --- An I/O breakpoint watches a port, which has no bank.
      return [validationError(t("commands.bp.bankOffsetIo"))];
    }
    if (args["-len"] !== undefined) {
      if (!args["-r"] && !args["-w"]) {
        return [validationError(t("commands.bp.len.accessOnly"))];
      }
      const length = args["-len"];
      if (!Number.isInteger(length) || length < 1 || length > 0x1_0000) {
        return [validationError(t("commands.bp.len.range"))];
      }
      if (args.address !== undefined && args.address + length > 0x1_0000) {
        return [validationError(t("commands.bp.len.wrap"))];
      }
    }

    // --- Done.
    return messages;
  }
}

export class SetBreakpointCommand extends BreakpointWithAddressCommand {
  readonly id = "bp-set";
  get description() {
    return t("commands.bp.set.description");
  }
  // --- The first line is syntax (English); the explanations are translated (LOCALIZATION_PLAN step 12)
  get usage(): string[] {
    return [
      "bp-set <address-spec> [-r] [-w] [-i] [-o] [-c] [-m <mask>] [-v <value>] [-len <bytes>] [-attr <bytes>] [-once] [-log \"<template>\"] [-hit <spec>] [-if <condition>]",
      t("commands.usage.bpSet.len"),
      t("commands.usage.bpSet.copper"),
      t("commands.usage.bpSet.sprite"),
      t("commands.usage.bpSet.once"),
      t("commands.usage.bpSet.log", { example: '-log "[LOOP] B={B} HL={HL:hex16}"' }),
      t("commands.usage.bpSet.hit"),
      t("commands.usage.bpSet.if")
    ];
  }
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

    if (args["-once"] && args["-log"] !== undefined) {
      // --- A logpoint never stops the machine, so a one-shot one would never be spent
      return [validationError(t("commands.bp.log.noOneShot"))];
    }

    if (args["-log"] !== undefined) {
      const template = (args["-log"] = unescapeLogOption(String(args["-log"])));
      if (!template.trim()) {
        return [validationError(t("commands.bp.log.needsTemplate"))];
      }
      const result = compileLogTemplate(template, "klive", {
        ...facts,
        accessKind: accessKindOfArgs(args),
        symbols: mergedConditionSymbols()
      });
      if (result.errors.length) {
        return conditionErrorMessages(template, result.errors[0], "log");
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
        return [validationError(t("commands.bp.if.needsCondition"))];
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
    // --- A one-shot is the same breakpoint with a flag, owned by the session so no save keeps it
    // --- (O2); without `-once`, `bp-set` makes it a regular, project-owned breakpoint again
    if (args["-once"]) {
      bpDef.oneShot = true;
      bpDef.owner = { kind: "session" };
    } else if (bpDef.label && bpDef.labelFile) {
      // --- A label-anchored breakpoint lives in the sidecar whose label it names, like one set from
      // --- a bank document's gutter: the sync writes it into that file's `debug` subtree
      bpDef.owner = { kind: "sidecar", sidecar: bpDef.labelFile };
    }
    const flag = await context.emuApi.setBreakpoint(bpDef);
    let addrKey = getBreakpointDisplayKey(bpDef, this.partitionLabels);
    const hitSpec = formatHitSpec(bpDef);
    // --- The address (with an I/O mask) and the echoed options are syntax; the rest is one whole message
    const address = addrKey + ((args["-i"] || args["-o"]) && args["-m"] ? " /$" + toHexa4(args["-m"]) : "");
    const options =
      (bpDef.logMessage ? ` -log ${quoteLogTemplate(bpDef.logMessage)}` : "") +
      (hitSpec ? ` -hit ${hitSpec}` : "") +
      (bpDef.condition ? ` -if ${bpDef.condition}` : "");
    writeSuccessMessage(context.output, t(setResultKey(bpDef, flag), { address, options }));
    for (const warning of this.conditionWarnings) {
      writeMessage(context.output, t("commands.bp.set.conditionWarning", { column: warning.start + 1, message: warning.message }), "yellow");
    }
    for (const warning of this.logWarnings) {
      writeMessage(
        context.output,
        t("commands.bp.set.logWarning", { column: warning.start + 1, message: warning.message }),
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
  get description() {
    return t("commands.bp.resetHits.description");
  }
  readonly usage = "bp-reset-hits [<address-spec>] [-r] [-w] [-i] [-o] [-m <mask>] [-v <value>]";
  readonly aliases = ["bprh"];

  readonly argumentInfo: CommandArgumentInfo = {
    optional: [
      {
        name: "addrSpec"
      }
    ],
    commandOptions: ["-r", "-w", "-i", "-o", "-c", "-once"],
    namedOptions: [
      { name: "-m", type: "number" },
      { name: "-v", type: "number" },
      { name: "-len", type: "number" },
      { name: "-hit" },
      { name: "-log" },
      { name: "-attr" }
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
      writeSuccessMessage(context.output, t("commands.bp.resetHits.all"));
      return commandSuccess;
    }
    const bpDef = breakpointFromArgs(args);
    const addrKey = getBreakpointDisplayKey(bpDef, this.partitionLabels);
    if (!(await context.emuApi.resetBreakpointHits(bpDef))) {
      return commandError(t("commands.bp.resetHits.notExist", { address: addrKey }));
    }
    writeSuccessMessage(context.output, t("commands.bp.resetHits.done", { address: addrKey }));
    return commandSuccess;
  }
}

/** The condition-language kind of the breakpoint a set of `bp-*` arguments describes. */
function accessKindOfArgs(args: BreakpointWithAddressArgs): ConditionAccessKind {
  if (args.nextReg !== undefined) return "nextReg";
  if (args.copperIndex !== undefined) return "copper";
  if (args.spriteIndex !== undefined) return "sprite";
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
  what: "condition" | "log" = "condition"
): ValidationMessage[] {
  const width = Math.max(1, error.end - error.start);
  return [
    validationError(
      t(what === "log" ? "commands.bp.logTemplateError" : "commands.bp.conditionError", {
        column: error.start + 1,
        message: error.message
      })
    ),
    { type: ValidationMessageType.Info, message: `  ${condition}` },
    { type: ValidationMessageType.Info, message: `  ${" ".repeat(error.start)}${"^".repeat(width)}` }
  ];
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
  get description() {
    return t("commands.bp.lpEnable.description");
  }
  get usage(): string[] {
    return ["lp-en [<group> ...] [-d]", t("commands.usage.lpEnable.groups")];
  }
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
    writeSuccessMessage(context.output, describeLogGroups(next));
    return commandSuccess;
  }
}

/** `lp-groups`: every group the logpoints name, whether it logs, and how many logpoints it holds. */
export class ListLogpointGroupsCommand extends IdeCommandBase {
  readonly id = "lp-groups";
  get description() {
    return t("commands.bp.lpGroups.description");
  }
  readonly usage = "lp-groups";
  readonly aliases = ["lpg"];

  async execute(context: IdeCommandContext): Promise<IdeCommandResult> {
    const state = context.store.getState().logpointGroups ?? { enabled: true };
    const known = knownLogGroups((await context.emuApi.listBreakpoints()).breakpoints);
    for (const group of state.groups ?? []) if (!known.has(group)) known.set(group, 0);
    writeMessage(context.output, describeLogGroups(state), "bright-blue");
    // --- The two other DeZog comment kinds' switches (S6)
    const switches = context.store.getState().sourceComments ?? {};
    writeMessage(
      context.output,
      t("commands.bp.lpGroups.switches", {
        assertion: switches.assertion === false ? "off" : "on",
        wpmem: switches.wpmem === false ? "off" : "on"
      }),
      "bright-blue"
    );
    if (known.size === 0) {
      writeMessage(context.output, t("commands.bp.lpGroups.none"), "bright-blue");
      return commandSuccess;
    }
    // --- A narrow column: padded to the wider of the two words
    const onText = t("commands.bp.lpGroups.on");
    const offText = t("commands.bp.lpGroups.off");
    const width = Math.max(onText.length, offText.length);
    for (const [group, count] of [...known.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      const on = logGroupOn(state, group);
      writeMessage(context.output, `  [${group}] `, "bright-magenta", false);
      writeMessage(context.output, (on ? onText : offText).padEnd(width), on ? "green" : "bright-black", false);
      writeMessage(context.output, `  ${t("commands.bp.lpGroups.count", { count })}`, "cyan");
    }
    return commandSuccess;
  }
}

type CommentSwitchArgs = { "-d"?: boolean };

/**
 * `as-en [-d]` / `wp-en [-d]` (S6): switch the breakpoints of `ASSERTION` / `WPMEM` comments on or
 * off for this project, mirroring `lp-en`. Saved with the project; the build's comment breakpoints
 * are installed again at once.
 */
abstract class SourceCommentSwitchCommand extends IdeCommandBase<CommentSwitchArgs> {
  protected abstract readonly kind: "assertion" | "wpmem";
  readonly argumentInfo: CommandArgumentInfo = { commandOptions: ["-d"] };

  async execute(context: IdeCommandContext, args: CommentSwitchArgs): Promise<IdeCommandResult> {
    const current = context.store.getState().sourceComments ?? {};
    context.store.dispatch(setSourceCommentsAction({ ...current, [this.kind]: !args["-d"] }));
    await reinstallAnnotationBreakpoints(context.store, context.messenger);
    void saveProject(context.messenger);
    const off = !!args["-d"];
    const key: MessageKey =
      this.kind === "assertion"
        ? off ? "commands.bp.assertionComments.off" : "commands.bp.assertionComments.on"
        : off ? "commands.bp.wpmemComments.off" : "commands.bp.wpmemComments.on";
    writeSuccessMessage(context.output, t(key));
    return commandSuccess;
  }
}

export class EnableAssertionCommentsCommand extends SourceCommentSwitchCommand {
  protected readonly kind = "assertion" as const;
  readonly id = "as-en";
  get description() {
    return t("commands.bp.assertionComments.description");
  }
  get usage(): string[] {
    return ["as-en [-d]", t("commands.usage.annotationEnable.disable")];
  }
  readonly aliases = ["ase"];
}

export class EnableWpmemCommentsCommand extends SourceCommentSwitchCommand {
  protected readonly kind = "wpmem" as const;
  readonly id = "wp-en";
  get description() {
    return t("commands.bp.wpmemComments.description");
  }
  get usage(): string[] {
    return ["wp-en [-d]", t("commands.usage.annotationEnable.disable")];
  }
  readonly aliases = ["wpe"];
}

/** Does the group switch let this group log? */
export function logGroupOn(state: { enabled: boolean; groups?: string[] }, group: string): boolean {
  return state.enabled && (!state.groups || state.groups.includes(group.toUpperCase()));
}

/** The "Logging: ..." line `lp-en` and `lp-groups` print */
function describeLogGroups(state: { enabled: boolean; groups?: string[] }): string {
  if (!state.enabled) return t("commands.bp.logging.off");
  if (!state.groups) return t("commands.bp.logging.all");
  return state.groups.length
    ? t("commands.bp.logging.only", { groups: state.groups.join(", ") })
    : t("commands.bp.logging.noGroup");
}

/** The whole `bp-set` result message for the kind of breakpoint, set or updated */
function setResultKey(bp: BreakpointInfo, added: boolean): MessageKey {
  if (bp.logMessage) return added ? "commands.bp.set.logpointSet" : "commands.bp.set.logpointUpdated";
  if (bp.oneShot) return added ? "commands.bp.set.oneShotSet" : "commands.bp.set.oneShotUpdated";
  return added ? "commands.bp.set.breakpointSet" : "commands.bp.set.breakpointUpdated";
}

export class RemoveBreakpointCommand extends BreakpointWithAddressCommand {
  readonly id = "bp-del";
  get description() {
    return t("commands.bp.remove.description");
  }
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
      writeSuccessMessage(context.output, t("commands.bp.remove.done", { address: addrKey }));
    } else {
      // --- A comment's breakpoint cannot be deleted, only disabled (S3): say which comment it is
      const comment = (await context.emuApi.listBreakpoints()).breakpoints.find(
        (bp) =>
          bp.annotationKind &&
          bp.address === bpDef.address &&
          !!bp.memoryRead === !!bpDef.memoryRead &&
          !!bp.memoryWrite === !!bpDef.memoryWrite
      );
      if (comment) {
        return commandError(
          t("commands.bp.remove.fromComment", {
            address: addrKey,
            kind: comment.annotationKind,
            resource: comment.resource,
            line: String(comment.line),
            command: comment.annotationKind === "ASSERTION" ? "as-en -d" : "wp-en -d"
          })
        );
      }
      writeSuccessMessage(context.output, t("commands.bp.remove.notSet", { address: addrKey }));
    }
    return commandSuccess;
  }
}

export class EnableBreakpointCommand extends BreakpointWithAddressCommand {
  readonly id = "bp-en";
  get description() {
    return t("commands.bp.enable.description");
  }
  readonly usage = "bp-en <address-spec> [-r] [-w] [-i] [-o] [-d] [-c] [-m <mask>] [-v <value>]";
  readonly aliases = ["be"];

  readonly argumentInfo: CommandArgumentInfo = {
    mandatory: [
      {
        name: "addrSpec"
      }
    ],
    commandOptions: ["-r", "-w", "-i", "-o", "-d", "-c", "-once"],
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
        name: "-len",
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
        t(args["-d"] ? "commands.bp.enable.disabled" : "commands.bp.enable.enabled", { address: addrKey })
      );
    } else {
      // --- `addrKey`, not `$${toHexa4(args.address)}`: a bank-relative, source-bound or NextReg
      // --- breakpoint has no `address`, so that spelling printed `$NAN` for three of the five
      // --- shapes the command already accepted.
      return commandError(
        t("commands.bp.enable.notExist", { address: addrKey })
      );
    }
    return commandSuccess;
  }
}
