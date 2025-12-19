# All Rendering Matrices → Uint16Array Refactoring Plan

## Overview
Apply the same optimization used for ULA Standard cells to ALL rendering matrices:
- Convert from 2D object arrays to 1D Uint16Array with bit flags
- Single-dimension addressing: `matrix[vc * totalHC + hc]`
- Full scanline storage including blanking regions
- **Expected total memory savings**: ~85-90% reduction across all layers

## Matrices to Refactor

### Already Completed ✓
- **ULA Standard** (50Hz/60Hz)

### Remaining Matrices
1. **ULA Hi-Res** (50Hz/60Hz) - 5 flags
2. **ULA Hi-Color** (50Hz/60Hz) - 5 flags  
3. **Layer 2 256×192** (50Hz/60Hz) - 4 flags
4. **Layer 2 320×256** (50Hz/60Hz) - 4 flags
5. **Layer 2 640×256** (50Hz/60Hz) - 4 flags
6. **Sprites** (50Hz/60Hz) - 4 flags
7. **Tilemap 40×32** (50Hz/60Hz) - 4 flags
8. **Tilemap 80×32** (50Hz/60Hz) - 4 flags
9. **LoRes** (50Hz/60Hz) - 4 flags

**Total**: 9 matrix types × 2 timing modes = 18 matrices to refactor

---

## Bit Flag Definitions by Layer Type

### ULA Hi-Res Cell (5 flags)
```typescript
export const ULA_HIRES_DISPLAY_AREA = 0b00001;      // bit 0
export const ULA_HIRES_CONTENTION_WINDOW = 0b00010; // bit 1
export const ULA_HIRES_PIXEL_READ_0 = 0b00100;      // bit 2
export const ULA_HIRES_PIXEL_READ_1 = 0b01000;      // bit 3
export const ULA_HIRES_SHIFT_REG_LOAD = 0b10000;    // bit 4
```

### ULA Hi-Color Cell (5 flags)
```typescript
export const ULA_HICOLOR_DISPLAY_AREA = 0b00001;      // bit 0
export const ULA_HICOLOR_CONTENTION_WINDOW = 0b00010; // bit 1
export const ULA_HICOLOR_PIXEL_READ = 0b00100;        // bit 2
export const ULA_HICOLOR_COLOR_READ = 0b01000;        // bit 3
export const ULA_HICOLOR_SHIFT_REG_LOAD = 0b10000;    // bit 4
```

### Layer 2 Cell (4 flags - same for all 3 resolutions)
```typescript
export const LAYER2_DISPLAY_AREA = 0b0001;        // bit 0
export const LAYER2_CONTENTION_WINDOW = 0b0010;   // bit 1
export const LAYER2_PIXEL_FETCH = 0b0100;         // bit 2
export const LAYER2_PALETTE_INDEX = 0b1000;       // bit 3
```

### Sprites Cell (4 flags)
```typescript
export const SPRITES_DISPLAY_AREA = 0b0001;        // bit 0
export const SPRITES_CONTENTION_WINDOW = 0b0010;   // bit 1
export const SPRITES_LINE_BUFFER_READ = 0b0100;    // bit 2
export const SPRITES_VISIBILITY_CHECK = 0b1000;    // bit 3
```

### Tilemap Cell (4 flags - same for both resolutions)
```typescript
export const TILEMAP_DISPLAY_AREA = 0b0001;        // bit 0
export const TILEMAP_CONTENTION_WINDOW = 0b0010;   // bit 1
export const TILEMAP_TILE_INDEX_FETCH = 0b0100;    // bit 2
export const TILEMAP_PATTERN_FETCH = 0b1000;       // bit 3
```

### LoRes Cell (4 flags)
```typescript
export const LORES_DISPLAY_AREA = 0b0001;          // bit 0
export const LORES_CONTENTION_WINDOW = 0b0010;     // bit 1
export const LORES_BLOCK_FETCH = 0b0100;           // bit 2
export const LORES_PIXEL_REPLICATE = 0b1000;       // bit 3
```

---

## Refactoring Steps (Applied to Each Matrix Type)

### Step 1: Add Bit Flag Constants (RenderingCell.ts)
For each layer type, add bit flag constants as shown above.

### Step 2: Update Type Definitions (RenderingCell.ts)
Convert each cell type from object to number:
```typescript
// Before:
export type ULAHiResCell = RenderingCellBase & { pixelRead0: boolean; ... };

// After:
export type ULAHiResCell = number;
export type ULAHiResMatrix = Uint16Array;
```

### Step 3: Update Cell Generation Functions
For each layer in respective files (UlaMatrix.ts, Layer2Matrix.ts, SpritesMatrix.ts, etc.):

```typescript
// Before:
return {
  displayArea,
  contentionWindow,
  pixelRead0,
  pixelRead1,
  shiftRegLoad
};

// After:
let flags = 0;
if (displayArea) flags |= ULA_HIRES_DISPLAY_AREA;
if (contentionWindow) flags |= ULA_HIRES_CONTENTION_WINDOW;
if (pixelRead0) flags |= ULA_HIRES_PIXEL_READ_0;
if (pixelRead1) flags |= ULA_HIRES_PIXEL_READ_1;
if (shiftRegLoad) flags |= ULA_HIRES_SHIFT_REG_LOAD;
return flags;
```

### Step 4: Create 1D Matrix Generation Methods (NextComposedScreenDevice.ts)
Add generation method for each matrix type:

```typescript
private generateULAHiResMatrix(config: TimingConfig): Uint16Array {
  const vcCount = config.totalVC;
  const hcCount = MATRIX_HC_COUNT;
  const matrix = new Uint16Array(vcCount * hcCount);
  
  for (let vc = 0; vc < vcCount; vc++) {
    for (let hc = 0; hc < hcCount; hc++) {
      const index = vc * hcCount + hc;
      matrix[index] = generateULAHiResCell(config, vc, hc);
    }
  }
  
  return matrix;
}
```

Repeat for:
- `generateULAHiColorMatrix()`
- `generateLayer2_256x192Matrix()`
- `generateLayer2_320x256Matrix()`
- `generateLayer2_640x256Matrix()`
- `generateSpritesMatrix()`
- `generateTilemap_40x32Matrix()`
- `generateTilemap_80x32Matrix()`
- `generateLoResMatrix()`

### Step 5: Update Matrix Storage (NextComposedScreenDevice.ts)
Change all matrix properties from `LayerMatrix` to `Uint16Array`:

```typescript
// Before:
private _matrixULAHiRes50Hz: LayerMatrix;
private _matrixULAHiRes60Hz: LayerMatrix;

// After:
private _matrixULAHiRes50Hz: Uint16Array;
private _matrixULAHiRes60Hz: Uint16Array;
```

Update constructor initialization to use new generation methods:
```typescript
this._matrixULAHiRes50Hz = this.generateULAHiResMatrix(Plus3_50Hz);
this._matrixULAHiRes60Hz = this.generateULAHiResMatrix(Plus3_60Hz);
```

### Step 6: Update Cell Access in renderTact() (NextComposedScreenDevice.ts)
Replace 2D sparse matrix access with 1D full matrix access:

```typescript
// Before:
const mVC = vc - this.config.firstBitmapVC;
const mHC = hc - this.config.firstVisibleHC;
const ulaCell = this._matrixULAHiRes[mVC][mHC] as ULAHiResCell;

// After:
const cellIndex = vc * this._matrixHCCount + hc;
const ulaCell = this._matrixULAHiRes[cellIndex];

// Blanking check (all flags = 0)
if (ulaCell === 0) {
  return false; // Skip blanking
}
```

### Step 7: Update Rendering Methods (NextComposedScreenDevice.ts)
Update each render method to use bit masking:

```typescript
// Before:
private renderULAHiResPixel(..., cell: ULAHiResCell, ...): LayerOutput {
  if (!cell.displayArea) { ... }
  if (cell.pixelRead0) { ... }
  if (cell.pixelRead1) { ... }
}

// After:
private renderULAHiResPixel(..., cell: number, ...): LayerOutput {
  if ((cell & ULA_HIRES_DISPLAY_AREA) === 0) { ... }
  if ((cell & ULA_HIRES_PIXEL_READ_0) !== 0) { ... }
  if ((cell & ULA_HIRES_PIXEL_READ_1) !== 0) { ... }
}
```

Apply to all render methods:
- `renderULAHiResPixel()`
- `renderULAHiColorPixel()`
- `renderLayer2_256x192Pixel()`
- `renderLayer2_320x256Pixel()`
- `renderLayer2_640x256Pixel()`
- `renderSpritesPixel()`
- `renderTilemap_40x32Pixel()`
- `renderTilemap_80x32Pixel()`
- `renderLoResPixel()`

### Step 8: Remove Sparse Matrix Logic
Since all matrices now include blanking:
- Remove `mVC` and `mHC` calculations (except for old 2D access during transition)
- Remove blanking checks based on HC/VC ranges
- Use simple `if (cell === 0) return false;` for all layers

---

## Memory Impact Analysis

### Before Refactoring (Object-Based 2D Sparse Arrays)
Per matrix, assuming ~40 bytes per object:
- **Sparse visible area**: ~105K cells (288 × 360) × 40 bytes = **~4.2 MB** per matrix
- **18 matrices total**: ~4.2 MB × 18 = **~75 MB**

### After Refactoring (Uint16Array 1D Full Storage)
Per matrix (full scanline):
- **50Hz**: 311 × 456 × 2 bytes = **~284 KB** per matrix
- **60Hz**: 264 × 456 × 2 bytes = **~241 KB** per matrix
- **Average per matrix**: ~262 KB
- **18 matrices total**: ~262 KB × 18 = **~4.7 MB**

### Total Savings
**~75 MB → ~4.7 MB** = **~94% reduction** (~16× smaller)

---

## Performance Benefits (Per Matrix)
- **Memory**: 15-25× reduction per matrix
- **Cache efficiency**: 3-6× improvement (contiguous memory)
- **Access speed**: 20-40% faster (1D index vs 2D lookup)
- **GC pressure**: Eliminated (no object allocations)
- **Blanking checks**: Simplified to single equality check

---

## Implementation Order (Suggested)
1. **ULA Hi-Res & Hi-Color** (similar to ULA Standard)
2. **Layer 2 matrices** (all 3 resolutions share same flags)
3. **Sprites** (simplest, only 4 flags)
4. **Tilemap matrices** (both resolutions share same flags)
5. **LoRes** (last, simplest)

---

## Testing Checklist (Per Matrix)
- [ ] Verify rendering output matches original
- [ ] Test blanking region handling (should return early with cell === 0)
- [ ] Verify border rendering still works correctly
- [ ] Test mode switching (50Hz ↔ 60Hz)
- [ ] Profile memory usage reduction
- [ ] Benchmark rendering performance improvement
- [ ] Test edge cases at display area boundaries

---

## Expected Total Impact
- **Development time**: ~2-3 hours for all matrices
- **Memory savings**: ~70 MB freed
- **Performance gain**: 20-40% faster frame rendering
- **Code simplification**: Consistent pattern across all layers
- **Maintenance**: Easier to understand and modify
