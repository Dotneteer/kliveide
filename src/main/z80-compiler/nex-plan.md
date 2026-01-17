# ZX Spectrum Next .NEX File Format Support - Implementation Plan

## Executive Summary

This document outlines the requirements and recommendations for extending the Klive Z80 Assembler to support the ZX Spectrum Next .NEX file format. The NEX format is the standard file format for loading self-contained applications on the ZX Spectrum Next hardware and emulators.

## Current State Analysis

### Existing Capabilities

The Klive Z80 Assembler currently supports:

1. **Bank Management (Spectrum 128 Focus)**
   - `.bank` pragma for 16KB memory banks (0-7)
   - Bank offset support (0-16383 bytes)
   - Automatic segment creation for banks
   - TAP file export with bank loaders
   - Restriction: Each bank can only be used once

2. **Memory Organization**
   - `.org` - Set code origin address
   - `.xorg` - Set Intel HEX export address
   - `.ent` - Set entry point
   - `.xent` - Set export entry point (for TAP loaders)
   - `.disp` - Set displacement for code

3. **Model Support**
   - `.model` pragma with Spectrum48, Spectrum128, SpectrumP3, Next
   - Model-specific compilation rules
   - Next extended Z80 instruction set support

4. **Export Formats**
   - TAP files with auto-start loaders
   - Intel HEX format
   - Segment-based binary output
   - Bank-aware code generation for Spectrum 128

### Limitations for NEX Format

1. **Bank Limitations**
   - Current limit: 8 banks (0-7) for Spectrum 128
   - NEX supports: 112 banks (0-111) for Next
   - Current restriction: Each bank used only once
   - NEX requirement: Multiple segments per bank should be possible

2. **Missing NEX-Specific Features**
   - No loading screen support (Layer2, ULA, LoRes, HiRes, HiCol)
   - No palette definition support
   - No copper code support
   - No loading bar configuration
   - No Next register preservation options
   - No core version requirement specification
   - No file handle management options
   - No RAM requirement specification (768k vs 1792k)

3. **Export Infrastructure**
   - No `.savenex` pragma or equivalent
   - No NEX-specific header generation
   - No NEX file writer implementation
   - Export currently targets TAP/HEX formats only

## NEX File Format Overview

### Structure

The NEX format (V1.2) consists of:

| Block | Size | Optional | Description |
|-------|------|----------|-------------|
| Header | 512 bytes | No | "Next" signature + metadata |
| Palette | 512 bytes | Yes | For Layer2/LoRes/Tilemap |
| Layer2 Screen | 49152 bytes | Yes | 256x192x8 screen |
| ULA Screen | 6912 bytes | Yes | Classic Spectrum screen |
| LoRes Screen | 12288 bytes | Yes | 128x96x8 screen |
| HiRes Screen | 12288 bytes | Yes | Timex 512x192 |
| HiCol Screen | 12288 bytes | Yes | Timex 8x1 color |
| Layer2 320/640 | 81920 bytes | Yes | Extended Layer2 |
| Copper Code | 2048 bytes | Yes | Loading effects |
| Banks | n × 16384 bytes | Yes | Bank data in order: 5,2,0,1,3,4,6,7,8,9,...,111 |
| Extra Data | Variable | Yes | Custom format data |

### Header Fields (Key Elements)

| Offset | Size | Description | Default |
|--------|------|-------------|---------|
| 0 | 4 | "Next" signature | Required |
| 4 | 4 | Version string ("V1.0", "V1.1", "V1.2") | "V1.2" |
| 8 | 1 | RAM required (0=768k, 1=1792k) | 0 |
| 9 | 1 | Number of banks (0-112) | 0 |
| 10 | 1 | Loading screen flags | 0 |
| 11 | 1 | Border color (0-7) | 0 |
| 12 | 2 | Stack pointer | Current SP |
| 14 | 2 | Program counter (0=don't run) | Entry address |
| 16 | 2 | Number of extra files | 0 |
| 18 | 112 | Bank presence flags (0/1 for banks 0-111) | All 0 |
| 130 | 1 | Layer2 loading bar (0=OFF, 1=ON) | 0 |
| 131 | 1 | Loading bar color (0-255) | 0 |
| 132 | 1 | Loading delay per bank (frames) | 0 |
| 133 | 1 | Start delay (frames) | 0 |
| 134 | 1 | Preserve Next registers (0=reset, 1=preserve) | 0 |
| 135 | 3 | Required core version (major.minor.subminor) | 0.0.0 |
| 138 | 1 | HiRes color or Layer2 palette offset | 0 |
| 139 | 1 | Entry bank (mapped to slot 3) | 0 |
| 140 | 2 | File handle address | 0 |

## Recommendations for Documentation Updates

### 1. Language Structure (language-structure.mdx)

**Current Status:** Good foundation, no immediate changes needed.

**Recommendation:** Add a note about NEX-specific pragmas in the introduction.

- A *pragma* that emits binary output or instructs the compiler about code emission 
  (e.g., `.org`, `.defb`, `.savenex` for ZX Spectrum Next NEX files)

### 2. Pragmas (pragmas.mdx)

**Critical Updates Required:**

#### A. Extend the .BANK Pragma

**Current Documentation Issues:**
- States bank values must be 0-7 (too restrictive for Next)
- States each bank can only be used once (too restrictive)
- No mention of Next-specific bank capabilities

**Recommended Changes:**

1. **Update Bank Value Range:**

```text
## The BANK pragma

The ZX Spectrum 128K models support 8 memory banks (0-7), while the ZX Spectrum Next 
supports up to 112 banks (0-111) for extended memory management.

The __BANK__ pragma accepts two parameters:
- Bank number: 0-7 for Spectrum 128, 0-111 for Spectrum Next
- Optional offset: 0-16383 within the bank

> **Note**: For Spectrum 128 models, use `.model Spectrum128`. For ZX Spectrum Next, 
> use `.model Next`.
```

2. **Add Multiple Segment Support:**

```text
### Multiple Segments in the Same Bank

For ZX Spectrum Next, you can define multiple code segments within the same bank 
by using `.org` between `.bank` declarations:
```

```z80klive
.model Next
.bank 5
.org #C000
    ld a,1      ; First segment in bank 5
    ret

.org #D000
    ld a,2      ; Second segment in bank 5 (same bank!)
    ret
```

```text
This allows flexible memory layout within extended Next memory.
```

3. **Add Bank Order Information:**

```text
### Bank Export Order

When exporting to NEX format, banks are written in a specific order: 
5, 2, 0, 1, 3, 4, 6, 7, 8, 9, 10, ..., 111.

The assembler handles this ordering automatically. You should define banks in 
the logical order that makes sense for your program.
```

#### B. Add New .SAVENEX Pragma Section

**New Section Required:**

```text
## The SAVENEX Pragma

The __SAVENEX__ pragma is used to configure ZX Spectrum Next NEX file generation. 
This pragma is only available when using `.model Next`. Unlike imperative approaches, 
the `.savenex` pragma works declaratively - you set properties that the NEX file 
generator uses after compilation completes.

### Basic Usage Pattern
```

```z80klive
.model Next

; Set NEX output filename (required)
.savenex file "myapp.nex"

; Configure NEX file properties (all optional with sensible defaults)
.savenex ram 768           ; RAM requirement: 768 or 1792 (KB)
.savenex border 0          ; Border color (0-7)
.savenex core 3,1,10       ; Minimum core version
.savenex stackaddr #5FFF   ; Stack pointer value
.savenex entrybank 5       ; Bank mapped to slot 3 on entry

; Loading screen and visual effects (optional)
.savenex screen l2 "title.nxi", "title.nxp"
.savenex bar on, 2, 5, 25  ; Loading bar: on/off, color, delay, start

; Code in banks (automatically included in NEX)
.bank 5
.org #C000
.ent $
Start:
    ; Main code
    ret
```

After compilation, the assembler generates the NEX file using all defined banks 
and configuration properties.

```


```text
### SAVENEX Property Commands

#### .savenex file

Sets the NEX output filename. This is the only required `.savenex` command.

**Syntax:** `.savenex file "<filename>"`

**Example:**
```

```z80klive
.savenex file "game.nex"
.savenex file "../build/myapp.nex"
```

```text
#### .savenex ram

Sets the RAM requirement.

**Syntax:** `.savenex ram <size>`

- `size`: 768 (768KB) or 1792 (1792KB)
- Default: 768

**Example:**
```

```z80klive
.savenex ram 768     ; Standard RAM
.savenex ram 1792    ; Extended RAM
```

```text
#### .savenex border

Sets the border color.

**Syntax:** `.savenex border <color>`

- `color`: 0-7 (standard Spectrum colors)
- Default: 0 (black)

**Example:**
```

```z80klive
.savenex border 7    ; White border
.savenex border 2    ; Red border
```

```text
#### .savenex core

Specifies minimum required ZX Spectrum Next core version.

**Syntax:** `.savenex core <major>, <minor>, <subminor>`

- `major`: 0-15
- `minor`: 0-15
- `subminor`: 0-255
- Default: 0.0.0 (any version)

**Example:**
```

```z80klive
.savenex core 3,1,10    ; Require 3.1.10 or later
```

```text
#### .savenex stackaddr

Sets the stack pointer value on entry.

**Syntax:** `.savenex stackaddr <address>`

- `address`: 16-bit stack pointer value
- Default: Current SP value during compilation

**Example:**
```

```z80klive
.savenex stackaddr #5FFF    ; Stack below screen memory
```

```text
#### .savenex entryaddr

Sets the entry address (PC on start). Normally this is taken from `.ent` pragma.

**Syntax:** `.savenex entryaddr <address>`

- `address`: Entry point address, or 0 to only load without running
- Default: Value from `.ent` pragma, or 0 if no `.ent`

**Example:**
```

```z80klive
.savenex entryaddr #8000    ; Start at $8000
.savenex entryaddr 0        ; Load only, don't run
```

```text
#### .savenex entrybank

Sets which bank is mapped to slot 3 (0xC000-0xFFFF) on entry.

**Syntax:** `.savenex entrybank <bankNo>`

- `bankNo`: 0-111
- Default: 0

**Example:**
```

```z80klive
.savenex entrybank 5    ; Map bank 5 to slot 3
```

```text
#### .savenex filehandle

Configures file handle behavior after loading.

**Syntax:** `.savenex filehandle <mode>`

- `mode`: 
  - `0` or `close`: Close file after loading
  - `bc`: Pass file handle in BC register
  - `<address>`: Write file handle to memory address
- Default: `close`

**Example:**
```

```z80klive
.savenex filehandle close   ; Close file
.savenex filehandle bc      ; Keep open, handle in BC
.savenex filehandle #5B00   ; Write handle to $5B00
```

```text
#### .savenex preserve

Configures Next hardware register preservation.

**Syntax:** `.savenex preserve <on|off>`

- `on`: Preserve current Next register state
- `off`: Reset to defaults
- Default: `off`

**Example:**
```

```z80klive
.savenex preserve on    ; Keep registers as-is
```

```text
#### .savenex screen

Adds a loading screen to the NEX file.

**Syntax:** `.savenex screen <type> "<filename>" [, "<paletteFile>" [, <paletteOffset>]]`

Screen types:
- `l2` or `layer2`: Layer2 screen (49152 bytes, 256×192×8)
- `ula`: Classic ULA screen (6912 bytes)
- `lores`: LoRes screen (12288 bytes, 128×96×8)
- `hires`: Timex HiRes (12288 bytes, 512×192 mono)
- `hicolor`: Timex HiCol (12288 bytes, 8×1 color attributes)
- `l2_320`: Layer2 320×256×8 (81920 bytes)
- `l2_640`: Layer2 640×256×4 (81920 bytes)

**Examples:**
```

```z80klive
.savenex screen ula "loading.scr"
.savenex screen l2 "title.nxi", "title.nxp"
.savenex screen l2_320 "wide.sl2", "colors.nxp", 3
```

```text
#### .savenex palette

Adds a palette block (512 bytes for Layer2/LoRes/Tilemap).

**Syntax:** `.savenex palette "<filename>"`

**Example:**
```

```z80klive
.savenex palette "mycolors.nxp"
```

```text
#### .savenex copper

Adds copper code for loading screen effects.

**Syntax:** `.savenex copper "<filename>"`

- Maximum size: 2048 bytes
- Copper code runs during bank loading

**Example:**
```

```z80klive
.savenex copper "rainbow.cop"
```

```text
#### .savenex bar

Configures loading progress bar (only visible with Layer2 screens).

**Syntax:** `.savenex bar <on|off> [, <color> [, <delay> [, <startDelay>]]]`

- `on|off`: Enable/disable loading bar
- `color`: Progress bar color (0-255), default: 2 (red)
- `delay`: Per-bank delay in frames (0-255), default: 0
- `startDelay`: Initial delay before loading (0-255), default: 0

**Examples:**
```

```z80klive
.savenex bar on               ; Simple bar, red color
.savenex bar on, 5            ; Yellow progress bar
.savenex bar on, 2, 10, 50    ; Red bar, 10 frame delay, 50 frame start
.savenex bar off              ; Disable loading bar
```

```text
### How Banks Are Included

All banks defined with `.bank` pragma are **automatically included** in the NEX file 
in the required order (5,2,0,1,3,4,6,7,8,9,...,111), unless explicitly excluded with 
the `noexport` flag:
```

```z80klive
.bank 5
; Code here - WILL be exported

.bank 10 noexport
; Code here - will NOT be exported

.bank 15
; Code here - WILL be exported
```

```text
The NEX writer automatically:
- Collects all segments for each bank
- Compacts bank data (removes unused areas)
- Writes banks in correct NEX order
- Updates the header with bank presence flags

### Complete Example
```

```z80klive
.model Next

; NEX file configuration
.savenex file "mygame.nex"
.savenex ram 768
.savenex border 0
.savenex core 3,1,10
.savenex stackaddr #5FFF
.savenex entrybank 5

; Visual presentation
.savenex screen l2 "title.nxi", "title.nxp"
.savenex bar on, 2, 5, 25
.savenex copper "effect.cop"

; Entry point
.org #C000
.ent #C000

; Game code in bank 5 (entry bank)
.bank 5
Start:
    call InitGame
    jp MainLoop

; Support code in bank 2
.bank 2
InitGame:
    ; Initialize
    ret

; Data in bank 10 (not exported to NEX)
.bank 10 noexport
DebugData:
    ; Development-only data
    .defb 1,2,3,4

; More game code in bank 15
.bank 15
MainLoop:
    ; Game loop
    ret
```

```text
### Error Conditions

The following will cause compilation errors:

- Using `.savenex` without `.model Next`
- No `.savenex file` command when generating NEX output
- Invalid values for properties (colors, bank numbers, etc.)
- Screen file not found or wrong size
- Core version numbers out of range (major/minor > 15, subminor > 255)
- Copper file larger than 2048 bytes
- Palette file not exactly 512 bytes
```
```

#### C. Update .MODEL Pragma Section

```text
## The MODEL pragma

...existing content...

### ZX Spectrum Next

When targeting the ZX Spectrum Next:
```

```z80klive
.model Next
```

```text
This enables:
- Extended Z80 instruction set (Next-specific opcodes)
- 112 memory banks (0-111) support
- NEX file format export with `.savenex` pragma
- Extended bank management features
```

#### D. Update .ENT and .XENT Pragmas

Add note about NEX compatibility:

```text
## The ENT pragma

...existing content...

> **Note**: When generating NEX files with `.savenex auto`, the entry address is 
> taken from the `.ent` pragma. If the entry address is 0, the NEX file will only 
> load code without executing it.
```

### 3. Directives (directives.mdx)

**Current Status:** Adequate, minor additions needed.

**Recommendation:** Add note about NEX-specific conditional compilation:

```text
## The #IFMOD and #IFNMOD Directives

...existing content...

When targeting ZX Spectrum Next with NEX file output:
```

```z80klive
.model Next

#ifmod Next
    ; Next-specific code using extended features
    .savenex open "app.nex", 0
    ldpirx                       ; Next-specific instruction
#else
    ; Fallback for other Spectrum models
    ldir
#endif
```

### 4. Z80 Assembler Overview (z80-assembler.mdx)

**Recommendation:** Update features list:

```text
## Main Features

...existing features...

- **ZX Spectrum Next NEX file format**. Generate native NEX files for the ZX Spectrum 
  Next with the `.savenex` pragma, including support for loading screens, copper code, 
  palettes, and all 112 memory banks.
```

Add to "How The Assembler Works" section:

```text
5. For ZX Spectrum Next NEX file output, the assembler creates the NEX file structure:
   - Generates 512-byte header with configuration
   - Includes optional loading screens, palettes, and copper code
   - Writes bank data in the required order (5,2,0,1,3,4,6,7,8,9,...,111)
   - Validates all NEX-specific constraints
```

### 5. Expressions (expressions.mdx)

**Current Status:** Review recommended (not read in detail).

**Recommendation:** Verify no conflicts with NEX-related expressions, likely OK.

### 6. Statements (statements.mdx)

**Current Status:** Good, no changes needed for NEX support.

**Note:** Control flow statements work identically with NEX targets.

### 7. Macros (macros.mdx)

**Current Status:** Good, no changes needed.

**Optional Enhancement:** Add NEX-specific macro examples in future:

```z80klive
SaveNexSetup:
    .macro(filename, ramReq, border)
    .savenex open {{filename}}, {{ramReq}}
    .savenex cfg {{border}}, 0
    .savenex auto
    .endm

; Usage:
SaveNexSetup("game.nex", 0, 7)
```

### 8. Structs (structs.mdx)

**Current Status:** No changes needed.

## Technical Implementation Requirements

### 1. Assembler Core Changes

#### A. Bank Management Extensions

**File:** `src/main/compiler-common/common-assembler.ts`

Current `processBankPragma()` needs updates:

```typescript
// Current restriction (line ~1608)
if (this._output.segments.some((s) => s.bank === value.value)) {
  this.reportAssemblyError("Z0309", pragma, null, value.value);
  return;
}
```

**Changes Required:**
- Remove the single-use bank restriction for Next model
- Allow bank numbers 0-111 for Next model
- Support multiple segments per bank
- Track bank segments separately

**Updated Logic:**
```typescript
protected processBankPragma(pragma: BankPragma, label: string | null): void {
  // ... existing validation ...
  
  // Bank range check depends on model
  const maxBank = this.isNextModel() ? 111 : 7;
  if (value.asWord() > maxBank) {
    this.reportAssemblyError("Z0306", pragma); // Update error message
    return;
  }
  
  // For Next, allow multiple segments per bank
  if (!this.isNextModel()) {
    if (this._output.segments.some((s) => s.bank === value.value)) {
      this.reportAssemblyError("Z0309", pragma, null, value.value);
      return;
    }
  }
  
  // Rest of implementation...
}
```

#### B. New SaveNex Pragma Nodes

**File:** `src/main/z80-compiler/assembler-tree-nodes.ts`

Add new node types:

```typescript
export type SaveNexOpenNode = {
  type: "SaveNexOpenPragma";
  filename: Expression;
  ramReq: Expression;
  stackAddr?: Expression;
};

export type SaveNexCoreNode = {
  type: "SaveNexCorePragma";
  major: Expression;
  minor: Expression;
  subminor: Expression;
};

export type SaveNexCfgNode = {
  type: "SaveNexCfgPragma";
  border: Expression;
  fileHandle: Expression;
  stackAddr?: Expression;
  entryAddr?: Expression;
};

export type SaveNexAutoNode = {
  type: "SaveNexAutoPragma";
};

export type SaveNexBarNode = {
  type: "SaveNexBarPragma";
  enabled: Expression;
  color: Expression;
  delay?: Expression;
  startDelay?: Expression;
};

export type SaveNexScreenNode = {
  type: "SaveNexScreenPragma";
  screenType: string; // "l2" | "ula" | "lores" | "hires" | "hicolor" | "l2_320" | "l2_640"
  filename: Expression;
  paletteOffset?: Expression;
  paletteFile?: Expression;
};

export type SaveNexPaletteNode = {
  type: "SaveNexPalettePragma";
  filename: Expression;
};

export type SaveNexCopperNode = {
  type: "SaveNexCopperPragma";
  filename: Expression;
};

export type SaveNexBankNode = {
  type: "SaveNexBankPragma";
  bankNo: Expression;
  length?: Expression;
  offset?: Expression;
  page?: Expression;
};

export type SaveNexPreserveNode = {
  type: "SaveNexPreservePragma";
  value: Expression;
};

export type SaveNexEntryBankNode = {
  type: "SaveNexEntryBankPragma";
  bankNo: Expression;
};

export type SaveNexCloseNode = {
  type: "SaveNexClosePragma";
};

// Add to Z80Node union type
export type Z80Node = 
  // ... existing types ...
  | SaveNexOpenNode
  | SaveNexCoreNode
  | SaveNexCfgNode
  | SaveNexAutoNode
  | SaveNexBarNode
  | SaveNexScreenNode
  | SaveNexPaletteNode
  | SaveNexCopperNode
  | SaveNexBankNode
  | SaveNexPreserveNode
  | SaveNexEntryBankNode
  | SaveNexCloseNode;
```

#### C. Token Extensions

**File:** `src/main/z80-compiler/z80-token-stream.ts`

Add new tokens:

```typescript
export enum Z80TokenType {
  // ... existing tokens ...
  SaveNexOpen = "SaveNexOpen",
  SaveNexCore = "SaveNexCore",
  SaveNexCfg = "SaveNexCfg",
  SaveNexAuto = "SaveNexAuto",
  SaveNexBar = "SaveNexBar",
  SaveNexScreen = "SaveNexScreen",
  SaveNexPalette = "SaveNexPalette",
  SaveNexCopper = "SaveNexCopper",
  SaveNexBank = "SaveNexBank",
  SaveNexPreserve = "SaveNexPreserve",
  SaveNexEntryBank = "SaveNexEntryBank",
  SaveNexClose = "SaveNexClose",
}
```

**File:** `src/main/z80-compiler/z80-token-traits.ts`

Add token recognition:

```typescript
const tokenTraits: Record<string, Z80TokenType> = {
  // ... existing mappings ...
  ".savenex": Z80TokenType.SaveNexOpen, // Parser distinguishes subcommands
  "savenex": Z80TokenType.SaveNexOpen,
};
```

#### D. Parser Extensions

**File:** `src/main/z80-compiler/z80-asm-parser.ts`

Add parsing methods:

```typescript
private parseSaveNexPragma(): Z80Node | null {
  // Consume '.savenex' or 'savenex'
  this.lexer.get();
  
  // Get subcommand
  const subcommand = this.lexer.peek();
  
  switch (subcommand.text.toLowerCase()) {
    case "open":
      return this.parseSaveNexOpen();
    case "core":
      return this.parseSaveNexCore();
    case "cfg":
      return this.parseSaveNexCfg();
    case "auto":
      return this.parseSaveNexAuto();
    case "bar":
      return this.parseSaveNexBar();
    case "screen":
      return this.parseSaveNexScreen();
    case "palette":
      return this.parseSaveNexPalette();
    case "copper":
      return this.parseSaveNexCopper();
    case "bank":
      return this.parseSaveNexBank();
    case "preserve":
      return this.parseSaveNexPreserve();
    case "entrybank":
      return this.parseSaveNexEntryBank();
    case "close":
      return this.parseSaveNexClose();
    default:
      this.reportError("Z0xxx", "Unknown .savenex subcommand");
      return null;
  }
}
```

### 2. NEX File Writer Implementation

**New File:** `src/main/z80-compiler/nex-file-writer.ts`

```typescript
/**
 * NEX file format writer for ZX Spectrum Next
 */
export class NexFileWriter {
  private header: Uint8Array;
  private palette?: Uint8Array;
  private screens: Map<string, Uint8Array>;
  private copper?: Uint8Array;
  private banks: Map<number, Uint8Array>;
  
  constructor() {
    this.header = new Uint8Array(512);
    this.screens = new Map();
    this.banks = new Map();
    this.initializeHeader();
  }
  
  private initializeHeader(): void {
    // Write "Next" signature
    this.header[0] = 0x4E; // 'N'
    this.header[1] = 0x65; // 'e'
    this.header[2] = 0x78; // 'x'
    this.header[3] = 0x74; // 't'
    
    // Write version "V1.2"
    this.header[4] = 0x56; // 'V'
    this.header[5] = 0x31; // '1'
    this.header[6] = 0x2E; // '.'
    this.header[7] = 0x32; // '2'
  }
  
  setRamRequirement(is1792k: boolean): void {
    this.header[8] = is1792k ? 1 : 0;
  }
  
  setBorderColor(color: number): void {
    this.header[11] = color & 0x07;
  }
  
  setStackPointer(sp: number): void {
    this.header[12] = sp & 0xFF;
    this.header[13] = (sp >> 8) & 0xFF;
  }
  
  setProgramCounter(pc: number): void {
    this.header[14] = pc & 0xFF;
    this.header[15] = (pc >> 8) & 0xFF;
  }
  
  setCoreVersion(major: number, minor: number, subminor: number): void {
    this.header[135] = ((major & 0x0F) << 4) | (minor & 0x0F);
    this.header[136] = subminor & 0xFF;
  }
  
  setLoadingBar(enabled: boolean, color: number, delay: number, startDelay: number): void {
    this.header[130] = enabled ? 1 : 0;
    this.header[131] = color & 0xFF;
    this.header[132] = delay & 0xFF;
    this.header[133] = startDelay & 0xFF;
  }
  
  setPreserveNextRegs(preserve: boolean): void {
    this.header[134] = preserve ? 1 : 0;
  }
  
  setEntryBank(bank: number): void {
    this.header[139] = bank & 0xFF;
  }
  
  setFileHandle(address: number): void {
    this.header[140] = address & 0xFF;
    this.header[141] = (address >> 8) & 0xFF;
  }
  
  addBank(bankNo: number, data: Uint8Array): void {
    if (bankNo < 0 || bankNo > 111) {
      throw new Error(`Invalid bank number: ${bankNo}`);
    }
    if (data.length > 16384) {
      throw new Error(`Bank ${bankNo} data too large: ${data.length} bytes`);
    }
    
    // Pad to 16KB if needed
    const paddedData = new Uint8Array(16384);
    paddedData.set(data);
    this.banks.set(bankNo, paddedData);
    
    // Mark bank as present in header
    this.header[18 + bankNo] = 1;
  }
  
  addScreen(type: string, data: Uint8Array): void {
    this.screens.set(type, data);
    // Update loading screen flags
    this.updateScreenFlags();
  }
  
  setPalette(data: Uint8Array): void {
    if (data.length !== 512) {
      throw new Error(`Palette must be 512 bytes, got ${data.length}`);
    }
    this.palette = data;
  }
  
  setCopper(data: Uint8Array): void {
    if (data.length > 2048) {
      throw new Error(`Copper code too large: ${data.length} bytes (max 2048)`);
    }
    this.copper = data;
  }
  
  private updateScreenFlags(): void {
    let flags = 0;
    if (this.screens.has("layer2")) flags |= 0x01;
    if (this.screens.has("ula")) flags |= 0x02;
    if (this.screens.has("lores")) flags |= 0x04;
    if (this.screens.has("hires")) flags |= 0x08;
    if (this.screens.has("hicolor")) flags |= 0x10;
    // Note: 0x80 = no palette block
    this.header[10] = flags;
  }
  
  write(): Uint8Array {
    const parts: Uint8Array[] = [];
    
    // Update bank count
    this.header[9] = this.banks.size;
    
    // 1. Header
    parts.push(this.header);
    
    // 2. Palette (if present and screens need it)
    if (this.palette && !(this.header[10] & 0x80)) {
      parts.push(this.palette);
    }
    
    // 3. Screens in order
    if (this.screens.has("layer2")) parts.push(this.screens.get("layer2")!);
    if (this.screens.has("ula")) parts.push(this.screens.get("ula")!);
    if (this.screens.has("lores")) parts.push(this.screens.get("lores")!);
    if (this.screens.has("hires")) parts.push(this.screens.get("hires")!);
    if (this.screens.has("hicolor")) parts.push(this.screens.get("hicolor")!);
    if (this.screens.has("layer2_320") || this.screens.has("layer2_640")) {
      const l2ext = this.screens.get("layer2_320") || this.screens.get("layer2_640");
      parts.push(l2ext!);
    }
    
    // 4. Copper code
    if (this.copper) {
      parts.push(this.copper);
    }
    
    // 5. Banks in required order: 5,2,0,1,3,4,6,7,8,9,...,111
    const bankOrder = [5, 2, 0, 1, 3, 4];
    for (let i = 6; i <= 111; i++) {
      bankOrder.push(i);
    }
    
    for (const bankNo of bankOrder) {
      if (this.banks.has(bankNo)) {
        parts.push(this.banks.get(bankNo)!);
      }
    }
    
    // Concatenate all parts
    const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const part of parts) {
      result.set(part, offset);
      offset += part.length;
    }
    
    return result;
  }
}
```

### 3. Assembler Output Extensions

**File:** `src/main/compiler-common/assembler-in-out.ts`

Add NEX configuration to AssemblerOutput:

```typescript
export class AssemblerOutput<TInstruction, TToken> {
  // ... existing properties ...
  
  /**
   * NEX file configuration (if .savenex used)
   */
  nexConfig?: {
    filename: string;
    ramReq: number;
    stackAddr?: number;
    entryAddr?: number;
    border: number;
    fileHandle: number;
    coreVersion: { major: number; minor: number; subminor: number };
    loadingBar: { enabled: boolean; color: number; delay: number; startDelay: number };
    preserveNextRegs: boolean;
    entryBank: number;
    screens: Array<{ type: string; file: string; paletteOffset?: number; paletteFile?: string }>;
    paletteFile?: string;
    copperFile?: string;
    explicitBanks: Array<{ bankNo: number; length?: number; offset?: number; page?: number }>;
  };
}
```

### 4. Export Command Enhancement

**File:** `src/renderer/appIde/commands/KliveCompilerCommands.ts`

Update `ExportCodeCommand.exportCompiledCode()`:

```typescript
async exportCompiledCode(
  context: IdeCommandContext,
  output: KliveCompilerOutput,
  args: ExportCommandArgs
): Promise<IdeCommandResult> {
  // ... existing code ...
  
  // Check if NEX format requested
  if (output.nexConfig) {
    return await this.exportNexFile(context, output, args);
  }
  
  // ... existing TAP/HEX export code ...
}

private async exportNexFile(
  context: IdeCommandContext,
  output: KliveCompilerOutput,
  args: ExportCommandArgs
): Promise<IdeCommandResult> {
  const writer = new NexFileWriter();
  
  // Apply configuration from nexConfig
  writer.setRamRequirement(output.nexConfig.ramReq === 1);
  writer.setBorderColor(output.nexConfig.border);
  
  if (output.nexConfig.stackAddr) {
    writer.setStackPointer(output.nexConfig.stackAddr);
  }
  
  if (output.nexConfig.entryAddr) {
    writer.setProgramCounter(output.nexConfig.entryAddr);
  } else if (output.entryAddress) {
    writer.setProgramCounter(output.entryAddress);
  }
  
  writer.setCoreVersion(
    output.nexConfig.coreVersion.major,
    output.nexConfig.coreVersion.minor,
    output.nexConfig.coreVersion.subminor
  );
  
  writer.setLoadingBar(
    output.nexConfig.loadingBar.enabled,
    output.nexConfig.loadingBar.color,
    output.nexConfig.loadingBar.delay,
    output.nexConfig.loadingBar.startDelay
  );
  
  writer.setPreserveNextRegs(output.nexConfig.preserveNextRegs);
  writer.setEntryBank(output.nexConfig.entryBank);
  writer.setFileHandle(output.nexConfig.fileHandle);
  
  // Add screens
  for (const screen of output.nexConfig.screens) {
    const data = await readFile(screen.file);
    writer.addScreen(screen.type, data);
  }
  
  // Add palette
  if (output.nexConfig.paletteFile) {
    const data = await readFile(output.nexConfig.paletteFile);
    writer.setPalette(data);
  }
  
  // Add copper
  if (output.nexConfig.copperFile) {
    const data = await readFile(output.nexConfig.copperFile);
    writer.setCopper(data);
  }
  
  // Add banks from segments
  for (const segment of output.segments) {
    if (segment.bank !== undefined) {
      const data = new Uint8Array(segment.emittedCode);
      writer.addBank(segment.bank, data);
    }
  }
  
  // Write NEX file
  const nexData = writer.write();
  await writeFile(output.nexConfig.filename, nexData);
  
  return {
    success: true,
    finalMessage: `NEX file written: ${output.nexConfig.filename}`
  };
}
```

### 5. Error Messages

**File:** `src/main/compiler-common/assembler-errors.ts`

Add new error codes:

```typescript
export type ErrorCodes =
  // ... existing codes ...
  | "Z0501" // .savenex can only be used with .model Next
  | "Z0502" // .savenex open: filename must be a string
  | "Z0503" // .savenex open: ramReq must be 0 or 1
  | "Z0504" // .savenex core: version numbers out of range
  | "Z0505" // .savenex cfg: invalid parameter
  | "Z0506" // .savenex screen: unknown screen type
  | "Z0507" // .savenex screen: file not found
  | "Z0508" // .savenex screen: file size mismatch
  | "Z0509" // .savenex palette: file must be 512 bytes
  | "Z0510" // .savenex copper: file too large (max 2048 bytes)
  | "Z0511" // .savenex close: no .savenex open found
  | "Z0512" // .savenex bank: bank number out of range (0-111)
  | "Z0513" // .savenex: already opened, close first
  | "Z0514"; // .savenex: must call open before other commands

const errorMessages: Record<ErrorCodes, string> = {
  // ... existing messages ...
  Z0501: "The .savenex pragma can only be used with .model Next.",
  Z0502: "The .savenex open pragma requires a string filename.",
  Z0503: "The .savenex open pragma ramReq must be 0 (768KB) or 1 (1792KB).",
  Z0504: "The .savenex core pragma version numbers out of range (major: 0-15, minor: 0-15, subminor: 0-255).",
  Z0505: "The .savenex cfg pragma has invalid parameters.",
  Z0506: "The .savenex screen pragma has unknown screen type: {0}. Valid: l2, ula, lores, hires, hicolor, l2_320, l2_640.",
  Z0507: "The .savenex screen pragma cannot find file: {0}.",
  Z0508: "The .savenex screen file has wrong size: {0} (expected: {1}).",
  Z0509: "The .savenex palette file must be exactly 512 bytes.",
  Z0510: "The .savenex copper file too large: {0} bytes (maximum: 2048).",
  Z0511: "The .savenex close pragma requires a previous .savenex open.",
  Z0512: "The .savenex bank pragma bank number {0} out of range (must be 0-111).",
  Z0513: "The .savenex is already opened. Call .savenex close first.",
  Z0514: "The .savenex pragma requires .savenex open to be called first.",
};
```

### 6. Language Provider Updates

**File:** `src/renderer/appIde/project/asmKz80LangaugeProvider.ts`

Add pragma completions:

```typescript
pragmas: [
  // ... existing pragmas ...
  ".savenex",
  ".SAVENEX",
  "savenex",
  "SAVENEX",
],

// Add keywords for savenex subcommands
keywords: [
  // ... existing keywords ...
  "open", "OPEN",
  "core", "CORE",
  "cfg", "CFG",
  "auto", "AUTO",
  "bar", "BAR",
  "screen", "SCREEN",
  "palette", "PALETTE",
  "copper", "COPPER",
  "bank", "BANK",
  "preserve", "PRESERVE",
  "entrybank", "ENTRYBANK",
  "close", "CLOSE",
  // Screen types
  "l2", "L2",
  "ula", "ULA",
  "lores", "LORES",
  "hires", "HIRES",
  "hicolor", "HICOLOR",
  "l2_320", "L2_320",
  "l2_640", "L2_640",
],
```

### 7. Testing Requirements

**New File:** `test/z80-assembler/nex-pragma.test.ts`

```typescript
import { Z80Assembler } from "../../src/main/z80-compiler/z80-assembler";

describe("NEX Pragma Tests", () => {
  it("savenex open - basic", async () => {
    const compiler = new Z80Assembler();
    const source = `
      .model Next
      .savenex open "test.nex", 0
      .savenex close
    `;
    const output = await compiler.compile(source);
    expect(output.errorCount).toBe(0);
    expect(output.nexConfig).toBeDefined();
    expect(output.nexConfig.filename).toBe("test.nex");
    expect(output.nexConfig.ramReq).toBe(0);
  });
  
  it("savenex core - version check", async () => {
    const compiler = new Z80Assembler();
    const source = `
      .model Next
      .savenex open "test.nex", 0
      .savenex core 3, 1, 10
      .savenex close
    `;
    const output = await compiler.compile(source);
    expect(output.errorCount).toBe(0);
    expect(output.nexConfig.coreVersion).toEqual({ major: 3, minor: 1, subminor: 10 });
  });
  
  it("savenex - error without model Next", async () => {
    const compiler = new Z80Assembler();
    const source = `
      .model Spectrum128
      .savenex open "test.nex", 0
    `;
    const output = await compiler.compile(source);
    expect(output.errorCount).toBe(1);
    expect(output.errors[0].errorCode).toBe("Z0501");
  });
  
  it("savenex with banks", async () => {
    const compiler = new Z80Assembler();
    const source = `
      .model Next
      .savenex open "test.nex", 0
      .savenex auto
      
      .bank 5
      .org #C000
      .ent $
      Start:
          ld a, 1
          ret
      
      .bank 10
      .org #C000
          ld b, 2
          ret
      
      .savenex close
    `;
    const output = await compiler.compile(source);
    expect(output.errorCount).toBe(0);
    expect(output.segments.length).toBe(2);
    expect(output.segments[0].bank).toBe(5);
    expect(output.segments[1].bank).toBe(10);
  });
  
  // Add more tests for all savenex subcommands...
});
```

## Implementation Phases

### Phase 1: Foundation (Week 1-2)
1. Update `.bank` pragma to support 0-111 for Next model
2. Remove single-use bank restriction for Next
3. Add error message updates
4. Update documentation for `.bank` pragma
5. Test bank extensions

### Phase 2: NEX Writer Core (Week 3-4)
1. Implement `NexFileWriter` class
2. Add header generation
3. Add bank data writing with correct order
4. Basic file output
5. Unit tests for writer

### Phase 3: Parser and AST (Week 5-6)
1. Add SaveNex AST nodes
2. Add SaveNex tokens
3. Implement parser for all .savenex subcommands
4. Add validation logic
5. Parser unit tests

### Phase 4: Assembler Integration (Week 7-8)
1. Add nexConfig to AssemblerOutput
2. Implement SaveNex pragma processors
3. Link to NexFileWriter
4. Handle file I/O for screens/palettes/copper
5. Integration tests

### Phase 5: Export Integration (Week 9)
1. Update ExportCodeCommand
2. Add NEX export path
3. File dialog support for NEX
4. End-to-end testing

### Phase 6: Documentation (Week 10)
1. Update all documentation files per recommendations above
2. Create example NEX projects
3. Add screenshots/diagrams
4. Write migration guide from TAP to NEX

### Phase 7: Polish and Release (Week 11-12)
1. Final testing with real Next hardware/emulators
2. Performance optimization
3. Error message refinement
4. Release notes
5. Community feedback integration

## Compatibility Notes

### Backward Compatibility

- All existing `.bank` code for Spectrum 128 continues to work
- TAP export remains unchanged
- No breaking changes to existing assembler features

### Forward Compatibility

- NEX V1.2 is the target, but structure allows future versions
- Reserved space in NEX header for future extensions
- Modular design allows adding new screen types/features

## Example Projects

### Example 1: Minimal NEX

```z80klive
.model Next

; Configure NEX file
.savenex open "minimal.nex", 0
.savenex auto

; Simple program
.org #8000
.ent #8000
Start:
    ld a, 2
    out (#fe), a    ; Red border
    jr Start

.savenex close
```

### Example 2: Multi-Bank Game

```z80klive
.model Next

; NEX configuration
.savenex open "game.nex", 0
.savenex core 3, 1, 10
.savenex cfg 0, 0
.savenex screen l2 "title.nxi", 0, "title.nxp"
.savenex bar 1, 2, 5, 25
.savenex entrybank 5
.savenex auto

; Main code in bank 5
.bank 5
.org #C000
.ent $
Main:
    ; Initialize
    call LoadBank2
    call LoadBank10
    
    ; Game loop
GameLoop:
    call UpdateGame
    call RenderScreen
    jr GameLoop

LoadBank2:
    nextreg $56, 2      ; Page bank 2 to slot 6
    ret

LoadBank10:
    nextreg $57, 10     ; Page bank 10 to slot 7
    ret

; Game logic in bank 2
.bank 2
.org #C000
UpdateGame:
    ; Game update code
    ret

; Graphics data in bank 10
.bank 10
.org #C000
RenderScreen:
    ; Render code
    ret

; Sprite data in bank 20
.bank 20
.org #C000
SpriteData:
    .defb 0,1,2,3,4,5,6,7,8,9

; Finalize
.savenex close
```

### Example 3: With Copper Effects

```z80klive
.model Next

.savenex open "demo.nex", 0
.savenex core 3, 0, 0
.savenex cfg 0, 0
.savenex screen l2 "loading.nxi"
.savenex copper "raster.cop"
.savenex bar 1, 4
.savenex auto

.org #8000
.ent #8000
DemoMain:
    ; Demo code
    halt
    jr DemoMain

.savenex close
```

## Resources and References

### Official Documentation
- NEX Format Spec: https://wiki.specnext.dev/NEX_file_format
- ZX Spectrum Next Wiki: https://wiki.specnext.dev/
- Spectrum Next Developer Wiki: https://wiki.specnext.dev/Main_Page

### Existing Implementations
- sjasmplus NEX support: http://z00m128.github.io/sjasmplus/documentation.html#c_savenex
- NexCreator (C): https://gitlab.com/thesmog358/tbblue/blob/master/src/c/NexCreator.c
- nexload (ASM): https://gitlab.com/thesmog358/tbblue/blob/master/src/asm/nexload/nexload.asm

### Testing Resources
- ZEsarUX emulator (supports Next): https://github.com/chernandezba/zesarux
- #CSpect emulator: https://dailly.blogspot.com/
- Next real hardware testing

## Risks and Mitigation

### Risk 1: NEX Format Changes
**Mitigation:** Implement version detection, support V1.0, V1.1, V1.2

### Risk 2: File Size Issues
**Mitigation:** Validate all sizes before writing, clear error messages

### Risk 3: Bank Ordering Complexity
**Mitigation:** Extensive unit tests, reference implementation comparison

### Risk 4: Screen Format Compatibility
**Mitigation:** Document exact file formats, provide validation tools

### Risk 5: Breaking Existing Code
**Mitigation:** Comprehensive regression testing, gradual rollout

## Success Criteria

1. ✅ Can compile and generate valid NEX V1.2 files
2. ✅ NEX files load and run on real Next hardware
3. ✅ NEX files work in #CSpect and ZEsarUX emulators
4. ✅ All 112 banks accessible and functional
5. ✅ Loading screens display correctly
6. ✅ Zero regression in existing Spectrum 128 bank functionality
7. ✅ Documentation complete and accurate
8. ✅ Community feedback positive
9. ✅ Passes compatibility test suite
10. ✅ Performance acceptable (compile time < 2x current)

## Conclusion

The addition of ZX Spectrum Next NEX file format support to the Klive Z80 Assembler represents a significant enhancement that will enable developers to create native Next applications directly within the IDE. The implementation is designed to:

- **Extend gracefully** from existing bank infrastructure
- **Maintain compatibility** with all current features
- **Provide comprehensive** NEX format support
- **Document clearly** for ease of use
- **Test thoroughly** for reliability

The documentation improvements outlined in this plan will ensure users can effectively utilize the new NEX capabilities while maintaining the quality and clarity of the existing assembler documentation.

---

**Document Version:** 1.0  
**Date:** January 17, 2026  
**Author:** Klive Z80 Assembler Development Team  
**Status:** Planning Phase
