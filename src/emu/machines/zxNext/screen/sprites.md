# ZX Spectrum Next Sprite Rendering Algorithm

## Overview

The ZX Spectrum Next sprite engine is a high-performance hardware renderer supporting up to 128 sprites with sophisticated transformation capabilities. The architecture uses a state machine-driven approach with double-buffered line buffers to efficiently process sprites during frame rendering. This document describes the algorithm for emulation implementation.

**Key Characteristics**:
- **128 hardware sprites** (16×16 pixels base size)
- **64 sprite patterns** (expandable via relative sprites)
- **Per-sprite transformations**: rotation, mirroring, scaling (1x–4x), palette offset
- **Relative sprite chains**: unlimited sprite combinations via anchor + relative sprites
- **9-bit positioning**: sprites can render at subpixel accuracy (0–511 pixels horizontally)
- **Priority modes**: sprites can be rendered in front or behind other layers

### Coordinate System Reference

**VHDL Hardware Coordinates** (as referenced in this document):
- **WHC (Wide Horizontal Counter)**: 0–511 range, but only 456 values per scanline due to reset:
  - WHC 0–319: Display region (320 visible pixels)
  - WHC 320–511: Horizontal blanking interval (192 values, but spans 136 machine cycles)
- **VC (Vertical Counter)**: 0–311 (50Hz) or 0–263 (60Hz) per frame

**Emulator Coordinate System** (NextComposedScreenDevice):
- **HC (emulator)**: 0–455 per scanline, where:
  - HC 0–95: Left blanking (96 clocks, not rendered)
  - HC 96–455: Visible area starts at `firstVisibleHC` = 96
  - HC 96–111: Left border (16 clocks)
  - **HC 112–431: Sprite/320px display area (320 clocks)** ← Used by Sprites, Layer 2 wide, Tilemap
  - HC 432–455: Right border (24 clocks)
  - _(HC 144–399: ULA display area, 256 clocks)_ ← Used only by ULA layer
- **VC (emulator)**: 0–310 (50Hz) or 0–263 (60Hz)

**Mapping**: VHDL WHC to Emulator HC:
- **WHC 0–319 → Emulator HC 104–423** (320-pixel display area for sprites)
- WHC 320–511 → Emulator HC 424–455 (32) + 0–87 (88) + 88–103 (16) = 136 cycles total
- **Sprite rendering window**: 
  - Hardware: WHC 320–511 (136 actual machine cycles: 32+88+16)
  - Emulator: HC 424–455 (32) + HC 0–87 (88) = 120 cycles (excluding 16-cycle reset period)

**Important**: Sprites use the **320-pixel coordinate system** (HC 112–431), NOT the ULA's 256-pixel system (HC 144–399).

---

## Architecture Overview

### Core Components

1. **Sprite Attribute Memory** (128 sprites × 5 attributes):
   - **Attr 0**: X position (bits 7:0)
   - **Attr 1**: Y position (bits 7:0)
   - **Attr 2**: Palette offset (7:4), X/Y mirror (3:2), Rotation (1), X MSB (0)
   - **Attr 3**: Visible flag (7), Relative sprite marker (6), Pattern index (5:0)
   - **Attr 4**: 4-bit pattern flag (7), Pattern bit 6 (6), X scale (5:4), Y scale (3:2), Y MSB (0)

2. **Pattern Memory** (64 patterns × 256 bytes = 16KB):
   - Each pattern: 16×16 pixels = 256 bytes (8-bit per pixel)
   - 4-bit patterns stored with 2 pixels per byte (access via nibble extraction)

3. **Double-Buffered Line Buffers** (2 × 320×9-bit RAM):
   - One buffer receives sprite rendering
   - Other buffer provides output to video composition
   - Buffers swap at end of each scanline

4. **State Machine** (4-state: IDLE, START, QUALIFY, PROCESS):
   - Controls sprite iteration and pixel rendering
   - Executes during horizontal blanking interval

---

## Coordinate System Mapping (VHDL Hardware vs. Emulator)

### Understanding the Two Coordinate Systems

The VHDL hardware and the emulator use different coordinate systems for horizontal timing. The hardware actually uses **two different horizontal counters**:

1. **Main HC (`hc`)**: The actual machine horizontal counter (0-455, 456 cycles per scanline at CLK_7)
2. **Wide HC (`whc`)**: A derived 320-pixel display counter (0-511, 512 cycles per scanline at CLK_7)

The sprite module receives **`whc`** as its `hcounter_i` input, NOT the main `hc`.

| Coordinate Space | HC Range | Description |
|-----------------|----------|-------------|
| **Machine `hc`** | 0–455 | Main horizontal counter, 456 cycles per scanline |
| **VHDL `whc` (hcounter_i)** | 0–511 | Wide display counter for 320px layers, 512 cycles |
| **Emulator `hc`** | 0–455 | Emulator horizontal counter (matches machine `hc`) |

### How WHC (Wide Horizontal Counter) is Generated

The `whc` counter is generated in `zxula_timing.vhd` using the following logic:

```vhdl
-- For 128K 50Hz mode (ZX Next default):
c_min_hactive = 136        -- Start of 256px ULA display area
wide_min_hactive = c_min_hactive - 32 - 16 = 88

-- WHC reset trigger
wide_hactive <= '1' when hc = 88 else '0';

-- WHC counter process
process (i_CLK_7)
begin
   if rising_edge(i_CLK_7) then
      if wide_hactive = '1' then
         whc <= "111110000";   -- Start at -16 (decimal value = 496 unsigned)
      else
         whc <= whc + 1;
      end if;
   end if;
end process;
```

**Key Points**:
- `whc` resets to **-16** (0x1F0 = 496 unsigned) when main `hc = 88`
- `whc` then increments every CLK_7 cycle
- `whc` wraps naturally at 512 (9-bit counter: 0-511)

### Mapping Main HC to WHC

Given that `whc` starts at -16 when `hc = 88`, we can derive the mapping:

```
When hc = 88:  whc = -16 (496 unsigned) = 0x1F0
When hc = 89:  whc = -15 (497)
...
When hc = 103: whc = -1  (511)
When hc = 104: whc = 0   ← Sprite display area begins
When hc = 105: whc = 1
...
When hc = 423: whc = 319 ← Sprite display area ends
When hc = 424: whc = 320 ← Sprite rendering begins (blanking)
...
When hc = 455: whc = 351
When hc = 0:   whc = 352 ← Wrapped around to next scanline
...
When hc = 87:  whc = 495
When hc = 88:  whc = -16 (496) ← Reset
```

**Formula**: 
```
whc = (hc - 104) mod 512
or equivalently:
whc = (hc + 392) mod 512  // where 392 = 512 - 104 - 16
```

**Verification**:
- At `hc = 104`: `whc = (104 - 104) mod 512 = 0` ✓
- At `hc = 423`: `whc = (423 - 104) mod 512 = 319` ✓
- At `hc = 424`: `whc = (424 - 104) mod 512 = 320` ✓
- At `hc = 455`: `whc = (455 - 104) mod 512 = 351` ✓
- At `hc = 0`: `whc = (0 + 512 - 104) mod 512 = 352` ✓ (wrapped)
- At `hc = 87`: `whc = (87 + 512 - 104) mod 512 = 495` ✓
- At `hc = 88`: Reset to -16 (496) ✓

### Detailed VHDL Hardware Timing (as used in sprites.vhd)

The hardware sprites module receives `hcounter_i`, which is actually the **wide horizontal counter (`whc`)** from `zxula_timing.vhd`. This is a **320-pixel-based display counter** that counts:

```
VHDL hcounter_i (whc) = 0–319: Display/visible pixels (320 pixels)
VHDL hcounter_i (whc) = 320–511: Horizontal blanking interval (192 clocks)
```

**Key VHDL Signal**:
```vhdl
hcounter_i_valid <= '1' when hcounter_i < 320 else '0';
```

This validates that the current HC position is within the 320-pixel display window.

**Visual Timeline** (VHDL Hardware - whc counter):
```
whc:  0                             319|320                                511
      ├────────────────────────────────┼────────────────────────────────────┤
      │    DISPLAY/VISIBLE (320 clk)   │   BLANKING INTERVAL (192 clk)      │
      │    Video Output Active         │   Sprite Rendering Active          │
      │    Line Buffer Read            │   Line Buffer Write                │
      └────────────────────────────────┴────────────────────────────────────┘
                                       ↑                                    ↑
                                  hcounter_i                           line_reset
                                   = 320                               (HC=511)
                                                                    buffer swap
```

**Important**: The `whc` counter is a **derived counter** from the main horizontal counter (`hc`). It provides a convenient 320-pixel-wide coordinate system for sprite/Layer 2/tilemap rendering. Although WHC has a 512-value range (9-bit), it only counts through **456 values per scanline** due to the reset at HC 88. The sequence is: WHC 496-511 (16 cycles) → WHC 0-351 (352 cycles) → WHC 352-495 (88 cycles) → reset.

### Emulator Coordinate System (NextComposedScreenDevice)

The emulator uses the **main HC** (0-455) which matches the machine's actual horizontal counter. The emulator needs to **emulate the WHC mapping** to correctly position sprites.

**Emulator HC Layout**:
```
Emulator HC = 0–87:   Part of blanking (whc = 352–495)
Emulator HC = 88:     WHC reset point (whc wraps to -16/496)
Emulator HC = 88–103: Left blanking continues (whc = -16 to -1, or 496–511)
Emulator HC = 104:    Sprite display begins (whc = 0)
Emulator HC = 104–423: Sprite 320px display area (whc = 0–319)
  - HC 104–143: Left border (40 clocks)
  - HC 144–399: ULA display area (256 clocks, 512 pixels at 2px/CLK_7)
  - HC 400–423: Right border (24 clocks)
Emulator HC = 424–455: Sprite rendering window part 1 (whc = 320–351, 32 clocks)
```

**Important Clarification**: The emulator's `firstVisibleHC = 96` is for **video output** purposes (when pixels start being visible on screen), but the sprite **coordinate system** starts at emulator HC = 104 (where `whc = 0`).

**Visual Timeline** (Emulator Coordinates with WHC mapping):
```
HC:   0        87|88     103|104      143|144           399|400      423|424        455
      ├──────────┼──────────┼────────────┼─────────────────┼────────────┼────────────┤
whc:  352     495|-16     -1|0         39|40            295|296      319|320        351
      ├──────────┼──────────┼────────────┼─────────────────┼────────────┼────────────┤
      │ BLANKING │ BLANKING │  LEFT      │   ULA DISPLAY   │   RIGHT    │ BLANKING   │
      │ (whc     │ (whc     │  BORDER    │     (256 clk)   │   BORDER   │ (whc       │
      │  wrap)   │  wraps)  │  (40 clk)  │   ULA 256px     │  (24 clk)  │  320-351)  │
      │          │          │            │                 │            │            │
      └──────────┴──────────┴────────────┴─────────────────┴────────────┴────────────┘
                            ↑                                           ↑
                       whc = 0                                      whc = 320
                   (Sprite display                              (Sprite rendering
                   area begins)                                 window begins)
                 
                            ├───────────────────────────────────────────┤
                            │  Sprite 320px Display Area                │
                            │  (WHC 0–319)                              │
                            └───────────────────────────────────────────┘
```

**Key Mapping Points**:
- **Emulator HC 104 → WHC 0** (first sprite pixel)
- **Emulator HC 143 → WHC 39** (ULA display starts, but sprites already active)
- **Emulator HC 399 → WHC 295** (ULA display ends)
- **Emulator HC 423 → WHC 319** (last sprite display pixel)
- **Emulator HC 424 → WHC 320** (sprite rendering window begins)

**Total**: 456 CLK_7 cycles per scanline (0–455)

### Mapping Between Coordinate Systems

To convert between VHDL hardware coordinates (WHC) and emulator coordinates (main HC):

**Main HC → WHC** (emulator to hardware sprite counter):
```
whc = (hc - 104) mod 512

Examples:
  Emulator HC 104 → WHC 0   (first sprite pixel)
  Emulator HC 200 → WHC 96
  Emulator HC 423 → WHC 319 (last sprite pixel)
  Emulator HC 424 → WHC 320 (sprite rendering begins)
  Emulator HC 455 → WHC 351
  Emulator HC 0   → WHC 352 (wrapped to next scanline)
  Emulator HC 87  → WHC 495
  Emulator HC 88  → WHC -16/496 (reset point)
```

**WHC → Main HC** (hardware sprite counter to emulator):
```
hc = (whc + 104) mod 456

Examples:
  WHC 0   → Emulator HC 104 (first sprite pixel)
  WHC 96  → Emulator HC 200
  WHC 319 → Emulator HC 423 (last sprite pixel)
  WHC 320 → Emulator HC 424 (sprite rendering begins)
  WHC 351 → Emulator HC 455
  WHC 352 → Emulator HC 0   (wrapped to next scanline)
```

**Sprite Display Position Mapping**:

When sprites use WHC coordinates (0-319 for display), they map to emulator HC as follows:

```
Sprite X Position:  0              39|40                         295|296        319
(WHC coordinate)    ├────────────────┼──────────────────────────────┼────────────┤
                    │  Left Border   │  ULA Display Area (256px)    │Right Border│
                    │    (40 px)     │   (Overlaps w/ sprite area)  │  (24 px)   │
                    └────────────────┴──────────────────────────────┴────────────┘

Emulator HC:       104            143|144                        399|400        423
                    ├────────────────┼──────────────────────────────┼────────────┤
                    │  Sprite only   │  Sprite + ULA overlap        │ Sprite only│
                    └────────────────┴──────────────────────────────┴────────────┘
```

**Sprite Rendering Window** (blanking interval):
- **VHDL Hardware (WHC)**: 320–511 (**136 actual machine cycles** at CLK_7)
  - WHC 320–351: HC 424–455 (32 cycles)
  - WHC 352–495: HC 0–87 (88 cycles)
  - WHC 496–511: HC 88–103 (16 cycles, used for buffer swap and state reset)
- **Emulator (main HC)**: 424–455 + 0–87 (**120 CLK_7 cycles**)
  - Part 1: HC 424–455 (32 cycles)
  - Part 2: HC 0–87 (88 cycles)
  - Does not include HC 88–103 (reserved for buffer swap in hardware)

**Understanding WHC 320-511 = 192 values, but only 136 machine cycles**:

The confusion arises because WHC 320-511 represents **192 counter values**, but due to the WHC reset at HC 88, these 192 values only span **136 machine cycles**:

- WHC doesn't count continuously 320→511 in one sequence
- Instead: WHC 320-351 (32 cycles), then 352-495 (88 cycles), then reset breaks the sequence, then 496-511 (16 cycles)
- Total: 32 + 88 + 16 = **136 cycles**
- The **16-cycle difference** (136 - 120) is HC 88-103, where WHC transitions through 496-511
- This period is used for **line buffer swap** and **state machine reset**

**For emulation**: The hardware has **136 cycles** for sprite rendering, of which 16 cycles are used for bookkeeping (buffer swap). The emulator has **120 cycles** of pure rendering time, which matches the hardware's effective rendering window (136 - 16 = 120). Both systems have equivalent processing capability.

### Sprite Line Buffer Coordinates

The sprite line buffer uses **WHC display-relative coordinates** (0–319):

```vhdl
-- VHDL: Line buffer address
spr_line_addr_s <= spr_cur_hcount;  -- 9-bit, 0–319 valid range

-- Line buffer write validation
spr_cur_hcount_valid <= '1' when spr_cur_hcount < 320 else '0';
```

**Emulator Equivalent**:
- Sprite X positions 0–319 map to line buffer indices 0–319
- During video output (emulator HC 104–423, which is WHC 0-319), read from line buffer:
  - Line buffer index = (Emulator_HC - 104) = WHC for HC ∈ [104, 423]
  - Maps to pixel X positions 0–319 on screen
- **Note**: The ULA layer reads from HC 144–399, which corresponds to:
  - WHC 40-295 (line buffer indices 40-295)
  - The middle 256 pixels of the 320-pixel sprite buffer

### Practical Example: Sprite at X=100

When a sprite has X position = 100 (in WHC coordinate space):

1. **Sprite Rendering** (during blanking):
   - Sprite state machine calculates: `spr_cur_hcount = 100` (WHC = 100)
   - Writes pixels to line buffer indices 100–115 (16-pixel sprite)

2. **Video Output** (during display):
   - At Emulator HC = 204 (104 + 100), WHC = 100
   - Read line buffer index 100
   - Compose sprite pixel with other layers
   - Output to screen at pixel position X=100

3. **ULA Layer Interaction**:
   - ULA renders at Emulator HC 144–399 (WHC 40-295, line buffer indices 40-295)
   - Sprite at X=100 (WHC 100) overlaps with ULA pixel at X=60 (100 - 40)
   - Sprite at X=0–39 (WHC 0-39) appears left of ULA display (in left border)
   - Sprite at X=296–319 (WHC 296-319) appears right of ULA display (in right border)

### Display Coordinate Translation

The line buffer uses **WHC-based display-space coordinates** (0–319), which correspond to screen coordinates:

```
Line Buffer Index:  0              39|40                           295|296      319
(WHC coordinate)    ├────────────────┼──────────────────────────────┼────────────┤
                    │  Left Border   │  ULA Display Area (256px)    │Right Border│
                    │    (40 px)     │   (Overlaps w/ sprite area)  │  (24 px)   │
                    └────────────────┴──────────────────────────────┴────────────┘
                    ├──────────────────────────────────────────────────────────────┤
                    │             Sprite Display Area (320 pixels)                 │
                    └──────────────────────────────────────────────────────────────┘

Screen Position:   0              39|40                           295|296      319
(Physical pixels)  ├────────────────┼──────────────────────────────┼────────────┤
                   │  Sprite only   │  Sprite + ULA overlap        │ Sprite only│
                   └────────────────┴──────────────────────────────┴────────────┘
```

**Sprite Rendering vs Display Windows** (no overlap):

```
Emulator HC:  0      87|88   103|104                            423|424      455
              ├────────┼────────┼──────────────────────────────────┼────────────┤
              │ RENDER │  SWAP  │     DISPLAY (320 cycles)         │   RENDER   │
              │ (88)   │  (16)  │  Read from line buffer           │   (32)     │
              └────────┴────────┴──────────────────────────────────┴────────────┘
              ├────────────────┬┬──────────────────────────────────┬─────────────┤
              │ Sprite         ││ Sprite pixels displayed to       │ Sprite      │
              │ Processing:    ││ screen (prepared in previous     │ Processing: │
              │ - Qualify      ││ rendering phase)                 │ - Fetch     │
              │ - Fetch pixels ││                                  │ - Write     │
              │ - Write buffer ││                                  │   buffer    │
              └────────────────┴┴──────────────────────────────────┴─────────────┘
                               ↑↑
                            Buffer swap separates phases
```

**Emulator HC to Line Buffer Index**:
```typescript
// During sprite display area (HC 104–423, WHC 0-319)
const lineBufferIndex = hc - 104;  // Same as WHC
// Range: 0–319

// During ULA display area (HC 144–399, WHC 40-295)
const ulaLineBufferIndex = hc - 104;  // Also gives WHC
// ULA uses indices 40–295 (middle 256 pixels of sprite buffer)
```

**Sprite X Position to Line Buffer Index**:
```typescript
// Sprite X coordinate (0–511 in sprite attributes) maps to WHC/line buffer index
const lineBufferIndex = sprite.x & 0x1FF;  // Modulo 512, but only 0-319 visible
// Only indices 0–319 are within display window
```

**Wrapping Behavior**:
- Sprites with X ∈ [0, 319]: Fully or partially visible
- Sprites with X ∈ [320, 511]: Treated as negative X (wraps around left edge)
- Example: Sprite at X=500 appears at screen position X=500-512 = -12 (off-screen left, WHC wraps)

### Timing Synchronization

**Line Buffer Swap** (critical synchronization point):

```vhdl
-- VHDL: Swap at WHC = 511 (end of WHC scanline cycle)
line_reset_s <= '1' when hcounter_i = "111111111" else '0';
```

**Emulator Equivalent**:
- WHC = 511 occurs at Emulator HC = 103 (using formula: (511 + 104) mod 456 = 103)
- Swap should occur at this point: HC 103 → 104 (end of WHC cycle → sprite display begins)
- Ensures sprites for scanline N are ready before HC 104 (first sprite pixel, WHC = 0)

---

## Sprite Rendering Window (Emulator Activities)

This section describes **all activities** that occur during the 120 CLK_7 cycle sprite rendering window in the emulator coordinate system.

### Timeline Overview

**Rendering for Scanline N+1** occurs across two scanline periods:

```
═══════════════════════════════════════════════════════════════════════════
SCANLINE N (VC = N)
═══════════════════════════════════════════════════════════════════════════

HC 424-455: Sprite Rendering Phase 1 (32 cycles)
  → Render sprites for scanline N+1 into line buffer

═══════════════════════════════════════════════════════════════════════════
SCANLINE N+1 (VC = N+1)
═══════════════════════════════════════════════════════════════════════════

HC 0-87: Sprite Rendering Phase 2 (88 cycles)
  → Continue rendering sprites for scanline N+1 into line buffer

HC 88-103: Buffer Swap Period (16 cycles)
  → No rendering, state machine reset preparation

HC 104-423: Sprite Display Window (320 cycles)
  → Display sprites for scanline N+1 from line buffer
  → Compose with ULA/Layer 2/Tilemap layers

HC 424-455: Sprite Rendering Phase 1 (32 cycles)
  → Clear buffer, start rendering sprites for scanline N+2
```

### Detailed Activity Breakdown

#### Phase 1: HC 424-455 (Scanline N, 32 cycles)

**When**: End of scanline N  
**Goal**: Start rendering sprites for scanline N+1  
**Buffer State**: Empty or just cleared

**Activities** (at CLK_28 = 28 MHz, 4× faster than CLK_7):
1. **At HC 424** (first cycle):
   - Clear line buffer (set all 320 entries to 0 = transparent)
   - Initialize sprite state machine: state ← START
   - Set sprite index ← 0
   - Increment vertical line counter: spr_cur_vcount ← N+1

2. **HC 424-455** (32 CLK_7 cycles = 128 CLK_28 cycles):
   - **QUALIFY state** (for each sprite 0-127):
     - Read sprite attributes from attribute RAM (async, instant)
     - Check visibility: attr3[7] == 1?
     - Check Y-range: Y ≤ (N+1) < Y + height?
     - If visible: transition to PROCESS state
     - If not visible: increment sprite_index, check next sprite
   
   - **PROCESS state** (for visible sprites):
     - Calculate Y-offset: y_offset = (N+1) - sprite.Y
     - Apply Y-scale: y_index = y_offset >> scale_shift
     - Apply Y-mirror: if Y-mirror, y_index = ~y_index
     - Calculate pattern address: pattern_addr = (pattern_idx << 8) | (y_row << 4) | x_col
     - For each pixel (0-15, or more if scaled):
       - Fetch pattern byte from SRAM (1 CLK_28 cycle)
       - Check transparency: pixel != transparent_color
       - Apply palette offset: palette_idx = pixel + palette_offset
       - Calculate line buffer position: buffer_idx = sprite.X + pixel_offset
       - Write to buffer if: buffer_idx < 320 AND pixel is opaque
       - Check zero-on-top: don't overwrite if buffer[buffer_idx] already has pixel
     - Advance to next sprite when width complete

3. **Resource Budget**:
   - 128 CLK_28 cycles available
   - ~10-12 visible sprites can be processed (assuming ~10-12 CLK_28 per sprite)
   - Overhead: 1 cycle per sprite for QUALIFY, 1-2 cycles for PROCESS setup
   - Pattern fetches: 16 cycles minimum per 16×16 sprite (more if scaled)

#### Phase 2: HC 0-87 (Scanline N+1, 88 cycles)

**When**: Beginning of scanline N+1  
**Goal**: Complete rendering sprites for scanline N+1  
**Buffer State**: Partially filled from Phase 1

**Activities** (88 CLK_7 cycles = 352 CLK_28 cycles):
1. **Continue from Phase 1**:
   - State machine continues from where Phase 1 left off
   - If in PROCESS state: complete current sprite
   - If in QUALIFY state: continue checking remaining sprites

2. **Process Remaining Sprites**:
   - Same activities as Phase 1: QUALIFY → PROCESS
   - Approximately 30-40 more sprites can be checked/rendered
   - Total capacity: ~40-50 visible sprites per scanline (Phase 1 + Phase 2 combined)

3. **Completion**:
   - By HC 87, all 128 sprites should be checked
   - State machine should return to IDLE
   - Line buffer now contains complete sprite data for scanline N+1

4. **Overtime Condition**:
   - If sprites don't complete by HC 87: set overtime flag
   - Remaining sprites are skipped (hardware limitation)
   - This matches real hardware behavior

#### Swap Period: HC 88-103 (Scanline N+1, 16 cycles)

**When**: Scanline N+1, between rendering and display  
**Goal**: State machine reset and synchronization

**Activities** (16 CLK_7 cycles = 64 CLK_28 cycles):
1. **At HC 88** (WHC reset):
   - WHC counter resets to -16 (496 unsigned)
   - State machine should be in IDLE state

2. **HC 88-103**:
   - **No sprite rendering** occurs
   - State machine remains IDLE
   - Line buffer remains unchanged (contains sprites for N+1)
   - Emulator can use this time for other tasks

3. **At HC 103** (end of swap):
   - In hardware: line_reset signal triggers (WHC = 511)
   - Buffer swap occurs (hardware only)
   - Prepare for display at HC 104

#### Display Window: HC 104-423 (Scanline N+1, 320 cycles)

**When**: Scanline N+1, visible display area  
**Goal**: Read sprite data and compose with other layers

**Activities** (320 CLK_7 cycles):
1. **For each HC in [104, 423]**:
   - Calculate line buffer index: idx = HC - 104 (gives 0-319)
   - Read sprite entry: entry = lineBuffer[idx]
   - Extract valid flag: valid = (entry & 0x100) != 0
   - Extract palette index: palette_idx = entry & 0xFF
   
2. **Layer Composition**:
   - If valid flag set:
     - Lookup RGB color: rgb = spritePalette[palette_idx]
     - Compose with ULA/Layer 2/Tilemap based on priority
     - Write final pixel to frame buffer
   - If valid flag not set:
     - Use pixel from lower-priority layers

3. **Concurrent with Display**:
   - This is when ULA also renders (HC 144-399)
   - ULA accesses line buffer indices 40-295 (middle 256 pixels)
   - Sprite pixels at 0-39 appear in left border
   - Sprite pixels at 296-319 appear in right border

### State Machine States During Rendering Window

**IDLE State**:
- **When**: HC 0-87 (if all sprites processed), HC 88-103 (swap period)
- **Activity**: Waiting for next scanline or ready for swap
- **Transition**: At HC 103 (WHC 511), line_reset triggers START

**START State**:
- **When**: At HC 424 (beginning of rendering)
- **Duration**: 1 CLK_28 cycle
- **Activity**: sprite_index ← 0, initialize counters
- **Transition**: Immediately to QUALIFY

**QUALIFY State**:
- **When**: During HC 424-455 and HC 0-87
- **Duration**: 1-2 CLK_28 cycles per sprite (minimum)
- **Activity**: Check sprite visibility and Y-match
- **Transition**: 
  - If visible: → PROCESS
  - If not visible: increment sprite_index → QUALIFY (next sprite)
  - If sprite_index wraps to 0: → IDLE (all done)

**PROCESS State**:
- **When**: During HC 424-455 and HC 0-87 (for visible sprites)
- **Duration**: 16-128+ CLK_28 cycles (depends on sprite width and scaling)
- **Activity**: Fetch pattern, write pixels to line buffer
- **Transition**: When width complete → QUALIFY (next sprite)

---

### Detailed State Machine Operations (CLK_28 Level)

This section describes the **exact sequence of operations** at CLK_28 (28 MHz) granularity for the QUALIFY and PROCESS states.

#### QUALIFY State - Detailed Cycle Breakdown

The QUALIFY state checks whether a sprite should be rendered on the current scanline. It reads sprite attributes and performs visibility checks.

**Sprite Attribute Memory Layout** (5 bytes per sprite, 128 sprites):
```
Attribute RAM address = sprite_index × 5

Offset 0 (attr0): X position [7:0]           (bits 7-0 of X coordinate)
Offset 1 (attr1): Y position [7:0]           (bits 7-0 of Y coordinate)
Offset 2 (attr2): Palette offset [7:4]       (4-bit palette offset)
                  Y-mirror [2]                (vertical flip)
                  X-mirror [3]                (horizontal flip)
                  Rotation [1]                (90° rotation)
                  X MSB [0]                   (bit 8 of X coordinate)
Offset 3 (attr3): Visible [7]                (1 = visible, 0 = hidden)
                  Relative [6]                (1 = relative sprite)
                  Pattern [5:0]               (pattern index 0-63)
Offset 4 (attr4): 4-bit pattern [7]          (1 = 4-bit mode)
                  Pattern bit 6 [6]           (extends pattern to 0-127)
                  X-scale [5:4]               (00=1x, 01=2x, 10=4x, 11=8x)
                  Y-scale [3:2]               (00=1x, 01=2x, 10=4x, 11=8x)
                  Y MSB [0]                   (bit 8 of Y coordinate)
```

**QUALIFY State Execution** (cycle-by-cycle at CLK_28):

```
═══════════════════════════════════════════════════════════════════════════
Cycle 0: STATE = QUALIFY (entry from START or previous sprite)
═══════════════════════════════════════════════════════════════════════════

Input: sprite_index (0-127)
       spr_cur_vcount (current scanline number, e.g., N+1)

Action:
  1. Address calculation (combinatorial, instant):
     attr_addr = sprite_index  // Use sprite index directly, not × 5
  
  2. Memory read request (Simple Dual Port RAM with wide interface):
     Read all 5 bytes from attribute RAM at attr_addr in PARALLEL
     → attr0, attr1, attr2, attr3, attr4 (all 40 bits simultaneously)
     
     Note: Attribute RAM is organized as 128 words × 40 bits (5 bytes)
           NOT as 640 bytes × 8 bits
           
           The SDPRAM read port is asynchronous (address → data combinatorial)
           meaning data is available in the SAME cycle as the address
           
           All 5 attribute bytes are fetched together as a single 40-bit word
     
     Memory organization:
       Address 0  → Sprite 0 attributes (40 bits: attr0|attr1|attr2|attr3|attr4)
       Address 1  → Sprite 1 attributes (40 bits)
       ...
       Address 127 → Sprite 127 attributes (40 bits)
     
     **This is why QUALIFY can complete in 1 CLK_28 cycle** - all attribute
     data is available immediately without sequential byte reads

  3. Extract fields (combinatorial):
     visible_flag = attr3[7]
     relative_flag = attr3[6]
     pattern_index = attr3[5:0] | (attr4[6] << 6)  // 7-bit pattern
     x_lsb = attr0[7:0]
     x_msb = attr2[0]
     x_pos = (x_msb << 8) | x_lsb  // 9-bit X position
     y_lsb = attr1[7:0]
     y_msb = attr4[0]
     y_pos = (y_msb << 8) | y_lsb  // 9-bit Y position (for relative sprites)
     y_scale = attr4[3:2]
     x_scale = attr4[5:4]

  4. Calculate sprite height based on Y-scale:
     if y_scale == 00: height = 16   // 1x
     if y_scale == 01: height = 32   // 2x
     if y_scale == 10: height = 64   // 4x
     if y_scale == 11: height = 128  // 8x

  5. Visibility check #1 (combinatorial):
     is_visible = (visible_flag == 1)

  6. Y-range check (combinatorial):
     y_offset = spr_cur_vcount - y_pos
     y_match = (y_offset >= 0) AND (y_offset < height)
     
     Note: For standard sprites, y_pos is 8-bit (y_msb ignored)
           For relative sprites, y_pos is 9-bit

  7. Combined visibility (combinatorial):
     should_render = is_visible AND y_match

  8. Decision (registered at end of cycle):
     if should_render:
         next_state ← PROCESS
         // Keep sprite_index unchanged
         // Store y_offset for PROCESS state
     else:
         sprite_index ← sprite_index + 1
         if sprite_index == 0:  // Wrapped from 127 to 0
             next_state ← IDLE
         else:
             next_state ← QUALIFY
         end if
     end if

Outputs:
  - next_state: PROCESS or QUALIFY or IDLE
  - sprite_index: unchanged or incremented
  - y_offset: calculated and stored (if should_render)

Timing: 1 CLK_28 cycle minimum (if not visible)
        2 CLK_28 cycles if transitioning to PROCESS (setup time)

═══════════════════════════════════════════════════════════════════════════
```

**Special Cases in QUALIFY**:

1. **Relative Sprites**:
   ```
   If relative_flag == 1:
       // Use anchor sprite's position and transforms
       x_pos = anchor_x + relative_x_offset
       y_pos = anchor_y + relative_y_offset
       // Apply anchor's rotation/mirror to relative position
       if anchor_rotate:
           (x_pos, y_pos) = (y_pos, x_pos)  // Swap
   ```

2. **No-Time Optimization**:
   ```
   // Skip sprites that are too far right
   if (current_hcount >= 288) AND (x_pos > current_hcount + margin):
       skip sprite (treat as not visible)
   ```

3. **Anchor Sprite Loading**:
   ```
   If relative_flag == 0 AND attr4[7:6] != "01":
       // This sprite is an anchor, save its attributes
       anchor_x = x_pos
       anchor_y = y_pos
       anchor_rotate = attr2[1]
       anchor_xmirror = attr2[3]
       anchor_ymirror = attr2[2]
       // ... (store other anchor properties)
   ```

**QUALIFY Summary**:
- **Best case**: 1 CLK_28 cycle (sprite not visible, immediately skip)
- **Typical case**: 1-2 CLK_28 cycles (visibility check + state transition)
- **Per scanline**: ~128-256 CLK_28 cycles to check all 128 sprites (if none visible)

---

#### PROCESS State - Detailed Cycle Breakdown

The PROCESS state renders a visible sprite by fetching pattern data and writing pixels to the line buffer.

**PROCESS State Execution** (cycle-by-cycle at CLK_28):

```
═══════════════════════════════════════════════════════════════════════════
Cycle 0: STATE = PROCESS (entry from QUALIFY)
═══════════════════════════════════════════════════════════════════════════

Input: sprite_index (current sprite being processed)
       y_offset (row within sprite, calculated in QUALIFY)
       All sprite attributes (attr0-attr4) still available

Action:
  1. Calculate effective Y index with scaling and mirroring:
     
     // Apply Y-scale (right-shift for scaling)
     if y_scale == 00: y_index = y_offset[3:0]       // 1x, bits 0-3
     if y_scale == 01: y_index = y_offset[4:1]       // 2x, bits 1-4
     if y_scale == 10: y_index = y_offset[5:2]       // 4x, bits 2-5
     if y_scale == 11: y_index = y_offset[6:3]       // 8x, bits 3-6
     
     // Apply Y-mirror (bitwise NOT)
     if attr2[2] == 1:  // Y-mirror
         y_index = ~y_index[3:0]  // Invert bits (15 - y_index)
     
  2. Calculate starting X index based on mirroring:
     
     // Effective X-mirror (rotation XORs the mirror flag)
     x_mirror_eff = attr2[3] XOR attr2[1]
     
     if x_mirror_eff == 0:
         x_index = 0        // Normal: start at column 0
         x_delta = +1       // Increment
     else:
         x_index = 15       // Mirrored: start at column 15
         x_delta = -1       // Decrement
     
  3. Calculate base pattern address:
     
     // Pattern is 256 bytes: 16 rows × 16 columns
     if attr2[1] == 0:  // No rotation
         pattern_addr = (pattern_index << 8) | (y_index << 4) | x_index
         pattern_delta = x_delta  // Step by ±1
     else:  // Rotation (swap X and Y in addressing)
         pattern_addr = (pattern_index << 8) | (x_index << 4) | y_index
         pattern_delta = x_delta × 16  // Step by ±16
     
  4. Initialize width counter:
     
     // Width counter tracks sub-pixels for scaling
     width_count = 0
     
     // Width delta based on X-scale
     if x_scale == 00: width_delta = 1    // 1x, 16 pixels
     if x_scale == 01: width_delta = 2    // 2x, 32 pixels (each pixel drawn twice)
     if x_scale == 10: width_delta = 4    // 4x, 64 pixels
     if x_scale == 11: width_delta = 8    // 8x, 128 pixels
     
     total_width = 16 × width_delta       // Total pixels to render
     
  5. Initialize line buffer write position:
     
     line_buffer_pos = x_pos  // 9-bit X position (0-511)

Outputs:
  - pattern_addr: starting address for pattern fetch
  - pattern_delta: step size for next pixel
  - width_count: initialized to 0
  - line_buffer_pos: starting write position

Timing: 1-2 CLK_28 cycles for setup

═══════════════════════════════════════════════════════════════════════════
Cycles 1-N: Pixel Rendering Loop (repeats for each pixel)
═══════════════════════════════════════════════════════════════════════════

Loop: for each pixel in sprite (16 pixels base, more if scaled)

Cycle N+0: Fetch Pattern Byte
  
  Action:
    1. Request pattern memory read:
       Read 1 byte from pattern memory at pattern_addr
       → pattern_byte
       
       Note: Pattern SRAM is synchronous, but has zero-delay output
       Data available same cycle (fast SRAM or register output)
    
    2. Extract pixel value:
       
       if attr4[7] == 0:  // 8-bit pattern
           pixel_value = pattern_byte  // Use full byte
       else:  // 4-bit pattern
           // Extract nibble based on X position
           if x_index[0] == 0:
               pixel_value = pattern_byte[3:0]  // Lower nibble
           else:
               pixel_value = pattern_byte[7:4]  // Upper nibble
    
    3. Apply palette offset:
       
       if attr4[7] == 0:  // 8-bit pattern
           // Add palette offset to upper 4 bits only
           palette_index = (pattern_byte[7:4] + attr2[7:4]) | pattern_byte[3:0]
       else:  // 4-bit pattern
           // Palette offset replaces upper 4 bits
           palette_index = (attr2[7:4] << 4) | pixel_value
    
    4. Check transparency:
       
       is_transparent = (pixel_value == transparent_color)
       // transparent_color from NextReg 0x4B
    
    5. Check line buffer bounds:
       
       in_bounds = (line_buffer_pos[8:0] < 320)
       // Only indices 0-319 are valid for display
    
    6. Read existing line buffer value (for zero-on-top check):
       
       existing_pixel = line_buffer[line_buffer_pos[8:0]]
       existing_valid = existing_pixel[8]  // Valid flag bit
    
    7. Determine write enable:
       
       if zero_on_top_mode == 1:
           // Don't overwrite existing valid pixels
           write_enable = NOT is_transparent 
                         AND in_bounds 
                         AND NOT existing_valid
       else:
           // Normal mode: later sprites overwrite earlier
           write_enable = NOT is_transparent 
                         AND in_bounds
    
    8. Write to line buffer (if enabled):
       
       if write_enable:
           line_buffer[line_buffer_pos[8:0]] = (1 << 8) | palette_index
           // Bit 8 = valid flag
           // Bits 7:0 = palette index
           
           // Collision detection
           if existing_valid:
               collision_flag = 1  // Set collision status
    
    9. Advance counters:
       
       width_count = width_count + width_delta
       
       // Check if we should fetch next pattern pixel
       if width_count[4] changed from 0 to 1:
           // Toggle means we've rendered enough sub-pixels
           pattern_addr = pattern_addr + pattern_delta
           width_count = width_count AND 0x0F  // Keep lower 4 bits
       
       line_buffer_pos = line_buffer_pos + 1
    
    10. Check completion:
        
        pixels_rendered = pixels_rendered + 1
        
        if pixels_rendered >= total_width:
            // Sprite complete
            next_state ← QUALIFY
            sprite_index ← sprite_index + 1
            break loop
        
        if line_buffer_pos >= 512:
            // X wrapped around (off right edge)
            next_state ← QUALIFY
            sprite_index ← sprite_index + 1
            break loop
        
        // Otherwise, continue to next pixel

Outputs per pixel cycle:
  - Line buffer write (if pixel is opaque and in bounds)
  - pattern_addr advanced (every N sub-pixels based on scale)
  - line_buffer_pos incremented
  - collision_flag potentially set

Timing per pixel: 1 CLK_28 cycle minimum
                  (Pattern fetch + transparency check + buffer write)

═══════════════════════════════════════════════════════════════════════════
```

**PROCESS State Timing Examples**:

1. **Standard 16×16 sprite, no scaling** (x_scale=0, y_scale=0):
   - Setup: 2 CLK_28 cycles
   - Pixels: 16 CLK_28 cycles (1 per pixel)
   - **Total**: 18 CLK_28 cycles

2. **16×16 sprite, 2× X-scale** (x_scale=1, y_scale=0):
   - Setup: 2 CLK_28 cycles
   - Pixels: 32 CLK_28 cycles (render each pixel twice)
   - **Total**: 34 CLK_28 cycles

3. **16×16 sprite, 4× scale both axes** (x_scale=2, y_scale=2):
   - Setup: 2 CLK_28 cycles
   - Pixels: 64 CLK_28 cycles (16 pattern pixels × 4 repetitions)
   - **Total**: 66 CLK_28 cycles

4. **16×16 sprite, 8× scale both axes** (x_scale=3, y_scale=3):
   - Setup: 2 CLK_28 cycles
   - Pixels: 128 CLK_28 cycles (16 pattern pixels × 8 repetitions)
   - **Total**: 130 CLK_28 cycles

**PROCESS Summary**:
- **Minimum**: 18 CLK_28 cycles (standard sprite, all transparent)
- **Typical**: 18-34 CLK_28 cycles (standard sprite with some opaque pixels)
- **Maximum**: 130+ CLK_28 cycles (8× scaled sprite)
- **Per scanline budget**: 480 CLK_28 cycles total → ~10-25 sprites depending on scaling

---

### Complete Sprite Processing Example

**Scenario**: Render sprite #5 on scanline 100, sprite is at X=50, Y=95, 16×16, no transforms

```
Scanline 99, HC 424:
  CLK_28 cycle 0: STATE = START
    - sprite_index ← 0
    - spr_cur_vcount ← 100
  
  CLK_28 cycle 1: STATE = QUALIFY (sprite 0)
    - Read attributes for sprite 0
    - Check visible and Y-range
    - Not visible → sprite_index ← 1
  
  ... (cycles 2-5: check sprites 1-4, all not visible)
  
  CLK_28 cycle 6: STATE = QUALIFY (sprite 5)
    - Read attributes: X=50, Y=95, visible=1
    - Y-check: (100 - 95) = 5, in range [0, 16) ✓
    - should_render = TRUE
    - y_offset ← 5
  
  CLK_28 cycle 7-8: STATE = PROCESS (sprite 5 setup)
    - y_index = 5 (no scaling)
    - x_index = 0 (no mirror)
    - pattern_addr = (pattern_index << 8) | (5 << 4) | 0
    - line_buffer_pos = 50
  
  CLK_28 cycles 9-24: STATE = PROCESS (pixel loop, 16 pixels)
    - Cycle 9: Fetch pattern[5][0], write to buffer[50]
    - Cycle 10: Fetch pattern[5][1], write to buffer[51]
    - ...
    - Cycle 24: Fetch pattern[5][15], write to buffer[65]
  
  CLK_28 cycle 25: STATE = QUALIFY (sprite 6)
    - sprite_index ← 6
    - Continue checking remaining sprites...

Total time for sprite 5: 19 CLK_28 cycles (1 QUALIFY + 2 setup + 16 pixels)
```

This level of detail allows you to accurately emulate the sprite rendering timing and behavior.

### Emulator Implementation Considerations

**Single Buffer Approach**:
```typescript
// At HC 424 (scanline N)
if (hc === 424) {
  this.clearSpriteLineBuffer();  // Clear buffer for N+1
  this.renderSpritesForScanline(vc + 1);  // Start rendering N+1
}

// At HC 0-87 (scanline N+1)  
// Rendering continues automatically (same call)

// At HC 104-423 (scanline N+1)
if (hc >= 104 && hc <= 423) {
  const idx = hc - 104;
  const spritePixel = this.spriteLineBuffer[idx];
  // Compose with other layers
}
```

**Budget Management**:
- **Total**: 120 CLK_7 cycles = 480 CLK_28 cycles
- **Per-sprite overhead**: ~2 CLK_28 (QUALIFY + PROCESS setup)
- **Pattern fetch**: 16-128 CLK_28 (base sprite to 8× scaled)
- **Practical limit**: 10-30 visible sprites per scanline
- **Timeout**: If processing exceeds HC 87, skip remaining sprites

**Optimization Strategies**:
1. **Early termination**: Stop at sprite_index = 0 or when HC > 87
2. **X-culling**: Skip sprites with X > 319 or X < -128 immediately
3. **Y-culling**: Skip sprites outside vertical range before QUALIFY
4. **Fast path**: Optimize for non-transformed sprites (no rotate/mirror/scale)
5. **Pattern caching**: Cache recently-used patterns in memory

---

## Sprite Coordinate System (Display Space)

### Coordinate Ranges

- **Horizontal**: 0–511 pixels (9-bit, with wrapping at 320 display pixels)
- **Vertical**: 0–255 pixels (8-bit), extended to 9-bit via Y MSB for relative sprites
- **Display area**: 320×256 pixels (practical counter coordinates)

### Position Encoding

Sprites are positioned using **9-bit X and 9-bit Y coordinates**:

```
X = attr2[0] & attr0[7:0]  // 9-bit: X MSB + X LSB
Y = attr4[0] & attr1[7:0]  // 9-bit: Y MSB + Y LSB (for relative/scaled sprites)
```

For standard (non-relative) sprites, Y is 8-bit only. The 9th bit is used for relative sprite positioning and vertical scaling.

---

## Sprite Rendering Pipeline

### Stage 1: Sprite Attribute Fetch (Per-Scanline)

**Timing**: Occurs during **horizontal blanking** (VHDL WHC ≥ 320) at CLK_MASTER rate (28 MHz).

**Emulator Timing**: In the emulator's coordinate system:
- Blanking window (for sprite rendering): Emulator HC 424–455 (32 clocks) + HC 0–87 (88 clocks) = **120 CLK_7 cycles**
- Each CLK_7 = 2 CLK_14 = 4 CLK_28 cycles
- Available CLK_MASTER (28 MHz) cycles: 120 × 4 = **480 cycles** for sprite processing

**VHDL Hardware**:
- VHDL `hcounter_i` (WHC) provides **192 cycles** for sprite rendering (WHC 320-511)
- This maps to the same physical time as emulator's 120 cycles due to WHC's extended counter range (512 vs 456)

**Process**:
1. At VHDL WHC = 511 (Emulator HC = 103, end of WHC cycle), state transitions to `S_START`
2. At next clock: state → `S_QUALIFY`, sprite index = 0
3. Read sprite 0 attributes asynchronously from attribute RAM (no wait)

**Key Implementation Detail**: Attributes are read directly from **Simple Dual Port RAM** (sync write, async read):
- Write port: CPU/NextReg access (clock_master_180o)
- Read port: always accessible, combinatorial output

```vhdl
spr_attr_a <= spr_cur_index;  -- Continuous read of current sprite
-- Attributes available immediately: sprite_attr_0 through sprite_attr_4
```

### Stage 2: Sprite Visibility Check

**Condition**: A sprite is processed if:

```
visible = (attr3[7] = 1) AND (Y <= spr_cur_vcount < Y + height)
```

Where `spr_cur_vcount` is updated at frame boundary (HC=511, VC=0) and incremented per scanline.

**Y-Offset Calculation**:

```
spr_y_offset = spr_cur_vcount - Y
```

This offset determines which row of the pattern to fetch.

### Stage 3: Pattern Address Calculation

**Base Address Calculation** (combinatorial):

For each sprite, compute the starting address in pattern memory:

```
pattern_address = (pattern_index << 8) + (y_row << 4) + (x_pixel_index)
```

Where:
- `pattern_index`: 7 bits (6 + MSB from attr4[6] for extended patterns)
- `y_row`: 4 bits (sprite row 0–15)
- `x_pixel_index`: 4 bits (sprite column 0–15, subject to mirroring)

**Mirroring & Rotation Logic**:

```vhdl
-- Effective X mirror (rotation inverts)
spr_x_mirr_eff = attr2[3] XOR attr2[1]

-- X index calculation
if spr_x_mirr_eff = 0 then
    spr_x_index = 0  // Normal: increment from 0
else
    spr_x_index = 15 // Mirrored: start at 15, decrement
end if

-- Pattern address start point (no rotation)
pattern_addr = (pattern_index << 8) | (y_row << 4) | x_index

-- With rotation (X and Y swapped in address)
pattern_addr = (pattern_index << 8) | x_index << 4 | y_row
```

**Delta Direction** (for stepping through pattern pixels):

```vhdl
-- Pattern delta determines stepping direction
if rotate = 1 and x_mirror = 1 then
    delta = -16  // X mirror + rotate: step backwards by row
elsif rotate = 1 then
    delta = +16  // Normal rotate: step forward by row
elsif x_mirror = 1 then
    delta = -1   // X mirror only: step backwards by pixel
else
    delta = +1   // Normal: step forward by pixel
end if
```

### Stage 4: Pattern Fetch Timing

**Fetch Schedule** (during PROCESS state):

Sprites are rendered **pixel-by-pixel during horizontal blanking**:

1. Pattern address calculated for pixel 0
2. Request SRAM read (synchronous, zero-delay output)
3. Receive pixel data from pattern memory
4. Check transparency (pixel != transparent_color)
5. If opaque: write to line buffer with palette offset applied
6. Advance to next pixel: `pattern_addr += delta`
7. Repeat for all sprite pixels

**Emulator Context**:
- Pattern fetches occur at CLK_MASTER rate (28 MHz), corresponding to 4 memory accesses per emulator CLK_7 tact
- With 120 available CLK_7 cycles in blanking window, up to **480 pattern bytes** can theoretically be fetched
- **Hardware advantage**: VHDL has 192 cycles (vs emulator's 120), allowing ~768 pattern bytes
- Practical limit: ~10–12 sprites per scanline in emulator (vs ~16 sprites in hardware)
- **Emulation strategy**: Either optimize aggressively, or allow sprite rendering to extend into visible time with proper double-buffering

**Width Count Tracking** (for scaled sprites):

```vhdl
-- Tracks sub-pixels based on X-scale
width_count tracks each sub-pixel rendered

-- X-scale affects rendering rate
if x_scale = 00 then
    delta_per_sample = 1  // Standard 16 pixels
elsif x_scale = 01 then
    delta_per_sample = 2  // 2x width (32 pixels)
elsif x_scale = 10 then
    delta_per_sample = 4  // 4x width (64 pixels)
else
    delta_per_sample = 8  // 8x width (128 pixels)
end if
```

### Stage 5: Pixel Output to Line Buffer

**Pixel Write Condition**:

```vhdl
write_enable = (state = S_PROCESS)
             AND (hcounter_valid)
             AND (pixel_data != transparent_color)
             AND ((zero_on_top = 0) OR (buffer_pixel_valid = 0))
```

The last condition implements the **zero-on-top priority mode**: if enabled and a previous sprite already wrote to this location, skip writing.

**Palette Index Application**:

```vhdl
-- For 8-bit patterns
output_pixel = upper_nibble(pattern_data) + palette_offset

-- For 4-bit patterns (bit patterns)
output_pixel = palette_offset & lower_nibble(pattern_data)

-- Priority flag
output_flag = 1  // Sets priority bit in line buffer
```

---

## Transformations

### Anchoring & Relative Sprites

**Relative Sprite Chain**:

A relative sprite is a child sprite that positions itself relative to an **anchor sprite**:

```vhdl
-- Detect relative sprite
is_relative = (attr3[6] = 1) AND (attr4[7:6] = "01")

if is_relative then
    -- Load anchor sprite attributes into registers
    -- When next relative sprite encountered, use anchor transforms
else
    -- Standard sprite: becomes anchor for subsequent relative sprites
end if
```

**Anchor-Based Positioning**:

```vhdl
-- Relative sprite position is offset from anchor
rel_x_offset = anchor_x + (attr0 transformed by anchor properties)
rel_y_offset = anchor_y + (attr1 transformed by anchor properties)

-- Transforms applied based on anchor's rotation/mirror flags
if anchor_rotate = 1 then
    (rel_x_offset, rel_y_offset) = (rel_y_offset, rel_x_offset)  // Swap coordinates
end if

if anchor_xmirror XOR attr2[3] = 1 then
    rel_x_offset = -rel_x_offset  // Negate for mirroring
end if
```

### Mirroring

**X-Mirror** (attr2[3]):
- Reverses pixel order left-to-right
- Pattern address starts at column 15, decrements to 0
- Implementation: `spr_x_index` set to 15 vs. 0

**Y-Mirror** (attr2[2]):
- Reverses pixel order top-to-bottom
- Y index complemented: `y_index = ~y_offset`
- Implementation: bitwise NOT of Y offset

**Rotation** (attr2[1]):
- Swaps X and Y coordinates in pattern addressing
- Inverts effective X-mirror (mirroring XOR rotation)
- Used for 90° rotation effects

```vhdl
-- Rotation changes addressing mode
if rotate = 0 then
    pattern_addr = (pattern_idx << 8) | (y_row << 4) | x_col  // Row-major
else
    pattern_addr = (pattern_idx << 8) | (x_col << 4) | y_row  // Column-major (rotated)
end if
```

### Scaling

**Zoom Levels** (attr4[4:3] for X, attr4[2:1] for Y):

```
00 = 1x (16 pixels)
01 = 2x (32 pixels)
10 = 4x (64 pixels)
11 = 8x (128 pixels)
```

**Y-Scale Implementation**:

```vhdl
-- Applied to Y offset before indexing
case y_scale is
    when "00" =>                           -- 1x
        y_index = y_offset[3:0]
    when "01" =>                           -- 2x
        y_index = y_offset[4:1]            // Right-shift by 1
    when "10" =>                           -- 4x
        y_index = y_offset[5:2]            // Right-shift by 2
    when "11" =>                           -- 8x
        y_index = y_offset[6:3]            // Right-shift by 3
    when others => y_index = (others => '0');
end case
```

**X-Scale Implementation**:

```vhdl
-- Affects rendering rate (width_count delta)
case x_scale is
    when "00" => width_count_delta = 0001  // 1 cycle per pixel
    when "01" => width_count_delta = 0010  // 2 cycles per pixel (2x)
    when "10" => width_count_delta = 0100  // 4 cycles per pixel (4x)
    when "11" => width_count_delta = 1000  // 8 cycles per pixel (8x)
    when others => width_count_delta = 0000;
end case

-- When width_count[3] bit toggles, fetch next pattern pixel
```

### Palette Offset

**Offset Application** (attr2[7:4]):

```vhdl
-- For 8-bit patterns
palette_index[7:4] = pattern_pixel[7:4] + palette_offset
palette_index[3:0] = pattern_pixel[3:0]

-- For 4-bit patterns
palette_index = palette_offset & pattern_pixel[3:0]
```

**Relative Sprite Palette Override**:

```vhdl
if is_relative then
    -- Relative sprite can add to anchor's palette offset
    final_palette_offset = anchor_paloff + attr2[7:4]
else
    final_palette_offset = attr2[7:4]
end if
```

---

## Sprite Priority & Display Order

### Line-Level Priority

**Rendering Order**:

Sprites are processed in **sprite index order** (0 → 127):

1. Sprite 0 renders first
2. Sprite 1 renders over sprite 0 (if both enabled)
3. Sprite 127 renders on top

This creates a natural priority ordering: **higher sprite number = higher priority**.

### Zero-on-Top Mode

**Behavior** (NextReg 0x15 bit 7, or similar):

```vhdl
if zero_on_top_enable = 1 then
    -- Sprite 0 always on top
    write_enable = (pixel != transparent) AND (prev_pixel_valid = 0)
else
    -- Later sprites overwrite earlier sprites
    write_enable = (pixel != transparent)
end if
```

When enabled, sprite 0 cannot be overwritten by later sprites on the same scanline.

### Layer Composition Priority

Sprites are composed with other layers (ULA, Layer 2, Tilemap) based on:

1. **Sprite visibility flag** (attr3[7]): Must be set to render
2. **Composition order** (system-wide, set by NextReg 0x15[4:2])
3. **Layer 2 priority bit**: Can override sprite priority

---

## Performance Optimizations

### Blanking-Interval Rendering

**Key Insight**: Sprites are processed **entirely during horizontal blanking**:

- **VHDL Hardware**:
  - Display active: HC ∈ [0, 319] — video composition runs
  - Blanking interval: HC ∈ [320, 511] — sprite rendering runs (192 clocks)

- **Emulator Coordinate System**:
  - Rendering active: HC ∈ [96, 415] (visible area, 320 clocks)
  - Blanking window: HC ∈ [416, 455] + [0, 95] (136 CLK_7 cycles)
  - The emulator skips rendering during HC 0–95 (blanking, `renderTact` returns early)
  - Sprite processing should occur during **non-rendering clocks**

**Timing Constraint**: All sprites for a scanline must complete before display starts:

```
// VHDL Hardware:
Available time = 192 CLK_MASTER cycles (512 - 320)
Throughput = 1 pixel per CLK_MASTER cycle (theoretical max)

// Emulator:
Available time = 136 CLK_7 cycles × 4 (CLK_28 per CLK_7) = 544 CLK_MASTER cycles
Throughput = ~1 pixel per CLK_MASTER cycle
```

**Emulator Implementation Note**: The sprite rendering can be deferred to the end of each scanline (after emulator HC 415) or processed in a separate pass before composition. The key requirement is that all sprite pixels for scanline N must be ready **before** the first visible pixel of scanline N is composed.

### Timeout Detection

**Overtime Flag**:

```vhdl
-- Set when sprites cannot complete within blanking interval
if (state != S_IDLE AND line_reset) then
    sprites_overtime = 1
end if
```

Signals to emulator that sprite processing exceeded available time (status reg bit 1).

**Emulator Context**:
- `line_reset` occurs at VHDL HC = 511 (Emulator HC = 95, end of blanking)
- If sprite state machine hasn't returned to IDLE by this point, set overtime flag
- In emulator: Check if sprite rendering completes within the allocated blanking window
- Sprites that don't fit within the time budget should be skipped (hardware limitation)

### No-Time Mask

**Early-Exit Optimization** (spr_cur_notime):

Sprites with small X offsets that would finish instantly can be skipped in queue:

```vhdl
spr_cur_notime = 1 when
    hcounter[8] = 1 AND hcounter[5] = 1 AND
    (hcounter[4:0] AND x_wrap_mask = x_wrap_mask)
```

Prevents wasting state cycles on trivial sprites.

**Emulator Context**:
- This check uses the **display-relative** hcounter (VHDL HC 0–319 for visible pixels)
- Condition triggers when hcounter ≥ 256 + 32 = 288 (near end of visible area)
- In emulator coordinates: VHDL HC 288 → Emulator HC ~384 (within visible region HC 96–415)
- Purpose: Skip sprites that are too far right and would exceed the blanking window budget

---

## State Machine

### States

| State | Purpose | Duration |
|-------|---------|----------|
| **IDLE** | Waiting for frame/scanline event | Variable |
| **START** | Initialize sprite iteration (sprite_index=0) | 1 clock |
| **QUALIFY** | Check sprite visibility and Y-match | 1 clock |
| **PROCESS** | Render sprite pixels to line buffer | Width × scaling cycles |

### State Transitions

```
IDLE → START (at HC=511, VC boundary)
START → QUALIFY (next clock)
QUALIFY → PROCESS (if visible AND Y-match) OR QUALIFY (next sprite) OR IDLE (done)
PROCESS → QUALIFY (width complete) OR PROCESS (continue)
PROCESS → IDLE (all 128 sprites processed)
```

**Visual State Machine Flow** (with Emulator Timing):

```
                    ┌────────────────────────────────────────────────────┐
                    │                     IDLE                           │
                    │  Waiting for scanline boundary                     │
                    │  (Emulator: waiting for HC=95, buffer swap point)  │
                    └──────────────────┬─────────────────────────────────┘
                                       │
                        VHDL HC=511 (Emulator HC=95)
                        line_reset signal triggers
                                       │
                                       ▼
                    ┌────────────────────────────────────────────────────┐
                    │                    START                           │
                    │  sprite_index ← 0                                  │
                    │  Initialize for new scanline                       │
                    │  (1 CLK_MASTER cycle)                              │
                    └──────────────────┬─────────────────────────────────┘
                                       │
                                       ▼
                    ┌────────────────────────────────────────────────────┐
                    │                  QUALIFY                           │
                    │  Read attributes for sprite[sprite_index]         │
                    │  Check: visible? Y-match? No-time?                 │
                    │  (1 CLK_MASTER cycle)                              │
                    └──────┬────────────────────┬────────────────────────┘
                           │                    │
                  NOT visible          visible AND Y-match
                  OR no time           AND time available
                           │                    │
                           │                    ▼
                           │         ┌────────────────────────────────────┐
                           │         │           PROCESS                  │
                           │         │  Render sprite pixels to buffer    │
                           │         │  Pattern fetch → Write line buffer │
                           │         │  (Width × Scale cycles)            │
                           │         └─────────────┬──────────────────────┘
                           │                       │
                           │              Width complete
                           │              OR X overflow
                           │                       │
                           └───────────────────────┘
                                       │
                              sprite_index++
                                       │
                           ┌───────────┴────────────┐
                           │                        │
                   sprite_index < 128      sprite_index = 0
                   (more sprites)          (wrapped, all done)
                           │                        │
                           └─── Back to QUALIFY     └─── Back to IDLE


Emulator Timeline (per scanline):
═══════════════════════════════════════════════════════════════════════════

HC:  0   ...  95|96  111|112  ...  431|432  ...  455
     ├─────────┼──────────┼──────────────┼──────────┤
     │  LEFT   │  BORDER  │   SPRITE     │  BORDER/ │
     │ BLANK   │          │   DISPLAY    │  BLANK   │
     │         │          │   (320 px)   │          │
     └─────────┴──────────┴──────────────┴──────────┘
              ↑           ↑              ↑
         Buffer Swap   Sprite        Trigger Sprite
         START state   Display       Rendering
                       Starts        (QUALIFY/PROCESS)
```

### Sprite Index Iteration

```vhdl
-- In QUALIFY state
if draw_current_sprite then
    state <= PROCESS
else
    spr_cur_index <= spr_cur_index + 1
    if spr_cur_index = 0 then  // Wrapped to 127→0
        state <= IDLE
    else
        state <= QUALIFY  // Next sprite
    end if
end if
```

---

## Line Buffer Architecture

### Double Buffering

**Purpose**: Continuous rendering and display without tearing

Double buffering is the **key mechanism** that enables non-overlapping sprite rendering and display:

- **Buffer A (READ or WRITE)**: Contains sprite data for one scanline
- **Buffer B (WRITE or READ)**: Contains sprite data for another scanline
- Buffers alternate roles each scanline via swap

**Swap Timing**: At WHC = 511 (Emulator HC = 103), end of scanline

```vhdl
process (clock_master)
    if line_reset_re = "01" then
        line_buf_sel <= not line_buf_sel
    end if
end process
```

**The Double Buffer Cycle** (example with scanlines 100, 101, 102):

```
═══════════════════════════════════════════════════════════════════════════
SCANLINE 100 (VC=100)
═══════════════════════════════════════════════════════════════════════════

START: HC 0 (beginning of scanline)
  Buffer A: READ buffer  - Contains sprites for scanline 100 (rendered during line 99)
  Buffer B: WRITE buffer - Empty, ready for rendering

HC 0-87: RENDER sprites for scanline 101 → Buffer B (WRITE)
  - Qualify sprites: which are visible on line 101?
  - Fetch patterns for visible sprites
  - Write pixels to Buffer B at positions 0-319

HC 88-103: SWAP PERIOD (16 cycles)
  - No rendering (state machine preparing for swap)
  - No display yet (still in blanking)
  - At HC 103: SWAP BUFFERS
    → Buffer A becomes WRITE buffer
    → Buffer B becomes READ buffer

HC 104-423: DISPLAY sprites for scanline 100 ← Buffer B (READ)
  - Read Buffer B at positions 0-319
  - Compose with ULA/Layer 2/Tilemap
  - Output to screen at current VC (100)
  - Note: This is the PREVIOUS buffer, rendered during scanline 99

HC 424-455: Continue RENDER sprites for scanline 101 → Buffer A (WRITE)
  - Continue processing sprites that didn't fit in HC 0-87
  - Write pixels to Buffer A at positions 0-319

END: HC 455
  Buffer A: Contains sprites for scanline 101 (READY for next line)
  Buffer B: Contains sprites for scanline 100 (just displayed, will be cleared)

═══════════════════════════════════════════════════════════════════════════
SCANLINE 101 (VC=101)
═══════════════════════════════════════════════════════════════════════════

START: HC 0
  Buffer A: WRITE buffer - Will receive sprites for scanline 102
  Buffer B: READ buffer  - Contains sprites for scanline 101 (rendered during line 100)

HC 0-87: RENDER sprites for scanline 102 → Buffer A (WRITE)
  - Process sprites for next scanline (102)
  - Write pixels to Buffer A

HC 88-103: SWAP PERIOD
  - At HC 103: SWAP BUFFERS
    → Buffer A becomes READ buffer
    → Buffer B becomes WRITE buffer

HC 104-423: DISPLAY sprites for scanline 101 ← Buffer A (READ)
  - Read Buffer A (rendered during scanline 100)
  - Compose and output to screen at VC 101

HC 424-455: Continue RENDER sprites for scanline 102 → Buffer B (WRITE)
  - Write remaining sprite pixels to Buffer B

END: HC 455
  Buffer A: Contains sprites for scanline 101 (just displayed)
  Buffer B: Contains sprites for scanline 102 (READY for next line)

═══════════════════════════════════════════════════════════════════════════
SCANLINE 102 (VC=102)
═══════════════════════════════════════════════════════════════════════════

START: HC 0
  Buffer A: READ buffer  - Contains sprites for scanline 102 (rendered during line 101)
  Buffer B: WRITE buffer - Will receive sprites for scanline 103

HC 0-87: RENDER sprites for scanline 103 → Buffer B (WRITE)
HC 88-103: SWAP PERIOD → Buffers swap at HC 103
HC 104-423: DISPLAY sprites for scanline 102 ← Buffer A (READ)
HC 424-455: Continue RENDER sprites for scanline 103 → Buffer B (WRITE)

END: HC 455
  Buffer A: Contains sprites for scanline 102 (just displayed)
  Buffer B: Contains sprites for scanline 103 (READY for next line)
```

**Key Insights**:

1. **Temporal Offset**: Sprites displayed on scanline N were rendered during scanline N-1
2. **One Scanline Latency**: There's always a 1-scanline delay between rendering and display
3. **Zero Overlap**: Rendering window (HC 0-87, 424-455) and display window (HC 104-423) never overlap
4. **Swap at HC 103**: The 16-cycle swap period (HC 88-103) acts as a "neutral zone" separating the two phases
5. **Continuous Pipeline**: While displaying line N, we're already rendering line N+1

**Why This Works**:
- The hardware can't render and display sprites simultaneously from the same buffer
- By using two buffers, one can be read (display) while the other is written (render)
- The swap ensures the freshly-rendered buffer becomes the read buffer for the next scanline
- This creates a continuous pipeline: render → swap → display → render → swap → display...

### Line Buffer Entry Format

Each pixel in line buffer (9 bits):

```
Bit 8: Valid/Priority flag (1 = sprite pixel valid)
Bits 7:0: Palette index (0–255)
```

### Collision Detection

**Collision Flag** (status reg bit 0):

```vhdl
spr_line_we = 1 when
    (pixel != transparent) AND
    ((zero_on_top = 0) OR (buffer_pixel_valid = 0))

collision = spr_line_data_o[8] AND spr_line_we
```

Collision detected when attempting to write a second sprite at same location.

### Implementation Summary for Emulator

**Key Synchronization Points**:

1. **Line Buffer Swap**: At Emulator HC = 95 (VHDL HC = 511)
   ```typescript
   if (hc === 95) {
     this.swapSpriteLineBuffers();
     this.currentScanline = vc + 1;  // Advance to next scanline
   }
   ```

2. **Sprite Rendering Trigger**: At Emulator HC = 431 (end of 320px sprite display)
   ```typescript
   if (hc === 431) {
     // Render all sprites for NEXT scanline (vc + 1)
     // This occurs during the blanking window (HC 432–455, 0–95)
     this.renderSpritesForScanline(vc + 1);
   }
   ```

3. **Line Buffer Read**: During Emulator HC 112–431 (sprite display area)
   ```typescript
   if (hc >= 112 && hc <= 431) {
     const lineBufferIndex = hc - 112;  // 0–319
     const spritePixel = this.activeReadBuffer[lineBufferIndex];
     // Use spritePixel in layer composition
   }
   ```

**Buffer Management**:
```typescript
class NextComposedScreenDevice {
  // Line buffers: 320 pixels × 9 bits (8-bit palette index + valid flag)
  private spriteLineBufferA: Uint16Array;  // Buffer 0
  private spriteLineBufferB: Uint16Array;  // Buffer 1
  private activeReadBuffer: Uint16Array;   // Currently being displayed
  private activeWriteBuffer: Uint16Array;  // Currently being rendered to
  
  swapSpriteLineBuffers(): void {
    [this.activeReadBuffer, this.activeWriteBuffer] = 
      [this.activeWriteBuffer, this.activeReadBuffer];
  }
  
  clearActiveWriteBuffer(): void {
    // Clear write buffer for next scanline
    this.activeWriteBuffer.fill(0);  // 0 = transparent (valid flag = 0)
  }
}
```

**Integration with renderTact()**:
```typescript
renderTact(tact: number): boolean {
  const vc = this.tactToVc[tact];
  const hc = this.tactToHc[tact];
  
  // === Buffer swap point ===
  if (hc === 95) {
    this.swapSpriteLineBuffers();
    this.clearActiveWriteBuffer();
  }
  
  // === Sprite rendering trigger ===
  if (hc === 431) {  // End of 320px sprite display area
    this.renderSpritesForScanline(vc + 1);
  }
  
  // === Early exit for blanking ===
  if (this.activeULARenderingFlags[tact] === 0) {
    return false;  // Skip blanking
  }
  
  // === Layer composition ===
  // Sprites are visible during HC 112–431
  if (hc >= 112 && hc <= 431) {
    const lineBufferIndex = hc - 112;  // 0–319
    const spriteEntry = this.activeReadBuffer[lineBufferIndex];
    const spriteValid = (spriteEntry & 0x100) !== 0;
    const spritePaletteIdx = spriteEntry & 0xFF;
    
    // ... compose sprite with other layers ...
  }
}
```

---

## Emulation Recommendations

### Implementation Strategy for NextComposedScreenDevice

Given the emulator's coordinate system and rendering architecture, here are recommended approaches:

#### Option 1: Scanline-End Batch Processing (Recommended)

Process all sprites for a scanline at the end of the scanline (during blanking):

```typescript
renderTact(tact: number): boolean {
  const vc = this.tactToVc[tact];
  const hc = this.tactToHc[tact];
  
  // === Sprite rendering window ===
  // At end of visible area, before next scanline starts
  if (hc === 415) {  // Last visible HC before blanking
    // Render all sprites for NEXT scanline (vc + 1)
    this.renderSpritesForScanline(vc + 1);
  }
  
  // === Early exit for blanking ===
  if (this.activeULARenderingFlags[tact] === 0) {
    return false;  // Blanking region, no visible content
  }
  
  // === Layer composition (includes sprite line buffer read) ===
  // Read sprite pixels from line buffer for current VC
  const spritePixel = this.readSpriteLineBuffer(vc, hc);
  
  // ... compose layers ...
}

renderSpritesForScanline(vc: number): void {
  // Clear line buffer for this scanline
  this.clearSpriteLineBuffer();
  
  // Iterate sprites 0–127
  for (let spriteIdx = 0; spriteIdx < 128; spriteIdx++) {
    const sprite = this.getSpriteAttributes(spriteIdx);
    
    // Check if sprite is visible on this scanline
    if (!sprite.visible) continue;
    
    const yOffset = vc - sprite.y;
    const height = this.getSpriteHeight(sprite);
    
    if (yOffset < 0 || yOffset >= height) continue;
    
    // Sprite is visible on this scanline
    this.renderSpriteToLineBuffer(sprite, yOffset);
  }
}
```

**Advantages**:
- Matches hardware timing closely (sprites rendered during blanking)
- Natural separation of sprite rendering from composition
- Easy to implement timeout detection (count cycles/sprites)

**Timing**: One call per scanline at HC=415, processes all sprites once per scanline.

#### Option 2: Pre-Frame Batch Processing (Alternative)

Render all sprites for the entire frame before starting composition:

```typescript
onNewFrame(): void {
  // ... existing frame setup ...
  
  // Pre-render all sprites for all scanlines
  this.renderAllSpritesForFrame();
}

renderAllSpritesForFrame(): void {
  // Allocate or clear sprite frame buffer (320×256 or 320×272)
  this.clearAllSpriteLineBuffers();
  
  // For each sprite
  for (let spriteIdx = 0; spriteIdx < 128; spriteIdx++) {
    const sprite = this.getSpriteAttributes(spriteIdx);
    if (!sprite.visible) continue;
    
    // Render sprite to all affected scanlines
    this.renderSpriteToFrameBuffer(sprite);
  }
}
```

**Advantages**:
- Simpler integration with existing rendering loop (no timing constraints)
- Can optimize with culling and caching
- No per-scanline overhead

**Disadvantages**:
- Doesn't reflect hardware timing (no timeout detection)
- Must handle mid-frame sprite attribute changes differently

### Performance Considerations

1. **Lazy Attribute Loading**: Don't load all 128 sprite attributes each frame. Load attributes only when sprite becomes visible on current scanline.

2. **Pattern Caching**: Cache recently-accessed sprite patterns in host memory to avoid re-reading from SRAM simulation each frame.

3. **Viewport Culling**: Skip sprites with X positions > 319 (off-screen right) or < -128 (off-screen left) without rendering.

4. **Batching**: Accumulate multiple sprite writes to line buffer before output sync, rather than per-pixel.

5. **Fast Path Detection**: For non-transformed sprites (no rotation, mirroring, or scaling), use a simplified rendering path:
   ```typescript
   if (!sprite.rotate && !sprite.xMirror && !sprite.yMirror && 
       sprite.xScale === 0 && sprite.yScale === 0) {
     // Fast path: simple memcpy-style rendering
     this.renderSpriteFastPath(sprite);
   } else {
     // Slow path: full transformation pipeline
     this.renderSpriteFull(sprite);
   }
   ```

### Accuracy Priorities

1. **Lazy Attribute Loading**: Don't load all 128 sprite attributes each frame. Load attributes only when sprite becomes visible on current scanline.

2. **Pattern Caching**: Cache recently-accessed sprite patterns in host memory to avoid re-reading from SRAM simulation each frame.

3. **Viewport Culling**: Skip sprites with X positions > 319 (off-screen right) or < -128 (off-screen left) without rendering.

4. **Batching**: Accumulate multiple sprite writes to line buffer before output sync, rather than per-pixel.

### Accuracy Priorities

1. **Y-Offset Calculation**: Must precisely match hardware (V counter advances during VSYNC region, sprite rendering uses next scanline's counter).

2. **Mirroring & Rotation**: Bitwise operations must execute identically to hardware (no rounding/approximation).

3. **Scaling**: Y-scale right-shift must preserve sign bit for negative offsets (arithmetic shift).

4. **Palette Offset**: Must wrap palette index correctly (modulo 256 for 8-bit).

5. **Priority Ordering**: Sprite index order determines visual priority **exactly** (no secondary sorting by Y position).

### Critical Edge Cases

1. **Relative Sprite Chains**: When anchor sprite is invisible, relative children still render if they have visible flag set.

2. **Scaled Sprites at Boundaries**: When zoomed sprite extends beyond display (X > 319 or Y > 255), rendering must wrap correctly.

3. **Sprite 0 Rotation**: When sprite 0 becomes anchor for relative sprites while rotated, coordinate transforms are complex (verify against hardware).

4. **Pattern Index Overflow**: When relative sprite pattern index exceeds 63, behavior may wrap (depends on implementation).

---

## References

**VHDL Source**: `sprites.vhd` (ZX Spectrum Next FPGA project)

**Key Signals**:
- `spr_cur_index`: Current sprite number (0–127)
- `spr_cur_vcount`: Scanline counter (tracks which sprite row to render)
- `spr_y_offset`: Offset into sprite pattern (Y distance from sprite Y position)
- `spr_cur_hcount`: Horizontal pixel counter (X position on screen)
- `spr_width_count`: Sub-pixel counter for scaling effects
- `state_s`: Current state machine state (IDLE, START, QUALIFY, PROCESS)

---

## Quick Reference: Coordinate System Mapping

| Aspect | VHDL Hardware (WHC) | Emulator (Main HC) |
|--------|---------------------|---------------------|
| **Counter Range** | 0–511 (456 values/scanline) | 0–455 (456 cycles) |
| **Sprite Display Area** | WHC 0–319 (320 pixels) | HC 104–423 (320 clocks) |
| **ULA Display Area** | WHC 40–295 (256 pixels) | HC 144–399 (256 clocks) |
| **Blanking Interval** | WHC 320–511 (136 machine cycles) | HC 424–455 + 0–87 (120 cycles) |
| **Sprite Rendering Window** | WHC 320–511 (136 cycles total) | HC 424–455, 0–87 (120 cycles) |
| **Buffer Swap Period** | WHC 496–511 (16 cycles at HC 88–103) | HC 88–103 (16 cycles, not used for rendering) |
| **Line Buffer Swap** | WHC = 511 | HC = 103 (WHC wraps to 0) |
| **Line Buffer Size** | 320 × 9-bit | 320 × 16-bit (Uint16Array) |
| **Sprite Coordinates** | 0–319 (WHC-relative) | 0–319 (line buffer indices) |
| **Clock Rate** | CLK_7 (7 MHz) | CLK_7 (7 MHz) |
| **State Machine Clock** | CLK_MASTER (28 MHz) | CLK_28 equivalent (28 MHz) |

**Conversion Formulas**:
```
// Emulator HC to WHC
whc = (hc - 104) mod 512

// WHC to Emulator HC  
hc = (whc + 104) mod 456

// Examples:
HC 104 → WHC 0   (first sprite pixel)
HC 423 → WHC 319 (last sprite pixel)
HC 424 → WHC 320 (sprite rendering begins)
```

**Key Timing Points** (Emulator HC with WHC mapping):
- **HC = 88**: WHC reset point (WHC wraps to -16/496)
- **HC = 103**: WHC = 511, buffer swap occurs
- **HC = 104** (WHC 0): First sprite display pixel, line buffer index 0
- **HC = 143** (WHC 39): Last left border pixel before ULA
- **HC = 144** (WHC 40): ULA display start (displayXStart, 0x90)
- **HC = 399** (WHC 295): ULA display end (displayXEnd, 0x18F)
- **HC = 400** (WHC 296): Right border begins
- **HC = 423** (WHC 319): Last sprite display pixel, line buffer index 319
- **HC = 424** (WHC 320): Sprite rendering window begins (blanking)
- **HC = 455** (WHC 351): End of scanline
- **HC = 0** (WHC 352): Wrap to next scanline, sprite rendering continues
- **HC = 87** (WHC 495): Last cycle before WHC reset

**Important Note**: WHC is a derived counter that runs continuously at CLK_7 rate, resetting when main HC = 88. The 512-cycle range provides a convenient 320-pixel display coordinate system for sprites, Layer 2, and tilemaps.

---

## Document History

- **December 2024**: Initial analysis from VHDL source code (Claude Sonnet 4.5)
- **January 2026**: Enhanced with emulator coordinate system mapping and integration guidance
- **January 2026**: Corrected HC-to-WHC mapping after discovering WHC is derived from main HC counter
