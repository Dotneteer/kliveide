# Appendix A: The NEX File Format

Throughout this book, every hands-on exercise loads and runs code using the NEX file format. It's the standard way to distribute ZX Spectrum Next applications - a single file that contains everything needed to load and run a program. Understanding NEX files isn't just academic curiosity; it's essential for testing your emulator, running examples, and eventually creating your own Next software. This chapter breaks down the format from the user's perspective first, then dives into the implementation details you'll need for your emulator's loader.

## Why NEX Files Exist: The Problem They Solve

The original ZX Spectrum had multiple file formats: TAP files for tape images, SNA and Z80 for snapshots, raw binaries that needed manual loading. Each format served a purpose, but none were ideal for modern distribution. TAP files included tape loading headers with checksums. Snapshot formats saved entire machine state but couldn't preserve modern Next features. Raw binaries required complex multi-step loading procedures.

The Next needed something better: **a self-contained executable format** that could:

- Load directly from the SD card operating system (NextZXOS/ESXDOS)
- Specify exactly which memory banks to load and where
- Include loading screens (Layer 2, ULA, LoRes, or Timex modes)
- Set up hardware registers, palettes, and initial state
- Support the full 2MB address space (112 banks of 16KB each)
- Run immediately after loading without manual setup

That's NEX. Think of it as the Next's equivalent to EXE on Windows or ELF on Linux - a standardized executable format that "just works."

## File Structure: Layers of a NEX File

Every NEX file starts with a mandatory 512-byte header, followed by optional blocks as needed. Here's the complete structure:

| Block                   | Size               | Purpose                                                |
| ----------------------- | ------------------ | ------------------------------------------------------ |
| Header                  | 512 bytes          | Magic number, version, loading instructions, bank list |
| Palette                 | 512 bytes          | 256 color entries (Layer 2, LoRes, Tilemap screens)    |
| Loading Screen          | 6,912–81,920 bytes | ULA, Layer 2, LoRes, or Timex display during loading   |
| Copper Code             | 2,048 bytes        | Raster effects for animated loading bar                |
| Bank 5                  | 16,384 bytes       | First memory bank in file order (ULA screen memory)    |
| Bank 2                  | 16,384 bytes       | Second bank (typically working memory)                 |
| Banks 0, 1, 3, 4, 6–111 | 16,384 bytes each  | Remaining banks in defined order                       |
| Custom Data             | Variable           | Application-defined data (levels, assets, etc.)        |

The header tells you what's coming. The optional blocks appear only if the header says they're present. Everything is laid out sequentially - no seeks, no compression, no complex structures. Just read block after block in order.

## The Header: Control Center for Loading

The first 512 bytes contain everything the loader needs to know. Let's break down the key fields:

### Identification and Version (Offsets 0-7)

```
Offset 0: "Next" (4 bytes) - Magic number identifying NEX files
Offset 4: "V1.2" (4 bytes) - Version string (V1.0, V1.1, or V1.2)
```

Every NEX file starts with the ASCII string "Next" followed by the version. This lets loaders quickly verify "yes, this is a NEX file" and "yes, I understand this version." If you encounter "Next" but an unknown version, you can reject the file early.

### Memory Requirements (Offset 8)

```
Offset 8: RAM required (1 byte)
  0 = 768KB (standard Next)
  1 = 1792KB (expanded Next)
```

Most Next machines have 1MB or 2MB of RAM. This byte tells the loader whether 768KB is sufficient or if the full expanded memory is required. If the machine doesn't have enough RAM, the loader can bail out with a clear error message instead of attempting to load and failing mysteriously.

### Bank Loading Information (Offsets 9-129)

```
Offset 9:  Number of banks to load (1 byte) - count of 16KB banks (0-112)
Offset 18: Bank presence array (112 bytes) - one byte per bank (0=skip, 1=load)
```

This is clever: the header contains a 112-byte array where each byte corresponds to one of the 112 possible 16KB banks (banks 0-111). A value of 1 means "this bank's data is in the file," 0 means "skip this bank."

But here's the twist: **banks appear in the file in a specific order**, not sequential order:

**File order**: 5, 2, 0, 1, 3, 4, 6, 7, 8, 9, 10, ..., 111

**Why start with bank 5?** Because bank 5 is the ULA screen memory (0x4000-0x7FFF). If you're showing a loading screen, you want it first. Bank 2 comes next because it's often used as working memory during loading. After the first few special-case banks, the rest are sequential.

**Example**: If the header says banks 5, 7, and 10 are present:

- Byte at offset 18+5 = 23 will be 1 (bank 5 present)
- Byte at offset 18+7 = 25 will be 1 (bank 7 present)
- Byte at offset 18+10 = 28 will be 1 (bank 10 present)
- All other bytes in the array will be 0

In the file data section, you'll find: bank 5 data (16KB), bank 7 data (16KB), bank 10 data (16KB).

### Loading Screens (Offset 10)

```
Offset 10: Loading screen type (1 byte, bit flags)
  Bit 7 (128): No palette block (palette omitted even if screen uses one)
  Bit 4 (16):  Timex HiCol screen
  Bit 3 (8):   Timex HiRes screen
  Bit 2 (4):   LoRes screen
  Bit 1 (2):   ULA screen
  Bit 0 (1):   Layer 2 screen
```

A NEX file can include a loading screen displayed while banks load. This byte is a **bit field** - multiple bits can be set, though typical files include only one screen type.

The screen types have different sizes:

- **Layer 2 (standard)**: 49,152 bytes (48KB) - 256×192, 256 colors
- **Layer 2 (extended)**: 81,920 bytes (80KB) - 320×256×8 or 640×256×4
- **ULA**: 6,912 bytes (6KB + 768 bytes attrs) - classic Spectrum screen
- **LoRes**: 12,288 bytes (12KB) - 128×96 with enhanced color attributes
- **Timex HiRes**: 12,288 bytes (12KB) - 512×192 monochrome
- **Timex HiCol**: 12,288 bytes (12KB) - 256×192 with 8×1 color cells

If bit 7 is clear and the screen type uses palettes (Layer 2, LoRes, Tilemap), a 512-byte palette block follows the header.

### Execution Parameters (Offsets 11-16)

```
Offset 11: Border color (1 byte) - 0-7 (standard Spectrum colors)
Offset 12: Stack pointer (2 bytes, little-endian)
Offset 14: Program counter (2 bytes, little-endian) - 0 means "don't run, just load"
Offset 16: Extra files count (2 bytes) - currently unused
```

The **program counter** is crucial: if it's zero, the loader loads everything into memory but doesn't start execution. This is useful for data files or multi-stage loading. If non-zero, the loader jumps to that address after loading completes.

The **stack pointer** sets the initial SP value. Most programs use 0xFFFE (top of memory, growing downward), but you can specify a custom stack location if needed.

### Loading Progress Indicators (Offsets 130-133)

```
Offset 130: Layer 2 loading bar (1 byte) - 0=off, 1=on
Offset 131: Loading bar color (1 byte) - 0-255 (palette index)
Offset 132: Delay per bank (1 byte) - frames to wait after loading each bank
Offset 133: Start delay (1 byte) - frames to wait before execution
```

Remember those tape loading borders that flashed colors while loading? The NEX format supports a modern equivalent: a **loading bar** that progresses across the screen as banks load.

Setting offset 130 to 1 enables this bar (only works with Layer 2 screens). Offset 131 sets the bar color. Offset 132 adds artificial delay between banks - useful if you want users to actually see the loading bar rather than having everything load instantly from SD card. Offset 133 adds delay before execution starts.

**Why artificial delays?** Nostalgia, mostly. Loading from SD card is so fast that loading screens flash by unreadably. Adding a small delay (say, 2-3 frames per bank) lets users appreciate that beautiful loading screen you crafted.

### Hardware Configuration (Offsets 134-141)

```
Offset 134: Preserve NextRegs (1 byte) - 0=reset machine state, 1=preserve
Offset 135: Required core version (3 bytes) - major.minor.subminor (0-15.0-15.0-255)
Offset 138: Timex color / Layer 2 palette offset (1 byte)
Offset 139: Entry bank (1 byte) - bank mapped to slot 3 (0xC000-0xFFFF)
Offset 140: File handle address (2 bytes) - where to store file handle (0=close file)
Offset 142: Disable expansion bus (1 byte) - 0=enabled, 1=disabled (V1.3+ loaders)
```

**Preserve NextRegs** determines whether the loader resets all Next registers to defaults or leaves them as-is. Most programs want 0 (reset everything) for clean state. Setting 1 is useful for utilities that modify the environment without overwriting it.

**Required core version** specifies minimum hardware requirements. The loader checks this against the actual FPGA core version and refuses to load if the hardware is too old. Format is three bytes: major version (4 bits), minor version (4 bits), subminor version (8 bits).

**Entry bank** sets which bank appears at 0xC000-0xFFFF when execution starts. The program counter (offset 14) runs after this mapping is established. If your code lives in bank 0 and expects to run from 0xC000, set this to 0.

**File handle address** is subtle: normally the loader closes the NEX file after loading (value 0). But if your program wants to read more data from the file (perhaps you included custom data at the end), you can request the file handle:

- **0**: Close file (standard behavior)
- **1-0x3FFF**: Pass file handle in BC register when program starts
- **0x4000-0xFFFF**: Write file handle to specified memory address

This enables **streaming assets** - include gigabytes of data at the end of the NEX file, keep it open, and read on demand.

**Disable expansion bus** (offset 142, V1.3+ loaders): Controls whether the expansion bus is available during program execution. Set to 1 to disable the expansion bus (useful if your program expects exclusive hardware access and doesn't want interference from expansion devices). Set to 0 to leave it enabled. **Note:** This flag is only honored on core versions 3.0.5 or newer. Earlier loaders and core versions ignore this byte.

## Optional Blocks: Palette, Screens, and Copper

After the 512-byte header come the optional blocks. Their presence is determined by header flags.

### Palette Block (512 bytes)

If the loading screen uses a palette (Layer 2, LoRes, or Tilemap) and bit 7 of offset 10 is clear, the next 512 bytes define the palette. The format is:

```
256 entries × 2 bytes per entry = 512 bytes total

Each entry (little-endian 16-bit):
  Bits 0-2:   RRR (3-bit red)
  Bits 3-5:   GGG (3-bit green)
  Bits 6-8:   BBB (3-bit blue)
  Bits 9-15:  Reserved (should be 0)
```

The Next uses 9-bit RGB333 color (3 bits red, 3 bits green, 3 bits blue). The format stores this as little-endian 16-bit values: the lower 9 bits contain the color (BBBGGGRRR), and the upper 7 bits are reserved. The loader writes these values to NextReg $44 (PALETTE_VALUE_BIT9_REGISTER).

**Byte layout per entry:**
- Byte 0 (bits 0-7): BBGGGRRR (red[2:0], green[2:0], blue[1:0])
- Byte 1 (bits 8-15): 0000000B (reserved, blue[2])

**Why 512 bytes for 256 entries?** The format uses 2 bytes per entry to accommodate the 9-bit RGB333 format with room for future expansion.

### Loading Screen Blocks

The screen data (if present) follows the palette. The size depends on which screen type is specified:

**Layer 2 (48KB)**: 256×192 pixels, 256 colors per pixel

- 256 × 192 = 49,152 bytes
- Linear framebuffer: byte N is pixel N
- Color is direct palette index (0-255)

**Layer 2 Extended (80KB)**: 320×256 or 640×256 pixels

- 320×256×8 bpp: 320 × 256 = 81,920 bytes
- 640×256×4 bpp: 640 × 256 ÷ 2 = 81,920 bytes (two pixels per byte)

**ULA (6,912 bytes)**: Classic Spectrum format

- 6,144 bytes pixel data (256×192, 1 bit per pixel)
- 768 bytes attribute data (32×24 cells, 8×8 pixels per cell)
- Non-linear layout (three 2KB thirds, each with 64 rows)

**LoRes (12,288 bytes)**: 128×96 with 4×8 color cells

- 6,144 bytes pixel data
- 6,144 bytes attribute data (one byte per 4×8 block)
- Allows two colors per 4×8 block vs. ULA's 8×8

**Timex HiRes (12,288 bytes)**: 512×192 monochrome

- Bitmap layout similar to ULA but double horizontal resolution
- Color specified in header (offset 138)

**Timex HiCol (12,288 bytes)**: 256×192 with 8×1 color cells

- Enhanced color resolution compared to ULA's 8×8
- Each 8-pixel row can have unique foreground/background colors

### Copper Code Block (2,048 bytes)

If you want animated loading effects (rainbow borders, color cycling, raster bars), include a 2KB Copper program. The Copper is a simple raster-synchronized co-processor that executes a list of WAIT/MOVE instructions:

- **WAIT** instructions: Pause until the raster beam reaches position (X,Y)
- **MOVE** instructions: Write value to NextReg register

The loader enables the Copper if this block is present, creating effects that run automatically while banks load. After loading completes, the Copper is disabled (unless your program re-enables it).

**Example use**: Fade the border color through the spectrum as banks load, or animate the loading bar with raster effects.

## Bank Data: The Actual Program

After all the optional blocks come the memory banks themselves. Each bank present in the header's bank array (offset 18-129) contributes 16,384 bytes of raw data.

**Remember the order**: 5, 2, 0, 1, 3, 4, 6, 7, 8, ..., 111

If your program uses banks 0, 5, and 20:

1. Skip to end of optional blocks
2. Read 16KB → this is bank 5
3. Read 16KB → this is bank 0 (comes before bank 2 in file order)
4. Read 16KB → this is bank 20

The loader tracks which bank it's reading using the header's bank presence array. It walks through the array in file order, loading each present bank into the corresponding memory location.

**Important**: Bank data is **raw memory dumps**. No compression, no encoding, no headers. Just 16,384 bytes exactly as they should appear in memory. This makes loading fast (no decompression) but files large if you include many banks.

## Custom Data: Beyond the Standard Format

After all the standard NEX blocks, you can append arbitrary binary data. The NEX specification doesn't define or interpret this data - it's entirely application-specific.

**Use cases**:

- **Level data**: Store game levels, load on demand via file handle
- **Graphics assets**: High-resolution bitmaps, too large for memory banks
- **Audio samples**: PCM data for music/sound effects
- **Script data**: Dialog, cutscenes, game logic in custom format

Access this data by:

1. Setting the file handle address (header offset 140) to non-zero
2. Keeping the file open after loading
3. Reading from file handle using standard file I/O from your program

**Example**: A game might include 100 levels as custom data. The program loads level 1's data on demand when the player enters it, level 2 when they progress, etc. This avoids loading all levels into memory simultaneously.

## Practical Example: Anatomy of a Simple NEX File

Let's trace through a minimal NEX file: a program that displays "HELLO WORLD" in the center of a blue Layer 2 screen.

### Header Construction

```
Offset 0-3:   "Next" (4 bytes)
Offset 4-7:   "V1.2" (4 bytes)
Offset 8:     0 (768KB RAM sufficient)
Offset 9:     3 (three banks: 5, 9, 10)
Offset 10:    1 (bit 0 set: Layer 2 screen included)
Offset 11:    1 (blue border)
Offset 12-13: 0xFFFE (stack at top of memory)
Offset 14-15: 0xC000 (start execution at 0xC000)
Offset 16-17: 0 (no extra files)
```

**Bank array (offset 18-129)**:

```
Offset 23 (18+5):  1 (bank 5 present)
Offset 27 (18+9):  1 (bank 9 present)
Offset 28 (18+10): 1 (bank 10 present)
All others:        0 (not present)
```

**Loading bar settings**:

```
Offset 130: 1 (enable loading bar)
Offset 131: 255 (white bar)
Offset 132: 2 (2-frame delay per bank for visibility)
Offset 133: 50 (1-second delay before execution at 50Hz)
```

**Hardware config**:

```
Offset 134: 0 (reset machine state)
Offset 135-137: 3, 1, 10 (require core 3.1.10 minimum)
Offset 138: 0 (Layer 2 palette offset 0)
Offset 139: 5 (map bank 5 to slot 3 at 0xC000)
Offset 140-141: 0 (close file after loading)
```

**Remainder**: Pad to 512 bytes with zeros.

### Optional Blocks

**Palette (512 bytes)**:

- Entry 0: 0x0000 (black)
- Entry 1: 0x00E0 (blue = 000 111 00 in RGB332)
- Entry 255: 0x00FF (white = 111 111 11 in RGB332)
- Entries 2-254: Other colors as needed
- Each entry: 2 bytes (color in low byte, 0 in high byte)
- Total: 256 × 2 = 512 bytes

**Layer 2 Screen (49,152 bytes)**:

- Fill with palette index 1 (blue background): 49,152 bytes of 0x01
- Except center region where text renders: pixels set to index 255 (white)

**No Copper code** (omitted).

### Bank Data (3 × 16KB = 48KB)

**Bank 5** (16,384 bytes):

- Contains the Layer 2 screen data (though that's already shown via loading screen)
- Or contains font data, code, whatever bank 5 needs for the program

**Bank 9** (16,384 bytes):

- Additional Layer 2 screen data (Layer 2 can span banks 9, 10, 11)

**Bank 10** (16,384 bytes):

- More Layer 2 screen data

**File size**: 512 (header) + 512 (palette) + 49,152 (screen) + 49,152 (3 banks) = 99,328 bytes ≈ 97KB

## Loading Procedure: How Your Code is Started

Understanding how the NEX loader operates helps you write better programs and debug loading issues. Here's the complete loading sequence.

### Initial Setup

When the NEX loader starts, memory is configured as follows: the first 8K (`$0000–$1FFF`) holds the ESXDOS ROM, and the second 8K slot (`$2000–$3FFF`) is RAM containing the loader itself — completely isolated from the `$4000–$FFFF` address space. The loader immediately saves the current Stack Pointer and moves the stack to the top of that second slot (`$3FFF`).

Before opening the NEX file, the loader disables interrupts and sets the CPU speed to 14MHz. Once the file is open, the loader saves the file handle for later use (see Offset 140) and initializes the screen:

- Sets ULA transparency
- Disables Layer 2
- Enables sprites (not over border; sprites above Layer 2, Layer 2 above ULA)

The loader then maps the upper three 16K memory slots:

| Slot | Address range   | Bank   |
|------|-----------------|--------|
| 1    | `$4000–$7FFF`   | Bank 5 |
| 2    | `$8000–$BFFF`   | Bank 2 |
| 3    | `$C000–$FFFF`   | Bank 0 |

### Reading the Header

The loader reads the 512-byte NEX header into Bank 0 at `$C000` and performs these checks in order:

1. **Loader version**: If the NEX file requires a newer loader version, loading aborts with an error.
2. **Expansion bus** (Offset 142): If requested, the loader disables the expansion bus by clearing the top four bits of NextReg `$80`.
3. **Core version** (Offsets 135–137): On real hardware, if the current FPGA core is older than the required version, loading aborts with an upgrade prompt. In an emulator, this check is skipped.

The loader then blacks out the screen — black border, all ULA attributes set to PAPER 0 / INK 0.

### Resetting Next Registers (Offset 134)

If Offset 134 is 0, the loader resets the Next hardware to a clean state:

- Stops the Copper
- Disables DivMMC NMI (DRIVE button), enables Multiface NMI (M1 button)
- Unlocks port `$7FFD`
- Disables RAM and port contention
- Sets AY stereo mode to ABC
- Enables Spectdrum (four 8-bit DACs) and TurboSound
- Enables the Timex port (`$FF`)
- Sets CPU speed to 28MHz
- Sets Layer 2 page to Bank 16, shadow page to Bank 12
- Sets global transparency color to `$E3`
- Enables sprites (not over border; sprites above Layer 2 above ULA)
- Resets Layer 2 and LoRes scroll positions to zero
- Resets all clip windows to defaults (no clipping)
- Enables flashing
- Initializes primary ULA, Layer 2, and sprite palettes
- Sets the fallback color (all layers transparent) to 0
- Pages the ROM back into `$0000–$3FFF`

The following Peripheral Settings 2 flags are preserved regardless:

- F8 CPU speed hotkey and F5/F6 expansion bus hotkeys
- BEEP routed to internal speaker only
- F3 50/60Hz hotkey

After waiting for the next screen frame to begin, the loader restores the AY stereo mode that was active before the reset.

### Loading the Palette and Screen

The loader reads Offset 10 to determine whether a palette and loading screen are present.

**Palette**: The 512-byte palette block is skipped if bit 7 of Offset 10 is set, or if the screen type is ULA, HiRes, or HiColor (these modes don't use a NEX palette). Otherwise, the loader reads the palette and programs the appropriate hardware palette:

- **LoRes**: Enables ULANext and uploads to the primary ULA palette
- **Layer 2**: Uploads to the Layer 2 primary palette

**Loading screen**: Each screen type is loaded as follows:

| Screen type | Size        | Destination              | Notes                                    |
|-------------|-------------|--------------------------|------------------------------------------|
| Layer 2     | 48KB        | Banks 9, 10, 11          | Enables Layer 2; resets Timex port       |
| ULA         | 6,912 bytes | `$4000` (Bank 5)         | Disables Layer 2; resets Timex port      |
| LoRes       | 2 × 6,144 B | `$4000` and `$6000`      | Disables Layer 2; enables LoRes mode     |
| HiRes       | 2 × 6,144 B | `$4000` and `$6000`      | Disables Layer 2; enables HiRes mode     |
| HiColor     | 2 × 6,144 B | `$4000` and `$6000`      | Disables Layer 2; enables HiColor mode   |

All screen types set sprite priority to: sprites above Layer 2, Layer 2 above ULA.

The border color (Offset 11) is applied only if a loading screen is present.

After all screens are loaded, Bank 0 is paged back into Slot 3 (`$C000–$FFFF`).

### Loading Memory Banks

Banks are loaded in this fixed order: **5, 2, 0, 1, 3, 4, 6, 7**, then **8 through 111** sequentially. For each bank, the loader checks the corresponding flag byte in the header (Offsets 18–129). If the flag is set, the loader maps that bank to Slot 3 via MMU 6 and MMU 7 and reads 16KB of data from the file into `$C000–$FFFF`.

After each bank loads, the loader updates the loading progress indicator. If a loading screen is present, it also waits the number of frames specified in Offset 132 before proceeding.

### Starting Execution

Once all banks are loaded:

1. **File handle** (Offset 140): If the value is zero, the NEX file is closed. Otherwise, it remains open for the program to use.
2. **Entry bank** (Offset 139): The specified bank is paged into Slot 3 (`$C000–$FFFF`) via MMU 6 and MMU 7.
3. **File handle delivery**: If Offset 140 is in the range `$0001–$3FFF`, the file handle is placed in register BC. If it is in the range `$4000–$FFFF`, the file handle is written to that memory address.
4. **Stack pointer**: SP is set to the value at Offset 12.
5. **Program counter** (Offset 14):
   - **Zero**: The NEX file is closed, SP and Slot 3 are restored to their original values, and control returns to the NextBASIC prompt.
   - **Non-zero**: The loader jumps to that address with ZX Spectrum Next ROM3 paged in, starting your program.


## Creating NEX Files with Klive Assembler

You don't manually construct NEX files byte-by-byte (though you could). Klive IDE includes a Z80 assembler with built-in NEX file generation - it's the tool we'll use throughout this book.

Klive's assembler makes NEX creation straightforward using the `.model next` directive and `.savenex` pragma. Here's a complete example:

```z80klive
.model next

.savenex file "game.nex"
.savenex core 3, 1, 10       ; Require core 3.1.10
.savenex border 5            ; Cyan border

; Your code starts at $8000 automatically (unbanked code maps to bank 2)
main
    ld a, 2
    out (0xFE), a            ; Set border color
    call game_loop
    
trap
    jr trap

game_loop
    ; Game logic here
    ret
```

When you use `.model next`, Klive automatically sets sensible defaults:
- **RAM requirement**: 768KB
- **Border color**: 7 (white, unless you override it)
- **Entry address**: $8000
- **Bank mapping**: Unbanked code goes to bank 2

The `.savenex` pragma accepts multiple subcommands to configure every aspect of the NEX file:

**Basic Configuration:**
```z80klive
.savenex file "myapp.nex"        ; Output filename
.savenex ram 768                 ; 768KB or 1792KB
.savenex border 4                ; Green border (0-7)
.savenex stackaddr 0xFFFE        ; Stack pointer
.savenex entryaddr 0x8000        ; Entry point
.savenex entrybank 2             ; Bank at 0xC000 on startup
```

**Loading Screen:**
```z80klive
.savenex screen "layer2", "loading.scr"
.savenex palette "colors.nxp"
.savenex bar "on", 2, 50, 100    ; Enable loading bar: color 2, delay 50, start delay 100
```

**Advanced Features:**
```z80klive
.savenex copper "effects.cu"     ; Copper code for loading effects
.savenex filehandle "open"       ; Keep file open, pass handle in BC
.savenex preserve "on"           ; Preserve Next registers
```

**Multi-Bank Applications:**

For complex programs using multiple memory banks, combine unbanked code with explicit `.bank` sections:

```z80klive
.model next

.savenex file "multibank.nex"
.savenex core "3.1.0"

; Unbanked code in bank 2 at $8000
main
    ; Page in bank $20 to $A000-$BFFF
    nextreg $55, $40
    call DrawScreen
    jr main

; Explicit bank $20 code
.bank $20
.org $0000
.disp $a000

DrawScreen
    ; Drawing code here
    ret
```

The assembler tracks which banks your code uses and automatically includes them in the NEX file. Unbanked code (without `.bank` pragma) goes to bank 2 starting at $8000. Code with explicit `.bank` directives goes to the specified bank at the addresses you define.

## Version Differences: V1.0, V1.1, V1.2

The NEX format has evolved through three versions:

**V1.0** (original):

- Basic header structure
- Standard loading screens (Layer 2, ULA, LoRes)
- Bank loading with fixed order

**V1.1** (added):

- Timex HiRes and HiCol screen support
- Copper code block for loading effects
- Extended core version checking
- File handle preservation for streaming assets

**V1.2** (current, added):

- Layer 2 extended modes (320×256×8, 640×256×4)
- Palette offset for Layer 2 (**header offset 138** reused)
- Enhanced loading bar options
- Entry bank specification for cleaner initialization
