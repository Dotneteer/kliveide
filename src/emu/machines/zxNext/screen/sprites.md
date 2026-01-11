# ZX Spectrum Next Sprite Rendering Algorithm

## Overview

The ZX Spectrum Next sprite engine is a high-performance hardware renderer supporting up to 128 sprites with sophisticated transformation capabilities. The architecture uses a state machine-driven approach with double-buffered line buffers to efficiently process sprites during frame rendering. This document describes the algorithm for emulation implementation.

**Key Characteristics**:
- **128 hardware sprites** (16×16 pixels base size)
- **64 sprite patterns** (expandable via relative sprites)
- **Per-sprite transformations**: rotation, mirroring, scaling (1x–4x), palette offset
- **Relative sprite chains**: unlimited sprite combinations via anchor + relative sprites
- **9-bit positioning**: extended coordinate space (0–511 pixels horizontally, wider than the 320-pixel visible area)
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
- **WHC 0–319 → Emulator HC 112–431** (320-pixel display area for sprites)
- WHC 320–511 → Emulator HC 432–455 (24) + 0–95 (96) + 96–111 (16) = 136 cycles total
- **Sprite rendering window**: 
  - Hardware: WHC 320–511 (136 actual machine cycles: 24+96+16)
  - Emulator: HC 432–455 (24) + HC 0–95 (96) = 120 cycles (excluding 16-cycle reset period)

**Important**: Sprites use the **320-pixel coordinate system** (HC 112–431), NOT the ULA's 256-pixel system (HC 144–399). The sprite display area starts 32 pixels before the ULA display.

### Hardware Implementation Peculiarities

The VHDL sprite hardware has several unique characteristics that distinguish it from typical software implementations:

**1. Wide Horizontal Counter (WHC)**
- Hardware uses a **9-bit WHC counter (0-511)** separate from the main horizontal counter
- WHC provides a 320-pixel coordinate space, wider than the ULA's 256-pixel area
- WHC resets at HC=96, creating an offset: `whc = (hc - 112) mod 512`
- This allows sprites to use a unified coordinate system independent of video timing modes

**2. True Parallel Double Buffering**
- Hardware implements **two physical 320×9-bit line buffers** (640 words total)
- **Simultaneous operations**: One buffer is being written (sprite rendering) while the other is being read (video output)
- **16-cycle idle/guard period** (HC 96-111):
  - State machine enters IDLE state (no sprite processing)
  - WHC counts through 496-511 during this period
  - Provides clean separation between rendering phase (write) and display phase (read)
  - Ensures all pending rendering operations have completed
  - At HC=111 (WHC=511): line_reset signal triggers, causing:
    - **Buffer swap** (instantaneous, single clock cycle)
    - State machine transition to START (ready for next scanline)
    - Vertical counter increment
- No memory contention—rendering and display truly happen in parallel
- Emulators typically use sequential rendering with a single buffer, which requires different timing management

**3. Wide Memory Architecture (40-bit Sprite Attributes)**
- Sprite attributes stored in **Simple Dual Port RAM** configured as **128 words × 40 bits**
- All 5 attribute bytes (40 bits) read **in parallel in a single access**
- **Asynchronous read port**: Combinatorial logic, zero-cycle latency (address → data available immediately)
- Synchronous write port: CPU/NextReg writes via clock_master_180° (phase-shifted for timing)
- This wide parallel access eliminates sequential byte fetching—critical for processing 128 sprites in ~480 cycles

**4. Fast Pattern Memory Access**
- Pattern memory implemented as **16KB SRAM/BRAM** with zero-delay output
- Synchronous access but data available same cycle (fast block RAM or registered output)
- Single-cycle pattern byte fetch at 28 MHz (CLK_28)
- Emulators must simulate this timing to maintain correct sprite rendering throughput

**5. Combinatorial Logic Pipeline**
- Visibility checks, coordinate calculations, and address generation are **pure combinatorial logic**
- Multi-cycle operations (QUALIFY, PROCESS) complete in 1-2 CLK_28 cycles minimum
- Hardware can evaluate sprite visibility and prepare rendering in the same clock where attributes are read
- Software emulation requires careful sequencing to replicate this parallelism

**6. State Machine at 28 MHz**
- Core sprite state machine runs at **CLK_28 (28 MHz)**, 4× faster than CLK_7 (7 MHz pixel clock)
- Allows processing multiple sub-operations per pixel clock
- Typical sprite processing: ~10-12 CLK_28 cycles per visible sprite
- With 480 CLK_28 cycles available per scanline, hardware can render ~40-48 sprites (though typically limited by practical sprite count)

**7. Sprite Overflow Handling (Max Sprites Per Line)**
- Hardware tracks whether sprite processing completes within the blanking interval
- **Overflow condition** triggered when:
  - State machine is not IDLE when line_reset occurs (new scanline begins)
  - A visible sprite is encountered but there's no time to render it (`spr_cur_notime = '1'`)
- Sets **bit 1 of sprite status register** (Port 0x303B)
- When overflow occurs, remaining sprites on that scanline are **skipped entirely**
- This is a hardware limitation—the state machine simply runs out of time
- Status bit is sticky (remains set until read by CPU, then auto-clears)

**8. Collision Detection**
- Hardware detects when **multiple sprites overlap at the same pixel**
- Collision logic: `collision = spr_line_data_o(8) AND spr_line_we`
  - Attempts to write a sprite pixel to a line buffer location that already has a valid sprite pixel (bit 8 set)
  - Only counts as collision if the write would proceed (respecting zero_on_top and transparency)
- Sets **bit 0 of sprite status register** (Port 0x303B)
- Status is **cumulative per frame**—any collision during the frame sets the bit
- Reading the status register returns current value and **auto-clears both bits**
- Does NOT prevent pixel rendering—the sprite with priority (based on zero_on_top setting) is displayed

These hardware characteristics enable the Next's sprite engine to process 128 sprites efficiently within horizontal blanking. Emulators must account for these architectural differences when implementing sprite rendering to maintain timing accuracy and visual fidelity.

---

## Architecture Overview

### Emulator Implementation Components

The emulator implements sprite rendering using a simplified architecture compared to the hardware, while maintaining timing accuracy and visual fidelity:

1. **Sprite Attribute Memory** (128 sprites × 5 attributes):
   - **Attr 0**: X position (bits 7:0)
   - **Attr 1**: Y position (bits 7:0)
   - **Attr 2**: Palette offset (7:4), X/Y mirror (3:2), Rotation (1), X MSB (0)
   - **Attr 3**: Visible flag (7), Relative sprite marker (6), Pattern index (5:0)
   - **Attr 4**: 4-bit pattern flag (7), Pattern bit 6 (6), X scale (5:4), Y scale (3:2), Y MSB (0)
   - Stored as standard byte arrays (5 bytes per sprite, 640 bytes total)

2. **Pattern Memory** (separate storage for 8-bit and 4-bit patterns):
   - **8-bit patterns**: 64 patterns × 8 transform variants × 256 bytes = 128KB
     - Each pattern: 16×16 pixels, 1 byte per pixel (full byte used)
     - Pattern index: 0-63 (6-bit from attr3[5:0])
   - **4-bit patterns**: 128 patterns × 8 transform variants × 256 bytes = 256KB
     - Each pattern: 16×16 pixels, 1 byte per pixel (only lower nibble used, upper nibble ignored)
     - Pattern index: 0-127 (7-bit from attr3[5:0] + attr4[6] as LSB)
   - **Total memory**: 384KB (acceptable for modern emulator)
   - **Advantage**: No nibble extraction during rendering - unified 256-byte access for both modes
   - Transform variants pre-computed for rotation/mirroring optimization
   - **Pattern upload**: When a byte is written to pattern memory (port 0x5B):
     - Write to 8-bit pattern memory (full byte)
     - Write to 4-bit pattern memory (lower nibble only, upper nibble can be discarded)
     - Pre-compute all 8 transformation variants for both pattern types simultaneously
     - This ensures sprites can switch between 4-bit and 8-bit modes using the same pattern data

3. **Single Line Buffer** (320×16-bit array):
   - Unlike hardware's dual buffers, emulator uses **sequential rendering with one buffer**
   - Buffer format: `Uint16Array[320]` where each entry contains:
     - Bit 8: Valid flag (sprite pixel present)
     - Bits 7-0: Palette index
   - Cleared and reused each scanline (no buffer swapping needed)

4. **Clock Timing and HC-Based Control Flags**:
   - Emulator operates at **CLK_7 (7 MHz)**, the pixel clock rate
   - Internally simulates **4 CLK_28 (28 MHz) activities per CLK_7 cycle**
   - Uses **per-HC flags** to control sprite processing phases:
     - **Render flags** (HC 432-455, HC 0-95): Process sprites, write to line buffer
     - **Swap flag** (HC 96-111): Idle period, no sprite processing (maintains hardware timing fidelity)
     - **Display flags** (HC 112-431): Read from line buffer, composite with other layers
   - These flags ensure correct timing alignment with hardware behavior

5. **State Machine** (emulator may simplify or adapt):
   - Reflects hardware's activity flow: IDLE → START → QUALIFY → PROCESS
   - Implementation may differ internally but maintains **same functional behavior**
   - Processes 128 sprites per scanline, determining visibility and rendering pixels
   - Executes within horizontal blanking to match hardware timing constraints

**Key Differences from Hardware**:
- **Single buffer** (sequential) vs. dual buffers (parallel) — simpler memory management
- **No physical buffer swap** — buffer cleared and reused each scanline
- **HC-driven control flow** — flags determine when to render vs. display
- **Software state machine** — may be optimized differently but preserves hardware timing semantics

---

## Coordinate System Mapping (VHDL Hardware vs. Emulator)

### VHDL Hardware Coordinates

The VHDL sprite hardware uses a **Wide Horizontal Counter (WHC)** that differs from the machine's main horizontal counter:

- **WHC Range**: 0-511 (9-bit counter)
- **WHC 0-319**: Sprite display area (320 visible pixels)
- **WHC 320-511**: Horizontal blanking (sprite rendering window)
- **WHC Reset**: Occurs at main HC = 96, resets WHC to -16 (496 unsigned)

### Emulator Coordinate Mapping

The emulator uses the main horizontal counter (HC 0-455). To map emulator coordinates to sprite coordinates:

**Formula**: `whc = (hc - 112) mod 512`

**Key Mapping Points**:
- **Emulator HC 112 → WHC 0** (first sprite pixel)
- **Emulator HC 431 → WHC 319** (last sprite pixel)
- **Emulator HC 432 → WHC 320** (sprite rendering begins)

**Emulator Timing Layout**:
```
HC:   112-431        432-455    0-95      96-111
      ├─────────────┼─────────┼─────────┼─────────┤
      │ DISPLAY     │ RENDER  │ RENDER  │  SWAP   │
      │ (320 px)    │ (24 c)  │ (96 c)  │ (16 c)  │
      └─────────────┴─────────┴─────────┴─────────┘
```

**Important for Emulator Implementation**: While the hardware uses double buffering with a 16-cycle guard period (HC 96-111, called "swap period" by the FPGA core), the emulator typically uses sequential rendering with a single buffer. During HC 96-111, the hardware state machine is IDLE with the actual buffer swap occurring in a single clock cycle at HC 111. For high-fidelity emulation, the emulator should **not perform sprite memory fetches or buffer modifications** during HC 96-111, as this would break timing accuracy and potentially cause visual artifacts that wouldn't occur on real hardware.

### Line Buffer Coordinates

- **Sprite X positions (0-319)** map directly to **line buffer indices (0-319)**
- **Line buffer index** = `hc - 112` during display (HC 112-431)
- **ULA overlap**: ULA uses line buffer indices 32-287 (middle 256 pixels)

**For Emulator Implementation**:
```typescript
// Convert emulator HC to sprite coordinate
const spriteCoord = (hc - 112) & 0x1FF; // WHC equivalent

// Line buffer access during display
if (hc >= 112 && hc <= 431) {
    const lineBufferIndex = hc - 112;
    const spritePixel = lineBuffer[lineBufferIndex];
}
```

---

## Sprite Rendering Window (Emulator Activities)

This section describes **all activities** that occur during the 120 CLK_7 cycle sprite rendering window in the emulator coordinate system.

### Timeline Overview

**Rendering for Scanline N+1** occurs across two scanline periods:

```
═══════════════════════════════════════════════════════════════════════════
SCANLINE N (VC = N)
═══════════════════════════════════════════════════════════════════════════

HC 432-455: Sprite Rendering Phase 1 (24 cycles)
  → Render sprites for scanline N+1 into line buffer

═══════════════════════════════════════════════════════════════════════════
SCANLINE N+1 (VC = N+1)
═══════════════════════════════════════════════════════════════════════════

HC 0-95: Sprite Rendering Phase 2 (96 cycles)
  → Continue rendering sprites for scanline N+1 into line buffer

HC 96-111: Buffer Swap Period (16 cycles)
  → Guard period: state machine IDLE, no activity
  → Actual buffer swap occurs in a single clock cycle at HC 111
  → (FPGA core calls this "swap period" but it's primarily a guard/synchronization period)

HC 112-431: Sprite Display Window (320 cycles)
  → Display sprites for scanline N+1 from line buffer
  → Compose with ULA/Layer 2/Tilemap layers

HC 432-455: Sprite Rendering Phase 1 (24 cycles)
  → Clear buffer, start rendering sprites for scanline N+2
```

### Detailed Activity Breakdown

#### Phase 1: HC 432-455 (Scanline N, 24 cycles)

**When**: End of scanline N  
**Goal**: Start rendering sprites for scanline N+1  
**Buffer State**: Empty or just cleared

**Activities** (at CLK_28 = 28 MHz, 4× faster than CLK_7):
1. **At HC 432** (first cycle):
   - Clear line buffer (set all 320 entries to 0 = transparent)
   - Initialize sprite state machine: state ← START
   - Set sprite index ← 0
   - Increment vertical line counter: spr_cur_vcount ← N+1

2. **HC 432-455** (24 CLK_7 cycles = 96 CLK_28 cycles):
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

#### Phase 2: HC 0-95 (Scanline N+1, 96 cycles)

**When**: Beginning of scanline N+1  
**Goal**: Complete rendering sprites for scanline N+1  
**Buffer State**: Partially filled from Phase 1

**Activities** (96 CLK_7 cycles = 384 CLK_28 cycles):
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
   - This Guard period for timing synchronization and buffer swap

**Purpose of this idle period**:
- **Ensures rendering completion**: Sprite processing should finish by HC 95
- **Clean phase separation**: Prevents overlap between write operations (rendering) and read operations (display)
- **Timing synchronization**: Allows hardware signals to stabilize before buffer swap
- State machine must be in IDLE state (no active sprite processing)

**Activities** (16 CLK_7 cycles = 64 CLK_28 cycles):
1. **At HC 96** (WHC reset):
   - WHC counter resets to -16 (496 unsigned)
   - State machine should be in IDLE state

2. **HC 96-111** (idle guard period):
   - **No sprite rendering** occurs during these 16 cycles
   - State machine remains IDLE
   - WHC counts from 496 to 511
   - Hardware waits for rendering phase to fully complete
   - **Emulator Note**: Single-buffer emulators should avoid sprite processing during this period to maintain timing fidelity

3. **At HC 111** (WHC = 511):
   - **line_reset signal triggers** (rising edge detected)
   - **Buffer swap occurs instantaneously** (single clock cycle):
     - In hardware: `line_buf_sel <= not line_buf_sel` (swap read/write buffers)
     - Vertical counter increments: `spr_cur_vcount <= vcounter_i + 1`
     - State machine transitions: IDLE → START
   - **Emulator**: Should ensure sprite buffer is finalizedvoid sprite processing during this period to maintain timing fidelity

3. **At HC 111** (WHC = 511):
   - In hardware: line_reset signal triggers
   - **Buffer swap occurs instantaneously** (single clock cycle operation)
   - **Emulator**: Finalize any pending sprite rendering before HC 112
   - Prepare for display at HC 112

#### Display Window: HC 112-431 (Scanline N+1, 320 cycles)

**When**: Scanline N+1, visible display area  
**Goal**: Read sprite data and compose with other layers

**Activities** (320 CLK_7 cycles):
1. **For each HC in [112, 431]**:
   - Calculate line buffer index: idx = HC - 112 (gives 0-319)
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
- **When**: HC 0-95 (if all sprites processed), HC 96-111 (swap period)
- **Activity**: Waiting for next scanline or ready for swap
- **Transition**: At HC 111 (WHC 511), line_reset triggers START

**START State**:
- **When**: At HC 432 (beginning of rendering)
- **Duration**: 1 CLK_28 cycle
- **Activity**: sprite_index ← 0, initialize counters
- **Transition**: Immediately to QUALIFY

**QUALIFY State**:
- **When**: During HC 432-455 and HC 0-95
- **Duration**: 1-2 CLK_28 cycles per sprite (minimum)
- **Activity**: Check sprite visibility and Y-match
- **Transition**: 
  - If visible: → PROCESS
  - If not visible: increment sprite_index → QUALIFY (next sprite)
  - If sprite_index wraps to 0: → IDLE (all done)

**PROCESS State**:
- **When**: During HC 432-455 and HC 0-95 (for visible sprites)
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
   // Skip sprites when not enough time remains before swap
   // Check triggers at HC 32-60 depending on sprite scaling
   if (notime_condition_met):
       skip sprite (set sprites_overtime flag)
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

**EMULATOR IMPLEMENTATION NOTES**:
- Use pre-transformed pattern variants from `SpriteDevice.patternMemory8bit[]` or `SpriteDevice.patternMemory4bit[]`
- All sprite dimensions (width, height) are pre-computed in `SpriteAttributes`
- Transformation variant index (0-7) is pre-computed in `attributes.transformVariant`
- Process 4 CLK_28 cycles per function call (batched for efficiency)

```typescript
═══════════════════════════════════════════════════════════════════════════
Setup Phase: STATE = PROCESS (entry from QUALIFY)
═══════════════════════════════════════════════════════════════════════════

// Emulator: Initialize state variables when entering PROCESSING phase
// These are calculated ONCE per sprite, then reused for all pixels

const sprite = this.spriteDevice.attributes[this.spritesIndex];

// 1. Calculate Y index within pattern (accounting for scale only)
//    This represents which row of the 16×16 pattern we're rendering
//    Note: Y-mirror is already applied in the pre-transformed pattern variant
const yOffset = this.spritesVc - sprite.y;        // Scanline offset within sprite
const yIndex = yOffset >> sprite.scaleY;          // Apply Y-scale: divide by 2^scaleY (0-15)

// 2. Get pre-transformed pattern variant (OPTIMIZATION: no transform during render)
//    Pattern variants are pre-computed when pattern data is written
//    
//    Separate storage for 8-bit and 4-bit patterns:
//    - 8-bit: patternMemory8bit[64 patterns × 8 variants] each 256 bytes
//    - 4-bit: patternMemory4bit[128 patterns × 8 variants] each 256 bytes (lower nibble only)
//    
//    Pattern index encoding:
//    - 8-bit sprites: attr3[5:0] only (0-63), attr4[6] must be 0
//    - 4-bit sprites: attr3[5:0] + attr4[6] as LSB (0-127)
//    - Pattern number format: N5 N4 N3 N2 N1 N0 N6 (where N6 is LSB)
//    
//    Transformation variant is 3-bit (0-7):
//    - bit 2: rotate, bit 1: mirrorX, bit 0: mirrorY
//    
//    Combined variant index = (patternIndex << 3) | transformVariant

const variantIndex = sprite.is4BitPattern 
  ? (((sprite.patternIndex << 1) | (sprite.attributeFlag2 ? 1 : 0)) << 3) | sprite.transformVariant
  : (sprite.patternIndex << 3) | sprite.transformVariant;

const patternData = sprite.is4BitPattern
  ? this.spriteDevice.patternMemory4bit[variantIndex]
  : this.spriteDevice.patternMemory8bit[variantIndex];

// 3. Initialize counters
this.spritesCurrentPixel = 0;                     // Pixel counter (0 to sprite.width-1)
this.spritesCurrentX = sprite.x;                  // Line buffer write position (9-bit, -256 to 511)

// 4. Cache values for render loop
this.spritesPatternData = patternData;            // Cache pattern pointer
this.spritesPatternYIndex = yIndex;               // Cache Y row index (0-15)

// Pre-computed from attributes (no calculation needed):
// - sprite.width: Total pixels to render (16, 32, 64, or 128)
// - sprite.scaleX: X-scale factor (0-3 for 1x, 2x, 4x, 8x)
// - sprite.is4BitPattern: Color mode flag
// - sprite.paletteOffset: Palette offset (0-15)

═══════════════════════════════════════════════════════════════════════════
Render Loop: Pixel Rendering (1 CLK_28 cycle per pixel)
═══════════════════════════════════════════════════════════════════════════

// Emulator: Process pixels in batches of 4 (4 CLK_28 cycles per CLK_7 call)
// Each iteration renders ONE pixel to the line buffer

for (let clk28 = 0; clk28 < 4; clk28++) {
  // Check completion first
  if (this.spritesCurrentPixel >= sprite.width) {
    // Sprite rendering complete - transition back to QUALIFYING
    this.spritesQualifying = true;
    this.spritesIndex++;
    break;
  }

  // 1. Calculate X index within pattern (0-15)
  //    Account for scaling: multiple output pixels map to same pattern pixel
  const xScaled = this.spritesCurrentPixel >> sprite.scaleX;  // Divide by 2^scaleX
  const xIndex = xScaled & 0x0f;                              // Modulo 16

  // 2. Fetch pixel from pre-transformed pattern (DIRECT LOOKUP - no transform!)
  //    Pattern is always indexed as [y][x] because transformation is pre-applied
  //    Both 8-bit and 4-bit patterns use 256-byte arrays (4-bit uses lower nibble only)
  const patternOffset = (this.spritesPatternYIndex << 4) | xIndex;
  let pixelValue = this.spritesPatternData[patternOffset];

  // 3. Extract pixel color value
  //    For 4-bit: only lower nibble is used (upper nibble ignored)
  //    For 8-bit: full byte is used
  if (sprite.is4BitPattern) {
    pixelValue = pixelValue & 0x0f;  // Use only lower nibble
  }

  // 4. Apply palette offset
  let paletteIndex: number;
  if (sprite.is4BitPattern) {
    // 4-bit mode: palette offset replaces upper 4 bits
    paletteIndex = (sprite.paletteOffset << 4) | pixelValue;
  } else {
    // 8-bit mode: add palette offset to upper 4 bits only
    const upper = ((pixelValue >> 4) + sprite.paletteOffset) & 0x0f;
    const lower = pixelValue & 0x0f;
    paletteIndex = (upper << 4) | lower;
  }

  // 5. Check transparency
  //    Compare against global transparency index (NextReg 0x4B, default 0xE3)
  const isTransparent = (pixelValue === this.spriteDevice.transparencyIndex);

  // 6. Check line buffer bounds
  //    Only write if X position is within visible display (0-319)
  //    Negative positions and positions >= 320 are clipped
  const bufferPos = this.spritesCurrentX;
  const inBounds = (bufferPos >= 0 && bufferPos < 320);

  // 7. Read existing line buffer value (for collision and zero-on-top)
  const existingValue = this.spritesBuffer[bufferPos];
  const existingValid = (existingValue & 0x100) !== 0;  // Bit 8 = valid flag

  // 8. Determine write enable
  let writeEnable = !isTransparent && inBounds;
  
  if (this.spriteDevice.sprite0OnTop && existingValid) {
    // Zero-on-top mode: don't overwrite existing valid pixels
    writeEnable = false;
  }

  // 9. Write to line buffer
  if (writeEnable) {
    // Set bit 8 (valid flag) and bits 7:0 (palette index)
    this.spritesBuffer[bufferPos] = 0x100 | paletteIndex;
    
    // 10. Collision detection
    //     Trigger when writing to a position that already has a valid pixel
    if (existingValid) {
      this.spriteDevice.collisionDetected = true;
    }
  }

  // 11. Advance to next pixel
  this.spritesCurrentPixel++;
  this.spritesCurrentX++;
  
  // Note: X position wraps naturally (9-bit arithmetic handles off-screen sprites)
}

// Each call to renderPixelClk28() processes one pixel (1 CLK_28 cycle)
// Typical sprite render loop calls this 16-128 times depending on sprite.width

═══════════════════════════════════════════════════════════════════════════
```

**EMULATOR OPTIMIZATION SUMMARY**:

1. **Pre-transformed Patterns** (eliminates rotation/mirror math):
   - Separate arrays for 8-bit and 4-bit patterns
   - 8-bit: 64 patterns × 8 variants = 512 arrays (128KB total)
   - 4-bit: 128 patterns × 8 variants = 1024 arrays (256KB total)
   - All patterns use 256-byte arrays (4-bit stores only lower nibble)
   - Pattern variants pre-computed during writes: `SpriteDevice.writeSpritePattern()`
   - Direct lookup: `patternData[(yIndex << 4) | xIndex]`

2. **4-bit vs 8-bit Sprite Handling**:
   - **8-bit sprites**: Full byte used for pixel color (0-255)
     - Pattern index: attr3[5:0] (0-63)
     - Palette offset added to upper 4 bits
     - Transparency index default: 0xE3 (full byte comparison)
   - **4-bit sprites**: Lower nibble only used for pixel color (0-15)
     - Pattern index: attr3[5:0] + attr4[6] as LSB (0-127)
     - Palette offset replaces upper 4 bits (selects one of 16 palettes)
     - Transparency index default: 0x3 (lower 4 bits comparison)
     - Upper nibble in pattern memory ignored during rendering

3. **Pre-computed Sprite Dimensions** (eliminates scaling calculations):
   - Width/height calculated during attribute writes: `SpriteDevice.updateSpriteDimensions()`
   - Simple loop: `for (pixel = 0; pixel < sprite.width; pixel++)`

4. **Pre-computed Transformation Variant** (eliminates bit extraction):
   - Variant index (0-7) cached in `attributes.transformVariant`
   - Combined with pattern index: `variantIndex = (patternIndex << 3) | sprite.transformVariant`

5. **Batched CLK_28 Cycles** (reduces function call overhead):
   - Process 4 pixels per call (4 CLK_28 cycles simulated)
   - Reduces JavaScript function call overhead by 75%

6. **Boolean Flags** (eliminates bit tests during rendering):
   - `sprite.visible`, `sprite.is4BitPattern`, `sprite.mirrorX/Y`, etc.
   - Pre-extracted during attribute writes, not during rendering

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
Scanline 99, HC 432:
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
// At HC 432 (scanline N)
if (hc === 432) {
  this.clearSpriteLineBuffer();  // Clear buffer for N+1
  this.renderSpritesForScanline(vc + 1);  // Start rendering N+1
}

// At HC 0-95 (scanline N+1)  
// Rendering continues automatically (same call)

// At HC 112-431 (scanline N+1)
if (hc >= 112 && hc <= 431) {
  const idx = hc - 112;
  const spritePixel = this.spriteLineBuffer[idx];
  // Compose with other layers
}
```

**Budget Management**:
- **Total**: 120 CLK_7 cycles = 480 CLK_28 cycles
- **Per-sprite overhead**: ~2 CLK_28 (QUALIFY + PROCESS setup)
- **Pattern fetch**: 16-128 CLK_28 (base sprite to 8× scaled)
- **Practical limit**: 10-30 visible sprites per scanline
- **Timeout**: If processing exceeds HC 95, skip remaining sprites

**Optimization Strategies**:
1. **Early termination**: Stop at sprite_index = 0 or when HC > 95
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
- Blanking window (for sprite rendering): Emulator HC 432–455 (24 clocks) + HC 0–95 (96 clocks) = **120 CLK_7 cycles**
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

Prevents starting sprite rendering when insufficient time remains before swap period:

```vhdl
spr_cur_notime_mask <= spr_cur_x_wrap(2 downto 0) & "00"
spr_cur_notime = 1 when
    hcounter_i[8] = 1 AND hcounter_i[5] = 1 AND
    (hcounter_i[4:0] AND notime_mask = notime_mask)
```

**How it works**:
- `hcounter_i` is the WHC (Wide Horizontal Counter, 0-511)
- Base condition: WHC bit 8=1 AND bit 5=1 → WHC ≥ 288
- Mask adds sprite-width-dependent threshold based on X-scaling
- `x_wrap` relates to sprite's scaled width (larger for scaled sprites)

**Trigger points during rendering (HC 0-95, WHC 400-495)**:
- **HC 32** (WHC 432): 8x scaled sprites (x_wrap=11000, mask=00000) - need 64 cycles, 64 remaining
- **HC 48** (WHC 448): 4x scaled sprites (x_wrap=11100, mask=10000) - need 32 cycles, 48 remaining
- **HC 56** (WHC 456): 2x scaled sprites (x_wrap=11110, mask=11000) - need 24 cycles, 40 remaining
- **HC 60** (WHC 460): 1x scaled sprites (x_wrap=11111, mask=11100) - need 18 cycles, 36 remaining

**Purpose**: 
- Prevents starting sprite rendering that won't complete before swap at HC 96
- Larger scaling triggers check earlier (need more CLK_28 cycles to render)
- Smaller scaling can start later (fewer cycles needed)
- Sets `sprites_overtime` flag when visible sprite is skipped due to time constraint
- This flag appears in **Port 0x303B bit 1** (Sprite Status Register)

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

HC 0-95: RENDER sprites for scanline 101 → Buffer B (WRITE)
  - Qualify sprites: which are visible on line 101?
  - Fetch patterns for visible sprites
  - Write pixels to Buffer B at positions 0-319

HC 96-111: SWAP PERIOD (16 cycles)
  - Guard period: state machine is IDLE (no activity)
  - No display yet (still in blanking)
  - Note: FPGA core calls this "swap period" but it's primarily a guard/synchronization period
  - At HC 111: SWAP BUFFERS (single clock cycle)
    → Buffer A becomes WRITE buffer
    → Buffer B becomes READ buffer

HC 112-431: DISPLAY sprites for scanline 100 ← Buffer B (READ)
  - Read Buffer B at positions 0-319
  - Compose with ULA/Layer 2/Tilemap
  - Output to screen at current VC (100)
  - Note: This is the PREVIOUS buffer, rendered during scanline 99

HC 432-455: Continue RENDER sprites for scanline 101 → Buffer A (WRITE)
  - Continue processing sprites that didn't fit in HC 0-95
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

HC 0-95: RENDER sprites for scanline 102 → Buffer A (WRITE)
  - Process sprites for next scanline (102)
  - Write pixels to Buffer A

HC 96-111: SWAP PERIOD (guard period)
  - At HC 111: SWAP BUFFERS (single clock cycle)
    → Buffer A becomes READ buffer
    → Buffer B becomes WRITE buffer

HC 112-431: DISPLAY sprites for scanline 101 ← Buffer A (READ)
  - Read Buffer A (rendered during scanline 100)
  - Compose and output to screen at VC 101

HC 432-455: Continue RENDER sprites for scanline 102 → Buffer B (WRITE)
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

HC 0-95: RENDER sprites for scanline 103 → Buffer B (WRITE)
HC 96-111: SWAP PERIOD → Buffers swap at HC 111
HC 112-431: DISPLAY sprites for scanline 102 ← Buffer A (READ)
HC 432-455: Continue RENDER sprites for scanline 103 → Buffer B (WRITE)

END: HC 455
  Buffer A: Contains sprites for scanline 102 (just displayed)
  Buffer B: Contains sprites for scanline 103 (READY for next line)
```

**Key Insights**:

1. **Temporal Offset**: Sprites displayed on scanline N were rendered during scanline N-1
2. **One Scanline Latency**: There's always a 1-scanline delay between rendering and display
3. **Zero Overlap**: Rendering window (HC 0-95, 432-455) and display window (HC 112-431) never overlap
4. **Swap at HC 111**: The 16-cycle period (HC 96-111) is a guard/synchronization zone where the state machine is IDLE; the actual buffer swap occurs in a single clock cycle at HC 111. (The FPGA core calls this the "swap period" though it's primarily a guard period.)
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
| **Sprite Display Area** | WHC 0–319 (320 pixels) | HC 112–431 (320 clocks) |
| **ULA Display Area** | WHC 32–287 (256 pixels) | HC 144–399 (256 clocks) |
| **Blanking Interval** | WHC 320–511 (136 machine cycles) | HC 432–455 + 0–95 (120 cycles) |
| **Sprite Rendering Window** | WHC 320–511 (136 cycles total) | HC 432–455, 0–95 (120 cycles) |
| **Buffer Swap Period** | WHC 496–511 (16 cycles at HC 96–111) | HC 96–111 (16 cycles, not used for rendering) |
| **Line Buffer Swap** | WHC = 511 | HC = 111 (WHC wraps to 0) |
| **Line Buffer Size** | 320 × 9-bit | 320 × 16-bit (Uint16Array) |
| **Sprite Coordinates** | 0–319 (WHC-relative) | 0–319 (line buffer indices) |
| **Clock Rate** | CLK_7 (7 MHz) | CLK_7 (7 MHz) |
| **State Machine Clock** | CLK_MASTER (28 MHz) | CLK_28 equivalent (28 MHz) |

**Conversion Formulas**:
```
// Emulator HC to WHC
whc = (hc - 112) mod 512

// WHC to Emulator HC  
hc = (whc + 112) mod 456

// Examples:
HC 112 → WHC 0   (first sprite pixel)
HC 431 → WHC 319 (last sprite pixel)
HC 432 → WHC 320 (sprite rendering begins)
```

**Key Timing Points** (Emulator HC with WHC mapping):
- **HC = 96**: WHC reset point (WHC wraps to -16/496)
- **HC = 111**: WHC = 511, buffer swap occurs
- **HC = 112** (WHC 0): First sprite display pixel, line buffer index 0
- **HC = 143** (WHC 31): Last left border pixel before ULA
- **HC = 144** (WHC 32): ULA display start (displayXStart, 0x90)
- **HC = 399** (WHC 287): ULA display end (displayXEnd, 0x18F)
- **HC = 400** (WHC 288): Right border begins
- **HC = 431** (WHC 319): Last sprite display pixel, line buffer index 319
- **HC = 432** (WHC 320): Sprite rendering window begins (blanking)
- **HC = 455** (WHC 343): End of scanline
- **HC = 0** (WHC 344): Wrap to next scanline, sprite rendering continues
- **HC = 95** (WHC 495): Last cycle before WHC reset

**Important Note**: WHC is a derived counter that runs continuously at CLK_7 rate, resetting when main HC = 96. The 512-cycle range provides a convenient 320-pixel display coordinate system for sprites, Layer 2, and tilemaps.

---

## Document History

- **December 2024**: Initial analysis from VHDL source code (Claude Sonnet 4.5)
- **January 2026**: Enhanced with emulator coordinate system mapping and integration guidance
- **January 2026**: Corrected HC-to-WHC mapping after discovering WHC is derived from main HC counter
