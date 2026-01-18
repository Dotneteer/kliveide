import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  StartMachineCommand,
  PauseMachineCommand,
  StopMachineCommand,
  RestartMachineCommand,
  StartDebugMachineCommand,
  StepIntoMachineCommand,
  StepOverMachineCommand,
  StepOutMachineCommand
} from "@renderer/appIde/commands/MachineCommands";
import { createMockContext } from "./test-helpers/mock-context";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";

// Type assertion helper for mock context
type MockIdeCommandContext = IdeCommandContext & {
  store: any;
  emuApi: any;
};

describe("StartMachineCommand", () => {
  let command: StartMachineCommand;
  let context: MockIdeCommandContext;

  beforeEach(() => {
    command = new StartMachineCommand();
    context = createMockContext() as MockIdeCommandContext;
    vi.clearAllMocks();
  });

  describe("Command Metadata", () => {
    it("should have id 'em-start'", () => {
      expect(command.id).toBe("em-start");
    });

    it("should have correct description", () => {
      expect(command.description).toBe("Starts the emulated machine");
    });

    it("should have correct usage string", () => {
      expect(command.usage).toBe("em-start");
    });

    it("should have alias ':s'", () => {
      expect(command.aliases).toEqual([":s"]);
    });
  });

  describe("execute", () => {
    it("should start machine when in None state", async () => {
      // Arrange
      const mockStore = context.store as any;
      mockStore.getState.mockReturnValue({
        emulatorState: { machineState: MachineControllerState.None }
      });
      context.emuApi.issueMachineCommand.mockResolvedValue(undefined);

      // Act
      const result = await command.execute(context);

      // Assert
      expect(context.emuApi.issueMachineCommand).toHaveBeenCalledWith("start");
      expect(context.output.writeLine).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it("should start machine when in Paused state", async () => {
      // Arrange
      const mockStore = context.store as any;
      mockStore.getState.mockReturnValue({
        emulatorState: { machineState: MachineControllerState.Paused }
      });
      context.emuApi.issueMachineCommand.mockResolvedValue(undefined);

      // Act
      const result = await command.execute(context);

      // Assert
      expect(context.emuApi.issueMachineCommand).toHaveBeenCalledWith("start");
      expect(result.success).toBe(true);
    });

    it("should start machine when in Stopped state", async () => {
      // Arrange
      const mockStore = context.store as any;
      mockStore.getState.mockReturnValue({
        emulatorState: { machineState: MachineControllerState.Stopped }
      });
      context.emuApi.issueMachineCommand.mockResolvedValue(undefined);

      // Act
      const result = await command.execute(context);

      // Assert
      expect(context.emuApi.issueMachineCommand).toHaveBeenCalledWith("start");
      expect(result.success).toBe(true);
    });

    it("should fail when machine is already Running", async () => {
      // Arrange
      const mockStore = context.store as any;
      mockStore.getState.mockReturnValue({
        emulatorState: { machineState: MachineControllerState.Running }
      });

      // Act
      const result = await command.execute(context);

      // Assert
      expect(context.emuApi.issueMachineCommand).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.finalMessage).toContain("must be turned off");
    });

    it("should display success message when started", async () => {
      // Arrange
      const mockStore = context.store as any;
      mockStore.getState.mockReturnValue({
        emulatorState: { machineState: MachineControllerState.None }
      });
      context.emuApi.issueMachineCommand.mockResolvedValue(undefined);

      // Act
      await command.execute(context);

      // Assert
      expect(context.output.writeLine).toHaveBeenCalled();
      const calls = (context.output.writeLine as any).mock.calls;
      const message = calls.map((call: any) => call[0]).join(" ");
      expect(message).toContain("started");
    });
  });
});

describe("PauseMachineCommand", () => {
  let command: PauseMachineCommand;
  let context: MockIdeCommandContext;

  beforeEach(() => {
    command = new PauseMachineCommand();
    context = createMockContext() as MockIdeCommandContext;
    vi.clearAllMocks();
  });

  describe("Command Metadata", () => {
    it("should have id 'em-pause'", () => {
      expect(command.id).toBe("em-pause");
    });

    it("should have correct description", () => {
      expect(command.description).toBe("Pauses the started machine");
    });

    it("should have correct usage string", () => {
      expect(command.usage).toBe("em-pause");
    });

    it("should have alias ':p'", () => {
      expect(command.aliases).toEqual([":p"]);
    });
  });

  describe("execute", () => {
    it("should pause machine when Running", async () => {
      // Arrange
      const mockStore = context.store as any;
      mockStore.getState.mockReturnValue({
        emulatorState: { machineState: MachineControllerState.Running }
      });
      context.emuApi.getCpuState.mockResolvedValue({ pc: 0x8000 });
      context.emuApi.issueMachineCommand.mockResolvedValue(undefined);

      // Act
      const result = await command.execute(context);

      // Assert
      expect(context.emuApi.getCpuState).toHaveBeenCalled();
      expect(context.emuApi.issueMachineCommand).toHaveBeenCalledWith("pause");
      expect(result.success).toBe(true);
    });

    it("should fail when machine is not Running", async () => {
      // Arrange
      const mockStore = context.store as any;
      mockStore.getState.mockReturnValue({
        emulatorState: { machineState: MachineControllerState.Paused }
      });

      // Act
      const result = await command.execute(context);

      // Assert
      expect(context.emuApi.issueMachineCommand).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.finalMessage).toContain("must be running");
    });

    it("should display PC address in success message", async () => {
      // Arrange
      const mockStore = context.store as any;
      mockStore.getState.mockReturnValue({
        emulatorState: { machineState: MachineControllerState.Running }
      });
      context.emuApi.getCpuState.mockResolvedValue({ pc: 0x8000 });
      context.emuApi.issueMachineCommand.mockResolvedValue(undefined);

      // Act
      await command.execute(context);

      // Assert
      expect(context.output.writeLine).toHaveBeenCalled();
      const calls = (context.output.writeLine as any).mock.calls;
      const message = calls.map((call: any) => call[0]).join(" ");
      expect(message).toContain("paused");
      expect(message).toContain("8000");
    });
  });
});

describe("StopMachineCommand", () => {
  let command: StopMachineCommand;
  let context: MockIdeCommandContext;

  beforeEach(() => {
    command = new StopMachineCommand();
    context = createMockContext() as MockIdeCommandContext;
    vi.clearAllMocks();
  });

  describe("Command Metadata", () => {
    it("should have id 'em-stop'", () => {
      expect(command.id).toBe("em-stop");
    });

    it("should have correct description", () => {
      expect(command.description).toBe("Stops the started machine");
    });

    it("should have correct usage string", () => {
      expect(command.usage).toBe("em-stop");
    });

    it("should have alias ':h'", () => {
      expect(command.aliases).toEqual([":h"]);
    });
  });

  describe("execute", () => {
    it("should stop machine when Running", async () => {
      // Arrange
      const mockStore = context.store as any;
      mockStore.getState.mockReturnValue({
        emulatorState: { machineState: MachineControllerState.Running }
      });
      context.emuApi.getCpuState.mockResolvedValue({ pc: 0x8000 });
      context.emuApi.issueMachineCommand.mockResolvedValue(undefined);

      // Act
      const result = await command.execute(context);

      // Assert
      expect(context.emuApi.issueMachineCommand).toHaveBeenCalledWith("stop");
      expect(result.success).toBe(true);
    });

    it("should stop machine when Paused", async () => {
      // Arrange
      const mockStore = context.store as any;
      mockStore.getState.mockReturnValue({
        emulatorState: { machineState: MachineControllerState.Paused }
      });
      context.emuApi.getCpuState.mockResolvedValue({ pc: 0x8000 });
      context.emuApi.issueMachineCommand.mockResolvedValue(undefined);

      // Act
      const result = await command.execute(context);

      // Assert
      expect(context.emuApi.issueMachineCommand).toHaveBeenCalledWith("stop");
      expect(result.success).toBe(true);
    });

    it("should fail when machine is not Running or Paused", async () => {
      // Arrange
      const mockStore = context.store as any;
      mockStore.getState.mockReturnValue({
        emulatorState: { machineState: MachineControllerState.None }
      });

      // Act
      const result = await command.execute(context);

      // Assert
      expect(context.emuApi.issueMachineCommand).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.finalMessage).toContain("must be running or paused");
    });

    it("should display PC address in success message", async () => {
      // Arrange
      const mockStore = context.store as any;
      mockStore.getState.mockReturnValue({
        emulatorState: { machineState: MachineControllerState.Running }
      });
      context.emuApi.getCpuState.mockResolvedValue({ pc: 0x9000 });
      context.emuApi.issueMachineCommand.mockResolvedValue(undefined);

      // Act
      await command.execute(context);

      // Assert
      expect(context.output.writeLine).toHaveBeenCalled();
      const calls = (context.output.writeLine as any).mock.calls;
      const message = calls.map((call: any) => call[0]).join(" ");
      expect(message).toContain("stopped");
      expect(message).toContain("9000");
    });
  });
});

describe("RestartMachineCommand", () => {
  let command: RestartMachineCommand;
  let context: MockIdeCommandContext;

  beforeEach(() => {
    command = new RestartMachineCommand();
    context = createMockContext() as MockIdeCommandContext;
    vi.clearAllMocks();
  });

  describe("Command Metadata", () => {
    it("should have id 'em-restart'", () => {
      expect(command.id).toBe("em-restart");
    });

    it("should have correct description", () => {
      expect(command.description).toBe("Restarts the started machine");
    });

    it("should have correct usage string", () => {
      expect(command.usage).toBe("em-restart");
    });

    it("should have alias ':r'", () => {
      expect(command.aliases).toEqual([":r"]);
    });
  });

  describe("execute", () => {
    it("should restart machine when Running", async () => {
      // Arrange
      const mockStore = context.store as any;
      mockStore.getState.mockReturnValue({
        emulatorState: { machineState: MachineControllerState.Running }
      });
      context.emuApi.issueMachineCommand.mockResolvedValue(undefined);

      // Act
      const result = await command.execute(context);

      // Assert
      expect(context.emuApi.issueMachineCommand).toHaveBeenCalledWith("restart");
      expect(result.success).toBe(true);
    });

    it("should restart machine when Paused", async () => {
      // Arrange
      const mockStore = context.store as any;
      mockStore.getState.mockReturnValue({
        emulatorState: { machineState: MachineControllerState.Paused }
      });
      context.emuApi.issueMachineCommand.mockResolvedValue(undefined);

      // Act
      const result = await command.execute(context);

      // Assert
      expect(context.emuApi.issueMachineCommand).toHaveBeenCalledWith("restart");
      expect(result.success).toBe(true);
    });

    it("should fail when machine is not Running or Paused", async () => {
      // Arrange
      const mockStore = context.store as any;
      mockStore.getState.mockReturnValue({
        emulatorState: { machineState: MachineControllerState.None }
      });

      // Act
      const result = await command.execute(context);

      // Assert
      expect(context.emuApi.issueMachineCommand).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.finalMessage).toContain("must be running or paused");
    });

    it("should display success message", async () => {
      // Arrange
      const mockStore = context.store as any;
      mockStore.getState.mockReturnValue({
        emulatorState: { machineState: MachineControllerState.Running }
      });
      context.emuApi.issueMachineCommand.mockResolvedValue(undefined);

      // Act
      await command.execute(context);

      // Assert
      expect(context.output.writeLine).toHaveBeenCalled();
      const calls = (context.output.writeLine as any).mock.calls;
      const message = calls.map((call: any) => call[0]).join(" ");
      expect(message).toContain("restarted");
    });
  });
});

describe("StartDebugMachineCommand", () => {
  let command: StartDebugMachineCommand;
  let context: MockIdeCommandContext;

  beforeEach(() => {
    command = new StartDebugMachineCommand();
    context = createMockContext() as MockIdeCommandContext;
    vi.clearAllMocks();
  });

  describe("Command Metadata", () => {
    it("should have id 'em-debug'", () => {
      expect(command.id).toBe("em-debug");
    });

    it("should have correct description", () => {
      expect(command.description).toBe("Starts the emulated machine in debug mode");
    });

    it("should have correct usage string", () => {
      expect(command.usage).toBe("em-debug");
    });

    it("should have alias ':d'", () => {
      expect(command.aliases).toEqual([":d"]);
    });
  });

  describe("execute", () => {
    it("should start machine in debug mode when in None state", async () => {
      // Arrange
      const mockStore = context.store as any;
      mockStore.getState.mockReturnValue({
        emulatorState: { machineState: MachineControllerState.None }
      });
      context.emuApi.issueMachineCommand.mockResolvedValue(undefined);

      // Act
      const result = await command.execute(context);

      // Assert
      expect(context.emuApi.issueMachineCommand).toHaveBeenCalledWith("debug");
      expect(result.success).toBe(true);
    });

    it("should start machine in debug mode when Paused", async () => {
      // Arrange
      const mockStore = context.store as any;
      mockStore.getState.mockReturnValue({
        emulatorState: { machineState: MachineControllerState.Paused }
      });
      context.emuApi.issueMachineCommand.mockResolvedValue(undefined);

      // Act
      const result = await command.execute(context);

      // Assert
      expect(context.emuApi.issueMachineCommand).toHaveBeenCalledWith("debug");
      expect(result.success).toBe(true);
    });

    it("should start machine in debug mode when Stopped", async () => {
      // Arrange
      const mockStore = context.store as any;
      mockStore.getState.mockReturnValue({
        emulatorState: { machineState: MachineControllerState.Stopped }
      });
      context.emuApi.issueMachineCommand.mockResolvedValue(undefined);

      // Act
      const result = await command.execute(context);

      // Assert
      expect(context.emuApi.issueMachineCommand).toHaveBeenCalledWith("debug");
      expect(result.success).toBe(true);
    });

    it("should fail when machine is already Running", async () => {
      // Arrange
      const mockStore = context.store as any;
      mockStore.getState.mockReturnValue({
        emulatorState: { machineState: MachineControllerState.Running }
      });

      // Act
      const result = await command.execute(context);

      // Assert
      expect(context.emuApi.issueMachineCommand).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
    });

    it("should display debug mode success message", async () => {
      // Arrange
      const mockStore = context.store as any;
      mockStore.getState.mockReturnValue({
        emulatorState: { machineState: MachineControllerState.None }
      });
      context.emuApi.issueMachineCommand.mockResolvedValue(undefined);

      // Act
      await command.execute(context);

      // Assert
      expect(context.output.writeLine).toHaveBeenCalled();
      const calls = (context.output.writeLine as any).mock.calls;
      const message = calls.map((call: any) => call[0]).join(" ");
      expect(message).toContain("debug mode");
    });
  });
});

describe("StepIntoMachineCommand", () => {
  let command: StepIntoMachineCommand;
  let context: MockIdeCommandContext;

  beforeEach(() => {
    command = new StepIntoMachineCommand();
    context = createMockContext() as MockIdeCommandContext;
    vi.clearAllMocks();
  });

  describe("Command Metadata", () => {
    it("should have id 'em-sti'", () => {
      expect(command.id).toBe("em-sti");
    });

    it("should have correct description", () => {
      expect(command.description).toBe("Step-into the next machine instruction");
    });

    it("should have correct usage string", () => {
      expect(command.usage).toBe("em-sti");
    });

    it("should have alias ':'", () => {
      expect(command.aliases).toEqual([":"]);
    });
  });

  describe("execute", () => {
    it("should step into when machine is Paused", async () => {
      // Arrange
      const mockStore = context.store as any;
      mockStore.getState.mockReturnValue({
        emulatorState: { machineState: MachineControllerState.Paused }
      });
      context.emuApi.getCpuState.mockResolvedValue({ pc: 0x8000 });
      context.emuApi.issueMachineCommand.mockResolvedValue(undefined);

      // Act
      const result = await command.execute(context);

      // Assert
      expect(context.emuApi.issueMachineCommand).toHaveBeenCalledWith("stepInto");
      expect(result.success).toBe(true);
    });

    it("should fail when machine is not Paused", async () => {
      // Arrange
      const mockStore = context.store as any;
      mockStore.getState.mockReturnValue({
        emulatorState: { machineState: MachineControllerState.Running }
      });

      // Act
      const result = await command.execute(context);

      // Assert
      expect(context.emuApi.issueMachineCommand).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.finalMessage).toContain("must be paused");
    });

    it("should display 'Step into' message with PC", async () => {
      // Arrange
      const mockStore = context.store as any;
      mockStore.getState.mockReturnValue({
        emulatorState: { machineState: MachineControllerState.Paused }
      });
      context.emuApi.getCpuState.mockResolvedValue({ pc: 0x8000 });
      context.emuApi.issueMachineCommand.mockResolvedValue(undefined);

      // Act
      await command.execute(context);

      // Assert
      expect(context.output.writeLine).toHaveBeenCalled();
      const calls = (context.output.writeLine as any).mock.calls;
      const message = calls.map((call: any) => call[0]).join(" ");
      expect(message).toContain("Step into");
      expect(message).toContain("8000");
    });
  });
});

describe("StepOverMachineCommand", () => {
  let command: StepOverMachineCommand;
  let context: MockIdeCommandContext;

  beforeEach(() => {
    command = new StepOverMachineCommand();
    context = createMockContext() as MockIdeCommandContext;
    vi.clearAllMocks();
  });

  describe("Command Metadata", () => {
    it("should have id 'em-sto'", () => {
      expect(command.id).toBe("em-sto");
    });

    it("should have correct description", () => {
      expect(command.description).toBe("Step-over the next machine instruction");
    });

    it("should have correct usage string", () => {
      expect(command.usage).toBe("em-sto");
    });

    it("should have alias '.'", () => {
      expect(command.aliases).toEqual(["."]);
    });
  });

  describe("execute", () => {
    it("should step over when machine is Paused", async () => {
      // Arrange
      const mockStore = context.store as any;
      mockStore.getState.mockReturnValue({
        emulatorState: { machineState: MachineControllerState.Paused }
      });
      context.emuApi.getCpuState.mockResolvedValue({ pc: 0x8000 });
      context.emuApi.issueMachineCommand.mockResolvedValue(undefined);

      // Act
      const result = await command.execute(context);

      // Assert
      expect(context.emuApi.issueMachineCommand).toHaveBeenCalledWith("stepOver");
      expect(result.success).toBe(true);
    });

    it("should fail when machine is not Paused", async () => {
      // Arrange
      const mockStore = context.store as any;
      mockStore.getState.mockReturnValue({
        emulatorState: { machineState: MachineControllerState.None }
      });

      // Act
      const result = await command.execute(context);

      // Assert
      expect(context.emuApi.issueMachineCommand).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.finalMessage).toContain("must be paused");
    });

    it("should display 'Step over' message with PC", async () => {
      // Arrange
      const mockStore = context.store as any;
      mockStore.getState.mockReturnValue({
        emulatorState: { machineState: MachineControllerState.Paused }
      });
      context.emuApi.getCpuState.mockResolvedValue({ pc: 0x9000 });
      context.emuApi.issueMachineCommand.mockResolvedValue(undefined);

      // Act
      await command.execute(context);

      // Assert
      expect(context.output.writeLine).toHaveBeenCalled();
      const calls = (context.output.writeLine as any).mock.calls;
      const message = calls.map((call: any) => call[0]).join(" ");
      expect(message).toContain("Step over");
      expect(message).toContain("9000");
    });
  });
});

describe("StepOutMachineCommand", () => {
  let command: StepOutMachineCommand;
  let context: MockIdeCommandContext;

  beforeEach(() => {
    command = new StepOutMachineCommand();
    context = createMockContext() as MockIdeCommandContext;
    vi.clearAllMocks();
  });

  describe("Command Metadata", () => {
    it("should have id 'em-out'", () => {
      expect(command.id).toBe("em-out");
    });

    it("should have correct description", () => {
      expect(command.description).toBe("Step-out from the current machine subroutine");
    });

    it("should have correct usage string", () => {
      expect(command.usage).toBe("em-out");
    });

    it("should have alias ':o'", () => {
      expect(command.aliases).toEqual([":o"]);
    });
  });

  describe("execute", () => {
    it("should step out when machine is Paused", async () => {
      // Arrange
      const mockStore = context.store as any;
      mockStore.getState.mockReturnValue({
        emulatorState: { machineState: MachineControllerState.Paused }
      });
      context.emuApi.getCpuState.mockResolvedValue({ pc: 0x8000 });
      context.emuApi.issueMachineCommand.mockResolvedValue(undefined);

      // Act
      const result = await command.execute(context);

      // Assert
      expect(context.emuApi.issueMachineCommand).toHaveBeenCalledWith("stepOut");
      expect(result.success).toBe(true);
    });

    it("should fail when machine is not Paused", async () => {
      // Arrange
      const mockStore = context.store as any;
      mockStore.getState.mockReturnValue({
        emulatorState: { machineState: MachineControllerState.Stopped }
      });

      // Act
      const result = await command.execute(context);

      // Assert
      expect(context.emuApi.issueMachineCommand).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.finalMessage).toContain("must be paused");
    });

    it("should display 'Step out' message with PC", async () => {
      // Arrange
      const mockStore = context.store as any;
      mockStore.getState.mockReturnValue({
        emulatorState: { machineState: MachineControllerState.Paused }
      });
      context.emuApi.getCpuState.mockResolvedValue({ pc: 0xA000 });
      context.emuApi.issueMachineCommand.mockResolvedValue(undefined);

      // Act
      await command.execute(context);

      // Assert
      expect(context.output.writeLine).toHaveBeenCalled();
      const calls = (context.output.writeLine as any).mock.calls;
      const message = calls.map((call: any) => call[0]).join(" ");
      expect(message).toContain("Step out");
      expect(message).toContain("A000");
    });
  });
});
