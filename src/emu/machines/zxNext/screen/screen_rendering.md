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

### 1.6 Layer 2 Implementation Details

Layer 2 is a high-resolution bitmap layer that displays directly from SRAM (external RAM) without the attribute-based constraints of the ULA. It supports three resolution modes with flexible scrolling, clipping, and palette offset capabilities.

#### Memory Organization

**SRAM Address Space**: Layer 2 data is stored in external SRAM starting at a configurable 16K bank boundary.

**Bank Configuration**:
- **Active Bank** (NextReg 0x12, bits 6:0): Starting 16K bank for Layer 2 display (soft reset = 8)
- **Shadow Bank** (NextReg 0x13, bits 6:0): Alternative buffer for double-buffering (soft reset = 11)
- **Port 0x123B** bit 3 selects between active (0) and shadow (1) banks for both display and memory mapping

**Memory Size by Resolution**:
- **256×192×8**: 48KB (3 × 16K banks)
- **320×256×8**: 80KB (5 × 16K banks)
- **640×256×4**: 80KB (5 × 16K banks, 4 bits per pixel)

#### Resolution Modes

Layer 2 supports three distinct resolution modes configured via **NextReg 0x70** bits [5:4]:

##### Mode 0: 256×192×8 (Standard Resolution)

**Configuration**: NextReg 0x70 bits [5:4] = `00`

**Memory Layout**:
```
Address = bank_base + (y[7:0] × 256) + x[7:0]
```
- Linear pixel array: 256 pixels per line, 192 lines
- Each pixel: 8-bit palette index (0-255)
- Total size: 49,152 bytes (48KB)

**Display Area**:
- Uses `phc` (practical horizontal counter) and `pvc` (practical vertical counter)
- Valid when: `phc[8] = 0` (0-255) and `pvc[8] = 0` and `pvc[7:6] ≠ 11` (0-191)

**Coordinate Mapping**:
```
hc_eff = phc + 1              // One pixel ahead for memory access
vc_eff = pvc
```

##### Mode 1: 320×256×8 (Wide Resolution)

**Configuration**: NextReg 0x70 bits [5:4] = `01`

**Memory Layout**:
```
Address = bank_base + (x[8:0] × 256) + y[7:0]
```
- X-major layout: 256 lines of 320 pixels each
- Each pixel: 8-bit palette index (0-255)
- Total size: 81,920 bytes (80KB)

**Display Area**:
- Uses `whc` (wide horizontal counter) and `wvc` (wide vertical counter)
- Valid when: `whc[8] = 0` or `whc[7:6] = 00` (0-319) and `wvc[8] = 0` (0-255)

**Coordinate Mapping**:
```
hc_eff = whc + 1              // One pixel ahead for memory access
vc_eff = wvc
```

**Counter Origins**:
- `whc` starts at -16 (relative to ULA display area)
- `wvc` starts at -2 (relative to ULA display area)
- Provides 32-pixel left border extension and 4-line top/bottom border extension

##### Mode 2: 640×256×4 (High Resolution)

**Configuration**: NextReg 0x70 bits [5:4] = `1X` (10 or 11)

**Memory Layout**:
```
Address = bank_base + (x[9:0] × 256) + y[7:0]
Pixel pair = byte at Address
Left pixel = byte[7:4] (4-bit palette index)
Right pixel = byte[3:0] (4-bit palette index)
```
- X-major layout: 256 lines of 320 bytes each (640 pixels)
- Each byte contains 2 pixels (4 bits each)
- Total size: 81,920 bytes (80KB)

**Display Area**:
- Uses `whc` and `wvc` (same as 320×256 mode)
- Valid when: `whc[8] = 0` or `whc[7:6] = 00` (0-319 logical) and `wvc[8] = 0` (0-255)

**Coordinate Mapping**:
```
hc_eff = whc + 1              // One pixel ahead for memory access
vc_eff = wvc
x[9:0] = hc_eff[8:0] × 2 + sc[1]   // Double horizontal for 640 pixels, sc[1] selects sub-pixel
```

**Pixel Extraction**:
```vhdl
-- At CLK_28, fetch byte containing pixel pair
-- At CLK_14 cycle 0 (sc[1] = 0): output pixel = byte[7:4]
-- At CLK_14 cycle 1 (sc[1] = 1): output pixel = byte[3:0]
layer2_pixel_pre <= ("0000" & layer2_pixel_qq[7:4]) when sc(1) = '0' 
                else ("0000" & layer2_pixel_qq[3:0])
```

#### Scrolling Implementation

**Horizontal Scrolling**:
- **LSB**: NextReg 0x16 (8 bits, scroll_x[7:0])
- **MSB**: NextReg 0x71 bit 0 (scroll_x[8])
- 9-bit total range: 0-511 pixels

**Vertical Scrolling**:
- **NextReg 0x17** (8 bits, scroll_y[7:0])
- Limited to 0-191 when vertical resolution is 192 pixels
- Full 0-255 range in 320×256 and 640×256 modes

**Scroll Application** (sampled at CLK_7 rising edge):

```vhdl
-- Horizontal scroll with wraparound
x_pre[9:0] = hc_eff[8:0] + scroll_x[8:0]

-- 256×192 mode: wrap at 256-pixel boundary
-- 320×256/640×256 modes: wrap at 320-pixel boundary with special handling
if (wide_res = '0' or (x_pre[9] = '0' and (x_pre[8] = '0' or x_pre[7:6] = "00"))) then
   x[8:6] = x_pre[8:6]
else
   x[8:6] = x_pre[8:6] + "011"     // Add 192 to wrap 320→0
end if
x[5:0] = x_pre[5:0]

-- Vertical scroll with wraparound
y_pre[8:0] = vc_eff[8:0] + scroll_y[7:0]

-- 256×192 mode: wrap at 192-line boundary (avoid y >= 192)
-- 320×256/640×256 modes: wrap at 256-line boundary
if (wide_res = '1' or (y_pre[8] = '0' and y_pre[7:6] ≠ "11")) then
   y[7:6] = y_pre[7:6]
else
   y[7:6] = y_pre[7:6] + 1         // Add 64 to wrap 192→0
end if
y[5:0] = y_pre[5:0]
```

**Scroll Timing**:
- Scroll values sampled continuously at CLK_7 rising edge
- No specific sampling window (unlike ULA scroll)
- Applied to coordinate calculation one pixel ahead of display (hc_eff = hc + 1)

#### Clipping Implementation

**Clip Window Configuration** (NextReg 0x18, 4 writes):
1. X1 position (inclusive, soft reset = 0)
2. X2 position (inclusive, soft reset = 255)
3. Y1 position (inclusive, soft reset = 0)
4. Y2 position (inclusive, soft reset = 191)

**Clip Window Semantics**:
- Coordinates are in display space (before scrolling)
- **256×192 mode**: X coordinates are 8-bit (0-255)
- **320×256/640×256 modes**: X coordinates doubled internally (9-bit, 0-511)

**Clip Application** (sampled at CLK_7 rising edge):

```vhdl
-- Adjust clip coordinates for resolution mode
if (resolution = "00") then
   clip_x1_q <= '0' & i_clip_x1         // 256×192: 9-bit with MSB=0
   clip_x2_q <= '0' & i_clip_x2
else
   clip_x1_q <= i_clip_x1 & '0'         // Wide modes: double X coords
   clip_x2_q <= i_clip_x2 & '1'
end if

clip_y1_q <= i_clip_y1                  // Y coords not doubled
clip_y2_q <= i_clip_y2

-- Validity checks for coordinate ranges
hc_valid <= '1' when (narrow and hc_eff[8] = '0') or 
                    (wide and (hc_eff[8] = '0' or hc_eff[7:6] = "00")) else '0'

vc_valid <= '1' when (wide and vc_eff[8] = '0') or 
                    (narrow and (vc_eff[8] = '0' and vc_eff[7:6] ≠ "11")) else '0'

-- Enable pixel if within clip window AND valid coordinates
layer2_clip_en <= '1' when (hc_eff >= clip_x1_q) and (hc_eff <= clip_x2_q) and
                          (vc_eff >= ('0' & clip_y1_q)) and (vc_eff <= ('0' & clip_y2_q)) and
                          (hc_valid = '1') and (vc_valid = '1') 
              else '0'
```

**Clipping Behavior**:
- Clipped pixels are **not rendered** (layer2_en = '0')
- Clipped pixels do not generate SRAM access requests
- Clipping evaluated **after** scrolling (uses effective coordinates)

#### Memory Access Timing

**SRAM Access Cycle** (CLK_28 domain):

```vhdl
-- Address calculation
layer2_bank_eff = (active_bank[6:4] + 1) & active_bank[3:0]
layer2_addr_eff = (layer2_bank_eff + layer2_addr[16:14]) & layer2_addr[13:0]

-- Memory request at sc = "00" (first CLK_28 cycle of CLK_7)
process (CLK_28)
   if sc = "00" then
      if layer2_en = '1' then
         layer2_req_t <= not layer2_req_t    // Toggle request signal
      end if
      layer2_sram_addr <= layer2_addr_eff[20:0]
      layer2_pixel_qq <= sram_data_in        // Latch returned data
   end if
end process
```

**Timing Characteristics**:
- Memory address computed at CLK_28 rate (one pixel ahead)
- SRAM request toggled at sc = "00" when pixel is enabled
- Data latched at sc = "00" of the **following** CLK_7 cycle
- Pipeline delay: ~1.5 CLK_7 cycles (from coordinate to pixel output)

**Memory Request Pattern**:
- **256×192 mode**: 1 request per CLK_7 (at 7 MHz)
- **320×256 mode**: 1 request per CLK_7 (at 7 MHz)
- **640×256 mode**: 2 requests per CLK_7 (at 14 MHz via CLK_28)

#### Palette Offset

**Configuration**: NextReg 0x70 bits [3:0] (palette_offset, soft reset = 0)

**Application**:
```vhdl
-- Applied to upper nibble of palette index before lookup
palette_index[7:4] = layer2_pixel[7:4] + palette_offset[3:0]
palette_index[3:0] = layer2_pixel[3:0]
```

**Purpose**:
- Allows Layer 2 to use different regions of the 256-entry palette
- Useful for color cycling effects without changing pixel data
- Does **not** affect transparency comparison (transparency uses original pixel value)

**Palette Offset Timing**:
- Sampled at CLK_7 rising edge
- Applied immediately to palette lookup (same cycle as pixel data)

#### Palette Lookup and Priority Bit

Layer 2 shares a **512-entry × 10-bit palette** with sprites:

**Palette Structure**:
- Entries 0-255: Layer 2 palette (selected by bit 9 = 0)
- Entries 256-511: Sprite palette (selected by bit 9 = 1)
- Each entry: 10 bits = 9-bit RGB333 + 1-bit priority flag

**Palette Selection**:
- **NextReg 0x43** bit 2: Select first (0) or second (1) Layer 2 palette bank

**Palette Address**:
```vhdl
l2s_pixel_1 <= '0' & layer2_palette_select_1 & layer2_pixel_1   // when sc(0) = '0'
               -- bit 9=0 for Layer 2, bit 8=palette_select, bits 7:0=pixel_index
```

**Priority Bit Extraction**:
```vhdl
layer2_prgb_1 <= palette_data[15] & palette_data[8:0]   // [9]=priority, [8:0]=RGB333

-- Sent to composition stage
layer2_rgb_2 <= layer2_prgb_1[8:0]          // RGB333 color
layer2_priority_2 <= layer2_prgb_1[9]       // Priority promotion bit
```

**Priority Promotion**:
The priority bit (bit 9 of palette entry) allows individual Layer 2 pixels to render **on top** regardless of the layer priority setting (NextReg 0x15 bits [4:2]):

```vhdl
-- In composition stage (zxnext.vhd lines 7140-7340)
if layer2_priority = '1' then
   rgb_out_2 <= layer2_rgb    // Priority bit set: render Layer 2 first
elsif (normal priority evaluation) then
   -- ... standard priority order
end if
```

This enables selective foreground rendering (e.g., HUD elements) while keeping most Layer 2 pixels in their configured priority order.

#### Enable and Display Control

**Display Enable**:
- **Port 0x123B** bit 1: Enable Layer 2 display (aliased to NextReg 0x12 bit 7)
- When disabled, Layer 2 layer outputs transparent pixels

**Memory Mapping Control** (Port 0x123B):
- Bit 0: Enable mapping for memory writes
- Bit 2: Enable mapping for memory reads
- Bits [7:6] + bit 3: Select which 16K segment(s) to map (see Memory Mapping section)

**Memory Mapping Modes** (Port 0x123B bits [7:6] when bit 4 = 0):
- `00`: First 16K of Layer 2 in the bottom 16K ($0000-$3FFF)
- `01`: Second 16K of Layer 2 in the bottom 16K
- `10`: Third 16K of Layer 2 in the bottom 16K
- `11`: First 48K of Layer 2 in bottom 48K ($0000-$BFFF)

**Bank Offset** (Port 0x123B bits [2:0] when bit 4 = 1):
- Adds 0-7 to the starting bank for memory mapping
- Allows fine-grained control over which banks are visible

#### Transparency

**Transparency Color**: NextReg 0x14 (8-bit RGB332 value, soft reset = 0xE3)

**Transparency Test** (Stage 2 composition):
```vhdl
layer2_transparent <= '1' when (layer2_rgb_2[8:1] = transparent_rgb_2) or 
                              (layer2_pixel_en_2 = '0') 
                  else '0'
```

**Key Points**:
- Transparency comparison uses **9-bit RGB333** MSBs (ignores LSB, effectively RGB332 precision)
- Applies to final palette color, **after** palette offset applied
- Clipped pixels automatically treated as transparent (layer2_pixel_en = '0')
- Disabled layer automatically treated as transparent

#### Implementation Notes

**Counter Selection**:
- **256×192 mode**: Uses `phc` (practical horizontal counter) and `pvc` (practical vertical counter)
  - `phc` starts at -48 relative to display area (earlier than ULA)
  - `pvc` matches ULA vertical counter
- **320×256/640×256 modes**: Uses `whc` (wide horizontal counter) and `wvc` (wide vertical counter)
  - `whc` starts at -16 relative to 320-pixel area
  - `wvc` starts at -2 relative to 256-line area

**Address Generation**:
The address calculation differs by resolution mode:
- **256×192**: `layer2_addr = '0' & y[7:0] & x[7:0]` (Y-major, 17 bits)
- **320×256/640×256**: `layer2_addr = x[8:0] & y[7:0]` (X-major, 17 bits)

This X-major layout in wide modes optimizes for horizontal line drawing and scrolling.

**Bank Addressing**:
```vhdl
-- Convert 16K bank number to SRAM address bits [21:14]
layer2_bank_eff[7:0] = (active_bank[6:4] + 1) & active_bank[3:0]
layer2_addr_eff[21:0] = (layer2_bank_eff + addr[16:14]) & addr[13:0]
```

The bank calculation adds 1 to the upper nibble to account for ZX Spectrum RAM starting at bank 8 in SRAM.

**Pixel Pipeline**:
1. **Coordinate Calculation** (CLK_28, sc = "11"): Compute x, y from counters + scroll
2. **Address Generation** (CLK_28, sc = "00"): Convert x, y to SRAM address
3. **Memory Request** (CLK_28, sc = "00"): Toggle request signal, send address
4. **Data Latch** (CLK_28, sc = "00" next cycle): Capture returned pixel data
5. **Palette Offset** (CLK_7 rising): Add offset to pixel index
6. **Palette Lookup** (CLK_28 inverted): Convert index to RGB333 + priority
7. **Composition** (CLK_14): Combine with other layers

**Emulation Considerations**:
- Pre-calculate which HC/VC positions are valid for each resolution mode
- Store clipping bounds in sampled registers (updated at frame start or on register write)
- Use lookup tables for address calculation if performance-critical
- Cache palette colors to avoid repeated lookups
- Handle priority bit separately from RGB color in composition logic

#### Register Summary

| Register | Bits | Purpose | Default |
|---|---|---|---|
| **NextReg 0x12** | [6:0] | Active RAM bank | 8 |
| **NextReg 0x13** | [6:0] | Shadow RAM bank | 11 |
| **NextReg 0x14** | [7:0] | Transparency color (RGB332) | 0xE3 |
| **NextReg 0x16** | [7:0] | X scroll LSB | 0 |
| **NextReg 0x17** | [7:0] | Y scroll | 0 |
| **NextReg 0x18** | [7:0] | Clip window (4 writes) | 0, 255, 0, 191 |
| **NextReg 0x43** | [2] | Palette bank select | 0 |
| **NextReg 0x70** | [5:4] | Resolution mode | 00 |
| **NextReg 0x70** | [3:0] | Palette offset | 0 |
| **NextReg 0x71** | [0] | X scroll MSB | 0 |
| **Port 0x123B** | [7:0] | Enable, mapping, shadow | 0 |

#### Source References

- Layer 2 module: `layer2.vhd` lines 1-217 (complete module)
- Layer 2 instantiation: `zxnext.vhd` lines 4180-4210
- Coordinate counters: `zxula_timing.vhd` lines 475-525 (phc, whc, wvc generation)
- Scroll application: `layer2.vhd` lines 152-159 (X scroll), 160-163 (Y scroll)
- Address calculation: `layer2.vhd` line 165 (mode-dependent formula)
- Clipping logic: `layer2.vhd` lines 167-172 (validity checks), 174 (enable condition)
- SRAM access: `layer2.vhd` lines 176-190 (request generation)
- Pixel extraction: `layer2.vhd` lines 192-217 (hi-res mode pixel splitting)
- Palette lookup: `zxnext.vhd` lines 6950-6990 (shared Layer 2/Sprite palette)
- Priority composition: `zxnext.vhd` lines 7140-7340 (layer priority evaluation)
- NextReg 0x12 documentation: `nextreg.txt` lines 245-247
- NextReg 0x70 documentation: `nextreg.txt` lines 723-730
- Port 0x123B documentation: `ports.txt` lines 184-204

#### Layer 2 Implementation Plan

**Objective**: Implement all three Layer 2 resolution modes (256×192, 320×256, 640×256) without breaking existing ULA and LoRes rendering functionality.

**Current Status**:
- ✅ ULA Standard mode (256×192) fully implemented and tested
- ✅ ULA HiRes mode (512×192) fully implemented and tested
- ✅ ULA HiColor mode (256×192) fully implemented and tested
- ✅ LoRes mode (128×96) fully implemented and tested
- ✅ Rendering pipeline architecture supports multi-layer composition
- ✅ Layer priority system implemented in `composeSinglePixel()`
- ✅ Basic Layer 2 stub methods exist (return transparent pixels)
- ⚠️ Layer2Matrix.ts exists but only has placeholder implementations
- ⚠️ Palette system supports Layer 2/Sprite shared palette structure
- ❌ Layer 2 rendering logic not implemented
- ❌ Layer 2 memory access not implemented
- ❌ Layer 2 scrolling not implemented
- ❌ Layer 2 clipping not implemented

**Implementation Strategy**: Incremental development with continuous testing

##### Phase 1: Core Infrastructure (Foundation)

**Goal**: Set up the basic data structures and interfaces without breaking existing functionality.

**Tasks**:

1. **Extend IPixelRenderingState Interface** (`UlaMatrix.ts`)
   - Add Layer 2 state properties:
     - `layer2Enabled: boolean` (Port 0x123B bit 1)
     - `layer2Resolution: number` (NextReg 0x70 bits [5:4])
     - `layer2PaletteOffset: number` (NextReg 0x70 bits [3:0])
     - `layer2ScrollX: number` (9-bit: NextReg 0x71 bit 0 + NextReg 0x16)
     - `layer2ScrollY: number` (NextReg 0x17)
     - `layer2ClipX1: number`, `layer2ClipX2: number` (NextReg 0x18)
     - `layer2ClipY1: number`, `layer2ClipY2: number` (NextReg 0x18)
     - `layer2ActiveBank: number` (NextReg 0x12)
     - `layer2ShadowBank: number` (NextReg 0x13)
     - `layer2UseShadowBank: boolean` (Port 0x123B bit 3)
   - **Risk**: None - only adds new properties, doesn't modify existing ones
   - **Test**: Verify existing ULA modes still work after interface change

2. **Update NextComposedScreenDevice Constructor**
   - Initialize new Layer 2 properties to default values
   - **Risk**: None - purely additive changes
   - **Test**: Verify no regression in existing modes

3. **Add Layer 2 Memory Access Helper**
   - Create `getLayer2PixelFromSRAM(bank: number, address: number): number` method
   - Access machine's memory via appropriate bank mapping
   - Handle bank offset calculation: `bank_eff = ((bank >> 4) + 1) << 4 | (bank & 0x0F)`
   - **Risk**: Low - new isolated method, doesn't affect existing code
   - **Test**: Unit test with known memory values

4. **Add Layer 2 Coordinate Transformation Helpers**
   - Create `getLayer2Coordinates_256x192(vc, hc, scrollX, scrollY): {x, y}` 
   - Create `getLayer2Coordinates_320x256(vc, hc, scrollX, scrollY): {x, y}`
   - Create `getLayer2Coordinates_640x256(vc, hc, scrollX, scrollY, pixelIndex): {x, y}`
   - Implement wraparound logic per VHDL specification
   - **Risk**: Low - pure computation, no side effects
   - **Test**: Unit tests with various scroll values, verify wraparound

5. **Extend Layer2Matrix.ts Cell Generation**
   - Replace placeholder implementations with proper coordinate validation
   - Implement `isValidLayer2Coordinate_256x192(vc, hc): boolean`
   - Implement `isValidLayer2Coordinate_320x256(vc, hc): boolean`  
   - Implement `isValidLayer2Coordinate_640x256(vc, hc): boolean`
   - Set appropriate flags based on validity
   - **Risk**: Low - only affects Layer 2 matrix, which isn't used yet
   - **Test**: Verify matrix generation for all modes and timing configs

**Milestone 1 Exit Criteria**:
- All new infrastructure code compiles without errors
- All existing tests pass (ULA Standard, ULA HiRes, ULA HiColor, LoRes)
- New unit tests for coordinate transformation pass
- No visual regressions in existing rendering modes

##### Phase 2: 256×192 Mode Implementation (Simplest Mode)

**Goal**: Implement complete 256×192 Layer 2 rendering as proof of concept.

**Tasks**:

1. **Implement Clipping Logic**
   - Create `isLayer2PixelClipped_256x192(x, y): boolean` helper
   - Apply clip window bounds checking
   - **Risk**: Low - isolated logic
   - **Test**: Verify clipping at various window configurations

2. **Implement Basic Pixel Fetch (No Scrolling)**
   - Update `renderLayer2_256x192Pixel()` in NextComposedScreenDevice
   - Calculate memory address: `addr = y × 256 + x`
   - Fetch pixel byte from SRAM
   - Apply palette offset: `palette_idx = (pixel[7:4] + offset) << 4 | pixel[3:0]`
   - Lookup color in Layer 2 palette
   - Extract priority bit from palette entry
   - Return LayerOutput with RGB333, transparent flag, priority bit
   - **Risk**: Medium - first real rendering implementation
   - **Test**: Display static Layer 2 image without scrolling

3. **Implement Transparency**
   - Compare palette RGB333[8:1] against NextReg 0x14 (transparent color)
   - Set transparent flag appropriately
   - **Risk**: Low - simple comparison
   - **Test**: Verify transparent pixels don't render

4. **Add Scrolling Support**
   - Sample scroll registers at frame start
   - Apply scroll transformation to coordinates
   - Implement wraparound at 256-pixel boundary
   - **Risk**: Medium - affects coordinate calculation
   - **Test**: Verify smooth scrolling without artifacts

5. **Add Enable/Disable Control**
   - Check `layer2Enabled` flag before rendering
   - Return transparent output when disabled
   - **Risk**: Low - simple conditional
   - **Test**: Toggle Layer 2 on/off, verify ULA still renders

6. **Integration Testing**
   - Test Layer 2 alone (ULA disabled)
   - Test Layer 2 with ULA (verify priority modes SLU, LSU, SUL, LUS, USL, ULS)
   - Test Layer 2 priority bit override
   - Test with LoRes (verify Layer 2 doesn't break LoRes)
   - **Risk**: High - tests multi-layer composition
   - **Test**: Visual verification of all priority combinations

**Milestone 2 Exit Criteria**:
- 256×192 Layer 2 mode renders correctly
- Scrolling works in all directions with proper wraparound
- Clipping works correctly
- Transparency works correctly
- Priority system integrates properly with existing layers
- No regressions in ULA/LoRes modes
- All existing tests still pass

##### Phase 3: 320×256 Mode Implementation (Wide Mode)

**Goal**: Extend implementation to support wide resolution mode.

**Tasks**:

1. **Implement Wide Counter Support**
   - Add `whc` and `wvc` counter calculations to rendering tables
   - Update coordinate selection based on resolution mode
   - **Risk**: Low - parallel to existing phc/pvc counters
   - **Test**: Verify counters match VHDL specification

2. **Implement X-Major Address Calculation**
   - Update address formula: `addr = x × 256 + y`
   - Handle 9-bit X coordinate (0-319)
   - **Risk**: Medium - different layout than 256×192
   - **Test**: Verify correct pixel fetch at various coordinates

3. **Implement Wide Clipping**
   - Adjust clip coordinates (X doubled internally)
   - Update coordinate validity checks
   - **Risk**: Medium - different coordinate ranges
   - **Test**: Verify clipping at boundary conditions

4. **Implement Wide Scrolling**
   - Apply scroll with 320-pixel wraparound
   - Handle special wraparound logic (add 192 when > 320)
   - **Risk**: Medium - complex wraparound rules
   - **Test**: Verify scrolling across entire 320-pixel range

5. **Update Cell Generation**
   - Modify `generateLayer2_320x256Cell()` with proper logic
   - Ensure correct flags set for wide mode
   - **Risk**: Low - isolated to cell generation
   - **Test**: Verify cell flags match expected patterns

6. **Integration Testing**
   - Test 320×256 rendering with various content
   - Test mode switching (256×192 ↔ 320×256)
   - Test with other layers
   - **Risk**: Medium - new resolution mode
   - **Test**: Visual verification, no artifacts at borders

**Milestone 3 Exit Criteria**:
- 320×256 Layer 2 mode renders correctly
- Mode switching works without artifacts
- Scrolling and clipping work in wide mode
- All priority modes work correctly
- No regressions in 256×192 mode or ULA/LoRes modes

##### Phase 4: 640×256 Mode Implementation (Hi-Res Mode)

**Goal**: Implement 4-bit packed pixel mode with doubled horizontal resolution.

**Tasks**:

1. **Implement Pixel Pair Extraction**
   - Fetch byte containing 2 pixels
   - Extract left pixel (bits [7:4]) and right pixel (bits [3:0])
   - Select pixel based on sub-cycle position (sc[1])
   - **Risk**: Medium - new pixel packing format
   - **Test**: Verify correct pixel extraction from test patterns

2. **Implement 4-Bit Palette Indexing**
   - Apply palette offset to 4-bit value: `palette_idx = (pixel[3:0] + offset[3:0]) << 4`
   - Ensure offset doesn't overflow into wrong nibble
   - **Risk**: Low - arithmetic operation
   - **Test**: Verify palette colors at various offsets

3. **Update Address Calculation**
   - Calculate byte address: `addr = (x >> 1) × 256 + y`
   - Handle even/odd pixel selection
   - **Risk**: Medium - bit manipulation required
   - **Test**: Verify correct byte fetch for adjacent pixels

4. **Update Rendering Loop**
   - Render 2 pixels per CLK_7 cycle (at CLK_28 rate)
   - Handle pixel index parameter (0 or 1)
   - **Risk**: High - affects core rendering loop timing
   - **Test**: Verify no pixel dropouts or duplicates

5. **Implement Hi-Res Scrolling**
   - Apply scroll to doubled X coordinate (640 logical pixels)
   - Use same wraparound as 320×256 mode
   - **Risk**: Medium - coordinate transformation complexity
   - **Test**: Verify smooth scrolling at pixel level

6. **Update Cell Generation**
   - Modify `generateLayer2_640x256Cell()` with hi-res logic
   - Set flags for 2-pixel-per-cycle rendering
   - **Risk**: Medium - different cell structure
   - **Test**: Verify cell generation for hi-res timing

7. **Integration Testing**
   - Test 640×256 rendering with various content
   - Test mode switching (320×256 ↔ 640×256)
   - Test sub-pixel alignment
   - **Risk**: High - most complex mode
   - **Test**: Visual verification at pixel level

**Milestone 4 Exit Criteria**:
- 640×256 Layer 2 mode renders correctly
- Pixel packing/unpacking works without artifacts
- All three resolution modes switchable at runtime
- Scrolling and clipping work in all modes
- Priority system works correctly in all modes
- No regressions in any existing modes

##### Phase 5: Advanced Features and Optimization

**Goal**: Implement remaining features and optimize performance.

**Tasks**:

1. **Implement Shadow Bank Switching**
   - Support active/shadow bank selection (Port 0x123B bit 3)
   - Enable double-buffering use cases
   - **Risk**: Low - bank selection logic
   - **Test**: Verify bank switching updates display

2. **Implement Memory Mapping Support**
   - Add Layer 2 memory mapping to CPU address space (Port 0x123B)
   - Support read/write enable flags
   - Support 16K/48K mapping modes
   - **Risk**: Medium - affects memory subsystem
   - **Test**: Verify memory writes update Layer 2 display

3. **Optimize Rendering Performance**
   - Cache frequently accessed values (clip bounds, scroll values)
   - Pre-calculate address lookup tables if beneficial
   - Profile hot paths and optimize
   - **Risk**: Medium - could introduce bugs
   - **Test**: Performance benchmarks, regression tests

4. **Add NextReg Update Handlers**
   - Implement setters for all Layer 2 NextRegs (0x12, 0x13, 0x16, 0x17, 0x18, 0x70, 0x71)
   - Implement Port 0x123B handler
   - Update rendering state on register changes
   - **Risk**: Low - register I/O handling
   - **Test**: Verify register writes take effect immediately

5. **Comprehensive Testing**
   - Create automated test suite for all Layer 2 features
   - Test edge cases (boundary conditions, wrap-around)
   - Test interaction with all other layers
   - Test all 6 priority modes × 3 resolutions = 18 combinations
   - Performance testing (ensure 50/60 Hz frame rate maintained)
   - **Risk**: Low - testing phase
   - **Test**: All automated tests pass

**Milestone 5 Exit Criteria**:
- All Layer 2 features fully implemented
- Performance meets real hardware specifications
- All register I/O working correctly
- Comprehensive test suite passes
- No known bugs or regressions
- Code reviewed and documented

##### Phase 6: Documentation and Code Review

**Goal**: Finalize implementation with complete documentation.

**Tasks**:

1. **Code Documentation**
   - Add comprehensive JSDoc comments to all Layer 2 methods
   - Document coordinate transformation formulas
   - Document memory address calculations
   - Document timing considerations
   - **Risk**: None
   - **Test**: Documentation review

2. **Update Architecture Documentation**
   - Update screen_rendering.md with implementation details
   - Add performance notes
   - Add troubleshooting section
   - **Risk**: None
   - **Test**: Documentation review

3. **Code Review**
   - Review for consistency with ULA implementation style
   - Check for potential optimizations
   - Verify error handling
   - **Risk**: Low - may identify bugs
   - **Test**: Address review comments

**Final Exit Criteria**:
- All Layer 2 modes fully functional
- Zero known bugs
- Performance acceptable (maintains frame rate)
- All tests pass
- Code reviewed and approved
- Documentation complete

##### Risk Mitigation Strategies

**Regression Prevention**:
- Run full test suite after each phase
- Maintain separate feature branch until complete
- Test with known-good ROM images
- Visual comparison against reference screenshots

**Debugging Strategy**:
- Implement debug visualization modes (show clipping, show coordinates)
- Add logging for coordinate transformations
- Add memory access tracing
- Create minimal test cases for each feature

**Rollback Plan**:
- Each phase is independently testable
- Can pause implementation at any milestone
- Stub implementations allow system to run (return transparent pixels)
- Version control allows reverting specific changes

##### Testing Strategy

**Unit Tests** (per phase):
- Coordinate transformation functions
- Address calculation functions
- Clipping logic
- Wraparound behavior
- Palette offset application

**Integration Tests** (per milestone):
- Layer 2 rendering alone
- Layer 2 + ULA rendering
- Layer 2 + LoRes rendering
- All priority modes
- Mode switching

**Regression Tests** (after each phase):
- All existing ULA modes still work
- LoRes mode still works
- Border rendering still works
- Palette system still works
- No performance degradation

**Visual Tests** (per milestone):
- Static images render correctly
- Scrolling is smooth
- Clipping boundaries are clean
- Color accuracy matches specification
- No artifacts at resolution boundaries

**Performance Tests** (Phase 5):
- Maintain 50/60 Hz frame rate
- No frame drops during scrolling
- Memory access doesn't bottleneck rendering
- CPU usage remains reasonable

##### Development Timeline Estimate

- **Phase 1** (Infrastructure): 1-2 days
- **Phase 2** (256×192 mode): 2-3 days
- **Phase 3** (320×256 mode): 2-3 days
- **Phase 4** (640×256 mode): 3-4 days
- **Phase 5** (Advanced features): 2-3 days
- **Phase 6** (Documentation): 1-2 days

**Total Estimate**: 11-17 days (depending on complexity of issues encountered)

##### Success Metrics

- ✅ All three Layer 2 resolution modes render correctly
- ✅ Scrolling works smoothly in all modes
- ✅ Clipping works correctly in all modes
- ✅ Priority system integrates properly with all layers
- ✅ Priority bit override works correctly
- ✅ Transparency works correctly
- ✅ Shadow bank switching works
- ✅ All NextReg/Port I/O works correctly
- ✅ Performance maintains 50/60 Hz frame rate
- ✅ Zero regressions in existing modes (ULA, LoRes)
- ✅ All automated tests pass
- ✅ Code reviewed and documented

### 1.7 ULA Enhanced Modes (ULA+, ULANext)

The ZX Spectrum Next extends the standard ULA palette system with two enhanced modes: **ULA+** (backwards-compatible with original ULA+ specification) and **ULANext** (Next-specific extended palette mode). These modes provide expanded color capabilities while maintaining compatibility with standard ULA rendering.

#### ULA Enhanced Mode Architecture

**Three Palette Modes** (mutually exclusive):
1. **Standard ULA**: Classic ZX Spectrum 16-color palette (INK 0-7, BRIGHT INK 8-15, PAPER 16-23, BRIGHT PAPER 24-31)
2. **ULA+**: 64-color extended palette with per-attribute PAPER brightness control
3. **ULANext**: Fully programmable attribute byte interpretation with configurable INK/PAPER bit allocation

**Mode Selection Priority** (combinational logic):
```vhdl
if i_ulanext_en = '1' then
   -- ULANext mode active
elsif i_ulap_en = '1' then
   -- ULA+ mode active
else
   -- Standard ULA mode active
```

**Palette Storage**: All three modes share the same 256-entry ULA palette RAM:
- Entries 0-127: Standard ULA + ULANext INK indices
- Entries 128-191: ULANext PAPER indices
- Entries 192-255: ULA+ palette (64 colors)

#### ULA+ Mode

ULA+ extends the standard ULA with a 64-color palette while maintaining attribute byte compatibility. It provides independent BRIGHT control for INK and PAPER through palette index manipulation.

**Activation**:
- **NextReg 0x43** bit 0 = 0 (ULANext disabled)
- **Port 0xFF3B** bit 0 = 1 (ULA+ enabled)
- **NextReg 0x08** bit 24 = 1 (ULA+ I/O ports unlocked, required for legacy compatibility)

**Palette Index Generation**:
```
ULA+ index = {2'b11, attr[7:6], pixel_select, attr[5:3] or attr[2:0]}
           = 192 + (attr[7:6] << 4) + (pixel_select << 3) + color_bits

Where:
  - bits [7:6] = 11 (constant, selects ULA+ range 192-255)
  - attr[7:6] = FLASH and BRIGHT bits from attribute byte
  - pixel_select = 1 for PAPER, 0 for INK (unless screen_mode[2]=1, see note below)
  - attr[5:3] = PAPER color if pixel_select=1
  - attr[2:0] = INK color if pixel_select=0
```

**Hardware Implementation Details**:
```vhdl
-- ULA+ palette index generation (zxula.vhd lines 540-548)
ula_pixel(7 downto 3) <= "11" & attr_active(7 downto 6) & (screen_mode_r(2) or not pixel_en);

if pixel_en = '1' then
   ula_pixel(2 downto 0) <= attr_active(2 downto 0);  -- INK color
else
   ula_pixel(2 downto 0) <= attr_active(5 downto 3);  -- PAPER color
end if;
```

**Key Features**:
- **64 Colors**: Palette entries 192-255 can be programmed with any RGB333 color
- **Independent BRIGHT Control**: Attribute bits 7:6 select one of four 16-color groups
  - Group 0 (attr[7:6]=00): Indices 192-207 (normal INK/PAPER)
  - Group 1 (attr[7:6]=01): Indices 208-223 (FLASH without BRIGHT)
  - Group 2 (attr[7:6]=10): Indices 224-239 (BRIGHT without FLASH)
  - Group 3 (attr[7:6]=11): Indices 240-255 (FLASH + BRIGHT)
- **Border Color**: Always uses standard ULA palette (PAPER color, index 16-23 or 24-31)
- **Flash Disabled**: Flash logic is disabled in ULA+ mode (FLASH bit becomes palette selector)

**I/O Ports**:
- **0xBF3B** (Write): Mode and palette index selection
  - Bits [7:6]: Register group (00 = palette, 01 = mode)
  - Bits [5:0]: Palette index (0-63) if group = 00
- **0xFF3B** (Read/Write): Palette data or mode enable
  - Read (palette group): Returns RGB value in GGGRRRBB format
  - Read (mode group): Bit 0 = ULA+ enabled status
  - Write (palette group): Set RGB value in GGGRRRBB format
  - Write (mode group): Bit 0 = 1 to enable ULA+, 0 to disable

**Color Format**: ULA+ I/O ports use 8-bit color format GGGRRRBB. The 9th blue bit is generated as `B_lsb = B1 OR B0`.

**Incompatibility Note**: ULA+ mode forces palette index bit 3 to 1 (PAPER selection) when `screen_mode[2]=1` (Timex Hi-Res/Hi-Color modes). This makes ULA+ incompatible with Timex enhanced video modes. The hardware implementation at `zxula.vhd` line 545 shows:
```vhdl
ula_pixel(7 downto 3) <= "11" & attr_active(7 downto 6) & (screen_mode_r(2) or not pixel_en);
```
When `screen_mode_r(2)=1`, bit 3 is forced to 1, selecting PAPER palette group regardless of pixel value.

#### ULANext Mode

ULANext provides a fully programmable attribute byte format, allowing arbitrary allocation of bits between INK and PAPER. This enables color modes ranging from 2-color (1-bit INK, 7-bit PAPER) to 256-color (8-bit INK, 0-bit PAPER).

**Activation**:
- **NextReg 0x43** bit 0 = 1 (ULANext enabled)
- **NextReg 0x42**: Attribute format mask (defines INK bit allocation)

**Attribute Byte Format Mask** (NextReg 0x42):
The mask value defines which attribute bits represent INK color (1 bits in mask) vs PAPER color (0 bits in mask). Only solid right-aligned bit sequences are valid.

**Valid Masks and Color Modes**:

| Mask (Binary) | Mask (Hex) | INK Bits | PAPER Bits | INK Colors | PAPER Colors | Mode Description |
|---|---|---|---|---|---|---|
| `00000001` | 0x01 | 1 | 7 | 2 | 128 | 1-bit monochrome INK |
| `00000011` | 0x03 | 2 | 6 | 4 | 64 | 2-bit INK palette |
| `00000111` | 0x07 | 3 | 5 | 8 | 32 | Standard ZX (no BRIGHT) |
| `00001111` | 0x0F | 4 | 4 | 16 | 16 | Balanced 16-color mode |
| `00011111` | 0x1F | 5 | 3 | 32 | 8 | Extended INK mode |
| `00111111` | 0x3F | 6 | 2 | 64 | 4 | High INK color depth |
| `01111111` | 0x7F | 7 | 1 | 128 | 2 | Maximum INK colors |
| `11111111` | 0xFF | 8 | 0 | 256 | 0 (fallback) | Full color mode |

**Palette Index Calculation**:

For **INK pixels** (pixel=1):
```
ink_index = attribute_byte AND format_mask
palette_entry = ink_index (range 0-127 based on mask)
```

For **PAPER pixels** (pixel=0):
```
paper_bits = attribute_byte AND (NOT format_mask)
palette_entry = 128 + (paper_bits >> count_trailing_ones(format_mask))
```

**Special Cases**:

1. **Full Ink Color Mode** (mask = 0xFF):
   - All 256 palette entries represent INK colors
   - PAPER and border use **Fallback Color** (NextReg 0x4A)
   - Enables 256-color mode with no PAPER distinction
   - Hardware sets `ula_select_bgnd = 1` to trigger fallback color usage

2. **Invalid Masks** (non-solid bit sequence, e.g., 0x55 = 01010101):
   - INK color = `attribute_byte AND format_mask` (bitwise AND with mask)
   - PAPER and border = **Fallback Color** (NextReg 0x4A)
   - Hardware behavior: `case` statement `when others` clause sets `ula_select_bgnd = 1`
   - This gracefully degrades to INK-only mode with fallback for PAPER
   
**Hardware Implementation Detail - Invalid Mask Handling**:

When an invalid (non-solid) mask is detected, the hardware uses the `ula_select_bgnd` flag to signal that the fallback color should be used instead of a palette lookup:

```vhdl
-- PAPER pixel handling in ULANext mode (zxula.vhd lines 518-526)
case i_ulanext_format is
   when X"01" =>   ula_pixel <= paper_base_index(7) & attr_active(7 downto 1);
   when X"03" =>   ula_pixel <= paper_base_index(7 downto 6) & attr_active(7 downto 2);
   when X"07" =>   ula_pixel <= paper_base_index(7 downto 5) & attr_active(7 downto 3);
   when X"0F" =>   ula_pixel <= paper_base_index(7 downto 4) & attr_active(7 downto 4);
   when X"1F" =>   ula_pixel <= paper_base_index(7 downto 3) & attr_active(7 downto 5);
   when X"3F" =>   ula_pixel <= paper_base_index(7 downto 2) & attr_active(7 downto 6);
   when X"7F" =>   ula_pixel <= paper_base_index(7 downto 1) & attr_active(7);
   when others =>  ula_select_bgnd <= '1';  -- Use fallback color
end case;

-- Later in composition (zxnext.vhd lines 6933-6937)
if lores_pixel_en_1 = '1' or ula_select_bgnd_1 = '0' then
   ula_rgb_1 <= ulatm_rgb_1(8 downto 0);  -- Normal palette lookup
else
   ula_rgb_1 <= fallback_rgb_1 & (fallback_rgb_1(1) or fallback_rgb_1(0));  -- Fallback color
end if;
```

Where `fallback_rgb_1` is derived from NextReg 0x4A (8-bit RGB332 format, expanded to 9-bit RGB333).

**Hardware Implementation**:
```vhdl
-- ULANext palette index generation (zxula.vhd lines 498-530)
if i_ulanext_en = '1' then
   
   if border_active_d = '1' then
      -- Border color (PAPER range 128-255)
      if i_ulanext_format = X"FF" then
         ula_select_bgnd <= '1';  -- Use fallback color
      end if;
      ula_pixel <= paper_base_index(7 downto 3) & attr_active(5 downto 3);
   
   elsif pixel_en = '1' then
      -- INK pixel (range 0-127)
      ula_pixel <= attr_active and i_ulanext_format;
   
   else
      -- PAPER pixel (range 128-255)
      case i_ulanext_format is
         when X"01" =>   ula_pixel <= paper_base_index(7) & attr_active(7 downto 1);
         when X"03" =>   ula_pixel <= paper_base_index(7 downto 6) & attr_active(7 downto 2);
         when X"07" =>   ula_pixel <= paper_base_index(7 downto 5) & attr_active(7 downto 3);
         when X"0F" =>   ula_pixel <= paper_base_index(7 downto 4) & attr_active(7 downto 4);
         when X"1F" =>   ula_pixel <= paper_base_index(7 downto 3) & attr_active(7 downto 5);
         when X"3F" =>   ula_pixel <= paper_base_index(7 downto 2) & attr_active(7 downto 6);
         when X"7F" =>   ula_pixel <= paper_base_index(7 downto 1) & attr_active(7);
         when others =>  ula_select_bgnd <= '1';  -- Use fallback color
      end case;
   
   end if;

end if;
```

**Key Features**:
- **Flexible Color Allocation**: Programmer controls INK vs PAPER bit distribution
- **Extended Palette Range**: INKs use entries 0-127, PAPERs use entries 128-255
- **Flash Disabled**: Flash logic disabled in ULANext mode (all attribute bits available for color)
- **Border Handling**: Border uses PAPER color calculation, or fallback color in full-ink mode
- **Fallback Color Integration**: Automatically used when PAPER has no allocated bits

**Register Summary**:
- **NextReg 0x42**: Attribute format mask (soft reset = 0x07, standard 3-bit INK)
- **NextReg 0x43** bit 0: Enable ULANext mode (soft reset = 0)
- **NextReg 0x4A**: Fallback color for modes with no PAPER allocation (RGB333 format)

#### Standard ULA Mode (Baseline)

For completeness, standard ULA mode palette index generation:

```vhdl
-- Standard ULA palette index (zxula.vhd lines 554-560)
ula_pixel(7 downto 3) <= "000" & not pixel_en & attr_active(6);

if pixel_en = '1' then
   ula_pixel(2 downto 0) <= attr_active(2 downto 0);  -- INK: 0-7 or 8-15 (with BRIGHT)
else
   ula_pixel(2 downto 0) <= attr_active(5 downto 3);  -- PAPER: 16-23 or 24-31 (with BRIGHT)
end if;
```

**Palette Index Structure**:
- Bit 7-5: `000` (constant)
- Bit 4: `NOT pixel_en` (0 for INK, 1 for PAPER)
- Bit 3: `attr[6]` (BRIGHT)
- Bit 2-0: `attr[2:0]` for INK or `attr[5:3]` for PAPER

**Flash Logic**: Standard ULA applies flash at pixel bit level:
```vhdl
pixel_en = (shift_reg(15) xor (attr_active(7) and flash_cnt(4) and (not i_ulanext_en) and not i_ulap_en))
           and not border_active_d
```
Flash only active when both ULANext and ULA+ are disabled.

#### Mode Comparison Summary

| Feature | Standard ULA | ULA+ | ULANext |
|---|---|---|---|
| **Palette Entries** | 32 (0-31) | 64 (192-255) | 256 (0-255) |
| **INK Colors** | 8 + BRIGHT | 8 per group × 4 groups | 2-256 (programmable) |
| **PAPER Colors** | 8 + BRIGHT | 8 per group × 4 groups | 2-128 (programmable) |
| **Attribute Format** | Fixed (F-B-PPP-III) | Fixed (uses F/B as selectors) | Programmable mask |
| **Flash Support** | Yes (bit 7) | No (bit 7 for palette) | No (all bits for color) |
| **Border Color** | PAPER palette | PAPER palette (std ULA) | PAPER palette or fallback |
| **Timex Mode Compat** | Yes | No (forced PAPER select) | Yes |
| **Palette Range** | 0-31 | 192-255 | INK: 0-127, PAPER: 128-255 |
| **Enable Register** | Default | Port 0xFF3B bit 0 | NextReg 0x43 bit 0 |
| **Configuration** | None | Port 0xBF3B/0xFF3B | NextReg 0x42 (mask) |

#### Implementation Notes

**Palette RAM Access**:
- ULA palette: 256 entries × 9 bits (RGB333)
- Dual-port RAM: Port A for CPU writes (CLK_28), Port B for video reads (CLK_28 inverted)
- Two palette banks (first/second) selected by NextReg 0x43 bits [6:4] and bit 1
- ULA+ uses entries 192-255 of the selected ULA palette bank

**Timing Considerations**:
- Mode selection is combinational (no latency)
- Palette lookup occurs at CLK_28 inverted edge (1 cycle latency)
- Format mask (NextReg 0x42) sampled continuously, no synchronization needed
- ULA+ enable (Port 0xFF3B) sampled continuously, immediate effect

**Emulation Simplifications**:
For emulation purposes, the palette index can be calculated once per pixel based on:
- Current mode flags (standard/ULA+/ULANext)
- Pixel value (from shift register MSB)
- Attribute byte (from attribute register)
- Format mask (NextReg 0x42, for ULANext only)
- Border detection flag

The resulting palette index is then used to fetch the RGB333 color from the appropriate palette bank.

**Source References**:
- ULA+ palette index generation: `zxula.vhd` lines 540-548
- ULANext palette index generation: `zxula.vhd` lines 498-530
- Standard ULA palette index: `zxula.vhd` lines 554-560
- Flash logic: `zxula.vhd` line 475
- Mode selection priority: `zxula.vhd` lines 495-560 (nested if-elsif-else structure)
- NextReg 0x42 documentation: `nextreg.txt` lines 505-522
- NextReg 0x43 documentation: `nextreg.txt` lines 524-543
- ULA+ I/O ports: `ports.txt` lines 418-444

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

