# The zxnDMA: Moving Data Without the CPU

Somewhere around the third time you write a `LDIR` loop to fill screen memory, you start wondering: isn't there a better way? The Z80's block transfer instructions are fine for small jobs, but when you need to move kilobytes of data at full speed — loading sprite patterns, filling Layer 2 banks, streaming audio samples — those 21 T-states per byte add up fast. At 3.5 MHz, copying a single 16KB memory bank with `LDIR` takes over 96 milliseconds. That's nearly six frames of dead CPU time.

The ZX Spectrum Next has a built-in DMA controller that solves this problem. The **zxnDMA** — loosely based on the Zilog Z80 DMA chip but simplified and extended for the Next — can transfer data between any combination of memory and I/O ports, completely independently of the CPU. While the DMA moves your data, the CPU is free to do something useful. Or nothing at all, if the transfer is fast enough that you don't notice.

This chapter teaches you how to program the zxnDMA from the ground up. We'll start with the concepts, work through the register structure, build up to practical transfer sequences, and finish with real-world patterns for sprite loading, memory filling, and audio streaming. By the end, you'll be able to set up a DMA transfer as naturally as you'd write a `LDIR` — and you'll never want to go back.

## What the DMA Actually Does

At its core, the DMA controller is a state machine that reads a byte from one place and writes it to another, over and over, until it's done. "One place" and "another place" can each be a memory address or an I/O port. The DMA has its own address bus and data bus connections — when it's active, the CPU steps aside (releases the bus) and the DMA takes over, reading and writing at hardware speed.

The process follows a simple cycle for each byte:

1. **Read** from the source (memory or I/O port)
2. **Write** to the destination (memory or I/O port)
3. **Update** source and destination addresses (increment, decrement, or keep fixed)
4. **Count** the byte and check if the transfer is complete

The DMA repeats this cycle for every byte in the block. A memory-to-memory transfer of 256 bytes takes roughly 256 × 6 T-states = 1,536 T-states at 3.5 MHz — about 440 microseconds. Compare that to `LDIR`'s 256 × 21 = 5,376 T-states. The DMA is roughly 3.5× faster for pure block copies, and the CPU is completely free during the transfer.

### Two Ports, Two Personalities

The DMA controller is accessed through two I/O ports, and which port you use determines its operating mode:

| Port | Mode | Block Length Behavior |
|------|------|----------------------|
| `0x6B` | **zxnDMA** (Next-specific) | Transfers exactly N bytes |
| `0x0B` | **Z80 DMA** (legacy Zilog compatible) | Transfers N + 1 bytes |

The difference is subtle but important. In legacy Z80 DMA mode, the byte counter starts at `0xFFFF` (effectively −1) and counts up, so a block length of 0 transfers 1 byte, a block length of 1 transfers 2 bytes, and so on. In zxnDMA mode, the counter starts at 0 and a block length of N transfers exactly N bytes — which is what you'd expect. Unless you're porting code from a system with a real Z80 DMA chip, always use port `0x6B`.

> Once you write to one port, the DMA "remembers" that mode until you write to the other port (which switches modes) or issue a hardware reset. In practice, most Next programs use `0x6B` exclusively and never think about it again.

### The Port A / Port B Model

The DMA uses an unusual naming convention inherited from the Zilog Z80 DMA. Instead of "source" and "destination," it has **Port A** and **Port B**. Each port can be configured independently as either a memory address or an I/O port, and can use different addressing modes (increment, decrement, or fixed).

A direction bit in the configuration determines which way data flows:

- **A → B**: Port A is the source, Port B is the destination
- **B → A**: Port B is the source, Port A is the destination

This flexibility means you can set up Port A as a memory pointer (incrementing through a buffer) and Port B as a fixed I/O address (always pointing at the same hardware register), then trigger a transfer that streams your buffer out to hardware. Or you can point both at memory addresses for a straightforward block copy.

The separation of "port identity" from "transfer direction" is a Zilog design choice rooted in the Z80 DMA's history as a multi-purpose peripheral. It feels a little over-engineered for most Next use cases, but once you internalize the mental model, the programming sequence flows naturally.

## Three Ways to Write a DMA Program

All DMA configuration amounts to bytes arriving at the DMA port. The hardware doesn't care how those bytes were produced — from individual `OUT (C), A` instructions, from an `OTIR` loop reading a byte table, or from a Klive assembler `.dma` pragma. All three approaches produce identical binary output. What changes is readability, maintainability, and which assembler you're using.

### Style 1: Direct OUT Instructions

The most explicit approach writes each configuration byte with a `LD A, value : OUT (C), A` pair. The register-documentation sections later in this chapter use this style because it maps one-to-one onto the bit-field diagrams:

```z80klive
    ld bc, $6B
    ld a, $C3               ; WR6: Reset
    out (c), a
    ld a, $7D               ; WR0: A→B, transfer, all follow-bytes set
    out (c), a
    ld a, $00               ; Port A low byte (0x8000)
    out (c), a
    ; ...
```

**When to use it:** Fully runtime-dynamic values — addresses in registers, lengths computed on the fly. Every byte can be a live register value; each `OUT` carries whatever `A` happens to hold.

**Constraints:** Verbose — a complete sequence is 15–20 paired `LD / OUT` instructions. The raw hex values (`$7D`, `$2D`, `$28`…) carry no self-documentation; you need the register bit-field diagrams beside you to read the code.

### Style 2: The OTIR Table Pattern

Store the entire DMA program as a contiguous byte table in RAM. Label any fields that need runtime patching, patch those fields before the upload, then stream the whole table to the DMA port with a single `OTIR`:

```z80klive
    ; Patch the two dynamic fields
    ld (dmaSrc), hl             ; source address (computed at runtime)
    ld (dmaLen), bc             ; byte count     (computed at runtime)

    ; Upload — five instructions, regardless of program length
    ld hl, dmaProgram
    ld b,  dmaProgram_end - dmaProgram
    ld c,  $6B
    otir
    ret

dmaProgram:
    .db $C3                     ; WR6: Reset
    .db $7D                     ; WR0: all params, A→B, transfer
dmaSrc:
    .dw 0                       ; Port A address — patched at runtime
dmaLen:
    .dw 0                       ; Block length   — patched at runtime
    .db $14                     ; WR1: memory, increment
    .db $10                     ; WR2: memory, increment
    .db $2D                     ; WR4: continuous, Port B address follows
    .dw $C000                   ; Port B address — constant
    .db $CF                     ; WR6: Load
    .db $87                     ; WR6: Enable
dmaProgram_end:
```

**When to use it:** Semi-static programs where most configuration is fixed at assembly time and only a small number of fields (typically source address and block length) need runtime patching. This pattern is widely used in community examples and references for the ZX Spectrum Next.

**Constraints:** The table must live in **RAM**, not ROM — `LD (label), HL` patching requires writable memory. The raw hex bytes in the table body are just as opaque as Style 1: `$7D` still doesn't tell you it means "A→B, transfer, all follow-bytes set."

**A note on OTIR and the port address:** `OTIR` outputs to port `(C)` and decrements `B` after each byte, so by the time the last byte is sent, `B` has counted down to zero. Because the Z80's `OUT (C), A` instruction puts the full 16-bit `BC` register on the address bus, the upper byte of the port address changes with every iteration. This sounds alarming, but it is harmless here: the zxnDMA port decoder looks only at the lower 8 bits of the address bus (`$6B`), and ignores the upper 8 bits entirely. Every byte in the table therefore lands at the correct port regardless of what `B` holds at that moment.

**Compatibility:** Works with any Z80 assembler — sjasmplus, Pasmo, or any other tool that supports `DB`/`DW` directives. No assembler extensions required.

### Style 3: The `.dma` Pragma (Klive Assembler)

The Klive Z80 Assembler's `.dma` pragma emits exactly the same byte sequences as a hand-crafted `DB`/`DW` table, but replaces raw hex encodings with named sub-commands and parameter keywords:

```z80klive
dmaProgram:
    .dma reset
    .dma wr0 a_to_b, transfer       ; base byte only — address and length follow
dmaSrc:
    .dw 0                           ; Port A address — patched at runtime
dmaLen:
    .dw 0                           ; Block length   — patched at runtime
    .dma wr1 memory, increment
    .dma wr2 memory, increment
    .dma wr4 continuous             ; base byte only — Port B address follows
    .dw $C000                       ; Port B address — constant
    .dma wr5
    .dma load
    .dma enable
dmaProgram_end:
```

The upload is identical to Style 2 — a five-instruction `OTIR` sequence:

```z80klive
    ld (dmaSrc), hl
    ld (dmaLen), bc
    ld hl, dmaProgram
    ld b,  dmaProgram_end - dmaProgram
    ld c,  $6B
    otir
```

**When to use it:** Any time you're using the Klive assembler and want readable, self-documenting DMA code — which is almost always. The emitted bytes are bit-for-bit identical to the hand-crafted `DB` table, so there is zero runtime overhead.

**Constraints:**
- **Klive assembler only.** Not compatible with sjasmplus, Pasmo, or other tools.
- **Compile-time constants only.** Sub-command parameters (e.g. `wr0 a_to_b, transfer, $8000, 256`) must be resolvable at assembly time. For runtime addresses, omit the optional parameter and patch a `.dw 0` label as shown above.
- **Follow-byte indicator bits are always set.** `WR0` and `WR4` base bytes always have all address/length follow-byte indicator bits set regardless of whether you supply the optional parameters. This is correct — it means the `.dw` patch labels that follow are consumed as the expected follow bytes.

### Which Style This Chapter Uses

The register-documentation sections (WR0 through WR6) use **Style 1** — direct `OUT` instructions — because the byte-at-a-time structure maps naturally onto the bit-field diagrams.

All practical patterns and complete examples use **Style 3** — the `.dma` pragma combined with the OTIR upload sequence. The labels over `.dw 0` patch points are self-documenting, and the pragma sub-command names make register configuration immediately readable.

If you're working with a different assembler, translate any `.dma` pragma block to an equivalent `DB`/`DW` table and upload with `OTIR` — the byte sequences are identical.

## Programming the DMA: Register Groups

All DMA configuration happens by writing sequences of bytes to either port `0x6B` or `0x0B`. There's no separate register select mechanism — the DMA determines which register you're programming based on bit patterns in the first byte (the "base byte") of each write sequence.

The DMA has seven register groups, WR0 through WR6:

| Register | Purpose | Key Configurations |
|----------|---------|-------------------|
| **WR0** | Transfer direction, Port A address, block length | Direction (A→B or B→A), source address, transfer size |
| **WR1** | Port A configuration | Memory vs I/O, address mode, timing |
| **WR2** | Port B configuration | Memory vs I/O, address mode, timing, prescaler |
| **WR3** | Interrupt and match control | Enable/disable, mask and match bytes |
| **WR4** | Operating mode, Port B address | Continuous/Burst mode, destination address |
| **WR5** | Control flags | Auto-restart, CE/WAIT behavior |
| **WR6** | Commands | Reset, Load, Enable, Disable, Read Status |

### How the Base Byte Dispatch Works

Each register group has a unique bit pattern in its base byte that the DMA uses for identification. The detection follows a priority order — the first match wins:

```
D7=0, D2:D0 = 000  → WR2  (Port B configuration)
D7=0, D2:D0 = 100  → WR1  (Port A configuration)
D7=0                → WR0  (catch-all for D7=0: direction, addresses, block length)
D7=1, D1:D0 = 00   → WR3  (Interrupt/match control)
D7=1, D1:D0 = 01   → WR4  (Operating mode, Port B address)
D7:D6=10, D2:D0=010 → WR5 (Control flags)
else                → WR6  (Commands)
```

This means you can't just write arbitrary bytes — each configuration byte must have the correct bit pattern for the register you're targeting. The diagrams in the next sections show the exact encoding for each register.

### Follow Bytes

Most register groups use a "follow byte" mechanism: control bits in the base byte indicate whether additional parameter bytes will follow. For example, WR0's base byte has bits that say "Port A address low byte follows," "Port A address high byte follows," "block length low byte follows," and "block length high byte follows." The DMA expects those follow bytes in order, immediately after the base byte.

This means a WR0 write with all parameters is five bytes: the base byte plus four follow bytes (two for the address, two for the block length). If you only need to change the direction without updating addresses, you write just the base byte with the follow bits cleared — no extra bytes needed.

## WR0: Direction, Port A Address, and Block Length

WR0 configures the transfer direction, sets Port A's starting address, and specifies how many bytes to transfer. It's almost always the first register you program in a transfer sequence.

**Base byte format:**

```
Bit 7: 0 (identifies this as WR0/WR1/WR2 group)
Bit 6: 1 = block length high byte follows
Bit 5: 1 = block length low byte follows
Bit 4: 1 = Port A address high byte follows
Bit 3: 1 = Port A address low byte follows
Bit 2: Direction — 1 = A→B, 0 = B→A
Bit 1-0: Transfer type — 01 = Transfer, 10 = Search, 11 = Search+Transfer
```

When you want a standard memory-to-memory or memory-to-I/O transfer with all parameters, the base byte is `0x7D`:

- D6=1, D5=1 (block length follows, both bytes)
- D4=1, D3=1 (Port A address follows, both bytes)
- D2=1 (A→B direction)
- D1=0, D0=1 (Transfer mode)

**Follow bytes (when indicated by base byte bits):**

1. Port A address, low byte
2. Port A address, high byte
3. Block length, low byte
4. Block length, high byte

Here's a complete WR0 write that sets up a 256-byte transfer from address `0x8000`, direction A→B:

```z80klive
    ld bc, $6B          ; DMA port (zxnDMA mode)
    ld a, $7D           ; WR0: all params follow, A→B, Transfer mode
    out (c), a
    ld a, $00           ; Port A address low = 0x00
    out (c), a
    ld a, $80           ; Port A address high = 0x80
    out (c), a
    ld a, $00           ; Block length low = 0x00 (256 & 0xFF)
    out (c), a
    ld a, $01           ; Block length high = 0x01 (256 >> 8)
    out (c), a
```

> **Block length encoding**: The block length is a 16-bit value. A length of 256 is written as `0x0100` (low byte `0x00`, high byte `0x01`). In zxnDMA mode, this transfers exactly 256 bytes. Be careful not to confuse a block length of 0 with "nothing to transfer" — depending on the mode and DMA state, it can behave unexpectedly.

## WR1: Port A Configuration

WR1 tells the DMA how Port A behaves: whether it points to memory or an I/O port, and what happens to the address after each byte.

**Base byte format:**

```
Bit 7: 0
Bit 6: 1 = timing byte follows
Bit 5-4: Address mode — 00 = Decrement, 01 = Increment, 10/11 = Fixed
Bit 3: Port type — 1 = I/O port, 0 = Memory
Bit 2-0: 100 (WR1 identifier)
```

For a typical memory source with incrementing addresses, the base byte is `0x14`:

- D6=0 (no timing byte)
- D5:D4=01 (increment after each byte)
- D3=0 (memory, not I/O)
- D2:D0=100 (WR1 identifier)

```z80klive
    ld a, $14           ; WR1: memory, increment, no timing byte
    out (c), a
```

### Address Modes Explained

The address mode controls what happens to the port's address after each byte transfer:

| D5:D4 | Mode | Behavior |
|-------|------|----------|
| 00 | **Decrement** | Address decreases by 1 after each byte |
| 01 | **Increment** | Address increases by 1 after each byte |
| 10 | **Fixed** | Address stays the same for every byte |
| 11 | **Fixed** | Same as 10 — address doesn't change |

Increment mode is by far the most common — it's what you use for block copies, loading sprite data, filling memory. Fixed mode is essential when one end of the transfer is an I/O port: you want the port address to stay the same while the memory address walks through the buffer.

Decrement mode is useful for overlapping copies where the destination overlaps the source from below — the same reason you'd choose `LDDR` over `LDIR` in standard Z80 code.

### Timing Configuration

If bit 6 of the base byte is set, a timing byte follows:

```
Timing byte:
Bit 5: 1 = prescaler byte follows (WR2 only — ignored in WR1)
Bit 1-0: Cycle length — 00 = 4 T-states, 01 = 3 T-states, 10 = 2 T-states
```

Most transfers work fine with the default 3-T-state timing. You'd only change this for specialized scenarios like matching a peripheral's timing requirements.

## WR2: Port B Configuration

WR2 is the mirror of WR1 but for Port B, with one important addition: it can configure a **prescaler** for timed transfers (used primarily for audio streaming).

**Base byte format:**

```
Bit 7: 0
Bit 6: 1 = timing byte follows
Bit 5-4: Address mode — 00 = Decrement, 01 = Increment, 10/11 = Fixed
Bit 3: Port type — 1 = I/O port, 0 = Memory
Bit 2-0: 000 (WR2 identifier)
```

For a memory destination with incrementing addresses: `0x10` (same structure as WR1 but with `000` in D2:D0).

### The Prescaler

The prescaler is a ZXN DMA extension that doesn't exist in the original Zilog Z80 DMA. When configured, it inserts a precise delay between bytes, which lets you stream data at a controlled rate — perfect for digital audio playback.

To set a prescaler:
1. Set bit 6 in WR2's base byte (timing byte follows)
2. Write the timing byte with bit 5 set (prescaler follows)
3. Write the prescaler value

The delay formula is:

$$\text{T-states per byte} = \frac{\text{prescaler} \times 3{,}500{,}000}{875{,}000} = \text{prescaler} \times 4$$

So a prescaler value of 80 gives 320 T-states between transfers — about 91 microseconds at 3.5 MHz, which corresponds to a sample rate of roughly 10.9 kHz. A prescaler of 20 gives 80 T-states (approximately 43.75 kHz, close to CD quality at 44.1 kHz).

The internal FPGA implementation uses a 14-bit timer that counts at different rates depending on the CPU speed:

| CPU Speed | Timer Increment per Clock |
|-----------|--------------------------|
| 3.5 MHz | 8 |
| 7 MHz | 4 |
| 14 MHz | 2 |
| 28 MHz | 1 |

The DMA compares the prescaler value against `DMA_timer[13:5]` — the upper 9 bits of this 14-bit counter — to decide when the next byte can transfer. This scaling ensures the prescaler produces the same real-time delay regardless of the CPU speed setting.

```z80klive
    ; WR2 with prescaler for audio streaming
    ld a, $60           ; WR2: timing follows, increment, memory
    out (c), a
    ld a, $22           ; Timing: prescaler follows (D5=1), 2 T-state cycles (D1:D0=10)
    out (c), a
    ld a, 80            ; Prescaler value = 80 (→ 320 T-states between transfers)
    out (c), a
```

## WR3: Interrupt and Match Control

WR3 handles interrupt generation and search matching. The FPGA implementation comments out most of the search/match logic (it's not fully supported in hardware), but the basic enable and interrupt control bits work.

**Base byte format:**

```
Bit 7: 1
Bit 6: 1 = Enable DMA (via WR3 — older method, prefer WR6 command 0x87)
Bit 5: Interrupt enable
Bit 4: 1 = match byte follows
Bit 3: 1 = mask byte follows
Bit 2: Stop on match
Bit 1-0: 00 (WR3 identifier)
```

In practice, most programs control the DMA exclusively through WR6 commands and don't touch WR3 directly. The exception is when you need the search functionality (finding a specific byte value during a transfer) or when setting up interrupts.

### Search Mode

When WR0's transfer type is set to Search (D1=1) or Search+Transfer (D1=1, D0=1), the DMA compares each byte read against a match pattern with a mask:

```
Match condition: (readByte | MASK) == (MATCH | MASK)
```

Bits set to 1 in the mask are "don't care" — they're forced to 1 in both the read byte and the match byte before comparison. A mask of `0x00` requires an exact match; a mask of `0xFF` matches everything.

When a match is found:
- A status bit is set
- If interrupt-on-match is enabled, an interrupt fires
- If stop-on-match is set (WR5 D2), the transfer halts

In pure Search mode (WR0 D0=0), the DMA reads bytes and checks for matches without writing them anywhere. In Search+Transfer mode (D1=1, D0=1), it transfers the byte and checks for a match.

## WR4: Operating Mode and Port B Address

WR4 sets the transfer mode and provides Port B's starting address.

**Base byte format:**

```
Bit 7: 1
Bit 6-5: Operating mode — 00 = Byte, 01 = Continuous, 10 = Burst
Bit 4: 1 = interrupt control byte follows
Bit 3: 1 = Port B address high byte follows
Bit 2: 1 = Port B address low byte follows
Bit 1-0: 01 (WR4 identifier)
```

**Follow bytes:**

1. Port B address, low byte (if D2=1)
2. Port B address, high byte (if D3=1)
3. Interrupt control byte (if D4=1) — not implemented in the Next FPGA

### Operating Modes

The operating mode determines how the DMA interacts with the CPU bus:

**Continuous mode** (`D6:D5 = 01`): The DMA grabs the bus once and holds it until the entire block is transferred. This is the fastest mode — the CPU is completely halted for the duration. For a 256-byte memory-to-memory copy, that's about 1,536 T-states of CPU downtime. The advantage is that no bus arbitration overhead is wasted between bytes.

**Burst mode** (`D6:D5 = 10`): The DMA can release and re-request the bus between groups of bytes. When combined with the prescaler, burst mode allows the CPU to run between timed transfers — essential for audio playback where you need to stream bytes at a fixed rate while the CPU handles other tasks. In burst mode, the DMA releases the bus during prescaler wait periods, giving the CPU those cycles back.

**Byte mode** (`D6:D5 = 00`): Transfers one byte per bus grant. Not commonly used on the Next — continuous mode handles most needs, and burst mode with a prescaler handles the rest.

For most transfers, you'll use continuous mode. Audio streaming uses burst mode with a prescaler.

```z80klive
    ; WR4: Continuous mode, Port B address follows
    ld a, $2D           ; D6:D5=01 (continuous), D3=1 (addr hi), D2=1 (addr lo), D1:D0=01
    out (c), a
    ld a, $00           ; Port B address low
    out (c), a
    ld a, $C0           ; Port B address high (i.e., 0xC000)
    out (c), a
```

## WR5: Control Flags

WR5 is a simple single-byte register with control flags.

**Base byte format:**

```
Bit 7-6: 10
Bit 5: Auto-restart — 1 = reload addresses and restart on block completion
Bit 4: CE/WAIT multiplexed
Bit 3: Ready active high (not used on Next)
Bit 2-0: 010 (WR5 identifier)
```

### Auto-Restart

When auto-restart is enabled, the DMA automatically reloads Port A and Port B starting addresses and the block length counter when a transfer completes, then starts a new transfer immediately. This creates an endless loop of transfers — useful for repeated patterns or continuous streaming.

The FPGA implements auto-restart in the `FINISH_DMA` state: it copies the registered start addresses back into the working source and destination pointers, resets the byte counter, and jumps back to the start of the transfer sequence.

```z80klive
    ld a, $A2           ; WR5: auto-restart enabled (D5=1)
    out (c), a
```

## WR6: Command Register

WR6 is the command register — it doesn't configure anything persistently; instead, it triggers immediate actions. This is where the real control happens.

**Key commands:**

| Command | Hex | What it does |
|---------|-----|-------------|
| **Reset** | `0xC3` | Full DMA reset — clears all registers and state |
| **Reset Port A Timing** | `0xC7` | Reset Port A timing to defaults (3 T-state cycles) |
| **Reset Port B Timing** | `0xCB` | Reset Port B timing to defaults |
| **Disable DMA** | `0x83` | Stop any active transfer |
| **Load** | `0xCF` | Load start addresses into transfer engine |
| **Continue** | `0xD3` | Reset byte counter, keep current addresses |
| **Enable DMA** | `0x87` | Start the transfer |
| **Read Status Byte** | `0xBF` | Prepare status for reading |
| **Initialize Read Sequence** | `0xA7` | Set up multi-register read sequence |
| **Reinitialize Status Byte** | `0x8B` | Clear status flags |
| **Read Mask Follows** | `0xBB` | Next byte sets which registers appear in read sequence |
| **Force Ready** | `0xB3` | Force ready signal (for testing) |
| **Enable Interrupts** | `0xAB` | Set interrupt enable bit |
| **Disable Interrupts** | `0xAF` | Clear interrupt enable bit |

The three commands you'll use in virtually every transfer are **Reset**, **Load**, and **Enable DMA**.

### The LOAD Command — a Common Gotcha

A frequent mistake is to configure all the registers and then call Enable DMA without calling Load first. The **Load** command (`0xCF`) copies the addresses from WR0 and WR4 into the DMA's internal transfer engine. Without Load, the DMA starts transferring from whatever addresses happen to be left over from the previous transfer — or from zero if this is the first use.

The Load command also:
- Initializes the byte counter (0 in zxnDMA mode, 0xFFFF in legacy mode)
- Sets up the direction (copies Port A to source and Port B to destination, or vice versa, based on WR0's direction bit)
- Clears the end-of-block status

Always call Load after configuring addresses and before calling Enable.

### Progressive Reset

Here's something that surprises most programmers: the Reset command (`0xC3`) uses a **progressive reset** mechanism. Each call clears one column of the register array, and it takes six consecutive Reset calls to fully clear every register. This matches the original Zilog Z80 DMA behavior.

In practice, one Reset is usually enough — it stops any active transfer, clears the DMA state machine, resets timing to defaults, and puts the DMA in a known idle state. The progressive column clearing means some register fields might retain old values, but since you're about to reprogram everything anyway, it rarely matters.

## Reading DMA Status

You can read the DMA's current state by reading from the same port you write to (`0x6B` or `0x0B`). The status byte format is:

```
Bit 5: End of block (inverted: 1 = not reached, 0 = reached)
Bit 4: Constant 1
Bit 3: Constant 1
Bit 2: Constant 0
Bit 1: Constant 1
Bit 0: At least one byte transferred (1 = yes)

Format: 00E11010 or 00E11011
```

To read just the status byte, write the Read Status Byte command (`0xBF`) and then read from the port:

```z80klive
    ld bc, $6B
    ld a, $BF           ; Read Status Byte command
    out (c), a
    in a, (c)           ; Read status
    bit 5, a            ; Test end-of-block flag
    jr z, .transferDone ; If bit 5 = 0, transfer is complete
```

### Extended Read Sequence

For more detailed monitoring, the DMA supports reading multiple internal registers in sequence. Use the Read Mask Follows command (`0xBB`) followed by a mask byte to select which registers to include:

| Mask Bit | Register |
|----------|----------|
| Bit 0 | Status byte |
| Bit 1 | Byte counter, low |
| Bit 2 | Byte counter, high |
| Bit 3 | Port A address, low |
| Bit 4 | Port A address, high |
| Bit 5 | Port B address, low |
| Bit 6 | Port B address, high |

After setting the mask and issuing the Initialize Read Sequence command (`0xA7`), each read from the port returns the next enabled register in order, cycling through the enabled set.

```z80klive
    ld bc, $6B
    ld a, $BB           ; Read mask follows
    out (c), a
    ld a, $07           ; Mask: status + counter lo + counter hi
    out (c), a
    ld a, $A7           ; Initialize read sequence
    out (c), a
    in a, (c)           ; → status byte
    in a, (c)           ; → byte counter low
    in a, (c)           ; → byte counter high
```

## Putting It All Together: The Standard Transfer Sequence

Every DMA transfer follows the same pattern. Once you've seen it a few times, it becomes second nature:

1. **Reset** the DMA to a known state
2. **Configure** WR0 (direction, Port A address, block length)
3. **Configure** WR1 (Port A: memory/IO, address mode)
4. **Configure** WR2 (Port B: memory/IO, address mode)
5. **Configure** WR4 (operating mode, Port B address)
6. **Load** addresses into the transfer engine
7. **Enable** the DMA

Let's build a complete example: copying 256 bytes from address `0x8000` to `0xC000`, using the `.dma` pragma with the OTIR upload pattern:

```z80klive
dmaCopyProgram:
    .dma reset
    .dma wr0 a_to_b, transfer, $8000, 256   ; Step 2: direction, Port A, block length
    .dma wr1 memory, increment              ; Step 3: Port A — memory, incrementing
    .dma wr2 memory, increment              ; Step 4: Port B — memory, incrementing
    .dma wr4 continuous, $C000              ; Step 5: continuous mode, Port B = 0xC000
    .dma wr5                                ; Step 5 cont.: control flags (defaults)
    .dma load                               ; Step 6: load addresses into transfer engine
    .dma enable                             ; Step 7: start the transfer
dmaCopyProgram_end:

DmaCopy:
    ld hl, dmaCopyProgram
    ld b,  dmaCopyProgram_end - dmaCopyProgram
    ld c,  $6B
    otir
    ret
```

The OTIR upload is five instructions regardless of how many configuration bytes the program contains. The `.dma` pragma sub-command names annotate each step inline — `a_to_b, transfer, $8000, 256` is self-explanatory where the equivalent raw bytes (`$7D $00 $80 $00 $01`) are not. The DMA will execute the 256-byte copy in about 1,536 T-states — during which the CPU is halted — and then release the bus.

## Practical Pattern: Memory Fill

Filling a block of memory with a constant value is a classic DMA trick. The technique uses Port A in fixed address mode, pointing at a single byte containing the fill value:

```z80klive
; Fill 6144 bytes at 0x4000 with the value stored at FillByte
FillByte:
    .db $00                                 ; fill value — modify before calling DmaFill

dmaFillProgram:
    .dma reset
    .dma wr0 a_to_b, transfer, FillByte, 6144   ; Port A = FillByte label, length = 6144
    .dma wr1 memory, fixed                  ; Port A fixed — reads the same byte every time
    .dma wr2 memory, increment              ; Port B increments through destination
    .dma wr4 continuous, $4000              ; continuous mode, Port B = start of ULA pixels
    .dma wr5
    .dma load
    .dma enable
dmaFillProgram_end:

DmaFill:
    ld hl, dmaFillProgram
    ld b,  dmaFillProgram_end - dmaFillProgram
    ld c,  $6B
    otir
    ret
```

The key insight is `wr1 memory, fixed`: Port A holds the address of `FillByte` and never advances — the same byte is read 6,144 times while Port B increments through the destination. To change the fill value, write to `FillByte` before calling `DmaFill`. The result: the entire screen pixel area is cleared in one DMA operation.

## Practical Pattern: Loading Sprites via DMA

Sprite pattern data needs to get from main memory into the Next's sprite pattern RAM. The sprite hardware is accessed through I/O ports — you select a pattern slot via port `0x303B`, then write pixel data to port `0x5B`. Each sprite pattern is 256 bytes (16×16 pixels, 8 bits per pixel).

```z80klive
; DMA program table — source address and length patched per call
spriteDMAProgram:
    .dma reset
    .dma wr0 a_to_b, transfer           ; base byte only: all follow-bits set
spriteDMASrc:
    .dw 0                               ; Port A address — patched to sprite sheet source
spriteDMALength:
    .dw 0                               ; Block length   — patched to byte count
    .dma wr1 memory, increment
    .dma wr2 io, fixed                  ; Port B = I/O port, fixed address
    .dma wr4 continuous                 ; base byte only: Port B address follows
    .dw $005B                           ; Port B = sprite pattern data port
    .dma wr5
    .dma load
    .dma enable
spriteDMAProgram_end:

; Load sprites: HL = source address, BC = byte count
; Precondition: select the target pattern slot via port 0x303B before calling
LoadSprites:
    ld bc, $303B
    ld a, 0                             ; Start at pattern slot 0
    out (c), a

    ld (spriteDMASrc),    hl            ; patch source address
    ld (spriteDMALength), bc            ; patch byte count
    ld hl, spriteDMAProgram
    ld b,  spriteDMAProgram_end - spriteDMAProgram
    ld c,  $6B
    otir
    ret
```

`.dma wr0 a_to_b, transfer` without address/length arguments emits only the WR0 base byte with all follow-byte indicator bits set; the two `.dw 0` patch labels that follow serve as those follow bytes. Similarly, `.dma wr4 continuous` without an address argument emits only the WR4 base byte with address follow-bits set; the `.dw $005B` provides the constant port address.

The sprite hardware auto-increments its internal write pointer each time you write to port `0x5B`, so the DMA streams bytes to the same fixed port address while the sprite RAM pointer advances internally.

## Practical Pattern: Audio Streaming with Burst Mode

For audio playback, you need to output sample bytes at a precise rate. This is where burst mode and the prescaler shine:

```z80klive
; DMA program table — source address and sample count patched per call
audioDMAProgram:
    .dma reset
    .dma wr0 a_to_b, transfer           ; base byte only: all follow-bits set
audioDMABuffer:
    .dw 0                               ; Port A address — patched to audio buffer
audioDMALength:
    .dw 0                               ; Block length   — patched to sample count
    .dma wr1 memory, increment
    .dma wr2 io, fixed, 2t, 80          ; I/O, fixed address, 2T cycles, prescaler=80 → ~10.9 kHz
    .dma wr4 burst                      ; burst mode — Port B address follows
    .dw $00DF                           ; Port B = DAC port 0xDF
    .dma wr5
    .dma load
    .dma enable
audioDMAProgram_end:

; Stream audio from AudioBuffer (8000 samples)
StreamAudio:
    ld hl, AudioBuffer
    ld (audioDMABuffer), hl             ; patch source address
    ld hl, 8000
    ld (audioDMALength), hl             ; patch sample count
    ld hl, audioDMAProgram
    ld b,  audioDMAProgram_end - audioDMAProgram
    ld c,  $6B
    otir
    ; CPU is now free — DMA releases the bus between samples (burst mode)
    ret
```

`wr2 io, fixed, 2t, 80` encodes the three-byte WR2 sequence in one pragma line: the base byte (`$68`), the timing byte (`$22`), and the prescaler byte (`80`). With raw `.db` directives those three magic numbers carry no hint of their meaning.

Burst mode is critical here. In continuous mode, the DMA would hold the bus for the entire transfer — with 8,000 bytes at 320 T-states per byte, that's 2.56 million T-states (over 700 milliseconds at 3.5 MHz) of dead CPU time. Burst mode releases the bus between samples, giving the CPU those 320-T-state windows to do real work.

### Auto-Restart for Continuous Audio

If you want to loop audio (play a buffer repeatedly), change `.dma wr5` to `.dma wr5 auto_restart` in `audioDMAProgram`:

```z80klive
    .dma wr5 auto_restart       ; D5=1 — reload addresses and restart on completion
```

With auto-restart enabled, the DMA reloads the starting addresses and block length when the transfer completes, then immediately starts over. The audio plays in an infinite loop until you disable the DMA.

## Practical Pattern: CTC-Triggered Periodic DMA

The DMA's built-in prescaler (the `prescaler` parameter in WR2) is convenient, but it has a subtle dependency: its counting rate scales with CPU speed. The FPGA adjusts the prescaler increment so that the same prescaler value produces the same real-time delay at 3.5 MHz and at 28 MHz, but this scaling happens in discrete steps — and the CTC clock, as covered in the CTC chapter, runs at a fixed 28 MHz regardless of CPU speed with no such adjustment needed.

There's a cleaner alternative: let the CTC generate the timing, and connect its ZC/TO output directly to the DMA trigger. The Next hardware does exactly this. **NextReg `$CD`** controls which CTC channels (0–7, one bit each, bit 0 = channel 0) can trigger a DMA burst cycle. When NR `$CD` bit N is set and CTC channel N fires its ZC/TO pulse, the DMA executes one burst step — transferring one byte (or releasing and re-requesting the bus once, depending on mode) — even if the DMA's own prescaler hasn't expired.

The result: the CTC owns the timing, the DMA owns the data movement. You get sample-rate precision from the CTC's 28 MHz-derived clock without relying on the DMA prescaler at all.

### How It Works

1. Configure the DMA in **burst mode** with no prescaler (omit prescaler from WR2)
2. Configure a CTC channel as a timer at the desired rate (e.g. `28 MHz ÷ 16 ÷ time_constant`)
3. Write `1 << channel` to NextReg `$CD` to arm the CTC → DMA trigger
4. Enable the DMA — it sits idle in burst mode, waiting for a trigger
5. Each CTC ZC/TO event fires one DMA burst: one byte is transferred, then the bus is released until the next ZC/TO

The DMA trigger and the CTC interrupt are independent. You can use the same CTC channel to both trigger DMA transfers *and* generate a CPU interrupt, or you can use only one of those paths. NR `$CD` only controls the DMA trigger; the CTC channel's own interrupt setting (control word D7) and NR `$C5` control whether a CPU interrupt also fires.

### Audio Streaming with CTC Timing

Compare this with the earlier prescaler-based audio example. The DMA program is almost identical, but the prescaler byte is gone from WR2, and the timing comes from an external CTC channel instead:

```z80klive
CTC_CH3     equ $1B3B        ; Use channel 3 for audio timing
NR_REG      equ $243B
NR_DAT      equ $253B

; === Configure CTC Channel 3 as a timer at ~22 kHz ===
; 28 MHz / 16 (prescaler ÷16) / 80 (time constant) = 21,875 Hz
    ld bc, CTC_CH3
    ld a, %00000101          ; Timer, prescaler ÷16, start immediately, TC follows
    out (c), a
    ld a, 80                 ; Time constant = 80 → ~21,875 Hz
    out (c), a

; === Arm the CTC → DMA trigger (NR $CD bit 3 = CTC channel 3) ===
    ld a, $CD
    ld bc, NR_REG
    out (c), a
    ld a, %00001000          ; Enable channel 3 as DMA trigger
    ld bc, NR_DAT
    out (c), a

; === DMA program — burst mode, no prescaler; CTC controls the rate ===
audioCTCDMAProgram:
    .dma reset
    .dma wr0 a_to_b, transfer
audioCTCSrc:  .dw 0                     ; patch: source buffer address
audioCTCLen:  .dw 0                     ; patch: sample count
    .dma wr1 memory, increment
    .dma wr2 io, fixed                  ; no prescaler — CTC handles timing
    .dma wr4 burst                      ; burst: release bus between CTC-triggered bytes
    .dw $00DF                           ; Port B = DAC port $DF
    .dma wr5                            ; default flags (or use auto_restart for looping)
    .dma load
    .dma enable
audioCTCDMAProgram_end:

; Kick off streaming: HL = buffer address, BC = sample count
    ld (audioCTCSrc), hl
    ld (audioCTCLen), bc
    ld hl, audioCTCDMAProgram
    ld b,  audioCTCDMAProgram_end - audioCTCDMAProgram
    ld c,  $6B
    otir
    ; CPU is now free; each CTC tick at ~21,875 Hz delivers one sample to the DAC
```

### Prescaler WR2 vs. CTC Trigger: Which to Use?

| | DMA Internal Prescaler | CTC Trigger |
|---|---|---|
| **Timing source** | DMA-internal counter, scaled by CPU speed | CTC, always 28 MHz base |
| **Rate formula** | prescaler value × 4 T-states (at 3.5 MHz) | 28 MHz ÷ CTC prescaler ÷ time constant |
| **Precision** | Good — FPGA scales with CPU mode | Excellent — CTC is CPU-speed independent |
| **Flexibility** | Fixed rate per DMA program | CTC can be reprogrammed live |
| **Interrupt capability** | None | CTC channel can simultaneously interrupt CPU |
| **Configuration** | One extra WR2 byte | Separate CTC setup + NR `$CD` write |
| **Complexity** | Lower | Slightly higher |

For simple one-off audio playback, the internal prescaler is perfectly adequate and easier to set up. Reach for the CTC trigger when you need:
- The same sample rate to hold precisely across CPU speed changes
- One CTC channel simultaneously timing the DMA *and* counting frames for the CPU
- Very low sample rates where WR2 prescaler values would be awkward to compute
- Dynamic rate changes at runtime (reprogram the CTC time constant without touching the DMA)

### Disarming the Trigger

When you're done with CTC-triggered DMA, clear NR `$CD` to prevent stray CTC pulses from waking the DMA unexpectedly:

```z80klive
    ; Disable DMA first, then clear the trigger source
    ld bc, $6B
    ld a, $83                ; WR6: Disable DMA
    out (c), a
    ld a, $CD
    ld bc, NR_REG
    out (c), a
    xor a                    ; Clear all CTC → DMA trigger enables
    ld bc, NR_DAT
    out (c), a
```

## Building a Reusable DMA Helper

The upload sequence — patch any runtime fields, then run `OTIR` to stream the program table to the DMA port — is just a handful of instructions, but wrapping it as a subroutine keeps call sites clean:

```z80klive
; Upload a DMA program table to the zxnDMA port
; HL = pointer to table, B = length in bytes
ExecuteDma:
    ld c, $6B               ; zxnDMA port
.loop:
    ld a, (hl)
    out (c), a
    inc hl
    djnz .loop
    ret
```

With `.dma` pragmas, each program table is self-documenting:

```z80klive
; 256-byte memory copy from 0x8000 to 0xC000 — all values static
DmaCopyParams:
    .dma reset
    .dma wr0 a_to_b, transfer, $8000, 256
    .dma wr1 memory, increment
    .dma wr2 memory, increment
    .dma wr4 continuous, $C000
    .dma wr5
    .dma load
    .dma enable
DmaCopyParamsLen = $ - DmaCopyParams
```

Call it with:

```z80klive
    ld hl, DmaCopyParams
    ld b,  DmaCopyParamsLen
    call ExecuteDma
```

For tables with runtime-patchable fields, label the `.dw 0` patch points and write the runtime values before calling:

```z80klive
DmaDynParams:
    .dma reset
    .dma wr0 a_to_b, transfer           ; base byte only — address and length follow
DmaDynSrc:  .dw 0                       ; patched at runtime
DmaDynLen:  .dw 0                       ; patched at runtime
    .dma wr1 memory, increment
    .dma wr2 memory, increment
    .dma wr4 continuous                 ; base byte only — Port B address follows
DmaDynDst:  .dw 0                       ; patched at runtime
    .dma wr5
    .dma load
    .dma enable
DmaDynParamsLen = $ - DmaDynParams
```

Call with:

```z80klive
    ; HL = source, DE = destination, BC = byte count
    ld (DmaDynSrc), hl
    ld (DmaDynDst), de
    ld (DmaDynLen), bc
    ld hl, DmaDynParams
    ld b,  DmaDynParamsLen
    call ExecuteDma
```

You can define as many program tables as you need and dispatch them all through the same five-instruction `ExecuteDma` routine.

## Timing and Performance Notes

### T-State Costs

Each byte transfer costs a read cycle plus a write cycle. The exact timing depends on the source and destination types and the CPU speed:

| Operation | Speed | T-States |
|-----------|-------|----------|
| Memory read | 3.5–14 MHz | 3 |
| Memory read | 28 MHz (non-Bank 7) | 4 (wait state) |
| Memory read | 28 MHz (Bank 7) | 3 (no wait state) |
| Memory write | All speeds | 3 |
| I/O port read/write | All speeds | 4 |
| SPI port (`0xEB`) | All speeds | 4 + 16 (SPI wait) |

A typical memory-to-memory byte costs 6 T-states (3 read + 3 write). Memory-to-I/O costs 7 (3 + 4). The SPI port is slow because the FPGA needs time to shift data through the serial interface.

### DMA vs LDIR

| Transfer | LDIR | DMA (Continuous) | Speedup |
|----------|------|-------------------|---------|
| 256 bytes, mem→mem | 5,376 T | ~1,536 T | 3.5× |
| 6,144 bytes (ULA screen) | 129,024 T | ~36,864 T | 3.5× |
| 16,384 bytes (memory bank) | 344,064 T | ~98,304 T | 3.5× |

The DMA's advantage is consistent: roughly 3.5× faster for memory-to-memory copies. But the real win is for I/O transfers — loading sprite data through a port, streaming audio to a DAC — where the DMA can do things that `LDIR` simply can't.

### CPU Interaction

During a continuous transfer, the CPU is completely halted. It doesn't execute any instructions, doesn't respond to interrupts, and doesn't refresh DRAM. For very long transfers atthe  default 3.5 MHz speed, this is rarely a problem — but at 28 MHz with a large block, be aware that the DMA could hold the bus for a noticeable fraction of a frame.

Burst mode solves this by releasing the bus periodically. The CPU gets small windows of execution time between DMA bytes, which is enough to service interrupts and keep background tasks alive.

## The DMA and the FPGA: What's Really Happening

If you're curious about the hardware implementation, the FPGA source (`dma.vhd`) reveals a straightforward state machine with 13 states:

```
IDLE → START_DMA → WAITING_ACK → TRANSFERING_READ_1..4 → TRANSFERING_WRITE_1..4 → WAITING_CYCLES → FINISH_DMA
```

The read/write phases use variable numbers of clock cycles based on the timing configuration:
- 4-cycle timing: goes through all four `TRANSFERING_READ_1` through `TRANSFERING_READ_4` states
- 3-cycle timing (default): skips `TRANSFERING_READ_1`, enters at `TRANSFERING_READ_2`
- 2-cycle timing: skips to `TRANSFERING_READ_3`

The write phase mirrors this structure. Between the read and write phases, the DMA swaps the address bus from the source address to the destination address, switches from read to write mode, and sets the memory/IO request signals appropriately.

The `WAITING_CYCLES` state handles prescaler timing. In burst mode, it also releases the bus (`cpu_busreq_n_s <= '1'`) to let the CPU run during the wait period. When the prescaler timer expires, the DMA either re-requests the bus (if it was released) or jumps directly to the next read cycle.

The `FINISH_DMA` state checks the auto-restart flag. If set, it reloads the starting addresses and counter, then goes back to `START_DMA` (or `WAITING_ACK` if the bus is still held). If not, it transitions to `IDLE` and the CPU resumes full control.

> The FPGA source contains a comment: "ATTENTION: Loosely based on Zilog Z80C10. There are differences!" — a polite way of saying that the Next's DMA isn't a perfect clone. The most significant differences are the burst mode with prescaler (a Next innovation), the simplified interrupt handling (most interrupt features are commented out), and the absence of search-mode hardware support.

## Common Mistakes and Debugging Tips

**Forgetting the Load command.** The most common DMA bug. If your transfer goes to the wrong place, or nothing happens at all, check that you issued `0xCF` after configuring registers and before enabling.

**Wrong port for byte transfer direction.** If Port B is configured as I/O with a fixed address, make sure you're actually using WR2 (base byte ending in `000`) and not WR1 (`100`). The two registers have identical structures but control different ports.

**Block length of zero.** In zxnDMA mode, a block length of 0 is treated as a zero-byte transfer — nothing happens. In legacy mode (`0x0B`), a block length of 0 transfers 1 byte. If your code calculates block lengths dynamically, guard against the zero case.

**Not resetting before reconfiguration.** While you can update individual registers between transfers, starting from a Reset eliminates surprises from leftover state. Unless performance demands it, always Reset first.

**Reading status without the Read Status command.** The DMA port read returns whatever register is currently in the read sequence. If you haven't set up the read sequence (with `0xBF` or `0xBB` + `0xA7`), the read may return garbage. Always issue a read command before reading.

**Continuous mode during audio.** Using continuous mode for audio streaming freezes the CPU for the entire playback. Use burst mode with a prescaler instead — the CPU gets breathing room between samples.

## Quick Reference: Common DMA Sequences

### Reset and Disable

```z80klive
    ld bc, $6B
    ld a, $C3           ; Reset
    out (c), a
    ld a, $83           ; Disable DMA
    out (c), a
```

### Minimal Memory Copy (A→B, Continuous)

```z80klive
; HL = source address, DE = destination address, BC = byte count
MemCopyDMA:
    ld (memCopySrc), hl
    ld (memCopyDst), de
    ld (memCopyLen), bc
    ld hl, memCopyProgram
    ld b,  memCopyProgram_end - memCopyProgram
    ld c,  $6B
    otir
    ret

memCopyProgram:
    .dma reset
    .dma wr0 a_to_b, transfer
memCopySrc: .dw 0
memCopyLen: .dw 0
    .dma wr1 memory, increment
    .dma wr2 memory, increment
    .dma wr4 continuous
memCopyDst: .dw 0
    .dma wr5
    .dma load
    .dma enable
memCopyProgram_end:
```

### Memory to I/O Port (A→B, Continuous)

```z80klive
; HL = source address, BC = byte count, DE = 16-bit I/O port address
MemToIODMA:
    ld (ioSrc), hl
    ld (ioLen), bc
    ld (ioDst), de
    ld hl, ioProgram
    ld b,  ioProgram_end - ioProgram
    ld c,  $6B
    otir
    ret

ioProgram:
    .dma reset
    .dma wr0 a_to_b, transfer
ioSrc:  .dw 0
ioLen:  .dw 0
    .dma wr1 memory, increment
    .dma wr2 io, fixed
    .dma wr4 continuous
ioDst:  .dw 0
    .dma wr5
    .dma load
    .dma enable
ioProgram_end:
```

The zxnDMA may look intimidating at first — seven register groups, follow bytes, direction bits, operating modes. But once you've built a couple of transfers, the pattern becomes automatic: build a `.dma` program table, patch any runtime fields, and stream it with `OTIR`. The CPU steps aside, the data flows, and everyone's happy.
