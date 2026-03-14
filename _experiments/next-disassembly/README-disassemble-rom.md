# ZX Spectrum Next ROM Disassembler

This script disassembles the first 16KB (ROM 0) of the ZX Spectrum Next ROM file (`enNextZX.rom`).

## Overview

The script uses the same Z80N disassembler infrastructure as the IDE's `DisassemblyCommand` to produce a complete disassembly listing of the first 16KB of the Next ROM.

## Files

- **`disassemble-next-rom.ts`** - Disassembly script for ROM 0 (first 16KB)
- **`disassemble-next-rom1.ts`** - Disassembly script for ROM 1 (second 16KB)
- **`disassemble-next-rom2.ts`** - Disassembly script for ROM 2 (third 16KB)
- **`disassemble-next-rom3.ts`** - Disassembly script for ROM 3 (fourth 16KB)
- **Output:** `nextRom0.txt` - ROM 0 disassembly in workspace root
- **Output:** `nextRom1.txt` - ROM 1 disassembly in workspace root
- **Output:** `nextRom2.txt` - ROM 2 disassembly in workspace root
- **Output:** `nextRom3.txt` - ROM 3 disassembly in workspace root

## Usage

Run the scripts from the `next-disassembly/` folder:

```bash
# Change to the disassembly folder
cd next-disassembly

# Disassemble ROM 0 (first 16KB)
npx ts-node -r tsconfig-paths/register disassemble-next-rom.ts

# Disassemble ROM 1 (second 16KB)
npx ts-node -r tsconfig-paths/register disassemble-next-rom1.ts

# Disassemble ROM 2 (third 16KB)
npx ts-node -r tsconfig-paths/register disassemble-next-rom2.ts

# Disassemble ROM 3 (fourth 16KB)
npx ts-node -r tsconfig-paths/register disassemble-next-rom3.ts

# Or run all at once
for i in "" 1 2 3; do
  npx ts-node -r tsconfig-paths/register disassemble-next-rom$i.ts
done
```

**Important:** The folder contains its own `tsconfig.json` configured for standalone script execution. All output files (.txt) are saved in the same `next-disassembly/` folder.

Or using npm script (if added to package.json):

```bash
npm run disassemble-next-rom
```

## Output Format

The generated `nextRom0.txt` file contains:

1. **Header** - ROM information and statistics
2. **Disassembly listing** with columns:
   - **Address** - Memory address in hexadecimal ($0000-$3FFF)
   - **Op Codes** - Raw instruction bytes in hexadecimal
   - **Label** - Jump/call target labels (format: L####:)
   - **Instruction** - Disassembled Z80N instruction

Example output:
```
0000 F3                         di
0001 C3 EF 00                   jp L00EF
0004 45                         ld b,l
```

## Features

- ✅ Full Z80N extended instruction set support
- ✅ Automatic label generation for jump/call targets
- ✅ Formatted output similar to IDE's disassembly command
- ✅ 16KB (0x0000-0x3FFF) address range coverage per ROM bank
- ✅ ROM 0: ~9,815 instructions, 950 labels
- ✅ ROM 1: ~9,430 instructions, 974 labels
- ✅ ROM 2: ~12,028 instructions, 571 labels
- ✅ ROM 3: ~10,592 instructions, 1,072 labels
- ✅ Total: ~41,865 instructions across all ROM banks

## ROM Information

- **Source:** `src/public/roms/enNextZX.rom`
- **Total ROM Size:** 64KB (4 banks of 16KB each)
- **ROM 0 (nextRom0.txt):** First 16KB (file bytes 0x0000-0x3FFF, 391KB output) - System initialization, basic routines, and core functionality
- **ROM 1 (nextRom1.txt):** Second 16KB (file bytes 0x4000-0x7FFF, 376KB output) - Additional system routines and utilities
- **ROM 2 (nextRom2.txt):** Third 16KB (file bytes 0x8000-0xBFFF, 451KB output) - Extended routines and features
- **ROM 3 (nextRom3.txt):** Fourth 16KB (file bytes 0xC000-0xFFFF, 418KB output) - Additional system code and routines
- **Note:** Each ROM bank is disassembled starting at address $0000, not at their actual ROM bank addresses

## Technical Details

### ROM 0 Script (`disassemble-next-rom.ts`)
1. Reads the ROM file from `src/public/roms/enNextZX.rom`
2. Extracts the first 16KB (file bytes 0x0000-0x3FFF)
3. Creates a memory section for disassembly starting at address 0x0000
4. Initializes Z80Disassembler with Z80N extended instruction set support
5. Performs disassembly with automatic label generation
6. Formats output with address, opcodes, labels, and instructions
7. Saves to `nextRom0.txt` in the workspace root

### ROM 1 Script (`disassemble-next-rom1.ts`)
1. Reads the ROM file from `src/public/roms/enNextZX.rom`
2. Extracts the second 16KB (file bytes 0x4000-0x7FFF)
3. Creates a memory section for disassembly starting at address 0x0000 (not 0x4000)
4. Initializes Z80Disassembler with Z80N extended instruction set support
5. Performs disassembly with automatic label generation
6. Formats output with address, opcodes, labels, and instructions
7. Saves to `nextRom1.txt` in the workspace root

### ROM 2 Script (`disassemble-next-rom2.ts`)
1. Reads the ROM file from `src/public/roms/enNextZX.rom`
2. Extracts the third 16KB (file bytes 0x8000-0xBFFF)
3. Creates a memory section for disassembly starting at address 0x0000 (not 0x8000)
4. Initializes Z80Disassembler with Z80N extended instruction set support
5. Performs disassembly with automatic label generation
6. Formats output with address, opcodes, labels, and instructions
7. Saves to `nextRom2.txt` in the workspace root

### ROM 3 Script (`disassemble-next-rom3.ts`)
1. Reads the ROM file from `src/public/roms/enNextZX.rom`
2. Extracts the fourth 16KB (file bytes 0xC000-0xFFFF)
3. Creates a memory section for disassembly starting at address 0x0000 (not 0xC000)
4. Initializes Z80Disassembler with Z80N extended instruction set support
5. Performs disassembly with automatic label generation
6. Formats output with address, opcodes, labels, and instructions
7. Saves to `nextRom3.txt` in the workspace root

## Customization

All four ROM banks have been disassembled. If you need to customize the disassembly (e.g., different address ranges or output format), you can modify any of the scripts. The key parameters are:

```typescript
// Extract specific ROM bank (offset in file)
const rom16k = new Uint8Array(romData.buffer, romData.byteOffset + OFFSET, 16384);

// Define disassembly address range
memSections.push(new MemorySection(START_ADDR, END_ADDR, MemorySectionType.Disassemble));
```

### Example: Disassemble with actual ROM bank addresses
If you want ROM 1 to show addresses 0x4000-0x7FFF instead of 0x0000-0x3FFF:

```typescript
// In disassemble-next-rom1.ts
memSections.push(new MemorySection(0x4000, 0x7FFF, MemorySectionType.Disassemble));
const result = await disassembler.disassemble(0x4000, 0x7FFF);
```

## Dependencies

The script uses:
- `Z80Disassembler` from `src/renderer/appIde/disassemblers/z80-disassembler/z80-disassembler`
- `MemorySection` from `src/renderer/appIde/disassemblers/common-types`
- Helper functions from `src/renderer/appIde/services/ide-commands`

## See Also

- IDE DisassemblyCommand: `src/renderer/appIde/commands/DisassemblyCommand.ts`
- Z80 Disassembler tests: `test/z80-disassembler/`
- ROM source documentation: `_input/` directory
