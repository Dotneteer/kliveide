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

Let's build a complete example: copying 256 bytes from address `0x8000` to `0xC000`.

```z80klive
DmaCopy:
    ld bc, $6B              ; zxnDMA port

    ; Step 1: Reset
    ld a, $C3               ; RESET command
    out (c), a

    ; Step 2: WR0 — A→B, Port A address = 0x8000, block length = 256
    ld a, $7D               ; D6:D3 all set (all params follow), D2=1 (A→B), D0=1 (Transfer)
    out (c), a
    ld a, $00               ; Port A low byte
    out (c), a
    ld a, $80               ; Port A high byte
    out (c), a
    ld a, $00               ; Block length low (256 & 0xFF = 0)
    out (c), a
    ld a, $01               ; Block length high (256 >> 8 = 1)
    out (c), a

    ; Step 3: WR1 — Port A = memory, incrementing
    ld a, $14               ; D5:D4=01 (increment), D3=0 (memory), D2:D0=100 (WR1)
    out (c), a

    ; Step 4: WR2 — Port B = memory, incrementing (no timing)
    ld a, $10               ; D5:D4=01 (increment), D3=0 (memory), D2:D0=000 (WR2)
    out (c), a

    ; Step 5: WR4 — Continuous mode, Port B address = 0xC000
    ld a, $2D               ; D6:D5=01 (continuous), D3=1 D2=1 (addr follows), D1:D0=01 (WR4)
    out (c), a
    ld a, $00               ; Port B low byte
    out (c), a
    ld a, $C0               ; Port B high byte
    out (c), a

    ; Step 6: LOAD
    ld a, $CF               ; Load addresses into transfer engine
    out (c), a

    ; Step 7: ENABLE
    ld a, $87               ; Enable DMA — transfer starts immediately
    out (c), a

    ret
```

That's seventeen `OUT` instructions. Not the most elegant sequence, but each byte has a clear purpose. The DMA will execute the 256-byte copy in about 1,536 T-states — during which the CPU is halted — and then release the bus. By the time the `RET` executes, the copy is already done.

## Practical Pattern: Memory Fill

Filling a block of memory with a constant value is a classic DMA trick. The technique uses Port A in fixed address mode, pointing at a single byte containing the fill value:

```z80klive
; Fill 6144 bytes at 0x4000 with the value at FillByte
DmaFill:
    ld bc, $6B

    ld a, $C3               ; Reset
    out (c), a

    ; WR0: A→B, Port A = FillByte address, block length = 6144
    ld a, $7D
    out (c), a
    ld a, low FillByte      ; Port A = address of the fill value
    out (c), a
    ld a, high FillByte
    out (c), a
    ld a, $00               ; Block length low (6144 & 0xFF = 0)
    out (c), a
    ld a, $18               ; Block length high (6144 >> 8 = 24 = 0x18)
    out (c), a

    ; WR1: Port A = memory, FIXED address (reads same byte every time)
    ld a, $24               ; D5:D4=10 (fixed), D3=0 (memory), D2:D0=100 (WR1)
    out (c), a

    ; WR2: Port B = memory, incrementing
    ld a, $10
    out (c), a

    ; WR4: Continuous, Port B = 0x4000
    ld a, $2D
    out (c), a
    ld a, $00
    out (c), a
    ld a, $40
    out (c), a

    ld a, $CF               ; Load
    out (c), a
    ld a, $87               ; Enable
    out (c), a
    ret

FillByte:
    .db $00                  ; The fill value
```

The key insight is WR1's address mode: `D5:D4 = 10` means fixed. Port A reads the same address — `FillByte` — for all 6,144 bytes. Port B increments through the destination. The result: the entire screen pixel area is cleared in one DMA operation.

## Practical Pattern: Loading Sprites via DMA

Sprite pattern data needs to get from main memory into the Next's sprite pattern RAM. The sprite hardware is accessed through I/O ports — you select a pattern slot via port `0x303B`, then write pixel data to port `0x5B`. Each sprite pattern is 256 bytes (16×16 pixels, 8 bits per pixel).

```z80klive
; Load 4 sprite patterns (1024 bytes) from SpriteData to sprite pattern RAM
LoadSprites:
    ld bc, $303B
    ld a, 0                 ; Start at pattern slot 0
    out (c), a              ; Select first pattern

    ld bc, $6B              ; zxnDMA port

    ld a, $C3               ; Reset
    out (c), a

    ; WR0: A→B, source = SpriteData, length = 1024
    ld a, $7D
    out (c), a
    ld a, low SpriteData
    out (c), a
    ld a, high SpriteData
    out (c), a
    ld a, $00               ; 1024 & 0xFF
    out (c), a
    ld a, $04               ; 1024 >> 8
    out (c), a

    ; WR1: Port A = memory, incrementing
    ld a, $14
    out (c), a

    ; WR2: Port B = I/O port, FIXED address
    ld a, $28               ; D5:D4=10 (fixed), D3=1 (I/O), D2:D0=000 (WR2)
    out (c), a

    ; WR4: Continuous, Port B = 0x5B (sprite data port)
    ld a, $2D
    out (c), a
    ld a, $5B               ; Port B = 0x5B (sprite pattern data)
    out (c), a
    ld a, $00               ; High byte (I/O, but DMA uses 16-bit addresses)
    out (c), a

    ld a, $CF               ; Load
    out (c), a
    ld a, $87               ; Enable — DMA streams 1024 bytes to port 0x5B
    out (c), a
    ret
```

Notice Port B's configuration:
- **WR2** sets it as I/O port with fixed address — the port address stays at `0x5B` for every byte
- **WR4** provides the port address as 16-bit (the DMA always uses 16-bit addresses, even for I/O)

The sprite hardware auto-increments its internal write pointer each time you write to port `0x5B`, so the DMA merrily streams bytes to the same port address while the sprite RAM pointer advances internally.

## Practical Pattern: Audio Streaming with Burst Mode

For audio playback, you need to output sample bytes at a precise rate. This is where burst mode and the prescaler shine:

```z80klive
; Stream 8000 bytes of 8-bit audio to DAC port 0xDF at ~10.9 kHz
StreamAudio:
    ld bc, $6B

    ld a, $C3               ; Reset
    out (c), a

    ; WR0: A→B, source = AudioBuffer, length = 8000
    ld a, $7D
    out (c), a
    ld a, low AudioBuffer
    out (c), a
    ld a, high AudioBuffer
    out (c), a
    ld a, $40               ; 8000 & 0xFF = 0x40
    out (c), a
    ld a, $1F               ; 8000 >> 8 = 0x1F
    out (c), a

    ; WR1: Port A = memory, incrementing
    ld a, $14
    out (c), a

    ; WR2: Port B = I/O, fixed, with prescaler
    ld a, $68               ; D6=1 (timing follows), D5:D4=10 (fixed), D3=1 (I/O), D2:D0=000
    out (c), a
    ld a, $22               ; Timing: D5=1 (prescaler follows), D1:D0=10 (2 T-state cycles)
    out (c), a
    ld a, 80                ; Prescaler = 80 → 320 T-states delay → ~10.9 kHz sample rate
    out (c), a

    ; WR4: Burst mode, Port B = 0xDF (DAC port)
    ld a, $4D               ; D6:D5=10 (burst), D3=1, D2=1, D1:D0=01
    out (c), a
    ld a, $DF               ; DAC port low byte
    out (c), a
    ld a, $00               ; DAC port high byte
    out (c), a

    ld a, $CF               ; Load
    out (c), a
    ld a, $87               ; Enable
    out (c), a

    ; CPU is now free to run while DMA streams audio
    ; DMA will output one sample every 320 T-states
    ; and release the bus between samples for CPU execution
    ret
```

Burst mode is critical here. In continuous mode, the DMA would hold the bus for the entire transfer — with 8,000 bytes at 320 T-states per byte, that's 2.56 million T-states (over 700 milliseconds at 3.5 MHz) of dead CPU time. Burst mode releases the bus between samples, giving the CPU those 320-T-state windows to do real work.

### Auto-Restart for Continuous Audio

If you want to loop audio (play a buffer repeatedly), add WR5 with auto-restart before the Load command:

```z80klive
    ld a, $A2           ; WR5: auto-restart on (D5=1)
    out (c), a
```

With auto-restart enabled, the DMA reloads the starting addresses and block length when the transfer completes, then immediately starts over. The audio plays in an infinite loop until you disable the DMA.

## Building a Reusable DMA Helper

After the third time you write the same seventeen-`OUT` sequence, you'll want a helper routine. Here's a table-driven approach that reads the DMA configuration from a parameter block:

```z80klive
; Execute a DMA transfer described by a parameter table
; HL = pointer to parameter table (sequence of bytes to write to DMA port)
; B = number of bytes in the table
ExecuteDma:
    ld c, $6B               ; zxnDMA port
.loop:
    ld a, (hl)
    out (c), a
    inc hl
    djnz .loop
    ret

; Example parameter table for a 256-byte memory copy from 0x8000 to 0xC000
DmaCopyParams:
    .db $C3                  ; Reset
    .db $7D                  ; WR0: all params, A→B, transfer
    .db $00, $80             ; Port A address = 0x8000
    .db $00, $01             ; Block length = 256
    .db $14                  ; WR1: memory, increment
    .db $10                  ; WR2: memory, increment
    .db $2D                  ; WR4: continuous, addr follows
    .db $00, $C0             ; Port B address = 0xC000
    .db $CF                  ; Load
    .db $87                  ; Enable
DmaCopyParamsLen = $ - DmaCopyParams
```

Call it with:

```z80klive
    ld hl, DmaCopyParams
    ld b, DmaCopyParamsLen
    call ExecuteDma
```

The parameter table makes it easy to define multiple DMA operations at assembly time, and the `ExecuteDma` routine is just five instructions. You can even build parameter tables dynamically at runtime if the source or destination addresses change.

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
    ; Assumes: HL = source address, DE = dest address, IX = byte count
    ld bc, $6B
    ld a, $C3 : out (c), a              ; Reset
    ld a, $7D : out (c), a              ; WR0: all params, A→B
    ld a, l   : out (c), a              ; Port A lo
    ld a, h   : out (c), a              ; Port A hi
    push ix
    pop hl
    ld a, l   : out (c), a              ; Block length lo
    ld a, h   : out (c), a              ; Block length hi
    ld a, $14 : out (c), a              ; WR1: memory, increment
    ld a, $10 : out (c), a              ; WR2: memory, increment
    ld a, $2D : out (c), a              ; WR4: continuous, addr follows
    ld a, e   : out (c), a              ; Port B lo
    ld a, d   : out (c), a              ; Port B hi
    ld a, $CF : out (c), a              ; Load
    ld a, $87 : out (c), a              ; Enable
```

### Memory to I/O Port (A→B, Continuous)

```z80klive
    ld bc, $6B
    ld a, $C3 : out (c), a              ; Reset
    ld a, $7D : out (c), a              ; WR0: all params, A→B
    ; ... Port A address and block length ...
    ld a, $14 : out (c), a              ; WR1: memory, increment
    ld a, $28 : out (c), a              ; WR2: I/O, fixed
    ld a, $2D : out (c), a              ; WR4: continuous, addr follows
    ; ... Port B = I/O port address ...
    ld a, $CF : out (c), a              ; Load
    ld a, $87 : out (c), a              ; Enable
```

The zxnDMA may look intimidating at first — seven register groups, follow bytes, direction bits, operating modes. But once you've built a couple of transfers by hand, the pattern becomes automatic: Reset, configure the two ports, set the mode, Load, Enable. The CPU steps aside, the data flows, and everyone's happy.
