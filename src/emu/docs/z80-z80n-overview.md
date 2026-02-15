# The Z80 and Z80N: Processor Overview

To build a ZX Spectrum Next emulator, you need to understand the processor at its heart. This chapter covers the Zilog Z80 architecture and the Z80N extensions specific to the Next - not as a complete tutorial, but as a focused overview of what matters for emulation. We'll look at registers, addressing modes, instruction categories, and the new Z80N opcodes that make the Next more than just a faster Spectrum.

## The Z80: A 1976 Design That Refused to Die

The Zilog Z80 debuted in 1976 as an enhanced, binary-compatible version of Intel's 8080. While Intel moved on to the 8086 and beyond, the Z80 found a home in everything from arcade games to home computers to industrial controllers. By the time the ZX Spectrum shipped in 1982, the Z80 was already considered mature - yet here we are in the 2020s, still building machines around this architecture.

Why? Because the Z80 hit a sweet spot: **powerful enough to be useful, simple enough to understand completely**. You can hold the entire instruction set in your head (well, most of it). The architecture makes sense. There are no hidden microcode layers, no speculative execution, no cache coherency protocols. What you see is what you get, and what you get is enough to build surprisingly sophisticated software.

The Z80N in the ZX Spectrum Next is a cycle-accurate recreation implemented in FPGA, with carefully chosen extensions that add modern conveniences without breaking the fundamental character of the original design. It's still recognizably a Z80, just with some quality-of-life improvements that would have been impossible in 1976.

## Core Architecture: What Makes a Z80 a Z80

Before diving into instructions, you need to understand what you're working with: the Z80's internal architecture. Registers, flags, and addressing modes form the foundation everything else builds on.

### The Register Set: More Than It Looks

The Z80 has an unusual register architecture: it appears to have only seven 8-bit registers (A, B, C, D, E, H, L) plus the accumulator... but these are actually **two complete sets** that you can swap with a single instruction (`EX AF,AF'` or `EXX`). This gives you:

**Main register set:**
- `A` (accumulator): Primary register for arithmetic, logic, and I/O
- `F` (flags): Status bits (zero, carry, sign, etc.) - not directly accessible
- `BC`, `DE`, `HL`: Three 16-bit register pairs (can be used as 8-bit or 16-bit)
  - `HL` is special - most operations treat it as "the" pointer register

**Alternate register set:**
- `A'`, `F'`: Alternate accumulator and flags
- `BC'`, `DE'`, `HL'`: Alternate versions of the register pairs

**Why the duplicates?** Fast context switching. Writing interrupt handlers? Swap to the alternate set with `EX AF,AF'` and `EXX`, do your work, swap back. No pushing/popping dozens of bytes on the stack. It's beautifully efficient when you need it, but many programs never touch the alternate set.

**Special purpose registers:**
- `IX`, `IY`: 16-bit index registers for displacement addressing
- `SP`: Stack pointer (grows downward from high memory)
- `PC`: Program counter (where execution currently is)
- `I`: Interrupt vector register (high byte for IM2 mode)
- `R`: Memory refresh counter (increments each instruction, used for DRAM refresh)

### The Flags: How the CPU Remembers What Just Happened

The F register contains status flags that reflect the result of the last operation:

- **Z (Zero)**: Set if result was zero
- **C (Carry)**: Set if arithmetic generated a carry or borrow
- **S (Sign)**: Reflects bit 7 of result (negative if set, treating values as signed)
- **P/V (Parity/Overflow)**: Means parity for logical ops, overflow for arithmetic
- **N (Add/Subtract)**: Set if last operation was a subtraction (used by `DAA`)
- **H (Half-carry)**: Carry from bit 3 to bit 4 (also used by `DAA` for BCD math)

> **BCD (Binary Coded Decimal)**: A numbering system where each byte represents two decimal digits (0-99), with 0x00-0x09 valid in each nibble. The `DAA` instruction converts after addition/subtraction to maintain BCD format. Used in calculators and financial software where decimal precision matters more than speed.

Conditional jumps and calls test these flags: `JP Z,label`, `CALL NC,subroutine`, etc. The flags update automatically after most arithmetic and logical operations, but not after loads or bit operations.

### Memory Addressing: 16 Bits of Reach

The Z80 has a 16-bit address bus, giving it a 64KB address space (0x0000 to 0xFFFF). That's it - no banking, no segments, no MMU from the CPU's perspective. When later systems needed more memory (like the Spectrum 128K or Next's 2MB), they added external hardware to page different memory banks into the Z80's view.

**Addressing modes** determine how the CPU interprets operands:

**Immediate**: Value is part of the instruction
```asm
LD A,42        ; Load literal 42 into A
```

**Register direct**: Value comes from a register
```asm
LD A,B         ; Copy B into A
```

**Register indirect**: Register contains an address to read from
```asm
LD A,(HL)      ; Load from memory address in HL
```

**Indexed with displacement**: Base address + signed offset
```asm
LD A,(IX+5)    ; Load from address in IX plus 5
```

**Extended (absolute)**: 16-bit address in the instruction
```asm
LD A,(0x4000)  ; Load from address 0x4000
```

The choice of addressing mode affects both **speed** (immediate is fast, indexed is slow) and **code size** (direct is compact, extended needs 2 extra bytes).

## Instruction Categories: What Can This Thing Do?

The Z80 instruction set divides roughly into categories by function. Understanding these categories helps you pick the right tool for each job - and spot when you're using an expensive instruction where a cheap one would work.

### Data Movement: Getting Bytes Where They Need to Be

The Z80 has a powerful `LD` (load) instruction with dozens of variants:

```asm
LD A,42         ; Immediate to register (7 cycles)
LD A,B          ; Register to register (4 cycles)
LD A,(HL)       ; Memory to register (7 cycles)
LD (HL),A       ; Register to memory (7 cycles)
LD HL,0x4000    ; 16-bit immediate to register pair (10 cycles)
LD A,(0x5C00)   ; Memory to A using absolute address (13 cycles)
```

There's also `LDI` and `LDIR` for block moves - `LDIR` copies `BC` bytes from `HL` to `DE` automatically. One instruction, hundreds of bytes moved. Perfect for copying graphics data or clearing memory.

### Arithmetic and Logic: Making Numbers Dance

The Z80 provides comprehensive arithmetic and logical operations, with separate instruction sets for 8-bit and 16-bit values. Most operations automatically update flags, making conditional execution straightforward.

**8-bit arithmetic:**
```asm
ADD A,B         ; A = A + B (sets flags)
ADC A,C         ; A = A + C + carry flag (for multi-byte math)
SUB D           ; A = A - D
SBC A,E         ; A = A - E - carry flag
INC A           ; A = A + 1 (doesn't affect carry!)
DEC B           ; B = B - 1
```

**16-bit arithmetic:**
```asm
ADD HL,BC       ; HL = HL + BC (16-bit addition)
ADC HL,DE       ; HL = HL + DE + carry (for 32-bit math)
SBC HL,BC       ; HL = HL - BC - carry
INC HL          ; HL = HL + 1 (doesn't affect flags)
```

**Logical operations:**
```asm
AND B           ; A = A & B (bitwise AND)
OR C            ; A = A | C (bitwise OR)
XOR D           ; A = A ^ D (bitwise XOR)
CP E            ; Compare A with E (A - E, update flags, discard result)
```

The `CP` instruction is clever - it performs subtraction just to set flags, then throws away the result. Perfect for testing values without destroying them.

### Bit Operations: Twiddling Individual Bits

The Z80 has dedicated bit manipulation instructions:

```asm
BIT 3,A         ; Test if bit 3 of A is set (updates Z flag)
SET 5,B         ; Set bit 5 of B to 1
RES 2,C         ; Reset bit 2 of C to 0
```

These are **slow** when operating on memory via `(HL)` or indexed - they take 15+ cycles. But for register operations, they're clean and readable.

**Rotate and shift:**
```asm
RLA             ; Rotate A left through carry
RRA             ; Rotate A right through carry
RLC A           ; Rotate A left (bit 7 -> bit 0, also -> carry)
SLA B           ; Shift B left (bit 7 -> carry, 0 -> bit 0)
SRL C           ; Shift C right logical (0 -> bit 7, bit 0 -> carry)
SRA D           ; Shift D right arithmetic (bit 7 preserved, bit 0 -> carry)
```

### Control Flow: Making Decisions and Loops

Programs need to make decisions and repeat operations. The Z80 provides jumps, calls, and returns in both conditional and unconditional forms, plus specialized loop instructions.

**Unconditional jumps:**
```asm
JP 0x4000       ; Jump to absolute address
JR label        ; Jump relative (-126 to +129 bytes, smaller/faster)
JP (HL)         ; Jump to address in HL (not a memory read!)
```

**Conditional jumps:**
```asm
JP Z,label      ; Jump if Zero flag set
JP NZ,label     ; Jump if Zero flag clear
JP C,label      ; Jump if Carry flag set
JR NC,label     ; Relative jump if No Carry
```

**Subroutines:**
```asm
CALL subroutine ; Push PC to stack, jump to address
RET             ; Pop return address from stack, jump there
RET Z           ; Return if Zero flag set
```

The `JR` (jump relative) instructions are faster and smaller than `JP` when the target is nearby. They use a signed 8-bit offset, so they can reach -126 to +129 bytes from the current position.

**Loops using DJNZ:**
```asm
    LD B,10         ; Loop counter
loop:
    ; ... do something 10 times ...
    DJNZ loop       ; Decrement B, jump if not zero
```

`DJNZ` (Decrement and Jump if Not Zero) is a single instruction that decrements B and jumps if the result isn't zero. Compact loop construct that costs just 13 cycles when it branches.

### Stack Operations: Last In, First Out

The stack starts at high memory and grows downward. The stack pointer (`SP`) points to the last pushed value.

```asm
PUSH BC         ; SP -= 2, write BC to stack
POP DE          ; Read from stack into DE, SP += 2
PUSH AF         ; Save accumulator and flags
```

The stack is crucial for:
- **Subroutine calls**: `CALL` pushes the return address, `RET` pops it
- **Interrupts**: Hardware automatically pushes `PC` when an interrupt fires
- **Temporary storage**: Need an extra register? Push one to the stack

But stack operations are slow (memory accesses), so don't use PUSH/POP for quick register swaps - that's what `EX` and `EXX` are for.

### Block Operations: When You Need to Move Data in Bulk

The Z80 has powerful block instructions that operate on entire memory regions:

```asm
LDI             ; (DE) = (HL), increment HL and DE, decrement BC
LDIR            ; Repeat LDI until BC = 0 (auto-loop)
CPI             ; Compare A with (HL), increment HL, decrement BC
CPIR            ; Repeat CPI until BC = 0 or A = (HL)
```

**Example: Clear 256 bytes of screen memory**
```asm
    LD HL,0x4000    ; Source (will be incremented)
    LD DE,0x4001    ; Destination (one byte higher)
    LD BC,255       ; Count (256 - 1, we handle first byte separately)
    LD (HL),0       ; Clear first byte
    LDIR            ; Fill rest with zeros (copies 0x4000 to 0x4001, then 0x4001 to 0x4002, etc.)
```

This trick uses `LDIR` to propagate a single zero byte across memory. Classic Z80 optimization.

## Z80N Extensions: What the Next Adds

The Z80N extends the original instruction set with new opcodes that live in previously undefined instruction space. All original Z80 software runs unchanged - the new instructions use opcodes the original Z80 would execute as `NOP` or invalid.

### Motivation: Why Add Instructions at All?

The Z80 instruction set has gaps - operations that require awkward multi-instruction sequences. The Z80N additions focus on:

1. **Register operations** that save cycles in common patterns
2. **Stack manipulation** for cleaner function prologues/epilogues  
3. **Bit manipulation** that's faster and more flexible
4. **Memory access** with new addressing modes
5. **Hardware access** specific to Next features

### New Load Instructions

**LD (nn),BC / LD (nn),DE / LD (nn),HL**

The original Z80 can load register pairs from memory but not store them directly:
```asm
; Original Z80 - storing BC to memory requires two instructions:
LD (addr),C
LD (addr+1),B

; Z80N - single instruction:
LD (addr),BC
```

**LD BC/DE/HL,(nn)**

Similarly, loading 16-bit values is now symmetric:
```asm
; Z80N - load BC from memory:
LD BC,(0x5C78)
```

These save cycles and code space in common operations like saving/restoring pointers.

### Push Immediate Values

**PUSH nn**

The original Z80 can't push immediate values to the stack:
```asm
; Original Z80:
LD HL,0x1234
PUSH HL

; Z80N:
PUSH 0x1234     ; Directly push 16-bit value
```

Saves 2 bytes and multiple cycles when setting up stack frames or passing constant parameters.

### Extended Register Operations

**NEXTREG reg,value**

This is Z80N's killer feature for Next-specific hardware: write to NextReg registers without going through ports:

```asm
; Original Z80 method:
LD BC,0x243B    ; NextReg select port
LD A,21         ; Register number
OUT (C),A
LD BC,0x253B    ; NextReg data port
LD A,128        ; Value to write
OUT (C),A

; Z80N method:
NEXTREG 21,128  ; Single instruction, 2 bytes shorter, faster
```

NextReg registers control Next-specific features: layer priorities, palettes, memory mapping, sprites, copper, DMA, etc. The `NEXTREG` instruction makes accessing these dramatically more efficient.

**NEXTREG reg,A**

Variant that writes the accumulator's value:
```asm
LD A,(palette_value)
NEXTREG 0x41,A      ; Write A to palette register
```

### Test and Set: Atomic Bit Operations

**TEST n**

Test immediate value against accumulator (like `CP` but with `AND` semantics):
```asm
TEST 0x80       ; Test if bit 7 of A is set
JP NZ,bit_set   ; Jump if it was
```

Equivalent to `AND 0x80` but doesn't destroy A's value.

### Mirror Operations

**MIRROR A**

Reverses the bit order of the accumulator:
```asm
LD A,0b10110001    ; Binary 177
MIRROR A           ; A = 0b10001101 (bits reversed)
```

Why? Bitmap graphics use little-endian bit order (bit 0 = leftmost pixel), but sometimes you need to flip horizontally. `MIRROR` does this in a single instruction instead of 8 shifts and masks.

### Multiply Operations

**MUL / MUL D,E**

The original Z80 has no multiply instruction - you write a loop:
```asm
; Original Z80 - multiply D by E, result in HL:
LD HL,0
LD B,8
loop:
    ADD HL,HL
    SLA E
    JR NC,skip
    ADD HL,DE
skip:
    DJNZ loop

; Z80N:
MUL D,E         ; HL = D * E (unsigned 8x8 = 16-bit result)
```

This is **dramatically** faster - the multiply completes in about 128 cycles versus 100+ for the loop version, but saves massive code space and programming complexity.

**Note**: The multiply is unsigned. For signed multiplication, you need to handle signs separately and negate the result if needed.

### Extended Addressing Modes

**ADD/ADC/SUB/SBC HL,value**

Immediate arithmetic on 16-bit register pairs:
```asm
; Original Z80:
LD BC,1000
ADD HL,BC

; Z80N:
ADD HL,1000     ; Directly add immediate value
```

**ADD/ADC/SUB/SBC A,value**

Wait, doesn't the Z80 already have this? Yes - but Z80N adds missing modes:
```asm
ADD A,(HL)      ; Add memory via HL (original Z80 has this)
ADD A,(IX+d)    ; Add memory via IX+offset (Z80N adds this)
```

Fills in gaps in the addressing mode matrix.

### Stack Frame Operations

**LDPIRX**

Complex instruction designed for stack frame manipulation in high-level languages. It combines multiple operations:

```asm
LDPIRX          ; DE = (HL), HL += 2, BC -= 2, repeat until BC = 0
```

Used in CP/M BDOS emulation and some compiler-generated code. Specialized, but useful when you need it.

### Swap Operations

**SWAPNIB**

Swaps the high and low nibbles of the accumulator:
```asm
LD A,0x3F
SWAPNIB         ; A = 0xF3
```

Useful for BCD operations, palette color manipulation, and bit-packed data structures.

**PIXELDN / PIXELAD**

These are Next-specific operations for navigating screen memory:

```asm
PIXELDN         ; Move HL down one pixel row in screen memory
PIXELAD         ; Move HL down one attribute row in screen memory
```

Screen memory on the Spectrum is **not** linear - it's divided into three 2KB thirds, each containing 64 character rows. Navigating vertically requires awkward arithmetic:

```asm
; Original Z80 - move down one pixel in screen memory:
INC H           ; Move to next row in same third
LD A,H
AND 0x07
JR NZ,done      ; Still in same character row
LD A,L
ADD A,0x20
LD L,A
LD A,H
ADC A,0x00
LD H,A
done:

; Z80N:
PIXELDN         ; Single instruction
```

### Barrel Shift Operations

**SETAE**

Sets the accumulator from flags in a specific pattern:
```asm
SETAE           ; A = carry flag (extended to 8 bits: 0xFF if C=1, 0x00 if C=0)
```

Useful for branchless code and bit manipulation.

## Practical Considerations: Writing Z80N Code

Understanding instructions is one thing; using them effectively is another. Here's practical guidance for writing Z80N code that's fast, compatible, and maintainable.

### When to Use Z80N Instructions

**Use them when:**
- You're writing Next-specific code that won't run on original hardware
- The speed improvement matters (multiply, NextReg access)
- Code clarity improves significantly (PIXELDN vs. manual screen navigation)

**Avoid them when:**
- You need compatibility with original Spectrum
- You're writing library code that should be portable
- The benefit is marginal (one instruction vs. two with no speed gain)

### Cycle Timing Matters

The Z80 runs at 3.5 MHz on original Spectrum, 3.5/7/14/28 MHz on Next. Every instruction has a fixed cycle count:

```asm
LD A,B          ;  4 cycles
LD A,(HL)       ;  7 cycles
LD A,(IX+5)     ; 19 cycles (slow!)
```

**Contended memory** adds wait states when accessing screen memory (0x4000-0x7FFF) during active display. At 3.5 MHz, this can add 0-6 cycles per memory access depending on timing. Avoid the contended region in tight loops, or use uncontended memory (0xC000+) for critical data.

### Register Allocation Strategy

The Z80 has limited registers, so choose wisely:

- **A**: Your workhorse accumulator; all arithmetic starts here
- **HL**: Primary pointer; most instructions favor HL over DE/BC
- **BC**: Loop counters, secondary pointer, port addresses
- **DE**: Data pointer, rarely as versatile as HL
- **IX/IY**: Fixed base addresses with offsets (but slow - add 4-8 cycles vs. HL)

**Alternate registers** (via `EXX`): Great for interrupt handlers and preserving state, but creates "invisible" dependencies that make debugging harder. Use sparingly in application code.

## Summary: Z80 and Z80N in the Next

The Z80 brought 8-bit computing to millions in the late 1970s and 1980s. Its instruction set is powerful enough for sophisticated software, yet simple enough to understand without years of study. The architecture's limitations (64KB address space, limited registers) forced programmers to think carefully about resource usage - constraints that made better programmers.

The Z80N extensions respect this legacy. They don't fundamentally change the architecture - you're still writing Z80 assembly,just with better tools for common operations. The original Z80 mindset still applies: every byte matters, every cycle counts, clever tricks beat brute force.

For emulator builders, this means:
- Implement the original Z80 instruction set completely and accurately
- Add Z80N extensions as a separate layer that can be toggled
- Track cycle counts precisely (they matter for timing-sensitive code)
- Handle contended memory correctly (or document that you don't)
- Remember that real programmers are incredibly clever - anything your emulator gets wrong, someone will notice

The Z80 and Z80N aren't just historical curiosities. They're living architectures with active communities writing new software today. Understanding them means understanding a design philosophy: **make the simple stuff simple, make the complex stuff possible, and trust programmers to know the difference**.

---

*For deeper dives into specific instruction categories, see the detailed chapters on arithmetic operations, memory management, and timing-critical code. For Z80N-specific emulation notes, see the Next extensions chapter.*
