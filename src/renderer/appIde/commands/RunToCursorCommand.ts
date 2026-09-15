import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import type { IdeCommandResult } from "@renderer/abstractions/IdeCommandResult";
import type { CommandArgumentInfo } from "@renderer/abstractions/IdeCommandInfo";
import type { BreakpointInfo } from "@abstractions/BreakpointInfo";

import { MachineControllerState } from "@abstractions/MachineControllerState";
import { getBreakpointDisplayKey } from "@common/utils/breakpoints";
import { commandError, commandSuccess, writeSuccessMessage } from "../services/ide-commands";
import {
  BreakpointWithAddressCommand,
  type BreakpointWithAddressArgs
} from "./BreakpointCommands";

/**
 * Runs the machine until it reaches one address, then stops — without leaving a breakpoint behind.
 *
 * The mechanism is a **session-owned one-shot** breakpoint, which is why this is not just sugar over
 * `bp-set` plus Continue:
 *
 * - *one-shot*, so the execution loop deletes it the moment it fires. A run-to-cursor that left a
 *   breakpoint at the cursor would make the next Continue stop there again, and the user would be
 *   left cleaning up breakpoints they never asked for.
 * - *session-owned*, so it is not written to `.kliveproject` or to a NEX's `.nex.dis` sidecar, and a
 *   scoped reset (opening a project, reloading a sidecar) does not remove it mid-run.
 *
 * The address grammar is `bp-set`'s, inherited whole — including `<bank>:+<offset>`, which is what
 * makes this work on a ZX Spectrum Next bank that is not paged in yet. That is the case worth having
 * it for: running to an offset inside a NEX's bank, wherever NextZXOS ends up paging that bank.
 *
 * See `.plans/NEX_DEBUGGING_PLAN.md` §10.4.
 */
export class RunToCursorCommand extends BreakpointWithAddressCommand {
  readonly id = "run-to";
  readonly description = "Runs the machine until it reaches the given address, then stops";
  readonly usage = "run-to <address>";
  readonly aliases = ["rtc"];

  /**
   * Only an address.
   *
   * The base class accepts `-r`/`-w`/`-i`/`-o`/`-m`, which select a memory or I/O breakpoint. None
   * of those means anything here: "run until this is read" is a watchpoint, not a cursor. Dropping
   * them from the parser's option list makes them an unknown-option error rather than a flag that is
   * quietly ignored.
   */
  readonly argumentInfo: CommandArgumentInfo = {
    mandatory: [{ name: "addrSpec" }]
  };

  async execute(
    context: IdeCommandContext,
    args: BreakpointWithAddressArgs
  ): Promise<IdeCommandResult> {
    const emuState = context.store.getState().emulatorState;
    const machineState = emuState?.machineState;
    const isRunning = machineState === MachineControllerState.Running;

    // --- A machine running in normal mode cannot be switched into debug mode from here:
    // --- `MachineController.run` returns immediately when the machine is already running, so
    // --- issuing `debug` would do nothing and the one-shot would sit there never firing. Say so
    // --- instead of arming a breakpoint that cannot work.
    if (isRunning && !emuState?.isDebugging) {
      return commandError(
        "The machine is running in normal mode. Pause it (or start it with debugging) before " +
          "running to an address."
      );
    }

    const target: BreakpointInfo = {
      address: args.address,
      partition: args.partition,
      bank: args.bank,
      bankOffset: args.bankOffset,
      resource: args.resource,
      line: args.line,
      exec: true,
      oneShot: true,
      owner: { kind: "session" }
    };

    await context.emuApi.setBreakpoint(target);
    const addrKey = getBreakpointDisplayKey(target, this.partitionLabels);

    if (isRunning) {
      // --- Already executing in debug mode: the one-shot is live from the next instruction, and
      // --- resuming an already-running machine is not a thing to do.
      writeSuccessMessage(context.output, `Running to ${addrKey}`);
      return commandSuccess;
    }

    // --- Paused resumes; stopped starts from a reset. Both are "run until you get there".
    await context.emuApi.issueMachineCommand("debug");
    writeSuccessMessage(
      context.output,
      machineState === MachineControllerState.Paused
        ? `Running to ${addrKey}`
        : `Started, running to ${addrKey}`
    );
    return commandSuccess;
  }
}
