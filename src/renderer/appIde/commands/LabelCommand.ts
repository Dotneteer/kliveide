import type { CommandArgumentInfo } from "@renderer/abstractions/IdeCommandInfo";
import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import type { IdeCommandResult } from "@renderer/abstractions/IdeCommandResult";
import type { ValidationMessage } from "@renderer/abstractions/ValidationMessage";

import { MachineControllerState } from "@abstractions/MachineControllerState";
import { bankSpaceFor } from "@common/annotations/bankSpace";
import {
  commandError,
  commandSuccessWith,
  IdeCommandBase,
  toHexa2,
  toHexa4,
  validationError
} from "../services/ide-commands";
import { getAnnotationPath } from "@renderer/appIde/annotations/programAnnotations";
import {
  flushAnnotationSession,
  peekAnnotationSession,
  updateAnnotationSession
} from "@renderer/appIde/annotations/annotationSession";
import { getActiveAnnotationSet, type ActiveAnnotationSet } from "@renderer/appIde/annotations/activeAnnotationSet";
import { ensureAnnotatedBank } from "@renderer/appIde/annotations/liveAnnotationEditing";
import { liveRowTarget } from "@renderer/appIde/annotations/liveListingPort";
import { getRomPartition } from "@renderer/appIde/annotations/romAnnotations";
import { machineConfigOf } from "@renderer/appIde/annotations/useMachineBankSpace";
import { getNexLoad } from "../DocumentPanels/Next/nexLoadSession";
import { promoteLabelAt } from "../DocumentPanels/Next/nexLabelPromotion";

export type LabelCommandArgs = {
  name: string;
  address?: number;
};

/**
 * Names an address in the active annotation set: the one the machine is stopped at, or the one given.
 *
 * Closes the reverse-engineering loop: the moment you work out what a routine *is*, you are paused
 * in the debugger, and the name goes in from there; the live disassembly uses it at once.
 *
 * Works on every machine with a bank space (`.plans/REVERSE_ENGINEERING_ANNOTATIONS_PLAN.md` §4.6):
 *
 * - an address in RAM is named as a **local** label of the bank paged there, in the active set —
 *   the same routine is at a different Z80 address the next time its bank is paged elsewhere;
 * - an address in ROM is named in the page's **user layer**, your own ROM annotations (§5.3).
 *
 * The set's sidecar, or the bank in it, is created by the first label. With no set active it is
 * refused: a project gives one, as do `nex-run` and `zx-snapshot`, and `ann-new` makes one. Formerly
 * `nex-label`, which stays as an alias.
 */
export class LabelCommand extends IdeCommandBase<LabelCommandArgs> {
  readonly id = "label";
  readonly description =
    "Adds a label to the active annotations at the address the machine is stopped at (or the one given)";
  readonly aliases = ["lbl", "nex-label", "nl"];
  readonly usage = "label <name> [<address>]";

  readonly argumentInfo: CommandArgumentInfo = {
    mandatory: [{ name: "name", type: "string" }],
    optional: [{ name: "address", type: "number" }]
  };

  async validateCommandArgs(
    context: IdeCommandContext,
    args: LabelCommandArgs
  ): Promise<ValidationMessage[]> {
    const messages: ValidationMessage[] = [];

    if (!args.name?.trim()) {
      messages.push(validationError("The label name cannot be empty."));
    }

    const emuState = context.store.getState().emulatorState;
    if (!bankSpaceFor(emuState?.machineId)) {
      messages.push(validationError("This machine's memory cannot be annotated."));
    }

    /*
     * Paused, unless an address is given explicitly.
     *
     * A running machine's program counter is somewhere different by the time this command finishes
     * reading it, so naming "where we are" would name an arbitrary instruction.
     */
    if (args.address === undefined && emuState?.machineState !== MachineControllerState.Paused) {
      messages.push(
        validationError(
          "Pause the machine, or give an address — a running machine is not at one address."
        )
      );
    }

    return messages;
  }

  async execute(context: IdeCommandContext, args: LabelCommandArgs): Promise<IdeCommandResult> {
    const emu = context.store.getState().emulatorState;
    const machineId = emu?.machineId;
    const bankSpace = bankSpaceFor(machineId, machineConfigOf(machineId, emu?.modelId, emu?.config));

    // --- Where to name: the given address, or wherever the machine is stopped.
    let address = args.address;
    if (address === undefined) {
      try {
        address = (await context.emuApi.getCpuStateChunk())?.pcValue;
      } catch (err) {
        return commandError(`Could not read the program counter: ${messageOf(err)}`);
      }
    }
    if (address === undefined) {
      return commandError("Could not determine which address to name.");
    }
    address &= 0xffff;

    // --- Which bank is there *now*. The address alone does not say on a banked machine: the answer
    // --- changes as the program pages, which is why the label is bank-relative.
    let slots: (number | undefined)[] | undefined;
    try {
      slots = (await context.emuApi.getMemoryContents())?.slotPartitions;
    } catch (err) {
      return commandError(`Could not read the memory paging: ${messageOf(err)}`);
    }

    const activeSet = activeSetOf();
    const target = liveRowTarget(address, {
      bankSpace,
      slots,
      activeSet,
      romPartition: getRomPartition
    });
    if (!("annotationPath" in target)) {
      const site = bankSpace?.siteAt(address, slots);
      return commandError(
        site?.kind === "rom" || !site
          ? `$${toHexa4(address)} is not in a RAM bank — there is no bank offset to name.`
          : target.disabledReason
      );
    }

    // --- A launched NEX: only its own banks are its annotations' business
    const nex = getNexLoad();
    if (target.kind === "bank" && nex && activeSet?.path === getAnnotationPath(nex.path)) {
      if (!nex.banks.includes(target.bank)) {
        return commandError(
          `Bank $${toHexa2(target.bank)} is paged in at $${toHexa4(address)}, but ${nex.fileName} ` +
            "does not contain it."
        );
      }
    }

    const projectService = context.service.projectService;
    let annotations;
    try {
      annotations = await ensureAnnotatedBank(target, projectService);
    } catch (err) {
      return commandError(`Could not create ${target.annotationPath}: ${messageOf(err)}`);
    }
    if (!annotations) {
      return commandError(`${target.annotationPath} cannot be read, so no label was added to it.`);
    }

    // --- The session's copy wins: a viewer may have published an edit whose write has not landed
    const current = peekAnnotationSession(target.annotationPath) ?? annotations;
    const promoted = promoteLabelAt(current, { bank: target.bank, bankOffset: target.offset }, args.name);
    if (!promoted.ok) {
      return commandError(promoted.error);
    }

    updateAnnotationSession(target.annotationPath, promoted.annotations!, projectService);
    await flushAnnotationSession(target.annotationPath);

    const where =
      target.kind === "rom"
        ? `ROM offset $${toHexa4(target.offset)} in your ROM annotations (address $${toHexa4(address)})`
        : `bank $${toHexa2(target.bank)} offset $${toHexa4(target.offset)} (address $${toHexa4(address)})`;
    const alsoNamed = promoted.replaced ? ` It is also named ${promoted.replaced}.` : "";
    return commandSuccessWith(`${args.name.trim()} added at ${where}.${alsoNamed}`);
  }
}

/**
 * The active set, or the launched NEX's sidecar for a session that launched one before the active
 * set existed to record it.
 */
function activeSetOf(): ActiveAnnotationSet | undefined {
  const active = getActiveAnnotationSet();
  if (active) return active;
  const nex = getNexLoad();
  return nex
    ? { path: getAnnotationPath(nex.path), hostPath: nex.path, machine: "next", reason: "nex-run" }
    : undefined;
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
