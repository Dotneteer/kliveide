#include "zxnext.h"

static uint32_t tilemapPaletteBgra(uint32_t index) {
  const uint32_t palette = paletteSecondTilemap != 0u ? 7u : 3u;
  return paletteBgraFromRgb333(paletteEntries[palette][index & 0xffu] & 0x1ffu);
}

static void resetTilemapState(void) {
  tilemapEnabled = 0u;
  tilemap80x32Resolution = 0u;
  tilemapEliminateAttributes = 0u;
  paletteSecondTilemap = 0u;
  tilemapTextMode = 0u;
  tilemap512TileMode = 0u;
  tilemapForceOnTopOfUla = 0u;
  tilemapTransparencyIndex = 0x0fu;
  tilemapClipIndex = 0u;
  tilemapClipWindowX1 = 0u;
  tilemapClipWindowX2 = 159u;
  tilemapClipWindowY1 = 0u;
  tilemapClipWindowY2 = 255u;
  tilemapScrollX = 0u;
  tilemapScrollY = 0u;
  tilemapUseBank7 = 0u;
  tilemapBank5Msb = 0u;
  tilemapTileDefUseBank7 = 0u;
  tilemapTileDefBank5Msb = 0u;
  tilemapPaletteOffset = 0u;
  tilemapXMirror = 0u;
  tilemapYMirror = 0u;
  tilemapRotate = 0u;
  tilemapUlaOver = 0u;
  tilemapDefaultAttr = 0u;
}

static uint32_t tilemapControlValue(void) {
  return
    (tilemapEnabled != 0u ? 0x80u : 0x00u) |
    (tilemap80x32Resolution != 0u ? 0x40u : 0x00u) |
    (tilemapEliminateAttributes != 0u ? 0x20u : 0x00u) |
    (paletteSecondTilemap != 0u ? 0x10u : 0x00u) |
    (tilemapTextMode != 0u ? 0x08u : 0x00u) |
    (tilemap512TileMode != 0u ? 0x02u : 0x00u) |
    (tilemapForceOnTopOfUla != 0u ? 0x01u : 0x00u);
}

static uint32_t tilemapDefaultAttrValue(void) {
  return
    ((uint32_t)(tilemapPaletteOffset & 0x0fu) << 4u) |
    (tilemapXMirror != 0u ? 0x08u : 0x00u) |
    (tilemapYMirror != 0u ? 0x04u : 0x00u) |
    (tilemapRotate != 0u ? 0x02u : 0x00u) |
    (tilemapUlaOver != 0u ? 0x01u : 0x00u);
}

static uint32_t tilemapReadNextReg(uint32_t reg) {
  switch (reg & 0xffu) {
    case 0x1bu:
      switch (tilemapClipIndex & 0x03u) {
        case 0: return tilemapClipWindowX1;
        case 1: return tilemapClipWindowX2;
        case 2: return tilemapClipWindowY1;
        default: return tilemapClipWindowY2;
      }
    case 0x2fu:
      return (tilemapScrollX >> 8u) & 0x03u;
    case 0x30u:
      return tilemapScrollX & 0xffu;
    case 0x31u:
      return tilemapScrollY;
    case 0x4cu:
      return tilemapTransparencyIndex & 0x0fu;
    case 0x6bu:
      return tilemapControlValue();
    case 0x6cu:
      return tilemapDefaultAttrValue();
    case 0x6eu:
      return (tilemapUseBank7 != 0u ? 0x80u : 0x00u) | (tilemapBank5Msb & 0x3fu);
    case 0x6fu:
      return (tilemapTileDefUseBank7 != 0u ? 0x80u : 0x00u) | (tilemapTileDefBank5Msb & 0x3fu);
    default:
      return 0xffffffffu;
  }
}

static uint32_t tilemapWriteNextReg(uint32_t reg, uint32_t value) {
  const uint8_t byteValue = (uint8_t)(value & 0xffu);
  switch (reg & 0xffu) {
    case 0x1bu:
      switch (tilemapClipIndex & 0x03u) {
        case 0: tilemapClipWindowX1 = byteValue; break;
        case 1: tilemapClipWindowX2 = byteValue; break;
        case 2: tilemapClipWindowY1 = byteValue; break;
        default: tilemapClipWindowY2 = byteValue; break;
      }
      tilemapClipIndex = (uint8_t)((tilemapClipIndex + 1u) & 0x03u);
      return 1u;
    case 0x1cu:
      if ((byteValue & 0x08u) != 0u) tilemapClipIndex = 0u;
      return 0u;
    case 0x2fu:
      tilemapScrollX = ((uint16_t)(byteValue & 0x03u) << 8u) | (tilemapScrollX & 0xffu);
      return 1u;
    case 0x30u:
      tilemapScrollX = (tilemapScrollX & 0x300u) | byteValue;
      return 1u;
    case 0x31u:
      tilemapScrollY = byteValue;
      return 1u;
    case 0x4cu:
      tilemapTransparencyIndex = byteValue & 0x0fu;
      return 1u;
    case 0x6bu:
      tilemapEnabled = (byteValue & 0x80u) != 0u;
      tilemap80x32Resolution = (byteValue & 0x40u) != 0u;
      tilemapEliminateAttributes = (byteValue & 0x20u) != 0u;
      paletteSecondTilemap = (byteValue & 0x10u) != 0u;
      tilemapTextMode = (byteValue & 0x08u) != 0u;
      tilemap512TileMode = (byteValue & 0x02u) != 0u;
      tilemapForceOnTopOfUla = (byteValue & 0x01u) != 0u;
      return 1u;
    case 0x6cu:
      tilemapDefaultAttr = byteValue;
      tilemapPaletteOffset = (byteValue >> 4u) & 0x0fu;
      tilemapXMirror = (byteValue & 0x08u) != 0u;
      tilemapYMirror = (byteValue & 0x04u) != 0u;
      tilemapRotate = (byteValue & 0x02u) != 0u;
      tilemapUlaOver = (byteValue & 0x01u) != 0u;
      return 1u;
    case 0x6eu:
      tilemapUseBank7 = (byteValue & 0x80u) != 0u;
      tilemapBank5Msb = byteValue & 0x3fu;
      return 1u;
    case 0x6fu:
      tilemapTileDefUseBank7 = (byteValue & 0x80u) != 0u;
      tilemapTileDefBank5Msb = byteValue & 0x3fu;
      return 1u;
    default:
      return 0u;
  }
}

static uint32_t tilemapVramOffset(uint32_t useBank7, uint32_t baseMsb, uint32_t address) {
  const uint32_t offsetMask = useBank7 != 0u ? 0x1fu : 0x3fu;
  const uint32_t highByte = (((baseMsb & offsetMask) + ((address >> 8u) & 0x3fu)) & 0x3fu);
  const uint32_t fullAddress = (highByte << 8u) | (address & 0xffu);
  const uint32_t bankBase = ZXNEXT_NEXT_RAM_OFFSET + (useBank7 != 0u ? 7u : 5u) * 0x4000u;
  return bankBase + fullAddress;
}

static uint32_t tilemapReadVram(uint32_t useBank7, uint32_t baseMsb, uint32_t address) {
  return readPhysical(tilemapVramOffset(useBank7, baseMsb, address));
}

static uint32_t tilemapTransformPacked(
  uint32_t xInTile,
  uint32_t yInTile,
  uint32_t xMirror,
  uint32_t yMirror,
  uint32_t rotate
) {
  uint32_t effectiveX = xInTile & 0x07u;
  uint32_t effectiveY = yInTile & 0x07u;
  const uint32_t effectiveXMirror = (xMirror != 0u) != (rotate != 0u);
  if (effectiveXMirror != 0u) effectiveX = 7u - effectiveX;
  if (yMirror != 0u) effectiveY = 7u - effectiveY;
  const uint32_t transformedX = rotate != 0u ? effectiveY : effectiveX;
  const uint32_t transformedY = rotate != 0u ? effectiveX : effectiveY;
  return (transformedX << 16u) | transformedY;
}

static uint32_t tilemapPatternPixel(
  uint32_t tileIndex,
  uint32_t attr,
  uint32_t absX,
  uint32_t absY,
  uint32_t phase
) {
  const uint32_t xInTile = tilemap80x32Resolution != 0u
    ? (((absX & 0x03u) << 1u) | (phase & 0x01u))
    : (absX & 0x07u);
  const uint32_t yInTile = absY & 0x07u;
  if (tilemapTextMode != 0u) {
    const uint32_t patternAddr = tileIndex * 8u + yInTile;
    const uint8_t patternByte = (uint8_t)tilemapReadVram(
      tilemapTileDefUseBank7,
      tilemapTileDefBank5Msb,
      patternAddr
    );
    return (patternByte >> (7u - xInTile)) & 0x01u;
  }

  const uint32_t packed = tilemapTransformPacked(
    xInTile,
    yInTile,
    (attr & 0x08u) != 0u,
    (attr & 0x04u) != 0u,
    (attr & 0x02u) != 0u
  );
  const uint32_t transformedX = packed >> 16u;
  const uint32_t transformedY = packed & 0xffffu;
  const uint32_t byteAddr = tileIndex * 32u + transformedY * 4u + (transformedX >> 1u);
  const uint8_t patternByte = (uint8_t)tilemapReadVram(
    tilemapTileDefUseBank7,
    tilemapTileDefBank5Msb,
    byteAddr
  );
  return (transformedX & 0x01u) == 0u ? (patternByte >> 4u) & 0x0fu : patternByte & 0x0fu;
}

static uint32_t zxnextGetTilemapPixelInfo(
  uint32_t displayHc,
  uint32_t displayVc,
  uint32_t phase,
  uint32_t ulaPixelInfo
) {
  if (tilemapEnabled == 0u) return 0u;
  const uint32_t displayX = displayHc + 32u;
  const uint32_t displayY = displayVc + 32u;
  if (displayX >= 320u || displayY >= 256u) return 0u;

  const uint32_t clipX1 = tilemapClipWindowX1 << 1u;
  const uint32_t clipX2 = (tilemapClipWindowX2 << 1u) | 1u;
  if (displayX < clipX1 || displayX > clipX2 || displayY < tilemapClipWindowY1 || displayY > tilemapClipWindowY2) {
    return 0u;
  }

  const uint32_t absX = (displayX + tilemapScrollX) % 320u;
  const uint32_t absY = (displayY + tilemapScrollY) & 0xffu;
  const uint32_t columns = tilemap80x32Resolution != 0u ? 80u : 40u;
  const uint32_t column = tilemap80x32Resolution != 0u ? (absX >> 2u) : (absX >> 3u);
  const uint32_t row = absY >> 3u;
  const uint32_t tileArrayIndex = row * columns + column;
  const uint32_t tileIndexAddr = tilemapEliminateAttributes != 0u ? tileArrayIndex : tileArrayIndex << 1u;
  uint32_t tileIndex = tilemapReadVram(tilemapUseBank7, tilemapBank5Msb, tileIndexAddr);
  uint32_t attr = tilemapDefaultAttr;
  if (tilemapEliminateAttributes == 0u) {
    attr = tilemapReadVram(tilemapUseBank7, tilemapBank5Msb, tileIndexAddr + 1u);
    if (tilemap512TileMode != 0u) tileIndex |= (attr & 0x01u) << 8u;
  }

  const uint32_t pixelValue = tilemapPatternPixel(tileIndex, attr, absX, absY, phase);
  const uint32_t paletteIndex = tilemapTextMode != 0u
    ? ((((attr >> 1u) << 1u) | pixelValue) & 0xffu)
    : ((((attr >> 4u) & 0x0fu) << 4u) | (pixelValue & 0x0fu));
  const uint32_t palette = paletteSecondTilemap != 0u ? 7u : 3u;
  const uint32_t paletteEntry = paletteEntries[palette][paletteIndex & 0xffu];
  const uint32_t transparent = tilemapTextMode != 0u
    ? ((paletteEntry & 0x1feu) == ((uint32_t)globalTransparencyColor << 1u))
    : ((pixelValue & 0x0fu) == (tilemapTransparencyIndex & 0x0fu));
  if (transparent != 0u) return 0u;

  const uint32_t belowUla = tilemapForceOnTopOfUla == 0u &&
    tilemap512TileMode == 0u &&
    (attr & 0x01u) != 0u;
  if (belowUla != 0u && (ulaPixelInfo & ZXNEXT_LAYER_PIXEL_VALID) != 0u) return ulaPixelInfo;
  return zxnextPackLayerPixel(paletteEntry & 0x1ffu, 0u);
}

static uint32_t zxnextGetTilemapPixelBgra(
  uint32_t displayHc,
  uint32_t displayVc,
  uint32_t phase,
  uint32_t ulaPixel,
  uint32_t ulaOpaque
) {
  (void)ulaPixel;
  const uint32_t ulaInfo = ulaOpaque != 0u ? zxnextPackLayerPixel(0u, 0u) : 0u;
  return zxnextLayerPixelBgra(zxnextGetTilemapPixelInfo(displayHc, displayVc, phase, ulaInfo));
}

uint32_t zxnextGetTilemapEnabled(void) { return tilemapEnabled; }
uint32_t zxnextGetTilemap80x32Resolution(void) { return tilemap80x32Resolution; }
uint32_t zxnextGetTilemapEliminateAttributes(void) { return tilemapEliminateAttributes; }
uint32_t zxnextGetTilemapTextMode(void) { return tilemapTextMode; }
uint32_t zxnextGetTilemap512TileMode(void) { return tilemap512TileMode; }
uint32_t zxnextGetTilemapForceOnTopOfUla(void) { return tilemapForceOnTopOfUla; }
uint32_t zxnextGetTilemapTransparencyIndex(void) { return tilemapTransparencyIndex; }
uint32_t zxnextGetTilemapClipIndex(void) { return tilemapClipIndex; }
uint32_t zxnextGetTilemapClipWindowX1(void) { return tilemapClipWindowX1; }
uint32_t zxnextGetTilemapClipWindowX2(void) { return tilemapClipWindowX2; }
uint32_t zxnextGetTilemapClipWindowY1(void) { return tilemapClipWindowY1; }
uint32_t zxnextGetTilemapClipWindowY2(void) { return tilemapClipWindowY2; }
uint32_t zxnextGetTilemapScrollX(void) { return tilemapScrollX; }
uint32_t zxnextGetTilemapScrollY(void) { return tilemapScrollY; }
uint32_t zxnextGetTilemapUseBank7(void) { return tilemapUseBank7; }
uint32_t zxnextGetTilemapBank5Msb(void) { return tilemapBank5Msb; }
uint32_t zxnextGetTilemapTileDefUseBank7(void) { return tilemapTileDefUseBank7; }
uint32_t zxnextGetTilemapTileDefBank5Msb(void) { return tilemapTileDefBank5Msb; }
uint32_t zxnextGetTilemapPaletteOffset(void) { return tilemapPaletteOffset; }
uint32_t zxnextGetTilemapXMirror(void) { return tilemapXMirror; }
uint32_t zxnextGetTilemapYMirror(void) { return tilemapYMirror; }
uint32_t zxnextGetTilemapRotate(void) { return tilemapRotate; }
uint32_t zxnextGetTilemapUlaOver(void) { return tilemapUlaOver; }
uint32_t zxnextGetTilemapDefaultAttr(void) { return tilemapDefaultAttr; }
uint32_t zxnextGetPaletteSecondTilemap(void) { return paletteSecondTilemap; }
uint32_t zxnextGetTilemapVramOffset(uint32_t useBank7, uint32_t baseMsb, uint32_t address) {
  return tilemapVramOffset(useBank7, baseMsb, address);
}
