#include "zxnext.h"

static uint32_t layer2PaletteBgra(uint32_t index) {
  const uint32_t palette = paletteSecondLayer2 != 0u ? 5u : 1u;
  return paletteBgraFromRgb333(paletteEntries[palette][index & 0xffu] & 0x1ffu);
}

static uint32_t ulaPlusPaletteBgra(uint32_t index) {
  const uint32_t palette = paletteSecondUla != 0u ? 4u : 0u;
  return paletteBgraFromRgb333(paletteEntries[palette][index & 0xffu] & 0x1ffu);
}

static uint32_t layer2WrapY256(uint32_t y) {
  if (y < 192u) return y & 0xffu;
  return (((((y >> 6u) & 0x03u) + 1u) & 0x03u) << 6u) | (y & 0x3fu);
}

static uint32_t layer2WrapWide(uint32_t value) {
  return value & 0x1ffu;
}

static void resetLayer2State(void) {
  layer2Enabled = 0u;
  layer2Resolution = 0u;
  layer2PaletteOffset = 0u;
  layer2ScrollX = 0u;
  layer2ScrollY = 0u;
  layer2ClipWindowX1 = 0u;
  layer2ClipWindowX2 = 255u;
  layer2ClipWindowY1 = 0u;
  layer2ClipWindowY2 = 191u;
  layer2ClipIndex = 0u;
  layer2ActiveRamBank = 8u;
  layer2ShadowRamBank = 11u;
  layer2UseShadowBank = 0u;
  layer2Bank = 0u;
  layer2BankOffset = 0u;
  layer2EnableMappingForReads = 0u;
  layer2EnableMappingForWrites = 0u;
  layerPriority = 0u;
  fallbackColor = 0u;
  globalTransparencyColor = 0xe3u;
  loResEnabled = 0u;
  loResRadastanMode = 0u;
  loResRadastanTimexXor = 0u;
  loResPaletteOffset = 0u;
  loResScrollX = 0u;
  loResScrollY = 0u;
}

static uint32_t layer2ReadNextReg(uint32_t reg) {
  switch (reg & 0xffu) {
    case 0x12u:
      return layer2ActiveRamBank;
    case 0x13u:
      return layer2ShadowRamBank;
    case 0x14u:
      return globalTransparencyColor;
    case 0x4au:
      return fallbackColor;
    case 0x16u:
      return layer2ScrollX & 0xffu;
    case 0x17u:
      return layer2ScrollY;
    case 0x18u:
      switch (layer2ClipIndex & 0x03u) {
        case 0: return layer2ClipWindowX1;
        case 1: return layer2ClipWindowX2;
        case 2: return layer2ClipWindowY1;
        default: return layer2ClipWindowY2;
      }
    case 0x32u:
      return loResScrollX;
    case 0x33u:
      return loResScrollY;
    case 0x69u:
      return
        (layer2Enabled != 0u ? 0x80u : 0x00u) |
        (useShadowScreen != 0u ? 0x40u : 0x00u) |
        (timexPortValue & 0x3fu);
    case 0x6au:
      return
        (loResRadastanMode != 0u ? 0x20u : 0x00u) |
        (loResRadastanTimexXor != 0u ? 0x10u : 0x00u) |
        (loResPaletteOffset & 0x0fu);
    case 0x70u:
      return ((uint32_t)(layer2Resolution & 0x03u) << 4u) | (layer2PaletteOffset & 0x0fu);
    case 0x71u:
      return (layer2ScrollX >> 8u) & 0x01u;
    default:
      return 0xffffffffu;
  }
}

static uint32_t layer2WriteNextReg(uint32_t reg, uint32_t value) {
  const uint8_t byteValue = (uint8_t)(value & 0xffu);
  switch (reg & 0xffu) {
    case 0x12u:
      layer2ActiveRamBank = byteValue & 0x7fu;
      return 1u;
    case 0x13u:
      layer2ShadowRamBank = byteValue & 0x7fu;
      return 1u;
    case 0x14u:
      globalTransparencyColor = byteValue;
      return 1u;
    case 0x15u:
      loResEnabled = (byteValue & 0x80u) != 0u;
      layerPriority = (byteValue >> 2u) & 0x07u;
      return 0u;
    case 0x16u:
      layer2ScrollX = (layer2ScrollX & 0x100u) | byteValue;
      return 1u;
    case 0x17u:
      layer2ScrollY = byteValue;
      return 1u;
    case 0x18u:
      switch (layer2ClipIndex & 0x03u) {
        case 0: layer2ClipWindowX1 = byteValue; break;
        case 1: layer2ClipWindowX2 = byteValue; break;
        case 2: layer2ClipWindowY1 = byteValue; break;
        default: layer2ClipWindowY2 = byteValue; break;
      }
      layer2ClipIndex = (uint8_t)((layer2ClipIndex + 1u) & 0x03u);
      return 1u;
    case 0x4au:
      fallbackColor = byteValue;
      return 1u;
    case 0x1cu:
      if ((byteValue & 0x01u) != 0u) layer2ClipIndex = 0u;
      return 0u;
    case 0x32u:
      loResScrollX = byteValue;
      return 1u;
    case 0x33u:
      loResScrollY = byteValue;
      return 1u;
    case 0x69u:
      layer2Enabled = (byteValue & 0x80u) != 0u;
      useShadowScreen = (byteValue & 0x40u) != 0u;
      timexPortValue = byteValue & 0x3fu;
      timexPortBits = timexPortValue;
      return 1u;
    case 0x6au:
      loResRadastanMode = (byteValue & 0x20u) != 0u;
      loResRadastanTimexXor = (byteValue & 0x10u) != 0u;
      loResPaletteOffset = byteValue & 0x0fu;
      return 1u;
    case 0x70u:
      layer2Resolution = (byteValue >> 4u) & 0x03u;
      layer2PaletteOffset = byteValue & 0x0fu;
      return 1u;
    case 0x71u:
      layer2ScrollX = (layer2ScrollX & 0xffu) | ((byteValue & 0x01u) << 8u);
      return 1u;
    default:
      return 0u;
  }
}

static uint32_t layer2MappedOffset(uint32_t address, uint32_t isWrite) {
  const uint32_t mappingEnabled = isWrite != 0u ? layer2EnableMappingForWrites : layer2EnableMappingForReads;
  if (mappingEnabled == 0u) return ZXNEXT_INVALID_PAGE_OFFSET;

  const uint32_t maskedAddress = address & 0xffffu;
  const uint32_t mapSegment = layer2Bank & 0x03u;
  const uint32_t startAddr = mapSegment == 3u ? 0u : mapSegment << 14u;
  const uint32_t endAddr = mapSegment == 3u ? 0xc000u : (mapSegment + 1u) << 14u;
  if (maskedAddress < startAddr || maskedAddress >= endAddr) return ZXNEXT_INVALID_PAGE_OFFSET;

  const uint32_t regionStart = maskedAddress & ~0x1fffu;
  const uint32_t half = (maskedAddress >> 13u) & 0x01u;
  const uint32_t offsetPre = mapSegment == 3u ? ((maskedAddress >> 14u) & 0x03u) : mapSegment;
  const uint32_t activeBank = layer2UseShadowBank != 0u ? layer2ShadowRamBank : layer2ActiveRamBank;
  const uint32_t activeBankOffset = (offsetPre + layer2BankOffset) & 0x07u;
  const uint32_t pageBits7_1 = (activeBank + activeBankOffset) & 0x7fu;
  const uint32_t activePage = (pageBits7_1 << 1u) | half;
  const uint32_t upperNibble = (0x01u + ((activePage >> 5u) & 0x07u)) & 0x0fu;
  const uint32_t lowerBits = activePage & 0x1fu;
  const uint32_t a21A13 = (upperNibble << 5u) | lowerBits;
  if ((a21A13 & 0x100u) != 0u) return ZXNEXT_INVALID_PAGE_OFFSET;
  return ZXNEXT_NEXT_RAM_OFFSET + ((a21A13 & 0xffu) << 13u) + (maskedAddress - regionStart);
}

static uint32_t zxnextReadLayer2Port123b(void) {
  return
    ((uint32_t)(layer2Bank & 0x03u) << 6u) |
    (layer2UseShadowBank != 0u ? 0x08u : 0x00u) |
    (layer2EnableMappingForReads != 0u ? 0x04u : 0x00u) |
    (layer2Enabled != 0u ? 0x02u : 0x00u) |
    (layer2EnableMappingForWrites != 0u ? 0x01u : 0x00u);
}

static void zxnextWriteLayer2Port123b(uint32_t value) {
  const uint8_t byteValue = (uint8_t)(value & 0xffu);
  if ((byteValue & 0x10u) == 0u) {
    layer2Bank = (byteValue >> 6u) & 0x03u;
    layer2UseShadowBank = (byteValue & 0x08u) != 0u;
    layer2EnableMappingForReads = (byteValue & 0x04u) != 0u;
    layer2Enabled = (byteValue & 0x02u) != 0u;
    layer2EnableMappingForWrites = (byteValue & 0x01u) != 0u;
  } else {
    layer2BankOffset = byteValue & 0x07u;
  }
}

static uint32_t layer2PackedPalettePixel(uint32_t paletteIndex) {
  const uint32_t palette = paletteSecondLayer2 != 0u ? 5u : 1u;
  const uint32_t entry = paletteEntries[palette][paletteIndex & 0xffu];
  return zxnextPackLayerPixel(entry & 0x1ffu, entry & 0x200u);
}

static uint32_t zxnextGetLayer2PixelInfo(uint32_t displayHc, uint32_t displayVc, uint32_t phase) {
  if (layer2Enabled == 0u) return 0u;
  const uint32_t bank16k = layer2UseShadowBank != 0u ? layer2ShadowRamBank : layer2ActiveRamBank;
  const uint32_t bankBase = ZXNEXT_NEXT_RAM_OFFSET + bank16k * 0x4000u;
  if (layer2Resolution == 1u || layer2Resolution == 2u) {
    const uint32_t wideX = displayHc + 32u;
    const uint32_t wideY = displayVc + 32u;
    if (wideX >= 320u || wideY >= 256u) return 0u;
    if (wideY < layer2ClipWindowY1 || wideY > layer2ClipWindowY2) return 0u;
    const uint32_t clipX = layer2Resolution == 2u ? (wideX >> 1u) : wideX;
    if (clipX < layer2ClipWindowX1 || clipX > layer2ClipWindowX2) return 0u;
    const uint32_t x = layer2WrapWide(wideX + layer2ScrollX);
    const uint32_t y = (wideY + layer2ScrollY) & 0xffu;
    const uint8_t rawPixel = (uint8_t)readPhysical(bankBase + ((x & 0x1ffu) << 8u) + y);
    uint32_t paletteIndex;
    if (layer2Resolution == 2u) {
      const uint32_t nibble = (phase & 0x01u) == 0u ? (rawPixel >> 4u) : (rawPixel & 0x0fu);
      paletteIndex = ((uint32_t)(layer2PaletteOffset & 0x0fu) << 4u) | nibble;
    } else {
      paletteIndex = ((((rawPixel >> 4u) + (layer2PaletteOffset & 0x0fu)) & 0x0fu) << 4u) |
        (rawPixel & 0x0fu);
    }
    if ((paletteIndex & 0xffu) == globalTransparencyColor) return 0u;
    return layer2PackedPalettePixel(paletteIndex);
  }

  if (displayVc > layer2ClipWindowY2 || displayVc < layer2ClipWindowY1) return 0u;
  if (displayHc > layer2ClipWindowX2 || displayHc < layer2ClipWindowX1) return 0u;
  const uint32_t x = (displayHc + layer2ScrollX) & 0xffu;
  const uint32_t y = layer2WrapY256(displayVc + layer2ScrollY);
  const uint8_t rawPixel = (uint8_t)readPhysical(bankBase + (y << 8u) + x);
  const uint32_t paletteIndex =
    ((((rawPixel >> 4u) + (layer2PaletteOffset & 0x0fu)) & 0x0fu) << 4u) |
    (rawPixel & 0x0fu);
  if ((paletteIndex & 0xffu) == globalTransparencyColor) return 0u;
  return layer2PackedPalettePixel(paletteIndex);
}

static uint32_t zxnextGetLayer2PixelBgra(uint32_t displayHc, uint32_t displayVc, uint32_t phase) {
  return zxnextLayerPixelBgra(zxnextGetLayer2PixelInfo(displayHc, displayVc, phase));
}

static uint32_t zxnextGetLoResPixelInfo(uint32_t displayHc, uint32_t displayVc, uint32_t phase) {
  if (loResEnabled == 0u || displayHc >= 256u || displayVc >= 192u) return 0u;
  const uint32_t bankBase = ZXNEXT_NEXT_RAM_OFFSET + 5u * 0x4000u;
  if (loResRadastanMode != 0u) {
    const uint32_t logicalX = (displayHc + phase + loResScrollX) & 0xffu;
    const uint32_t logicalY = ((displayVc >> 1u) + loResScrollY) & 0xffu;
    const uint32_t byteX = (logicalX >> 2u) & 0x3fu;
    const uint32_t dfile = ((timexPortValue & 0x01u) != 0u) ^ (loResRadastanTimexXor != 0u);
    const uint8_t rawPixel = (uint8_t)readPhysical(bankBase + (dfile != 0u ? 0x2000u : 0u) + ((logicalY & 0x7fu) << 6u) + byteX);
    const uint32_t nibble = (logicalX & 0x02u) == 0u ? (rawPixel >> 4u) : (rawPixel & 0x0fu);
    const uint32_t paletteIndex = ulaPlusEnabled != 0u && paletteEnableUlaNextMode == 0u
      ? 0xc0u | ((uint32_t)(loResPaletteOffset & 0x03u) << 4u) | nibble
      : ((uint32_t)(loResPaletteOffset & 0x0fu) << 4u) | nibble;
    const uint32_t palette = paletteSecondUla != 0u ? 4u : 0u;
    return zxnextPackLayerPixel(paletteEntries[palette][paletteIndex & 0xffu] & 0x1ffu, 0u);
  }

  const uint32_t logicalX = ((displayHc >> 1u) + loResScrollX) & 0x7fu;
  const uint32_t logicalY = ((displayVc >> 1u) + loResScrollY) & 0x7fu;
  uint32_t offset = (logicalY << 7u) | logicalX;
  if (logicalY >= 48u) offset += 0x0800u;
  const uint8_t paletteIndex = (uint8_t)readPhysical(bankBase + offset);
  const uint32_t palette = paletteSecondUla != 0u ? 4u : 0u;
  return zxnextPackLayerPixel(paletteEntries[palette][paletteIndex] & 0x1ffu, 0u);
}

static uint32_t zxnextGetLoResPixelBgra(uint32_t displayHc, uint32_t displayVc, uint32_t phase) {
  return zxnextLayerPixelBgra(zxnextGetLoResPixelInfo(displayHc, displayVc, phase));
}

uint32_t zxnextGetLayer2Enabled(void) { return layer2Enabled; }
uint32_t zxnextGetLayer2Resolution(void) { return layer2Resolution; }
uint32_t zxnextGetLayer2PaletteOffset(void) { return layer2PaletteOffset; }
uint32_t zxnextGetLayer2ScrollX(void) { return layer2ScrollX; }
uint32_t zxnextGetLayer2ScrollY(void) { return layer2ScrollY; }
uint32_t zxnextGetLayer2ClipWindowX1(void) { return layer2ClipWindowX1; }
uint32_t zxnextGetLayer2ClipWindowX2(void) { return layer2ClipWindowX2; }
uint32_t zxnextGetLayer2ClipWindowY1(void) { return layer2ClipWindowY1; }
uint32_t zxnextGetLayer2ClipWindowY2(void) { return layer2ClipWindowY2; }
uint32_t zxnextGetLayer2ClipIndex(void) { return layer2ClipIndex; }
uint32_t zxnextGetLayer2ActiveRamBank(void) { return layer2ActiveRamBank; }
uint32_t zxnextGetLayer2ShadowRamBank(void) { return layer2ShadowRamBank; }
uint32_t zxnextGetLayer2UseShadowBank(void) { return layer2UseShadowBank; }
uint32_t zxnextGetLayer2Bank(void) { return layer2Bank; }
uint32_t zxnextGetLayer2BankOffset(void) { return layer2BankOffset; }
uint32_t zxnextGetLayer2MappingReadsEnabled(void) { return layer2EnableMappingForReads; }
uint32_t zxnextGetLayer2MappingWritesEnabled(void) { return layer2EnableMappingForWrites; }
uint32_t zxnextGetGlobalTransparencyColor(void) { return globalTransparencyColor; }
uint32_t zxnextGetLayerPriority(void) { return layerPriority; }
uint32_t zxnextGetFallbackColor(void) { return fallbackColor; }
uint32_t zxnextGetLoResEnabled(void) { return loResEnabled; }
uint32_t zxnextGetLoResRadastanMode(void) { return loResRadastanMode; }
uint32_t zxnextGetLoResRadastanTimexXor(void) { return loResRadastanTimexXor; }
uint32_t zxnextGetLoResPaletteOffset(void) { return loResPaletteOffset; }
uint32_t zxnextGetLoResScrollX(void) { return loResScrollX; }
uint32_t zxnextGetLoResScrollY(void) { return loResScrollY; }
uint32_t zxnextGetLayer2MappedOffset(uint32_t address, uint32_t isWrite) {
  return layer2MappedOffset(address, isWrite);
}
