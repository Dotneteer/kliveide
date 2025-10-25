# ROM Disassembly Notes for Future AI Sessions

**Date Created:** October 19, 2025  
**Project:** Klive IDE - ZX Spectrum Next ROM Disassembly  
**Purpose:** Guide for creating ROM disassemblies using Z80Disassembler

---

## Overview

This folder contains complete disassembly of the ZX Spectrum Next ROM (`enNextZX.rom`) using the project's built-in Z80N disassembler. The approach can be replicated for any ROM file requiring Z80/Z80N disassembly.

## Project Structure

### Disassembly Scripts
- **`disassemble-next-rom.ts`** - ROM 0 (bytes 0x0000-0x3FFF)
- **`disassemble-next-rom1.ts`** - ROM 1 (bytes 0x4000-0x7FFF)
- **`disassemble-next-rom2.ts`** - ROM 2 (bytes 0x8000-0xBFFF)
- **`disassemble-next-rom3.ts`** - ROM 3 (bytes 0xC000-0xFFFF)

### Output Files
- **`nextRom0.txt`** - 9,822 lines, 950 labels, 391KB
- **`nextRom1.txt`** - 9,438 lines, 974 labels, 376KB
- **`nextRom2.txt`** - 12,036 lines, 571 labels, 451KB
- **`nextRom3.txt`** - 10,600 lines, 1,072 labels, 418KB

**Total:** ~41,865 instructions, 3,567 labels, 1.6MB output

---

## Key Implementation Details

### 1. Core Dependencies

The disassembler uses the following Klive IDE components:

```typescript
import { Z80Disassembler } from "../src/renderer/appIde/disassemblers/z80-disassembler/z80-disassembler";
import { MemorySection } from "../src/renderer/appIde/disassemblers/common-types";
import { MemorySectionType } from "../src/common/abstractions/MemorySection";
import { toHexa4, toHexa2 } from "../src/renderer/appIde/services/ide-commands";
```

**Location in codebase:**
- Disassembler: `src/renderer/appIde/disassemblers/z80-disassembler/z80-disassembler.ts`
- Types: `src/renderer/appIde/disassemblers/common-types.ts`
- IDE Command reference: `src/renderer/appIde/commands/DisassemblyCommand.ts`

### 2. Pattern for Disassembling ROM Blocks

The standard pattern follows these steps:

#### Step 1: Read ROM File
```typescript
const romPath = path.join(__dirname, "../src/public/roms/enNextZX.rom");
const romData = fs.readFileSync(romPath);
```

#### Step 2: Extract Specific Block
```typescript
// Extract 16KB block starting at OFFSET
const OFFSET = 0x0000;  // or 0x4000, 0x8000, 0xC000 for other banks
const rom16k = new Uint8Array(
  romData.buffer, 
  romData.byteOffset + OFFSET, 
  16384
);
```

#### Step 3: Create Memory Section
```typescript
const memSections: MemorySection[] = [];
memSections.push(
  new MemorySection(0x0000, 0x3FFF, MemorySectionType.Disassemble)
);
```

**IMPORTANT:** The disassembly always starts at address 0x0000 regardless of the ROM bank. This makes each bank's code easier to analyze independently.

#### Step 4: Initialize Disassembler
```typescript
const disassembler = new Z80Disassembler(
  memSections,
  rom16k,
  undefined,  // partitionLabels (optional)
  {
    allowExtendedSet: true,  // Enable Z80N extended instructions
    decimalMode: false       // Use hexadecimal numbers
  }
);
```

**DisassemblyOptions:**
- `allowExtendedSet: true` - Required for Z80N (ZX Spectrum Next) instructions
- `decimalMode: false` - Use hex formatting (can be set to true for decimal)
- `noLabelPrefix` - Optional, removes "L" prefix from labels

#### Step 5: Perform Disassembly
```typescript
const result = await disassembler.disassemble(0x0000, 0x3FFF);
```

Returns `DisassemblyOutput` containing:
- `outputItems[]` - Array of `DisassemblyItem` objects
- Each item has: `address`, `opCodes[]`, `instruction`, `hasLabel`

#### Step 6: Format Output
```typescript
result.outputItems.forEach((item) => {
  const address = toHexa4(item.address);
  const opCodes = item.opCodes
    .map((oc) => toHexa2(oc))
    .join(" ")
    .padEnd(13, " ");
  
  const label = item.hasLabel
    ? `L${toHexa4(item.address)}:`.padEnd(12, " ")
    : "            ";
  
  const instruction = item.instruction;
  
  output += `${address} ${opCodes} ${label} ${instruction}\n`;
});
```

**Output Format:**
```
ADDRESS OPCODES      LABEL        INSTRUCTION
0000 F3                         di
0001 C3 EF 00                   jp L00EF
0004 45                         ld b,l
00EF 00            L00EF:       nop
```

---

## How to Create New ROM Disassemblies

### Template Script

Use this template to disassemble any ROM file:

```typescript
import * as fs from "fs";
import * as path from "path";
import { Z80Disassembler } from "../src/renderer/appIde/disassemblers/z80-disassembler/z80-disassembler";
import { MemorySection } from "../src/renderer/appIde/disassemblers/common-types";
import { MemorySectionType } from "../src/common/abstractions/MemorySection";
import { toHexa4, toHexa2 } from "../src/renderer/appIde/services/ide-commands";

async function disassembleRom() {
  try {
    // === CONFIGURATION ===
    const romPath = path.join(__dirname, "../src/public/roms/YOUR_ROM_FILE.rom");
    const romOffset = 0x0000;       // Starting byte in ROM file
    const romSize = 16384;          // Size to disassemble (16KB)
    const startAddr = 0x0000;       // Disassembly start address
    const endAddr = 0x3FFF;         // Disassembly end address
    const outputFile = "output.txt"; // Output filename
    
    // === READ ROM ===
    if (!fs.existsSync(romPath)) {
      console.error(`ROM file not found: ${romPath}`);
      process.exit(1);
    }
    
    const romData = fs.readFileSync(romPath);
    const rom = new Uint8Array(
      romData.buffer, 
      romData.byteOffset + romOffset, 
      Math.min(romSize, romData.length - romOffset)
    );
    
    console.log(`ROM size: ${romData.length} bytes`);
    console.log(`Disassembling ${rom.length} bytes...`);
    
    // === CREATE MEMORY SECTION ===
    const memSections: MemorySection[] = [];
    memSections.push(
      new MemorySection(startAddr, endAddr, MemorySectionType.Disassemble)
    );
    
    // === DISASSEMBLE ===
    const disassembler = new Z80Disassembler(
      memSections,
      rom,
      undefined,
      {
        allowExtendedSet: true,  // Set false for standard Z80 only
        decimalMode: false
      }
    );
    
    const result = await disassembler.disassemble(startAddr, endAddr);
    
    if (!result) {
      console.error("Disassembly failed");
      process.exit(1);
    }
    
    console.log(`Generated ${result.outputItems.length} disassembly items`);
    
    // === FORMAT OUTPUT ===
    let output = "";
    output += "ROM Disassembly\n";
    output += "=" .repeat(80) + "\n";
    output += `File: ${path.basename(romPath)}\n`;
    output += `Address Range: $${toHexa4(startAddr)} - $${toHexa4(endAddr)}\n`;
    output += `Total Instructions: ${result.outputItems.length}\n`;
    output += "=" .repeat(80) + "\n\n";
    
    result.outputItems.forEach((item) => {
      const address = toHexa4(item.address);
      const opCodes = item.opCodes
        .map((oc) => toHexa2(oc))
        .join(" ")
        .padEnd(13, " ");
      const label = item.hasLabel
        ? `L${toHexa4(item.address)}:`.padEnd(12, " ")
        : "            ";
      const instruction = item.instruction;
      
      output += `${address} ${opCodes} ${label} ${instruction}\n`;
    });
    
    // === SAVE OUTPUT ===
    const outputPath = path.join(__dirname, outputFile);
    fs.writeFileSync(outputPath, output, "utf-8");
    
    console.log(`\nDisassembly completed successfully!`);
    console.log(`Output saved to: ${outputPath}`);
    console.log(`File size: ${(output.length / 1024).toFixed(2)} KB`);
    
  } catch (error) {
    console.error("Error during disassembly:", error);
    process.exit(1);
  }
}

disassembleRom().then(() => {
  console.log("\nDone!");
}).catch((error) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});
```

### Running Scripts

From the `next-disassembly/` folder:

```bash
# Change to the disassembly folder
cd next-disassembly

# Run any script
npx ts-node -r tsconfig-paths/register YOUR_SCRIPT.ts

# The folder has its own tsconfig.json with paths configured
# The -r tsconfig-paths/register is REQUIRED for module path aliases like:
# - @renderer/...
# - @abstractions/...
# - @state/...
# - @emu/...
```

---

## Common Use Cases

### 1. Disassemble Entire ROM File

```typescript
// For a 64KB ROM in one pass
const rom = new Uint8Array(romData);
const memSections = [
  new MemorySection(0x0000, 0xFFFF, MemorySectionType.Disassemble)
];
const result = await disassembler.disassemble(0x0000, 0xFFFF);
```

### 2. Disassemble Specific Address Range

```typescript
// Disassemble only addresses 0x1000-0x2000
const memSections = [
  new MemorySection(0x1000, 0x2000, MemorySectionType.Disassemble)
];
const result = await disassembler.disassemble(0x1000, 0x2000);
```

### 3. Multiple ROM Banks with Actual Addresses

```typescript
// If you want ROM 1 to show as 0x4000-0x7FFF instead of 0x0000-0x3FFF:
const rom16k = new Uint8Array(romData.buffer, romData.byteOffset + 0x4000, 16384);
const memSections = [
  new MemorySection(0x4000, 0x7FFF, MemorySectionType.Disassemble)
];
const result = await disassembler.disassemble(0x4000, 0x7FFF);
```

### 4. Mixed Content (Code and Data)

```typescript
// Disassemble some sections, dump others as data
const memSections = [
  new MemorySection(0x0000, 0x1FFF, MemorySectionType.Disassemble),
  new MemorySection(0x2000, 0x2FFF, MemorySectionType.ByteArray),  // Data
  new MemorySection(0x3000, 0x3FFF, MemorySectionType.Disassemble)
];
```

---

## Memory Section Types

From `@abstractions/MemorySection`:

```typescript
enum MemorySectionType {
  Disassemble = 0,  // Disassemble as code
  ByteArray = 1,    // Show as byte data
  WordArray = 2,    // Show as word data
  Skip = 3          // Skip this section
}
```

---

## Z80N Extended Instructions

When `allowExtendedSet: true`, the disassembler recognizes ZX Spectrum Next extended instructions:

- `nextreg` - Next register operations
- `ldix`, `ldws`, `ldirx`, `lddx`, `lddrx`, `ldpirx` - Extended load instructions
- `outinb` - Extended I/O
- `mul` - Multiplication
- `swapnib`, `mirror` - Bit manipulation
- `pixeldn`, `pixelad` - Graphics operations
- `setae`, `test` - Extended operations

---

## Understanding DisassemblyCommand

The IDE's interactive disassembly command (`src/renderer/appIde/commands/DisassemblyCommand.ts`) uses the same infrastructure:

1. Gets memory from emulator: `context.emuApi.getMemoryContents()`
2. Creates memory sections based on user arguments
3. Calls `Z80Disassembler` with options
4. Formats output into `OutputPaneBuffer`
5. Opens result in IDE editor panel

Our scripts replicate steps 2-4 but output to text files instead.

---

## Troubleshooting

### Module Resolution Errors

If you get errors like `Cannot find module '@renderer/...'`:

```bash
# Always use tsconfig-paths/register
npx ts-node -r tsconfig-paths/register your-script.ts
```

### ROM File Not Found

Check the path is relative to script location:

```typescript
// From next-disassembly/ folder:
const romPath = path.join(__dirname, "../src/public/roms/YOUR_ROM.rom");
```

### Memory Overflow

For very large ROMs, process in chunks:

```typescript
// Process 16KB at a time
for (let offset = 0; offset < romData.length; offset += 0x4000) {
  const chunk = new Uint8Array(romData.buffer, offset, 0x4000);
  // ... disassemble chunk
}
```

---

## Future Enhancements

### Ideas for Extension

1. **Batch Processing** - Script to disassemble all ROM files in a directory
2. **Symbol Files** - Import/export label definitions for better readability
3. **Cross-References** - Generate call graphs and jump tables
4. **Annotation** - Add comments from known ROM documentation
5. **Diff Tool** - Compare different ROM versions
6. **HTML Output** - Generate interactive HTML with hyperlinked labels

### Adding Custom Disassemblers

The Z80Disassembler supports custom disassemblers via `ICustomDisassembler` interface:

```typescript
disassembler.setCustomDisassembler(customHandler);
```

See examples in:
- `test/z80-disassembler/zx-spectrum-48-custom.test.ts`
- `test/z80-disassembler/zx-spectrum-next-custom.test.ts`

---

## Reference Files

### Key Source Files

| File | Purpose |
|------|---------|
| `src/renderer/appIde/disassemblers/z80-disassembler/z80-disassembler.ts` | Main Z80/Z80N disassembler |
| `src/renderer/appIde/disassemblers/common-types.ts` | Types and memory section definitions |
| `src/renderer/appIde/commands/DisassemblyCommand.ts` | IDE command implementation |
| `src/renderer/appIde/services/ide-commands.ts` | Helper functions (toHexa4, etc.) |
| `test/z80-disassembler/z80-tester.ts` | Test utilities and examples |

### ROM Locations

| ROM File | Location | Size | Description |
|----------|----------|------|-------------|
| enNextZX.rom | `src/public/roms/enNextZX.rom` | 64KB | ZX Spectrum Next ROM |
| Other ROMs | `src/public/roms/` | Various | Other machine ROMs |

---

## Statistics from Current Disassembly

### ZX Spectrum Next ROM Analysis

| Bank | File Offset | Instructions | Labels | Characteristics |
|------|-------------|--------------|--------|-----------------|
| ROM 0 | 0x0000-0x3FFF | 9,815 | 950 | Boot code, system init, most complex control flow |
| ROM 1 | 0x4000-0x7FFF | 9,430 | 974 | System utilities, similar complexity |
| ROM 2 | 0x8000-0xBFFF | 12,028 | 571 | More linear code, fewer branches |
| ROM 3 | 0xC000-0xFFFF | 10,592 | 1,072 | Most branching, highest label count |

**Observations:**
- Higher instruction count doesn't always mean more labels
- ROM 2 has the most instructions but fewest labels (more data/tables?)
- ROM 3 has the most labels relative to instructions (more subroutines)

---

## Quick Reference Commands

```bash
# Disassemble all ROM banks
for i in 0 1 2 3; do
  npx ts-node -r tsconfig-paths/register next-disassembly/disassemble-next-rom${i/0/}.ts
done

# Count instructions in output
grep -c "^[0-9A-F][0-9A-F][0-9A-F][0-9A-F] " nextRom0.txt

# Count labels
grep -c "L[0-9A-F][0-9A-F][0-9A-F][0-9A-F]:" nextRom0.txt

# Extract specific address range
sed -n '/^1000 /,/^2000 /p' nextRom0.txt > partial.txt

# Find specific instruction
grep -n "jp L00EF" nextRom0.txt

# Statistics for all ROMs
for i in 0 1 2 3; do
  echo "ROM $i: $(wc -l < nextRom$i.txt) lines, $(grep -c 'L[0-9A-F][0-9A-F][0-9A-F][0-9A-F]:' nextRom$i.txt) labels"
done
```

---

## Notes for AI Assistants

### When Working on Disassembly Tasks

1. **Always check if script is in correct location** - Scripts should be in `next-disassembly/` or similar organized folder
2. **Use tsconfig-paths/register** - Required for path aliases in Klive IDE
3. **Follow the established pattern** - Use the template script as base
4. **Memory sections start at logical address** - Not necessarily file offset
5. **Z80N vs Z80** - Set `allowExtendedSet` appropriately
6. **Output formatting** - Match the established format for consistency

### Common User Requests

- "Disassemble this ROM" → Use template script
- "Different address range" → Adjust startAddr/endAddr
- "Show actual bank addresses" → Set memSection addresses to match file offset
- "Can't find module" → Check tsconfig-paths/register
- "Wrong instructions" → Check allowExtendedSet setting
- "Compare two ROMs" → Generate both, use diff tool

---

## Version History

- **2025-10-19:** Initial creation, complete ZX Spectrum Next ROM disassembly
  - Created 4 scripts for ROM banks 0-3
  - Generated ~1.6MB of disassembly output
  - Documented patterns and usage

---

**End of Notes**

For questions or updates, refer to the original disassembly scripts in this folder as working examples.
