# `.dma` Pragma Implementation Plan

## Motivation

Programming the zxnDMA requires writing raw binary byte sequences that encode register bit fields, follow-byte indicators, and command codes. For example, the `api_sprite.asm` DMA program for sprite loading looks like this:

```z80
spriteDMAProgram:
    DB %0'11111'01          ; WR0: A→B, transfer, all follow bytes
    DW 0                    ; Port A start address (patched)
    DW 0                    ; Block length (patched)
    DB %0'0010'100          ; WR1: memory, increment
    DB %0'0101'000          ; WR2: I/O, fixed
    DB %1'01011'01          ; WR4: continuous, Port B addr follows
    DW $005B                ; Port B address
    DB %1'00000'10          ; WR5: no auto-restart
    DB %1'10011'11          ; WR6: LOAD
    DB %1'00001'11          ; WR6: ENABLE
```

Every bit field must be manually encoded. The reader needs extensive comments to understand the purpose. Mistakes are easy and hard to diagnose.

The `.dma` pragma introduces a structured, named syntax that compiles to the exact same byte sequences.

---

## Syntax Design

The `.dma` pragma follows the `.savenex` model: a single pragma keyword (`.dma`) followed by a **sub-command** identifier and its parameters. Each `.dma` line emits one DMA register group or command.

### Sub-command Overview

| Sub-command | Emits | Parameters |
|---|---|---|
| `reset` | WR6 `0xC3` | *(none)* |
| `wr0` | WR0 base + follow bytes | direction, transfer type, port A address, block length |
| `wr1` | WR1 base + optional timing | port type, address mode, cycle length |
| `wr2` | WR2 base + optional timing + prescaler | port type, address mode, cycle length, prescaler |
| `wr3` | WR3 base + optional follow bytes | enable flag, match/mask config |
| `wr4` | WR4 base + follow bytes | operating mode, port B address |
| `wr5` | WR5 base byte | auto-restart flag |
| `load` | WR6 `0xCF` | *(none)* |
| `enable` | WR6 `0x87` | *(none)* |
| `disable` | WR6 `0x83` | *(none)* |
| `continue` | WR6 `0xD3` | *(none)* |
| `readmask` | WR6 `0xBB` + follow byte | mask expression |
| `cmd` | WR6 any byte | raw expression (escape hatch) |
| `set` | WR0-WR5 composite shorthand | named key-value pairs |

---

### Detailed Syntax

#### Simple Commands (WR6, no parameters)

```z80
.dma reset          ; emits 0xC3
.dma load           ; emits 0xCF
.dma enable         ; emits 0x87
.dma disable        ; emits 0x83
.dma continue       ; emits 0xD3
```

#### Raw Command (WR6, escape hatch)

```z80
.dma cmd 0xCF       ; emits the expression value as a single byte
.dma cmd $87        ; any expression allowed
```

#### Read Mask

```z80
.dma readmask 0x7E  ; emits 0xBB, 0x7E
```

#### WR0 — Direction, Port A Address, Block Length

```z80
.dma wr0 direction, transfer_type [, portA_addr_expr [, block_len_expr]]
```

Parameters:
1. **Direction** *(required)*: `a_to_b` | `b_to_a`
2. **Transfer type** *(required)*: `transfer` | `search` | `search_transfer`
3. **Port A start address** *(optional)*: 16-bit expression
4. **Block length** *(optional, requires portA_addr)*: 16-bit expression

The assembler **always** sets all four follow-byte indicator bits (D3–D6 = `1111`) in the base byte, regardless of how many parameters are supplied. Any omitted values are left for the caller to emit as subsequent labeled `.dw` directives (see [Runtime Patching Pattern](#runtime-patching-pattern)).

> Block length cannot be specified without also specifying port A address (positional order matches the hardware byte stream).

**Examples:**
```z80
.dma wr0 a_to_b, transfer, 0x8000, 1024
; Emits: 0x7D, 0x00, 0x80, 0x00, 0x04  (base + addr + len)

.dma wr0 a_to_b, transfer, 0x8000
; Emits: 0x7D, 0x00, 0x80  (base + addr only; len via labeled .dw)

.dma wr0 a_to_b, transfer
; Emits: 0x7D  (base only; addr and len via labeled .dw)
```

#### WR1 — Port A Configuration

```z80
.dma wr1 port_type, addr_mode [, cycle_length]
```

Parameters:
1. **Port type**: `memory` | `io`
2. **Address mode**: `increment` | `decrement` | `fixed`
3. **Cycle length** *(optional)*: `2t` | `3t` | `4t` (default: no timing byte emitted)

**Examples:**
```z80
.dma wr1 memory, increment         ; emits 0x14
.dma wr1 io, fixed, 2t             ; emits 0x6C, 0x02
```

#### WR2 — Port B Configuration

```z80
.dma wr2 port_type, addr_mode [, cycle_length [, prescaler_expr]]
```

Parameters:
1. **Port type**: `memory` | `io`
2. **Address mode**: `increment` | `decrement` | `fixed`
3. **Cycle length** *(optional)*: `2t` | `3t` | `4t`
4. **Prescaler** *(optional, requires cycle_length)*: 8-bit expression

**Examples:**
```z80
.dma wr2 io, fixed                 ; emits 0x28
.dma wr2 io, fixed, 3t             ; emits 0x68, 0x01
.dma wr2 memory, increment, 2t, 50 ; emits 0x50, 0x22, 0x32
```

> **Note:** Prescaler is a ZX Next extension. The prescaler byte is only emitted when present, and the timing byte's D5 bit is set to indicate it.

#### WR3 — Interrupt and Match Control

```z80
.dma wr3 [dma_enable] [, stop_on_match] [, int_enable] [, mask_expr, match_expr]
```

Parameters (all optional, keyword-based):
1. **dma_enable**: `dma_enable` — sets D6 (triggers start)
2. **stop_on_match**: `stop_on_match` — sets D2
3. **int_enable**: `int_enable` — sets D5
4. **mask_expr, match_expr**: both present → sets D3 and D4, emits mask then match follow bytes

**Examples:**
```z80
.dma wr3 dma_enable                 ; emits 0xC0
.dma wr3 stop_on_match, 0xFF, 0x00  ; emits 0x9C, 0xFF, 0x00
```

> **Note:** Most WR3 features are stubs in the Next FPGA. Only `dma_enable` is fully functional.

#### WR4 — Operating Mode and Port B Address

```z80
.dma wr4 mode [, portB_addr_expr]
```

Parameters:
1. **Operating mode** *(required)*: `byte` | `continuous` | `burst`
2. **Port B address** *(optional)*: 16-bit expression

The assembler **always** sets D2 and D3 (both address follow-byte indicator bits) in the base byte. If `portB_addr_expr` is omitted, the two address bytes must follow as a labeled `.dw` directive.

**Examples:**
```z80
.dma wr4 continuous, 0x005B  ; emits 0x2D, 0x5B, 0x00
.dma wr4 burst, 0x00FE       ; emits 0x4D, 0xFE, 0x00

.dma wr4 continuous          ; emits 0x2D only; addr via labeled .dw
```

#### WR5 — Control Flags

```z80
.dma wr5 [auto_restart]
```

Parameters:
1. **auto_restart** *(optional)*: `auto_restart` — sets D5

**Examples:**
```z80
.dma wr5                    ; emits 0x82 (no auto-restart)
.dma wr5 auto_restart       ; emits 0xA2
```

#### `set` — Composite Shorthand

The `set` sub-command provides a high-level shorthand that emits multiple register groups from named key-value pairs. It emits `reset`, the configured WR groups, `load`, and `enable` in the correct order.

```z80
.dma set direction=a_to_b, \
         port_a=memory:increment:0x8000, \
         port_b=io:fixed:0x005B, \
         length=1024, \
         mode=continuous
```

This is syntactic sugar that emits the same bytes as:

```z80
.dma reset
.dma wr0 a_to_b, transfer, 0x8000, 1024
.dma wr1 memory, increment
.dma wr2 io, fixed
.dma wr4 continuous, 0x005B
.dma wr5
.dma load
.dma enable
```

The `set` sub-command is a **Phase 2** feature and will not be implemented in the initial version.

---

## Runtime Patching Pattern

Real DMA programs are stored in memory as a table of configuration bytes. Before activating the DMA, the calling code patches specific fields (typically the source address and block length) with runtime values. The optional address/length parameters in `wr0` and `wr4` are designed for exactly this use case.

Instead of using raw `.dw` placeholders after undocumented `DB` base bytes, the programmer writes:

```z80
spriteDMAProgram:
    .dma wr0 a_to_b, transfer      ; base byte only (0x7D), all follow-bit indicators set
PORT_A:
    .dw 0                          ; Port A addr placeholder — patched at runtime
BLOCK_LEN:
    .dw 0                          ; Block length placeholder — patched at runtime
    .dma wr1 memory, increment     ; inline, no patching needed
    .dma wr2 io, fixed             ; inline
    .dma wr4 continuous            ; base byte only (0x2D), address follow-bits set
PORT_B:
    .dw $005B                      ; Port B addr — constant but labelled for clarity
    .dma wr5                       ; no auto-restart
    .dma load
    .dma enable
```

Activation code:

```z80
LoadSprites:
    ld hl, spriteData
    ld (PORT_A), hl       ; patch source address
    ld hl, spriteCount
    ld (BLOCK_LEN), hl    ; patch block length
    ld hl, spriteDMAProgram
    ld b, spriteDMAProgram_end - spriteDMAProgram
    ld c, $6B             ; zxnDMA port
    otir                  ; upload DMA program
spriteDMAProgram_end:
```

Mixing inline and labeled forms is fully supported:

```z80
; Address known at compile time, length patched at runtime:
DMAProgram:
    .dma wr0 a_to_b, transfer, spriteData   ; base + addr inline
DMA_LEN:
    .dw 0                                   ; length patched at runtime

; Both address and length patched at runtime:
DMAProgram2:
    .dma wr0 a_to_b, transfer               ; base byte only
DMA_ADDR:
    .dw 0
DMA_LEN2:
    .dw 0
```

---

## Before & After Comparison

### Before (raw bytes from api_sprite.asm)

```z80
spriteDMAProgram:
    DB %0'11111'01          ; WR0: A→B, transfer, all follow bytes
    DW 0                    ; Port A start address (will be patched)
    DW 0                    ; Block length (will be patched)
    DB %0'0010'100          ; WR1: Port A = memory, incrementing
    DB %0'0101'000          ; WR2: Port B = I/O, fixed address
    DB %1'01011'01          ; WR4: continuous mode, Port B address follows
    DW $005B                ; Port B address
    DB %1'00000'10          ; WR5: no auto-restart
    DB %1'10011'11          ; WR6: LOAD command
    DB %1'00001'11          ; WR6: ENABLE DMA command
```

### After (.dma pragma) — compile-time constants

```z80
spriteDMAProgram:
    .dma wr0 a_to_b, transfer, 0, 0
    .dma wr1 memory, increment
    .dma wr2 io, fixed
    .dma wr4 continuous, $005B
    .dma wr5
    .dma load
    .dma enable
```

Both produce the exact same byte sequence (minus the leading `reset`):
`0x7D, 0x00, 0x00, 0x00, 0x00, 0x14, 0x28, 0x2D, 0x5B, 0x00, 0x82, 0xCF, 0x87`

### After (.dma pragma) — runtime-patched addresses

```z80
spriteDMAProgram:
    .dma wr0 a_to_b, transfer     ; base byte 0x7D only
spriteDMAPortA:
    .dw 0                         ; patched with source address before activation
spriteDMADataLength:
    .dw 0                         ; patched with block length before activation
    .dma wr1 memory, increment
    .dma wr2 io, fixed
    .dma wr4 continuous, $005B
    .dma wr5
    .dma load
    .dma enable
```

This matches the `api_sprite.asm` patching pattern exactly — the DMA hardware sees the same byte stream, the labels give the patcher named targets.

---

## Implementation Steps

### Step 1: Token Registration

**File:** `src/main/compiler-common/common-tokens.ts`

Add a new token ID after `SaveNexPragma: 71`:

```typescript
DmaPragma: 72,
```

Shift existing non-pragma tokens (`Macro: 72` onward) up by 1.

Add resolver hash entries:

```typescript
commonResolverHash[".dma"] = CommonTokens.DmaPragma;
commonResolverHash[".DMA"] = CommonTokens.DmaPragma;
commonResolverHash["dma"] = CommonTokens.DmaPragma;
commonResolverHash["DMA"] = CommonTokens.DmaPragma;
```

### Step 2: Tree Node Definitions

**File:** `src/main/compiler-common/tree-nodes.ts`

Add node interfaces for each `.dma` sub-command:

```typescript
// --- DMA Pragma nodes ---
export interface DmaResetPragma<TInstruction> extends PartialAssemblyLine<TInstruction> {
  type: "DmaResetPragma";
}

export interface DmaWr0Pragma<TInstruction, TToken> extends PartialAssemblyLine<TInstruction> {
  type: "DmaWr0Pragma";
  direction: "a_to_b" | "b_to_a";
  transferType: "transfer" | "search" | "search_transfer";
  portAAddr?: Expression<TInstruction, TToken>;   // omitted → caller emits .dw
  blockLength?: Expression<TInstruction, TToken>; // omitted → caller emits .dw
}

export interface DmaWr1Pragma<TInstruction, TToken> extends PartialAssemblyLine<TInstruction> {
  type: "DmaWr1Pragma";
  portType: "memory" | "io";
  addrMode: "increment" | "decrement" | "fixed";
  cycleLength?: "2t" | "3t" | "4t";
}

export interface DmaWr2Pragma<TInstruction, TToken> extends PartialAssemblyLine<TInstruction> {
  type: "DmaWr2Pragma";
  portType: "memory" | "io";
  addrMode: "increment" | "decrement" | "fixed";
  cycleLength?: "2t" | "3t" | "4t";
  prescaler?: Expression<TInstruction, TToken>;
}

export interface DmaWr3Pragma<TInstruction, TToken> extends PartialAssemblyLine<TInstruction> {
  type: "DmaWr3Pragma";
  dmaEnable?: boolean;
  stopOnMatch?: boolean;
  intEnable?: boolean;
  mask?: Expression<TInstruction, TToken>;
  match?: Expression<TInstruction, TToken>;
}

export interface DmaWr4Pragma<TInstruction, TToken> extends PartialAssemblyLine<TInstruction> {
  type: "DmaWr4Pragma";
  mode: "byte" | "continuous" | "burst";
  portBAddr?: Expression<TInstruction, TToken>; // omitted → caller emits .dw
}

export interface DmaWr5Pragma<TInstruction> extends PartialAssemblyLine<TInstruction> {
  type: "DmaWr5Pragma";
  autoRestart?: boolean;
}

export interface DmaLoadPragma<TInstruction> extends PartialAssemblyLine<TInstruction> {
  type: "DmaLoadPragma";
}

export interface DmaEnablePragma<TInstruction> extends PartialAssemblyLine<TInstruction> {
  type: "DmaEnablePragma";
}

export interface DmaDisablePragma<TInstruction> extends PartialAssemblyLine<TInstruction> {
  type: "DmaDisablePragma";
}

export interface DmaContinuePragma<TInstruction> extends PartialAssemblyLine<TInstruction> {
  type: "DmaContinuePragma";
}

export interface DmaReadMaskPragma<TInstruction, TToken> extends PartialAssemblyLine<TInstruction> {
  type: "DmaReadMaskPragma";
  mask: Expression<TInstruction, TToken>;
}

export interface DmaCmdPragma<TInstruction, TToken> extends PartialAssemblyLine<TInstruction> {
  type: "DmaCmdPragma";
  value: Expression<TInstruction, TToken>;
}
```

Add to the `Pragma` union type:

```typescript
| DmaResetPragma<TInstruction>
| DmaWr0Pragma<TInstruction, TToken>
| DmaWr1Pragma<TInstruction, TToken>
| DmaWr2Pragma<TInstruction, TToken>
| DmaWr3Pragma<TInstruction, TToken>
| DmaWr4Pragma<TInstruction, TToken>
| DmaWr5Pragma<TInstruction>
| DmaLoadPragma<TInstruction>
| DmaEnablePragma<TInstruction>
| DmaDisablePragma<TInstruction>
| DmaContinuePragma<TInstruction>
| DmaReadMaskPragma<TInstruction, TToken>
| DmaCmdPragma<TInstruction, TToken>
```

Add to the `ByteEmittingPragma` union type:

```typescript
| DmaResetPragma<TInstruction>
| DmaWr0Pragma<TInstruction, TToken>
| DmaWr1Pragma<TInstruction, TToken>
| DmaWr2Pragma<TInstruction, TToken>
| DmaWr3Pragma<TInstruction, TToken>
| DmaWr4Pragma<TInstruction, TToken>
| DmaWr5Pragma<TInstruction>
| DmaLoadPragma<TInstruction>
| DmaEnablePragma<TInstruction>
| DmaDisablePragma<TInstruction>
| DmaContinuePragma<TInstruction>
| DmaReadMaskPragma<TInstruction, TToken>
| DmaCmdPragma<TInstruction, TToken>
```

### Step 3: Parser Implementation

**File:** `src/main/compiler-common/common-asm-parser.ts`

Add a case in `parsePragma()`:

```typescript
case CommonTokens.DmaPragma:
  return this.parseDmaPragma();
```

Implement `parseDmaPragma()` following the `.savenex` pattern:

```typescript
private parseDmaPragma(): PartialAssemblyLine<TInstruction> | null {
  const subcommand = this.tokens.peek();
  if (subcommand.type !== CommonTokens.Identifier) {
    this.reportError("Z0401"); // Expected DMA sub-command
    return null;
  }
  const subcmdText = subcommand.text?.toLowerCase();
  this.tokens.get(); // consume sub-command identifier

  switch (subcmdText) {
    case "reset":    return { type: "DmaResetPragma" };
    case "load":     return { type: "DmaLoadPragma" };
    case "enable":   return { type: "DmaEnablePragma" };
    case "disable":  return { type: "DmaDisablePragma" };
    case "continue": return { type: "DmaContinuePragma" };
    case "readmask": return this.parseDmaReadMask();
    case "cmd":      return this.parseDmaCmd();
    case "wr0":      return this.parseDmaWr0();
    case "wr1":      return this.parseDmaWr1();
    case "wr2":      return this.parseDmaWr2();
    case "wr3":      return this.parseDmaWr3();
    case "wr4":      return this.parseDmaWr4();
    case "wr5":      return this.parseDmaWr5();
    default:
      this.reportError("Z0401"); // Unknown DMA sub-command
      return null;
  }
}
```

Sub-parsers for register groups:

```typescript
private parseDmaWr0(): DmaWr0Pragma<TInstruction, TToken> | null {
  // direction keyword
  const dirToken = this.tokens.peek();
  const dirText = dirToken.text?.toLowerCase();
  if (dirText !== "a_to_b" && dirText !== "b_to_a") {
    this.reportError("Z0402"); // Expected direction (a_to_b or b_to_a)
    return null;
  }
  this.tokens.get();
  const direction = dirText as "a_to_b" | "b_to_a";

  this.expectToken(CommonTokens.Comma, "Z0403");

  // transfer type keyword
  const ttToken = this.tokens.peek();
  const ttText = ttToken.text?.toLowerCase();
  if (ttText !== "transfer" && ttText !== "search" && ttText !== "search_transfer") {
    this.reportError("Z0404"); // Expected transfer type
    return null;
  }
  this.tokens.get();
  const transferType = ttText as "transfer" | "search" | "search_transfer";

  // portAAddr and blockLength are both optional
  let portAAddr: Expression<TInstruction, TToken> | undefined;
  let blockLength: Expression<TInstruction, TToken> | undefined;
  if (this.tokens.peek().type === CommonTokens.Comma) {
    this.tokens.get(); // consume comma
    portAAddr = this.getExpression();
    if (this.tokens.peek().type === CommonTokens.Comma) {
      this.tokens.get(); // consume comma
      blockLength = this.getExpression();
    }
  }

  return { type: "DmaWr0Pragma", direction, transferType, portAAddr, blockLength };
}
```

The `parseDmaWr4()` parser follows the same optional-parameter approach for `portBAddr`:

```typescript
private parseDmaWr4(): DmaWr4Pragma<TInstruction, TToken> | null {
  const modeToken = this.tokens.peek();
  const modeText = modeToken.text?.toLowerCase();
  if (modeText !== "byte" && modeText !== "continuous" && modeText !== "burst") {
    this.reportError("Z0408");
    return null;
  }
  this.tokens.get();
  const mode = modeText as "byte" | "continuous" | "burst";

  let portBAddr: Expression<TInstruction, TToken> | undefined;
  if (this.tokens.peek().type === CommonTokens.Comma) {
    this.tokens.get();
    portBAddr = this.getExpression();
  }

  return { type: "DmaWr4Pragma", mode, portBAddr };
}
```

Similar patterns for `parseDmaWr1()` through `parseDmaWr3()`, `parseDmaWr5()`, `parseDmaReadMask()`, and `parseDmaCmd()`.

### Step 4: Assembler Emission

**File:** `src/main/compiler-common/common-assembler.ts`

Add cases in `applyPragma()`:

```typescript
case "DmaResetPragma":    this.processDmaSimpleCommand(0xC3); break;
case "DmaLoadPragma":     this.processDmaSimpleCommand(0xCF); break;
case "DmaEnablePragma":   this.processDmaSimpleCommand(0x87); break;
case "DmaDisablePragma":  this.processDmaSimpleCommand(0x83); break;
case "DmaContinuePragma": this.processDmaSimpleCommand(0xD3); break;
case "DmaCmdPragma":      this.processDmaCmdPragma(pragmaLine); break;
case "DmaReadMaskPragma": this.processDmaReadMaskPragma(pragmaLine); break;
case "DmaWr0Pragma":      this.processDmaWr0Pragma(pragmaLine); break;
case "DmaWr1Pragma":      this.processDmaWr1Pragma(pragmaLine); break;
case "DmaWr2Pragma":      this.processDmaWr2Pragma(pragmaLine); break;
case "DmaWr3Pragma":      this.processDmaWr3Pragma(pragmaLine); break;
case "DmaWr4Pragma":      this.processDmaWr4Pragma(pragmaLine); break;
case "DmaWr5Pragma":      this.processDmaWr5Pragma(pragmaLine); break;
```

Implement the emission methods:

```typescript
private processDmaSimpleCommand(cmdByte: number): void {
  this.emitByte(cmdByte);
}

private processDmaCmdPragma(pragma: DmaCmdPragma<TInstruction, TToken>): void {
  const value = this.evaluateExpr(pragma.value);
  if (value.isValid) {
    this.emitByte(value.value & 0xFF);
  } else if (value.isNonEvaluated) {
    this.recordFixup(pragma, FixupType.Bit8, pragma.value);
    this.emitByte(0x00);
  }
}

private processDmaReadMaskPragma(pragma: DmaReadMaskPragma<TInstruction, TToken>): void {
  this.emitByte(0xBB);
  const value = this.evaluateExpr(pragma.mask);
  if (value.isValid) {
    this.emitByte(value.value & 0x7F);
  } else if (value.isNonEvaluated) {
    this.recordFixup(pragma, FixupType.Bit8, pragma.mask);
    this.emitByte(0x00);
  }
}

private processDmaWr0Pragma(pragma: DmaWr0Pragma<TInstruction, TToken>): void {
  // Build base byte: 0LLAADDT
  // D6:D3 are ALWAYS 1111 — all four follow bytes exist in the stream
  // (some may come from subsequent .dw directives rather than this pragma)
  const dirBit = pragma.direction === "a_to_b" ? 0x04 : 0x00;    // D2
  let ttBits: number;
  switch (pragma.transferType) {
    case "transfer":        ttBits = 0x01; break;  // D1:D0 = 01
    case "search":          ttBits = 0x02; break;  // D1:D0 = 10
    case "search_transfer": ttBits = 0x03; break;  // D1:D0 = 11
  }
  const baseByte = 0x78 | dirBit | ttBits; // 0111_1000 | dir | tt
  this.emitByte(baseByte);

  // Emit address follow bytes only if provided inline
  if (pragma.portAAddr !== undefined) {
    const addr = this.evaluateExpr(pragma.portAAddr);
    if (addr.isValid) {
      this.emitByte(addr.value & 0xFF);
      this.emitByte((addr.value >> 8) & 0xFF);
    } else if (addr.isNonEvaluated) {
      this.recordFixup(pragma, FixupType.Bit16, pragma.portAAddr);
      this.emitByte(0x00);
      this.emitByte(0x00);
    }

    // Emit block length follow bytes only if provided inline
    if (pragma.blockLength !== undefined) {
      const len = this.evaluateExpr(pragma.blockLength);
      if (len.isValid) {
        this.emitByte(len.value & 0xFF);
        this.emitByte((len.value >> 8) & 0xFF);
      } else if (len.isNonEvaluated) {
        this.recordFixup(pragma, FixupType.Bit16, pragma.blockLength);
        this.emitByte(0x00);
        this.emitByte(0x00);
      }
    }
    // If blockLength omitted: caller provides 2 bytes via labeled .dw
  }
  // If portAAddr omitted: caller provides all 4 bytes via labeled .dw/.dw
}

private processDmaWr1Pragma(pragma: DmaWr1Pragma<TInstruction, TToken>): void {
  // Base byte: 0TAA_M100
  let baseByte = 0x04; // D2:D0 = 100 (WR1 identifier)

  // Port type (D3): 1=I/O, 0=memory
  if (pragma.portType === "io") baseByte |= 0x08;

  // Address mode (D5:D4): 00=dec, 01=inc, 10/11=fixed
  switch (pragma.addrMode) {
    case "decrement": break; // 00
    case "increment": baseByte |= 0x10; break; // 01
    case "fixed":     baseByte |= 0x20; break; // 10
  }

  // Timing byte follows? (D6)
  if (pragma.cycleLength) {
    baseByte |= 0x40;
  }

  this.emitByte(baseByte);

  // Timing follow byte (if cycle length specified)
  if (pragma.cycleLength) {
    let timingByte = 0x00;
    switch (pragma.cycleLength) {
      case "4t": break;            // D1:D0 = 00
      case "3t": timingByte = 0x01; break; // D1:D0 = 01
      case "2t": timingByte = 0x02; break; // D1:D0 = 10
    }
    this.emitByte(timingByte);
  }
}

private processDmaWr2Pragma(pragma: DmaWr2Pragma<TInstruction, TToken>): void {
  // Base byte: 0TAA_M000
  let baseByte = 0x00; // D2:D0 = 000 (WR2 identifier)

  if (pragma.portType === "io") baseByte |= 0x08;

  switch (pragma.addrMode) {
    case "decrement": break;
    case "increment": baseByte |= 0x10; break;
    case "fixed":     baseByte |= 0x20; break;
  }

  if (pragma.cycleLength || pragma.prescaler) {
    baseByte |= 0x40; // timing byte follows
  }

  this.emitByte(baseByte);

  // Timing byte + optional prescaler
  if (pragma.cycleLength || pragma.prescaler) {
    let timingByte = 0x00;
    if (pragma.cycleLength) {
      switch (pragma.cycleLength) {
        case "4t": break;
        case "3t": timingByte = 0x01; break;
        case "2t": timingByte = 0x02; break;
      }
    }
    if (pragma.prescaler) {
      timingByte |= 0x20; // D5 = prescaler follows
    }
    this.emitByte(timingByte);

    if (pragma.prescaler) {
      const ps = this.evaluateExpr(pragma.prescaler);
      if (ps.isValid) {
        this.emitByte(ps.value & 0xFF);
      } else if (ps.isNonEvaluated) {
        this.recordFixup(pragma, FixupType.Bit8, pragma.prescaler);
        this.emitByte(0x00);
      }
    }
  }
}

private processDmaWr3Pragma(pragma: DmaWr3Pragma<TInstruction, TToken>): void {
  // Base byte: 1EIS_MK00
  let baseByte = 0x80; // D7=1, D1:D0=00 (WR3 identifier)

  if (pragma.dmaEnable)  baseByte |= 0x40; // D6
  if (pragma.intEnable)  baseByte |= 0x20; // D5
  if (pragma.match)      baseByte |= 0x10; // D4 = match byte follows
  if (pragma.mask)       baseByte |= 0x08; // D3 = mask byte follows
  if (pragma.stopOnMatch) baseByte |= 0x04; // D2

  this.emitByte(baseByte);

  // Follow bytes: mask first (if D3), then match (if D4)
  if (pragma.mask) {
    const m = this.evaluateExpr(pragma.mask);
    if (m.isValid) this.emitByte(m.value & 0xFF);
  }
  if (pragma.match) {
    const m = this.evaluateExpr(pragma.match);
    if (m.isValid) this.emitByte(m.value & 0xFF);
  }
}

private processDmaWr4Pragma(pragma: DmaWr4Pragma<TInstruction, TToken>): void {
  // Base byte: 1MM_IBA01
  let baseByte = 0x81; // D7=1, D1:D0=01 (WR4 identifier)

  switch (pragma.mode) {
    case "byte":       break;                     // MM=00
    case "continuous": baseByte |= 0x20; break;   // MM=01
    case "burst":      baseByte |= 0x40; break;   // MM=10
  }

  // D3=1, D2=1: address follow bytes exist in stream (inline or via .dw)
  baseByte |= 0x0C;
  this.emitByte(baseByte);

  // Port B address follow bytes — only if provided inline
  if (pragma.portBAddr !== undefined) {
    const addr = this.evaluateExpr(pragma.portBAddr);
    if (addr.isValid) {
      this.emitByte(addr.value & 0xFF);
      this.emitByte((addr.value >> 8) & 0xFF);
    } else if (addr.isNonEvaluated) {
      this.recordFixup(pragma, FixupType.Bit16, pragma.portBAddr);
      this.emitByte(0x00);
      this.emitByte(0x00);
    }
  }
  // If portBAddr omitted: caller provides 2 bytes via labeled .dw
}

private processDmaWr5Pragma(pragma: DmaWr5Pragma<TInstruction>): void {
  // Base byte: 10RW_R010
  let baseByte = 0x82; // D7:D6=10, D2:D0=010 (WR5 identifier)
  if (pragma.autoRestart) baseByte |= 0x20; // D5
  this.emitByte(baseByte);
}
```

### Step 5: Model Validation (Z80-specific)

**File:** `src/main/z80-compiler/z80-assembler.ts`

Add a check in the Z80 assembler to ensure `.dma` pragmas are only used when the model is set to `next`:

```typescript
// In the appropriate validation point (similar to how Next instructions are checked):
if (pragmaLine.type.startsWith("Dma") && this._output.modelType !== SpectrumModelType.Next) {
  this.reportAssemblyError("Z0410", pragmaLine); // .dma pragma requires Next model
  return;
}
```

### Step 6: Error Codes

**File:** Add new error codes to `src/main/compiler-common/assembler-errors.ts` (in the Z03xx pragma section, after Z0352 SaveNex errors):

| Code | Message |
|---|---|
| `Z0360` | "Unknown .dma sub-command: '{0}'" |
| `Z0361` | "Expected direction: 'a_to_b' or 'b_to_a'" |
| `Z0362` | "Expected transfer type: 'transfer', 'search', or 'search_transfer'" |
| `Z0363` | "Expected port type: 'memory' or 'io'" |
| `Z0364` | "Expected address mode: 'increment', 'decrement', or 'fixed'" |
| `Z0365` | "Expected cycle length: '2t', '3t', or '4t'" |
| `Z0366` | "Expected operating mode: 'byte', 'continuous', or 'burst'" |
| `Z0367` | "Prescaler requires cycle length to be specified" |
| `Z0368` | "The .dma pragma requires the Next model (.model next)" |

> **Note:** Codes Z0401–Z0410 were already taken by instruction-level errors. DMA errors use the Z036x range.

### Step 7: Documentation

**File:** `docs/pages/z80-assembly/pragmas.mdx`

Add a new section after the existing pragmas documenting the full `.dma` syntax with examples (following the same style as existing pragma docs).

### Step 8: Test Cases

**File:** `test/z80-assembler/dma-pragma.test.ts` (new file)

Test categories:

1. **Simple commands:** Verify each WR6 command emits the correct single byte
   - `reset` → `[0xC3]`
   - `load` → `[0xCF]`
   - `enable` → `[0x87]`
   - `disable` → `[0x83]`
   - `continue` → `[0xD3]`

2. **WR0 encoding:** Direction × transfer type × optional address/length variants
   - `wr0 a_to_b, transfer, 0x8000, 1024` → `[0x7D, 0x00, 0x80, 0x00, 0x04]`
   - `wr0 b_to_a, search, 0x4000, 256` → `[0x7A, 0x00, 0x40, 0x00, 0x01]`
   - `wr0 a_to_b, transfer, 0x8000` → `[0x7D, 0x00, 0x80]` (base + addr only)
   - `wr0 a_to_b, transfer` → `[0x7D]` (base only; D3–D6 still = 1111)

3. **WR1 encoding:** All port type × address mode × timing combinations
   - `wr1 memory, increment` → `[0x14]`
   - `wr1 io, fixed, 2t` → `[0x6C, 0x02]`

4. **WR2 encoding:** Same as WR1 plus prescaler
   - `wr2 io, fixed` → `[0x28]`
   - `wr2 io, fixed, 3t, 50` → `[0x68, 0x21, 0x32]`

5. **WR3 encoding:** Flag combinations, mask/match follow bytes
   - `wr3 dma_enable` → `[0xC0]`

6. **WR4 encoding:** Mode × optional Port B address
   - `wr4 continuous, 0x005B` → `[0x2D, 0x5B, 0x00]`
   - `wr4 continuous` → `[0x2D]` (base only; D2–D3 still set)

7. **WR5 encoding:**
   - `wr5` → `[0x82]`
   - `wr5 auto_restart` → `[0xA2]`

8. **readmask:** `readmask 0x7E` → `[0xBB, 0x7E]`

9. **cmd (escape hatch):** `cmd 0xCF` → `[0xCF]`

10. **Full program:** Assemble the sprite DMA example and verify the complete byte sequence matches the raw `DB`/`DW` version

11. **Runtime patching pattern:** Full DMA program using omitted-address form
    - `wr0 a_to_b, transfer` followed by two `.dw` produces identical byte stream to `wr0 a_to_b, transfer, 0, 0`
    - `wr4 continuous` followed by `.dw $005B` produces same bytes as `wr4 continuous, $005B`
    - Labels on the follow-on `.dw` directives are addressable and patchable at runtime

12. **Error cases:**
    - `.dma` without sub-command → error Z0401
    - `.dma wr0 invalid_dir, ...` → error Z0402
    - `.dma wr0` without a model set to `next` → error Z0410
    - `.dma wr2 io, fixed, prescaler_without_cycle` → error Z0409

12. **Expression support:** Verify labels and expressions work in address/length positions
    - Forward references trigger fixups and resolve correctly

---

## File Modification Summary

| File | Change |
|---|---|
| `src/main/compiler-common/common-tokens.ts` | Add `DmaPragma: 72`, update subsequent IDs, add resolver entries |
| `src/main/compiler-common/tree-nodes.ts` | Add 13 DMA node interfaces, update `Pragma` and `ByteEmittingPragma` unions |
| `src/main/compiler-common/common-asm-parser.ts` | Add `parseDmaPragma()` + 10 sub-parsers, add case in `parsePragma()` |
| `src/main/compiler-common/common-assembler.ts` | Add 13 cases in `applyPragma()`, add 10 emission methods |
| `src/main/z80-compiler/z80-assembler.ts` | Add Next-model validation for DMA pragmas |
| `src/main/z80-compiler/z80-asm-errors.ts` (or equivalent) | Add error codes Z0401–Z0410 |
| `docs/pages/z80-assembly/pragmas.mdx` | Add `.dma` pragma documentation section |
| `test/z80-assembler/dma-pragma.test.ts` | New test file with ~30 test cases |

## Phase 2A: Syntax Highlighting

The Klive editor uses the Monaco Monarch tokenizer. The word lists and state rules live in `src/renderer/appIde/project/asmKz80LangaugeProvider.ts`. Each step below is independently testable.

---

### Step SH-1: Add `.dma` to the pragmas word list

**File:** `src/renderer/appIde/project/asmKz80LangaugeProvider.ts`

Append four entries to the `pragmas` array (same pattern as every other pragma: dot-lowercase, dot-uppercase, bare-lowercase, bare-uppercase):

```ts
".dma",
".DMA",
"dma",
"DMA",
```

**Effect:** The `.dma` keyword is coloured the pragma colour (`#c586c0`) in the editor.

**Test (unit):** The `pragmas` array in the language definition contains `".dma"`. Since `asmKz80LangaugeProvider` exports the definition object, a test can import it and assert:

```ts
it("includes .dma in pragma word list", () => {
  const def = asmKz80LanguageProvider.languageDef as any;
  expect(def.pragmas).toContain(".dma");
  expect(def.pragmas).toContain("dma");
});
```

---

### Step SH-2: Add a dedicated Monarch rule for `.dma` that transitions to a sub-command state

**File:** `src/renderer/appIde/project/asmKz80LangaugeProvider.ts`

The generic identifier rule handles `.dma` via the `@pragmas` case but cannot also push a new state per individual keyword. Add a **specific rule before** the generic identifier rule in the `root` tokenizer state:

```ts
// DMA pragma — push dmaSubcmd state so the following identifier gets highlighted
[/\.[Dd][Mm][Aa]|[Dd][Mm][Aa]/, { token: "pragma", next: "@dmaSubcmd" }],
```

Add a new `dmaSubcmd` tokenizer state:

```ts
dmaSubcmd: [
  // Consume leading whitespace without leaving the state
  [/[ \t]+/, "white"],
  // DMA sub-command keywords — colour as statement, then pop back to root
  [
    /wr[0-5]|reset|load|enable|disable|continue|readmask|cmd/,
    { token: "statement", next: "@pop" }
  ],
  // Anything else: tokenize as identifier and return to root
  [/[\._@`A-Za-z][_@!?\.0-9A-Za-z]*/, { token: "identifier", next: "@pop" }],
  // Fallback: end of line, return to root
  [/$/, { token: "", next: "@pop" }]
],
```

**Effect:** After `.dma` / `dma`, the next token (the sub-command such as `wr0`, `reset`, `load`) gets the `"statement"` colour (`#c586c0` bold) rather than being treated as an ordinary identifier.

**Test:** Assert the `tokenizer` object on the exported language definition contains a `dmaSubcmd` key with a rule that matches `wr0`:

```ts
it("dmaSubcmd state contains sub-command rule", () => {
  const def = asmKz80LanguageProvider.languageDef as any;
  const state = def.tokenizer?.dmaSubcmd;
  expect(state).toBeDefined();
  // At least one rule's regex should match 'wr0'
  const hasWr0Rule = state.some((rule: any) =>
    Array.isArray(rule) && rule[0] instanceof RegExp && rule[0].test("wr0")
  );
  expect(hasWr0Rule).toBe(true);
});
```

---

### Step SH-3: Highlight DMA parameter keywords

**File:** `src/renderer/appIde/project/asmKz80LangaugeProvider.ts`

DMA parameter keywords (`a_to_b`, `b_to_a`, `memory`, `io`, `increment`, `decrement`, `fixed`, `continuous`, `burst`, `byte`, `transfer`, `search`, `search_transfer`, `auto_restart`, `dma_enable`, `stop_on_match`, `int_enable`, `2t`, `3t`, `4t`) should only be highlighted when they appear inside a `.dma` line.

Extend the `dmaSubcmd` state so that instead of immediately popping after the sub-command, it pushes a new `dmaParams` state:

```ts
dmaSubcmd: [
  [/[ \t]+/, "white"],
  [
    /wr[0-5]|reset|load|enable|disable|continue|readmask|cmd/,
    { token: "statement", next: "@dmaParams" }   // push params state
  ],
  [/[\._@`A-Za-z][_@!?\.0-9A-Za-z]*/, { token: "identifier", next: "@pop" }],
  [/$/, { token: "", next: "@pop" }]
],

dmaParams: [
  // Whitespace and commas
  [/[ \t,]+/, "white"],
  // DMA-specific parameter keywords — use "keyword" token type
  [
    /a_to_b|b_to_a|transfer|search_transfer|search|memory|io|increment|decrement|fixed|continuous|burst|byte|auto_restart|dma_enable|stop_on_match|int_enable|[234]t/,
    "keyword"
  ],
  // Numbers and expressions — delegate to root rules
  [/(?:(0x|\$)[0-9A-Fa-f]{1,4}|[0-9][0-9A-Fa-f]{0,3}[Hh])/, "number"],
  [/%[01_]+/, "number"],
  [/[0-9]+/, "number"],
  // Any other identifier (e.g. a label used as an expression)
  [/[\._@`A-Za-z][_@!?\.0-9A-Za-z]*/, "identifier"],
  // End of line: pop all DMA states
  [/$/, { token: "", next: "@popall" }]
],
```

**Effect:** `a_to_b`, `memory`, `continuous`, etc. are coloured as keywords (`#569cd6` bold) only when they appear on a `.dma` line, not when used as ordinary identifiers elsewhere.

**Test:** Assert the `dmaParams` state exists and contains a rule whose regex matches `a_to_b` and `memory`:

```ts
it("dmaParams state highlights parameter keywords", () => {
  const def = asmKz80LanguageProvider.languageDef as any;
  const state = def.tokenizer?.dmaParams;
  expect(state).toBeDefined();
  const paramRule = state.find((rule: any) =>
    Array.isArray(rule) && rule[0] instanceof RegExp && rule[0].test("a_to_b")
  );
  expect(paramRule).toBeDefined();
  // memory and io should also match
  expect(paramRule[0].test("memory")).toBe(true);
  expect(paramRule[0].test("io")).toBe(true);
});
```

---

## Phase 2B: Auto-complete

The completion system has two layers:
- **Static data** in `z80-completion-data.ts` (pragma labels, snippets, etc.)
- **Context-aware dispatch** in `computeCompletionItems()` in `z80-providers.ts`

The Monaco provider currently calls `computeCompletionItems(prefix, triggerChar, service)` without passing the full line text. Context-aware `.dma` completions require knowing what precedes the cursor on the current line.

---

### Step AC-1: Add `.dma` entry to the static completion data

**File:** `src/renderer/appIde/services/z80-completion-data.ts`

Append to the `pragmas` array:

```ts
{
  label: ".dma",
  kind: "pragma",
  detail: "DMA register group or command (ZX Spectrum Next)",
  insertText: ".dma ${1|reset,load,enable,disable,continue,wr0,wr1,wr2,wr3,wr4,wr5,readmask,cmd|}",
  next: true
},
```

The `insertText` uses Monaco's choice snippet syntax — typing `.dma` and accepting the completion opens a choice picker for the sub-command.

**Test:**

```ts
it("Z80_COMPLETION_ITEMS includes .dma pragma", () => {
  const item = Z80_COMPLETION_ITEMS.find((i) => i.label === ".dma");
  expect(item).toBeDefined();
  expect(item!.kind).toBe("pragma");
  expect(item!.next).toBe(true);
});

it("computeCompletionItems returns .dma when triggered by '.'", () => {
  const items = computeCompletionItems("", ".", mockService);
  expect(items.some((i) => i.label === ".dma")).toBe(true);
});

it("computeCompletionItems returns .dma when filtering by prefix 'dm'", () => {
  const items = computeCompletionItems("dm", ".", mockService);
  expect(items.some((i) => i.label === ".dma")).toBe(true);
});
```

---

### Step AC-2: Add `lineContent` parameter to `computeCompletionItems`

**File:** `src/renderer/appIde/services/z80-providers.ts`

Extend the function signature to accept the full line text:

```ts
export function computeCompletionItems(
  word: string,
  triggerChar: string | undefined,
  service: ILanguageIntelService,
  lineContent?: string          // ← new optional parameter
): CompletionResult[]
```

Add a helper that detects the DMA context from `lineContent`:

```ts
/**
 * Returns the DMA completion context from the current line, or null.
 *
 * Examples:
 *   ".dma "              → { phase: "subcommand" }
 *   ".dma wr0 "          → { phase: "wr0-direction" }
 *   ".dma wr0 a_to_b, "  → { phase: "wr0-transfer" }
 *   ".dma wr1 "          → { phase: "wr1-porttype" }
 *   ".dma wr1 memory, "  → { phase: "wr1-addrmode" }
 *   etc.
 */
export function getDmaCompletionContext(lineContent: string): DmaCompletionContext | null {
  // Normalize: strip label prefix ("myLabel: .dma ...") before matching
  const line = lineContent.replace(/^[^:;]+:\s*/, "").trimStart().toLowerCase();

  const dmaMatch = /^\.?dma\s+/.exec(line);
  if (!dmaMatch) return null;
  const rest = line.slice(dmaMatch[0].length).trimStart();

  if (rest === "") return { phase: "subcommand" };

  const parts = rest.split(/\s*,\s*/);
  const subcmd = parts[0].trim();

  if (subcmd === "wr0") {
    if (parts.length === 1) return { phase: "wr0-direction" };
    if (parts.length === 2) return { phase: "wr0-transfer" };
    if (parts.length === 3) return { phase: "wr0-portaaddr" };
    if (parts.length === 4) return { phase: "wr0-blocklen" };
  }
  if (subcmd === "wr1" || subcmd === "wr2") {
    if (parts.length === 1) return { phase: "porttype" };
    if (parts.length === 2) return { phase: "addrmode" };
    if (parts.length === 3) return { phase: "cyclelen" };
    if (subcmd === "wr2" && parts.length === 4) return { phase: "prescaler" };
  }
  if (subcmd === "wr4") {
    if (parts.length === 1) return { phase: "wr4-mode" };
    if (parts.length === 2) return { phase: "wr4-portbaddr" };
  }
  if (subcmd === "wr3") return { phase: "wr3-flags" };
  if (subcmd === "wr5") return { phase: "wr5-flags" };

  return null;
}
```

Insert the context check at the top of `computeCompletionItems`:

```ts
// --- DMA context-aware completions (highest priority)
if (lineContent) {
  const dmaCtx = getDmaCompletionContext(lineContent);
  if (dmaCtx) {
    return getDmaCompletionItems(dmaCtx);
  }
}
```

**Test (pure function, no Monaco involved):**

```ts
describe("getDmaCompletionContext", () => {
  it("returns subcommand phase for '.dma '", () => {
    expect(getDmaCompletionContext(".dma ")).toEqual({ phase: "subcommand" });
  });
  it("returns wr0-direction phase for '.dma wr0 '", () => {
    expect(getDmaCompletionContext("    .dma wr0 ")).toEqual({ phase: "wr0-direction" });
  });
  it("returns wr0-transfer phase for '.dma wr0 a_to_b, '", () => {
    expect(getDmaCompletionContext(".dma wr0 a_to_b, ")).toEqual({ phase: "wr0-transfer" });
  });
  it("returns porttype phase for '.dma wr1 '", () => {
    expect(getDmaCompletionContext(".dma wr1 ")).toEqual({ phase: "porttype" });
  });
  it("returns addrmode phase for '.dma wr1 memory, '", () => {
    expect(getDmaCompletionContext(".dma wr1 memory, ")).toEqual({ phase: "addrmode" });
  });
  it("returns wr4-mode phase for '.dma wr4 '", () => {
    expect(getDmaCompletionContext(".dma wr4 ")).toEqual({ phase: "wr4-mode" });
  });
  it("returns null for unrelated line", () => {
    expect(getDmaCompletionContext("ld hl, 0")).toBeNull();
  });
  it("handles label prefix", () => {
    expect(getDmaCompletionContext("myLabel: .dma wr1 ")).toEqual({ phase: "porttype" });
  });
});
```

---

### Step AC-3: Implement `getDmaCompletionItems`

**File:** `src/renderer/appIde/services/z80-providers.ts`

Add the lookup table and the generator function:

```ts
/** All the context-specific completion tables for .dma parameter positions */
const DMA_ITEMS: Record<DmaCompletionContext["phase"], CompletionResult[]> = {
  subcommand: [
    keyword("reset",    "WR6: full DMA reset",                                "reset"),
    keyword("load",     "WR6: load addresses into transfer engine",            "load"),
    keyword("enable",   "WR6: enable / start DMA transfer",                   "enable"),
    keyword("disable",  "WR6: stop DMA transfer",                             "disable"),
    keyword("continue", "WR6: continue (reset byte counter, keep addresses)", "continue"),
    keyword("wr0",      "WR0: direction, port A address, block length",       "wr0 ${1|a_to_b,b_to_a|}, ${2|transfer,search,search_transfer|}"),
    keyword("wr1",      "WR1: port A type and address mode",                  "wr1 ${1|memory,io|}, ${2|increment,decrement,fixed|}"),
    keyword("wr2",      "WR2: port B type and address mode",                  "wr2 ${1|memory,io|}, ${2|increment,decrement,fixed|}"),
    keyword("wr3",      "WR3: interrupt and match control",                   "wr3"),
    keyword("wr4",      "WR4: operating mode and port B address",             "wr4 ${1|byte,continuous,burst|}, ${2:portBAddr}"),
    keyword("wr5",      "WR5: auto-restart flag",                             "wr5"),
    keyword("readmask", "WR6: set read mask (1 follow byte)",                 "readmask ${1:mask}"),
    keyword("cmd",      "WR6: raw command byte (escape hatch)",               "cmd ${1:value}"),
  ],
  "wr0-direction":   [keyword("a_to_b", "Transfer from port A to port B"), keyword("b_to_a", "Transfer from port B to port A")],
  "wr0-transfer":    [keyword("transfer", "Byte transfer mode"), keyword("search", "Search mode"), keyword("search_transfer", "Search and transfer mode")],
  "wr0-portaaddr":   [],  // expression: no keyword suggestions
  "wr0-blocklen":    [],  // expression
  porttype:          [keyword("memory", "Port is a memory address"), keyword("io", "Port is an I/O port address")],
  addrmode:          [keyword("increment", "Increment address after each transfer"), keyword("decrement", "Decrement address after each transfer"), keyword("fixed", "Keep address fixed (I/O)")],
  cyclelen:          [keyword("2t", "2 T-state cycle"), keyword("3t", "3 T-state cycle"), keyword("4t", "4 T-state cycle")],
  prescaler:         [],  // numeric expression
  "wr4-mode":        [keyword("byte", "Single-byte transfer per request"), keyword("continuous", "Continuous burst to end of block"), keyword("burst", "Burst mode (hold /BUSREQ)")],
  "wr4-portbaddr":   [],  // expression
  "wr3-flags":       [keyword("dma_enable", "Enable DMA immediately (D6)"), keyword("stop_on_match", "Stop on pattern match (D2)"), keyword("int_enable", "Enable interrupt on completion (D5)")],
  "wr5-flags":       [keyword("auto_restart", "Reload and restart on block completion (D5)")],
};

function getDmaCompletionItems(ctx: DmaCompletionContext): CompletionResult[] {
  return DMA_ITEMS[ctx.phase] ?? [];
}

function keyword(label: string, detail: string, insertText?: string): CompletionResult {
  return {
    label,
    kind: /* CompletionItemKind.Keyword */ 14,
    detail,
    insertText: insertText ?? label,
    isSnippet: !!insertText?.includes("$")
  };
}
```

**Test:**

```ts
describe("getDmaCompletionItems", () => {
  it("returns 13 sub-commands for subcommand phase", () => {
    const items = getDmaCompletionItems({ phase: "subcommand" });
    expect(items.length).toBe(13);
    expect(items.map((i) => i.label)).toContain("wr0");
    expect(items.map((i) => i.label)).toContain("reset");
  });
  it("returns direction keywords for wr0-direction phase", () => {
    const items = getDmaCompletionItems({ phase: "wr0-direction" });
    expect(items.map((i) => i.label)).toEqual(["a_to_b", "b_to_a"]);
  });
  it("returns port type keywords for porttype phase", () => {
    const items = getDmaCompletionItems({ phase: "porttype" });
    expect(items.map((i) => i.label)).toContain("memory");
    expect(items.map((i) => i.label)).toContain("io");
  });
  it("returns empty for expression positions", () => {
    expect(getDmaCompletionItems({ phase: "wr0-portaaddr" })).toEqual([]);
  });
});
```

---

### Step AC-4: Wire line content into the Monaco completion provider

**File:** `src/renderer/appIde/services/z80-providers.ts`

Update the `provideCompletionItems` callback to pass the current line text:

```ts
provideCompletionItems(model: any, position: any, context: any) {
  const word = model.getWordAtPosition(position);
  const prefix = word ? word.word : "";
  const lineContent: string = model.getLineContent(position.lineNumber) ?? "";  // ← new
  const items = computeCompletionItems(prefix, context.triggerCharacter, getService(), lineContent); // ← pass it
  // ... rest unchanged
```

**Test:** This step involves the Monaco bridge, which is hard to unit test directly. Verify at the integration level by opening a `.kz80.asm` file, typing `.dma `, and confirming the completion list shows `reset`, `wr0`, etc. A minimal integration test can be written using the Monaco API in a test environment if one exists; otherwise this step is verified manually.

---

### Phase 2B Test File

**File:** `test/z80-assembler/dma-providers.test.ts` (new)

Collects all the unit tests from steps AC-1 to AC-3 into one file. No Monaco runtime needed — tests call `getDmaCompletionContext`, `getDmaCompletionItems`, and `computeCompletionItems` directly with a mock `ILanguageIntelService`.

---

### Phase 2A Test File

**File:** `test/z80-assembler/dma-highlight.test.ts` (new)

Imports `asmKz80LanguageProvider` and asserts the structure of the language definition object (word list contents, tokenizer state existence, regex-vs-sample-word checks). No browser or Monaco runtime needed since the definition is a plain JavaScript object.

---

## Phase 3 (Future)

- **`set` shorthand sub-command:** Composite syntax that emits a complete DMA program from named key-value pairs
- **Hover documentation:** When hovering over `.dma` sub-commands/parameters, show register group description and byte encoding
- **IDE warnings:** Detect missing `load`/`enable` after configuration, warn about unused WR groups, suggest `reset` at start
