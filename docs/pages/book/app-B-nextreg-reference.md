# Appendix B: NextReg Reference

The original Spectrum gave you half a dozen ports to poke at. The ZX Spectrum Next extends that with the **NextRegs**: a bank of hardware registers addressed from `0x00` to `0xFF`. Not all 256 addresses are used—many are reserved, some are gaps, and a few are write-only sentinels that exist only to protect against hardware conflicts. The registers that are implemented form a dense, organized control surface for everything the Next adds beyond the original hardware.

Think of NextRegs as the control panel for the FPGA. Want full-color graphics? There's a register for that. Want your sprites to appear over the border? A register for that too. Need to set the CPU running at 28 MHz, then interrupt once per scanline, while a co-processor handles palette animations in the background? Yes—all of that lives in NextRegs.

This reference organizes registers by what you can *do* with them, not just what number they are. Flipping through a register list sorted by address is about as useful as reading a dictionary to find a recipe. Instead, each section here covers a specific capability and explains which registers you need to achieve it.

## How to Access NextRegs

Two I/O ports form the gateway:

- **Port `0x243B`** — write the register number here to select it
- **Port `0x253B`** — read or write the register value here

### Writing a Register

The port method works everywhere—including in 48K mode or on any hardware where the Z80N extended instructions aren't available:

```z80klive
ld bc,$243b    ; point to the register select port
ld a,$07       ; register number (CPU speed)
out (c),a
inc b          ; point to the value port
ld a,$02       ; value: 14 MHz
out (c),a
```

The Z80N instruction set adds two faster alternatives that fold the select and write into a single instruction:

```z80klive
nextreg $07,$02   ; select register 0x07 and write 0x02 in one shot
nextreg $07,a     ; write whatever is in A to register 0x07
```

`nextreg` is the idiomatic way to configure hardware in Next-specific code—cleaner, faster, and easier to read than the port sequence.

### Reading a Register

There is no `nextreg` form for reads—the Z80N instruction set only covers writes. To read a register value back, you always use the ports:

```z80klive
ld bc,$243b    ; point to the register select port
ld a,$07       ; register number (CPU speed)
out (c),a
inc b          ; point to the value port
in a,(c)       ; read the current value into A
```

The select port (`0x243B`) remembers the last written register number, so if you've just written to a register via the port method, you can skip the select step and read straight from `0x253B`. Don't rely on this across interrupt boundaries though—an ISR that touches NextRegs will clobber the selection.

> **Reset behavior**: Every register has a defined reset state. Hard reset (power-on, F1, or writing `0x02` with bit 1) restores everything to factory defaults. Soft reset (F4 key or writing `0x02` with bit 0) restores a slightly different subset—some hardware settings survive a soft reset, others don't. Register descriptions below note which applies.

## What's in Here

Rather than listing registers by number, this reference groups them by what you can accomplish with them. Here's the map:

- **System Identity and Control** — Identify the hardware, reset the machine, choose CPU speed and machine type, boot alternate cores.
- **Memory Management** — Map any 8KB page of the 2MB address space into the Z80's 64KB window; control legacy 128K paging and alternate ROMs.
- **Video: The Layer System** — Set the rendering order for Sprites, Layer 2, and ULA; configure global transparency and the fallback color.
- **Video: Layer 2** — Full-color 256×192 (or higher) bitmap display: assign RAM banks, choose resolution, scroll in hardware.
- **Video: ULA and LoRes** — Hardware scroll the classic ULA display, enable ULA+, stencil mode, LoRes and Radastan modes.
- **Video: Sprites** — Select and stream attributes for up to 128 independent hardware sprites.
- **Video: Tilemap** — Hardware-managed grid of up to 512 tiles: configure layout, memory locations, and smooth scrolling.
- **Palettes and Colors** — Load 8- or 9-bit colors into any of the eight palettes (two per layer), enable ULANext, swap palettes instantly.
- **Clip Windows** — Restrict any layer to a sub-rectangle of the display for split-screen and HUD effects.
- **The Copper Co-Processor** — Load and run a raster-synchronized program that modifies NextRegs in sync with the video beam, frame after frame, without touching the CPU.
- **Audio** — Select AY/YM chip mode, enable TurboSound (three AY chips), write directly to the four 8-bit DACs, configure I²S audio from the Raspberry Pi.
- **Interrupts** — Enable hardware IM2 mode with automatic vector generation, set per-scanline line interrupts, manage ten interrupt sources, configure stackless NMI.
- **Peripheral Settings** — Joystick modes, scandoubler, contention, hotkeys, mouse DPI, speaker routing, and more.
- **Input: Keyboard and Key Reading** — Reprogram the PS/2 keymap, read extended and cursor keys not in the original 8×5 matrix.
- **DivMMC and Storage** — Control which ROM addresses trigger transparent SD card automapping for ESXDOS/NextZXOS.
- **Expansion Bus** — Enable the edge connector, filter which ports reach external hardware, propagate internal state to bus peripherals.
- **Raspberry Pi and GPIO** — Drive GPIO pins, enable UART/I²C/SPI on the Pi connector, configure I²S audio direction and ESP Wi-Fi GPIO.
- **Debugging** — I/O traps for +3 FDC ports; XADC temperature/voltage monitoring and Xilinx DNA serial ID (Issue 4 boards only).

## System Identity and Control

These registers tell you what machine you're running on, and let you control the most fundamental operations: reset, machine type, and boot behavior.

### What Machine Is This? (`0x00`, `0x01`, `0x0E`, `0x0F`)

Before you start poking hardware registers, it's sometimes worth checking what hardware you're actually talking to. Emulators and physical boards present the same register interface, but their IDs differ.

**Register `0x00` — Machine ID** (read-only)

Identifies the platform:

| Value | Platform |
|-------|----------|
| `0x08` | Emulator |
| `0x0A` | ZX Spectrum Next (physical hardware) |
| `0xFA` | ZX Spectrum Next Anti-brick |
| `0x9A`–`0xEA` | Next core on third-party FPGA boards (UnAmiga, SiDi, MIST, MiSTer, ZX-DOS) |

If your code needs to behave differently on emulators versus real hardware, read this register first. Note that emulators report `0x08` regardless of which emulator they are.

**Register `0x01` — Core Version** (read-only)

Bits 7:4 hold the major version number, bits 3:0 hold the minor version. Read `0x0E` for the sub-minor version. Together these form a three-part version like *3.1.5* where `0x01` contains `0x31` and `0x0E` contains `0x05`.

**Register `0x0F` — Board ID** (read-only)

Identifies the hardware revision:
- `0x00` / `0x01` — Issue 2 or 3 board (Xilinx Spartan-6 FPGA)
- `0x02` — Issue 4 board (Xilinx Artix-7 FPGA, more resources)

Some features (like the XADC diagnostic interface at `0xF0`–`0xFA`) are Issue 4 only.

### Resetting the Machine (`0x02`)

**Register `0x02` — Reset**

Reading this tells you what kind of reset last occurred:
- Bit 1 set: last reset was a hard reset
- Bit 0 set: last reset was a soft reset
- Bits 2–4: whether NMIs from DivMMC, Multiface, or an I/O trap triggered the reset

Writing triggers resets and NMIs:
- Bit 1: generate a **hard reset** (reboots completely, restores all hard-reset defaults)
- Bit 0: generate a **soft reset**
- Bit 2: generate a DivMMC NMI
- Bit 3: generate a Multiface NMI
- Bit 7: assert and hold reset on the expansion bus and ESP Wi-Fi module

The typical "restart cleanly" pattern is just writing `0x02` to this register. Hard reset—bit 1—takes priority if you set both bits.

### Machine Type and Display Timing (`0x03`, `0x24`)

**Register `0x03` — Machine Type**

The Next can pretend to be several different Spectrum models—not just for nostalgia, but because some software depends on specific port decoding and memory contention behavior.

Writing to this register also **disables the boot ROM**, which is the normal step after initialization is complete.

Bits 2:0 select the emulated machine (only writable during config mode):
- `001` — ZX Spectrum 48K
- `010` — ZX Spectrum 128K/+2
- `011` — ZX Spectrum +2A/+2B/+3
- `100` — Pentagon

Bits 6:4 set display timing (you need bit 7 set to change these):
- `001` — ZX 48K timing
- `010` — ZX 128K/+2 timing
- `011` — ZX +2A/+2B/+3 timing
- `100` — Pentagon timing (forces 50 Hz)

Why does display timing matter? Because contention—the ULA stealing CPU cycles during screen memory access—is different across models. Running 128K software on 48K timing causes subtle speed differences. Programs that rely on precisely timed loops to generate audio or video effects care deeply about this.

**Register `0x24` — Reserved (Port Conflict Protection)**

This register exists to prevent an obscure conflict with the Disciple Disk Interface, which uses I/O port `0x3B`. Because writing to port `0x3B` in the Disciple's protocol could accidentally select a NextReg, `0x24` acts as a decoy: in 48K and 128K legacy modes, the internally selected NextReg is automatically forced to `0x24` whenever an `OUT (0x3B),A` instruction executes. Writes to `0x24` are silently discarded, reads return nothing meaningful. The hardware protects itself from Disciple-style I/O automatically—you never need to write to `0x24` yourself.

### Core Selection and Boot (`0x10`)

**Register `0x10` — Core Boot**

The Next FPGA holds multiple "cores"—complete hardware designs that take over the machine. The default core is the ZX Spectrum Next. Other cores might implement a Sinclair QL, a Commodore 64, or custom hardware.

Reading tells you the currently selected core ID and whether the DRIVE (DivMMC) or M1 (Multiface) buttons are physically pressed.

Writing selects and launches a core:
- Bits 4:0 select the core ID (0–31, config mode only)
- Bit 7 starts the selected core

Writing an out-of-range core ID is safely ignored—it's the documented way to probe the maximum supported ID. Keep writing IDs until you get no response, and you've found the limit.

### CPU Speed (`0x07`)

**Register `0x07` — CPU Speed**

The Next can run its Z80 at four different speeds. Reading gives you both the *programmed* speed (bits 1:0) and the *actual current* speed (bits 5:4)—these differ when the expansion bus is active and forces a lower clock.

Writing bits 1:0:
- `00` — 3.5 MHz (stock Spectrum speed, maximum legacy compatibility)
- `01` — 7 MHz (double speed, good balance for enhanced software)
- `10` — 14 MHz (quad speed)
- `11` — 28 MHz (8× original, maximum performance)

Speed resets to 3.5 MHz on soft reset.

Why four speeds instead of just "fast"? A program that counts clock cycles to measure time will play at double speed if you run it at 7 MHz without telling it. Many games, demo effects, and especially tape-loading routines are timing-sensitive. Pick 28 MHz for your own code, drop to 3.5 MHz for legacy software, and change mid-program when you need precision timing for one section.

At 28 MHz the hardware automatically inserts wait states for external SRAM accesses—the memory isn't fast enough to respond without them. The CPU never notices; it just sees slightly longer memory cycles.

> **Hotkey**: The F8 key toggles CPU speed at runtime if bit 7 of NextReg `0x06` is set (it is, by default after soft reset).

---

## Memory Management

The Z80 can address 64KB. The Next has up to 2MB of RAM. Something has to bridge that gap—and that something is the MMU.

### Boot-Time Bank Mapping (`0x04`)

**Register `0x04` — Config Mapping** (write-only, config mode only)

This register exists solely to help the boot ROM get RAM into view before the full MMU is configured. In config mode—before the machine type has been selected and the boot ROM dismissed—the normal 128K paging ports aren't active yet. This register provides a simple escape hatch: bits 6:0 specify a 16K RAM bank to map into addresses `0x0000`–`0x3FFF`, overriding whatever the reset default placed there.

Once you write to `0x03` (Machine Type) to select a machine and disable the boot ROM, config mode ends and `0x04` has no further effect. From that point forward, use the MMU slot registers (`0x50`–`0x51`) to control that address range.

> **Even multiples of 256K are unreliable** if you're storing data there that another core will read after a boot—don't put anything critical at those offsets.

You'll encounter this register when writing a custom boot loader or examining how NextZXOS initializes the hardware. For normal application code, it's irrelevant—the operating system has long since moved past config mode by the time your program runs.

### The Eight Slots (`0x50`–`0x57`)

**Registers `0x50`–`0x57` — MMU Slots 0–7**

The Z80's 64KB address space is divided into eight **slots** of 8KB each:

| Register | Slot | Z80 Address Range |
|----------|------|-------------------|
| `0x50` | 0 | `0x0000`–`0x1FFF` |
| `0x51` | 1 | `0x2000`–`0x3FFF` |
| `0x52` | 2 | `0x4000`–`0x5FFF` |
| `0x53` | 3 | `0x6000`–`0x7FFF` |
| `0x54` | 4 | `0x8000`–`0x9FFF` |
| `0x55` | 5 | `0xA000`–`0xBFFF` |
| `0x56` | 6 | `0xC000`–`0xDFFF` |
| `0x57` | 7 | `0xE000`–`0xFFFF` |

Each register holds the **8KB page number** that occupies that slot. Pages run from 0 to 223 on a fully expanded Next (2MB ÷ 8KB = 256 pages, but the top 32 are reserved). Writing `255` to slots 0 or 1 makes the ROM appear there instead of RAM.

The default configuration after soft reset mirrors the 128K Spectrum layout:
- Slots 0–1: ROM (value 255)
- Slots 2–3: Page 10 (Bank 5, the ULA screen bank—addresses `0x4000`–`0x7FFF`)
- Slots 4–5: Page 4–5 (Bank 2)
- Slots 6–7: Pages 0–1 (Bank 0)

To access a physical address anywhere in the 2MB space, calculate the page number: `page = physical_address ÷ 8192`. Then write that page number to whichever slot you want to map it through. For example, to access the very end of RAM at physical address `0x1F'E000`:

```asm
; Map page 0xFF (address 0x1FE000-0x1FFFFF) into slot 6
NEXTREG 0x56, 0xFF
; Now read/write 0xC000-0xDFFF to access that physical memory
```

### Legacy 128K Memory Mapping (`0x8E`, `0x8F`)

Many existing programs use the traditional Spectrum 128K port `0x7FFD` for memory paging. The Next respects this fully—but also lets you change those mappings directly through NextRegs without issuing port writes.

**Register `0x8E` — Spectrum 128K Memory Mapping**

This is a unified view of all the legacy paging ports. Writing here has the same effect as writing to the original ports:
- Bits 6:4 — RAM bank selection (equivalent to port `0x7FFD` bits 2:0)
- Bit 7 — Extended bank bit (port `0xDFfd` bit 0), reaching banks 8–15
- Bit 2 — Paging mode: 0 = normal, 1 = all-RAM (+3 special mode)
- In normal mode: bits 1:0 select the ROM (equivalent to ports `0x1FFD`/`0x7FFD`)

Reading gives you the current state of all these port values in one shot—useful for saving/restoring context without reading three separate I/O ports.

**Register `0x8F` — Memory Mapping Mode**

Selects how ports `0x7FFD`, `0xDFFD`, `0x1FFD`, and `0xEFF7` interpret their bits:
- `00` — Standard ZX 128K/+3 behavior
- `10` — Pentagon 512K memory model
- `11` — Pentagon 1024K memory model

Use this when running software written for Pentagon clones that expects their larger memory model.

### Alternate ROM (`0x8C`)

**Register `0x8C` — Alternate ROM**

The Next lets you substitute your own ROM for the standard one. Writing bit 7 enables it; the alternate ROM is taken from DivMMC page space. You can also lock the 48K or 128K ROMs individually so they don't get swapped out.

This is primarily used by the boot ROM and operating system—but it's also how you'd implement your own custom ROM replacement or a debugging monitor that intercepts RST vectors.

---

## Video: The Layer System

The Next composites up to five overlapping visual elements—ULA, LoRes, Tilemap, Layer 2, and Sprites—into a single final image. Before diving into each layer, you need to understand how they stack and how to configure that stack.

### Layer Priority and Global Enable (`0x15`)

**Register `0x15` — Sprite and Layers System**

This single register controls the big picture of what appears on screen and in what order.

**Enabling layers:**
- Bit 0 — Enable sprites globally (sprites are invisible until this is set)
- Bit 1 — Allow sprites to appear over the border area
- Bit 7 — Enable LoRes mode (replaces standard ULA output)

**Layer priority** (bits 4:2):

The three layers—**S** (Sprites), **L** (Layer 2), and **U** (ULA, which includes Tilemap when active)—can appear in any order:

| Bits 4:2 | Order (front to back) |
|----------|----------------------|
| `000` | S → L → U |
| `001` | L → S → U |
| `010` | S → U → L |
| `011` | L → U → S |
| `100` | U → S → L |
| `101` | U → L → S |
| `110` | Blending mode (U\|T)S(T\|U)(B+L) |
| `111` | Blending mode (U\|T)S(T\|U)(B+L-5) |

The default is `000`: sprites on top, then Layer 2, then ULA at the back.

Modes `110` and `111` blend Layer 2 and ULA channel colors together, clamped to the `[0,7]` range—useful for color mixing effects.

**Sprite priority within sprites** (bit 6):
- 0 — Sprite 127 rendered on top (higher-numbered sprites win)
- 1 — Sprite 0 rendered on top (lower-numbered sprites win)

**Sprite clipping over border** (bit 5): when sprites extend into the border area, this enables the clip window to apply there too.

### Global Transparency (`0x14`, `0x4A`, `0x4B`, `0x4C`)

Every layer needs a "nothing here, show whatever is below me" color. There are several transparency registers because the layers use different color formats.

**Register `0x14` — Global Transparency Colour**

An 8-bit color value in RRRGGGBB format. Any pixel in Layer 2 or the ULA that exactly matches this color (comparing against the top 8 bits of the 9-bit palette output) becomes transparent, showing layers below. Default is `0xE3`.

This is a global setting—it applies to Layer 2, ULA, and LoRes simultaneously. If you need a different transparent color for sprites or the tilemap, use the registers below.

**Register `0x4A` — Fallback Colour**

When all layers are transparent at a pixel position—every layer shows nothing—this color fills in. It's the absolute bottom of the compositing stack. Also used as the paper/border color in ULANext's full-ink mode.

**Register `0x4B` — Sprite Transparency Index**

Sprites use palette indices, not direct colors. Any sprite pixel with this palette index (0–255, or 0–15 for 4-bit sprites) is transparent. Default `0xE3`.

**Register `0x4C` — Tilemap Transparency Index**

The tilemap's transparent palette index (just the bottom 4 bits matter since the tilemap always uses 4-bit indices). Default `0xF`.

### Active Video Line (`0x1E`, `0x1F`)

**Registers `0x1E`/`0x1F` — Active Video Line**

Reading these gives you the current raster line being generated. `0x1E` bit 0 is the MSB, `0x1F` is the LSB. Together they form a 9-bit line number. This is the software equivalent of asking "where is the electron gun right now?" Useful for the rare cases where you need raster-synchronized code without setting up a line interrupt.

---

## Video: Layer 2

Layer 2 is the Next's full-color bitmap display. Forget the ULA's 8-color-attribute system—Layer 2 gives every pixel its own color from a 256-entry palette. It's how you draw photographs, smooth gradients, and any image that would turn into a color-clash disaster on a standard Spectrum.

### Assigning Memory (`0x12`, `0x13`, `0x69`)

**Register `0x12` — Layer 2 Active RAM Bank**

Layer 2 stores its pixels in regular 16KB RAM banks—the same memory the CPU uses. This register selects which 16KB bank is the *starting* bank for the active display buffer. Since the standard 256×192×8 mode needs 48KB, Layer 2 actually occupies three consecutive 16KB banks starting from this one. Default is bank 8.

**Register `0x13` — Layer 2 Shadow RAM Bank**

The second buffer—while Layer 2 is displaying from the active bank, you can draw into the shadow bank, then swap them. Perfect for flicker-free animation. Default is bank 11. Swap the active and shadow banks by toggling bit 3 of port `0x123B`.

**Register `0x69` — Display Control 1** (bit 7)

Bit 7 is the main Layer 2 enable switch (alias of the Layer 2 control port `0x123B` bit 1). Clear Layer 2 and only the ULA is visible; set it and Layer 2 composites into the frame according to the layer priority in `0x15`.

### Resolution (`0x70`)

**Register `0x70` — Layer 2 Resolution and Palette**

Bits 5:4 select the display resolution:
- `00` — **256×192, 8bpp** (standard mode, 48KB frame buffer)
- `01` — **320×256, 8bpp** (requires 80KB; uses more banks)
- `10` — **640×256, 4bpp** (doubled horizontal, 80KB)

The standard 256×192 mode fits neatly into three consecutive 16KB banks. The high-resolution modes need five banks and offer more screen area—340×256 fills a 16:10 display beautifully.

Bits 3:0 are the **palette offset**: this shifts which palette entries Layer 2 uses. The full Layer 2 palette has 256 entries, but you can bias the lookup by this offset, cycling through different color ranges for palette animation effects.

### Scrolling (`0x16`, `0x17`, `0x71`)

**Registers `0x16`/`0x71` — Layer 2 X Scroll** (LSB and MSB)

The X scroll value wraps Layer 2 horizontally. Combine `0x71` bit 0 (MSB) and `0x16` (LSB) for a 9-bit offset, covering the full 320-pixel width of the high-res modes. In standard 256×192, only 8 bits matter.

**Register `0x17` — Layer 2 Y Scroll**

Vertical scroll, wrapping within the active resolution height (0–191 for standard mode). The hardware shifts the display origin without touching any pixel data—instant, zero-cost scrolling.

Scrolling Layer 2 is free. The CPU doesn't copy pixels; the compositor just starts reading the buffer at a different offset. This is how parallax background layers work: update the scroll register each frame and the background slides independently of the sprites or ULA layer above it.

---

## Video: ULA and LoRes

The ULA is the heart of every Spectrum that ever lived. The Next reproduces it faithfully—complete with color attributes, contention, and all the behaviors decades of software depend on. But it also gives you direct control over the ULA that the original never offered.

### Scrolling the ULA (`0x26`, `0x27`)

**Register `0x26` — ULA X Scroll**  
**Register `0x27` — ULA Y Scroll**

Hardware scroll registers for the ULA layer. Like Layer 2, the pixel data doesn't move—just the compositor's reading window. X wraps at 256, Y at 192.

Classic Spectrum games scrolled by copying memory. Now you just write a value to `0x26` or `0x27`. No CPU cycles eating into game logic, no screen tearing from partial updates.

### ULA Control (`0x68`)

**Register `0x68` — ULA Control**

A collection of ULA-level settings:

- **Bit 7**: Disable ULA output entirely. Useful when you want only Layer 2 visible, or when blanking the screen during heavy loading.
- **Bit 3**: Enable **ULA+** mode—an alternate palette system where a separate 64-entry palette replaces the 8-color ULA defaults, giving the classic display 64 colors instead of 8.
- **Bit 2**: ULA half-pixel scroll—enables sub-pixel horizontal scrolling by activating an intermediate scroll position between whole pixels.
- **Bit 0**: Enable **stencil mode** when both ULA and Tilemap are active. Rather than one overwriting the other, stencil mode logically ANDs their colors together—creating masked cutout effects.
- **Bit 4**: Cancel extended key entries in the 8×5 key matrix—prevents extended keys from showing up as regular key presses.
- **Bits 6:5**: Blending mode selection for SLU modes 6 and 7 (from `0x15`): choose ULA, ULA/Tilemap mix, or Tilemap as the source for blending.

### LoRes Mode (`0x6A`, `0x15` bit 7, `0x32`, `0x33`)

**Register `0x6A` — LoRes Control**

LoRes is a lower-resolution ULA mode: 128×96 pixels with 2 colors per 4×8 pixel block instead of the normal 8×8. Same memory as the ULA (so you can't have both simultaneously), but tighter attribute coverage.

- **Bit 5**: Enable **Radastan mode** — a 128×96 display using 4bpp (16 colors per pixel instead of per block), requiring 6144 bytes. Raw color without attribute clash.
- **Bit 4**: Radastan Timex display file XOR — toggles which display file drives LoRes in Radastan mode.
- **Bits 3:0**: Palette offset for LoRes rendering.

**Registers `0x32`/`0x33` — LoRes X/Y Scroll**

Hardware scroll registers for LoRes, independent of the ULA scroll. LoRes scrolls in "half-pixels" at the same sub-pixel smoothness as Layer 2.

### Display Control (`0x69`)

**Register `0x69` — Display Control 1**

Bit 7 enables Layer 2 (alias of the Layer 2 port). Bit 6 enables the ULA shadow display (alias of port `0x7FFD` bit 3—using the second screen bank). Bits 5:0 alias port `0xFF` for Timex display mode selection. This register is a convenient single-address view of display configuration that's otherwise scattered across multiple ports.

### Video Timing (`0x11`)

**Register `0x11` — Video Timing** (writable in config mode only)

Selects the pixel clock frequency for VGA output or locks to HDMI:
- `000` — 28 MHz (base VGA, HDMI compatible)
- `001` — 28.571 MHz (HDMI compatible VGA variant)
- `010`–`110` — Higher VGA frequencies (up to 33 MHz)
- `111` — HDMI mode (fixed timing)

If your VGA monitor won't sync, try different timing settings. The 50/60 Hz selection comes from `0x05` bit 2.

### Vertical Line Count Offset (`0x64`)

**Register `0x64` — Vertical Line Count Offset**

Normally, the ULA's first pixel row aligns with vertical line 0 for purposes of the Copper and line interrupts. This register adds an offset, shifting the relationship. Setting it to 32 means vertical line 32 corresponds to the first ULA row—while vertical lines 0–31 correspond to the tilemap and sprite area above the ULA display.

This is how you create multi-resolution split screens: sprites and tilemaps count "raster lines" from 0, but the ULA starts partway through the frame. A non-zero offset lets the Copper fire at the right line to switch modes cleanly.

---

## Video: Sprites

Sprites are the 128 independent movable objects the Next provides. Unlike the ULA where you manually erase and redraw pixels, sprites exist outside normal memory—you write their attributes to hardware registers, and the compositor handles placement and compositing automatically.

### Selecting the Active Sprite (`0x34`)

**Register `0x34` — Sprite Number**

Everything sprite-related works on one sprite at a time. Write the sprite number (0–127) here to select which sprite subsequent attribute writes go to. Reading always returns 0 in the top bit; the bottom 7 bits reflect the last written sprite number.

When **lockstep mode** is enabled (`0x09` bit 4), writing to `0x34` simultaneously writes to port `0x303B`—keeping the two interfaces in sync if legacy code uses the port directly.

You can also address sprite patterns here when bit 7 is set in lockstep mode—the bottom 6 bits become a pattern index (0–63).

### Writing Sprite Attributes (`0x35`–`0x39`, `0x75`–`0x79`)

**Registers `0x35`–`0x39` — Sprite Attributes 0–4**

Each sprite has five attribute bytes controlling its appearance and position. Registers `0x35`–`0x39` write attributes to whichever sprite is currently selected by `0x34`. The sprite number does **not** auto-advance.

Registers `0x75`–`0x79` do the same thing but **auto-increment the sprite number** after each complete set of attributes. This lets you stream attributes for 128 sprites with a loop:

```asm
NEXTREG 0x34, 0          ; start at sprite 0
LD BC, 0x253B            ; value port
; for each sprite, write the five attribute bytes to 0x75-0x79
; after writing attribute 4 (0x79), sprite number advances automatically
```

Full attribute byte documentation covers position, palette, scaling, rotation, mirroring, visible flag, and pattern selection. See the [sprites documentation](https://www.specnext.com/sprites/) for the complete bit layout.

### Clip Window for Sprites (`0x19`)

**Register `0x19` — Clip Window Sprites**

Four consecutive writes define the sprite clip rectangle: X1, X2, Y1, Y2 (all inclusive). Sprites are clipped to this window. In "over border" mode, the X coordinates are internally doubled and the origin shifts to align with the sprite coordinate system inside the border.

Reads do not advance the clip index—only writes do.

---

## Video: Tilemap

The Tilemap gives you a hardware-managed grid of tiles—up to 256 different 8×8 tiles, arranged on a 40×32 or 80×32 grid. The CPU writes tile numbers to a map in RAM; the hardware looks up tile patterns and renders them automatically. No CPU cycles spent copying pixel data around.

### Enabling and Configuring the Tilemap (`0x6B`)

**Register `0x6B` — Tilemap Control**

- **Bit 7**: Enable the tilemap. Nothing appears until this is set.
- **Bit 6**: Select layout — 0 for 40×32 tiles, 1 for 80×32 tiles.
- **Bit 5**: Eliminate attribute entries from the tilemap. In the default two-byte format, each tile reference consists of a tile number byte plus an attribute byte (palette offset, mirroring, rotation). Setting this bit removes the attribute byte—every tile uses the default attributes from `0x6C` instead. This halves map memory usage.
- **Bit 3**: Enable **text mode** — tiles are rendered as character cells using the ULA font, suitable for terminal-style displays.
- **Bit 4**: Palette select — choose between the tilemap's two palettes.
- **Bit 1**: Enable **512 tile mode** — the attribute byte's bit 0 extends the tile number to 9 bits, giving access to 512 different tile patterns instead of 256.
- **Bit 0**: Force tilemap on top of ULA. Normally the tilemap composites behind ULA. This overrides that, letting individual tiles use ULA-over-tilemap via the attribute bit, but making the rest of the tilemap appear above ULA.

### Default Tile Attributes (`0x6C`)

**Register `0x6C` — Default Tilemap Attribute**

When attribute-less mode is enabled (`0x6B` bit 5), every tile in the map uses this attribute value:
- Bits 7:4 — Palette offset (shifts which palette entries the tile uses)
- Bit 3 — Mirror the tile horizontally
- Bit 2 — Mirror the tile vertically
- Bit 1 — Rotate the tile 90°
- Bit 0 — ULA over tilemap for this tile (or bit 8 of tile number in 512-tile mode)

### Tilemap and Tile Memory Locations (`0x6E`, `0x6F`)

**Register `0x6E` — Tilemap Base Address**

Points to where the tilemap data lives in RAM. The value in bits 5:0 represents the high byte of an address within Bank 5 (`0x4000`–`0x7FFF`) or Bank 7 (`0xC000`–`0xFFFF`, 8KB only). Think of it as: the base address = `(bit7 ? Bank7 : Bank5) + (bits5:0 << 8)`.

Default is `0x6C00` (within Bank 5).

**Register `0x6F` — Tile Definitions Base Address**

Same format as `0x6E`, but points to the pattern data—the actual pixel graphics for each tile. Each tile occupies 32 bytes (in 4bpp mode) or 16 bytes (in text mode). Default is `0x4C00`.

Separating map and pattern addresses means you can store tiles used by multiple maps in one location, and swap maps without duplicating pattern data.

### Tilemap Scrolling (`0x2F`, `0x30`, `0x31`)

**Register `0x2F`/`0x30` — Tilemap X Scroll** (MSB and LSB)

The X scroll is 10 bits total (`0x2F` bits 1:0 are MSB, `0x30` is LSB). Valid range is 0–319 in 40-character mode, 0–639 in 80-character mode. This shifts the visible window over the tile grid—hardware managed, zero CPU cost.

**Register `0x31` — Tilemap Y Scroll**

Vertical scroll, 0–255. Both X and Y scrolling wrap seamlessly.

Smooth-scrolling a tilemap background takes one register write per frame. No page flipping, no pixel copying, no wasted CPU time.

### Clip Window for Tilemap (`0x1B`)

**Register `0x1B` — Clip Window Tilemap**

Four consecutive writes: X1, X2, Y1, Y2. The X coordinates are internally doubled (because tilemap columns are 8 pixels wide, but the clip is in pixel coordinates). Default clips to 0, 159, 0, 255—the full tilemap display area.

---

## Video: Palettes and Colors

The Next's color system is more flexible than it first appears. Every graphics layer has its own palette, palettes can be swapped on the fly, and the 9-bit color depth gives you 512 possible colors—chosen from to fill 256-entry palettes.

### Selecting a Palette Entry (`0x40`)

**Register `0x40` — Palette Index**

Selects which palette entry to read or write next. The matching between index numbers and graphical elements depends on which palette is selected:

- **ULA**: Indices 0–7 are INK colors, 8–15 are Bright INK, 16–23 are PAPER, 24–31 are Bright PAPER.
- **ULANext mode**: INK colors come from indices 0–127 (how many depends on the attribute mask in `0x42`), PAPER colors from 128–255.
- **Layer 2 / Sprites / Tilemap**: Indices map directly to 8bpp or 4bpp pixel values.

### Writing Colors (`0x41`, `0x44`)

**Register `0x41` — Palette Value (8-bit)**

Write an 8-bit color in RRRGGGBB format. The hardware extends the 2-bit blue to 3 bits by OR-ing blue bits 1 and 0—so `0b11111111` becomes 9-bit `0b111111111`. After writing, if auto-increment is enabled in `0x43`, the palette index automatically advances to the next entry.

Use `0x41` for fast palette loading when you don't need precise control of the 9th bit.

**Register `0x44` — Palette Value (9-bit)**

Two consecutive writes give you full 9-bit color control:
1. First write: `RRRGGGBB` (same as `0x41`)  
2. Second write: bit 0 = the LSB of Blue

For Layer 2 palettes, the second write's bit 7 marks this entry as a **priority color**: Layer 2 pixels with this palette entry jump above *all* other layers—even sprites. This is how you create floating foreground elements using Layer 2 without needing sprites.

After two consecutive writes (or a single write to `0x41`), the index auto-increments if enabled. Writes to `0x40`, `0x41`, or `0x43` reset the two-write sequence back to the first byte.

### Choosing Which Palette to Edit (`0x43`)

**Register `0x43` — Palette Control**

Bits 6:4 select which palette's entries you're editing:

| Bits 6:4 | Palette |
|----------|---------|
| `000` | ULA first palette |
| `001` | Layer 2 first palette |
| `010` | Sprites first palette |
| `011` | Tilemap first palette |
| `100` | ULA second palette |
| `101` | Layer 2 second palette |
| `110` | Sprites second palette |
| `111` | Tilemap second palette |

Each layer has **two palettes**. You load both, then use bits 3:1 of this register to instantly switch which palette each layer uses. This is palette animation without touching palette data: preload a sunset in palette A and a moonlit version in palette B, then toggle bit 2 once per frame.

- Bit 7: Disable auto-increment of palette index after writes. Useful when you want to write the same index multiple times without the index wandering off.
- Bit 0: Enable **ULANext mode** — an extended ULA color system where the attribute byte drives more than just 8-color INK/PAPER.

### ULANext (`0x42`)

**Register `0x42` — ULANext Attribute Byte Format**

In ULANext mode, the attribute byte's bits are split between INK and PAPER differently than the original:
- The mask value tells the hardware how many low bits of the attribute byte represent INK; the remaining bits represent PAPER.
- Valid masks: `0x01`, `0x03`, `0x07` (default), `0x0F`, `0x1F`, `0x3F`, `0x7F`, `0xFF`.
- Mask `0xFF` = full INK mode: all 256 palette entries are INK colors, and PAPER/border come from the fallback color in `0x4A`.

With mask `0x07` (default), bits 2:0 are INK (8 colors of ink palette), bits 7:3 are PAPER. With mask `0x3F`, bits 5:0 are INK (64 ink colors), bits 7:6 are PAPER. This lets you trade PAPER color range for INK color range.

---

## Video: Clip Windows

Every graphics layer can be clipped to a rectangle smaller than the full display. This is how you create split-screen layouts, HUD overlays, or windowed displays within a larger scene.

### Setting Clip Rectangles (`0x18`, `0x19`, `0x1A`, `0x1B`)

Each clip register takes four consecutive writes in order—X1, X2, Y1, Y2—all inclusive pixel coordinates:

| Register | Layer |
|----------|-------|
| `0x18` | Layer 2 (default: 0, 255, 0, 191) |
| `0x19` | Sprites (default: 0, 255, 0, 191) |
| `0x1A` | ULA and LoRes (default: 0, 255, 0, 191) |
| `0x1B` | Tilemap (default: 0, 159, 0, 255) |

Reads return the current coordinate but **do not advance** the write index. To re-set coordinates without having to cycle through all four writes, use the reset bits in `0x1C`.

### Checking and Resetting Clip Indices (`0x1C`)

**Register `0x1C` — Clip Window Control**

Reading shows the current write index for each layer (0–3, where 0 means the next write goes to X1):
- Bits 7:6 — Tilemap clip index
- Bits 5:4 — ULA/LoRes clip index
- Bits 3:2 — Sprite clip index
- Bits 1:0 — Layer 2 clip index

Writing resets individual clip indices:
- Bit 3: reset Tilemap clip index to 0 (X1)
- Bit 2: reset ULA/LoRes clip index to 0
- Bit 1: reset Sprite clip index to 0
- Bit 0: reset Layer 2 clip index to 0

You need this when code runs at unknown points in the write sequence—reset first, then write all four coordinates cleanly.

---

## The Copper Co-Processor

The Copper is a tiny co-processor that watches the raster beam and modifies NextRegs at precise screen positions. It runs independently of the Z80, executing from its own 2KB instruction memory. You load programs into it, start it, and walk away—the Copper fires palette changes, scroll updates, layer switches, and more, frame after frame, without touching the CPU.

### Loading Copper Programs

**Register `0x60` — Copper Data (8-bit Write)**  
**Register `0x63` — Copper Data (16-bit Write)**

`0x60` writes one byte at a time to the Copper's instruction memory, auto-incrementing the address after each write. Since Copper instructions are 2 bytes, most programs use `0x63` instead—it writes a full 16-bit instruction at once, auto-incrementing past both bytes.

Each Copper instruction is one of two types:
- **WAIT**: pause execution until the raster reaches a specific X,Y position. Encoded as two bytes with the MSB bit set.
- **MOVE**: write a value to a NextReg. Encoded as two bytes: the register number and the value.

**Register `0x61` — Copper Address LSB**  
**Register `0x62` bits 2:0 — Copper Address MSB**

Together these form the 11-bit write address into Copper memory (0–`0x7FF`). Set the address before loading a new program.

### Starting and Stopping the Copper (`0x62`)

**Register `0x62` — Copper Control**

Bits 7:6 control execution:
- `00` — Copper fully stopped
- `01` — Start from address 0, loop continuously
- `10` — Start from last stopped position, loop continuously
- `11` — Start from address 0, restart when raster reaches (0,0) (frame-synchronized)

Writing the same start value twice doesn't reset the Copper—you'd need to stop it first, then start again.

Mode `11` is the most useful for frame effects: the Copper restarts at the top of each frame automatically, so your scanline palette animations run in perfect sync with the display, no synchronization code required.

> **Copper access**: The Copper can read and write NextRegs `0x00`–`0x7F`. Registers `0x80` and above are inaccessible to it—so the Copper can't touch memory mapping, expansion bus control, or interrupt configuration. Everything visual is fair game.

### Aligning Copper Timing (`0x64`)

**Register `0x64` — Vertical Line Count Offset**

The Copper counts raster lines from 0, and normally line 0 coincides with the first ULA pixel row. This register adds an offset, shifting the alignment. If your Copper WAIT instructions target tilemap/sprite pixel positions that don't match ULA rows, set this offset to align them.

---

## Audio

The Next's audio system layers multiple sources simultaneously: beeper, three AY-3-8912 chips (TurboSound), four 8-bit DACs, and I²S digital audio from the Raspberry Pi connector. Most sources mix automatically—you just enable what you need.

### Peripheral Settings for Audio (`0x06`, `0x08`, `0x09`)

**Register `0x06` — Peripheral 2 Setting** (audio-relevant bits)

- **Bits 1:0 — Audio chip mode**:
  - `00` — YM2149 (Yamaha, slightly different envelope behavior from AY)
  - `01` — AY-3-8910 (the authentic Spectrum 128K chip)
  - `10` — ZXN-8950 (experimental extended mode)
  - `11` — Hold all AY chips in reset (silence them)
- **Bit 6**: Route the beeper exclusively to the internal speaker, keeping it off the audio output jacks. Useful when you want the click of a real speaker but clean audio on HDMI.

**Register `0x08` — Peripheral 3 Setting** (audio-relevant bits)

- **Bit 4**: Enable the internal speaker (enabled by default)
- **Bit 3**: Enable the four 8-bit DACs (A, B, C, D). DACs A+D are mono (or left+right pair), B is left, C is right
- **Bit 1**: Enable TurboSound—the second and third AY chips. Without this, only AY 0 is active
- **Bit 5**: AY stereo mode — 0 = ABC (left-center-right), 1 = ACB (left-right-center). ACB puts all action on the outer channels, which sounds wider on headphones

**Register `0x09` — Peripheral 4 Setting** (audio-relevant bits)

- **Bits 7:5**: Force AY 2, AY 1, or AY 0 (respectively) into mono mode. Mono combines both stereo channels of that AY chip into one, useful when a mono music track sounds wrong when panned hard left or right
- **Bit 2**: Silence HDMI audio output (audio still plays on analog jacks)

### DAC Output (`0x2C`, `0x2D`, `0x2E`)

**Register `0x2C` — DAC B Mirror (Left)**  
**Register `0x2D` — DAC A+D Mirror (Mono)**  
**Register `0x2E` — DAC C Mirror (Right)**

These are the direct write paths to the four DACs—accessible via NextReg as mirrors of the port-based DAC interface:
- Write to `0x2C`: set left DAC B to an 8-bit sample (0x80 = silence, 0x00 = full negative, 0xFF = full positive)
- Write to `0x2E`: set right DAC C similarly
- Write to `0x2D`: set both DAC A and D simultaneously (the mono/center pair)

Reading these registers returns the current sample being received from the Raspberry Pi I²S interface—useful for monitoring or routing Pi audio back through the Next's mixer.

> **DMA-driven audio**: For real-time music playback, use the DMA controller to stream samples from a buffer to the DAC ports automatically. The DMA's burst mode is purpose-built for this: set source address, destination port (DAC), byte count, repeat, and the music plays without consuming any CPU cycles.

### Raspberry Pi I²S Audio (`0xA2`)

**Register `0xA2` — PI I²S Audio Control**

The Raspberry Pi connector carries I²S digital audio in both directions:
- **Bits 7:6 — I²S enable**: Off, mono-right, mono-left, or stereo
- **Bit 4**: Direction — 0 for sending audio *to* Pi hats, 1 for receiving audio *from* a Pi
- **Bits 3:2**: Mute left or right channels independently
- **Bit 0**: Route incoming I²S audio directly to the EAR input on port `0xFE`—enabling the Pi to feed audio data as if from a tape, for software tape-loading over I²S

---

## Interrupts

The original Spectrum's interrupt story was simple: one source, one vector, every 20ms. The Next adds nine more interrupt sources, a priority system, hardware-generated vectors, and the ability to interrupt a DMA transfer mid-stream.

### Interrupt Mode Control (`0xC0`)

**Register `0xC0` — Interrupt Control**

The fundamental interrupt configuration:
- **Bit 0**: 0 = classic pulse-mode interrupts (compatible with all software), 1 = hardware IM2 mode with automatic vector generation
- **Bits 7:5**: When in hardware IM2 mode, these are the top 3 bits of the interrupt vector generated. Choose a page-aligned location for your interrupt table
- **Bit 3**: Enable stackless NMI response (see NMI registers below)
- **Bits 2:1**: Read-only—reflects the current Z80 interrupt mode (0, 1, or 2)

**Hardware IM2 mode** is the key feature. In standard IM2, Z80 asks the interrupting device for a byte and uses it as the low byte of the vector. In hardware IM2 mode, the Next generates the vector automatically based on interrupt priority—no need for an interrupt-vector-supplying device on the bus.

The generated vector's low bits encode the source:
- `0` — Line interrupt (highest priority)
- `1`/`2` — UART 0/1 Rx
- `3`–`10` — CTC channels 0–7
- `11` — ULA (frame interrupt)
- `12`/`13` — UART 0/1 Tx (lowest priority)

### Line Interrupt (`0x22`, `0x23`)

**Register `0x22` — Line Interrupt Control**  
**Register `0x23` — Line Interrupt Value LSB**

A line interrupt fires when the raster reaches a specific scanline. Together with the MSB from `0x22` bit 0, `0x23` specifies which line (0–311, though lines above ~311 may not exist in practice).

- **Bit 2** of `0x22`: Disable the ULA frame interrupt (the normal 50/60Hz tick). Clear this if you're using line interrupts instead and don't want ULA interrupts competing.
- **Bit 1** of `0x22`: Enable the line interrupt.
- **Bit 7** of `0x22` (read-only): 1 if the ULA is currently asserting an interrupt.

These bits in `0x22` are also aliased in `0xC4` along with all other interrupt enables—so both registers show the same state.

Line interrupts let you split the screen into zones with different rendering modes—switch graphics modes, palettes, or layer configurations at exactly the right scanline. This is how split-screen text-at-bottom, game-at-top displays work cleanly.

### Enabling Interrupt Sources (`0xC4`, `0xC5`, `0xC6`)

**Register `0xC4` — Interrupt Enables 0**  
**Register `0xC5` — Interrupt Enables 1**  
**Register `0xC6` — Interrupt Enables 2**

Enable bits for all interrupt sources. A disabled interrupt enters **polled mode**—you can check `0xC8`–`0xCA` to see if it fired without taking an actual interrupt. This is how you check whether a CTC channel has counted out without needing an ISR.

`0xC4`:
- Bit 7: Expansion bus `/INT`
- Bit 1: Line interrupt
- Bit 0: ULA frame interrupt (default enabled)

`0xC5`, bits 7:0: CTC channels 7–0 respectively

`0xC6`:
- Bits 6, 2: UART 1 and 0 Tx empty
- Bits 5:4: UART 1 Rx near-full / available
- Bits 1:0: UART 0 Rx near-full / available

### Forcing Interrupts (`0x20`)

**Register `0x20` — Generate Maskable Interrupt**

Writing set bits here immediately generates maskable interrupts for those sources, regardless of whether they've actually fired. Reading shows which interrupts are currently pending. This is invaluable for testing interrupt handlers: write `0x80` (line interrupt—it's bit 7) or `0x40` (ULA frame interrupt—bit 6) and your ISR fires immediately without waiting for an actual raster event.

The bit layout matches `0xC8`: bit 7 = line, bit 6 = ULA, bits 3:0 = CTC channels 3–0.

### Checking Interrupt Status (`0xC8`, `0xC9`, `0xCA`)

**Registers `0xC8`–`0xCA` — Interrupt Status 0–2**

Mirror the layout of `0xC4`–`0xC6`. Reading shows which interrupts have fired (set bits = fired or currently pending). Writing set bits **clears** those status flags.

In polled mode—where an interrupt is disabled—you read these to detect events without taking an interrupt. Check frequently in a game loop if you need CTC timing without ISR overhead.

### NMI Handling (`0xC2`, `0xC3`, `0xC0` bit 3)

**Registers `0xC2`/`0xC3` — NMI Return Address LSB/MSB**

During an NMI acknowledge cycle, the return address is *always* written here—regardless of the stackless setting. Read these in your NMI handler to know where the Z80 was interrupted.

**Register `0xC0` bit 3 — Stackless NMI**

With stackless NMI enabled, the NMI return address goes into `0xC2`/`0xC3` instead of the actual stack. The stack pointer decrements and increments normally, but the memory write/read is intercepted. The first `RETN` instruction after the NMI reads the return address from these registers instead of memory.

Why? Because NMI handlers for debugging tools (like Multiface) need to inspect the stack without disturbing it. Normally, acknowledging an NMI pushes the PC to the stack—corrupting the very memory you're trying to examine. Stackless mode neatly sidesteps this.

### DMA Interrupt Enables (`0xCC`, `0xCD`, `0xCE`)

**Registers `0xCC`–`0xCE` — DMA Interrupt Enables**

The DMA controller can be interrupted while running a transfer. These registers specify which interrupt sources can pause a DMA operation. The layout mirrors `0xC4`–`0xC6`.

This is how audio streaming with DMA stays synchronized: enable the line interrupt in `0xCC` so the DMA pauses at a scanline boundary—preventing audio sample tearing if you update the buffer.

### Reserved Interrupt-Area Registers (`0xC7`, `0xCB`, `0xCF`)

Three reserved registers live within the interrupt register block. They serve no user-visible function, but they have specific values the hardware expects:

- **`0xC7`** — Reserved; write `0x00`
- **`0xCB`** — Reserved; write `0xFF`
- **`0xCF`** — Reserved; write `0x00`

If you're bulk-initializing the interrupt system, write these sentinel values to avoid unexpected behavior from unverified hardware state. Future firmware revisions might assign these registers real functions—for now, treat them as write-once housekeeping.

---

## Peripheral Settings

Four registers pack a lot of configuration into single bytes. They cover joystick modes, speaker control, AY audio, PS/2 input, hotkeys, and more.

### Joystick Configuration (`0x05`)

**Register `0x05` — Peripheral 1 Setting**

- **Bits 7:6 and 3** (together): Joystick 1 mode (3-bit value)
- **Bits 5:4 and 1** (together): Joystick 2 mode (3-bit value)
- **Bit 2**: 50/60Hz display mode (0 = 50Hz, 1 = 60Hz)
- **Bit 0**: Enable scandoubler (1 = VGA 31kHz mode, 0 = direct 15kHz for CRT monitors)

Joystick modes:
| Code | Mode |
|------|------|
| `000` | Sinclair 2 (keys 1–5) |
| `001` | Kempston 1 (port `0x1F`) |
| `010` | Cursor (keys 5,6,7,8,0) |
| `011` | Sinclair 1 (keys 6–0) |
| `100` | Kempston 2 (port `0x37`) |
| `101` | MD joystick 1 (3 or 6-button, port `0x1F`) |
| `110` | MD joystick 2 (port `0x37`) |
| `111` | User-defined keys joystick |

The user-defined keys joystick is programmed through the PS/2 keymap interface (`0x28`–`0x2B`): write 128 to `0x28` to select key joystick mode, then specify which keyboard matrix positions map to each joystick button.

### Joystick I/O Mode (`0x0B`)

**Register `0x0B` — Joystick I/O Mode**

Repurposes the joystick ports as general I/O:
- **Bit 7**: Enable I/O mode (disables joystick reading; keyboard joystick types produce no readings)
- **Bits 5:4**: Mode — bit-bang GPIO, clock output, or UART on left/right joystick port
- **Bit 0**: Parameter value (GPIO output level in bit-bang, clock run in clock mode, UART redirect in uart mode)

UART mode is particularly useful: it redirects either the ESP Wi-Fi UART or the Raspberry Pi UART to the joystick port pins, allowing communication with external hardware using standard DB9 joystick cables.

### Other Peripheral Control (`0x06`, `0x08`, `0x09`, `0x0A`)

**Register `0x06` — Peripheral 2 Setting** (non-audio bits)

- **Bit 7**: Enable F8 CPU-speed and F5/F6 expansion-bus hotkeys
- **Bit 5**: Enable F3 50/60Hz toggle hotkey
- **Bit 4**: Enable DivMMC NMI from DRIVE button
- **Bit 3**: Enable Multiface NMI from M1 button
- **Bit 2**: PS/2 mode — 0 = keyboard primary, 1 = mouse primary (config mode only)

**Register `0x08` — Peripheral 3 Setting** (non-audio bits)

- **Bit 7**: Unlock port `0x7FFD` (when the 128K ROM locks it, this undoes that)
- **Bit 6**: Disable RAM and port contention. Turn this on if you're running code at high speed and don't need ULA-accurate timing. Games built for 48K timing may glitch; demos often want it on for maximum speed
- **Bit 2**: Enable port `0xFF` Timex video mode reads (hides the floating bus)
- **Bit 0**: Issue 2 keyboard compatibility (affects how the keyboard matrix is decoded)

**Register `0x09` — Peripheral 4 Setting** (non-audio bits)

- **Bit 4**: Sprite ID lockstep — keep `0x34` and port `0x303B` always in sync
- **Bit 3**: Reset the DivMMC mapram bit (port `0xE3` bit 6). Write-only, reads 0
- **Bits 1:0**: Scanline weight for CRT scanline simulation:
  - `00` — No scanlines
  - `01` — 50% scanlines
  - `10` — 25% scanlines
  - `11` — 12.5% scanlines

**Register `0x0A` — Peripheral 5 Setting**

- **Bits 7:6**: Multiface type (config mode only) — +3, 128 v87.2, 128 v87.12, or Multiface 1. Determines which ports the Multiface responds to.
- **Bit 4**: Enable DivMMC automap
- **Bit 3**: Reverse left and right mouse buttons
- **Bits 1:0**: Mouse DPI — low (00), default (01), medium (10), high (11)

---

## Input: Keyboard and Key Reading

### PS/2 Keymap (`0x28`, `0x29`, `0x2A`, `0x2B`)

The Next remaps PS/2 keyboard keys to the Spectrum's 8×5 keyboard matrix. The default mapping makes a PS/2 keyboard feel natural on a Spectrum, but you can reprogram individual keys.

**Register `0x28` — PS/2 Keymap Address MSB** (on write)

Writing here starts a keymap programming session. Bit 7 = 0 selects the PS/2 keymap; bit 7 = 1 selects the joystick keymap. Bit 0 is the MSB of the keymap address.

**Register `0x29` — PS/2 Keymap Address LSB**

The LSB of the keymap read/write address.

**Register `0x2A` — PS/2 Keymap Data MSB** (write-only)

Bit 0 of this register carries the MSB of the keymap data byte. Currently this bit is not used by the hardware—the keymap entries are all 8-bit values fitting in `0x2B` alone. Write `0` here before writing `0x2B`. It exists in the register map as a placeholder for potential future expansion of the keymap data width.

**Register `0x2B` — PS/2 Keymap Data LSB**

Writing here writes the new key mapping entry and auto-increments the address. Each entry maps a PS/2 scan code to a Spectrum matrix position (bits 5:3 = row, bits 2:0 = column; `111` = no key pressed). Read back through `0x28` (reading returns the stored palette value, not keymap data—keymap is write-only).

### Extended Key States (`0xB0`, `0xB1`, `0xB2`)

The ZX Spectrum Next keyboard has keys the original never had. These registers expose them directly.

**Register `0xB0` — Extended Keys 0** (read-only)

| Bit | Key |
|-----|-----|
| 7 | `;` |
| 6 | `"` |
| 5 | `,` |
| 4 | `.` |
| 3 | UP |
| 2 | DOWN |
| 1 | LEFT |
| 0 | RIGHT |

**Register `0xB1` — Extended Keys 1** (read-only)

| Bit | Key |
|-----|-----|
| 7 | DELETE |
| 6 | EDIT |
| 5 | BREAK |
| 4 | INV VIDEO |
| 3 | TRUE VIDEO |
| 2 | GRAPH |
| 1 | CAPS LOCK |
| 0 | EXTEND |

Setting bit 4 of `0x68` prevents these extended keys from also inserting entries into the 8×5 membrane matrix—so reading port `0xFE` won't see spurious keypresses from them.

**Register `0xB2` — Extended MD Pad Buttons** (read-only)

For Mega Drive pad mode, reads the extra buttons (X, Z, Y, MODE) on both left and right joystick ports separately. Bits 7:4 = right pad, bits 3:0 = left pad.

---

## DivMMC and Storage

DivMMC handles transparent SD card access. The fundamental mechanism is *automapping*: when the Z80 fetches an instruction from specific addresses (typically ROM entry points), DivMMC pages its own RAM and ROM into the Z80's address space, runs the SD card routine, then pages itself out—the calling code never knows DivMMC was involved.

### DivMMC Entry Points (`0xB8`, `0xB9`, `0xBA`, `0xBB`)

**Register `0xB8` — DivMMC Entry Points 0**

Controls which addresses trigger automapping (instruction fetch only). Individual bits enable specific RST vectors:
- Bit 0: Address `0x0000`
- Bit 1: Address `0x0008`
- ...
- Bit 7: Address `0x0038` (IM1 interrupt vector)

The default enables `0x0000` and `0x0038`.

**Register `0xB9` — DivMMC Entry Points Valid 0**

For each entry point in `0xB8`, this sets whether it triggers *always* (bit set) or only when ROM3 is paged in (bit clear). ROM3 is the 48K BASIC ROM—so most tape-loading traps are ROM3-only.

**Register `0xBA` — DivMMC Entry Points Timing 0**

For each entry point, whether mapping is *instant* (bit set—maps before the instruction executes) or *delayed* (bit clear—maps after the instruction, for compatibility). RST 0 and NMI entry at `0x0066` need instant mapping; tape traps at ROM addresses work better delayed.

**Register `0xBB` — DivMMC Entry Points 1**

Additional entry points beyond the RST vectors:
- Bit 7: Addresses `0x3DXX` (TR-DOS entry points, instant, ROM3)—for TR-DOS disk compatibility
- Bit 6: Disable exit from automap at `0x1FF8`–`0x1FFF`
- Bits 5:4: Tape trap addresses for NextZXOS (`0x056A`, `0x04D7`)
- Bits 3:2: Tape trap addresses for ESXdos / original DivMMC (`0x0562`, `0x04C6`)
- Bit 1: `0x0066` instant (NMI handler)
- Bit 0: `0x0066` delayed

---

## Expansion Bus

The Next's edge connector is electrically compatible with the original Spectrum's expansion bus. Original Spectrum peripherals can connect and work, but the Next also gives you fine-grained control over which ports get routed internally versus passed through to external hardware.

### Enabling the Bus (`0x80`)

**Register `0x80` — Expansion Bus Enable**

- **Bit 7** (immediate): Enable the expansion bus
- **Bit 6** (immediate): Enable ROMCS replacement from DivMMC banks 14/15
- **Bit 5** (immediate): Disable internal I/O cycles and ignore IORQULA—all I/O goes to the bus
- **Bit 4** (immediate): Disable internal memory cycles—all memory access goes to the bus

Bits 3:0 are the "saved" versions that take effect after soft reset (copied from bits 7:4 at soft-reset time).

### Bus Control (`0x81`)

**Register `0x81` — Expansion Bus Control**

- **Bit 7** (read-only): ROMCS is currently asserted on the expansion bus
- **Bit 6**: Allow bus peripherals to override ULA on even-port reads (needed for Rotronics Wafadrive)
- **Bit 5**: Disable NMI button debounce on the expansion bus (for Opus Discovery compatibility)
- **Bit 4**: Propagate the maximum CPU clock at all times, even when the bus is off

### Port Decoding Control (`0x82`–`0x85`, `0x86`–`0x89`)

**Registers `0x82`–`0x85` — Internal Port Decoding Enables** (32-bit field, `0x85` = MSB)  
**Registers `0x86`–`0x89` — Expansion Bus Port Decoding Enables** (32-bit field, `0x89` = MSB)

Each bit enables or disables one port or group of ports. A clear bit means the internal device for that port is disabled; when the expansion bus is on, the corresponding I/O cycle propagates to external hardware.

Key bits (by position in the combined 32-bit value):
- Bit 0: Port `0xFF`
- Bit 1: Port `0x7FFD` (128K paging)
- Bit 5: Port `0x6B` ZXN DMA
- Bit 6: Port `0x1F` Kempston/MD1 joystick
- Bit 9: Multiface ports
- Bit 14: Sprite ports (`0x57`, `0x5B`, `0x303B`)
- Bit 15: Layer 2 port (`0x123B`)
- Bit 16: AY ports (`0xFFFD`, `0xBFFD`)
- Bits 17–23: DAC ports (various Soundrive, Covox, Specdrum configurations)
- Bit 24: ULA+ ports
- Bit 25: Z80 DMA port
- Bit 27: CTC ports

Internal enables always apply. Expansion bus enables are ANDed with internal enables—you can't enable something on the bus that's disabled internally.

### I/O Port Propagation (`0x8A`)

**Register `0x8A` — Expansion Bus I/O Propagate**

Even when a port is handled internally, you can still propagate its I/O cycles to the expansion bus so external hardware can monitor state changes:
- Bit 0: Port `0xFE` (ULA keyboard/border/EAR—enables external keyboards to mix their readings)
- Bit 1: Port `0x7FFD`
- Bit 2: Port `0xDFFD`
- Bit 3: Port `0x1FFD`
- Bit 4: Port `0xFF`
- Bit 5: Port `0xEFF7`

The `0xFE` propagation is special: any value an external keyboard puts on the data bus during a port `0xFE` read gets mixed into the keyboard result—making external keyboards work naturally.

### Alternate ROM (`0x8C`)

**Register `0x8C` — Alternate ROM**

Replaces the standard Spectrum ROM with custom pages from DivMMC banks. The "immediate" bits (7:4) take effect now; bits 3:0 are saved and restored after soft reset.
- Bit 7 (or 3): Enable alternate ROM
- Bit 6 (or 2): Make alternate ROM visible only during writes (not reads)—useful for write trapping
- Bits 5,4 (or 1,0): Lock ROM1 (48K ROM) or ROM0 (128K ROM) in place, preventing them from being paged out

---

## Raspberry Pi and GPIO

The Next's edge connector includes a Raspberry Pi Zero footprint, and the Next FPGA connects to Pi GPIO pins. These NextRegs configure that bridge.

### Pi GPIO Output Enable (`0x90`–`0x93`)

**Registers `0x90`–`0x93` — PI GPIO Output Enable** (28-bit field)

Each bit enables output mode on the corresponding Pi GPIO pin (0–27). Pins 0 and 1 are fixed as inputs (I²C by default). All other pins can be switched between input and output individually. A set bit = output enabled.

After soft reset, all pins are inputs.

### Pi GPIO State (`0x98`–`0x9B`)

**Registers `0x98`–`0x9B` — PI GPIO State** (28-bit field)

Reading returns the current state of all 28 GPIO pins regardless of direction. Writing sets output levels on pins that have output enabled (via `0x90`–`0x93`); writes to input-configured pins are ignored.

### Pi Peripheral Enable (`0xA0`)

**Register `0xA0` — PI Peripheral Enable**

Enables dedicated Pi interfaces that share GPIO pins with general GPIO:
- **Bit 5**: UART on GPIO 14 and 15 (overrides GPIO for those pins)
- **Bit 4**: UART direction — 0 = Rx/GPIO15 Tx/GPIO14 (for Pi hats), 1 = reversed (for Pi itself)
- **Bit 3**: I²C on GPIO 2 and 3
- **Bit 0**: SPI on GPIO 7, 8, 9, 10, 11

When any of these are enabled, the corresponding pins are no longer general-purpose GPIO.

### ESP Wi-Fi GPIO (`0xA8`, `0xA9`)

**Registers `0xA8`/`0xA9` — ESP Wifi GPIO**

The ESP8266 Wi-Fi module on the Pi connector exposes two GPIO pins: GPIO0 and GPIO2. Register `0xA8` enables output, `0xA9` reads/writes state. GPIO2 is read-only (its output enable bit is fixed at 0).

These are used to hold the ESP in programming mode (GPIO0 low during reset) or to toggle module state. Normally the operating system handles this, but if you're implementing custom Wi-Fi control, these give you direct access.

---

## Debugging Features

### I/O Traps (`0xD8`, `0xD9`, `0xDA`) — *Experimental*

**Register `0xD8` — I/O Traps**

With bit 0 set, I/O writes to ports `0x2FFD` and `0x3FFD` (the +3 FDC disk controller ports) generate a Multiface NMI instead of actually executing—trapping them for inspection or redirection. Useful for +3 disk DOS compatibility layers.

The NMI status appears in `0x02` bit 4. In your NMI handler, check `0xDA` to find the cause, and `0xD9` for the byte that was written.

Traps cannot fire while DMA, DivMMC, Multiface, or an external NMI master is already active.

### XADC Diagnostics (`0xF0`, `0xF8`, `0xF9`, `0xFA`) — Issue 4 Only

The Artix-7 FPGA in Issue 4 boards includes XADC (Extended Analog-to-Digital Converter) and DNA (Device Unique ID) interfaces. These are exposed through a small state machine accessed via `0xF0`.

**Register `0xF0` — XDEV CMD**

Write `0x80` to enter select mode. Then write `0xC0 | device_id` to select a device (DNA = 1, XADC = 2). Finally write 0 to exit select mode and start communicating with the selected device via the same register.

**Xilinx DNA mode**: Read serial bit-by-bit; the first 8 bits give the DNA field length, followed by the unique device ID. This gives you a hardware serial number unique to each FPGA device.

**XADC mode**: Trigger conversions and read analog measurements via `0xF8`–`0xFA`. The XADC can measure internal chip temperature and supply voltages—useful for thermal diagnostics or detecting a stressed board. Consult Xilinx UG480 for the full DRP register map.

---

## User Storage (`0x7F`)

**Register `0x7F` — User Register 0**

Eight bits of scratch storage that the hardware ignores. Write anything, read it back later. Soft reset returns it to `0xFF`.

Not exactly a feature with a lot of drama, but it's occasionally useful: store a mode byte here that multiple interrupt handlers can read without needing to reserve precious RAM, or use it as a quick handshake flag between interrupt and main code.

> **Upper limit**: NextRegs `0x80` and above are inaccessible to the Copper but still reachable via I/O ports and NEXTREG instructions. Register `0xFF` is reserved for internal use—don't write to it.

---

## Quick Reference: Registers by Category

| Category | Registers |
|----------|-----------|
| System identity | `0x00`, `0x01`, `0x0E`, `0x0F` |
| System control | `0x02`, `0x03`, `0x07`, `0x10`, `0x24` |
| Memory (MMU) | `0x04`, `0x50`–`0x57`, `0x8C`, `0x8E`, `0x8F` |
| Layer system | `0x14`, `0x15`, `0x4A`, `0x4B`, `0x4C` |
| Layer 2 | `0x12`, `0x13`, `0x16`, `0x17`, `0x18`, `0x69`, `0x70`, `0x71` |
| ULA / LoRes | `0x11`, `0x1A`, `0x26`, `0x27`, `0x32`, `0x33`, `0x64`, `0x68`, `0x69`, `0x6A` |
| Sprites | `0x19`, `0x34`, `0x35`–`0x39`, `0x75`–`0x79` |
| Tilemap | `0x1B`, `0x2F`, `0x30`, `0x31`, `0x6B`, `0x6C`, `0x6E`, `0x6F` |
| Palettes | `0x40`, `0x41`, `0x42`, `0x43`, `0x44` |
| Clip windows | `0x18`–`0x1C` |
| Raster / timing | `0x1E`, `0x1F`, `0x20`, `0x22`, `0x23` |
| Copper | `0x60`, `0x61`, `0x62`, `0x63`, `0x64` |
| Audio | `0x06`, `0x08`, `0x09`, `0x2C`, `0x2D`, `0x2E`, `0xA2` |
| Interrupts | `0xC0`, `0xC2`, `0xC3`, `0xC4`–`0xC6`, `0xC7`, `0xC8`–`0xCA`, `0xCB`, `0xCC`–`0xCE`, `0xCF` |
| Joystick | `0x05`, `0x0B`, `0xB2` |
| Keyboard | `0x28`, `0x29`, `0x2A`, `0x2B`, `0xB0`, `0xB1` |
| Peripherals | `0x06`, `0x08`, `0x09`, `0x0A` |
| DivMMC | `0xB8`, `0xB9`, `0xBA`, `0xBB` |
| Expansion bus | `0x80`, `0x81`, `0x82`–`0x89`, `0x8A` |
| Raspberry Pi / GPIO | `0x90`–`0x93`, `0x98`–`0x9B`, `0xA0`, `0xA2`, `0xA8`, `0xA9` |
| Debugging | `0xD8`, `0xD9`, `0xDA`, `0xF0`, `0xF8`–`0xFA` |
| User storage | `0x7F` |
