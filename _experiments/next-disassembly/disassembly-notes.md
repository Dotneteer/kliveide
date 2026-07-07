# ROM Disassembly Notes for Future AI Sessions

**Date Created:** October 19, 2025  
**Project:** Klive IDE - ZX Spectrum Next ROM Disassembly  
**Purpose:** Guide for creating ROM disassemblies using Z80Disassembler

---

## Current Workflow Guide

Use `AI_ASSISTED_DISASSEMBLY_GUIDE.md` as the main playbook for continuing the
manual/AI-assisted annotation work. This notes file should hold durable findings
that future sessions can reuse: confirmed labels, confirmed data ranges, calling
conventions, system variables, repeated idioms, and open questions.

### Note Template for Future Passes

```md
### YYYY-MM-DD - ROM/range

Finding:
Evidence:
Impact:
Confidence: high | medium | low
Follow-up:
```

### Durable Findings

- 2026-07-07 ROM0 `$0000-$01D4`: RST `$00` disables interrupts and jumps to
  `ColdStart`; `INIT_ERR` is the non-returning RAM bit-test failure path. On
  entry, the failing test flags distinguish a stuck-low bit from a stuck-high
  bit, and `8-E` gives the faulty bit index shown through the border color.
- 2026-07-07 ROM0 `ColdStart`: Rechecked early NextReg comments against
  `_input/next-fpga/nextreg.txt` and `_input/next-fpga/ports.txt`. `nextreg
  $03,$B0` disables the bootrom and selects +2A/+2B/+3 display timing; `and
  $44` on nextreg `$06` preserves bit 6 BEEP routing and bit 2 PS/2 mode.
- 2026-07-07 ROM0 `ColdStart` RAM pass: The `$4000+bank` buffer stores each
  bank's original last byte so the second pass can remove the `$BB` presence
  marker from `$FFFF`. For banks `<12`, the ROM intentionally overwrites that
  saved byte with `$00` because those banks are zero-filled; the second pass
  should restore `$00`, not stale pre-clear data.
- 2026-07-07 ROM0 `INIT_ERR-L0342`: `nextreg $8E,$08` selects ROM0 and RAM
  bank 0 in standard 128K mapping. The startup UDG copy uses ROM3 routine
  `$1661` to copy `$A8` bytes of UDG definitions ending at ROM3 `$3EAF`, then
  sets `UDG` and `RAMTOP` below that copied area. `$5CB4` is PRAMT, not VARS.
- 2026-07-07 ROM0 `INIT_ERR-L0342`: DivMMC setup should decode `$B8=$82` as
  automap on `$0038` and `$0008`, `$B9=$00` as valid only when ROM3 is present,
  `$BA=$00` as delayed mapping, and `$BB=$F2` as enabling `$3Dxx`, `$056A`,
  `$04D7`, instant `$0066`, while disabling `$1FF8-$1FFF`.
- 2026-07-07 ROM0 `INIT_ERR-L0342`: Peripheral setup uses nextreg `$05`
  Peripheral 1 (`or $5A` sets both joysticks to MD1), `$08` Peripheral 3,
  `$06` Peripheral 2 (`and $44` preserves BEEP routing and PS/2 mode), and
  `$0A` Peripheral 5 (`or $10` enables DivMMC automap).
- 2026-07-07 ROM0 `$018E-$01CC`: Better labels for the second RAM pass are
  `RAM_TEST_PASS2`, `TEST_RAM_BANK`, and `RAM_TEST_DONE`.
- 2026-07-07 ROM0 `$0342-$036B`: The six bytes copied to `DISP_MODE` begin at
  `$035A`, which intentionally overlaps the high byte of `jp RUN_BOOT_CMDS`.
  The copied sequence is `$11,$00,$00,$03,$00,$3C`; do not model `$035A` with a
  normal following label unless the assembler source can represent overlapping
  code/data.
- 2026-07-07 ROM0 `$032D-$0348`: `INIT_DISP_SLOT` builds a display-state slot
  from a 32-byte template, appends the current palette, and invokes the ROM2
  palette helper for the 96-byte record. `INIT_ALT_SLOT` is a fall-through phase
  label for the second slot setup, not a separately referenced routine.
  `SAVE_DISP_STATE` stores current display hardware state into the active slot,
  while `INIT_SYS_FLAGS` resets ROM0 channel/display flag state.
- 2026-07-07 ROM0 display-state swap record: `DISP_MODE` is the display/mode marker;
  `DISP_GMODE` is swapped with `GMODE`; `DISP_L2SOFT` is swapped with `L2SOFT` and port
  `$123B`; `DISP_CPUSPEED` is swapped with NextReg `$07` CPU speed bits; `DISP_CHARS-DISP_CHARS_H`
  is swapped with `CHARS`.
- Shared RAM state findings such as `DISP_MODE-DISP_CHARS_H` should also be collected in
  `ram-state-notes.md` with evidence from all ROMs that touch the variable.
- Confirmed shared RAM symbols used by the assembler source live in
  `next-symbols.asm`; include it from ROM source files before replacing raw
  addresses with symbolic names.
- 2026-07-07 ROM0 `StripePtr`: label belongs at `$0DF7`, the 16-byte bit-mask
  table copied to `$D750`. The original ROM has `$FC` at `$0E00`; make sure this
  byte is present in assembler-source output.
- 2026-07-07 ROM0 `$11BE-$121C`: `RUN_BOOT_CMDS` resets SP, marks `DISP_MODE` as
  unselected with `$FF`, and repeatedly calls `RUN_BOOT_MENU` with startup command
  selectors 0 and 1. `WAIT_KEY` reads `SCR_CT`, waits for `FLAGS` bit 5 to
  indicate `LAST_K`, clears that flag, and reaches `HANDLE_MODE_KEY` for key
  codes below `$10` or exactly `$0E`.
- 2026-07-07 ROM0 `$0645-$0699`: `RUN_BOOT_MENU` prepares the startup menu script
  work buffer at `MENU_WORK`, copies the built-in script from `$09EA`, then calls
  `FIND_MENU_SECT`. `FIND_MENU_SECT` scans `MENU_WORK` for `=<decimal>` section
  headers and records a matching section body pointer in `MENU_BODY` plus the active
  section number in `MENU_SECTION`.
- 2026-07-07 ROM0 startup menu helpers: `MENU_ENTRY_LOOP` calls
  `SHOW_MENU_SECT` to render the active section, build the `MENU_KEYS` hotkey list
  and `MENU_PTRS` entry pointer table, then dispatches the selected entry with
  `DISPATCH_MENU`. The menu script commands decoded so far are `m<n>` for a new
  section, `i<n>` for an indexed built-in action, `g...` for a boot/game string
  copied to `BOOT_STR`, and `b` for a `$FF` boot request marker.
- 2026-07-07 ROM0 startup menu text helpers: `PRINT_MENU_AT`,
  `PRINT_MENU_NAME`, `PRINT_MENU_ITEM`, `PAD_MENU_FIELD`, `LOWERCASE_AZ`,
  `PRINT_FF_TEXT`, `SCREEN_TO_ATTR`, `SKIP_MENU_TEXT`, `SKIP_NEWLINES`, and
  `PARSE_DEC_NUM` form a small reusable parser/renderer toolkit used by the
  startup menu and nearby display code. `MENU_BEEP`/`PLAY_BEEP_TONE` provide
  feedback sounds, while `SHOW_CPU_SPEED` prints a speed indicator selected via
  saved CPU-speed state at `DISP_CPUSPEED`.
- 2026-07-07 ROM0 `$0068-$007F`: `ALTROM_CALL` is an inline-operand AltROM
  trampoline. The word after `call ALTROM_CALL` is the target address in
  AltROM, not normal ROM0 code. `ALTROM_CALL_BC` is the secondary entry when
  BC already holds the AltROM target. ROM0 writes NextReg `$8C=$80` to enable
  AltROM for reads; the AltROM copy of `$007B` writes `$8C=$00` before returning
  to ROM0. Confirmed ROM0 inline targets so far: `$0454`, `$07D8`, `$02E5`,
  `$1332`, `$13A0`, and `$02FC`.
- 2026-07-07 ROM0 `$11D4-$11DF`: The apparent instruction bytes after
  `call ALTROM_CALL` are actually `.defw $1332`, an inline call to AltROM
  routine `$1332`. The real ROM0 continuation is the `ret` at `$11DF`.
- `_input/next-fpga/nextreg.txt` and `_input/next-fpga/ports.txt` are essential
  decoding references for ZX Spectrum Next ROM work. Consult them whenever
  annotating `nextreg`, `in`, or `out` instructions, MMU mapping, DivMMC
  behavior, paging, ULA access, DMA, or peripheral setup.
- Final disassembly output should be Klive Z80 Assembler compatible source, not
  only a rendered listing. Address/opcode bytes belong in aligned comments.
- Final labels must start in column 1, must not use colons, and must label the
  following line rather than sharing a line with the instruction or directive.
- Instruction/directive source lines should use exactly 4 leading spaces, then a
  28-character instruction/directive field padded with trailing spaces before
  the aligned address/opcode comment. The comment should reserve a 16-character
  address/opcode field, enough for `AAAA xx xx xx xx`.
- Persistent label names should be at most 16 characters and use only letters,
  digits, and underscores. Use Klive temporary labels, starting with backtick,
  for local loops/skips/continuations when possible. Confirm syntax against
  `docs/pages/z80-assembly/language-structure.mdx`.
- ROM0 `$0000-$007F`: reset and interrupt vector area contains mixed code and
  data. Some generated instructions in vector gaps are actually signature,
  filler, or inline data bytes.
- ROM0 `$0028-$002F`: `RST $28` stores BC in `TMPBC`, reads an inline target
  address via the caller return address, and continues through `Rom3Cont`.
- Next API calls should be cross-checked against `next-api.txt` and
  `_input/NextZXOS_and_esxDOS_APIs.pdf` before naming public entry points.
- Spectrum 128 and +3 ROM listings in `_input/` are preferred references for
  inherited BASIC/editor routines, but names/comments should only be transferred
  after behavior or byte patterns match.

### Open Questions

- Confirm the complete set of Next-specific system variables in the `$5B00`
  area, especially the currently unknown entries in `system-vars.txt`.
- Identify every RAM trampoline used for cross-ROM calls and document the bank
  assumptions on entry and exit.
- Decide the exact file naming/layout for generated or maintained
  assembler-compatible sources, for example separate `*.kz80.asm` files beside
  the current `*.txt` listings.
- Add an automated byte-for-byte rebuild check that compiles with the Klive Z80
  Assembler and compares the emitted bytes with the original ROM files.

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
