# TVC Technical Reference

Videoton TV Computer hardware information for emulator authors and low-level
software developers.

This is an implementation-neutral description of the TVC machine. It documents
the memory and I/O maps, timing relationships, interrupt wiring, video data
path, keyboard matrix, sound/tape hardware, and expansion devices. It does not
repeat the generic Z80, MC6845, or FD1793 specifications; consult the original
component documentation for behavior not changed by the TVC wiring.

The companion [rtvc Implementation Reference](rtvc.md) describes how this
repository models the machine, including renderer choices, snapshots, debugger
interfaces, UI behavior, and build targets.

## Contents

**Overview**

- [Technical data](#technical-data)
- [Machine variants](#machine-variants)
- [Clock and timing](#clock-and-timing)
- [Reset state](#reset-state)

**Hardware programming**

- [CPU and bus conventions](#cpu-and-bus-conventions)
- [Memory map](#memory-map)
- [I/O map](#io-map)
- [Interrupt system](#interrupt-system)
- [Video system](#video-system)
- [Keyboard](#keyboard)
- [Sound and timer](#sound-and-timer)
- [Cassette interface](#cassette-interface)
- [Expansion system](#expansion-system)
- [HBF floppy interface](#hbf-floppy-interface)

**Media and firmware**

- [CAS cassette representation](#cas-cassette-representation)
- [Raw DSK images](#raw-dsk-images)
- [System ROM placement](#system-rom-placement)

**Implementation notes**

- [Minimum emulator model](#minimum-emulator-model)
- [Accuracy-sensitive behavior](#accuracy-sensitive-behavior)
- [External component references](#external-component-references)

---

## Technical Data

| Item | TVC value |
| --- | --- |
| CPU | Zilog Z80-compatible CPU |
| CPU clock | 3,125,000 Hz |
| CPU T-state | 320 ns |
| CPU address space | 64 KiB, divided into four 16 KiB paging windows |
| CPU I/O space | TVC devices use the low 8-bit port address |
| Base RAM | Four logical 16 KiB RAM banks, U0-U3 |
| Video RAM | One 16 KiB bank on standard machines; four banks on TVC 64K+ |
| System ROM window | 16 KiB SYS bank |
| Cartridge ROM window | 16 KiB CART bank |
| Extension ROM | 8 KiB EXTH bank at the high half of the EXT mapping |
| Video controller | MC6845-compatible CRTC used as a timing/address generator |
| CRTC character clock | 1,562,500 Hz, exactly one clock per two CPU T-states |
| Normal line period | 64 us, 200 CPU T-states |
| Normal frame rate | 50 Hz |
| Nominal frame budget | 62,500 CPU T-states |
| Normal active picture | 512 x 240 source pixels |
| TVC color space | 16 colors encoded as intensity, green, red, blue |
| Sound | One programmable divider/counter channel plus 4-bit amplitude/DAC |
| Keyboard | 11 rows x 8 columns, active-low |
| Cassette | Software-decoded input and software-toggled output |
| Expansion | Four I/O slots and one selected 8 KiB memory window |

The Z80 and MC6845 are ordinary components from the CPU's point of view. The
TVC-specific behavior lies in the memory mapper, port decode, CRTC-to-VRAM
address wiring, pixel serializer, palette, and interrupt connections.

## Machine Variants

The memory mapper supports two relevant hardware classes:

| Variant | Main RAM behavior | Video RAM behavior |
| --- | --- | --- |
| TVC 64K | U0-U3 are available; page 0 selection `11b` aliases U0 | One 16 KiB video bank, VID0 |
| TVC 64K+ | Page 0 selection `11b` maps U3 | Four independently selectable 16 KiB video banks, VID0-VID3 |

ROM revisions such as BASIC 1.2 and BASIC 2.2 change firmware, not the core bus
architecture described here. VT-DOS systems add an HBF expansion card and DOS
ROM rather than changing the base machine.

## Clock and Timing

The 3.125 MHz CPU clock is the useful master time base for emulation:

```text
CPU T-state          1 / 3,125,000 s = 320 ns
CRTC character clock 1,562,500 Hz    = 2 CPU T-states
normal scanline      64 us            = 200 CPU T-states
normal 50 Hz frame   20 ms            = 62,500 CPU T-states
```

With the normal firmware CRTC programming, a line contains 100 character
clocks. A character clock fetches one byte and serializes it into eight output
pixel periods. The standard active area is 64 characters by 60 character rows,
with four raster lines per row: 512 by 240 source pixels.

Software can reprogram the CRTC. An accurate emulator must therefore derive
display timing from CRTC state rather than assuming that every program keeps
the firmware defaults. The 62,500-cycle value is still a convenient host
scheduling quantum, not a substitute for advancing the CRTC.

## Reset State

At hardware reset:

- the Z80 begins from its normal reset state;
- the main paging register is effectively `0x00`;
- the video paging register is effectively `0x00`;
- page 0 contains SYS ROM;
- page 1 contains U1 RAM;
- page 2 contains VID0;
- page 3 contains CART ROM;
- the selected expansion memory slot is slot 0;
- pending interrupt inputs are inactive;
- sound, tape motor, keyboard state, and CRTC state return to their reset
  conditions.

Firmware programs the CRTC, palette, paging, and interrupt timing during boot.
Power-on RAM contents are not specified here and should not be relied upon by
software.

## CPU and Bus Conventions

### Z80 use

The TVC does not modify the Z80 instruction set. CPU emulators should implement
normal Z80 interrupt, HALT, refresh, and I/O semantics. This reference only
describes the devices visible through memory and I/O.

### Port decode

TVC peripheral descriptions use an 8-bit port number. For a Z80 implementation
that exposes the full 16-bit I/O address, route devices from the low byte unless
a particular expansion card documents additional decoding.

### Byte order

The Z80 is little-endian. A 16-bit word at address `A` stores the low byte at
`A` and the high byte at `A+1`.

## Memory Map

### CPU paging windows

The 64 KiB CPU address space is divided into four fixed 16 KiB windows:

| Page | CPU range | Main paging controls |
| --- | --- | --- |
| 0 | `0x0000-0x3FFF` | bits 3-4 |
| 1 | `0x4000-0x7FFF` | bit 2, plus video-map bits 0-1 |
| 2 | `0x8000-0xBFFF` | bit 5, plus video-map bits 2-3 |
| 3 | `0xC000-0xFFFF` | bits 6-7 |

Port `0x02` is the main paging register. Let its value be `M`.

### Main paging register, port `0x02`

| CPU window | Selection | Mapping |
| --- | --- | --- |
| Page 0 | `M & 0x18 == 0x00` | SYS ROM |
| Page 0 | `M & 0x18 == 0x08` | CART ROM |
| Page 0 | `M & 0x18 == 0x10` | U0 RAM |
| Page 0 | `M & 0x18 == 0x18` | U3 on 64K+, U0 on standard TVC |
| Page 1 | `M & 0x04 == 0x00` | U1 RAM |
| Page 1 | `M & 0x04 == 0x04` | selected video RAM on 64K+; U1 otherwise |
| Page 2 | `M & 0x20 == 0x00` | selected video RAM; VID0 on standard TVC |
| Page 2 | `M & 0x20 == 0x20` | U2 RAM |
| Page 3 | `M & 0xC0 == 0x00` | CART ROM |
| Page 3 | `M & 0xC0 == 0x40` | SYS ROM |
| Page 3 | `M & 0xC0 == 0x80` | U3 RAM |
| Page 3 | `M & 0xC0 == 0xC0` | EXT/EXTH split mapping |

ROM writes have no effect. RAM and video RAM are read/write.

### EXT/EXTH split mapping

When page 3 selects EXT:

```text
0xC000-0xDFFF  selected expansion card memory window, 8 KiB
0xE000-0xFFFF  EXTH ROM, 8 KiB
```

The active card for the low 8 KiB window is selected by port `0x03` bits 6-7.
An absent card normally reads as `0xFF`; writes are ignored.

### Video paging register, ports `0x0C-0x0F`

The four ports are mirrors. Let the written value be `V`. The register affects
TVC 64K+ machines only.

| Use | Bits | Selection |
| --- | --- | --- |
| Video RAM mapped into page 1 | `V & 0x03` | `0`: VID0, `1`: VID1, `2`: VID2, `3`: VID3 |
| Video RAM mapped into page 2 | `(V >> 2) & 0x03` | `0`: VID0, `1`: VID1, `2`: VID2, `3`: VID3 |
| Video RAM displayed by the video circuit | `(V >> 4) & 0x03` | `0`: VID0, `1`: VID1, `2`: VID2, `3`: VID3 |

CPU-visible video memory and displayed video memory are selected independently.
This allows drawing into one bank while another bank is being scanned out.

## I/O Map

### Summary

| Port | Read | Write |
| --- | --- | --- |
| `0x00` | unspecified | border color |
| `0x02` | unspecified | main memory paging |
| `0x03` | unspecified | keyboard row and expansion memory slot |
| `0x04` | unspecified | sound divisor bits 0-7 |
| `0x05` | unspecified | sound divisor bits 8-11, sound controls, cassette motors |
| `0x06` | unspecified | video mode, sound amplitude, printer strobe/ack control |
| `0x07` | unspecified | clear shared cursor/sound interrupt |
| `0x0C-0x0F` | unspecified | 64K+ video paging |
| `0x10-0x1F` | slot 0 registers | slot 0 registers |
| `0x20-0x2F` | slot 1 registers | slot 1 registers |
| `0x30-0x3F` | slot 2 registers | slot 2 registers |
| `0x40-0x4F` | slot 3 registers | slot 3 registers |
| `0x50-0x57` | toggle cassette output, return bus value | toggle cassette output |
| `0x58` | selected keyboard row | expansion interrupt/configuration control |
| `0x59`, `0x5D` | interrupt and system status | expansion interrupt/configuration control |
| `0x5A`, `0x5E` | expansion type identifiers | expansion interrupt/configuration control |
| `0x5B`, `0x5F` | restart sound divider/counter | expansion interrupt/configuration control |
| `0x60-0x63` | unspecified | palette registers 0-3 |
| `0x70-0x7F` | mirrored CRTC access | mirrored CRTC access |

Not all write-side expansion interrupt controls are currently characterized in
this document. Emulator authors should preserve unknown bits and avoid deriving
new hardware claims from rtvc's current no-op handling of those writes.

### Port `0x03`

```text
bits 0-3  keyboard matrix row, 0-10
bits 4-5  not described here
bits 6-7  expansion card selected for the EXT memory window
```

The expansion I/O ranges are fixed per slot and are not affected by bits 6-7.

### Status ports `0x59` and `0x5D`

```text
bit 7  printer ACK/status
bit 6  color/monochrome monitor status
bit 5  cassette input level (ECIN)
bit 4  shared cursor/sound interrupt, active low
bits 0-3 expansion slot interrupt inputs, active low
```

The two addresses are mirrors.

### Expansion identification, `0x5A` and `0x5E`

The status byte contains a two-bit card type for each slot:

```text
bits 1-0  slot 0
bits 3-2  slot 1
bits 5-4  slot 2
bits 7-6  slot 3
```

An unoccupied slot reports type `3` (`11b`). The HBF card reports type `2`
(`10b`).

## Interrupt System

The status bits in port `0x59`/`0x5D` are active low:

| Bit | Source |
| --- | --- |
| 0 | expansion slot 0 |
| 1 | expansion slot 1 |
| 2 | expansion slot 2 |
| 3 | expansion slot 3 |
| 4 | shared CRTC cursor or sound timer |

The CRTC cursor output and sound timer share bit 4 and the CPU interrupt input.
Software must use its own device state and timing expectations to determine the
source.

The usual frame interrupt is not generated by the CRTC VSYNC output. Firmware
programs the CRTC cursor address and cursor raster line so that CURSOR becomes
active at the final byte of the visible picture. That pulse requests the shared
interrupt at approximately 50 Hz.

Writing any value to port `0x07` acknowledges and clears the shared bit-4
request. Expansion cards have card-specific acknowledgement rules.

An emulator must keep the request latched until acknowledged. It should present
the request to the Z80 according to normal Z80 interrupt-enable and interrupt
mode behavior; a request is not lost merely because interrupts are temporarily
disabled.

## Video System

### TVC use of the MC6845

The MC6845 supplies character/raster counters, memory addresses, display enable,
sync, and cursor timing. It does not define TVC pixel formats or colors. TVC
logic:

1. transforms the CRTC memory and raster address into a 14-bit VRAM address;
2. reads one byte from the selected display VRAM bank;
3. serializes that byte according to the TVC video mode;
4. maps pixel values through four palette registers or direct 16-color bits;
5. uses the CRTC CURSOR output as an interrupt source.

Generic MC6845 counter and register behavior should come from a component
reference. The details below are the TVC-specific connection.

### CRTC ports

Only address line A0 reaches the CRTC, so the pair is mirrored:

```text
0x70, 0x72, ... 0x7E  CRTC address register
0x71, 0x73, ... 0x7F  selected CRTC data register
```

The TVC hardware documentation permits CPU reads of the start-address pair
R12-R13. R14-R15 are readable/writable cursor address registers; R16-R17 are
read-only light-pen latches. Reads of write-only registers should return an
open-bus value such as `0xFF`. High address-register values are not valid CRTC
register selections.

### Normal firmware CRTC programming

The operating system initializes the MC6845 through ports `0x70` and `0x71`.
The following values explain the normal TVC display geometry and cursor
interrupt setup. They are useful as a reference trace, not immutable hardware
constants.

| Register | TVC value | MC6845 meaning | TVC use/comment |
| --- | ---: | --- | --- |
| R0 | 99 | Horizontal total, in character clocks, minus one | 100 character clocks per line |
| R1 | 64 | Horizontal displayed character count | 64 displayed bytes, 512 source pixels |
| R2 | 75 | Horizontal sync position | Places TVC horizontal timing relative to the displayed area |
| R3 | `0x32` | Sync width register | TVC uses the horizontal field for blanking/sync timing; vertical sync width is not taken directly from the CRTC |
| R4 | 77 | Vertical total, in character rows, minus one | 78 character rows per generated frame before vertical adjust |
| R5 | 2 | Vertical total adjust, in scanlines | Adds 2 scanlines to the frame |
| R6 | 60 | Vertical displayed character-row count | 60 displayed character rows, 240 active scanlines |
| R7 | 66 | Vertical sync position | Places vertical sync after the active display |
| R8 | 0 | Interlace mode and display/cursor skew | Non-interlaced operation; skew features are not used |
| R9 | 3 | Maximum raster address within a character row | Four scanlines per displayed character row |
| R10 | 3 | Cursor start raster address plus cursor mode bits | Cursor starts on raster line 3; cursor output is used as a timing interrupt source |
| R11 | 3 | Cursor end raster address | Same as R10 so the cursor pulse is one scanline high |
| R12-R13 | 0 | Start address: first CRTC refresh-memory address after vertical blanking | Display begins at TVC video memory address 0 |
| R14-R15 | `0x0EFF` | Cursor address: CRTC refresh-memory address compared against MA | Startup firmware uses this address with R10/R11 to request the normal frame interrupt |
| R16-R17 | read-only | Light pen address latch | Routed to the expansion connector; not used by normal TVC firmware |

These values yield `(77 + 1) * (3 + 1) + 2 = 314` generated scanlines.

With the normal 64-byte line width, the final displayed character address is:

```text
(60 displayed character rows * 64 characters per row) - 1 = 3839 = 0x0EFF
```

Splitting this CRTC memory address into cursor registers gives `R14=0x0E` and
`R15=0xFF`. Since `R9=3` and `R10=3`, this cursor position requests the normal
shared interrupt on raster line 3 of the last displayed character row: the last
active scanline.

Do not assume all running software keeps this cursor address. For example, the
checked-in clean VT-DOS boot snapshot (`snapshots/boot12dos.rtvcsnap.zip`)
currently contains `R14-R15 = 0x0AFF` with the same `R10=3`, which places the
cursor interrupt at character row 43, column 63, raster line 3. This value is
programmed by the VT-DOS disk ROM while it is temporarily mapped at `0xC000`;
the routine writes CRTC registers from a DOS table rather than leaving the
startup firmware's `0x0EFF` cursor address intact.

The difference is visible to raster-timed code. A program that changes the
border or palette from the cursor interrupt and expects the interrupt on the
last active paper line behaves correctly after the plain firmware setup, but
will trigger much earlier after VT-DOS has changed R14-R15 unless the program
reprograms the CRTC itself. Games and ports that inherit the current CRTC state
must either tolerate the live cursor position or explicitly restore the
expected CRTC cursor registers.

### VRAM address wiring

Let:

- `MA` be the low 12 bits of the CRTC memory address;
- `RA` be the raster address within the character row.

The physical offset in a 16 KiB video bank is:

```text
vram = ((RA & 0x03) << 6)
     |  (MA & 0x003F)
     | ((MA & 0x0FC0) << 2)
```

Equivalently, VRAM bits 0-5 receive MA0-MA5, bits 6-7 receive RA0-RA1,
and bits 8-13 receive MA6-MA11.

With the normal 64-byte line width, each group of four adjacent raster lines is
stored in one contiguous 256-byte block:

```text
row 0 raster 0: offsets 0x0000-0x003F
row 0 raster 1: offsets 0x0040-0x007F
row 0 raster 2: offsets 0x0080-0x00BF
row 0 raster 3: offsets 0x00C0-0x00FF
row 1 raster 0: offsets 0x0100-0x013F
...
```

At the published normal cursor position, `MA=0x0EFF` and `RA=3` produce VRAM
offset `0x3BFF`, the final byte of the 512 x 240 picture.

### Video mode, port `0x06` bits 0-1

| Bits | Mode | Pixels per byte | Color source |
| --- | --- | ---: | --- |
| `00` | 2-color | 8 | palette entries 0-1 |
| `01` | 4-color | 4 | palette entries 0-3 |
| `10` | 16-color | 2 | pixel contains direct IGRB color |
| `11` | 16-color | 2 | same serializer class as mode 2 |

#### Two-color byte

Bits are emitted from bit 7 to bit 0. A zero selects palette 0 and a one
selects palette 1.

#### Four-color byte

The two bits of each pixel are split between nibbles:

```text
pixel 0 = (bit3 << 1) | bit7
pixel 1 = (bit2 << 1) | bit6
pixel 2 = (bit1 << 1) | bit5
pixel 3 = (bit0 << 1) | bit4
```

#### Sixteen-color byte

The left pixel uses odd-numbered bits and the right pixel uses even-numbered
bits:

```text
left  = [bit7 intensity, bit5 green, bit3 red, bit1 blue]
right = [bit6 intensity, bit4 green, bit2 red, bit0 blue]
```

Each source pixel is normally repeated horizontally so every fetched byte
occupies eight output pixel periods in all three modes.

### Palette and color encoding

Ports `0x60-0x63` hold palette entries 0-3. TVC color values use:

```text
bit 6  intensity
bit 4  green
bit 2  red
bit 0  blue
```

The unused alternating bits are ignored for palette colors. Intensity clear
means the dim level; intensity set means the bright level. A digital renderer
may use `0x7F` and `0xFF` for the two nonzero channel levels.

Port `0x00` sets the border color. Bits 7, 5, 3, and 1 of the written value are
the significant intensity, green, red, and blue bits; each is duplicated into
the adjacent low bit in the internal border register:

```text
value written         = IxGxRxB
border register value = IIGGRRBB
```

### Output pipeline, blanking, and sync

The CRTC does not drive a television directly. Its MA/RA, display-enable,
horizontal-sync, and vertical-sync outputs feed the TVC display circuitry:

1. MA/RA select a video-memory byte and the color shifter serializes it;
2. the palette or direct-color path resolves that byte to final IGRB levels;
3. display enable controls the WSE border flip-flop, selecting paper while DE
   is active and the border latch otherwise;
4. NVRCL clears the final video register during horizontal or vertical
   retrace;
5. the raw CRTC HS and VS outputs trigger separate SN74LS123 monostables, whose
   outputs are the externally shaped horizontal and vertical sync signals;
6. the shaped sync signals are combined by a NOR gate to form active-low
   composite sync (NCSYNC) for the PAL/RGB output circuitry.

Vertical blanking is latched when VS starts. CRTC address output MA9 resets the
blanking latch and permits video again. This makes blanking a property of the
TVC circuitry driven by CRTC signals, rather than a palette color or an
implicit range of normal firmware register values.

Software may reprogram the CRTC. The counters and address generator continue
to run even when a programmed sync-position comparison is unreachable; that
output simply produces no pulse. A television-facing emulator must therefore
derive picture lock from the shaped output sync signals, not from R0/R2 or
R4/R7 values and not from the normal 100-by-314 firmware geometry.

### Cursor interrupt

The hardware cursor is primarily used as a timing signal. Normal software
draws its text and visible cursor into bitmap memory itself. R14-R15 and the
cursor raster setting define where CURSOR requests the shared interrupt.
Startup firmware documents the cursor at the final byte of the active display,
but software may move it; an emulator must derive the interrupt position from
the live CRTC registers rather than from a fixed frame boundary.

VT-DOS is a normal example of such software-visible state: it may leave
R14-R15 at `0x0AFF`, moving the shared cursor/sound interrupt from the last
active paper line to row 43. Programs that do not reprogram the CRTC inherit
that timing.

An emulator that only raises an interrupt at a fixed host-frame boundary will
miss programs that change CRTC geometry or time raster work from the cursor
pulse.

### Interlace, skew, and light pen

Normal TVC output is non-interlaced. CRTC interlace and skew behavior is
component-variant-sensitive and uncommon in TVC software. The light-pen strobe
is routed to the expansion connector and should latch the current refresh
address into R16-R17 when implemented.

## Keyboard

The keyboard is an 11 x 8 active-low matrix:

- write the row number to port `0x03` bits 0-3;
- read the eight column bits from port `0x58`;
- a zero bit means pressed;
- a one bit means released;
- an invalid/unconnected row reads `0xFF`.

### Matrix

| Row | C0 | C1 | C2 | C3 | C4 | C5 | C6 | C7 |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | `5` | `3` | `2` | `0` | `6` | `í` | `1` | `4` |
| 1 | `^` | `8` | `9` | `ü` | `*` | `ó` | `ö` | `7` |
| 2 | `t` | `e` | `w` | `;` | `z` | `@` | `q` | `r` |
| 3 | `]` | `i` | `o` | `ő` | `[` | `ú` | `p` | `u` |
| 4 | `g` | `d` | `s` | `\` | `h` | `<` | `a` | `f` |
| 5 | Backspace/Delete | `k` | `l` | `á` | Return | `ű` | `é` | `j` |
| 6 | `b` | `c` | `x` | Shift | `n` | Lock | `y` | `v` |
| 7 | Alt | `,` | `.` | Esc | Ctrl | Space | `-` | `m` |
| 8 | - | Up | Down | Tab/Fire | - | Right | Left | - |
| 9 | implementation/source reference required | | | | | | | |
| 10 | implementation/source reference required | | | | | | | |

Rows 9-10 are part of the electrical scan range but are not yet fully
documented in this reference. Do not infer missing physical keys from a host
keyboard mapping table.

Host keyboard auto-mapping, Unicode input, AltGr handling, and stuck-key
prevention are emulator UI concerns and are documented in
[rtvc.md](rtvc.md#keyboard-input).

## Sound and Timer

### Registers

The sound path uses three writes:

```text
port 0x04 bits 0-7   frequency divisor low byte
port 0x05 bits 0-3   frequency divisor high nibble
port 0x05 bit 4      route timer oscillator to amplitude control
port 0x05 bit 5      enable timer interrupt
port 0x06 bits 2-5   four-bit amplitude/DAC value
```

Let `n` be the 12-bit divisor:

```text
n = ((port05 & 0x0F) << 8) | port04
```

The audible oscillator frequency is:

```text
f = 3,125,000 / 16 / (4096 - n)
  = 195,312.5 / (4096 - n) Hz
```

`n = 0xFFF` stops the oscillator.

### Divider and output

The programmable stage counts `4096-n` CPU clocks. Its carry advances a
four-bit counter. Bit 3 of that counter is the square-wave output, producing
eight low carries followed by eight high carries.

When port `0x05` bit 4 is set, that square wave gates the four-bit amplitude.
When bit 4 is clear, the amplitude value is presented directly as a DAC level,
allowing software-generated stepped waveforms.

The physical audio path is unipolar before AC coupling. A faithful audio output
model should remove DC rather than treating a static DAC level as permanent
speaker displacement.

### Timer restart and interrupt

Reading port `0x5B` or `0x5F`:

- reloads the programmable divider from the current divisor;
- clears/restarts the four-bit counter phase;
- returns an unused/open-bus value.

If port `0x05` bit 5 is enabled, a full wrap of the four-bit counter requests
the shared cursor/sound interrupt. The cassette firmware uses this as a roughly
20 ms timing source with an appropriate divisor.

## Cassette Interface

The cassette hardware is intentionally simple; ROM software performs the
modulation and decoding.

### Input

The amplified, squared cassette input appears as ECIN at status-port bit 5:

```text
IN 0x59 or 0x5D
bit 5 = current cassette input level
```

Loading software measures transition intervals to distinguish the FSK tones.
For cycle-accurate emulation, change bit 5 at the recorded pulse boundaries,
not at audio-buffer boundaries.

### Output

Any I/O access, read or write, to `0x50-0x57` toggles the cassette output
flip-flop. Software controls the interval between toggles to generate the
recording waveform.

### Motor

Port `0x05` bits 6 and 7 drive the cassette motor-control outputs. The tape
transport advances while either output is active:

```text
motor_on = (port05 & 0xC0) != 0
```

An emulator should freeze tape position while both bits are clear.

## Expansion System

The TVC has four logical expansion slots.

### I/O windows

| Slot | I/O range | Card-local register |
| ---: | --- | --- |
| 0 | `0x10-0x1F` | low nibble |
| 1 | `0x20-0x2F` | low nibble |
| 2 | `0x30-0x3F` | low nibble |
| 3 | `0x40-0x4F` | low nibble |

Each slot receives 16 card-local port offsets. Missing devices normally read
`0xFF` and ignore writes.

### Memory window

Only one card at a time appears in the `0xC000-0xDFFF` EXT window. Port `0x03`
bits 6-7 select slots 0-3. The `0xE000-0xFFFF` half remains EXTH ROM.

### Interrupts and identification

Each slot has one active-low status/interrupt bit in port `0x59`/`0x5D`.
Port `0x5A`/`0x5E` reports the two-bit card type identifiers described in the
I/O map.

## HBF Floppy Interface

The HBF card normally occupies slot 0 and provides VT-DOS boot support. It
contains:

- a 16 KiB ROM divided into four 4 KiB pages;
- 4 KiB private RAM;
- an FD1793-compatible floppy controller;
- drive/side control and fast status logic.

Generic FD1793 command timing and status semantics should come from the
controller datasheet. The following is the HBF-specific connection.

### HBF memory window

When HBF is the selected EXT card:

```text
0xC000-0xCFFF  selected 4 KiB page of the 16 KiB HBF ROM
0xD000-0xDFFF  HBF private RAM
```

ROM writes are ignored. Private RAM is read/write.

### HBF I/O registers

The table gives card-local offsets. Add the slot base, normally `0x10`.

| Offset | Read | Write |
| ---: | --- | --- |
| 0 | FDC status; acknowledges/clears INTRQ as defined by card/controller | FDC command |
| 1 | FDC track | FDC track |
| 2 | FDC sector | FDC sector |
| 3 | FDC data; transfer handshake affects DRQ | FDC data |
| 4 | fast status: bit 7 DRQ, bit 0 INTRQ | HBF drive parameter register |
| 8 | unspecified | HBF ROM page selector |

### Drive parameter register, offset 4 write

```text
bit 7    side select
bit 6    motor on
bit 5    density control (DDEN)
bit 4    head-load control
bits 3-0 drive selects DS3-DS0
```

### ROM page selector, offset 8 write

```text
bits 5-4 = 00 ROM page 0
bits 5-4 = 01 ROM page 1
bits 5-4 = 10 ROM page 2
bits 5-4 = 11 ROM page 3
```

## CAS Cassette Representation

This section describes the common TVC `.cas` preservation format and the
waveform produced by the historical converter. It is a media representation,
not a register-level hardware requirement.

### Container layout

A normal CAS file has a 144-byte file header followed by payload:

```text
offset 0x000-0x07F  128-byte block/file metadata
offset 0x080-0x08F  16-byte application metadata
offset 0x090...      payload
```

The total encoded file size is derived from header words:

```text
file_size = block_count * 128 + final_block_bytes
payload_size = file_size - 144
```

Bytes are serialized least-significant bit first.

### Reference pulse lengths

The following pulse lengths reproduce the established 44.1 kHz `cas2wav`
conversion at a 3.125 MHz CPU time base:

| Signal | High half | Low half | Period |
| --- | ---: | ---: | ---: |
| pilot/pre-sound | 638 cycles | 638 cycles | 1,276 cycles |
| sync | 1,205 cycles | 1,205 cycles | 2,410 cycles |
| data bit 0 | 779 cycles | 779 cycles | 1,558 cycles |
| data bit 1 | 567 cycles | 567 cycles | 1,134 cycles |

A nominal second of silence in the historical converter is 22,052 samples,
which is slightly different from exactly 44,100 samples.

### CRC

The tape format uses a bitwise 16-bit CRC:

```text
crc = 0

for each data bit:
    carry = ((((crc >> 8) & 0xFF) XOR (bit ? 0x80 : 0x00)) & 0x80) != 0
    if carry: crc = crc XOR 0x0810
    crc = (crc << 1) & 0xFFFF
    if carry: crc = crc OR 1
```

### Header block

```text
2 nominal seconds silence
10,240 pilot pulses
1 sync pulse
0x00, excluded from CRC
CRC reset
0x6A start
0xFF header block type
0x11 non-buffered flag
0x00 write-protection flag
0x01 sector count
0x00 sector number
header-sector byte count
filename length
filename, up to 16 bytes
0x00 filler
file type
payload length, little-endian
autostart byte
10 filler bytes
version
last-sector flag
CRC, little-endian
5 pilot pulses
```

Historical converter compatibility includes a one-byte-over metadata read and
writes zero for the generated autostart field. Emulator authors seeking exact
compatibility with existing WAVs should account for that behavior.

### Data block and sectors

```text
1 nominal second silence
5,120 pilot pulses
1 sync pulse
0x00, excluded from CRC
CRC reset
0x6A start
0x00 data block type
0x11 non-buffered flag
0x00 write-protection flag
sector count
```

Each sector then contains:

```text
sector number
size byte: 0 means 256 bytes, otherwise exact final-sector size
payload bytes
filler: 0x00 after a full sector, 0xFF after a partial sector
CRC, little-endian
```

Sector 1 continues the CRC from the data-block header. CRC resets before each
later sector. The stream ends with five pilot pulses and two nominal seconds of
silence.

## Raw DSK Images

TVC-DOS disk images commonly use flat sector dumps. Geometry can be obtained
from a FAT12-compatible boot sector:

```text
offset 11-12  bytes per sector
offset 19-20  total sectors
offset 21     media descriptor (`F8` for 360 KiB, `F9` for 720 KiB)
offset 24-25  sectors per track
offset 26-27  number of heads
```

For zero-based track and side and one-based sector:

```text
byte_offset =
    (track * sectors_per_track * heads
     + side * sectors_per_track
     + sector - 1)
    * bytes_per_sector
```

The HBF/FD1793 interface still exposes controller-level transfers; parsing a
flat image is an emulator storage decision.

## System ROM Placement

The logical ROM banks are:

| Bank | Size | CPU visibility |
| --- | ---: | --- |
| SYS | 16 KiB | any page selected as SYS |
| CART | 16 KiB | page 0 or page 3 when selected |
| EXTH | 8 KiB | `0xE000-0xFFFF` when page 3 selects EXT |

Common dumped filenames used by rtvc are included only to clarify placement:

| Firmware | Placement |
| --- | --- |
| `TVC12_D4.64K` | SYS low 16 KiB image |
| `TVC12_D3.64K` | SYS upper 8 KiB overlay at bank offset `0x2000` |
| `TVC12_D7.64K` | EXTH |
| `TVC22_D6.64K` | SYS low 16 KiB image |
| `TVC22_D4.64K` | SYS upper 8 KiB overlay at bank offset `0x2000` |
| `TVC22_D7.64K` | EXTH |
| `VT-DOS12-DISK.ROM` | HBF card ROM |

These names are preservation conventions, not hardware identifiers.

## Minimum Emulator Model

A practical first implementation should:

1. run a conforming Z80 core at a 3.125 MHz logical clock;
2. implement all four 16 KiB memory windows and both paging registers;
3. route the complete low-byte I/O map, including mirrors;
4. advance the MC6845 by one character clock per two CPU T-states;
5. apply the TVC VRAM address transform and three pixel serializers;
6. latch and acknowledge the active-low shared interrupt correctly;
7. scan the active-low keyboard matrix;
8. advance sound and tape state from elapsed CPU cycles;
9. provide absent expansion bus values and HBF routing when configured.

A frame-at-once renderer can boot ordinary software, but raster effects and
cursor-interrupt timing require interleaved CRTC advancement.

## Accuracy-Sensitive Behavior

- CPU-visible and displayed video banks are independent on TVC 64K+.
- CRTC ports are mirrored throughout `0x70-0x7F`.
- The CRTC cursor, not VSYNC, is the normal frame interrupt source.
- Cursor and sound timer share one active-low pending bit.
- Tape input and output transitions are CPU-cycle-sensitive.
- Reading `0x5B`/`0x5F` changes sound timer phase.
- Any read or write in `0x50-0x57` toggles cassette output.
- The EXT page is split: card memory below `0xE000`, EXTH ROM above it.
- Unknown or unimplemented hardware behavior should remain visibly marked as
  uncertain instead of being inferred from a single emulator.

## External Component References

- [Zilog Z80 CPU User Manual](https://www.zilog.com/docs/z80/um0080.pdf)
- Motorola/compatible MC6845 datasheet for generic CRTC counter and register
  behavior
- Western Digital FD1793 datasheet for generic floppy-controller commands,
  timing, and status semantics
- Original TVC hardware manuals and schematics for electrical details and
  expansion signals

This reference should be updated when a TVC-specific behavior is verified or
corrected. Generic component material should remain in the component manuals.
