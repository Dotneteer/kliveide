# Interactive Commands Testing - Getting Started

## What Has Been Created

This document summarizes the complete testing infrastructure created for interactive commands.

### 📁 File Structure Created

```
src/renderer/appIde/commands/
├── TESTING-PLAN.md         # Comprehensive testing strategy
├── TEST-CASES.md           # Complete test case reference (400+ test cases)
└── [existing command files...]

test/commands/
├── README.md               # Testing guide and best practices
├── test-helpers/
│   └── mock-context.ts     # Mock factory functions
├── ClearScreenCommand.test.ts        # Example: Simple command
├── NumCommand.test.ts                # Example: Command with arguments
└── BreakpointCommands.test.ts        # Example: Complex commands with IPC
```

### 📚 Documentation Created

1. **[TESTING-PLAN.md](../src/renderer/appIde/commands/TESTING-PLAN.md)**
   - Command complexity classification (8 levels)
   - Mock strategy and patterns
   - Step-by-step implementation plan (8 phases)
   - Testing patterns for each complexity level
   - Priority matrix for test implementation

2. **[TEST-CASES.md](../src/renderer/appIde/commands/TEST-CASES.md)**
   - Complete list of test cases for all 25 command files
   - ~400+ test case titles organized by command
   - Covers metadata, validation, and execution tests

3. **[test/commands/README.md](./commands/README.md)**
   - Quick start guide
   - Testing patterns and examples
   - Mock utilities documentation
   - Best practices

### 🛠️ Test Infrastructure

**Mock Context Factory** (`test/commands/test-helpers/mock-context.ts`):
- `createMockOutputBuffer()` - Mock output buffer
- `createMockStore()` - Mock Redux store
- `createMockEmuApi()` - Mock emulator API
- `createMockMainApi()` - Mock main process API
- `createMockAppServices()` - Mock IDE services
- `createMockContext()` - Complete context builder
- `createMockContextWithMachineState()` - Context with machine state
- `createMockContextWithProject()` - Context with open project

### 📝 Example Tests Created

1. **ClearScreenCommand.test.ts** (Level 1: Simple Command)
   - Basic command with no dependencies
   - Tests metadata and execution
   - Shows minimal mock usage

2. **NumCommand.test.ts** (Level 1: Simple with Args)
   - Command with argument parsing
   - Tests number conversion logic
   - Shows argument validation testing

3. **BreakpointCommands.test.ts** (Level 2-5: Complex)
   - Commands with IPC (emuApi)
   - Tests EraseAllBreakpointsCommand
   - Tests ListBreakpointsCommand
   - Shows state reading and API mocking

## Implementation Phases

### ✅ Phase 0: Foundation (COMPLETED)
- [x] Test infrastructure created
- [x] Mock factories implemented
- [x] Example tests written
- [x] Documentation complete

### ✅ Phase 1: Simple Commands (COMPLETED)
Priority: HIGH - Foundation

```bash
# Commands tested:
test/commands/
├── ClearScreenCommand.test.ts    ✅ COMPLETED
├── ClearHistoryCommand.test.ts   ✅ COMPLETED
└── NumCommand.test.ts            ✅ COMPLETED
```

**Test Results:** All 62 tests passing (4 test files)
- ClearScreenCommand: 11 tests ✅
- ClearHistoryCommand: 13 tests ✅
- NumCommand: 15 tests ✅
- BreakpointCommands (bonus): 23 tests ✅

### 🎯 Phase 2: State Commands (NEXT - Week 2)
Priority: HIGH - Foundation

```bash
# Commands to test:
test/commands/
├── ClearScreenCommand.test.ts    ✅ DONE (example)
├── ClearHistoryCommand.test.ts   📝 TODO
└── NumCommand.test.ts            ✅ DONE (example)
```

**Start with:**
```typescript
// test/commands/ClearHistoryCommand.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ClearHistoryCommand } from "@renderer/appIde/commands/ClearHistoryCommand";
import { createMockContext } from "./test-helpers/mock-context";

describe("ClearHistoryCommand", () => {
  let command: ClearHistoryCommand;
  let context: IdeCommandContext;

  beforeEach(() => {
    command = new ClearHistoryCommand();
    context = createMockContext();
    vi.clearAllMocks();
  });

  // Add tests following TEST-CASES.md
});
```

### Phase 2: State Commands (Week 2)
Priority: HIGH
- Watch commands (Add, Remove, List, EraseAll)
- Remaining breakpoint commands

### Phase 3: IPC Commands (Week 3)
Priority: MEDIUM
- OpenFolderCommand
- CloseFolderCommand
- ShellCommand

### Phase 4: Emulator Commands (Week 4)
Priority: HIGH
- All machine control commands
- SetMemoryContentCommand

### Phase 5-7: Remaining Commands (Weeks 5-8)
See TESTING-PLAN.md for details.

## How to Use This

### 1. Pick a Command to Test

Look at the priority matrix in TESTING-PLAN.md:
- Start with P0 (simple commands)
- Move to P1 (core features)
- Then P2-P4 (specialized features)

### 2. Find Test Cases

Open TEST-CASES.md and find your command's section:
```markdown
## YourCommand.ts

### YourCommand
- **Metadata Tests:**
  - should have id "..."
  - ...
- **Execution Tests:**
  - should do X when Y
  - ...
```

### 3. Create Test File

```bash
touch test/commands/YourCommand.test.ts
```

### 4. Use the Pattern

Copy from example tests:
- ClearScreenCommand.test.ts (simple)
- NumCommand.test.ts (with args)
- BreakpointCommands.test.ts (complex)

### 5. Implement Tests

Follow the test case list from TEST-CASES.md

### 6. Run Tests

```bash
# Run all command tests
npm test -- commands

# Run specific test
npm test -- commands/YourCommand.test.ts

# Watch mode
npm test -- --watch commands

# Coverage
npm test -- --coverage commands
```

## Key Patterns

### Simple Command Pattern
```typescript
it("should execute successfully", async () => {
  // Arrange
  const args = { /* ... */ };
  
  // Act
  const result = await command.execute(context, args);
  
  // Assert
  expect(result.success).toBe(true);
  expect(context.output.writeLine).toHaveBeenCalled();
});
```

### IPC Command Pattern
```typescript
it("should call API correctly", async () => {
  // Arrange
  context.emuApi.someMethod.mockResolvedValue(mockData);
  
  // Act
  await command.execute(context, args);
  
  // Assert
  expect(context.emuApi.someMethod).toHaveBeenCalledWith(expectedArgs);
});
```

### Validation Pattern
```typescript
describe("validateCommandArgs", () => {
  it("should reject invalid input", async () => {
    const args = { invalid: "data" };
    
    const messages = await command.validateCommandArgs(context, args);
    
    expect(messages.length).toBeGreaterThan(0);
    expect(messages[0].type).toBe(ValidationMessageType.Error);
  });
});
```

## Coverage Goals

Target: 80%+ overall
- 100% for simple commands (Level 1-2)
- 90%+ for medium commands (Level 3-5)
- 80%+ for complex commands (Level 6-7)

## Tips

1. **Always clear mocks**: Use `vi.clearAllMocks()` in `beforeEach`
2. **Test both paths**: Success and error cases
3. **Verify interactions**: Check that mocks were called correctly
4. **Use helpers**: Leverage mock-context.ts helpers
5. **Follow patterns**: Copy from existing examples
6. **Read docs**: Check TEST-CASES.md for comprehensive test lists

## Next Steps

1. ✅ Review TESTING-PLAN.md for strategy
2. ✅ Review TEST-CASES.md for test lists
3. ✅ Study example tests
4. 📝 Start with Phase 1 simple commands
5. 📝 Gradually move to complex commands

## Questions?

- See TESTING-PLAN.md for detailed strategies
- See TEST-CASES.md for all test case titles
- See example test files for patterns
- Follow the phase-by-phase implementation plan

---

**Created:** 2026-01-18  
**Status:** Ready for implementation  
**Next:** Start Phase 1 - Simple Commands
