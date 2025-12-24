# Screen Rendering State Machine

The ZX Spectrum Next video rendering pipeline can be implemented as a **deterministic state machine** driven by two counters (HC, VC) that cycle through a fixed sequence of states representing the entire display frame. Each counter position (HC, VC) defines a unique rendering state where specific layers are fetched, processed, and output according to strictly defined timing rules. This document describes the complete state machine architecture, including counter ranges, timing relationships, layer rendering activities, and output composition.

> The Klive emulator has separate virtual machines for the ZX Spectrum 48K, 128K, +2A, and +3E models. The current emulator focuses on the ZX Spectrum Next, not the entire family of retro computers the TBBlue board supports.

The information used to build the state machine has been extracted from the ZX Spectrum Next FPGA project (https://gitlab.com/SpectrumNext/ZX_Spectrum_Next_FPGA) with AI assistance (Claude Sonnet 4.5). In each section, we include references to the original VHDL source code for verification.

**Document Status**: Updated December 2024 with detailed findings from VHDL source code analysis including:
- Complete ULA memory access timing and shift register operation
- Scroll sampling mechanisms and coordinate transformations
- Palette lookup architecture and timing
- Layer composition logic with all priority modes
- Blend modes and color mixing operations
- Layer 2 priority bit implementation

## 1. Rendering Pipeline

The ZX Spectrum Next rendering pipeline is a multi-stage architecture that transforms counter positions into final RGB pixels through parallel layer processing and composition. The pipeline operates at multiple clock rates (CLK_7, CLK_14, CLK_28) to achieve different rendering modes and resolutions.

Rendering activities occur at two distinct levels:

**Frame-Level Activities**: Certain operations occur once per frame and handle global state updates:

- **Flash Counter**: Incremented once per frame (typically at frame start, VC=0, HC=0). The counter cycles through flash states (typically 0-31 for ~1 Hz flash rate at 50 Hz) affecting ULA attribute interpretation (FLASH attribute bit 7). When the flash counter bit reaches threshold, INK and PAPER colors swap. Flash period: ~16 frames ON, ~16 frames OFF (approximately 0.32s at 50Hz, 0.27s at 60Hz). Full flash cycle: ~32 frames (~0.64s at 50Hz, ~0.55s at 60Hz). **Source**: ULA flash counter logic (implementation-specific, typically in ULA timing module).

- **Timing Mode Synchronization**: At frame boundary (VC transitions from max to 0), the system samples NextReg 0x03 and NextReg 0x05 bit 7, evaluates new timing mode configuration, updates counter ranges (maxHc, maxVc) and interrupt position coordinates for the next frame. This ensures timing mode changes take effect at frame boundaries, avoiding mid-frame configuration changes that could cause display artifacts. **Source**: `zxnext.vhd` lines 6694-6703 (vsync-synchronized register capture).

**Pixel-Level Activities**: The majority of rendering operations occur continuously for each pixel position, including layer pixel generation, palette lookup, composition, and output.

### 1.1 Pixel Rendering Pipeline Overview

```
┌────────────────────────────────────────────────────────────────────┐
│ STAGE 1: PARALLEL PIXEL GENERATION + PALETTE LOOKUP                │
│ Input: HC, VC, NextReg  │  Output: 5× (layer_rgb, layer_flags)     │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │ ULA LAYER        │  │ LAYER 2          │  │ SPRITES          │  │
│  │ (CLK_14)         │  │ (CLK_28)         │  │ (CLK_14)         │  │
│  ├──────────────────┤  ├──────────────────┤  ├──────────────────┤  │
│  │ • Scroll Sample  │  │ • Coord Transform│  │ • Line Buffer    │  │
│  │ • Addr Gen       │  │ • Scroll Apply   │  │   Read           │  │
│  │ • VRAM Read      │  │ • SRAM Fetch     │  │ • Visibility     │  │
│  │ • Shift Reg      │  │ • Pixel Extract  │  │   Check          │  │
│  │ • Pixel Gen      │  │ • Palette Offset │  │ • Priority       │  │
│  │ • Palette Lookup │  │ • Palette Lookup │  │   Resolution     │  │
│  │ • Clipping       │  │ • Clipping       │  │ • Palette Lookup │  │
│  │                  │  │                  │  │ • Clipping       │  │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘  │
│           │                     │                     │            │
│           ▼                     ▼                     ▼            │
│     RGB333 + flags        RGB333 + flags        RGB333 + flags     │
│                                                                    │
│  ┌──────────────────┐  ┌──────────────────┐                        │
│  │   TILEMAP        │  │   LORES          │                        │
│  │   (CLK_14)       │  │   (CLK_14)       │                        │
│  ├──────────────────┤  ├──────────────────┤                        │
│  │ • Tile Index     │  │ • Block Calc     │                        │
│  │ • Tile Attrs     │  │ • Block Fetch    │                        │
│  │ • Pattern Addr   │  │ • Pixel Replicate│                        │
│  │ • Pattern Fetch  │  │ • Palette Lookup │                        │
│  │ • Pixel Extract  │  │ • Clipping       │                        │
│  │ • Palette Lookup │  │                  │                        │
│  │ • Clipping       │  │                  │                        │
│  └────────┬─────────┘  └────────┬─────────┘                        │
│           │                     │                                  │
│           ▼                     ▼                                  │
│     RGB333 + flags        RGB333 + flags                           │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
                                │
                                │ All layers complete simultaneously
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STAGE 2: LAYER COMPOSITION (CLK_14)                                         │
│ Input: 5× RGB333 + flags  │  Output: final_rgb (RGB333)                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. Region Check ─────────► If blanking: final_rgb = BLACK → EXIT           │
│                             If border: final_rgb = BORDER_COLOR → EXIT      │
│                             Else: Continue (display area)                   │
│                                          │                                  │
│                                          ▼                                  │
│  2. Clipping Filter ──────► Set layer_transparent=true if layer_clipped     │
│                             Output: 5× layer_transparent flags (updated)    │
│                                          │                                  │
│                                          ▼                                  │
│  3. Stencil (optional) ───► If enabled: ula_rgb = ula_rgb AND tilemap_rgb   │
│                             Output: ula_rgb (modified if stencil active)    │
│                                          │                                  │
│                                          ▼                                  │
│  4. Blend (optional) ─────► Apply color math: mix/add/darken layer pairs    │
│                             Output: layer_rgb values (modified if blending) │
│                                          │                                  │
│                                          ▼                                  │
│  5. Priority Selection ───► Select first non-transparent layer by priority  │
│                             (L2 priority bit can override order)            │
│                             Output: selected_rgb (RGB333) or none           │
│                                          │                                  │
│                                          ▼                                  │
│  6. Backdrop Fallback ────► If no layer selected: final_rgb = BACKDROP      │
│                             Else: final_rgb = selected_rgb                  │
│                                          │                                  │
│                                          ▼                                  │
│                                   final_rgb (RGB333)                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ RETIMING DELAY (3 × CLK_14 cycles)                                          │
│ For synthesis optimization                                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                          Output: RGB333 + Sync
```

The rendering pipeline consists of two main stages synchronized to different clock domains:

1. **Pixel Generation + Palette Lookup** (CLK_7/CLK_14/CLK_28): Each layer independently generates pixel indices and performs palette lookup in parallel
2. **Composition Stage** (CLK_14): Combine layers based on priority and transparency

**Pipeline Latency**: Approximately 3 CLK_7 cycles from counter position to final output.

**Key Characteristic**: All layers process simultaneously - while one layer generates pixel indices, it immediately performs palette lookup. There is no sequential dependency between layers until the composition stage.

**Source code references**:
- Pixel generation (all layers): `zxnext.vhd` lines 6800-6900 (layer pixel processing)
- Palette lookup (parallel with generation): `zxnext.vhd` line 6937 comment, lines 6950-7050 (palette memory access)
- Composition stage: `zxnext.vhd` lines 7100-7350 (layer mixing and priority evaluation)

### 1.2 Stage 1: Pixel Generation + Palette Lookup (Per Layer)

**Input**: HC, VC (counter positions), NextReg configuration (scrolling, clipping, palette selection, enable flags)

**Output**: For each layer: `layer_rgb` (RGB333 color), `layer_clipped` (boolean), `layer_transparent` (boolean), plus layer-specific flags (e.g., Layer 2 priority bit)

Each rendering layer operates independently and in parallel during this stage. All layers follow a common pattern but with layer-specific details.

#### Common Layer Processing Pattern

All layers operate **in parallel** with independent hardware for memory access and palette lookup. The actual execution involves **overlapping and simultaneous operations**:

**Pipelined Operations** (overlapping across multiple pixels):
- **Address Calculation & Coordinate Transforms**: Each layer independently calculates memory addresses, applying scrolling offsets and coordinate transformations at specific HC sub-cycle positions
- **Memory Fetch**: Layers read from their respective memories at different clock rates (CLK_7, CLK_14, CLK_28) and HC sub-cycle positions:
  - **ULA**: VRAM (16KB video RAM at $4000-$7FFF) for pixel and attribute data
  - **Layer 2**: SRAM (external 512KB+ RAM) for high-resolution pixel buffers
  - **Sprites**: Internal FPGA memory (on-chip block RAM) for sprite pattern memory and line buffers
  - **Tilemap**: Internal FPGA memory (on-chip block RAM) for tilemap and tile pattern memory
  - **LoRes**: VRAM (shares ULA memory space)
- **Pixel Index Generation**: As pixel data arrives from memory, generate 8-bit palette index for current pixel
- **Palette Lookup**: Immediately convert the palette index to RGB333 color (happens as soon as index is ready)
- **Pipeline Overlap**: While palette lookup occurs for pixel N, memory fetches continue for pixels N+1, N+2, etc.

**Evaluation Order** (after pixel generation completes):
1. **Clipping Test**: Determine if pixel is within layer's clip window
   - If within window: `layer_clipped = false` (pixel is visible)
   - If outside window: `layer_clipped = true` (pixel will be treated as transparent in Stage 2)
2. **Transparency Determination**: Check if pixel should be treated as transparent
   - If transparent: `layer_transparent = true` (pixel will be skipped in Stage 2 composition)
   - If opaque: `layer_transparent = false` (pixel may be selected in Stage 2 composition)

**Key Characteristics**:
- Each layer has **independent hardware** - ULA, Layer 2, Sprites, Tilemap, and LoRes
- **Pipelined execution**: While palette lookup occurs for pixel N, memory fetches continue for future pixels (N+1, N+2...)
- Memory fetches occur at **specific HC sub-cycle positions** unique to each layer (detailed in layer-specific sections below)
- All layers complete their processing and output RGB333 values simultaneously, ready for Stage 2 composition

#### Palette Lookup Details (Common Across All Layers)

While each layer performs palette lookup as part of its pixel generation process, the lookup mechanism is shared across the system:

**Palette Architecture**:
- **ULA palette**: 256 entries × 9 bits (RGB333) - NextReg 0x43 selects bank
- **Tilemap palette**: 256 entries × 9 bits (RGB333) - NextReg 0x6B bit 4 selects bank
- **Layer 2/Sprite shared palette**: 512 entries × 10 bits (RGB333 + priority bit) - NextReg 0x43 selects banks

**Timing**: Palette lookup occurs at CLK_14 or CLK_28 rate depending on layer, synchronized with pixel generation

**Memory Access**: Each layer accesses palette RAM using its generated 8-bit index. Layer 2 and sprites share a palette memory with separate address spaces (bit 9 distinguishes them).

**Source**: `zxnext.vhd` lines 6950-7050 (palette RAM instantiation and lookup)

### 1.3 Stage 2: Layer Composition

**Input**: 5× layer outputs from Stage 1 - each with `layer_rgb` (RGB333), `layer_clipped` (boolean), `layer_transparent` (boolean), plus HC/VC for region detection and NextReg configuration for priority/blend modes

**Output**: `final_rgb` (RGB333 color) - the single pixel color to be output to the display

The final stage combines all layer outputs into a single pixel based on transparency, priority, and special blending modes.

**Timing**: CLK_14 (purely combinational logic)

**Process**:

1. **Border/Blanking Check**:
   - If blanking region: Output black (RGB 000)
   - If border area: Output border color (NextReg 0x43)
   - Otherwise: Proceed to layer composition

2. **Transparency Resolution**:
   - **ULA**: Transparent if RGB matches transparent_rgb (NextReg 0x14) AND clipped
   - **Layer 2**: Transparent if RGB matches transparent_rgb ($E3) OR not enabled
   - **Sprites**: Transparent if no sprite pixel available
   - **Tilemap**: Transparent if RGB matches transparent_rgb OR per-tile transparency
   - **LoRes**: Transparent if RGB matches transparent_rgb OR clipped

3. **Stencil Mode** (NextReg 0x68 bit 0):
   - If enabled: AND ULA and Tilemap colors together (bitwise AND of RGB values)

4. **Blend Mode Processing** (NextReg 0x68 bits [7:6]):
   - **Mode 00**: Standard ULA + top/bottom tilemap
   - **Mode 10**: Combined ULA/Tilemap
   - **Mode 11**: Swapped ULA/Tilemap priority
   - **Mode 110**: Color addition (Layer 2 + ULA/Tilemap), clamped at 7
   - **Mode 111**: Color addition with darkening (add then subtract 5), clamped

5. **Priority Evaluation** (NextReg 0x15 bits [4:2]):
   - Evaluate layers in configured priority order: SLU, LSU, SUL, LUS, USL, ULS, or blend modes
   - **Layer 2 Priority Promotion**: If Layer 2 priority bit is set, it renders on top regardless of priority setting
   - **Special Cases**: In some modes (LUS, USL, ULS), sprites can show through ULA border when tilemap is transparent
   - Select first non-transparent, non-clipped layer in priority order

6. **Fallback Color**:
   - If all layers are transparent: Output fallback/backdrop color (NextReg 0x4A)

**Output**: `final_rgb` (RGB333 color) - sent to retiming delay stage

**Source**: `zxnext.vhd` lines 7100-7350 (transparency checks, blend modes, priority evaluation)

### 1.4 Pipeline Synchronization and Timing

The pipeline maintains strict timing relationships between stages:

- **Pixel Generation + Palette Lookup**: ~1.5 CLK_7 cycles per layer (all layers in parallel)
- **Composition**: 0 additional cycles (combinational logic, same CLK_14 cycle as palette outputs)
- **Retiming Delay**: 3 CLK_14 cycles (output buffering for synthesis optimization)
- **CLK_7** (7 MHz): Primary pixel clock, counter advancement, ULA memory access
- **CLK_14** (14 MHz): Pixel output rate (2 pixels per CLK_7), palette lookup, composition
- **CLK_28** (28 MHz): High-speed Layer 2 memory access (4 pixels per CLK_7 in 640×256 mode)

**Pixel Output Rates**:
- Standard resolution: 2 pixels per CLK_7 (at CLK_14 rate)
- Layer 2 640×256: 4 pixels per CLK_7 (at CLK_28 rate)

**Source**: `zxnext.vhd` lines 7380-7450 (retiming delay pipeline stages)

### 1.5 ULA Layer Implementation Details

The ULA layer is the foundation of ZX Spectrum rendering and implements the classic display memory layout with enhancements for scrolling and palette modes.

#### Memory Organization

**VRAM Address Space**: 16KB at $4000-$7FFF (or $6000-$9FFF for shadow screen)

**Pixel Memory Layout** (8192 bytes, $4000-$5FFF):
```
Address bits: {py[7:6], py[2:0], py[5:3], px[7:3]}
```
This creates the characteristic "thirds" layout where:
- py[7:6] selects which third of the screen (0, 1, 2)
- py[2:0] selects scan line within character row
- py[5:3] selects character row within third
- px[7:3] selects byte column (0-31)

**Attribute Memory Layout** (768 bytes, $5800-$5AFF):
```
Address bits: {'110', py[7:3], px[7:3]}
```
One attribute byte per 8×8 pixel block:
- Bit 7: FLASH (swap INK/PAPER every ~16 frames)
- Bit 6: BRIGHT (add 8 to INK/PAPER palette index)
- Bits 5-3: PAPER color (0-7)
- Bits 2-0: INK color (0-7)

#### Scroll Implementation

**Horizontal Scrolling** (NextReg 0x26, 8 bits):
- Scroll amount sampled at HC 0x3 and 0xB (falling edge CLK_7)
- Applied to pixel coordinate: `px = hc[7:3] + scroll_x[7:3]`
- Fine scroll (bits 2:0) applied via shift register
- Wraps at 256-pixel boundary (32 bytes)

**Vertical Scrolling** (NextReg 0x27, 8 bits):
- Scroll amount sampled at HC 0x3 and 0xB (falling edge CLK_7)
- Applied to line coordinate: `py = vc + scroll_y`
- Special wrapping for py >= 192: wraps to maintain 192-line display area

**Fine Horizontal Scrolling** (NextReg 0x26 bit 0 via NextReg 0x70 bit 0):
- When enabled: adds extra bit to X coordinate (`px[8] = fine_scroll`)
- Allows half-character (4-pixel) scrolling granularity

#### Memory Access Timing

The ULA fetches memory on a fixed schedule within each character (8-pixel) block:

**HC Subcycle Schedule** (one CLK_7 cycle = 16 HC subcycles 0x0-0xF):

| HC[3:0] | CLK_7 Edge | Activity |
|---------|------------|----------|
| 0xF | Rising | Generate address for pixel byte (ahead+1) |
| 0x0 | Rising | Read pixel byte from VRAM |
| 0x1 | Falling | Capture pixel byte → pbyte11 |
| 0x1 | Rising | Generate address for attribute byte (ahead+1) |
| 0x2 | Rising | Read attribute byte from VRAM |
| 0x3 | Falling | Capture attribute byte → abyte11, **sample scroll registers** |
| 0x3 | Rising | Generate address for pixel byte (ahead, 2nd half) |
| 0x4 | Rising | Read pixel byte, **shift register load trigger** |
| 0x5 | Falling | Capture pixel byte → pbyte01 |
| 0x5 | Rising | Generate address for attribute byte (ahead, 2nd half) |
| 0x6 | Rising | Read attribute byte from VRAM |
| 0x7 | Falling | Capture attribute byte → abyte01, record scroll for load |
| 0x7 | Rising | Generate address for pixel byte (current) |
| 0x8 | Rising | Read pixel byte from VRAM |
| 0x9 | Falling | Capture pixel byte → pbyte00, **floating bus update** |
| 0x9 | Rising | Generate address for attribute byte (current) |
| 0xA | Rising | Read attribute byte from VRAM |
| 0xB | Falling | Capture attribute byte → abyte00, **sample scroll registers**, **floating bus update** |
| 0xB | Rising | Generate address for pixel byte (ahead, 1st half) |
| 0xC | Rising | Read pixel byte, **shift register load trigger** |
| 0xD | Falling | Capture pixel byte → pbyte10, **floating bus update** |
| 0xD | Rising | Generate address for attribute byte (ahead, 1st half) |
| 0xE | Rising | Read attribute byte from VRAM |
| 0xF | Falling | Capture attribute byte → abyte10, **floating bus update** |

**Key Observations**:
- Memory accesses occur every other HC subcycle (0x0, 0x2, 0x4, 0x6, 0x8, 0xA, 0xC, 0xE)
- Address generation precedes read by one subcycle
- Captures occur on falling edge, one subcycle after read
- Two shift register loads per character (at 0xC and 0x4) provide continuous pixel stream
- Scroll sampling occurs twice per character to accommodate mid-character changes

#### Shift Register Operation

**Loading** (CLK_14, triggered at HC 0xC and 0x4):
1. Combine two pixel bytes (16 bits) and two attribute bytes (16 bits)
2. For HiRes mode: double each pixel bit (bit 7 → bits 15,14, bit 6 → bits 13,12, etc.)
3. Apply scroll offset: left-shift the 32-bit register by scroll[2:0] positions
4. Load upper 16 bits into shift register

**Shifting** (CLK_14, every cycle when not loading):
- Shift left by 1 position, feed 0 from right
- MSB (bit 15) becomes current pixel

**Attribute Handling**:
- Attribute register loaded simultaneously with pixel register
- Two 8-bit attributes stored (for 16 pixels)
- Counter tracks which attribute applies to current pixel
- Border detection forces attribute to border color

#### Pixel Generation and Palette Lookup

**Palette Index Generation** (CLK_14, combinational):

1. **Border Detection**: Check if hc[8] or vc[8] or (vc[7] AND vc[6]) is set
2. **Pixel Extraction**: Use shift_reg[15] (MSB) as pixel value
3. **Flash Logic**: XOR pixel with (attr[7] AND flash_counter[4]) for standard ULA
4. **Ink/Paper Selection**:
   - If pixel=1: INK color (attr[2:0] + BRIGHT*8)
   - If pixel=0: PAPER color (attr[5:3] + BRIGHT*8)
   - If border: border color (port $FE bits 2:0)

5. **Palette Mode**:
   - **Standard ULA**: 4-bit index {0, 0, 0, ink/paper_select, BRIGHT, color[2:0]}
   - **ULA+**: 8-bit index {1, 1, attr[7:6], ink/paper_select, color[2:0]}
   - **ULANext**: Configurable via NextReg 0x42 (format mask), allows attribute reinterpretation

**Palette Lookup** (CLK_28 inverted edge, dual-port RAM):
- Port A: CPU/copper writes (28 MHz)
- Port B: Video reads (28 MHz, alternating with Layer 2/sprite palette)
- Address: 10 bits {ula_palette_select, palette_index[7:0]}
- Data: 9 bits RGB333
- Lookup latency: 1 cycle (registered output)

**Timing**: Palette lookup occurs at CLK_28 inverted edge, alternating between ULA/Tilemap (sc[0]=0) and Layer2/Sprites (sc[0]=1).

#### Transparency and Clipping

**Transparency Determination** (Stage 2, CLK_14):
```vhdl
ula_mix_transparent = (ula_rgb[8:1] == transparent_rgb) OR ula_clipped
```
Note: Only upper 8 bits compared (RGB333 format, LSB ignored)

**Clipping** (combinational):
```vhdl
ula_clipped = NOT ((phc >= clip_x1 AND phc <= clip_x2 AND vc >= clip_y1 AND vc <= clip_y2) OR border_active)
```
Border pixels are never clipped (always visible)

**Source References**:
- Memory fetch: `zxula.vhd` lines 220-265
- Scroll sampling: `zxula.vhd` lines 195-215
- Shift register: `zxula.vhd` lines 385-410
- Pixel generation: `zxula.vhd` lines 490-570
- Palette architecture: `zxnext.vhd` lines 6906-6932

## 2. Timing Modes

### 2.1 Timing Mode Selection

The active timing mode is determined by **NextReg 0x03** (Machine Timing) bits [2:0] and **NextReg 0x05** (Peripheral 2) bit 7 (50/60 Hz):

| NextReg 0x03[2:0] | NextReg 0x05[7] | Mode | Description |
|---|---|---|---|
| `1xx` (bit 2 = 1) | 0 or 1 | Pentagon | Russian clone timing |
| `010` | 0 | 128K 50Hz | Sinclair 128K PAL |
| `010` | 1 | 128K 60Hz | Sinclair 128K NTSC |
| `011` | 0 | +3 50Hz | Amstrad +3 PAL |
| `011` | 1 | +3 60Hz | Amstrad +3 NTSC |
| `0x0` or `0x1` (bit 1 = 0) | 0 | 48K 50Hz | Original Spectrum PAL |
| `0x0` or `0x1` (bit 1 = 0) | 1 | 48K 60Hz | Original Spectrum NTSC |

> The subsequent sections focus on the ZX Spectrum Next, which uses the +3 Timing modes. The current implementation checks only the change in NextReg 0x05, Bit 7 (50Hz or 60Hz mode).

**Source code references**:
- Timing mode decoding: `zxula_timing.vhd` lines 147-178 (`i_timing` signal bit testing)
- Mode synchronization: `zxnext.vhd` lines 6694-6703 (vsync-synchronized register capture)
- Effective timing signal: `zxnext.vhd` line 1377 (`eff_nr_03_machine_timing`, default = `"011"` for +3)

### 2.2 Counter Ranges and Frame Timing

The rendering system uses a **single set of logical counters** (HC, VC) for +3 timing modes. Counter ranges determine frame dimensions and refresh rates.

| Mode | HC Range | VC Range | Physical Resolution | Frame Time | Frame Rate | Total Pixels |
|---|---|---|---|---|---|---|
| **+3 50Hz** | 0-455 | 0-310 | 456 × 311 | 20.12 ms | 49.70 Hz | 141,816 |
| **+3 60Hz** | 0-455 | 0-263 | 456 × 264 | 17.22 ms | 58.07 Hz | 120,384 |


**Notes**:
- The physical resolution represents virtual pixels. Some of them are blanking or syncing pixels, and they do not result in active rendered pixels.
- Both modes use CLK_7 (7 MHz) for counter advancement
- Hi-res rendering: 2 pixels per HC position at CLK_14 rate (912 pixels horizontally)

**Timing Mode Changes**:
Changes to **NextReg 0x03** bits [6:4] (machine timing) and **NextReg 0x05** bit 7 (50/60 Hz) are **synchronized to vsync**.

**Source code references**:
- Counter range constants: `zxula_timing.vhd` lines 180-241 (+3 50Hz/60Hz timing branches)
- Max counter values: `c_max_hc` (line 196), `c_max_vc` (line 204 for 50Hz, line 238 for 60Hz)
- 50/60 Hz selection: `i_50_60` signal tested at line 180

### 2.3 Timing Mode Attributes

Each timing mode divides the frame into distinct horizontal and vertical regions based on the HC and VC counter values. Understanding these regions is essential for implementing the rendering state machine.

> **Emulator Note**: The emulator uses the same HC/VC counter ranges as the real hardware (HC: 0-455, VC: 0-310/263). All counter positions are processed by the rendering state machine, including blanking/sync regions. However, only visible pixels (non-blanking) are mapped to the output bitmap. This ensures accurate timing simulation while producing the correct 360×288 (50Hz) or 360×240 (60Hz) visible screen.

#### Horizontal Timing

| Region | HC Range | Width | Description | Bitmap Mapping |
|---|---|---|---|---|
| **Horizontal Blanking** | 0-95 | 96 | No pixel output, includes HSYNC | Not mapped to bitmap |
| **Left Border** | 96-143 | 48 | Border color output | Bitmap X: 0-47 |
| **Active Display** | 144-399 | 256 | ULA/Layer pixel rendering | Bitmap X: 48-303 |
| **Right Border** | 400-455 | 56 | Border color output | Bitmap X: 304-359 |
| **Total** | 0-455 | **456** | Complete horizontal line | Visible: 360 pixels |

#### Vertical Timing

**+3 50Hz Mode (VC: 0-310)**:

| Region | VC Range | Height | Description | Bitmap Mapping |
|---|---|---|---|---|
| **Vertical Blanking** | 0-7 | 8 | No pixel output, includes VSYNC | Not mapped to bitmap |
| **Top Padding** | 8-15 | 8 | No pixel output | Not mapped to bitmap |
| **Top Border** | 16-63 | 48 | Border color output | Bitmap Y: 0-47 |
| **Active Display** | 64-255 | 192 | ULA/Layer pixel rendering | Bitmap Y: 48-239 |
| **Bottom Border** | 256-303 | 48 | Border color output | Bitmap Y: 240-287 |
| **Bottom Padding** | 304-310 | 7 | No pixel output | Not mapped to bitmap |
| **Total** | 0-310 | **311** | Complete frame | Visible: 288 lines |

**+3 60Hz Mode (VC: 0-263)**:

| Region | VC Range | Height | Description | Bitmap Mapping |
|---|---|---|---|---|
| **Vertical Blanking** | 0-15 | 16 | No pixel output, includes VSYNC 1-4 | Not mapped to bitmap |
| **Top Border** | 16-39 | 24 | Border color output | Bitmap Y: 0-23 |
| **Active Display** | 40-231 | 192 | ULA/Layer pixel rendering | Bitmap Y: 24-215 |
| **Bottom Border** | 232-255 | 24 | Border color output | Bitmap Y: 216-239 |
| **Bottom Blanking** | 256-263 | 8 | No pixel output | Not mapped to bitmap |
| **Total** | 0-263 | **264** | Complete frame | Visible: 240 lines |

#### Frame Interrupt Timing

Each timing mode has specific (HC, VC) coordinates where the interrupt is triggered. The ULA generates a single CLK_7 cycle trigger which is then stretched for reliable CPU detection.

| Mode | HC | VC | Pulse Count | Position |
|---|---|---|---|---|
| **+3 50Hz** | 138 | 1 | 32 CPU cycles | Left border (42px from left edge) |
| **+3 60Hz** | 138 | 0 | 32 CPU cycles | Left border (42px from left edge) |

**Calculation explanation**: The VHDL uses internal counter `i_hc` which has a 12-position offset from the visible pixel counter used in our documentation. The interrupt position is calculated as `i_hc = 136+2-12 = 126`, where 136 is `c_min_hactive` (active display start in internal coordinates), +2 is the +3 mode offset, and -12 accounts for pipelining. In our documented HC coordinates (which match visible pixel generation), this corresponds to **HC = 138** (126 + 12 offset), placing the interrupt in the left border region, 42 positions after the visible area begins (HC 96) and 6 positions before the active display starts (HC 144).

**Source code references**:
- Interrupt HC position: `zxula_timing.vhd` line 189 (50Hz), line 223 (60Hz)
  - `c_int_h <= to_unsigned(136+2-12, 9);` for +3 (bit 0 of `i_timing` = 1)
  - Internal `i_hc = 126` corresponds to documented HC = 138 (adds 12-position offset)
- Interrupt VC position: `zxula_timing.vhd` line 199 (50Hz = 1), line 233 (60Hz = 0)
  - `c_int_v <= to_unsigned(1, 9);` or `to_unsigned(0, 9);`
- Pulse count logic: `zxnext.vhd` line 2033
  - `pulse_count_end <= pulse_count(5) and (machine_timing_48 or machine_timing_p3 or pulse_count(2));`
  - For +3: ends at count 32 (when bit 5 = 1)

#### Timing Configuration

The `TimingConfiguration` type represents the configuration values described above:

```typescript
type TimingConfig = {
  // Horizontal timing (HC counter values)
  firstVisibleHC: number; // First visible HC position
  displayXStart: number;  // Start of active display area
  displayXEnd: number;    // End of active display area
  maxHC: number;          // Maximum HC value
  
  // Vertical timing (VC counter values) - MODE DEPENDENT
  firstBitmapVC: number;  // First line mapped to bitmap
  displayYStart: number;  // Active display start
  displayYEnd: number;    // End of active display area
  lastBitmapVC: number;   // Last line mapped to bitmap
  maxVC: number;          // Maximum VC value
  
  // Interrupt timing
  intHC: number;          // HC position where interrupt triggers
  intVC: number;          // VC position where interrupt triggers
  intPulseLength: number; // Number of CPU cycles for interrupt pulse
};

// Example: +3 50Hz configuration
const Plus3_50Hz: TimingConfig = {
  firstVisibleHC: 96,
  displayXStart: 144,
  displayXEnd: 399,
  maxHC: 455,
  firstBitmapVC: 16,
  displayYStart: 64,
  displayYEnd: 255,
  lastBitmapVC: 303,
  maxVC: 310,
  intHC: 138,
  intVC: 1,
  intPulseLength: 32
};

// Example: +3 60Hz configuration
const Plus3_60Hz: TimingConfig = {
  firstVisibleHC: 96,
  displayXStart: 144,
  displayXEnd: 399,
  maxHC: 455,
  firstBitmapVC: 16,
  displayYStart: 40,
  displayYEnd: 231,
  lastBitmapVC: 255,
  maxVC: 263,
  intHC: 138,
  intVC: 0,
  intPulseLength: 32
};
```

> **Note**: In the subsequent section, the documentation uses the `TimingConfig` property names to reference these configuration values.

#### Display Bitmap Configuration

For emulation purposes, a **fixed-size bitmap** represents the visible portion of the display across all timing modes and rendering modes.

**Bitmap size**: **720 × 288 pixels** (fixed for all modes)

**Horizontal Resolution Scaling**:
The bitmap uses 720 pixels horizontally to transparently support all resolution modes:
- **HiRes** (512 pixels): Each source pixel rendered once (1:1 mapping)
- **Standard** (256 pixels): Each source pixel rendered twice (1:2 mapping)
- **LoRes** (128 pixels): Each source pixel rendered four times (1:4 mapping)

This allows seamless switching between resolution modes without bitmap reallocation. The visible area (HC 96-455) maps to bitmap X 0-719 with appropriate pixel replication per mode.

**Vertical Resolution**:
- **50Hz**: 288 lines (VC 16-303 mapped to Y 0-287) — fills entire bitmap height
- **60Hz**: 240 lines (VC 16-255 mapped to Y 24-263) — top 24 and bottom 24 lines rendered as transparent pixels

## 3. Rendering Activity Matrix

Each timing mode can be represented as a **(config.maxVC + 1) × (config.maxHC + 1) matrix** where each cell (vc, hc) defines the complete set of rendering activities that occur at that counter position. This matrix-based approach provides a deterministic state machine where the current (HC, VC) position fully determines all rendering behavior.

### 3.1 Matrix Dimensions by Timing Mode and Layer

Each combination of timing mode and rendering layer requires a separate matrix. The matrix dimensions are determined by the timing mode, while the rendering activities within each cell depend on the active layer and its configuration.

#### +3 50Hz Matrices (311 × 456 = 141,816 states)

| Matrix ID | Layer/Mode | Display Area Activities |
|---|---|---|
| **Plus3_50Hz_ULA_Std** | ULA Standard | Pixel/attr reads, shift register, 256×192 |
| **Plus3_50Hz_ULA_HiRes** | ULA Timex Hi-Res | Dual pixel reads, 512×192 |
| **Plus3_50Hz_ULA_HiColor** | ULA Timex Hi-Color | Pixel + color reads, 256×192 |
| **Plus3_50Hz_L2_256x192** | Layer 2 256×192 | Direct pixel reads, 1 byte per pixel |
| **Plus3_50Hz_L2_320x256** | Layer 2 320×256 | Direct pixel reads, adjusted timing |
| **Plus3_50Hz_L2_640x256** | Layer 2 640×256 | 4 pixels per CLK_7, faster fetch |
| **Plus3_50Hz_Sprites** | Sprites | Pattern fetch for visible sprites |
| **Plus3_50Hz_Tilemap_40x32** | Tilemap 40×32 | Tile definition + pattern fetch |
| **Plus3_50Hz_Tilemap_80x32** | Tilemap 80×32 | Tile definition + pattern fetch, doubled rate |
| **Plus3_50Hz_LoRes_128x96** | LoRes 128×96 | Block reads, 4×4 pixel scaling |

#### +3 60Hz Matrices (264 × 456 = 120,384 states)

| Matrix ID | Layer/Mode | Display Area Activities |
|---|---|---|
| **Plus3_60Hz_ULA_Std** | ULA Standard | Pixel/attr reads, shift register, 256×192 |
| **Plus3_60Hz_ULA_HiRes** | ULA Timex Hi-Res | Dual pixel reads, 512×192 |
| **Plus3_60Hz_ULA_HiColor** | ULA Timex Hi-Color | Pixel + color reads, 256×192 |
| **Plus3_60Hz_L2_256x192** | Layer 2 256×192 | Direct pixel reads, 1 byte per pixel |
| **Plus3_60Hz_L2_320x256** | Layer 2 320×256 | Direct pixel reads, adjusted timing |
| **Plus3_60Hz_L2_640x256** | Layer 2 640×256 | 4 pixels per CLK_7, faster fetch |
| **Plus3_60Hz_Sprites** | Sprites | Pattern fetch for visible sprites |
| **Plus3_60Hz_Tilemap_40x32** | Tilemap 40×32 | Tile definition + pattern fetch |
| **Plus3_60Hz_Tilemap_80x32** | Tilemap 80×32 | Tile definition + pattern fetch, doubled rate |
| **Plus3_60Hz_LoRes_128x96** | LoRes 128×96 | Block reads, 4×4 pixel scaling |

**Summary**:
- **2 timing modes** × **11 layer/mode combinations** = **22 distinct rendering matrices**
- Layer combinations (e.g., ULA + Layer 2 + Sprites) use priority evaluation and composite activities from multiple single-layer matrices
- All matrices within the same timing mode share identical timing activities (blanking, interrupt, flash counter) and border rendering

### 3.2 Rendering Activities per Cell

Each matrix cell defines which activities occur at that specific (vc, hc) position. Activities are evaluated **after** counters increment on CLK_7 rising edge. This section lists the (optional) activities that result in a rendered pixel and related side effects, such as setting the floating bus value.

#### Timing & Synchronization

| Activity | Description |
|---|---|
| **Blanking** | No visible pixel rendered (includes sync pulses and blanking periods). Occurs when `hc < config.firstVisibleHC` OR `vc < config.firstBitmapVC` OR `vc > config.lastBitmapVC` |

#### Border Rendering

| Activity | Description |
|---|---|
| **Border Area** | Outside active display area. Occurs when not blanking AND (`hc < config.displayXStart` OR `hc > config.displayXEnd` OR `vc < config.displayYStart` OR `vc > config.displayYEnd`) |
| **Border Output** | Output border color (NextReg 0x43) |

#### Memory Contention

| Activity | Description |
|---|---|
| **Contention Window** | Check if in contention window (48K: [0x4,0xF], +3: [0x3,0xF]) |
| **Memory Contention** | Delay CPU memory access (simulated only - dual-port BRAM) |
| **IO Contention** | Delay CPU I/O access (simulated) |

#### Floating Bus

| Activity | Description |
|---|---|
| **Floating Bus Update** | Update floating bus register with last read data |
| **Floating Bus Clear** | Clear floating bus to 0xFF |

#### Layer Pixel Generation

All layers perform pixel generation activities in parallel during the display area. Each layer has specific timing requirements and memory access patterns (detailed in layer-specific sections):

| Activity | Description |
|---|---|
| **ULA** | Scroll sampling, pixel/attribute address generation, VRAM reads, shift register operations, pixel generation, palette lookup, clipping |
| **Layer 2** | Coordinate transforms, scroll application, SRAM fetch, pixel extraction, palette lookup, clipping |
| **Sprites** | Line buffer reads, visibility checks, priority resolution, palette lookup, clipping |
| **Tilemap** | Tile index/attributes fetch, pattern address generation, pattern fetch, pixel extraction, palette lookup, clipping |
| **LoRes** | Block calculation, block fetch, pixel replication (4×4 or 4×8 scaling), palette lookup, clipping |

#### Layer Composition

| Activity | Description |
|---|---|
| **Priority Evaluation** | Evaluate layer priorities (ULA, Layer 2, Sprites, Tilemap, LoRes) |
| **Transparency Check** | Check transparency for each layer pixel |
| **Final Pixel Mix** | Combine layers based on priority and transparency |
| **Output Pixel** | Output final RGB pixel to display |

### 3.3 ULA Standard Rendering Activities

The ULA Standard mode implements the classic ZX Spectrum display with enhancements for scrolling and palette modes. This section details the specific rendering activities that occur at each (VC, HC) position, as determined by the `generateULAStandardCell` function and executed by the `renderULAStandardPixel` function.

#### Activity Matrix Generation

The `generateULAStandardCell` function generates a **Uint16 bit flags value** for each (VC, HC) position. These flags indicate which rendering activities should occur at that specific counter position. The matrix is pre-calculated once for each timing mode (50Hz/60Hz) and stored for efficient lookup during rendering.

**Matrix Structure**:
- **Dimensions**: (config.totalVC) × (config.totalHC) = 311 × 456 (50Hz) or 264 × 456 (60Hz)
- **Cell Type**: Uint16 bit flags (16 independent boolean flags per cell)
- **Access Pattern**: Direct array indexing: `flags = matrix[vc * totalHC + hc]`
- **Memory Size**: ~284 KB (50Hz) or ~241 KB (60Hz) per matrix

#### Bit Flag Definitions

Each ULA Standard cell uses the following bit flags (defined in RenderingCell.ts):

| Flag | Bit | Description |
|------|-----|-------------|
| `ULA_DISPLAY_AREA` | 0 | HC/VC is within active display area (256×192) |
| `ULA_BORDER_AREA` | 1 | HC/VC is in border area (visible but outside display) |
| `ULA_CONTENTION_WINDOW` | 2 | Memory contention applies (delays CPU access) |
| `ULA_SCROLL_SAMPLE` | 3 | Sample scroll registers at this HC position |
| `ULA_PIXEL_READ` | 4 | Read pixel byte from VRAM |
| `ULA_ATTR_READ` | 5 | Read attribute byte from VRAM |
| `ULA_SHIFT_REG_LOAD` | 6 | Load shift register with new pixel/attribute data |
| `ULA_FLOATING_BUS_UPDATE` | 7 | Update floating bus value with last read byte |

**Blanking Cells**: If (VC, HC) is in a blanking region, the cell value is 0 (all flags clear), indicating no rendering activity.

#### Region Detection

The generation process first determines which region the current (VC, HC) position belongs to:

1. **Blanking Check** (`!isVisibleArea(config, vc, hc)`):
   - Horizontal blanking: HC < 96
   - Vertical blanking: VC < config.firstBitmapVC or VC > config.lastBitmapVC
   - If blanking: return 0 immediately (no flags set)

2. **Display Area Detection** (`isDisplayArea(config, vc, hc)`):
   - Display area: HC ∈ [144, 399] AND VC ∈ [config.displayYStart, config.displayYEnd]
   - If display area: set `ULA_DISPLAY_AREA` flag
   - Otherwise: set `ULA_BORDER_AREA` flag

3. **Contention Window** (`isContentionWindow(hc, displayArea)`):
   - For +3 timing: HC[3:0] ∈ [0x3, 0xF] within display area
   - If in contention window: set `ULA_CONTENTION_WINDOW` flag

#### Memory Fetch Optimization Gate

**Hardware Behavior** (from zxula.vhd lines 48-51):
> "Because display memory is held in dual port bram, there is no real contention in the zx next... And because there is no shortage of memory bandwidth to bram, this implementation may continually access bram even outside the display area with no detrimental impact on the system."

The FPGA hardware continuously performs memory fetches throughout the entire frame, even during border periods. This is enabled by the dual-port BRAM architecture which provides unlimited memory bandwidth.

**Emulator Optimization**:
However, in software emulation, these border reads waste CPU cycles without affecting observable behavior. The emulator optimizes by gating memory fetch activities:

```typescript
const fetchActive =
  vc >= config.displayYStart &&
  vc <= config.displayYEnd &&
  hc >= config.displayXStart - 16 &&
  hc <= config.displayXEnd;
```

**Optimization Strategy**:
1. **Vertical gating**: Skip top/bottom borders (rows outside active display Y range)
2. **Horizontal gating**:
   - Skip right border (after display area ends)
   - **Start 16 tacts early** (one complete shift register cycle before display)
   - The shift register loads every 8 HC tacts at HC[3:0] = 0xC and 0x4
   - Data for each load comes from fetches in the preceding ~8-16 tacts
   - Starting 16 tacts early ensures all data for the first visible pixels is ready

**Impact**: This optimization has **zero impact on accuracy** - all visible pixels render identically to hardware. It only eliminates redundant memory reads that would never affect observable output.

#### HC Subcycle Schedule

Within each CLK_7 cycle, activities occur at specific HC subcycle positions. The ULA operates on a repeating 16-position cycle (HC[3:0] = 0x0 through 0xF):

**One CLK_7 Cycle = 16 HC Subcycles**

| HC[3:0] | Activity Flags | Description |
|---------|----------------|-------------|
| 0x0 | `PIXEL_READ` + `SHIFT_REG_LOAD` | Read pixel byte, load shift register (first load point) |
| 0x1 | | (Pixel byte captured in hardware pipeline) |
| 0x2 | `ATTR_READ` | Read attribute byte from VRAM |
| 0x3 | | (Attribute byte captured in hardware pipeline) |
| 0x4 | `PIXEL_READ` | Read pixel byte from VRAM |
| 0x5 | `FLOATING_BUS_UPDATE` | Update floating bus with last read |
| 0x6 | `ATTR_READ` | Read attribute byte from VRAM |
| 0x7 | `SCROLL_SAMPLE` + `FLOATING_BUS_UPDATE` | Sample scroll registers, update floating bus |
| 0x8 | `PIXEL_READ` + `SHIFT_REG_LOAD` | Read pixel byte, load shift register (second load point) |
| 0x9 | `FLOATING_BUS_UPDATE` | Update floating bus with last read |
| 0xA | `ATTR_READ` | Read attribute byte from VRAM |
| 0xB | `FLOATING_BUS_UPDATE` | Update floating bus with last read |
| 0xC | `PIXEL_READ` | Read pixel byte from VRAM |
| 0xD | | (Pixel byte captured in hardware pipeline) |
| 0xE | `ATTR_READ` | Read attribute byte from VRAM |
| 0xF | `SCROLL_SAMPLE` | Sample scroll registers |

**Key Observations**:
- **Memory reads**: Occur every 2 HC subcycles (0x0, 0x2, 0x4, 0x6, 0x8, 0xA, 0xC, 0xE)
- **Alternating pattern**: Pixel byte → Attribute byte → Pixel byte → Attribute byte...
- **Shift register loads**: Occur twice per cycle (at 0x0 and 0x8) for continuous pixel stream
- **Scroll sampling**: Occurs twice per cycle (at 0x7 and 0xF) to catch register changes
- **Floating bus**: Updated 4 times per cycle (at 0x5, 0x7, 0x9, 0xB) with last read byte

#### Activity Details

**1. Scroll Register Sampling** (`ULA_SCROLL_SAMPLE`):

Occurs at HC[3:0] = 0x7 and 0xF (falling edge of CLK_7 in hardware).

```typescript
device.ulaScrolledX = device.ulaScrollX;  // Sample NextReg 0x26
device.ulaScrolledY = vc - device.confDisplayYStart + device.ulaScrollY;  // Sample NextReg 0x27
if (device.ulaScrolledY >= 0xc0) {
  device.ulaScrolledY -= 0xc0;  // Wrap Y at 192 for vertical scrolling
}
```

**Purpose**: Capture the current scroll register values for use in upcoming memory address calculations. Sampling twice per 16-position cycle allows detection of mid-cycle scroll changes.

**Coordinate Transform**:
- **X scroll**: Direct copy of NextReg 0x26 (0-255)
- **Y scroll**: VC-relative position + NextReg 0x27, wrapped at 192
- **Wrapping**: Ensures Y coordinate stays within 192-line display area

**2. Pixel Byte Read** (`ULA_PIXEL_READ`):

Occurs at HC[3:0] = 0x0, 0x4, 0x8, 0xC.

**Address Calculation**:
```typescript
const baseCol = (hc + 0x0c - device.confDisplayXStart) >> 3;  // Character column
const shiftCols = (baseCol + (device.ulaScrolledX >> 3)) & 0x1f;  // Apply X scroll, wrap at 32
const pixelAddr = device._ulaPixelLineBaseAddr[device.ulaScrolledY] | shiftCols;
```

**Address Format** (ZX Spectrum characteristic layout):
```
Pixel Address = {py[7:6], py[2:0], py[5:3], px[7:3]}
              = {thirds, scanline, row, column}
```

- `py[7:6]`: Which third of screen (0-2)
- `py[2:0]`: Scan line within character row (0-7)
- `py[5:3]`: Character row within third (0-7)
- `px[7:3]`: Byte column (0-31)

**Pre-computed Optimization**: The Y-dependent part (`py[7:6,2:0,5:3]`) is pre-computed in `_ulaPixelLineBaseAddr[192]` during initialization, eliminating bit manipulation in the hot rendering path.

**Byte Selection**:
```typescript
if (hc & 0x04) {
  device.ulaPixelByte2 = pixelByte;  // Store in byte 2
} else {
  device.ulaPixelByte1 = pixelByte;  // Store in byte 1
}
```

The ULA alternates between two byte registers to maintain a 16-bit pipeline (two 8-pixel bytes).

**3. Attribute Byte Read** (`ULA_ATTR_READ`):

Occurs at HC[3:0] = 0x2, 0x6, 0xA, 0xE (2 HC subcycles after pixel read).

**Address Calculation**:
```typescript
const baseCol = (hc + 0x0a - device.confDisplayXStart) >> 3;  // Character column
const shiftCols = (baseCol + (device.ulaScrolledX >> 3)) & 0x1f;  // Apply X scroll, wrap at 32
const attrAddr = device._ulaAttrLineBaseAddr[device.ulaScrolledY] | shiftCols;
```

**Address Format**:
```
Attribute Address = 0x1800 + {py[7:3], px[7:3]}
                  = 0x1800 + {character_row, character_column}
```

- `0x1800`: Base of attribute memory (6144 bytes after pixel memory)
- `py[7:3]`: Character row (0-23)
- `px[7:3]`: Character column (0-31)

**Pre-computed Optimization**: The Y-dependent part (`0x1800 + py[7:3] * 32`) is pre-computed in `_ulaAttrLineBaseAddr[192]`.

**Attribute Format** (one byte per 8×8 character):
```
Bit 7:   FLASH (swap INK/PAPER every ~16 frames)
Bit 6:   BRIGHT (add 8 to INK/PAPER palette index)
Bits 5-3: PAPER color (0-7)
Bits 2-0: INK color (0-7)
```

**Byte Selection**:
```typescript
if (hc & 0x04) {
  device.ulaAttrByte2 = ulaAttrByte;  // Store in byte 2
} else {
  device.ulaAttrByte1 = ulaAttrByte;  // Store in byte 1
}
```

**4. Shift Register Load** (`ULA_SHIFT_REG_LOAD`):

Occurs at HC[3:0] = 0x0 and 0x8 (twice per 16-position cycle).

**Operation**:
```typescript
// Combine two 8-bit pixel bytes into 16-bit word
const pixelWord = (device.ulaPixelByte1 << 8) | device.ulaPixelByte2;

// Apply fine horizontal scroll (0-7 pixels)
const scrolledWord = pixelWord << (device.ulaScrolledX & 0x07);

// Extract upper 8 bits as shift register contents
device.ulaShiftReg = (scrolledWord >> 8) & 0xff;

// Load attribute bytes
device.ulaShiftAttr = device.ulaAttrByte1;  // Primary attribute
device.ulaShiftAttr2 = device.ulaAttrByte2;  // Secondary attribute

// Initialize attribute shift counter
device.ulaShiftAttrCount = 8 - (device.ulaScrolledX & 0x07);
```

**Purpose**: Load the next 8 pixels worth of data into the rendering pipeline. The shift register provides a continuous stream of pixel data, loading new data every 8 pixels (16 HC positions at 2 pixels per position).

**Scroll Application**:
- **Coarse scroll** (`ulaScrolledX[7:3]`): Applied during address calculation (selects different column)
- **Fine scroll** (`ulaScrolledX[2:0]`): Applied via bit shifting (0-7 pixel offset within byte)

**Attribute Handling**:
- Two attribute bytes loaded (for 16 pixels, 8 each)
- Counter tracks when to switch from primary to secondary attribute
- Decremented on every pixel output

**5. Floating Bus Update** (`ULA_FLOATING_BUS_UPDATE`):

Occurs at HC[3:0] = 0x5, 0x7, 0x9, 0xB (4 times per cycle, only in display area).

```typescript
device.floatingBusValue = lastReadByte;  // Pixel or attribute byte
```

**Purpose**: Simulate the ZX Spectrum's "floating bus" behavior where the last byte read from VRAM appears on the data bus. This is primarily used for compatibility with software that reads the floating bus for timing or random number generation.

**Hardware Behavior**: In the original Spectrum, reading from unmapped I/O addresses would return whatever value was last on the data bus, which was typically the last ULA memory fetch.

#### Pixel Generation (Every HC Position)

While the above activities occur at specific HC subcycles, **pixel generation occurs at every HC position** within the display area. This is not encoded in the cell flags because it happens unconditionally.

**Process** (from `renderULAStandardPixel` function):

1. **Extract Pixel Bit**:
```typescript
const displayHC = hc - device.confDisplayXStart;  // 0-255
const pixelWithinByte = displayHC & 0x07;  // 0-7
const pixelBit = (device.ulaShiftReg >> (7 - pixelWithinByte)) & 0x01;
```

2. **Attribute Lookup** (Pre-computed tables):
```typescript
const paletteIndex = pixelBit
  ? device._activeAttrToInk[device.ulaShiftAttr]
  : device._activeAttrToPaper[device.ulaShiftAttr];
```

The attribute decode tables are pre-computed for all 256 possible attribute byte values, with separate tables for flash on/off states:
- `_attrToInkFlashOff[256]`: INK palette index with BRIGHT applied
- `_attrToPaperFlashOff[256]`: PAPER palette index with BRIGHT applied
- `_attrToInkFlashOn[256]`: INK palette index with FLASH swap
- `_attrToPaperFlashOn[256]`: PAPER palette index with FLASH swap

**Active tables** switch based on flash counter state (~16 frames on, ~16 frames off).

3. **Update Attribute Counter**:
```typescript
device.ulaShiftAttrCount--;
if (device.ulaShiftAttrCount === 0) {
  device.ulaShiftAttrCount = 8;
  device.ulaShiftAttr = device.ulaShiftAttr2;  // Switch to secondary attribute
}
```

4. **Palette Lookup**:
```typescript
const pixelRGB = device.machine.paletteDevice.getUlaRgb333(paletteIndex);
```

Converts 4-bit palette index (0-15) to RGB333 color via ULA palette (256 entries × 9 bits).

5. **Clipping Test**:
```typescript
const displayVC = vc - device.confDisplayYStart;  // 0-191
const clipped =
  displayHC < device.ulaClipWindowX1 ||
  displayHC > device.ulaClipWindowX2 ||
  displayVC < device.ulaClipWindowY1 ||
  displayVC > device.ulaClipWindowY2;
```

Checks if pixel is within the ULA clip window (NextReg 0x1A).

6. **Transparency Check**:
```typescript
const transparent = (pixelRGB >> 1) === device.globalTransparencyColor;
```

Compares upper 8 bits of RGB333 with global transparent color (NextReg 0x14).

7. **Return Layer Output**:
```typescript
return {
  rgb333: pixelRGB,
  transparent: transparent || clipped,
  clipped: clipped
};
```

#### Border Rendering

When `ULA_BORDER_AREA` flag is set (and `ULA_DISPLAY_AREA` is clear), border rendering occurs:

```typescript
return {
  rgb333: device._borderRgbCache,  // Cached value from port 0xFE bits [2:0]
  transparent: false,
  clipped: false
};
```

**Optimization**: The border RGB value is cached and updated only when the border color changes (via port 0xFE writes). This eliminates palette lookups for ~30% of pixels (border area).

#### Memory Bandwidth Analysis

**Per 16-Position Cycle** (8 pixels rendered):
- **Pixel reads**: 4 bytes (at HC[3:0] = 0x0, 0x4, 0x8, 0xC)
- **Attribute reads**: 4 bytes (at HC[3:0] = 0x2, 0x6, 0xA, 0xE)
- **Total bandwidth**: 8 bytes per 8 pixels = 1 byte per pixel

**Per Scanline** (256 pixels in display area):
- **Pixel data**: 32 bytes (256 pixels / 8 bits per byte)
- **Attribute data**: 32 bytes (32 character columns × 1 byte)
- **Total bandwidth**: 64 bytes per scanline

**Per Frame** (192 scanlines):
- **Total reads**: 64 bytes × 192 = 12,288 bytes per frame
- **At 50Hz**: 614,400 bytes/sec
- **At 60Hz**: 737,280 bytes/sec

This matches the original ZX Spectrum's memory bandwidth requirements exactly.

**Source References**:
- Cell generation: `UlaMatrix.ts` lines 91-190 (`generateULAStandardCell` function)
- Pixel rendering: `UlaMatrix.ts` lines 288-427 (`renderULAStandardPixel` function)
- VHDL dual-port optimization: `zxula.vhd` lines 48-51
- Memory address layout: Section 1.5 (ULA Layer Implementation Details)
- Shift register operation: Section 1.5 (Shift Register Operation)
- Palette lookup: Section 1.2 (Palette Lookup Details)

## 4. Layer Composition Implementation Details

The layer composition stage (Stage 2 of the rendering pipeline) combines up to five independent layer outputs into a single final pixel. This process is purely combinational logic operating at CLK_14 rate.

### 4.1 Pre-Composition Processing

Before priority evaluation, several pre-processing steps occur:

#### ULA/Tilemap/LoRes Transparency Resolution

**ULA/LoRes Transparency** (combined, CLK_14):
```vhdl
ula_mix_transparent <= '1' when (ula_rgb[8:1] = transparent_rgb) or (ula_clipped = '1') else '0';
ula_transparent <= '1' when (ula_mix_transparent = '1') or (ula_en = '0') else '0';
```
Note: LoRes shares the ULA channel - when LoRes is active, its pixel replaces ULA pixel before transparency check.

**Tilemap Transparency**:
```vhdl
tm_transparent <= '1' when (tm_pixel_en = '0') or 
                           (tm_pixel_textmode = '1' and tm_rgb[8:1] = transparent_rgb) or 
                           (tm_en = '0') else '0';
```
Textmode pixels use transparent color comparison; graphical pixels rely on `tm_pixel_en` flag.

**Layer 2 Transparency**:
```vhdl
layer2_transparent <= '1' when (layer2_rgb[8:1] = transparent_rgb) or (layer2_pixel_en = '0') else '0';
```

**Sprites Transparency**:
```vhdl
sprite_transparent <= not sprite_pixel_en;
```
Sprites use simple enable/disable flag (no color-based transparency).

#### Stencil Mode Processing

When stencil mode is enabled (NextReg 0x68 bit 0), ULA and Tilemap pixels are combined via bitwise AND:

```vhdl
if ula_stencil_mode = '1' and ula_en = '1' and tm_en = '1' then
   ula_final_rgb <= ula_rgb AND tm_rgb;
   ula_final_transparent <= ula_transparent OR tm_transparent;
else
   ula_final_rgb <= ulatm_rgb;  -- Either ULA or Tilemap based on below/above flag
   ula_final_transparent <= ulatm_transparent;
end if;
```

Result: Transparent if either layer is transparent; otherwise, bitwise AND of RGB values.

#### Blend Mode Processing

NextReg 0x68 bits [7:6] control ULA/Tilemap blending for composition:

**Mode 00** (Standard ULA + Top/Bottom Tilemap):
```vhdl
mix_rgb <= ula_mix_rgb;
mix_rgb_transparent <= ula_mix_transparent;
mix_top_transparent <= tm_transparent or tm_pixel_below;
mix_top_rgb <= tm_rgb;
mix_bot_transparent <= tm_transparent or not tm_pixel_below;
mix_bot_rgb <= tm_rgb;
```
Tilemap split into "top" (covers ULA) and "bottom" (behind ULA) layers.

**Mode 10** (No Blending):
```vhdl
mix_rgb <= ula_final_rgb;
mix_rgb_transparent <= ula_final_transparent;
mix_top_transparent <= '1';  -- Top layer disabled
mix_bot_transparent <= '1';  -- Bottom layer disabled
```

**Mode 11** (Tilemap as both top/bottom):
```vhdl
mix_rgb <= tm_rgb;
mix_rgb_transparent <= tm_transparent;
mix_top_transparent <= ula_transparent or not tm_pixel_below;
mix_top_rgb <= ula_rgb;
mix_bot_transparent <= ula_transparent or tm_pixel_below;
mix_bot_rgb <= ula_rgb;
```

### 4.2 Priority Evaluation (SLU Modes)

NextReg 0x15 bits [4:2] define layer priority order (Sprites, Layer2, ULA):

#### Mode 000: SLU (Sprites, Layer 2, ULA)
```vhdl
if layer2_priority = '1' then           -- Layer 2 priority bit forces top
   rgb_out <= layer2_rgb;
elsif sprite_transparent = '0' then
   rgb_out <= sprite_rgb;
elsif layer2_transparent = '0' then
   rgb_out <= layer2_rgb;
elsif ula_final_transparent = '0' then
   rgb_out <= ula_final_rgb;
else
   rgb_out <= fallback_rgb;             -- All transparent: use backdrop color
end if;
```

#### Mode 001: LSU (Layer 2, Sprites, ULA)
```vhdl
if layer2_transparent = '0' then 
   rgb_out <= layer2_rgb;
elsif sprite_transparent = '0' then
   rgb_out <= sprite_rgb;
elsif ula_final_transparent = '0' then
   rgb_out <= ula_final_rgb;
else
   rgb_out <= fallback_rgb;
end if;
```

#### Mode 010: SUL (Sprites, ULA, Layer 2)
```vhdl
if layer2_priority = '1' then
   rgb_out <= layer2_rgb;
elsif sprite_transparent = '0' then
   rgb_out <= sprite_rgb;
elsif ula_final_transparent = '0' then
   rgb_out <= ula_final_rgb;
elsif layer2_transparent = '0' then
   rgb_out <= layer2_rgb;
else
   rgb_out <= fallback_rgb;
end if;
```

#### Mode 011: LUS (Layer 2, ULA, Sprites)
```vhdl
if layer2_transparent = '0' then
   rgb_out <= layer2_rgb;
elsif ula_final_transparent = '0' and not (ula_border = '1' and tm_transparent = '1' and sprite_transparent = '0') then
   rgb_out <= ula_final_rgb;
elsif sprite_transparent = '0' then
   rgb_out <= sprite_rgb;
else
   rgb_out <= fallback_rgb;
end if;
```
Note: Special case prevents ULA border from covering sprites when tilemap is transparent.

#### Mode 100: USL (ULA, Sprites, Layer 2)
```vhdl
if layer2_priority = '1' then
   rgb_out <= layer2_rgb;
elsif ula_final_transparent = '0' and not (ula_border = '1' and tm_transparent = '1' and sprite_transparent = '0') then
   rgb_out <= ula_final_rgb;
elsif sprite_transparent = '0' then
   rgb_out <= sprite_rgb;
elsif layer2_transparent = '0' then
   rgb_out <= layer2_rgb;
else
   rgb_out <= fallback_rgb;
end if;
```

#### Mode 101: ULS (ULA, Layer 2, Sprites)
```vhdl
if layer2_priority = '1' then
   rgb_out <= layer2_rgb;
elsif ula_final_transparent = '0' and not (ula_border = '1' and tm_transparent = '1' and sprite_transparent = '0') then
   rgb_out <= ula_final_rgb;
elsif layer2_transparent = '0' then
   rgb_out <= layer2_rgb;
elsif sprite_transparent = '0' then
   rgb_out <= sprite_rgb;
else
   rgb_out <= fallback_rgb;
end if;
```

### 4.3 Color Mixing Modes (Modes 110 and 111)

These modes perform color arithmetic on layer pairs before composition.

#### Mode 110: (U|T)S(T|U)(B+L) - Addition with Saturation

Adds `mix_rgb` (ULA/Tilemap blend) and `layer2_rgb`:

```vhdl
mixer_r = ('0' & layer2_rgb[8:6]) + ('0' & mix_rgb[8:6]);
mixer_g = ('0' & layer2_rgb[5:3]) + ('0' & mix_rgb[5:3]);
mixer_b = ('0' & layer2_rgb[2:0]) + ('0' & mix_rgb[2:0]);

-- Saturate at 7 (0b0111)
if mixer_r[3] = '1' then mixer_r := "0111"; end if;
if mixer_g[3] = '1' then mixer_g := "0111"; end if;
if mixer_b[3] = '1' then mixer_b := "0111"; end if;

-- Priority evaluation
if layer2_priority = '1' then
   rgb_out <= mixer_r[2:0] & mixer_g[2:0] & mixer_b[2:0];
elsif mix_top_transparent = '0' then
   rgb_out <= mix_top_rgb;
elsif sprite_transparent = '0' then
   rgb_out <= sprite_rgb;
elsif mix_bot_transparent = '0' then
   rgb_out <= mix_bot_rgb;
elsif layer2_transparent = '0' then
   rgb_out <= mixer_r[2:0] & mixer_g[2:0] & mixer_b[2:0];
else
   rgb_out <= fallback_rgb;
end if;
```

Layer 2 and ULA/Tilemap blend are added together. If Layer 2 has priority bit set OR is the only opaque layer, the mixed result is used.

#### Mode 111: (U|T)S(T|U)(B+L-5) - Addition with Darkening

Similar to mode 110, but subtracts 5 from the sum (creating a darkening effect):

```vhdl
if mix_rgb_transparent = '0' then
   -- Add components
   mixer_r = layer2_rgb[8:6] + mix_rgb[8:6];
   mixer_g = layer2_rgb[5:3] + mix_rgb[5:3];
   mixer_b = layer2_rgb[2:0] + mix_rgb[2:0];
   
   -- Darken: subtract 5, clamp to 0-7
   if mixer_r <= 4 then
      mixer_r := "0000";
   elsif mixer_r[3:2] = "11" then  -- >= 12
      mixer_r := "0111";           -- Clamp to 7
   else
      mixer_r := mixer_r + "1011"; -- Subtract 5 (add -5 in 2's complement)
   end if;
   
   -- Same for G and B channels
end if;

-- Priority evaluation (same as mode 110)
```

The darkening effect prevents over-brightening when mixing layers.

### 4.4 Layer 2 Priority Bit

Layer 2 pixels carry an extra priority bit (9th bit from palette lookup):

```vhdl
layer2_priority <= layer2_priority_bit when layer2_transparent = '0' else '0';
```

When set, Layer 2 pixel overrides all priority rules and appears on top (except in blend modes, where it affects blend result).

**Source**: Layer 2 palette: `zxnext.vhd` lines 6959-6983 (512 entries × 10 bits, bit 9 is priority)

### 4.5 Fallback Color

When all layers are transparent, the **fallback color** (NextReg 0x4A, 8-bit index) is output:

```vhdl
rgb_out <= fallback_rgb & (fallback_rgb[1] or fallback_rgb[0]);
```

The fallback color is looked up in the ULA palette and expanded from 8 to 9 bits.

### 4.6 Composition Timing Summary

**Clock Domain**: CLK_14 (14 MHz)
**Type**: Purely combinational logic (no registers in composition path)
**Latency**: 0 additional cycles beyond palette lookup
**Total Pipeline Latency**: ~1.5 CLK_7 cycles (~3 CLK_14 cycles) from counter position to final RGB output

**Source References**:
- Pre-composition: `zxnext.vhd` lines 7040-7095
- Priority evaluation: `zxnext.vhd` lines 7140-7310
- Blend modes: `zxnext.vhd` lines 7240-7310
- Output stage: `zxnext.vhd` lines 7315-7370

## 5. ULA+ Palette Extension

ULA+ is a palette extension mode for the ULA layer that provides access to a full 64-color palette (compared to the standard 16-color ULA palette). When ULA+ mode is enabled, the ULA uses a different palette indexing scheme that extracts color information from the attribute byte in a new way, allowing for richer color output without changing the underlying screen format.

### 5.1 ULA+ Mode Control

ULA+ mode can be enabled/disabled through two interfaces:

#### Port-Based Control

**Port 0xBF3B (ULA+ Mode/Index Register)**:
- **Bits [7:6]**: Mode selection
  - `00`: Palette access mode (index register for port 0xFF3B)
  - `01`: Control mode (enable/disable ULA+ via port 0xFF3B)
  - `10`: Reserved
  - `11`: Reserved
- **Bits [5:0]**: Palette index (0-63) when mode = `00`

**Port 0xFF3B (ULA+ Data/Enable Register)**:
- **Mode 00 (Palette Access)**:
  - **Write**: Set palette entry at current index to 8-bit RRRGGGBB color
  - **Read**: Return 8-bit RRRGGGBB color from palette entry at current index
- **Mode 01 (Control)**:
  - **Bit 0**: ULA+ enable flag (1 = enabled, 0 = disabled)
  - **Bits [7:1]**: Ignored

#### NextReg Control

**NextReg 0x68 (ULA Control)**:
- **Bit 3**: ULA+ enable flag (1 = enabled, 0 = disabled)
- Synchronized with Port 0xFF3B mode 01 control

**Typical Port Usage Sequence**:
```
1. OUT $BF3B, $01    ; Select control mode
2. OUT $FF3B, $01    ; Enable ULA+
3. OUT $BF3B, $00    ; Select palette access mode
4. OUT $BF3B, $05    ; Set palette index 5
5. OUT $FF3B, $E3    ; Write color RRRGGGBB = 11100011 (red=7, green=0, blue=3)
```

### 5.2 ULA+ Palette Structure

The ULA+ palette consists of 64 entries, each storing a 9-bit RGB333 color value internally. When accessed via Port 0xFF3B, colors are converted to/from an 8-bit RRRGGGBB format.

#### Palette Index Generation

When ULA+ mode is enabled, the palette index is constructed from the attribute byte and pixel value:

```
Palette Index (6 bits) = attr[7:6] & screen_mode_r[2] | ~pixel_en & attr[2:0]
```

Breaking this down:
- **attr[7:6]**: Upper 2 bits come from the attribute byte (typically FLASH and BRIGHT in standard ULA)
- **screen_mode_r[2] | ~pixel_en**: This bit selects INK (1) or PAPER (0)
  - `pixel_en` is 1 when the current pixel is INK (foreground), 0 for PAPER (background)
  - `screen_mode_r[2]` is the ULA+ enable flag (when 1, forces INK selection)
- **attr[2:0]**: Lower 3 bits from attribute byte (color selection)

**Effective Index Structure**:
```
Bits [5:4]: attr[7:6]    (group selection - 4 groups of 16 colors)
Bit  [3]:   INK/PAPER    (0 = PAPER, 1 = INK)
Bits [2:0]: attr[2:0]    (color selection within INK/PAPER group)
```

This creates a palette space organized as:
- **Indices 0-7**: PAPER colors for attr[2:0] = 0-7, attr[7:6] = 00
- **Indices 8-15**: INK colors for attr[2:0] = 0-7, attr[7:6] = 00
- **Indices 16-23**: PAPER colors for attr[2:0] = 0-7, attr[7:6] = 01
- **Indices 24-31**: INK colors for attr[2:0] = 0-7, attr[7:6] = 01
- **Indices 32-39**: PAPER colors for attr[2:0] = 0-7, attr[7:6] = 10
- **Indices 40-47**: INK colors for attr[2:0] = 0-7, attr[7:6] = 10
- **Indices 48-55**: PAPER colors for attr[2:0] = 0-7, attr[7:6] = 11
- **Indices 56-63**: INK colors for attr[2:0] = 0-7, attr[7:6] = 11

#### Palette Data Format

**Internal Storage**: 9-bit RGB333 format (3 bits each for Red, Green, Blue)

**Port 0xFF3B Format**: 8-bit RRRGGGBB format
- **Bits [7:5]**: Red channel (3 bits)
- **Bits [4:2]**: Green channel (3 bits)
- **Bits [1:0]**: Blue channel (2 bits - LSB implicitly 0 or replicated)

**Conversion on Port Read**:
```vhdl
-- Internal 9-bit RGB333 to 8-bit RRRGGGBB
port_ff3b_read[7:5] <= palette_rgb[8:6];  -- Red
port_ff3b_read[4:2] <= palette_rgb[5:3];  -- Green
port_ff3b_read[1:0] <= palette_rgb[2:1];  -- Blue (upper 2 bits)
```

**Conversion on Port Write**:
```vhdl
-- 8-bit RRRGGGBB to internal 9-bit RGB333
palette_rgb[8:6] <= port_ff3b_write[7:5];  -- Red
palette_rgb[5:3] <= port_ff3b_write[4:2];  -- Green
palette_rgb[2:1] <= port_ff3b_write[1:0];  -- Blue (upper 2 bits)
palette_rgb[0]   <= port_ff3b_write[0];    -- Blue LSB (replicate bit 0)
```

### 5.3 ULA+ Pixel Generation

When ULA+ mode is enabled, the ULA pixel generation path changes:

1. **Standard Path** (ULA+ disabled):
   - Extract pixel from shift register
   - Apply flash logic (XOR with flash counter)
   - Select INK/PAPER color from attr[2:0] or attr[5:3]
   - Add BRIGHT bit (attr[6]) to form 4-bit palette index
   - Lookup in standard ULA palette (16 colors)

2. **ULA+ Path** (ULA+ enabled):
   - Extract pixel from shift register
   - Flash logic **disabled** (attr[7] is used for palette group selection)
   - Construct 6-bit palette index: {attr[7:6], pixel_en, attr[2:0]}
   - Lookup in ULA+ palette (64 colors)
   - BRIGHT bit (attr[6]) is reinterpreted as palette group selector

### 5.4 Implementation Notes

#### Integration with Existing Palette System

The ULA+ palette shares the same dual-port RAM architecture as the standard ULA palette:

```
ULA Palette Address Space (10 bits):
Bits [9:8]: Palette bank select (00 = first palette, 01 = second palette)
Bits [7:0]: Color index (0-255, but ULA only uses 0-15 standard, 0-63 ULA+)
```

When ULA+ is enabled, the palette lookup uses:
- **Standard ULA**: `{palette_select, 0, 0, 0, 0, ink/paper, bright, color[2:0]}`
- **ULA+**: `{palette_select, 0, 0, attr[7:6], pixel_en, attr[2:0]}`

#### Compatibility Considerations

- **Default State**: ULA+ mode is disabled on reset
- **Flash Effect**: When ULA+ is enabled, the FLASH attribute bit (attr[7]) is repurposed for palette group selection, so flashing cannot be used simultaneously with ULA+
- **BRIGHT Effect**: Similarly, attr[6] becomes a palette group selector instead of a BRIGHT modifier
- **Border**: Border color continues to use port 0xFE bits [2:0] and is not affected by ULA+
- **Palette Banks**: ULA+ palette entries exist in both first and second palette banks, allowing palette switching via NextReg 0x43 bit 6

#### Memory Map

**Port Decoding**:
```vhdl
port_bf3b_rd = (cpu_a[15:0] = 0xBF3B) AND cpu_iorq = '1' AND cpu_rd = '1'
port_bf3b_wr = (cpu_a[15:0] = 0xBF3B) AND cpu_iorq = '1' AND cpu_wr = '1'
port_ff3b_rd = (cpu_a[15:0] = 0xFF3B) AND cpu_iorq = '1' AND cpu_rd = '1'
port_ff3b_wr = (cpu_a[15:0] = 0xFF3B) AND cpu_iorq = '1' AND cpu_wr = '1'
```

**Palette RAM Access**:
- **Write Priority**: CPU/copper writes have priority over video reads
- **Read Timing**: Video reads occur at CLK_28 inverted edge, alternating between ULA/Tilemap (sc[0]=0) and Layer2/Sprites (sc[0]=1)
- **Write Timing**: Port writes are registered on i_CLK_28 rising edge

**Source References**:
- Port definitions: `zxnext.vhd` lines 2635-2680
- Port 0xBF3B handler: `zxnext.vhd` lines 4495-4510 (mode/index register)
- Port 0xFF3B handler: `zxnext.vhd` lines 4512-4570 (data/enable register)
- ULA+ pixel generation: `zxula.vhd` lines 490-570 (palette index construction)
- NextReg 0x68 integration: `zxnext.vhd` lines 5200-5250 (ULA control register)

