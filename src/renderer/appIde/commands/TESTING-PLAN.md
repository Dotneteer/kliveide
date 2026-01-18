# Interactive Commands Testing Plan

## Overview

This document provides a comprehensive strategy for testing the interactive commands in the Klive IDE. Commands are classified by complexity level, and specific testing patterns are defined for each category.

## Command Architecture Summary

### Core Components

1. **IdeCommandBase<T>**: Abstract base class that all commands extend
   - Properties: `id`, `description`, `usage`, `aliases`, `argumentInfo`, `requiresProject`
   - Methods: `execute(context, args)`, `validateCommandArgs(context, args)`

2. **IdeCommandContext**: Execution context passed to commands
   - `commandtext`: The raw command string
   - `argTokens`: Parsed argument tokens
   - `output`: IOutputBuffer for writing results
   - `store`: Redux store with app state
   - `machineInfo`: Current machine information
   - `service`: AppServices (ideCommandsService, projectService, machineService, etc.)
   - `messenger`: IPC messenger for process communication
   - `messageSource`: Redux message source
   - `emuApi`: Emulator API for machine operations
   - `mainApi`: Main process API

3. **IdeCommandResult**: Result returned by commands
   - `success`: boolean
   - `finalMessage`: optional string message

## Command Complexity Classification

### Level 1: Simple Commands (No Dependencies)
Commands that only interact with the output buffer or perform simple operations without external dependencies.

**Examples:**
- `ClearScreenCommand` - Clears output buffer
- `ClearHistoryCommand` - Clears command history
- `NumCommand` - Converts numbers between formats

**Testing Pattern:**
- Mock: IOutputBuffer
- No need to mock: store, APIs, services
- Test: execute method, output verification

### Level 2: State-Reading Commands
Commands that read from Redux store but don't modify state or call external APIs.

**Examples:**
- `ListBreakpointsCommand` - Lists breakpoints from emuApi
- `ListWatchCommand` - Lists watch expressions from store

**Testing Pattern:**
- Mock: IOutputBuffer, store.getState(), emuApi (for read operations)
- Test: state reading, output formatting, edge cases (empty lists)

### Level 3: State-Modifying Commands
Commands that dispatch actions to Redux store.

**Examples:**
- `AddWatchCommand` - Adds watch to store
- `RemoveWatchCommand` - Removes watch from store
- `EraseAllWatchCommand` - Clears all watches

**Testing Pattern:**
- Mock: IOutputBuffer, store (with dispatch spy), emuApi
- Test: correct actions dispatched, state changes, validation

### Level 4: IPC Commands (Main Process Communication)
Commands that communicate with the main process via mainApi.

**Examples:**
- `OpenFolderCommand` - Opens folder via mainApi
- `CloseFolderCommand` - Closes folder via mainApi
- `ShellCommand` - Opens file with shell

**Testing Pattern:**
- Mock: IOutputBuffer, store, mainApi (all methods)
- Test: correct API calls, parameter passing, error handling, success/failure paths

### Level 5: Emulator Commands
Commands that control the emulator via emuApi.

**Examples:**
- `StartMachineCommand` - Starts emulation
- `PauseMachineCommand` - Pauses emulation
- `StopMachineCommand` - Stops emulation
- `SetBreakpointCommand` - Sets a breakpoint
- `SetMemoryContentCommand` - Modifies memory

**Testing Pattern:**
- Mock: IOutputBuffer, store (with machine state), emuApi (all methods)
- Test: state validation before execution, correct API calls, state transitions

### Level 6: Complex Validation Commands
Commands with complex argument parsing and validation.

**Examples:**
- `BreakpointWithAddressCommand` (base for breakpoint commands)
- `WatchWithSpecCommand` (base for watch commands)
- `SetMemoryContentCommand` - Multiple options, validation

**Testing Pattern:**
- Mock: Full context
- Test: validation logic extensively, argument parsing, edge cases, error messages

### Level 7: Service-Dependent Commands
Commands that interact with IDE services (projectService, documentService).

**Examples:**
- `NavigateToDocumentCommand` - Opens documents
- `ShowMemoryCommand` - Shows memory panel
- `SelectOutputPaneCommand` - Selects output panes
- `NewProjectCommand` - Creates new projects

**Testing Pattern:**
- Mock: Full context including AppServices with all services
- Test: service interactions, async operations, state changes

### Level 8: Dialog Commands
Commands that display dialogs.

**Examples:**
- `DisplayDialogCommand` - Shows dialogs

**Testing Pattern:**
- Mock: store (for dispatch), output
- Test: correct dialog action dispatched, validation of dialog IDs

## Mock Strategy

### Core Mock Objects

```typescript
// 1. Output Buffer Mock
const mockOutput: IOutputBuffer = {
  clear: vi.fn(),
  write: vi.fn(),
  writeLine: vi.fn(),
  color: vi.fn(),
  resetStyle: vi.fn()
};

// 2. Store Mock
const mockStore = {
  getState: vi.fn(() => mockState),
  dispatch: vi.fn()
};

// 3. EmuApi Mock
const mockEmuApi = {
  listBreakpoints: vi.fn(),
  setBreakpoint: vi.fn(),
  removeBreakpoint: vi.fn(),
  eraseAllBreakpoints: vi.fn(),
  enableBreakpoint: vi.fn(),
  getCpuState: vi.fn(),
  issueMachineCommand: vi.fn(),
  setMemoryContent: vi.fn(),
  parsePartitionLabel: vi.fn(),
  getPartitionLabels: vi.fn()
};

// 4. MainApi Mock
const mockMainApi = {
  openFolder: vi.fn(),
  closeFolder: vi.fn(),
  exitApp: vi.fn(),
  openWithShell: vi.fn(),
  createKliveProject: vi.fn(),
  setGlobalSettingsValue: vi.fn()
};

// 5. AppServices Mock
const mockAppServices: AppServices = {
  ideCommandsService: {
    clearHistory: vi.fn(),
    executeCommand: vi.fn(),
    getCommandHistory: vi.fn()
  },
  projectService: {
    getNodeForFile: vi.fn(),
    getActiveDocumentHubService: vi.fn(),
    getBreakpointAddressInfo: vi.fn()
  },
  machineService: {
    getMachineInfo: vi.fn()
  },
  outputPaneService: {},
  uiService: {},
  validationService: {},
  scriptService: {}
};

// 6. Messenger Mock
const mockMessenger = {} as MessengerBase;

// 7. Message Source Mock
const mockMessageSource = "test" as MessageSource;

// 8. Full Context Builder
function createMockContext(overrides?: Partial<IdeCommandContext>): IdeCommandContext {
  return {
    commandtext: "test-command",
    argTokens: [],
    output: mockOutput,
    store: mockStore,
    machineInfo: mockMachineInfo,
    service: mockAppServices,
    messenger: mockMessenger,
    messageSource: mockMessageSource,
    emuApi: mockEmuApi,
    mainApi: mockMainApi,
    ...overrides
  };
}
```

## Test File Structure

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CommandName } from "./CommandFile";
import { createMockContext } from "../test-helpers/mock-context";

describe("CommandName", () => {
  let command: CommandName;
  let context: IdeCommandContext;

  beforeEach(() => {
    command = new CommandName();
    context = createMockContext();
    vi.clearAllMocks();
  });

  describe("Command Metadata", () => {
    it("should have correct id", () => {
      expect(command.id).toBe("expected-id");
    });

    it("should have correct description", () => {
      expect(command.description).toBe("expected description");
    });

    it("should have correct usage", () => {
      expect(command.usage).toBe("expected usage");
    });

    it("should have correct aliases", () => {
      expect(command.aliases).toEqual(["alias1", "alias2"]);
    });
  });

  describe("execute", () => {
    it("should execute successfully with valid input", async () => {
      // Arrange
      const args = { /* test args */ };

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(result.success).toBe(true);
      expect(result.finalMessage).toBe("expected message");
    });

    it("should handle error cases", async () => {
      // Test error scenarios
    });
  });

  describe("validateCommandArgs", () => {
    // If command has validation
    it("should validate correct arguments", async () => {
      // Test validation
    });

    it("should reject invalid arguments", async () => {
      // Test validation errors
    });
  });
});
```

## Step-by-Step Implementation Plan

### Phase 1: Setup and Simple Commands (Week 1)
**Priority: HIGH - Foundation**

1. Create test infrastructure
   - Create `/test/commands/` folder
   - Create `/test/commands/test-helpers/` folder
   - Create mock factories in `test-helpers/mock-context.ts`
   - Create shared test utilities

2. Test Level 1 Commands (Simplest, no dependencies)
   - `ClearScreenCommand.test.ts`
   - `ClearHistoryCommand.test.ts`
   - `NumCommand.test.ts`

### Phase 2: State and Output Commands (Week 2)
**Priority: HIGH - Core functionality**

3. Test Level 2 & 3 Commands (State reading/modification)
   - `ListBreakpointsCommand.test.ts`
   - `ListWatchCommand.test.ts`
   - `AddWatchCommand.test.ts`
   - `RemoveWatchCommand.test.ts`
   - `EraseAllWatchCommand.test.ts`
   - `EraseAllBreakpointsCommand.test.ts`

### Phase 3: IPC Commands (Week 3)
**Priority: MEDIUM - External communication**

4. Test Level 4 Commands (Main process communication)
   - `OpenFolderCommand.test.ts`
   - `CloseFolderCommand.test.ts`
   - `ShellCommand.test.ts`

### Phase 4: Emulator Commands (Week 4)
**Priority: HIGH - Core machine control**

5. Test Level 5 Commands (Emulator control)
   - `MachineCommands.test.ts` (all machine commands in one file)
     - StartMachineCommand
     - PauseMachineCommand
     - StopMachineCommand
     - RestartMachineCommand
     - StartDebugMachineCommand
     - StepIntoMachineCommand
     - StepOverMachineCommand
     - StepOutMachineCommand
   - `SetMemoryContentCommand.test.ts`

### Phase 5: Complex Validation Commands (Week 5)
**Priority: MEDIUM - Complex logic**

6. Test Level 6 Commands (Complex validation)
   - `BreakpointCommands.test.ts` (all breakpoint commands)
     - SetBreakpointCommand
     - RemoveBreakpointCommand
     - EnableBreakpointCommand
   - `WatchCommands.test.ts` (remaining watch command validation)

### Phase 6: Service-Dependent Commands (Week 6)
**Priority: MEDIUM - IDE integration**

7. Test Level 7 Commands (Service interactions)
   - `DocumentCommands.test.ts`
   - `ToolCommands.test.ts`
   - `NewProjectCommand.test.ts`

### Phase 7: Remaining Commands (Week 7-8)
**Priority: LOW - Specialized commands**

8. Test remaining commands
   - `DialogCommands.test.ts`
   - `DisassemblyCommand.test.ts`
   - `CompilerCommands.test.ts` (various compiler commands)
   - `SettingCommands.test.ts`
   - `ScriptCommands.test.ts`
   - `ProjectExcludedItemsCommand.test.ts`
   - `SetZ80RegisterCommand.test.ts`

## Command Priority Matrix

| Priority | Complexity | Commands | Reason |
|----------|-----------|----------|---------|
| P0 | Simple | ClearScreen, ClearHistory, Num | Easy wins, foundation |
| P1 | Medium | Watch/Breakpoint List/Add/Remove | Core debugging features |
| P1 | Medium | Machine Start/Pause/Stop | Core emulator control |
| P2 | Medium | Open/Close Folder, Shell | File operations |
| P2 | High | Breakpoint/Watch with validation | Complex but important |
| P3 | High | Document navigation, Tool commands | IDE features |
| P3 | Medium | Dialog, Settings | UI features |
| P4 | High | Compiler commands, Scripts | Build system |

## Test Coverage Goals

- **Target: 80%+ coverage** for command logic
- **100% coverage** for simple commands (Level 1-2)
- **90%+ coverage** for medium commands (Level 3-5)
- **80%+ coverage** for complex commands (Level 6-7)

## Common Test Scenarios

### For All Commands
1. Metadata verification (id, description, usage, aliases)
2. Successful execution with valid input
3. Error handling with invalid input
4. Output buffer interactions

### For Commands with Arguments
1. Argument parsing validation
2. Required vs optional arguments
3. Argument type validation
4. Argument range validation

### For Commands with Validation
1. All validation rules
2. Edge cases (empty, null, boundary values)
3. Multiple validation errors
4. Validation error messages

### For IPC Commands
1. Success path with API response
2. Error path with API error
3. Timeout scenarios (if applicable)
4. Parameter transformation

### For State-Modifying Commands
1. Correct action dispatched
2. Action payload verification
3. State transitions
4. Multiple dispatches (if applicable)

## Notes

- Use `vi.fn()` from Vitest for all mocks
- Use `beforeEach` to reset mocks between tests
- Use descriptive test names following pattern: "should <expected behavior> when <condition>"
- Group related tests using nested `describe` blocks
- Test both success and failure paths
- Include edge cases and boundary conditions
- Use type-safe mocks with proper TypeScript types

## Future Enhancements

1. Integration tests for command execution pipeline
2. End-to-end tests for command sequences
3. Performance tests for heavy commands
4. Snapshot testing for complex output formats
5. Property-based testing for validation logic
