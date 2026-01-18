# Test Commands - README

This folder contains unit tests for all interactive commands in the Klive IDE.

## Structure

- `test-helpers/` - Shared test utilities and mock factories
  - `mock-context.ts` - Factory functions for creating mock command contexts

- Individual test files for each command module (e.g., `BreakpointCommands.test.ts`)

## Running Tests

```bash
# Run all command tests
npm test -- commands

# Run specific command test
npm test -- commands/BreakpointCommands.test.ts

# Run with coverage
npm test -- --coverage commands
```

## Testing Patterns

### 1. Simple Commands (No Dependencies)
Example: ClearScreenCommand, NumCommand

```typescript
describe("SimpleCommand", () => {
  let command: SimpleCommand;
  let context: IdeCommandContext;

  beforeEach(() => {
    command = new SimpleCommand();
    context = createMockContext();
    vi.clearAllMocks();
  });

  it("should execute successfully", async () => {
    const result = await command.execute(context, args);
    expect(result.success).toBe(true);
  });
});
```

### 2. Commands with State
Example: ListBreakpointsCommand

```typescript
it("should list breakpoints from emuApi", async () => {
  const mockBreakpoints = [{ address: 0x8000 }];
  context.emuApi.listBreakpoints.mockResolvedValue({ 
    breakpoints: mockBreakpoints 
  });

  await command.execute(context);

  expect(context.emuApi.listBreakpoints).toHaveBeenCalled();
  expect(context.output.writeLine).toHaveBeenCalled();
});
```

### 3. Commands with IPC
Example: OpenFolderCommand

```typescript
it("should open folder via mainApi", async () => {
  const args = { folder: "/test/folder" };
  context.mainApi.openFolder.mockResolvedValue(undefined);

  const result = await command.execute(context, args);

  expect(context.mainApi.openFolder).toHaveBeenCalledWith("/test/folder");
  expect(result.success).toBe(true);
});
```

### 4. Commands with Validation
Example: SetBreakpointCommand

```typescript
describe("validateCommandArgs", () => {
  it("should validate address format", async () => {
    const args = { addrSpec: "$8000" };
    
    const messages = await command.validateCommandArgs(context, args);
    
    expect(messages).toHaveLength(0);
    expect(args.address).toBe(0x8000);
  });

  it("should reject invalid address", async () => {
    const args = { addrSpec: "invalid" };
    
    const messages = await command.validateCommandArgs(context, args);
    
    expect(messages.length).toBeGreaterThan(0);
    expect(messages[0].type).toBe(ValidationMessageType.Error);
  });
});
```

## Mock Utilities

### createMockContext()
Creates a complete mock command context with all dependencies.

```typescript
const context = createMockContext();
```

### createMockContextWithMachineState(state)
Creates a context with a specific machine state.

```typescript
const context = createMockContextWithMachineState(MachineControllerState.Running);
```

### createMockContextWithProject(folderPath)
Creates a context with an open project.

```typescript
const context = createMockContextWithProject("/test/project");
```

## Best Practices

1. **Clear mocks before each test**
   ```typescript
   beforeEach(() => {
     vi.clearAllMocks();
   });
   ```

2. **Test both success and failure paths**
   - Happy path with valid input
   - Error handling with invalid input
   - Edge cases (empty, null, boundary values)

3. **Verify mock interactions**
   ```typescript
   expect(context.emuApi.someMethod).toHaveBeenCalledWith(expectedArgs);
   expect(context.output.writeLine).toHaveBeenCalledTimes(1);
   ```

4. **Test metadata**
   ```typescript
   it("should have correct command metadata", () => {
     expect(command.id).toBe("expected-id");
     expect(command.description).toBe("expected description");
     expect(command.usage).toBe("expected usage");
     expect(command.aliases).toEqual(["alias1"]);
   });
   ```

5. **Use descriptive test names**
   - Format: "should <expected behavior> when <condition>"
   - Be specific about what is being tested

## Documentation

- [TESTING-PLAN.md](../../src/renderer/appIde/commands/TESTING-PLAN.md) - Overall testing strategy
- [TEST-CASES.md](../../src/renderer/appIde/commands/TEST-CASES.md) - Complete test case reference

## Progress Tracking

- [x] Phase 1: Simple Commands (ClearScreen ✅, ClearHistory ✅, Num ✅) - **COMPLETED**
- [ ] Phase 2: State Commands (Breakpoints, Watches)
- [ ] Phase 3: IPC Commands (OpenFolder, CloseFolder, Shell)
- [ ] Phase 4: Emulator Commands (Machine controls)
- [ ] Phase 5: Complex Validation Commands
- [ ] Phase 6: Service-Dependent Commands
- [ ] Phase 7: Remaining Commands
