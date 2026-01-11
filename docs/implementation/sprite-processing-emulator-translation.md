# Sprite Processing: Hardware to Emulator Translation

## Overview

This document translates the ZX Spectrum Next hardware sprite processing concepts into TypeScript emulator implementations, focusing on the QUALIFY and PROCESS state machine phases with performance optimizations.

## Hardware vs Emulator Architecture

### Hardware Implementation

The ZX Spectrum Next hardware uses:
- **Simple Dual-Port RAM** with 128 × 40-bit organization (all 5 sprite attributes fetched in parallel)
- **Synchronous pattern memory** with zero-delay output
- **Combinatorial logic pipelines** for immediate coordinate calculations
- **28 MHz state machine** (CLK_28) running 4× faster than pixel clock
- **Hardware line buffer** with collision detection

### Emulator Implementation

The emulator uses:
- **JavaScript Arrays** for sprite attributes (128 elements)
- **TypeScript classes** with computed properties
- **Sequential execution** in software (no true parallel reads)
- **Tact-based simulation** (4 CLK_28 cycles per CLK_7 call)
- **Uint16Array line buffer** (320 pixels, 16-bit values)

## Key Translation Principles

### 1. Parallel Attribute Access → Pre-computed Properties

**Hardware**: All 5 attribute bytes fetched simultaneously as 40-bit word
```vhdl
-- Hardware: Single cycle parallel read
attr_word = attribute_ram[sprite_index]  -- All 40 bits at once
x_pos = attr_word[7:0] | (attr_word[32] << 8)
y_pos = attr_word[15:8] | (attr_word[39] << 8)
visible = attr_word[31]
```

**Emulator**: Attributes stored as pre-computed TypeScript object
```typescript
// Emulator: Pre-computed during attribute writes
interface SpriteAttributes {
  x: number;              // 9-bit X position (pre-merged from attr0 + attr2[0])
  y: number;              // 9-bit Y position (pre-merged from attr1 + attr4[0])
  visible: boolean;       // attr3[7] extracted as boolean
  width: number;          // Pre-calculated from scaleX + rotation
  height: number;         // Pre-calculated from scaleY + rotation
  transformVariant: number; // Pre-computed variant index (0-7)
  // ... other fields
}
```

**Optimization**: Calculate derived values during attribute writes, not during rendering.

### 2. Pattern Memory Transformation → Pre-transformed Pattern Variants

**Hardware**: Pattern memory with real-time coordinate transformation
```vhdl
-- Hardware: Dynamic coordinate transformation during fetch
if rotate = '1' then
  addr = (pattern_idx << 8) | (x_index << 4) | y_index
else
  addr = (pattern_idx << 8) | (y_index << 4) | x_index
end if
pixel = pattern_ram[addr]
```

**Emulator**: 8 pre-transformed variants per pattern
```typescript
// Emulator: Pre-compute all 8 transformation variants when pattern is written
patternMemoryVariants: Uint8Array[];  // 64 patterns × 8 variants = 512 arrays

// Variant index calculation (pre-computed in attributes.transformVariant)
// Variant = (rotate << 2) | (mirrorX << 1) | mirrorY
//
// During rendering: direct lookup, no transformation needed
const variantIndex = (patternIndex7bit << 3) | sprite.transformVariant;
const patternData = this.patternMemoryVariants[variantIndex];
const pixelValue = patternData[(rowInPattern << 4) | colInPattern];
```

**Optimization**: Trade memory (128KB for variants) for speed (eliminate transformation math during rendering).

### 3. Hardware Timing → Software Loop Structure

**Hardware**: State machine with 1-2 CLK_28 cycles per operation
```vhdl
-- Hardware: Sequential state machine
case state is
  when QUALIFY =>
    if visible and y_match then
      state <= PROCESS;
    else
      sprite_index <= sprite_index + 1;
      state <= QUALIFY;
    end if;
    
  when PROCESS =>
    -- Render pixels, 1 CLK_28 cycle per pixel
    for each pixel loop
      line_buffer(x_pos) <= pixel_value;
      x_pos <= x_pos + 1;
    end loop;
end case;
```

**Emulator**: Explicit phase tracking with budget management
```typescript
// Emulator: Explicit state and budget tracking
private renderSpritesPixel(vc: number, hc: number, cell: number): void {
  // Simulate 4 CLK_28 cycles per CLK_7 call
  const renderPixelClk28 = () => {
    if (this.spritesRenderingDone) return;
    
    if (this.spritesQualifying) {
      // QUALIFYING phase (1-2 CLK_28 cycles)
      const sprite = this.spriteDevice.attributes[this.spritesIndex];
      
      // Check visibility, Y-match, timing budget
      if (qualifies) {
        this.spritesQualifying = false; // Switch to PROCESSING
      } else {
        this.spritesIndex++;
      }
    } else {
      // PROCESSING phase (width × scale CLK_28 cycles)
      // Render one pixel per CLK_28 cycle
      this.renderSpritePixel();
    }
  };
  
  // Execute 4 CLK_28 cycles per CLK_7 call
  if (cell & SCR_SPRITE_RENDER) {
    renderPixelClk28();
    renderPixelClk28();
    renderPixelClk28();
    renderPixelClk28();
    this.spritesRemainingClk7Tacts--;
  }
}
```

**Optimization**: Batch CLK_28 cycles (4 per call) to reduce function call overhead.

## QUALIFY Phase Translation

### Hardware QUALIFY (1 CLK_28 cycle)

```vhdl
-- Cycle 0: Parallel attribute read and visibility check
attr_word = attribute_ram[sprite_index];  -- All 40 bits
visible = attr_word[31];
y_pos = attr_word[15:8] | (attr_word[39] << 8);
height = calculate_height(attr_word[25:24]);  -- Y-scale
y_offset = vcount - y_pos;
y_match = (y_offset >= 0) and (y_offset < height);
should_render = visible and y_match;

if should_render then
  state <= PROCESS;
else
  sprite_index <= sprite_index + 1;
  if sprite_index = 0 then  -- Wrapped
    state <= IDLE;
  end if;
end if;
```

### Emulator QUALIFY (1 function call ≈ 1 CLK_28 equivalent)

```typescript
// Emulator QUALIFYING phase
if (this.spritesQualifying) {
  // Check sprite index bounds (wrap detection)
  if (this.spritesIndex >= 128) {
    this.spritesRenderingDone = true;
    return;
  }
  
  // Fast attribute access (already parsed, no bit extraction needed)
  const sprite = this.spriteDevice.attributes[this.spritesIndex];
  
  // Visibility check #1: Global enable flag
  if (!sprite.visible) {
    this.spritesIndex++;
    return;
  }
  
  // Visibility check #2: Vertical intersection
  // (spriteY and height are pre-computed)
  const scanlineIntersects = 
    this.spritesVc >= sprite.y && 
    this.spritesVc < sprite.y + sprite.height;
  
  if (!scanlineIntersects) {
    this.spritesIndex++;
    return;
  }
  
  // Visibility check #3: Horizontal bounds
  const horizontallyVisible = 
    sprite.x < 320 && 
    sprite.x + sprite.width > 0;
  
  if (!horizontallyVisible) {
    this.spritesIndex++;
    return;
  }
  
  // Timing check: no_time condition
  const cyclesNeeded = sprite.width + 2;  // +2 for setup overhead
  if (this.spritesRemainingClk7Tacts * 4 < cyclesNeeded) {
    this.spritesOvertime = true;
    this.spritesRenderingDone = true;
    return;
  }
  
  // Sprite qualifies! Transition to PROCESSING
  this.spritesQualifying = false;
  this.spritesCurrentPixel = 0;  // Initialize pixel counter
  this.spritesCurrentX = sprite.x;  // Initialize line buffer position
}
```

**Key Optimizations**:
1. **Early exits** - Check simplest conditions first (visible flag)
2. **Pre-computed dimensions** - `sprite.height` and `sprite.width` already calculated
3. **No bit manipulation** - All fields extracted during attribute writes
4. **Sequential checks** - Stop as soon as any check fails

## PROCESS Phase Translation

### Hardware PROCESS (width × scale CLK_28 cycles)

```vhdl
-- Setup (Cycle 0)
y_index = calculate_y_index(y_offset, y_scale, y_mirror);
x_index = x_mirror_eff ? 15 : 0;
x_delta = x_mirror_eff ? -1 : 1;

if rotate = '0' then
  pattern_addr = (pattern_idx << 8) | (y_index << 4) | x_index;
  pattern_delta = x_delta;
else
  pattern_addr = (pattern_idx << 8) | (x_index << 4) | y_index;
  pattern_delta = x_delta * 16;
end if;

-- Render loop (Cycles 1-N)
for each pixel loop
  pixel_value = pattern_ram[pattern_addr];
  palette_index = apply_palette_offset(pixel_value, palette_offset);
  is_transparent = (pixel_value = transparent_color);
  
  if not is_transparent and in_bounds then
    if not (zero_on_top and line_buffer[x_pos][8]) then
      line_buffer[x_pos] = (1 << 8) | palette_index;
    end if;
  end if;
  
  pattern_addr = pattern_addr + pattern_delta;
  x_pos = x_pos + 1;
end loop;
```

### Emulator PROCESS (with pre-transformed patterns)

```typescript
// Emulator PROCESSING phase
if (!this.spritesQualifying) {
  const sprite = this.spriteDevice.attributes[this.spritesIndex];
  
  // Calculate Y index within pattern (accounting for scale and mirror)
  const yOffset = this.spritesVc - sprite.y;
  const yIndex = this.calculatePatternYIndex(yOffset, sprite);
  
  // Get pre-transformed pattern variant
  const pattern7bit = sprite.pattern7Bit;  // Pre-computed 7-bit pattern index
  const variantIndex = (pattern7bit << 3) | sprite.transformVariant;
  const patternData = this.spriteDevice.patternMemoryVariants[variantIndex];
  
  // Render pixels (one per CLK_28 cycle)
  for (let i = 0; i < 4; i++) {  // Process 4 pixels per CLK_7 cycle
    if (this.spritesCurrentPixel >= sprite.width) {
      // Sprite complete, back to QUALIFYING
      this.spritesQualifying = true;
      this.spritesIndex++;
      break;
    }
    
    // Calculate pattern column (accounting for scale)
    const xIndex = this.calculatePatternXIndex(this.spritesCurrentPixel, sprite);
    
    // Direct pattern lookup (no transformation needed!)
    const patternOffset = (yIndex << 4) | xIndex;
    let pixelValue = patternData[patternOffset];
    
    // Handle 4-bit patterns
    if (sprite.is4BitPattern) {
      const nibbleSelect = (this.spritesCurrentPixel >> sprite.scaleX) & 1;
      pixelValue = nibbleSelect ? (pixelValue >> 4) : (pixelValue & 0x0f);
    }
    
    // Apply palette offset
    const paletteIndex = this.applyPaletteOffset(
      pixelValue, 
      sprite.paletteOffset, 
      sprite.is4BitPattern
    );
    
    // Transparency check
    const isTransparent = (pixelValue === this.spriteDevice.transparencyIndex);
    
    // Bounds check
    const bufferPos = this.spritesCurrentX;
    const inBounds = bufferPos >= 0 && bufferPos < 320;
    
    if (!isTransparent && inBounds) {
      const existingValue = this.spritesBuffer[bufferPos];
      const existingValid = (existingValue & 0x100) !== 0;
      
      // Zero-on-top mode check
      let writeEnable = true;
      if (this.spriteDevice.sprite0OnTop && existingValid) {
        writeEnable = false;
      }
      
      if (writeEnable) {
        this.spritesBuffer[bufferPos] = 0x100 | paletteIndex;
        
        // Collision detection
        if (existingValid) {
          this.spriteDevice.collisionDetected = true;
        }
      }
    }
    
    this.spritesCurrentPixel++;
    this.spritesCurrentX++;
  }
}
```

**Key Optimizations**:

1. **Pre-transformed patterns**: No rotation/mirror math during rendering
   ```typescript
   // Direct lookup instead of:
   // if (rotate) addr = (pattern << 8) | (x << 4) | y;
   // else addr = (pattern << 8) | (y << 4) | x;
   const variantIndex = (pattern7bit << 3) | transformVariant;
   const pixelValue = patternData[(y << 4) | x];
   ```

2. **Pre-computed scaling dimensions**: `sprite.width` already accounts for scaling
   ```typescript
   // No need to calculate: width = 16 << sprite.scaleX;
   if (this.spritesCurrentPixel >= sprite.width)  // Pre-computed
   ```

3. **Batched pixel processing**: Process 4 pixels per call (4 CLK_28 cycles)
   ```typescript
   for (let i = 0; i < 4; i++) {  // 4 CLK_28 cycles simulated
     // Render pixel...
   }
   ```

4. **Boolean flags instead of bit tests**: No bit extraction during rendering
   ```typescript
   if (sprite.is4BitPattern)  // Pre-extracted boolean
   if (sprite.visible)        // Pre-extracted boolean
   ```

## Performance Optimization Summary

### Memory Tradeoffs

| Approach | Memory | Speed | Implementation |
|----------|--------|-------|----------------|
| On-demand transform | 16KB | Slow | Calculate rotation/mirror per pixel |
| Pre-transformed patterns | 128KB | Fast | SpriteDevice.patternMemoryVariants |
| Pre-computed attributes | ~8KB | Fast | SpriteAttributes computed fields |

**Chosen**: Pre-transformation (fast rendering, acceptable memory cost)

### Computational Optimizations

1. **Attribute writes do heavy lifting**:
   ```typescript
   // During attribute write (rare):
   attributes.width = baseSize << scaleX;
   attributes.transformVariant = (rotate << 2) | (mirrorX << 1) | mirrorY;
   
   // During rendering (frequent): just read
   if (pixel >= sprite.width) { done(); }
   ```

2. **Pattern writes generate all variants**:
   ```typescript
   // During pattern write (rare, 256 times per pattern):
   writeSpritePattern(value: number): void {
     // Write to all 8 variants immediately
     this.patternMemoryVariants[baseIdx][srcIdx] = value;
     this.patternMemoryVariants[baseIdx + 1][mirrorYIdx] = value;
     // ... all 8 variants
   }
   
   // During rendering (frequent): direct lookup
   const pixel = patternData[offset];  // No transformation needed
   ```

3. **Early exits in QUALIFYING**:
   ```typescript
   // Check cheapest conditions first
   if (!sprite.visible) return;           // 1 boolean check
   if (!verticalIntersect) return;        // 2 comparisons
   if (!horizontallyVisible) return;      // 2 comparisons
   if (noTime) return;                    // 1 comparison
   ```

4. **Line buffer bit packing**:
   ```typescript
   // Uint16Array with bit 8 as valid flag
   this.spritesBuffer[x] = 0x100 | paletteIndex;  // Write
   const valid = (this.spritesBuffer[x] & 0x100) !== 0;  // Test
   const palette = this.spritesBuffer[x] & 0xff;  // Extract
   ```

### Suggested Additional Optimizations

1. **Cache Y-index calculation per sprite**:
   ```typescript
   // Calculate once when entering PROCESSING
   this.currentSpriteYIndex = this.calculatePatternYIndex(yOffset, sprite);
   
   // Reuse for all pixels in row
   const patternOffset = (this.currentSpriteYIndex << 4) | xIndex;
   ```

2. **Loop unrolling for fixed scales**:
   ```typescript
   // Fast path for common case (no scaling)
   if (sprite.scaleX === 0 && sprite.scaleY === 0) {
     // Render 16 pixels with no scale calculations
     for (let x = 0; x < 16; x++) {
       const pixel = patternData[(yIndex << 4) | x];
       // ... direct write
     }
   }
   ```

3. **Transparency bitmask pre-computation**:
   ```typescript
   // Pre-compute which pixels are transparent
   private patternTransparencyMask: Uint16Array[];  // 16 bits per row
   
   // Check transparency with single bit test
   const transparent = (transparencyMask[yIndex] & (1 << xIndex)) !== 0;
   ```

4. **SIMD-style batch operations** (for modern browsers):
   ```typescript
   // Process multiple pixels using TypedArray operations
   // (Pseudo-code, actual SIMD.js support varies)
   const chunk = new Uint32x4(pattern[0], pattern[1], pattern[2], pattern[3]);
   const masked = SIMD.Uint32x4.and(chunk, transparencyMask);
   ```

## Timing Accuracy

### CLK_7 to CLK_28 Conversion

Each CLK_7 cycle (7 MHz pixel clock) represents 4 CLK_28 cycles (28 MHz state machine).

```typescript
// Per scanline budget
const CLK_7_TACTS_PER_LINE = 120;  // Rendering window
const CLK_28_CYCLES_PER_LINE = 480;  // 120 × 4

// Track remaining budget
this.spritesRemainingClk7Tacts = 120;

// Deduct one CLK_7 per render call
if (cell & SCR_SPRITE_RENDER) {
  renderPixelClk28();  // 1st CLK_28
  renderPixelClk28();  // 2nd CLK_28
  renderPixelClk28();  // 3rd CLK_28
  renderPixelClk28();  // 4th CLK_28
  this.spritesRemainingClk7Tacts--;
}
```

### Sprite Processing Budget

| Sprite Configuration | CLK_28 Cycles | Max per Scanline |
|---------------------|---------------|------------------|
| 16×16, 1× scale | ~18 | ~26 sprites |
| 16×16, 2× X-scale | ~34 | ~14 sprites |
| 16×16, 4× scale | ~66 | ~7 sprites |
| 16×16, 8× scale | ~130 | ~3 sprites |

**Emulator must track**: When 480 CLK_28 cycles exhausted, set `spritesOvertime` flag.

## Implementation Checklist

- [x] Pre-compute sprite dimensions (width/height) during attribute writes
- [x] Pre-compute transformation variant index (0-7)
- [x] Pre-generate all 8 pattern transformation variants
- [x] Implement QUALIFYING phase with early exits
- [ ] Implement PROCESSING phase with direct pattern lookup
- [ ] Implement CLK_28 cycle budget tracking (480 per scanline)
- [ ] Implement no_time condition and spritesOvertime flag
- [ ] Implement zero_on_top priority mode
- [ ] Implement collision detection
- [ ] Implement sprite clipping window
- [ ] Implement relative sprite positioning
- [ ] Cache Y-index calculation per sprite (optimization)
- [ ] Add fast path for non-scaled sprites (optimization)

## References

- [sprites.md](../screen/sprites.md) - Hardware specification
- [SpriteDevice.ts](../../src/emu/machines/zxNext/SpriteDevice.ts) - Attribute management
- [NextComposedScreenDevice.ts](../../src/emu/machines/zxNext/screen/NextComposedScreenDevice.ts) - Rendering pipeline
