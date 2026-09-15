import { describe, it, expect, vi, beforeEach } from "vitest";
import { MI_ZXNEXT, MF_BANK, MF_ROM } from "@common/machines/constants";

const getPartitionLabels = vi.fn();
const parsePartitionLabel = vi.fn();

vi.mock("@common/messaging/EmuApi", () => ({
  createEmuApi: () => ({ getPartitionLabels, parsePartitionLabel })
}));

import { MachineControllerState } from "@abstractions/MachineControllerState";
import { RunToCursorCommand } from "@renderer/appIde/commands/RunToCursorCommand";
import { ValidationMessageType } from "@renderer/abstractions/ValidationMessageType";

/**
 * `run-to <address>` — a session-owned one-shot breakpoint plus a resume.
 *
 * The two properties worth pinning are that the breakpoint does not outlive the run (one-shot) and
 * does not get written to a project or a sidecar (session-owned), because both failures are silent:
 * the user would find breakpoints they never set, at addresses they only wanted to reach once.
 *
 * See `.plans/NEX_DEBUGGING_PLAN.md` §10.4.
 */
function contextFor(
  machineState: MachineControllerState | undefined,
  isDebugging = false,
  machineId = MI_ZXNEXT
) {
  const setBreakpoint = vi.fn().mockResolvedValue(true);
  const issueMachineCommand = vi.fn().mockResolvedValue(undefined);
  const context: any = {
    messenger: {},
    store: { getState: () => ({ emulatorState: { machineState, isDebugging, machineId } }) },
    output: {
      write: vi.fn(),
      writeLine: vi.fn(),
      color: vi.fn(),
      resetStyle: vi.fn(),
      bold: vi.fn(),
      italic: vi.fn(),
      underline: vi.fn()
    },
    emuApi: { setBreakpoint, issueMachineCommand },
    service: {
      machineService: {
        getMachineInfo: () => ({
          machine: { machineId, features: { [MF_ROM]: 7, [MF_BANK]: 224 } }
        })
      },
      projectService: { getBreakpointAddressInfo: () => undefined }
    }
  };
  return { context, setBreakpoint, issueMachineCommand };
}

describe("RunToCursorCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPartitionLabels.mockResolvedValue({ 0: "00", 10: "0A" });
    parsePartitionLabel.mockResolvedValue(10);
  });

  it("is registered as `run-to`", () => {
    const command = new RunToCursorCommand();
    expect(command.id).toEqual("run-to");
    expect(command.aliases).toEqual(["rtc"]);
  });

  it("accepts no breakpoint-kind options", () => {
    // --- "Run until this is read" is a watchpoint, not a cursor. Leaving `-r` in the parser's
    // --- option list would make it a flag that is accepted and then ignored.
    const info = new RunToCursorCommand().argumentInfo;
    expect(info.commandOptions).toEqual(undefined);
    expect(info.namedOptions).toEqual(undefined);
  });

  describe("the address grammar", () => {
    it("takes an absolute address", async () => {
      const command = new RunToCursorCommand();
      const args: any = { addrSpec: "$8000" };
      const { context } = contextFor(MachineControllerState.Paused);
      const messages = await command.validateCommandArgs(context, args);
      expect(messages.filter((m) => m.type === ValidationMessageType.Error)).toEqual([]);
      expect(args.address).toEqual(0x8000);
    });

    it("takes a bank-relative site, which is the point of having it on the Next", async () => {
      // --- Running to an offset inside a NEX bank that is not paged in yet.
      const command = new RunToCursorCommand();
      const args: any = { addrSpec: "05:+$0100" };
      const { context } = contextFor(MachineControllerState.Paused);
      const messages = await command.validateCommandArgs(context, args);
      expect(messages.filter((m) => m.type === ValidationMessageType.Error)).toEqual([]);
      expect(args.bank).toEqual(5);
      expect(args.bankOffset).toEqual(0x0100);
    });
  });

  describe("from a paused machine", () => {
    it("arms a session-owned one-shot and resumes in debug mode", async () => {
      const { context, setBreakpoint, issueMachineCommand } = contextFor(
        MachineControllerState.Paused
      );
      const result = await new RunToCursorCommand().execute(context, { address: 0x8000 } as any);

      expect(setBreakpoint).toHaveBeenCalledWith({
        address: 0x8000,
        partition: undefined,
        bank: undefined,
        bankOffset: undefined,
        resource: undefined,
        line: undefined,
        exec: true,
        oneShot: true,
        owner: { kind: "session" }
      });
      expect(issueMachineCommand).toHaveBeenCalledWith("debug");
      expect(result.success).toEqual(true);
    });

    it("carries a bank-relative site through unchanged", async () => {
      const { context, setBreakpoint } = contextFor(MachineControllerState.Paused);
      await new RunToCursorCommand().execute(context, { bank: 5, bankOffset: 0x0100 } as any);
      expect(setBreakpoint).toHaveBeenCalledWith(
        expect.objectContaining({ bank: 5, bankOffset: 0x0100, exec: true, oneShot: true })
      );
    });

    it("arms before it resumes", async () => {
      // --- The other order races the machine to the target address.
      const order: string[] = [];
      const { context, setBreakpoint, issueMachineCommand } = contextFor(
        MachineControllerState.Paused
      );
      setBreakpoint.mockImplementation(async () => {
        order.push("breakpoint");
        return true;
      });
      issueMachineCommand.mockImplementation(async () => {
        order.push("resume");
      });

      await new RunToCursorCommand().execute(context, { address: 0x8000 } as any);
      expect(order).toEqual(["breakpoint", "resume"]);
    });

    it("never asks for a memory or I/O breakpoint", async () => {
      const { context, setBreakpoint } = contextFor(MachineControllerState.Paused);
      await new RunToCursorCommand().execute(context, { address: 0x8000 } as any);
      const bp = setBreakpoint.mock.calls[0][0];
      expect(bp.exec).toEqual(true);
      expect(bp.memoryRead).toEqual(undefined);
      expect(bp.memoryWrite).toEqual(undefined);
      expect(bp.ioRead).toEqual(undefined);
      expect(bp.ioWrite).toEqual(undefined);
    });
  });

  describe("from a stopped machine", () => {
    it("starts it in debug mode", async () => {
      const { context, setBreakpoint, issueMachineCommand } = contextFor(
        MachineControllerState.Stopped
      );
      const result = await new RunToCursorCommand().execute(context, { address: 0x8000 } as any);
      expect(setBreakpoint).toHaveBeenCalledTimes(1);
      expect(issueMachineCommand).toHaveBeenCalledWith("debug");
      expect(result.success).toEqual(true);
    });

    it("works when no machine state has been reported yet", async () => {
      const { context, issueMachineCommand } = contextFor(undefined);
      const result = await new RunToCursorCommand().execute(context, { address: 0x8000 } as any);
      expect(issueMachineCommand).toHaveBeenCalledWith("debug");
      expect(result.success).toEqual(true);
    });
  });

  describe("from a running machine", () => {
    it("arms the one-shot without resuming, when it is already debugging", async () => {
      // --- `MachineController.run` returns immediately for a machine that is already running, so
      // --- issuing `debug` here would be a no-op. The one-shot is live from the next instruction.
      const { context, setBreakpoint, issueMachineCommand } = contextFor(
        MachineControllerState.Running,
        true
      );
      const result = await new RunToCursorCommand().execute(context, { address: 0x8000 } as any);
      expect(setBreakpoint).toHaveBeenCalledTimes(1);
      expect(issueMachineCommand).not.toHaveBeenCalled();
      expect(result.success).toEqual(true);
    });

    it("refuses when it is running in normal mode", async () => {
      // --- Nothing checks breakpoints in normal mode, and this command cannot switch a running
      // --- machine into debug mode, so arming a one-shot would leave the user waiting for a stop
      // --- that can never happen.
      const { context, setBreakpoint, issueMachineCommand } = contextFor(
        MachineControllerState.Running,
        false
      );
      const result = await new RunToCursorCommand().execute(context, { address: 0x8000 } as any);

      expect(result.success).toEqual(false);
      expect(result.finalMessage).toContain("Pause it");
      expect(setBreakpoint).not.toHaveBeenCalled();
      expect(issueMachineCommand).not.toHaveBeenCalled();
    });
  });
});
