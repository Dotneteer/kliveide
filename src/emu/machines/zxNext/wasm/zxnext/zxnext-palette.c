#include "zxnext.h"

static const uint16_t paletteDefaultUlaColors[16] = {
  0x000u, 0x005u, 0x140u, 0x145u, 0x028u, 0x02du, 0x168u, 0x16du,
  0x000u, 0x007u, 0x1c0u, 0x1cfu, 0x038u, 0x03fu, 0x1f8u, 0x1ffu
};

static uint32_t paletteLevel(uint32_t value) {
  static const uint8_t levels[8] = { 0, 36, 73, 109, 146, 182, 219, 255 };
  return levels[value & 0x07u];
}

static uint32_t paletteBgraFromRgb333(uint32_t rgb333) {
  return 0xff000000u |
    (paletteLevel(rgb333 & 0x07u) << 16u) |
    (paletteLevel((rgb333 >> 3u) & 0x07u) << 8u) |
    paletteLevel((rgb333 >> 6u) & 0x07u);
}

static uint32_t zxnextPackLayerPixel(uint32_t rgb333, uint32_t priority) {
  return ZXNEXT_LAYER_PIXEL_VALID |
    (priority != 0u ? ZXNEXT_LAYER_PIXEL_PRIORITY : 0u) |
    (rgb333 & ZXNEXT_LAYER_PIXEL_RGB_MASK);
}

static uint32_t zxnextLayerPixelBgra(uint32_t pixelInfo) {
  if ((pixelInfo & ZXNEXT_LAYER_PIXEL_VALID) == 0u) return 0u;
  return paletteBgraFromRgb333(pixelInfo & ZXNEXT_LAYER_PIXEL_RGB_MASK);
}

static uint32_t zxnextUlaPaletteRgb333(uint32_t index) {
  const uint32_t palette = paletteSecondUla != 0u ? 4u : 0u;
  return paletteEntries[palette][index & 0xffu] & 0x1ffu;
}

static uint16_t *currentPaletteEntries(void) {
  return paletteEntries[paletteSelected & 0x07u];
}

static void resetPaletteState(void) {
  paletteIndex = 0u;
  paletteDisableAutoInc = 0u;
  paletteSelected = 0u;
  paletteSecondSprite = 0u;
  paletteSecondLayer2 = 0u;
  paletteSecondUla = 0u;
  paletteSecondTilemap = 0u;
  paletteEnableUlaNextMode = 0u;
  paletteSecondWrite = 0u;
  paletteStoredValue = 0u;
  timexPortValue = 0u;
  timexPortBits = 0u;
  ulaPlusMode = 0u;
  ulaPlusPaletteIndex = 0u;
  ulaPlusEnabled = 0u;
  for (uint32_t i = 0; i < 256u; i++) {
    const uint16_t color = (uint16_t)((i << 1u) | ((i & 0x02u) != 0u ? 1u : 0u));
    paletteEntries[1][i] = color;
    paletteEntries[2][i] = color;
    paletteEntries[3][i] = color;
    paletteEntries[5][i] = color;
    paletteEntries[6][i] = color;
    paletteEntries[7][i] = color;
  }
  for (uint32_t j = 0; j < 16u; j++) {
    for (uint32_t i = 0; i < 16u; i++) {
      const uint32_t idx = j * 16u + i;
      const uint16_t color = i != 11u ? paletteDefaultUlaColors[i] : 0x1cfu;
      paletteEntries[0][idx] = color;
      paletteEntries[4][idx] = color;
    }
  }
}

static uint32_t paletteReadNextReg(uint32_t reg) {
  switch (reg & 0xffu) {
    case 0x28u:
      return paletteStoredValue;
    case 0x40u:
      return paletteIndex;
    case 0x41u:
      return currentPaletteEntries()[paletteIndex] >> 1u;
    case 0x43u:
      return
        (paletteDisableAutoInc != 0u ? 0x80u : 0x00u) |
        ((uint32_t)(paletteSelected & 0x07u) << 4u) |
        (paletteSecondSprite != 0u ? 0x08u : 0x00u) |
        (paletteSecondLayer2 != 0u ? 0x04u : 0x00u) |
        (paletteSecondUla != 0u ? 0x02u : 0x00u) |
        (paletteEnableUlaNextMode != 0u ? 0x01u : 0x00u);
    case 0x44u: {
      const uint16_t value = currentPaletteEntries()[paletteIndex];
      return
        ((value & 0x200u) != 0u ? 0x80u : 0x00u) |
        ((value & 0x400u) != 0u ? 0x40u : 0x00u) |
        (value & 0x01u);
    }
    default:
      return 0xffffffffu;
  }
}

static uint32_t paletteWriteNextReg(uint32_t reg, uint32_t value) {
  const uint8_t byteValue = (uint8_t)(value & 0xffu);
  switch (reg & 0xffu) {
    case 0x40u:
      paletteIndex = byteValue;
      paletteSecondWrite = 0u;
      return 1u;
    case 0x41u:
      currentPaletteEntries()[paletteIndex] = (uint16_t)((byteValue << 1u) | ((byteValue & 0x03u) != 0u ? 1u : 0u));
      if (paletteDisableAutoInc == 0u) paletteIndex = (paletteIndex + 1u) & 0xffu;
      paletteSecondWrite = 0u;
      return 1u;
    case 0x43u:
      paletteDisableAutoInc = (byteValue & 0x80u) != 0u;
      paletteSelected = (byteValue >> 4u) & 0x07u;
      paletteSecondSprite = (byteValue & 0x08u) != 0u;
      paletteSecondLayer2 = (byteValue & 0x04u) != 0u;
      paletteSecondUla = (byteValue & 0x02u) != 0u;
      paletteEnableUlaNextMode = (byteValue & 0x01u) != 0u;
      paletteSecondWrite = 0u;
      return 1u;
    case 0x44u: {
      uint16_t *palette = currentPaletteEntries();
      if (paletteSecondWrite == 0u) {
        paletteStoredValue = byteValue;
        palette[paletteIndex] = (uint16_t)(byteValue << 1u);
      } else {
        palette[paletteIndex] =
          (uint16_t)((palette[paletteIndex] & ~0x201u) |
          (byteValue & 0x01u) |
          ((byteValue & 0x80u) != 0u ? 0x200u : 0x00u));
        if (paletteDisableAutoInc == 0u) paletteIndex = (paletteIndex + 1u) & 0xffu;
      }
      paletteSecondWrite = paletteSecondWrite == 0u ? 1u : 0u;
      return 1u;
    }
    default:
      return 0u;
  }
}

uint32_t zxnextUlaPaletteBgra(uint32_t index) {
  return paletteBgraFromRgb333(zxnextUlaPaletteRgb333(index));
}

static uint32_t spritePaletteRgb333(uint32_t index) {
  const uint32_t palette = paletteSecondSprite != 0u ? 6u : 2u;
  return paletteEntries[palette][index & 0xffu] & 0x1ffu;
}

static uint32_t spritePaletteBgra(uint32_t index) {
  return paletteBgraFromRgb333(spritePaletteRgb333(index));
}

uint32_t zxnextGetPaletteIndex(void) { return paletteIndex; }
uint32_t zxnextGetPaletteControl(void) { return paletteReadNextReg(0x43u); }
uint32_t zxnextGetPaletteSelected(void) { return paletteSelected; }
uint32_t zxnextGetPaletteSecondUla(void) { return paletteSecondUla; }
uint32_t zxnextGetPaletteSecondSprite(void) { return paletteSecondSprite; }
uint32_t zxnextGetPaletteEnableUlaNextMode(void) { return paletteEnableUlaNextMode; }
uint32_t zxnextGetPaletteSecondWrite(void) { return paletteSecondWrite; }
uint32_t zxnextGetPaletteStoredValue(void) { return paletteStoredValue; }
uint32_t zxnextReadPaletteEntry(uint32_t palette, uint32_t index) {
  return paletteEntries[palette & 0x07u][index & 0xffu];
}

uint32_t zxnextReadUlaPlusData(void) {
  if (ulaPlusMode == 0u) {
    const uint16_t rgb333 = paletteEntries[paletteSecondUla != 0u ? 4u : 0u][192u + ulaPlusPaletteIndex] & 0x1ffu;
    const uint32_t red = (rgb333 >> 6u) & 0x07u;
    const uint32_t green = (rgb333 >> 3u) & 0x07u;
    const uint32_t blue = (rgb333 >> 1u) & 0x03u;
    return (green << 5u) | (red << 2u) | blue;
  }
  return ulaPlusEnabled != 0u ? 0x01u : 0x00u;
}

void zxnextWriteUlaPlusData(uint32_t value) {
  const uint32_t byteValue = value & 0xffu;
  if (ulaPlusMode == 0u) {
    const uint32_t green = (byteValue >> 5u) & 0x07u;
    const uint32_t red = (byteValue >> 2u) & 0x07u;
    const uint32_t blue = byteValue & 0x03u;
    const uint16_t rgb333 = (uint16_t)((red << 6u) | (green << 3u) | (blue << 1u) | (blue & 0x01u));
    paletteEntries[paletteSecondUla != 0u ? 4u : 0u][192u + ulaPlusPaletteIndex] = rgb333;
  } else if (ulaPlusMode == 1u) {
    ulaPlusEnabled = (byteValue & 0x01u) != 0u;
  }
}

uint32_t zxnextGetTimexPortValue(void) { return timexPortValue; }
uint32_t zxnextGetTimexPortBits(void) { return timexPortBits; }
uint32_t zxnextGetUlaPlusMode(void) { return ulaPlusMode; }
uint32_t zxnextGetUlaPlusPaletteIndex(void) { return ulaPlusPaletteIndex; }
uint32_t zxnextGetUlaPlusEnabled(void) { return ulaPlusEnabled; }
