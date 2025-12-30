# Tilemap Rendering Implementation Plan

**Status**: Planning Phase  
**Created**: December 30, 2024  
**Target Component**: `NextComposedScreenDevice.ts` - Tilemap Layer

## Overview

This document outlines the implementation plan for the Tilemap rendering layer in the ZX Spectrum Next emulator. The implementation will follow the proven patterns established in the ULA, LoRes, and Layer 2 implementations, adapting them to the Tilemap's unique requirements.

## Reference Implementations Analysis

### 1. ULA Pattern Analysis

**Key Characteristics:**
- **Memory Access**: Fixed schedule based on HC subcycle positions (0xF, 0x0, 0x1, 0x2, etc.)
- **Scroll Sampling**: Occurs at specific HC positions (0x3 and 0xB falling edge CLK_7)
- **Shift Register**: Loads at HC 0xC and 0x4, continuous shifting for pixel output
- **Address Calculation**: Uses lookup tables (`ulaPixelLineBaseAddr`, `ulaAttrLineBaseAddr`)
- **Palette Lookup**: Immediate after pixel index generation (parallel to pixel generation)
- **Multiple Modes**: Standard, HiRes, HiColor - each with dedicated render method

**Key Methods:**
- `renderULAStandardPixel()`: Lines 1215-1365
- `renderULAHiResPixel()`: Lines 1390-1534
- `renderULAHiColorPixel()`: Lines 1559-1704
- `sampleNextRegistersForUlaMode()`: Lines 1708-1722

**Performance Optimizations:**
- Pre-computed attribute decode tables (`attrToInkFlashOff`, `attrToPaperFlashOff`, etc.)
- Cached scroll values sampled at specific HC positions
- Separate state variables for shift register operation

### 2. LoRes Pattern Analysis

**Key Characteristics:**
- **Memory Access**: Shares VRAM with ULA (same memory space)
- **Block-Based**: 2×2 pixel blocks, each byte represents 4 pixels
- **Coordinate System**: Display coordinates (loResDisplayHC, loResDisplayVC) separate from hardware counters
- **Scroll Application**: Both X and Y scrolling with wraparound
- **Fast Path Optimization**: None (simpler mode doesn't need it)

**Key Methods:**
- `renderLoResPixel()`: Lines 1774-1885
- Block address calculation inline
- Direct palette lookup (no intermediate buffers)

**Simplifications:**
- No shift register needed (direct block fetch)
- Simpler clipping (same as ULA)
- Transparent pixel detection after palette lookup

### 3. Layer 2 Pattern Analysis

**Key Characteristics:**
- **Multiple Resolution Modes**: 256×192, 320×256, 640×256 - each with dedicated method
- **Fast Path Optimization**: Pre-calculated scanline state for common cases
- **Coordinate Transformation**: Mode-specific coordinate mapping (phc/whc, pvc/wvc)
- **SRAM Access**: External memory via `getLayer2PixelFromSRAM_Cached()`
- **Priority Bit**: Extracted from palette entry for composition
- **Scanline State**: Pre-computed per scanline (`prepareScanlineState192()`, etc.)

**Key Methods:**
- `renderLayer2_256x192Pixel()`: Lines 1941-1993
- `renderLayer2_256x192Pixel_FastPath()`: Lines 2068-2095
- `renderLayer2_320x256Pixel()`: Lines 2104-2163
- `renderLayer2_320x256Pixel_FastPath()`: Lines 2204-2232
- `renderLayer2_640x256Pixel()`: Lines 2275-2358
- `renderLayer2_640x256Pixel_FastPath()`: Lines 2365-2416

**Performance Features:**
- Cache last accessed bank/offset (`layer2LastOffset`, `layer2LastBank16K`)
- Scanline state preparation flags (`layer2R320x256CanUseFastPath`, etc.)
- Fast path methods for common rendering scenarios

## Tilemap-Specific Requirements

Based on the `screen_rendering.md` documentation (Section 1.8), the Tilemap layer has these unique characteristics:

### Memory Organization

1. **Two Memory Regions**:
   - **Tilemap Data**: Array of tile entries (1 or 2 bytes each)
   - **Tile Definitions**: Pixel patterns for each tile (8 or 32 bytes per tile)

2. **VRAM Banks**: Uses banks 5 or 7 (configurable via NextReg 0x6E/0x6F)

3. **Base Address Calculation**:
   ```
   Full Address = (base[5:0] + addr[13:8]) & 0x3F concatenated with addr[7:0]
   ```

### Resolution Modes

1. **40×32 Mode**: 320 pixels wide × 256 pixels high
2. **80×32 Mode**: 640 pixels wide × 256 pixels high

### Tile System

1. **Tile Size**: 8×8 pixels (fixed)
2. **Tile Index**: 8 bits (0-255) or 9 bits (0-511) in 512-tile mode
3. **Tile Attributes** (when not eliminated):
   - Bits 7:4: Palette offset (0-15)
   - Bit 3: X mirror
   - Bit 2: Y mirror
   - Bit 1: Rotation (90°)
   - Bit 0: Priority or tile index bit 8

### Rendering Modes

1. **Standard Graphics Mode**: 4 bits per pixel (16 colors per palette offset)
2. **Text Mode**: 1 bit per pixel (monochrome bitmap)
3. **Attribute-Eliminated Mode**: Uses default attributes from NextReg 0x6C

### Tile Transformations

- **X Mirror**: Horizontal flip within tile
- **Y Mirror**: Vertical flip within tile
- **Rotation**: 90° clockwise rotation
- **Combined**: All three can be applied simultaneously

### Memory Access Pattern

Tilemap uses **rendering flags** (similar to ULA) to indicate which activities should occur at each (VC, HC) position:

**Tilemap Rendering Flags** (new flags to be defined):
- `SCR_TILE_INDEX_FETCH`: Fetch tile index byte from tilemap data
- `SCR_TILE_ATTR_FETCH`: Fetch tile attribute byte (or use default)
- `SCR_TILE_PATTERN_FETCH`: Fetch tile pattern data for current tile row
- `SCR_TILE_BUFFER_ADVANCE`: Advance to next pixel in tile buffer

These flags are set based on HC subcycle position and tile boundaries. Fetch activities trigger when `hcount_eff[2:0] = "000"` (every 8 pixels at tile boundaries).

## Implementation Strategy

### Phase 1: Core Infrastructure

**Objective**: Set up data structures and helper methods without implementing rendering logic.

#### Task 1.1: Add State Variables ✅ COMPLETE

**Implementation**: Added 18 new private state variables to `NextComposedScreenDevice` class (lines 2497-2522):
- 7 sampled configuration flags (`tilemapEnabledSampled`, etc.)
- 2 current tile state variables (`tilemapCurrentTileIndex`, `tilemapCurrentAttr`)
- 5 tile transformation flags (`tilemapTileXMirror`, etc.)
- 2 pixel buffer variables (`tilemapPixelBuffer`, `tilemapBufferPosition`)
- 2 fast path optimization variables (`tilemapCanUseFastPath`, `tilemapLastTileDefAddr`)

**Initialization**: All variables initialized in `reset()` method (lines 176-210)

**Status**: ✅ Code compiles without errors, warnings expected (variables not yet used)

#### Task 1.2: Add Helper Methods - VRAM Access

```typescript
/**
 * Get tilemap data byte from VRAM (bank 5 or 7).
 * @param useBank7 - true for bank 7, false for bank 5
 * @param offset - 6-bit offset within bank (multiplied by 256)
 * @param address - 14-bit address within the region
 * @returns Byte value from VRAM
 */
private getTilemapVRAM(useBank7: boolean, offset: number, address: number): number {
  // Address calculation: (offset[5:0] + address[13:8]) & 0x3F concatenated with address[7:0]
  const highByte = ((offset & 0x3F) + ((address >> 8) & 0x3F)) & 0x3F;
  const fullAddress = (highByte << 8) | (address & 0xFF);
  
  // Bank selection
  const bankNumber = useBank7 ? 7 : 5;
  
  // Access machine memory (VRAM is in specific banks)
  return this.machine.readMemory((bankNumber << 13) | fullAddress);
}
```

**Risk**: Low - isolated helper method  
**Test**: Unit test with known VRAM values

#### Task 1.3: Add Helper Methods - Coordinate Transformation

```typescript
/**
 * Apply scrolling to get absolute tilemap coordinates.
 * @param vc - Vertical counter
 * @param hc - Horizontal counter  
 * @param scrollX - X scroll amount (10 bits)
 * @param scrollY - Y scroll amount (8 bits)
 * @param mode80x32 - true for 80×32 mode, false for 40×32 mode
 * @returns Absolute X and Y coordinates with wrapping applied
 */
private getTilemapAbsoluteCoordinates(
  vc: number, 
  hc: number, 
  scrollX: number, 
  scrollY: number,
  mode80x32: boolean
): { absX: number; absY: number } {
  // Map counter to pixel coordinates (within display area)
  // For 40×32: 320 pixels wide (HC-based mapping)
  // For 80×32: 640 pixels wide (HC-based mapping, doubled)
  const pixelX = /* Calculate from HC based on timing config and mode */;
  const pixelY = /* Calculate from VC based on timing config */;
  
  // Apply scroll with wrapping
  const maxX = mode80x32 ? 640 : 320;
  const absX = (pixelX + scrollX) % maxX;
  const absY = (pixelY + scrollY) % 256;
  
  return { absX, absY };
}

/**
 * Calculate tile map address for given absolute coordinates.
 * @param absX - Absolute X coordinate (0-319 or 0-639)
 * @param absY - Absolute Y coordinate (0-255)
 * @param mode80x32 - true for 80×32 mode
 * @param attrEliminated - true if attributes are eliminated
 * @returns Tile map addresses for index and attribute bytes
 */
private getTilemapAddresses(
  absX: number,
  absY: number,
  mode80x32: boolean,
  attrEliminated: boolean
): { tileIndexAddr: number; tileAttrAddr: number } {
  const tileWidth = mode80x32 ? 80 : 40;
  const bytesPerTile = attrEliminated ? 1 : 2;
  
  const tileX = Math.floor(absX / 8);
  const tileY = Math.floor(absY / 8);
  const tileArrayIndex = tileY * tileWidth + tileX;
  
  const tileIndexAddr = tileArrayIndex * bytesPerTile;
  const tileAttrAddr = attrEliminated ? -1 : tileIndexAddr + 1;
  
  return { tileIndexAddr, tileAttrAddr };
}

/**
 * Apply tile transformations (mirror/rotate) to pixel coordinates within tile.
 * @param xInTile - X coordinate within tile (0-7)
 * @param yInTile - Y coordinate within tile (0-7)
 * @param xMirror - Horizontal flip flag
 * @param yMirror - Vertical flip flag
 * @param rotate - Rotation flag
 * @returns Transformed coordinates
 */
private applyTileTransformation(
  xInTile: number,
  yInTile: number,
  xMirror: boolean,
  yMirror: boolean,
  rotate: boolean
): { transformedX: number; transformedY: number } {
  // Apply transformations per VHDL specification
  let effectiveX = xInTile;
  let effectiveY = yInTile;
  
  // Step 1: Rotation XOR X-Mirror determines effective X mirror
  const effectiveXMirror = xMirror !== rotate;  // XOR operation
  
  // Step 2: Apply X Mirror
  if (effectiveXMirror) {
    effectiveX = 7 - effectiveX;
  }
  
  // Step 3: Apply Y Mirror
  if (yMirror) {
    effectiveY = 7 - effectiveY;
  }
  
  // Step 4: Apply Rotation (swap coordinates)
  const transformedX = rotate ? effectiveY : effectiveX;
  const transformedY = rotate ? effectiveX : effectiveY;
  
  return { transformedX, transformedY };
}
```

**Risk**: Low - pure computation methods  
**Test**: Unit tests for various scroll/transformation scenarios

#### Task 1.4: Define Tilemap Rendering Flags ✅ COMPLETE

**Implementation**: Created tilemap flag aliases using existing 8-bit flag values (lines 2578-2586):
- `SCR_TILE_INDEX_FETCH = 0b00001000` (bit 3, alias to `SCR_BYTE1_READ`)
- `SCR_TILE_ATTR_FETCH = 0b00010000` (bit 4, alias to `SCR_BYTE2_READ`)
- `SCR_PATTERN_FETCH = 0b00010000` (bit 4, alias to `SCR_BYTE2_READ`) - reused for tile pattern fetch
- `SCR_TILE_BUFFER_ADVANCE = 0b00100000` (bit 5, alias to `SCR_SHIFT_REG_LOAD`)

**Rationale**: Reusing existing bit positions as aliases avoids expanding beyond Uint8Array capacity (8 bits). Different rendering layers (ULA, LoRes, Tilemap) use the same flag bits for analogous operations at their respective timing positions.

**Status**: ✅ Code compiles, flags ready for use in rendering matrix generation

#### Task 1.5: Implement Rendering Flags Generation Functions ✅ COMPLETE

**Implementation**: Created two rendering flags generation functions (lines 3400-3548):
- `generateTilemap40x32RenderingFlags(config: TimingConfig): Uint8Array`
- `generateTilemap80x32RenderingFlags(config: TimingConfig): Uint8Array`

**Key Features**:
- Returns `Uint8Array` with flags for each (VC, HC) position
- Follows the pattern established by `generateULAStandardRenderingFlags()`
- Uses nested helper functions for individual cell generation
- Sets flags based on pixel position within tile:
  - **40×32 mode**: Fetch tile index at pixelInTile=0, attribute at pixelInTile=1, pattern at pixelInTile=2
  - **80×32 mode**: Each HC generates 2 pixels, so fetch positions are at pixelInTile=0,2,4
- Sets `SCR_TILE_BUFFER_ADVANCE` for all display area pixels
- Called from `initializeAllRenderingFlags()` for both 50Hz and 60Hz timing modes

**Type Corrections**: Fixed variable declarations to use `Uint8Array` instead of `Uint16Array`:
- Module variables: `renderingFlagsTilemap_40x32_50Hz/60Hz`, `renderingFlagsTilemap_80x32_50Hz/60Hz`
- Active cache variables: `activeRenderingFlagsTilemap_40x32`, `activeRenderingFlagsTilemap_80x32`

**Status**: ✅ Code compiles successfully, functions integrated into initialization system

**Exit Criteria for Phase 1**:
- ✅ **DONE** - State variables added and initialized
- ⏳ **IN PROGRESS** - Helper methods (VRAM access, coordinate transformation, tile transformation)
- ✅ **DONE** - Tilemap flag constants defined (as aliases)
- ✅ **DONE** - Rendering flags generation functions (40×32 and 80×32)
- ⏳ **PENDING** - Unit tests for coordinate transformation
- ⏳ **PENDING** - Unit tests for tile transformation
- ⏳ **PENDING** - Rendering flags tables verified
- ✅ **VERIFIED** - No regressions in existing layers

### Phase 2: Basic 40×32 Graphics Mode

**Objective**: Implement simplest tilemap mode (40×32, standard graphics, no transformations).

#### Task 2.1: Implement Tile Fetch Based on Flags

```typescript
/**
 * Fetch tile data for current position.
 * Called when rendering flags indicate tile fetch is needed.
 * This is triggered by SCR_TILE_INDEX_FETCH and SCR_TILE_ATTR_FETCH flags.
 */
private fetchTilemapTile(
  absX: number,
  absY: number,
  mode80x32: boolean,
  attrEliminated: boolean
): void {
  // Get tile addresses
  const { tileIndexAddr, tileAttrAddr } = this.getTilemapAddresses(
    absX, absY, mode80x32, attrEliminated
  );
  
  // Fetch tile index
  this.tilemapCurrentTileIndex = this.getTilemapVRAM(
    this.tilemapUseBank7,
    this.tilemapBank5Msb,
    tileIndexAddr
  );
  
  // Handle 512-tile mode
  let tileIndexBit8 = 0;
  if (this.tilemap512TileModeSampled && !attrEliminated) {
    // Fetch attribute byte
    this.tilemapCurrentAttr = this.getTilemapVRAM(
      this.tilemapUseBank7,
      this.tilemapBank5Msb,
      tileAttrAddr
    );
    tileIndexBit8 = this.tilemapCurrentAttr & 0x01;
    this.tilemapCurrentTileIndex |= (tileIndexBit8 << 8);
  } else if (!attrEliminated) {
    // Fetch attribute byte normally
    this.tilemapCurrentAttr = this.getTilemapVRAM(
      this.tilemapUseBank7,
      this.tilemapBank5Msb,
      tileAttrAddr
    );
  } else {
    // Use default attributes
    this.tilemapCurrentAttr = /* Get from NextReg 0x6C */;
  }
  
  // Extract transformation flags
  this.tilemapTilePaletteOffset = (this.tilemapCurrentAttr >> 4) & 0x0F;
  this.tilemapTileXMirror = (this.tilemapCurrentAttr & 0x08) !== 0;
  this.tilemapTileYMirror = (this.tilemapCurrentAttr & 0x04) !== 0;
  this.tilemapTileRotate = (this.tilemapCurrentAttr & 0x02) !== 0;
  this.tilemapTilePriority = this.tilemap512TileModeSampled 
    ? false 
    : (this.tilemapCurrentAttr & 0x01) !== 0;
}
```

#### Task 2.2: Implement Tile Pattern Fetch

```typescript
/**
 * Fetch tile pattern pixels and populate buffer.
 * Called when SCR_TILE_PATTERN_FETCH flag is set.
 * Tile index and attributes must have been fetched previously.
 */
private fetchTilemapPattern(
  absX: number,
  absY: number,
  textMode: boolean
): void {
  const xInTile = absX & 0x07;
  const yInTile = absY & 0x07;
  
  // Apply transformations
  const { transformedX, transformedY } = this.applyTileTransformation(
    xInTile, yInTile,
    this.tilemapTileXMirror,
    this.tilemapTileYMirror,
    this.tilemapTileRotate
  );
  
  if (textMode) {
    // Text mode: 8 bytes per tile, 1 bit per pixel
    const patternAddr = this.tilemapCurrentTileIndex * 8 + transformedY;
    const patternByte = this.getTilemapVRAM(
      this.tilemapTileDefUseBank7,
      this.tilemapTileDefBank5Msb,
      patternAddr
    );
    
    // Extract 8 pixels (1 bit each)
    for (let i = 0; i < 8; i++) {
      const bitPos = 7 - i;
      this.tilemapPixelBuffer[i] = (patternByte >> bitPos) & 0x01;
    }
  } else {
    // Standard graphics mode: 32 bytes per tile, 4 bits per pixel
    const patternBaseAddr = this.tilemapCurrentTileIndex * 32 + transformedY * 4;
    
    // Fetch 4 bytes (8 pixels, 2 pixels per byte)
    for (let byteIndex = 0; byteIndex < 4; byteIndex++) {
      const patternByte = this.getTilemapVRAM(
        this.tilemapTileDefUseBank7,
        this.tilemapTileDefBank5Msb,
        patternBaseAddr + byteIndex
      );
      
      // Extract 2 pixels (4 bits each)
      this.tilemapPixelBuffer[byteIndex * 2] = (patternByte >> 4) & 0x0F;
      this.tilemapPixelBuffer[byteIndex * 2 + 1] = patternByte & 0x0F;
    }
  }
  
  // Reset buffer position
  this.tilemapBufferPosition = 0;
}
```

#### Task 2.3: Implement Pixel Rendering (No Scrolling)

```typescript
/**
 * Render Tilemap 40×32 mode pixel (Stage 1).
 * @param vc - Vertical counter position
 * @param hc - Horizontal counter position
 * @param cell - Rendering cell with activity flags
 */
private renderTilemap_40x32Pixel(vc: number, hc: number, cell: number): void {
  // Check if tilemap is enabled
  if (!this.tilemapEnabledSampled) {
    this.tilemapPixel1Rgb333 = this.tilemapPixel2Rgb333 = null;
    this.tilemapPixel1Transparent = this.tilemapPixel2Transparent = true;
    return;
  }
  
  // Check if we're in display area
  if ((cell & SCR_DISPLAY_AREA) === 0) {
    this.tilemapPixel1Rgb333 = this.tilemapPixel2Rgb333 = null;
    this.tilemapPixel1Transparent = this.tilemapPixel2Transparent = true;
    return;
  }
  
  // Get absolute coordinates (no scrolling for initial implementation)
  const absX = /* Calculate from HC */;
  const absY = /* Calculate from VC */;
  
  // Fetch tile index if flag set (at tile boundary)
  if ((cell & SCR_TILE_INDEX_FETCH) !== 0) {
    this.fetchTilemapTileIndex(absX, absY, false, this.tilemapEliminateAttrSampled);
  }
  
  // Fetch tile attributes if flag set (after index)
  if ((cell & SCR_TILE_ATTR_FETCH) !== 0) {
    this.fetchTilemapTileAttributes(absX, absY);
  }
  
  // Fetch pattern data if flag set (after attributes known)
  if ((cell & SCR_TILE_PATTERN_FETCH) !== 0) {
    this.fetchTilemapPattern(absX, absY, this.tilemapTextModeSampled);
  }
  
  // Generate two pixels for this HC position (CLK_14 rate)
  for (let pixelIndex = 0; pixelIndex < 2; pixelIndex++) {
    // Get pixel index from buffer
    const pixelValue = this.tilemapPixelBuffer[this.tilemapBufferPosition++];
    
    // Generate palette index
    let paletteIndex: number;
    if (this.tilemapTextModeSampled) {
      // Text mode: 7 bits from attribute + 1 bit from pattern
      paletteIndex = ((this.tilemapCurrentAttr >> 1) << 1) | pixelValue;
    } else {
      // Graphics mode: 4 bits palette offset + 4 bits pixel value
      paletteIndex = (this.tilemapTilePaletteOffset << 4) | pixelValue;
    }
    
    // Palette lookup (use Tilemap palette bank)
    const paletteAddr = 0x200 | (this.tilemapPaletteBank << 8) | paletteIndex;
    const rgb333 = this.machine.paletteMemory[paletteAddr];
    
    // Check transparency
    const transparent = this.tilemapTextModeSampled
      ? ((rgb333 & 0x1FE) === (this.globalTransparencyColor << 1))
      : ((pixelValue & 0x0F) === (this.tilemapTransparencyIndex & 0x0F));
    
    // Check clipping
    const clipped = /* Check against clip window */;
    
    // Store results
    if (pixelIndex === 0) {
      this.tilemapPixel1Rgb333 = rgb333 & 0x1FF;
      this.tilemapPixel1Transparent = transparent || clipped;
    } else {
      this.tilemapPixel2Rgb333 = rgb333 & 0x1FF;
      this.tilemapPixel2Transparent = transparent || clipped;
    }
  }
}
```

**Risk**: Medium - first complete rendering implementation  
**Test**: Display static tilemap without scrolling or transformations

#### Task 2.4: Add Scrolling Support

Update `renderTilemap_40x32Pixel()` to use scrolled coordinates:

```typescript
// Sample scroll registers at frame start (similar to ULA)
if (vc === 0 && hc === 0) {
  this.tilemapScrollXSampled = this.tilemapScrollX;
  this.tilemapScrollYSampled = this.tilemapScrollY;
}

// Get scrolled absolute coordinates
const { absX, absY } = this.getTilemapAbsoluteCoordinates(
  vc, hc, 
  this.tilemapScrollXSampled, 
  this.tilemapScrollYSampled,
  false  // 40×32 mode
);
```

**Risk**: Medium - affects coordinate calculation  
**Test**: Verify smooth scrolling in all directions

#### Task 2.5: Integration Testing

- Test tilemap rendering alone (ULA disabled)
- Test with ULA (verify priority modes)
- Test transparency
- Test clipping
- Test with Layer 2 and Sprites

**Exit Criteria for Phase 2**:
- ✅ 40×32 mode renders correctly
- ✅ Scrolling works with proper wraparound
- ✅ Clipping works correctly
- ✅ Transparency works
- ✅ Priority system integrates properly
- ✅ No regressions in other layers

### Phase 3: Tile Transformations

**Objective**: Add support for X/Y mirror and rotation.

#### Task 3.1: Enable Transformations in fetchTilemapPattern()

The transformation logic is already in `applyTileTransformation()`, but needs testing:

- Test X mirror only
- Test Y mirror only
- Test rotation only
- Test all combinations

#### Task 3.2: Verify Transformation Matrix

Create test cases for all 8 transformation combinations:
- No transform
- X mirror only
- Y mirror only  
- X+Y mirror
- Rotation only
- Rotation + X mirror
- Rotation + Y mirror
- Rotation + X+Y mirror

**Risk**: Low - logic already implemented, needs testing  
**Test**: Visual verification of all transformation combinations

**Exit Criteria for Phase 3**:
- ✅ All transformations render correctly
- ✅ Combined transformations work as expected
- ✅ No performance degradation

### Phase 4: 80×32 Mode

**Objective**: Extend implementation to support doubled horizontal resolution.

#### Task 4.1: Implement 80×32 Rendering Method

Create `renderTilemap_80x32Pixel()` by adapting 40×32 implementation:

```typescript
private renderTilemap_80x32Pixel(vc: number, hc: number, cell: number): void {
  // Similar to 40×32 but:
  // - Use mode80x32 = true for coordinate calculations
  // - Different tile width (80 instead of 40)
  // - Different scroll wrapping (640 instead of 320)
  // - May need different HC-to-pixel mapping
}
```

#### Task 4.2: Update Coordinate System

- Adjust HC-to-pixel mapping for doubled resolution
- Update scroll wrapping logic
- Verify clipping coordinates

**Risk**: Medium - different coordinate system  
**Test**: Verify rendering and scrolling in 80×32 mode

**Exit Criteria for Phase 4**:
- ✅ 80×32 mode renders correctly
- ✅ Mode switching works (40×32 ↔ 80×32)
- ✅ Scrolling and clipping work
- ✅ No regressions in 40×32 mode

### Phase 5: Text Mode

**Objective**: Implement monochrome bitmap tile mode.

#### Task 5.1: Extend fetchTilemapPattern() for Text Mode

Already implemented in Phase 2, Task 2.2 - needs testing:

- Verify 1-bit pixel extraction
- Verify palette index construction (attr[7:1] + pixel[0])
- Test with various font data

#### Task 5.2: Update Transparency Handling

Text mode uses RGB comparison instead of palette index comparison:

```typescript
// In pixel rendering:
const transparent = this.tilemapTextModeSampled
  ? ((rgb333 & 0x1FE) === (this.globalTransparencyColor << 1))
  : ((pixelValue & 0x0F) === (this.tilemapTransparencyIndex & 0x0F));
```

**Risk**: Low - text mode simplifies rendering  
**Test**: Display text with transparent background

**Exit Criteria for Phase 5**:
- ✅ Text mode renders correctly
- ✅ Palette construction works (7 bits + 1 bit)
- ✅ Transparency comparison works
- ✅ Text mode works in both 40×32 and 80×32

### Phase 6: Attribute-Eliminated Mode

**Objective**: Support 1-byte-per-tile mode using default attributes.

#### Task 6.1: Update Tile Fetch

Already handled in `fetchTilemapTile()` - needs testing:

```typescript
if (attrEliminated) {
  // Use default attributes from NextReg 0x6C
  this.tilemapCurrentAttr = this.getDefaultTilemapAttribute();
}
```

#### Task 6.2: Update Address Calculations

Already handled in `getTilemapAddresses()` - verify:

```typescript
const bytesPerTile = attrEliminated ? 1 : 2;
```

**Risk**: Low - simple conditional logic  
**Test**: Verify tile rendering with default attributes

**Exit Criteria for Phase 6**:
- ✅ Attribute-eliminated mode works
- ✅ Memory layout correct (1 byte per tile)
- ✅ Default attributes applied correctly
- ✅ Works with all other modes

### Phase 7: 512-Tile Mode

**Objective**: Support extended tile index range (0-511).

#### Task 7.1: Update Tile Index Extraction

Already handled in `fetchTilemapTile()` - needs testing:

```typescript
if (this.tilemap512TileModeSampled && !attrEliminated) {
  const tileIndexBit8 = this.tilemapCurrentAttr & 0x01;
  this.tilemapCurrentTileIndex |= (tileIndexBit8 << 8);
}
```

#### Task 7.2: Update Priority Handling

When 512-tile mode is enabled, attribute bit 0 is tile index bit 8 (not priority):

```typescript
this.tilemapTilePriority = this.tilemap512TileModeSampled 
  ? false  // No per-tile priority in 512-tile mode
  : (this.tilemapCurrentAttr & 0x01) !== 0;
```

**Risk**: Low - simple flag handling  
**Test**: Verify tile indices > 255 render correctly

**Exit Criteria for Phase 7**:
- ✅ 512-tile mode works
- ✅ Tile indices 256-511 accessible
- ✅ Priority flag disabled correctly
- ✅ Works with all resolution modes

### Phase 8: Performance Optimization

**Objective**: Add fast paths and optimizations following Layer 2 pattern.

#### Task 8.1: Add Scanline State Preparation

```typescript
/**
 * Prepare tilemap rendering state for current scanline.
 * Called once per scanline to determine if fast path can be used.
 */
private prepareTilemapScanlineState(vc: number): boolean {
  // Conditions for fast path:
  // 1. No transformations (no rotation, no mirrors)
  // 2. Aligned to tile boundary (no sub-tile scrolling in Y)
  // 3. Attributes not eliminated (avoid default attr checks)
  
  const yInTile = (vc + this.tilemapScrollYSampled) & 0x07;
  const canUseFastPath = 
    !this.tilemapTileRotate &&
    !this.tilemapTileXMirror &&
    !this.tilemapTileYMirror &&
    yInTile === 0 &&
    !this.tilemapEliminateAttrSampled;
  
  this.tilemapCanUseFastPath = canUseFastPath;
  return canUseFastPath;
}
```

#### Task 8.2: Implement Fast Path Rendering

```typescript
/**
 * Fast path for aligned, untransformed tiles.
 */
private renderTilemap_40x32Pixel_FastPath(hc: number): void {
  // Optimized rendering without transformation calculations
  // Pre-fetch multiple tiles
  // Use cached addresses
  // Minimize function calls
}
```

#### Task 8.3: Add Tile Pattern Caching

```typescript
// Cache last accessed tile definition address
private tilemapLastTileDefAddr: number = -1;
private tilemapLastTileDefData: Uint8Array;  // 32 bytes

// In fetchTilemapPattern():
if (patternAddr === this.tilemapLastTileDefAddr) {
  // Use cached data
} else {
  // Fetch from VRAM and cache
}
```

**Risk**: Low - optimizations are optional enhancements  
**Test**: Verify fast path produces identical results, measure performance gain

**Exit Criteria for Phase 8**:
- ✅ Fast path implemented and working
- ✅ Performance improvement measurable
- ✅ No visual differences between fast/slow paths
- ✅ Graceful fallback when fast path not applicable

### Phase 9: Special Features

**Objective**: Implement special tilemap features (stencil mode, priority, blending).

#### Task 9.1: Stencil Mode Integration

Already handled in `composeSinglePixel()` - needs testing:

```typescript
// Stencil mode: AND ULA and Tilemap colors together
if (stencilModeEnabled) {
  ulatmRgb = ulaRgb & tilemapRgb;
}
```

#### Task 9.2: Force On Top Mode

Handle NextReg 0x6B bit 0:

```typescript
// In composition:
const effectivePriority = this.tilemapTilePriority || this.tilemapForceOnTopOfUla;
```

#### Task 9.3: Blend Mode Integration

Tilemap participates in blend modes (NextReg 0x68 bits 7:6) - verify composition logic handles tilemap correctly.

**Risk**: Low - leverages existing composition infrastructure  
**Test**: Verify stencil, priority override, and blending work correctly

**Exit Criteria for Phase 9**:
- ✅ Stencil mode works
- ✅ Force on top mode works
- ✅ Blend modes work with tilemap
- ✅ All priority combinations tested

### Phase 10: Final Integration & Testing

**Objective**: Comprehensive testing and documentation.

#### Task 10.1: Integration Testing

Test all combinations:
- All tilemap modes × all ULA modes
- Tilemap + Layer 2 + Sprites
- All priority modes (SLU, LSU, SUL, LUS, USL, ULS)
- Scrolling + transformations + text mode
- Mode switching mid-frame (if supported)

#### Task 10.2: Performance Testing

- Measure frame rate with tilemap enabled
- Identify bottlenecks
- Optimize hot paths
- Verify no frame drops at 50/60 Hz

#### Task 10.3: Edge Case Testing

- Tile boundary crossing during scroll
- Mode switching
- Register updates mid-frame
- Maximum scroll values
- Clip window edge cases
- 512-tile mode with transformations

#### Task 10.4: Documentation

- Document all new methods
- Update architecture diagrams
- Add code comments
- Create usage examples

**Exit Criteria for Phase 10**:
- ✅ All automated tests pass
- ✅ Visual verification complete
- ✅ Performance meets requirements
- ✅ Documentation complete
- ✅ Code reviewed
- ✅ Zero known bugs

## Implementation Checklist

### Infrastructure
- [x] Add tilemap state variables
- [x] Define tilemap rendering flag constants
- [x] Implement rendering flags generation (40×32 mode)
- [x] Implement rendering flags generation (80×32 mode)
- [ ] Implement VRAM access helper
- [ ] Implement coordinate transformation helpers
- [ ] Implement tile transformation helpers

### Core Rendering
- [ ] Implement flag-driven tile index fetch
- [ ] Implement flag-driven tile attribute fetch  
- [ ] Implement flag-driven pattern fetch (graphics mode)
- [ ] Implement flag-driven pattern fetch (text mode)
- [ ] Implement pixel rendering (40×32)
- [ ] Implement pixel rendering (80×32)
- [ ] Add scrolling support
- [ ] Add clipping support
- [ ] Add transparency support

### Transformations
- [ ] Implement X mirror
- [ ] Implement Y mirror
- [ ] Implement rotation
- [ ] Test all transformation combinations

### Modes
- [ ] 40×32 graphics mode
- [ ] 80×32 graphics mode
- [ ] Text mode
- [ ] Attribute-eliminated mode
- [ ] 512-tile mode

### Optimization
- [ ] Scanline state preparation
- [ ] Fast path rendering
- [ ] Tile pattern caching
- [ ] Performance measurements

### Special Features
- [ ] Stencil mode
- [ ] Force on top mode
- [ ] Blend mode integration
- [ ] Priority bit handling

### Testing
- [ ] Unit tests for helpers
- [ ] Integration tests with ULA
- [ ] Integration tests with Layer 2
- [ ] Integration tests with Sprites
- [ ] All priority modes tested
- [ ] Edge cases tested
- [ ] Performance verified

### Documentation
- [ ] Method documentation
- [ ] Architecture updates
- [ ] Code comments
- [ ] Usage examples


## Risk Assessment

### High Risk Items
- **Integration with existing composition logic**: Tilemap must work with all existing layers
- **Memory access timing**: Must share VRAM with ULA without conflicts
- **Performance**: Tile fetching adds memory overhead

### Mitigation Strategies
- **Incremental development**: Each phase builds on previous, allowing early problem detection
- **Continuous testing**: Run existing tests after each change
- **Performance monitoring**: Track frame times throughout development
- **Fallback mechanisms**: Always have working code to revert to

## Success Metrics

- ✅ All tilemap modes render correctly
- ✅ Scrolling works smoothly without artifacts
- ✅ Transformations render correctly
- ✅ All priority modes work
- ✅ Performance maintains 50/60 Hz frame rate
- ✅ Zero regressions in existing layers
- ✅ All automated tests pass
- ✅ Code reviewed and documented

## Execution Status

**Ready to execute** - Awaiting instruction to begin Phase 1.

---

**Document Version**: 1.0  
**Last Updated**: December 30, 2024
