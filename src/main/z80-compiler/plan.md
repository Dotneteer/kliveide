# ZX Spectrum Next Development Simplification - Implementation Plan

## Overview

This plan addresses user feedback to simplify ZX Spectrum Next application development by introducing automatic defaults and conveniences when using `.model next`.

## Current User Experience (Pain Points)

Currently, developers must write verbose boilerplate code like this:

```z80klive
.model next

.savenex file "screen-tests.nex"
.savenex ram 768
.savenex core "3.1.0"
.savenex border 7
.savenex entryaddr $8000

.bank $02
.org $0000
.disp $8000

main:
    ; Entry point code
    ld a,3
    out ($fe),a
trap jr trap
```

### Specific Problems:
1. **Redundant `.savenex` pragmas** - Users must always specify `ram` and `border` with the same common values
2. **Verbose bank handling** - When using a single bank (most common use case), must explicitly specify `.bank $02`, `.org $0000`, and `.disp $8000`
3. **Manual address management** - Users must manage the $8000-$bfff range manually without compiler assistance

## Desired User Experience

The code should be simplified to:

```z80klive
.model next

.savenex file "screen-tests.nex"
.savenex core "3.1.0"
.savenex entryaddr $8000

main:
    ; Entry point code
    ld a,3
    out ($fe),a
trap jr trap
```

## Requirements

### R1: Automatic `.savenex` Defaults for `.model next`

When `.model next` is used, provide automatic defaults for:

- **`.savenex ram 768`** - Default to 768K RAM
- **`.savenex border 7`** - Default to border color 7
- **`.savenex entryaddr $8000`** - Default to entry address $8000

**Implementation Notes:**
- These defaults should only apply when `.model next` is specified
- If user explicitly provides these pragmas, user values override defaults
- Defaults should be applied during assembly processing, not parsing

### R2: Automatic Bank 2 Setup (Unbanked Code)

When `.model next` is used, code **without explicit `.bank` pragma** automatically:

1. Target bank 2 (standard user code bank)
2. Set `.org $8000` as the default compilation start address (can be overridden)
3. Restrict code to the $8000-$bfff range (16KB) for warnings
4. Can coexist with explicit `.bank` pragma sections in the same source

**Implementation Notes:**
- This applies to all "unbanked" code - code without `.bank` pragma
- Unbanked sections use bank 2 as their target during NEX export
- Multiple unbanked sections accumulate into bank 2 at their respective addresses
- Explicit `.bank` pragmas define separate bank segments that export independently
- The two code types cPragmas (Multi-Bank Code)

When `.model next` is used and **explicit `.bank` pragmas are present**:

1. `.bank` sections work as they currently do
2. User specifies bank number, start address, and other parameters
3. Explicit bank sections export to their specified banks independently
4. Can coexist with unbanked code in the same source file

**Implementation Notes:**
- Explicit `.bank` pragmas export to the specified bank (e.g., bank 5)
- Unbanked code exports to bank 2
- Both types can be used in the same file
- Explicit banks are independenUnbanked Code)

For unbanked code (R2), provide range guidance:

1. Track current assembly address during code emission for unbanked sections
2. If assembly address exceeds $bfff, emit **warning** (not error): `Z0902: Unbanked code address $XXXX exceeds typical bank 2 range ($8000-$bfff). This will create a gap in bank 2 when exporting to NEX. Consider using explicit .bank for separate bank layout.`
3. Warning allows the code to compile but alerts the user to potential issues
4. Note: Code CAN exceed $bfff in unbanked mode; it will create gaps in bank 2 during NEX export
 with Mixed Code

The NEX file writer must handle unbanked and banked code correctly:

1. Collect all unbanked code segments and place them in bank 2
2. Place each unbanked segment at the correct offset within bank 2 based on its address
3. If `.org $8200` is used (unbanked), place code at bank 2 offset $0200 (leaving $0000-$01ff empty)
4. Explicit `.bank` sections export to their specified banks independently
5. Verify entry address is properly set in NEX header

**Implementation Notes:**
- Bank 2 address $8000 = bank 2 offset $0000
- Bank 2 address $8200 = bank 2 offset $0200
- Unbanked segments at any address map to corresponding bank 2 offset: `bank2_offset = address - 0x8000`
- Explicit `.bank` segments are unaffected and export normally
- NEX file can contain bank 2 with gaps (empty regions)

**Implementation Notes:**
- The NEX file format uses bank-relative addressing
- Bank 2 offset $0000 corresponds to memory address $8000
- Must test NEX file loading on Next emulator/hardware

## Implementation Strategy

### Phase 1: Model Pragma Enhancement

**File:** `src/main/compiler-common/common-assembler.ts`

**Changes to `processModelPragma()` method:**

```typescript
processModelPragma(pragma: ModelPragma<TInstruction>): void {
  // ... existing code ...
  
  // After setting model type, apply Next-specific defaults
  if (modelType === SpectrumModelType.Next) {
    this.applyNextDefaults();
  }
}
```

**Add new method:**

```typescript
/**
 * Applies automatic defaults for ZX Spectrum Next model
 */
private applyNextDefaults(): void {
  // Set default .savenex ram if not explicitly set
  if (this._output.nexRamSize === undefined) {
    this._output.nexRamSize = 768;
  }
  
  // Set default .savenex border if not explicitly set
  if (this._output.nexBorderColor === undefined) {
    this._output.nexBorderColor = 7;
  }
  
  // Set default .savenex entryaddr if not explicitly set
  if (this._output.nexEntryAddress === undefined) {
    this._output.nexEntryAddress = 0x8000;
  }
  
  // Mark that we're in automatic Next mode (for unbanked code handling)
  this._output.isNextAutoMode = true;
}
```

**Add tracking field:**

```typescript
// In AssemblerOutput interface (src/main/compiler-common/assembler-in-out.ts)
export interface AssemblerOutput<TInstruction, TToken> {
  // ... existing fields ...
  
  /**
   * Indicates if automatic Next defaults are active
   */
  isNextAutoMode?: boolean;
  
  /**
   * Tracks if user explicitly used .bank pragma
   */
  hasExplicitBankPragma?: boolean;
}
```

### Phase 2: Unbanked Code Tracking

**File:** `src/main/compiler-common/common-assembler.ts`

**Add tracking fields:**

```typescript
// In AssemblerOutput interface (src/main/compiler-common/assembler-in-out.ts)
export interface AssemblerOutput<TInstruction, TToken> {
  // ... existing fields ...
  
  /**
   * Indicates if automatic Next defaults are active
   */
  isNextAutoMode?: boolean;
  
  /**
   * Segments that are unbanked (no .bank pragma) - used for bank 2 mapping
   */
  unbankedSegments?: BinarySegment[];
}
```

**Note:** Instead of detecting if `.bank` is used anywhere (which would disable auto-mode), we now track which segments are unbanked. Each segment created without a `.bank` pragma is added to `unbankedSegments` array. Segments created with `.bank` pragma work normally and are not in this array.

**Modify `processOrgPragma()` method:**

Add logic to mark segments as unbanked when `.org` is used without a preceding `.bank`:

```typescript
async processOrgPragma(
  pragma: OrgPragma<TInstruction, TToken>,
  label: string | null
): Promise<void> {
  const value = this.evaluateExprImmediate(pragma.address);
  if (!value.isValid) {
    return;
  }

  this.ensureCodeSegment();
  
  // Mark new segments as unbanked if we're in Next auto mode
  if (this._output.isNextAutoMode && !this._currentSegment.bank) {
    if (!this._output.unbankedSegments) {
      this._output.unbankedSegments = [];
    }
    this._output.unbankedSegments.push(this._currentSegment);
  }
  
  if (this._currentSegment.currentOffset) {
    // ... existing code ...
  } else {
    this._currentSegment.startAddress = value.value;
  }

  if (!label) {
    return;
  }

  // ... rest of existing implementation ...
}
```

### Phase 3: Automatic Unbanked Segment Setup

**File:** `src/main/compiler-common/common-assembler.ts`

**Add method to establish default org for unbanked code:**

```typescript
/**
 * Sets up automatic .org $8000 for unbanked Next code
 * Called during initial assembly setup if conditions are met
 */
private setupNextUnbankedCodeDefaults(): void {
  if (!this._output.isNextAutoMode) {
    return; // Not in auto mode
  }
  
  // Create initial segment for unbanked code
  // It starts at $8000 by default, but can be overridden with .org
  this.ensureCodeSegment();
  
  // Mark this initial segment as unbanked
  if (!this._output.unbankedSegments) {
    this._output.unbankedSegments = [];
  }
  
  // Set default start address if no .org has been specified yet
  if (this._currentSegment.startAddress === undefined) {
    this._currentSegment.startAddress = 0x8000;
  }
  
  this._output.unbankedSegments.push(this._currentSegment);
}
```

**Call this method from the assembly process:**

Call `setupNextUnbankedCodeDefaults()` before processing assembly lines if model is Next:

```typescript
// In compileProgram() or similar initialization
if (this._output.isNextAutoMode) {
  this.setupNextUnbankedCodeDefaults();
}
```

### Phase 4: Code Range Validation (Unbanked Code)

**File:** `src/main/compiler-common/common-assembler.ts`

**Add range check to emit logic:**

```typescript
/**
 * Checks if current unbanked code exceeds typical range
 */
protected checkUnbankedCodeRange(): void {
  if (!this._output.isNextAutoMode || !this._currentSegment || this._currentSegment.bank) {
    return; // Not in auto mode or segment is banked
  }
  
  const currentAddress = this.getCurrentAssemblyAddress();
  if (currentAddress > 0xbfff) {
    const line = this._currentSourceLine;
    // Report as warning, not error - code can exceed $bfff
    this.reportAssemblyWarning("Z0902", line, null, 
      currentAddress.toString(16).toUpperCase());
  }
}
```

**Call from emitByte() or similar:**

```typescript
protected emitByte(value: number): void {
  this.ensureCodeSegment();
  
  // Check for unbanked code range warning
  this.checkUnbankedCodeRange();
  
  // ... existing emit logic ...
}
```

**Add warning message:**

```typescript
// In src/main/compiler-common/assembler-errors.ts
export const warningMessages: Record<string, string> = {
  // ... existing warnings ...
  
  Z0902: "Unbanked code address $${0} exceeds typical bank 2 range ($8000-$bfff). This will create a gap in bank 2 when exporting to NEX. Consider using explicit .bank for separate bank layout."
};
```

### Phase 5: NEX File Export Integration (Unbanked Code Mapping)

**File:** `src/main/z80-compiler/nex-file-writer.ts`

**Add method to process unbanked segments into bank 2:**

```typescript
/**
 * Maps unbanked segments to bank 2 in the NEX file
 * Handles gaps and overlapping segments correctly
 */
private mapUnbankedSegmentsToBank2(segments: BinarySegment[]): void {
  if (!segments || segments.length === 0) {
    return;
  }
  
  // Create bank 2 data container if not already created
  if (!this.banks.has(2)) {
    this.banks.set(2, new Uint8Array(16384));
  }
  
  const bank2Data = this.banks.get(2)!;
  
  // Map each unbanked segment to bank 2
  for (const segment of segments) {
    if (segment.bank !== undefined) {
      continue; // Skip banked segments
    }
    
    // Calculate bank 2 offset from absolute address
    // Bank 2 starts at $8000, so offset = address - $8000
    const bank2Offset = segment.startAddress - 0x8000;
    
    if (bank2Offset < 0 || bank2Offset + segment.emittedCode.length > 16384) {
      // Address outside bank 2 range
      this.errors.push(
        `Unbanked code at $${segment.startAddress.toString(16).toUpperCase()} ` +
        `is outside bank 2 range ($8000-$bfff)`
      );
      continue;
    }
    
    // Copy segment data to bank 2 at correct offset
    bank2Data.set(segment.emittedCode, bank2Offset);
  }
}
```

**Modify NEX file generation to call this method:**

Call `mapUnbankedSegmentsToBank2()` before generating NEX data:

```typescript
/**
 * Generates the NEX file data
 */
generateNexFile(): Uint8Array {
  // Process unbanked segments into bank 2
  if (this.output.unbankedSegments) {
    this.mapUnbankedSegmentsToBank2(this.output.unbankedSegments);
  }
  
  // ... rest of existing NEX generation code ...
}
```

**Implementation Notes:**
- Each unbanked segment has an absolute address (e.g., $8200)
- Convert to bank 2 offset: offset = address - 0x8000
- If address is $8200, data goes to bank 2 offset $0200
- If address is $9000, data goes to bank 2 offset $1000
- Regions not covered by any segment remain empty (zeros) in bank 2
- This naturally creates gaps when code is non-contiguous

### Phase 6: Default Overriding Logic

**File:** `src/main/compiler-common/common-assembler.ts`

**Modify `.savenex` pragma processors:**

Ensure that when user explicitly sets ram or border, it overrides the defaults:

```typescript
// In processSaveNexRamPragma():
processSaveNexRamPragma(pragma: SaveNexRamPragma<TInstruction, TToken>): void {
  // ... existing validation ...
  
  this._output.nexRamSize = value.value; // Always set, overriding default
  
  // ... rest of implementation ...
}

// Similar for processSaveNexBorderPragma()
```

**Note:** The current implementation likely already does this, but verify during testing.

## Testing Strategy

### Test Suite Organization

Create new test file: `test/z80-assembler/next-auto-defaults.test.ts`

### Test Cases

#### T1: Default `.savenex` Values

```typescript
test("Next model applies default ram 768", async () => {
  const source = `.model next`;
  const output = await testCompile(source);
  expect(output.nexRamSize).toBe(768);
});

test("Next model applies default border 7", async () => {
  const source = `.model next`;
  const output = await testCompile(source);
  expect(output.nexBorderColor).toBe(7);
});

test("Next model applies default entryaddr $8000", async () => {
  const source = `.model next`;
  const output = await testCompile(source);
  expect(output.nexEntryAddress).toBe(0x8000);
});

test("Explicit ram overrides default", async () => {
  const source = `
    .model next
    .savenex ram 1792
  `;
  const output = await testCompile(source);
  expect(output.nexRamSize).toBe(1792);
});

test("Explicit border overrides default", async () => {
  const source = `
    .model next
    .savenex border 3
  `;
  const output = await testCompile(source);
  expect(output.nexBorderColor).toBe(3);
});

test("Explicit entryaddr overrides default", async () => {
  const source = `
    .model next
    .savenex entryaddr $9000
  `;
  const output = await testCompile(source);
  expect(output.nexEntryAddress).toBe(0x9000);
});
```

#### T2: Unbanked Code Mode Activation

```typescript
test("Next model without .bank creates unbanked segment at $8000", async () => {
  const source = `
    .model next
    ld a,1
  `;
  const output = await testCompile(source);
  expect(output.segments.length).toBe(1);
  expect(output.segments[0].bank).toBeUndefined(); // Unbanked
  expect(output.segments[0].startAddress).toBe(0x8000);
});

test("Unbanked and banked code can coexist", async () => {
  const source = `
    .model next
    ld a,1        ; Unbanked - goes to bank 2 at $8000
    
    .bank 5
    .org 0xC000
    ld b,2        ; Banked - goes to bank 5
  `;
  const output = await testCompile(source);
  expect(output.segments.length).toBe(2);
  expect(output.segments[0].bank).toBeUndefined(); // Unbanked
  expect(output.segments[1].bank).toBe(5); // Banked
});

test(".org overrides default $8000 for unbanked code", async () => {
  const source = `
    .model next
    .org $8200
    ld a,1
  `;
  const output = await testCompile(source);
  expect(output.segments[0].bank).toBeUndefined(); // Unbanked
  expect(output.segments[0].startAddress).toBe(0x8200);
});
```

#### T3: Code Range Validation (Unbanked Code)

```typescript
test("Unbanked code within bank 2 range compiles without warning", async () => {
  const source = `
    .model next
    .org $8000
    ld a,1  ; $8000
    nop     ; $8001
  `;
  const output = await testCompile(source);
  expect(output.warnings.length).toBe(0);
  expect(output.errors.length).toBe(0);
});

test("Unbanked code up to $bfff allows compilation", async () => {
  const source = `
    .model next
    .org $bff0
    ld a,1  ; Should succeed
    nop     ; Should succeed
  `;
  const output = await testCompile(source);
  expect(output.errors.length).toBe(0);
  // May have warnings about range, but no errors
});

test("Unbanked code beyond $bfff generates warning", async () => {
  const source = `
    .model next
    .org $c000
    ld a,1  ; This exceeds typical bank 2 range
  `;
  const output = await testCompile(source);
  // Should warn but not error - code still compiles
  expect(output.warnings.some(w => w.code === "Z0902")).toBe(true);
  expect(output.errors.length).toBe(0);
});

test("Banked code is not subject to range warnings", async () => {
  const source = `
    .model next
    .bank 5
    .org 0xC000
    ; This is explicitly banked, so no range warning
    .defs $4000, $00  ; Fill 16KB
  `;
  const output = await testCompile(source);
  expect(output.warnings.filter(w => w.code === "Z0902").length).toBe(0);
});
```

#### T4: NEX File Generation with Unbanked Code

```typescript
test("Unbanked code at $8000 maps to bank 2 offset $0000", async () => {
  const source = `
    .model next
    .savenex file "test.nex"
    .savenex entryaddr $8000
    
    ld a,7
    out ($fe),a
    ret
  `;
  const output = await testCompile(source);
  expect(output.errors.length).toBe(0);
  
  // Generate NEX file
  const writer = new NexFileWriter(output);
  const nexData = writer.generateNexFile();
  
  // Verify NEX structure
  expect(nexData).toBeDefined();
  expect(nexData.length).toBeGreaterThan(512); // Header + data
  
  // Verify bank 2 contains the code at offset 0
  const bank2Offset = 512; // After header
  expect(nexData[bank2Offset]).toBe(0x3E); // ld a
});

test("Unbanked code at $8200 maps to bank 2 offset $0200", async () => {
  const source = `
    .model next
    .savenex file "test.nex"
    .org $8200
    
    ld a,7
    out ($fe),a
    ret
  `;
  const output = await testCompile(source);
  expect(output.errors.length).toBe(0);
  
  const writer = new NexFileWriter(output);
  const nexData = writer.generateNexFile();
  
  // Verify bank 2 has the code at offset $200
  const bank2Base = 512; // After header
  const offset200 = bank2Base + 0x200;
  expect(nexData[offset200]).toBe(0x3E); // ld a
});

test("Mixed unbanked and banked code in NEX", async () => {
  const source = `
    .model next
    .savenex file "test.nex"
    
    ; Unbanked code in bank 2
    ld a,1
    
    .bank 5
    .org 0xC000
    ; Banked code in bank 5
    ld b,2
  `;
  const output = await testCompile(source);
  expect(output.errors.length).toBe(0);
  
  const writer = new NexFileWriter(output);
  const nexData = writer.generateNexFile();
  
  // Verify both banks are included
  expect(nexData).toBeDefined();
  expect(nexData.length).toBeGreaterThan(512);
});
```

#### T5: Backward Compatibility

```typescript
test("Existing explicit code unchanged - traditional multi-bank", async () => {
  const source = `
    .model next
    .savenex ram 768
    .savenex border 7
    .bank 2
    .org 0x0000
    .disp 0x8000
    
    ld a,3
  `;
  const output = await testCompile(source);
  expect(output.errors.length).toBe(0);
  expect(output.segments[0].bank).toBe(2);
  expect(output.segments[0].startAddress).toBe(0);
});

test("Non-Next models unaffected by auto-defaults", async () => {
  const source = `
    .model Spectrum48
    .org $8000
    ld a,1
  `;
  const output = await testCompile(source);
  expect(output.nexRamSize).toBeUndefined(); // No auto-defaults
  expect(output.nexBorderColor).toBeUndefined();
  expect(output.nexEntryAddress).toBeUndefined();
  expect(output.segments[0].bank).toBeUndefined(); // No unbanked tracking
});
```

#### T6: Edge Cases

```typescript
test("Empty Next program gets all defaults", async () => {
  const source = `.model next`;
  const output = await testCompile(source);
  expect(output.nexRamSize).toBe(768);
  expect(output.nexBorderColor).toBe(7);
  expect(output.nexEntryAddress).toBe(0x8000);
  expect(output.unbankedSegments?.length).toBe(1);
});

test("Multiple unbanked .org sections", async () => {
  const source = `
    .model next
    .org $8000
    ld a,1
    
    .org $8500
    ld b,2
    
    .org $9000
    ld c,3
  `;
  const output = await testCompile(source);
  expect(output.segments.length).toBe(3);
  // All should be unbanked
  expect(output.segments.every(s => s.bank === undefined)).toBe(true);
  expect(output.unbankedSegments?.length).toBe(3);
});

test("Explicit .bank disables unbanked tracking for that segment", async () => {
  const source = `
    .model next
    ld a,1        ; Unbanked
    
    .bank 3
    .org 0xC000
    ld b,2        ; Banked - not in unbanked array
  `;
  const output = await testCompile(source);
  expect(output.segments.length).toBe(2);
  expect(output.unbankedSegments?.length).toBe(1);
  expect(output.unbankedSegments![0]).toBe(output.segments[0]);
});

test(".disp works with unbanked code", async () => {
  const source = `
    .model next
    .org $8100
    .disp $8000
    ld hl,$      ; $ should be $8000 due to disp
  `;
  const output = await testCompile(source);
  expect(output.errors.length).toBe(0);
  expect(output.segments[0].displacement).toBe(0x8000);
});
```

### Integration Testing

Create `test/z80-assembler/next-integration-unbanked.test.ts`:

```typescript
test("User's original simplified syntax works", async () => {
  const source = `
    .model next
    .savenex file "screen-tests.nex"
    .savenex core "3.1.0"
    
    main:
      ld a,3
      out ($fe),a
    trap: jr trap
  `;
  
  const output = await testCompile(source);
  expect(output.errors.length).toBe(0);
  expect(output.nexRamSize).toBe(768);
  expect(output.nexBorderColor).toBe(7);
  expect(output.nexEntryAddress).toBe(0x8000); // Default
  expect(output.unbankedSegments?.length).toBe(1);
  
  // Verify NEX file can be generated
  const writer = new NexFileWriter(output);
  const nexData = writer.generateNexFile();
  expect(nexData.length).toBeGreaterThan(0);
});

test("Complex app with unbanked and banked code", async () => {
  const source = `
    .model next
    .savenex file "demo.nex"
    .savenex core "3.1.0"
    
    ; Main unbanked code in bank 2
    main:
      call initialize
      call mainLoop
      ret
    
    initialize:
      ld a,7
      out ($fe),a
      ret
    
    ; Extended code in another bank
    .bank 3
    .org 0xC000
    
    mainLoop:
      ld b,0
    loop:
      djnz loop
      ret
  `;
  
  const output = await testCompile(source);
  expect(output.errors.length).toBe(0);
  expect(output.segments.length).toBe(2);
  expect(output.unbankedSegments?.length).toBe(1);
  
  const writer = new NexFileWriter(output);
  const nexData = writer.generateNexFile();
  expect(nexData.length).toBeGreaterThan(512);
});
```

## Error Messages

Add to `src/main/compiler-common/assembler-errors.ts`:

```typescript
export type ErrorCodes = 
  // ... existing codes ...
  | "Z0902"  // Unbanked code exceeds typical bank 2 range (warning, not error)
  // ... rest ...
;

export const warningMessages: Record<string, string> = {
  // ... existing warnings ...
  
  Z0902: "Unbanked code address $${0} exceeds typical bank 2 range ($8000-$bfff). This will create a gap in bank 2 when exporting to NEX. Consider using explicit .bank for separate bank layout."
};
```

**Note:** This is a WARNING message (not an error), so the code compiles but alerts the user to a potential issue.

## Documentation Updates

### Update: `pages/z80-assembly/z80-assembler.mdx`

Add section "ZX Spectrum Next Conveniences":

```markdown
## ZX Spectrum Next Conveniences

When developing for the ZX Spectrum Next (`.model next`), the assembler provides automatic defaults and conveniences to simplify common development scenarios.

### Automatic Defaults

The following defaults are automatically applied when you use `.model next`:

- **RAM Size**: 768K (`.savenex ram 768`)
- **Border Color**: 7 (white) (`.savenex border 7`)
- **Entry Address**: $8000 (`.savenex entryaddr $8000`)

These defaults can be overridden by explicitly specifying the values.

### Unbanked Code (Simple Single-Bank Applications)

For code **without explicit `.bank` pragma**, the assembler automatically:

1. Targets bank 2 (the standard user code bank)
2. Sets code origin to $8000 by default (can be overridden with `.org`)
3. Generates a warning if code exceeds the $bfff boundary

**Example:**

```z80klive
.model next
.savenex file "simple.nex"
.savenex core "3.1.0"

main:
    ld a,7
    out ($fe),a
    ret
```

This automatically compiles to bank 2 at $8000 without requiring explicit `.bank` or `.org` pragmas. The three `.savenex` pragmas for ram, border, and entryaddr are also not needed - they use the defaults.

### Mixed Unbanked and Banked Code

You can mix unbanked code (targeting bank 2) and explicitly banked code in the same source file:

```z80klive
.model next

; Unbanked code - automatically uses bank 2 at $8000
main:
    call bankSwitcher
    ret

; Explicit bank code - uses the specified bank
.bank 3
.org 0xC000

bankSwitcher:
    ld a,3
    out ($fE),a
    ret
```

In the NEX file:
- Unbanked code is placed in bank 2 at the appropriate offsets
- Explicitly banked code is placed in its specified banks
- Both can coexist in the same program

### Unbanked Code with Custom Origin

You can override the default $8000 origin for unbanked code:

```z80klive
.model next

.org $8500         ; Unbanked code starts at $8500
    ld a,7
    out ($fe),a
    ret
```

This places the code in bank 2 at offset $0500 ($8500 - $8000).

### Enabling Multi-Bank Layout with Explicit `.bank`

Use explicit `.bank` pragmas when you need multiple separate banks:

```z80klive
.model next

.bank 2
.org 0xC000
; Bank 2 code

.bank 3
.org 0xC000
; Bank 3 code

.bank 5
.org 0xC000
; Bank 5 code
```
```

### Update: `pages/z80-assembly/pragmas.mdx`

Update `.bank` pragma documentation to mention unbanked behavior:

```markdown
## The BANK pragma

> **For ZX Spectrum Next (`.model next`):** Code **without** a `.bank` pragma automatically targets bank 2 at $8000. The `.bank` pragma is used for additional banks beyond bank 2. See [ZX Spectrum Next Conveniences](./z80-assembler#zx-spectrum-next-conveniences) for details on mixing unbanked and banked code.

... existing content ...
```

### Update: `pages/z80-assembly/savenex-reference.mdx`

Update the "Default Values" section:

```markdown
## Default Values

When using `.model next`, the following defaults are **automatically applied**:

- **ramSize**: 768 (768K RAM) - *NEW: automatic for Next*
- **borderColor**: 7 (white) - *NEW: automatic for Next*
- **entryaddr**: $8000 - *NEW: automatic for Next*
- **entryBank**: 0 (Bank 0)
- **fileHandle**: "close"
- **preserveRegs**: false (off)

For other models, defaults are:
- **ramSize**: Not set
- **borderColor**: 0 (Black)

These automatic defaults can be overridden by explicitly specifying values in `.savenex` pragmas.
```

## Implementation Checklist

- [ ] Phase 1: Model pragma enhancement (`processModelPragma()`, `applyNextDefaults()`) - include entryaddr default
- [ ] Phase 2: Unbanked code tracking (add `unbankedSegments` array)
- [ ] Phase 3: Automatic unbanked code setup (`setupNextUnbankedCodeDefaults()`)
- [ ] Phase 4: Code range validation (add Z0902 warning)
- [ ] Phase 5: NEX file export - map unbanked segments to bank 2 with correct offsets
- [ ] Phase 6: Default overriding logic verification (should already work)
- [ ] Test Suite: T1 - Default `.savenex` values (6 tests)
- [ ] Test Suite: T2 - Unbanked code mode activation (3 tests)
- [ ] Test Suite: T3 - Code range validation (4 tests)
- [ ] Test Suite: T4 - NEX file generation with unbanked code (3 tests)
- [ ] Test Suite: T5 - Backward compatibility (2 tests)
- [ ] Test Suite: T6 - Edge cases (5 tests)
- [ ] Integration Testing: User's scenario + complex app (2 tests)
- [ ] Documentation: Update `z80-assembler.mdx` with unbanked code explanation
- [ ] Documentation: Update `pragmas.mdx` with bank/unbanked note
- [ ] Documentation: Update `savenex-reference.mdx` with entryaddr default

**Total: 36 test cases**

## Risks and Considerations

### Risk 1: Unbanked Code Interpretation

**Concern:** Users might be confused about what "unbanked" means and how it maps to bank 2.

**Mitigation:**
- Clear documentation with examples showing unbanked = bank 2
- Error/warning messages that mention bank 2 mapping
- Examples showing both unbanked and explicit bank usage side-by-side

### Risk 2: NEX File Gaps

**Concern:** Unbanked code at different addresses might create gaps in bank 2 (e.g., code at $8000 and $9000 leaves $8500-$8fff empty).

**Mitigation:**
- Document this behavior clearly
- Warning message (Z0902) alerts users when code exceeds typical range
- NEX files with gaps are valid and load correctly

### Risk 3: Address Calculation Errors

**Concern:** The mapping `bank2_offset = address - 0x8000` must be correct, especially for addresses outside typical range.

**Mitigation:**
- Extensive test coverage (3 tests specifically for offset mapping)
- NEX file verification tests
- Clear code comments in implementation

### Risk 4: Backward Compatibility

**Concern:** Existing code with explicit banks and all defaults set might behave unexpectedly.

**Mitigation:**
- Explicit `.savenex` pragmas override defaults - no silent surprises
- Tests verify backward compatibility with traditional multi-bank layout
- Code that explicitly sets all values works unchanged

### Risk 5: Mixed Code Export

**Concern:** NEX writer must correctly handle segments marked as both unbanked and banked in the output.

**Mitigation:**
- New `mapUnbankedSegmentsToBank2()` method handles unbanked segments
- Existing code handles `.bank` segments unchanged
- Both types processed independently

## Future Enhancements (Out of Scope)

These are potential future improvements not included in this plan:

1. **Auto bank overflow:** Automatically create bank 3 segment when unbanked code exceeds $bfff
2. **Smart defaults:** Auto-detect best entry point instead of assuming $8000
3. **Assembler info output:** Print info message showing which segments are unbanked vs banked

## Success Criteria

The implementation will be considered successful when:

1. ✅ All 36 test cases pass
2. ✅ Existing test suite continues to pass (no regressions)
3. ✅ Documentation is updated and reviewed
4. ✅ User's original simplified example compiles successfully
5. ✅ User's original verbose example still works unchanged (backward compatibility)
6. ✅ Generated NEX files load and run correctly on Next emulator/hardware
7. ✅ Code review completed and approved

## Estimated Effort

- **Phase 1-2:** 2-3 hours (model pragma, defaults, unbanked tracking)
- **Phase 3:** 1-2 hours (automatic setup initialization)
- **Phase 4:** 1-2 hours (warning implementation)
- **Phase 5:** 3-4 hours (NEX export with offset mapping)
- **Phase 6:** 1 hour (verification)
- **Testing:** 6-8 hours (36 test cases + integration)
- **Documentation:** 2-3 hours (3 files + detailed examples)

**Total: 16-23 hours**

(Slightly higher than original due to NEX export complexity, but implementation is cleaner and more flexible)

## Step-by-Step Implementation Plan

### Step 0: Baseline Verification
**Goal:** Ensure all existing tests pass before making any changes

**Action:**
```bash
npm test -- test/z80-assembler
```

**Expected:** All tests pass. If not, fix issues before proceeding.

---

### Step 1: Add Default `.savenex` Values (ram, border, entryaddr)
**Files:** `src/main/compiler-common/common-assembler.ts`, `src/main/compiler-common/assembler-in-out.ts`

**Implementation:**
1. Add `isNextAutoMode?: boolean` to `AssemblerOutput` interface
2. Create `applyNextDefaults()` method in `CommonAssembler`
3. Call it from `processModelPragma()` when model is Next
4. Set: `nexRamSize = 768`, `nexBorderColor = 7`, `nexEntryAddress = 0x8000`

**Tests:** Create `test/z80-assembler/next-auto-defaults.test.ts`
- ✅ Next model sets ram 768
- ✅ Next model sets border 7
- ✅ Next model sets entryaddr $8000
- ✅ Explicit ram overrides default
- ✅ Explicit border overrides default
- ✅ Explicit entryaddr overrides default
- ❌ Non-Next models don't get defaults
- ❌ Empty Next program gets defaults

**Verify:**
```bash
npm test -- test/z80-assembler/next-auto-defaults.test.ts
npm test -- test/z80-assembler  # Full suite
```

---

### Step 2: Track Unbanked Segments
**Files:** `src/main/compiler-common/assembler-in-out.ts`, `src/main/compiler-common/common-assembler.ts`

**Implementation:**
1. Add `unbankedSegments?: BinarySegment[]` to `AssemblerOutput` interface
2. In `processOrgPragma()`, check if segment has no bank and add to `unbankedSegments`
3. In `setupNextUnbankedCodeDefaults()`, initialize first segment and add to `unbankedSegments`

**Tests:** Add to `next-auto-defaults.test.ts`
- ✅ Unbanked segment created at $8000 by default
- ✅ Unbanked segment has `bank === undefined`
- ✅ `.org $8200` creates unbanked segment at $8200
- ✅ Banked segment (`.bank 5`) not in unbankedSegments
- ✅ Mixed: unbanked + banked = 2 segments, 1 in unbankedSegments
- ❌ Multiple `.org` without `.bank` creates multiple unbanked segments

**Verify:**
```bash
npm test -- test/z80-assembler/next-auto-defaults.test.ts
npm test -- test/z80-assembler
```

---

### Step 3: Initialize Unbanked Code Segment
**Files:** `src/main/compiler-common/common-assembler.ts`

**Implementation:**
1. Create `setupNextUnbankedCodeDefaults()` method
2. Call it early in compilation process (after model pragma processed)
3. Creates initial segment at $8000 if no `.org` specified yet
4. Adds segment to `unbankedSegments` array

**Tests:** Add to `next-auto-defaults.test.ts`
- ✅ Empty Next program has 1 unbanked segment
- ✅ Code without `.org` compiles to $8000
- ✅ First instruction at $8000 address
- ❌ `.org` before code overrides $8000 default

**Verify:**
```bash
npm test -- test/z80-assembler/next-auto-defaults.test.ts
npm test -- test/z80-assembler
```

---

### Step 4: Add Range Warning for Unbanked Code
**Files:** `src/main/compiler-common/common-assembler.ts`, `src/main/compiler-common/assembler-errors.ts`

**Implementation:**
1. Add `Z0902` to warning messages
2. Create `checkUnbankedCodeRange()` method
3. Call from `emitByte()` or similar
4. Warn if unbanked code exceeds $bfff

**Tests:** Add to `next-auto-defaults.test.ts`
- ✅ Code at $8000-$bfff: no warnings
- ✅ Code at $bff0: no warnings
- ✅ Code at $c000: generates Z0902 warning (not error)
- ✅ Code compiles despite warning
- ❌ Banked code at $c000: no warnings

**Verify:**
```bash
npm test -- test/z80-assembler/next-auto-defaults.test.ts
npm test -- test/z80-assembler
```

---

### Step 5: Map Unbanked Segments to Bank 2 in NEX Export
**Files:** `src/main/z80-compiler/nex-file-writer.ts`

**Implementation:**
1. Create `mapUnbankedSegmentsToBank2()` method
2. Calculate offset: `bank2_offset = address - 0x8000`
3. Copy segment data to bank 2 at calculated offset
4. Call from `generateNexFile()` before building NEX
5. Handle gaps and out-of-range addresses

**Tests:** Create `test/z80-assembler/next-nex-export.test.ts`
- ✅ Unbanked code at $8000 → bank 2 offset $0000
- ✅ Unbanked code at $8200 → bank 2 offset $0200
- ✅ Gap: code at $8000 and $9000 creates gap in bank 2
- ✅ Mixed unbanked + banked code exports correctly
- ✅ NEX file loadable and valid structure
- ❌ Unbanked code below $8000: error
- ❌ Unbanked code above $bfff: warning but exports

**Verify:**
```bash
npm test -- test/z80-assembler/next-nex-export.test.ts
npm test -- test/z80-assembler
```

---

### Step 6: Integration Tests
**Files:** Create `test/z80-assembler/next-integration.test.ts`

**Implementation:**
Test complete real-world scenarios

**Tests:**
- ✅ User's simplified example (from issue)
- ✅ Complex app with unbanked + banked code
- ✅ Backward compatibility: explicit old-style code
- ✅ Multiple unbanked segments with gaps
- ✅ `.disp` with unbanked code

**Verify:**
```bash
npm test -- test/z80-assembler/next-integration.test.ts
npm test -- test/z80-assembler
```

---

### Step 7: Update Documentation
**Files:** 
- `pages/z80-assembly/z80-assembler.mdx`
- `pages/z80-assembly/pragmas.mdx`
- `pages/z80-assembly/savenex-reference.mdx`

**Implementation:**
Add "ZX Spectrum Next Conveniences" section with:
- Automatic defaults explanation
- Unbanked code behavior
- Mixed code examples
- Bank 2 offset mapping

**Verify:** Manual review of documentation

---

### Step 8: Final Verification
**Action:**
```bash
# Run full test suite
npm test -- test/z80-assembler

# Check for regressions in other areas
npm test

# Manual testing: compile real Next programs
```

**Expected:** All tests pass, no regressions

---

## Quick Reference: Test Commands

```bash
# Single test file
npm test -- test/z80-assembler/next-auto-defaults.test.ts

# All Z80 assembler tests
npm test -- test/z80-assembler

# Full test suite
npm test

# Watch mode during development
npm test -- --watch test/z80-assembler/next-auto-defaults.test.ts
```

---

## Rollback Plan

If a step fails:
1. `git stash` or `git checkout -- .` to revert changes
2. Review error messages and plan
3. Fix implementation or adjust plan
4. Retry step

---

## Progress Tracking

- [x] Step 0: Baseline verification ✓/✗
- [x] Step 1: Default savenex values (8 tests) ✅ COMPLETE - 19 tests passing
- [x] Step 2: Track unbanked segments (6 tests) ✅ COMPLETE - 25 tests passing
- [x] Step 3: Initialize unbanked segment (4 tests) ✅ COMPLETE - 32 tests passing (7 new)
- [x] Step 4: Range warning (5 tests) ✅ COMPLETE - 37 tests passing (5 new)
- [ ] Step 5: NEX export mapping (7 tests)
- [ ] Step 6: Integration tests (5 tests)
- [ ] Step 7: Documentation
- [ ] Step 8: Final verification
