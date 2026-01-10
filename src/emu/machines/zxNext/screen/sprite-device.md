# SpriteDevice Implementation Review

## Scope

Focus: **Pattern and Attribute Storage** in SpriteDevice only (excludes rendering logic).

**Implemented**: ✓ Pattern memory, ✓ Attribute storage, ✓ Port 0x303b/0x57/0x5b, ✓ Clip window (Reg 0x19), ✓ NextReg 0x34-0x39, 0x75-0x79, ✓ Lockstep mode

---

## Issues and Missing Features

### 1. Attribute Storage - 9-bit Coordinate Validation

**Problem**: `x` and `y` stored as generic `number` (unsafe for 9-bit values)
```typescript
// Current (incorrect)
x: number;  // Can exceed 9-bit range
y: number;  // Can exceed 9-bit range

// Fix: Add validation in writeIndexedSpriteAttribute
case 0:
  attributes.x = ((attributes.x & 0x100) | value) & 0x1FF;  // Mask to 9 bits
  break;
case 1:
  attributes.y = ((attributes.y & 0x100) | value) & 0x1FF;  // Mask to 9 bits
  break;
case 4:
  // X MSB
  attributes.x = (((value & 0x01) << 8) | (attributes.x & 0xff)) & 0x1FF;
  // Y MSB (attr4[0] only for non-relative anchor sprites)
  break;
```

### 2. Attribute Storage - Missing Computed Fields

**Missing**: Consolidate split fields for easier rendering
```typescript
// Add to SpriteAttributes (optional optimization)
pattern7Bit?: number;     // Computed: attr3[5:0] | (attr4[6] << 6)
is4BitPattern?: boolean;  // Computed: attr4[7]

// Update in writeIndexedSpriteAttribute cases 3 and 4:
case 3:
  attributes.patternIndex = value & 0x3f;
  attributes.pattern7Bit = attributes.patternIndex | 
                          (attributes.attributeFlag2 ? 64 : 0);
  break;
case 4:
  attributes.attributeFlag2 = (value & 0x20) !== 0;
  attributes.is4BitPattern = (value & 0x80) !== 0;
  attributes.pattern7Bit = attributes.patternIndex | 
                          (attributes.attributeFlag2 ? 64 : 0);
  break;
```
**Note**: Optional - renderer can compute on-the-fly if preferred.

### 3. Pattern Memory - Inefficient Duplicate Storage

**Problem**: `pattermMemory4Bit` wastes 32KB by pre-expanding nibbles
```typescript
// Current (wasteful)
this.patternMemory8Bit = new Uint8Array(0x4000);  // 16KB ✓
this.pattermMemory4Bit = new Uint8Array(0x8000);  // 32KB ✗

// In writeSpritePattern:
this.pattermMemory4Bit[memIndex * 2] = (value & 0xf0) >> 4;
this.pattermMemory4Bit[memIndex * 2 + 1] = value & 0x0f;
```

**Fix**: Remove `pattermMemory4Bit` entirely
```typescript
// Constructor: Remove
// this.pattermMemory4Bit = new Uint8Array(0x8000);

// writeSpritePattern: Remove nibble expansion
writeSpritePattern(value: number): void {
  const memIndex = (this.patternIndex << 8) + this.patternSubIndex;
  this.patternMemory8Bit[memIndex] = value;
  // Remove: this.pattermMemory4Bit[...] lines
  
  this.patternSubIndex = (this.patternSubIndex + 1) & 0xff;
  if (!this.patternSubIndex) {
    this.patternIndex = (this.patternIndex + 1) & 0x3f;
  }
}

// Renderer extracts nibbles when needed (not in SpriteDevice)
```

### 4. Relative Sprite Support - Missing Anchor Tracking

**Missing**: Store anchor sprite properties for relative sprite chains
```typescript
// Add to SpriteDevice class
private anchorX: number = 0;
private anchorY: number = 0;
private anchorRotate: boolean = false;
private anchorMirrorX: boolean = false;
private anchorMirrorY: boolean = false;

// Update in writeIndexedSpriteAttribute case 2:
case 2:
  attributes.paletteOffset = (value & 0xf0) >> 4;
  attributes.mirrorX = (value & 0x08) !== 0;
  attributes.mirrorY = (value & 0x04) !== 0;
  attributes.rotate = (value & 0x02) !== 0;
  attributes.attributeFlag1 = (value & 0x01) !== 0;
  
  // Track anchor if this is an anchor sprite (non-relative with 5 bytes)
  if (attributes.has5AttributeBytes && attributes.colorMode !== 0x01) {
    this.anchorX = attributes.x;
    this.anchorY = attributes.y;
    this.anchorRotate = attributes.rotate;
    this.anchorMirrorX = attributes.mirrorX;
    this.anchorMirrorY = attributes.mirrorY;
  }
  break;
```

**Usage**: Renderer reads anchor properties when processing relative sprites (`colorMode === 0x01`).

### 5. Collision & Overflow Flags - Storage Only

**Current**: Flags exist and port read/clear works ✓
```typescript
tooManySpritesPerLine: boolean;
collisionDetected: boolean;

readPort303bValue(): number {
  const result = (this.tooManySpritesPerLine ? 0x02 : 0) | 
                 (this.collisionDetected ? 0x01 : 0);
  this.tooManySpritesPerLine = false;  // Auto-clear on read ✓
  this.collisionDetected = false;       // Auto-clear on read ✓
  return result;
}
```

**Note**: Flags are **set by renderer** (NextComposedScreenDevice), not by SpriteDevice. Storage implementation is correct.

### 6. Missing NextReg Read Operations

**Check**: Does SpriteDevice need getter properties for NextRegs?
```typescript
// Current: Only setters exist (via writeSpriteAttributeDirect)

// Potentially missing: Getters for NextReg reads
get nextReg34Value(): number {
  return this.spriteMirrorIndex;
}

// Already implemented ✓

// Check if these are needed:
get nextReg35Value(): number { /* attr0 of current sprite */ }
get nextReg36Value(): number { /* attr1 of current sprite */ }
get nextReg37Value(): number { /* attr2 of current sprite */ }
get nextReg38Value(): number { /* attr3 of current sprite */ }
get nextReg39Value(): number { /* attr4 of current sprite */ }
// Similar for 0x75-0x79
```

**Verify**: Check NextRegDevice if these reads are implemented.

### 7. Pattern Index Bounds - Missing Validation

**Issue**: Pattern index should be 0-63 (6-bit) but attr4[6] extends it to 7-bit (0-127)
```typescript
// Current: No validation
case 3:
  attributes.patternIndex = value & 0x3f;  // Only 6 bits stored
  break;

case 4:
  attributes.attributeFlag2 = (value & 0x20) !== 0;  // Bit 6 extends pattern
  break;
```

**Fix**: Compute full 7-bit pattern index
```typescript
// Add helper method
getFullPatternIndex(sprite: SpriteAttributes): number {
  return sprite.patternIndex | (sprite.attributeFlag2 ? 64 : 0);
}

// Or store in pattern7Bit field (see issue #2)
```

### 8. Clip Window - Coordinate Space Clarification

**Current**: Clip window stored without documentation
```typescript
clipWindowX1: number;  // Range 0-255
clipWindowX2: number;  // Range 0-255
clipWindowY1: number;  // Range 0-191
clipWindowY2: number;  // Range 0-191
```

**Question**: What coordinate space?
- ULA space (256×192)?
- Sprite display space (320×256)?

**Hardware spec**: Clip window uses **ULA coordinate space** (256×192), but sprites use 320-pixel coordinate system.

**Recommendation**: Add comment clarifying coordinate space and conversion formula if needed.

---

## Summary of Required Changes

### High Priority (Correctness)
1. ✗ Remove `pattermMemory4Bit` (wastes 32KB)
2. ✗ Add 9-bit coordinate masking in `writeIndexedSpriteAttribute`
3. ✗ Add anchor sprite tracking for relative sprite support

### Medium Priority (Optimization)
4. ⚠ Add `pattern7Bit` computed field (optional)
5. ⚠ Verify NextReg read operations exist
6. ⚠ Document clip window coordinate space

### Low Priority (Already Works)
7. ✓ Collision/overflow flags (storage correct, set by renderer)
8. ✓ Port operations (0x303b, 0x57, 0x5b)
9. ✓ NextReg write operations (0x19, 0x34-0x39, 0x75-0x79)

---

## Testing Checklist (Storage Only)

- [ ] Pattern memory write via port 0x5b (256 bytes per pattern)
- [ ] Pattern index wraps at 64 (0x3F)
- [ ] Sprite attribute write via port 0x57 (5 bytes per sprite)
- [ ] Sprite attribute write via NextReg 0x35-0x39
- [ ] Sprite index wraps at 128
- [ ] 9-bit X coordinate (0-511) stored correctly
- [ ] 9-bit Y coordinate (0-511) stored correctly
- [ ] 7-bit pattern index (0-127) stored across attr3[5:0] + attr4[6]
- [ ] Clip window values (NextReg 0x19) cycle through X1→X2→Y1→Y2
- [ ] Lockstep mode (NextReg 0x1C bit 1) synchronizes sprite index
- [ ] Collision/overflow flags clear on port 0x303b read
- [ ] lastVisibleSpriteIndex tracks highest visible sprite
