# ULAStandardCell → Uint16Array 1D Matrix Refactoring Steps

## Overview
Convert ULAStandardCell from 2D object array to 1D Uint16Array with:
- Bit flags for properties (~15-25x memory savings)
- Single-dimension addressing (eliminates 2D lookup overhead)
- **Full matrix storage including blanking regions** (simplifies logic, enables contiguous memory access)

## Affected Files
- **RenderingCell.ts** - Type definitions and bit flag constants
- **UlaMatrix.ts** - Cell generation logic
- **NextComposedScreenDevice.ts** - Matrix storage, generation, and rendering

---

## Step 1: Define Bit Flag Constants (RenderingCell.ts)
Add bit flag constants for ULAStandardCell properties:
```typescript
// Bit positions (7 flags total, fits in Uint16)
export const ULA_DISPLAY_AREA = 0b0000001;        // bit 0
export const ULA_CONTENTION_WINDOW = 0b0000010;   // bit 1
export const ULA_SCROLL_SAMPLE = 0b0000100;       // bit 2
export const ULA_PIXEL_READ = 0b0001000;          // bit 3
export const ULA_ATTR_READ = 0b0010000;           // bit 4
export const ULA_SHIFT_REG_LOAD = 0b0100000;      // bit 5
export const ULA_FLOATING_BUS_UPDATE = 0b1000000; // bit 6
```

---

## Step 2: Update Type Definitions (RenderingCell.ts)
Changes:
- `ULAStandardCell` type alias to `number` (Uint16 value)
- Add helper type: `ULAStandardMatrix = Uint16Array`
- Add addressing helper function type:
  ```typescript
  // Calculate 1D index from (vc, hc) coordinates
  // index = vc * totalHC + hc
  ```

---

## Step 3: Add Matrix Dimension Constants (NextComposedScreenDevice.ts)
Add timing-specific constants for full matrix dimensions:
```typescript
// Full scanline including blanking (50Hz/60Hz both use same HC range: 0-447)
const MATRIX_HC_COUNT = 448;  // 0 to maxHC (447)

// Full frame including blanking
const MATRIX_VC_COUNT_50HZ = 311;  // 0 to maxVC (310) for 50Hz
const MATRIX_VC_COUNT_60HZ = 263;  // 0 to maxVC (262) for 60Hz

// 1D matrix sizes
const MATRIX_SIZE_50HZ = MATRIX_VC_COUNT_50HZ * MATRIX_HC_COUNT;  // ~139K elements
const MATRIX_SIZE_60HZ = MATRIX_VC_COUNT_60HZ * MATRIX_HC_COUNT;  // ~118K elements
```

---

## Step 4: Update Cell Generation (UlaMatrix.ts)
Modify `generateULAStandardCell()`:
- Return `number` (Uint16 flags) instead of object
- Use bitwise OR to set flags: `flags |= ULA_PIXEL_READ`
- **Handle blanking regions** (return 0 or minimal flags for blanking areas)
- Remove object literal construction

---

## Step 5: Update Matrix Generation (NextComposedScreenDevice.ts)
Replace `generateRenderingMatrix()` with new 1D version for ULA Standard:
```typescript
private generateULAStandardMatrix(config: TimingConfig): Uint16Array {
  const vcCount = config.maxVC + 1;  // Total scanlines (including blanking)
  const hcCount = MATRIX_HC_COUNT;   // Total horizontal positions
  const matrix = new Uint16Array(vcCount * hcCount);
  
  for (let vc = 0; vc <= config.maxVC; vc++) {
    for (let hc = 0; hc < hcCount; hc++) {
      const index = vc * hcCount + hc;
      matrix[index] = generateULAStandardCell(config, vc, hc);
    }
  }
  
  return matrix;
}
```

---

## Step 6: Update Matrix Storage (NextComposedScreenDevice.ts)
Change private properties from 2D to 1D:
```typescript
// Before:
private _matrixULAStandard50Hz: RenderingCell[][];
private _matrixULAStandard60Hz: RenderingCell[][];

// After:
private _matrixULAStandard50Hz: Uint16Array;
private _matrixULAStandard60Hz: Uint16Array;
private readonly _matrixHCCount = MATRIX_HC_COUNT;  // For index calculation
```

Update initialization:
```typescript
this._matrixULAStandard50Hz = this.generateULAStandardMatrix(Plus3_50Hz);
this._matrixULAStandard60Hz = this.generateULAStandardMatrix(Plus3_60Hz);
```

---

## Step 7: Update Cell Access (NextComposedScreenDevice.ts)
In `renderScreenInternal()` (line ~406):
```typescript
// Before (2D):
const mVC = vc - config.firstBitmapVC;
const mHC = hc - config.firstVisibleHC;
const ulaCell = this._matrixULAStandard[mVC][mHC] as ULAStandardCell;

// After (1D):
const cellIndex = vc * this._matrixHCCount + hc;
const ulaCell = this._matrixULAStandard[cellIndex];
```

---

## Step 8: Update Rendering Logic (NextComposedScreenDevice.ts)
In `renderULAStandardPixel()` (line ~752):
- Change parameter: `cell: number` (instead of `ULAStandardCell`)
- Replace property checks with bit masking:
  ```typescript
  // Before:
  if (!cell.displayArea) { ... }
  if (cell.scrollSample) { ... }
  if (cell.pixelRead) { ... }
  
  // After:
  if ((cell & ULA_DISPLAY_AREA) === 0) { ... }
  if ((cell & ULA_SCROLL_SAMPLE) !== 0) { ... }
  if ((cell & ULA_PIXEL_READ) !== 0) { ... }
  ```

---

## Step 9: Update Matrix Getter (NextComposedScreenDevice.ts)
Update the property that selects the current matrix:
```typescript
// Ensure getter returns correct 1D matrix based on timing mode
private get _matrixULAStandard(): Uint16Array {
  return this.is60Hz ? this._matrixULAStandard60Hz : this._matrixULAStandard50Hz;
}
```

---

## Step 10: Testing
- Verify rendering output matches original
- Validate blanking regions don't cause rendering issues
- Check memory usage (~200-280 KB for full matrices)
- Profile performance: 1D addressing eliminates double-dereference overhead
- Test edge cases at blanking boundaries

---

## Expected Benefits
- **Memory**: ~15-25x reduction vs objects (280 KB vs 3-5 MB for ~140K cells)
- **Cache efficiency**: Improved by 3-6x (contiguous memory, no pointer chasing)
- **GC pressure**: Eliminated (no object allocations)
- **Access speed**: 20-40% faster (1D index calculation vs 2D array lookup)
- **Blanking included**: Simplifies bounds checking and special case handling

## Memory Breakdown
- **50Hz matrix**: 311 × 448 × 2 bytes = ~279 KB
- **60Hz matrix**: 263 × 448 × 2 bytes = ~236 KB
- **Total for both**: ~515 KB (vs ~6-10 MB for object-based approach)
