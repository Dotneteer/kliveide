# Unit Testing Conventions

## Framework & Setup
- **Testing Framework**: Vitest 
- **Test Location**: `/test` directory with same structure as `/src`
- **Test Files**: `*.test.ts` or `*.test.tsx` files
- **Configuration**: `vitest.config.ts` in project root

## Import Patterns
```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { MyClass } from "@/path/to/source"; // Use path aliases
```

## Test Structure

### Basic Test Pattern
```typescript
describe("Component/Feature Name", () => {
  it("should describe expected behavior", () => {
    // --- Arrange (setup)
    const setup = createSetup();
    
    // --- Act (execute)
    const result = setup.performAction();
    
    // --- Assert (verify)
    expect(result).toBe(expectedValue);
  });
});
```

### Test with Setup/Teardown
```typescript
describe("Component with state", () => {
  let instance: MyClass;
  
  beforeEach(() => {
    instance = new MyClass();
    instance.initialize();
  });
  
  it("should work correctly", () => {
    // Test implementation
  });
});
```

## Common Test Patterns

### 1. Parameterized Tests
```typescript
const testCases = [
  { input: "value1", expected: 0x01 },
  { input: "value2", expected: 0x02 },
];

testCases.forEach((testCase) => {
  it(`should handle ${testCase.input}`, async () => {
    await testHelper(testCase.input, testCase.expected);
  });
});
```

### 2. Error Testing
```typescript
it("should throw error for invalid input", async () => {
  await expect(async () => {
    await functionThatShouldFail();
  }).rejects.toThrow();
});

// Or for specific error checking
expect(output.errorCount).toBe(1);
expect(output.errors[0].errorCode).toBe("Z0606");
```

### 3. State Management Tests
```typescript
it("should update state correctly", () => {
  const store = createAppStore("test");
  
  store.dispatch(actionCreator(value));
  
  const state = store.getState();
  expect(state.property).toBe(expectedValue);
});
```

## Test Helpers

### Create Helper Files
- Location: `test/[module]/test-helpers.ts`
- Purpose: Shared setup, assertions, and utilities
- Pattern: Export functions with descriptive names

```typescript
export async function testCodeEmit(source: string, ...expectedBytes: number[]): Promise<void> {
  const compiler = new Assembler();
  const output = await compiler.compile(source);
  
  expect(output.errorCount).toBe(0);
  expect(output.segments[0].emittedCode).toEqual(new Uint8Array(expectedBytes));
}

export function createTestMachine(): TestMachine {
  const machine = new TestMachine();
  machine.loadRoms();
  return machine;
}
```

### Machine/Device Testing
```typescript
export function createTestC64Machine(c64: C64Machine): void {
  c64.memoryDevice.uploadBasicRom(BASIC_ROM);
  c64.memoryDevice.uploadKernalRom(KERNAL_ROM);
  // Other setup...
}
```

## Assertions

### Common Expectations
```typescript
// Basic values
expect(value).toBe(expected);
expect(value).toEqual(expected); // for objects
expect(value).toBeDefined();
expect(value).toBeGreaterThan(0);

// Arrays/Collections
expect(array.length).toBe(3);
expect(collection.size).toBe(0);

// Async operations
await expect(promise).resolves.toBe(value);
await expect(promise).rejects.toThrow();

// Complex objects
expect(symbol.value.asLong()).toBe(123);
expect(output.segments.length).toBe(1);
```

### Error Validation
```typescript
expect(output.errorCount).toBe(params.length);
for (let i = 0; i < params.length; i++) {
  expect(output.errors[i].errorCode).toBe(expectedCode);
  expect(output.errors[i].message.indexOf(expectedText)).toBeGreaterThanOrEqual(0);
}
```

## File Organization

### Test Directory Structure
```
test/
├── [module-name]/
│   ├── feature.test.ts
│   ├── test-helpers.ts
│   └── test-data/
├── integration/
└── fixtures/
```

### Naming Conventions
- Test files: `[feature].test.ts`
- Helper files: `test-helpers.ts` or `[module]-helper.ts`
- Test classes: `TestMachine`, `TestCpu`, etc.

## Best Practices

1. **One concept per test**: Each `it()` should test one specific behavior
2. **Descriptive names**: Test names should clearly describe what's being tested
3. **AAA Pattern**: Arrange, Act, Assert with comments
4. **Helper functions**: Extract common setup into reusable helpers
5. **Async handling**: Use `async/await` for asynchronous operations
6. **Resource cleanup**: Use `beforeEach`/`afterEach` for setup/teardown
7. **Parameterized tests**: Use arrays and `forEach` for multiple similar tests
8. **Error testing**: Always test both success and failure paths

## Testing Machine Components

### CPU/Emulator Testing
```typescript
describe("Z80 CPU", () => {
  it("should handle register assignment", () => {
    const cpu = new Z80Cpu();
    cpu.af = 0x1c3d;
    
    expect(cpu.a).toEqual(0x1c);
    expect(cpu.f).toEqual(0x3d);
  });
});
```

### Memory Device Testing
```typescript
describe("Memory Device", () => {
  let machine: C64Machine;
  
  beforeEach(() => {
    machine = new C64Machine();
    createTestC64Machine(machine);
  });
  
  it("should page in ROM correctly", () => {
    machine.memoryDevice.reset();
    expect(checkBasicRomSignature(machine.memoryDevice)).toBe(true);
  });
});
```