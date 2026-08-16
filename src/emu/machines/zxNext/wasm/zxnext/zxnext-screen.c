#include "zxnext.h"

#define ZXNEXT_50HZ_TOTAL_HC 456u
#define ZXNEXT_50HZ_TOTAL_VC 311u
#define ZXNEXT_50HZ_DISPLAY_X_START 144u
#define ZXNEXT_50HZ_DISPLAY_Y_START 64u
#define ZXNEXT_50HZ_FIRST_VISIBLE_HC 96u
#define ZXNEXT_50HZ_FIRST_BITMAP_VC 16u
#define ZXNEXT_50HZ_INT_START 0x252u
#define ZXNEXT_50HZ_INT_END 0x272u
#define ZXNEXT_60HZ_TOTAL_HC 456u
#define ZXNEXT_60HZ_TOTAL_VC 264u
#define ZXNEXT_60HZ_DISPLAY_X_START 144u
#define ZXNEXT_60HZ_DISPLAY_Y_START 40u
#define ZXNEXT_60HZ_FIRST_VISIBLE_HC 96u
#define ZXNEXT_60HZ_FIRST_BITMAP_VC 16u
#define ZXNEXT_60HZ_INT_START 0x138u
#define ZXNEXT_60HZ_INT_END 0x158u
#define SCR_DISPLAY_AREA 0x01u
#define SCR_CONTENTION_WINDOW 0x02u
#define SCR_NREG_SAMPLE 0x04u
#define SCR_BYTE1_READ 0x08u
#define SCR_BYTE2_READ 0x10u
#define SCR_SHIFT_REG_LOAD 0x20u
#define SCR_FLOATING_BUS_UPDATE 0x40u
#define SCR_BORDER_AREA 0x80u
#define ZXNEXT_50HZ_TACTS (ZXNEXT_50HZ_TOTAL_HC * ZXNEXT_50HZ_TOTAL_VC)
#define ZXNEXT_60HZ_TACTS (ZXNEXT_60HZ_TOTAL_HC * ZXNEXT_60HZ_TOTAL_VC)

static uint8_t screenIs60Hz = 0;
static uint32_t screenRenderingTacts = ZXNEXT_50HZ_TOTAL_HC * ZXNEXT_50HZ_TOTAL_VC;
static uint32_t screenIntStartTact = ZXNEXT_50HZ_INT_START;
static uint32_t screenIntEndTact = ZXNEXT_50HZ_INT_END;
static uint32_t screenRenderCount = 0;
static uint32_t screenNonBlankPixelCount = 0;
static uint8_t screenTablesInitialized = 0;
static uint16_t ulaTactToHc50Hz[ZXNEXT_50HZ_TACTS];
static uint16_t ulaTactToVc50Hz[ZXNEXT_50HZ_TACTS];
static uint16_t ulaTactToHc60Hz[ZXNEXT_60HZ_TACTS];
static uint16_t ulaTactToVc60Hz[ZXNEXT_60HZ_TACTS];
static int32_t ulaTactToBitmapOffset50Hz[ZXNEXT_50HZ_TACTS];
static int32_t ulaTactToBitmapOffset60Hz[ZXNEXT_60HZ_TACTS];
static uint8_t ulaRenderingFlags50Hz[ZXNEXT_50HZ_TACTS];
static uint8_t ulaRenderingFlags60Hz[ZXNEXT_60HZ_TACTS];

static uint32_t screenMemoryOffset(uint32_t y, uint32_t byteX) {
  return ((y & 0xc0u) << 5u) + ((y & 0x07u) << 8u) + ((y & 0x38u) << 2u) + byteX;
}

static uint32_t screenBankBase(void) {
  return ZXNEXT_NEXT_RAM_OFFSET + (useShadowScreen != 0u ? 7u : 5u) * 0x4000u;
}

static uint32_t fallbackRgb333(void) {
  const uint32_t blueLsb = (fallbackColor & 0x02u) | (fallbackColor & 0x01u);
  return ((uint32_t)fallbackColor << 1u) | blueLsb;
}

static uint32_t blendRgb333Wasm(uint32_t a, uint32_t b, uint32_t mixer) {
  const uint32_t ra = (a >> 6u) & 0x07u;
  const uint32_t ga = (a >> 3u) & 0x07u;
  const uint32_t ba = a & 0x07u;
  const uint32_t rb = (b >> 6u) & 0x07u;
  const uint32_t gb = (b >> 3u) & 0x07u;
  const uint32_t bb = b & 0x07u;
  uint32_t r;
  uint32_t g;
  uint32_t bl;
  if (mixer == 0u) {
    r = ra + rb;
    g = ga + gb;
    bl = ba + bb;
    if (r > 7u) r = 7u;
    if (g > 7u) g = 7u;
    if (bl > 7u) bl = 7u;
  } else {
    r = ra + rb;
    g = ga + gb;
    bl = ba + bb;
    r = r <= 5u ? 0u : r - 5u;
    g = g <= 5u ? 0u : g - 5u;
    bl = bl <= 5u ? 0u : bl - 5u;
    if (r > 7u) r = 7u;
    if (g > 7u) g = 7u;
    if (bl > 7u) bl = 7u;
  }
  return (r << 6u) | (g << 3u) | bl;
}

static uint32_t composeLayerPixelBgra(uint32_t ulaInfo, uint32_t layer2Info, uint32_t spriteInfo) {
  const uint32_t hasUla = (ulaInfo & ZXNEXT_LAYER_PIXEL_VALID) != 0u;
  const uint32_t hasLayer2 = (layer2Info & ZXNEXT_LAYER_PIXEL_VALID) != 0u;
  const uint32_t hasSprite = (spriteInfo & ZXNEXT_LAYER_PIXEL_VALID) != 0u;
  const uint32_t layer2PriorityBit = (layer2Info & ZXNEXT_LAYER_PIXEL_PRIORITY) != 0u;
  uint32_t selectedInfo = 0u;

  if (hasLayer2 != 0u && layer2PriorityBit != 0u && layerPriority < 6u) {
    selectedInfo = layer2Info;
  } else if (layerPriority >= 6u) {
    if (layer2PriorityBit != 0u && hasLayer2 != 0u) {
      const uint32_t rgb = hasUla != 0u
        ? blendRgb333Wasm(ulaInfo & ZXNEXT_LAYER_PIXEL_RGB_MASK, layer2Info & ZXNEXT_LAYER_PIXEL_RGB_MASK, layerPriority & 1u)
        : (layer2Info & ZXNEXT_LAYER_PIXEL_RGB_MASK);
      selectedInfo = zxnextPackLayerPixel(rgb, 0u);
    } else if (hasSprite != 0u) {
      selectedInfo = spriteInfo;
    } else if (hasUla != 0u && hasLayer2 != 0u) {
      selectedInfo = zxnextPackLayerPixel(
        blendRgb333Wasm(ulaInfo & ZXNEXT_LAYER_PIXEL_RGB_MASK, layer2Info & ZXNEXT_LAYER_PIXEL_RGB_MASK, layerPriority & 1u),
        0u
      );
    } else if (hasLayer2 != 0u) {
      selectedInfo = layer2Info;
    } else if (hasUla != 0u) {
      selectedInfo = ulaInfo;
    }
  } else {
    switch (layerPriority) {
      case 0u:
        selectedInfo = hasSprite != 0u ? spriteInfo : (hasLayer2 != 0u ? layer2Info : ulaInfo);
        break;
      case 1u:
        selectedInfo = hasLayer2 != 0u ? layer2Info : (hasSprite != 0u ? spriteInfo : ulaInfo);
        break;
      case 2u:
        selectedInfo = hasSprite != 0u ? spriteInfo : (hasUla != 0u ? ulaInfo : layer2Info);
        break;
      case 3u:
        selectedInfo = hasLayer2 != 0u ? layer2Info : (hasUla != 0u ? ulaInfo : spriteInfo);
        break;
      case 4u:
        selectedInfo = hasUla != 0u ? ulaInfo : (hasSprite != 0u ? spriteInfo : layer2Info);
        break;
      default:
        selectedInfo = hasUla != 0u ? ulaInfo : (hasLayer2 != 0u ? layer2Info : spriteInfo);
        break;
    }
  }

  if ((selectedInfo & ZXNEXT_LAYER_PIXEL_VALID) == 0u) {
    selectedInfo = zxnextPackLayerPixel(fallbackRgb333(), 0u);
  }
  return zxnextLayerPixelBgra(selectedInfo);
}

static uint32_t isDisplayAreaForConfig(uint32_t is60Hz, uint32_t vc, uint32_t hc) {
  const uint32_t displayYStart = is60Hz != 0u ? ZXNEXT_60HZ_DISPLAY_Y_START : ZXNEXT_50HZ_DISPLAY_Y_START;
  const uint32_t displayYEnd = is60Hz != 0u ? 0xe7u : 0xffu;
  return hc >= ZXNEXT_50HZ_DISPLAY_X_START &&
    hc <= 0x18fu &&
    vc >= displayYStart &&
    vc <= displayYEnd;
}

static uint32_t isVisibleAreaForConfig(uint32_t is60Hz, uint32_t vc, uint32_t hc) {
  const uint32_t lastBitmapVc = is60Hz != 0u ? 0xffu : 0x12fu;
  return hc >= ZXNEXT_50HZ_FIRST_VISIBLE_HC &&
    hc <= 0x1c7u &&
    vc >= ZXNEXT_50HZ_FIRST_BITMAP_VC &&
    vc <= lastBitmapVc;
}

static uint32_t isContentionWindow(uint32_t hc, uint32_t displayArea) {
  if (displayArea == 0u) return 0u;
  const uint32_t hcAdj = ((hc & 0x0fu) + 1u) & 0x0fu;
  const uint32_t hcAdj32 = (hcAdj >> 2u) & 0x03u;
  const uint32_t hcAdj31 = (hcAdj >> 1u) & 0x07u;
  return hcAdj32 != 0u || hcAdj31 == 0u;
}

static uint8_t generateUlaRenderingFlag(uint32_t is60Hz, uint32_t vc, uint32_t hc) {
  if (isVisibleAreaForConfig(is60Hz, vc, hc) == 0u) return 0u;

  uint8_t flags = 0u;
  const uint32_t displayArea = isDisplayAreaForConfig(is60Hz, vc, hc);
  if (displayArea != 0u) {
    flags |= SCR_DISPLAY_AREA;
  } else {
    flags |= SCR_BORDER_AREA;
  }

  if (isContentionWindow(hc, displayArea) != 0u) {
    flags |= SCR_CONTENTION_WINDOW;
  }

  const uint32_t displayYStart = is60Hz != 0u ? ZXNEXT_60HZ_DISPLAY_Y_START : ZXNEXT_50HZ_DISPLAY_Y_START;
  const uint32_t displayYEnd = is60Hz != 0u ? 0xe7u : 0xffu;
  const uint32_t fetchActive =
    vc >= displayYStart &&
    vc <= displayYEnd &&
    hc >= ZXNEXT_50HZ_DISPLAY_X_START - 16u &&
    hc <= 0x18fu;
  const uint32_t hcSub = hc & 0x0fu;

  if (fetchActive != 0u && (hcSub == 0x07u || hcSub == 0x0fu)) {
    flags |= SCR_NREG_SAMPLE;
  }
  if (fetchActive != 0u && (hcSub == 0x00u || hcSub == 0x04u || hcSub == 0x08u || hcSub == 0x0cu)) {
    flags |= SCR_BYTE1_READ;
  }
  if (fetchActive != 0u && (hcSub == 0x02u || hcSub == 0x06u || hcSub == 0x0au || hcSub == 0x0eu)) {
    flags |= SCR_BYTE2_READ;
  }
  if (fetchActive != 0u && (hcSub == 0x00u || hcSub == 0x08u)) {
    flags |= SCR_SHIFT_REG_LOAD;
  }
  if (displayArea != 0u && (hcSub == 0x05u || hcSub == 0x07u || hcSub == 0x09u || hcSub == 0x0bu)) {
    flags |= SCR_FLOATING_BUS_UPDATE;
  }
  return flags;
}

static void initializeScreenRenderingTable(
  uint32_t is60Hz,
  uint32_t totalTacts,
  uint32_t totalHc,
  uint32_t firstVisibleHc,
  uint32_t firstBitmapVc,
  uint16_t *hcTable,
  uint16_t *vcTable,
  int32_t *bitmapOffsetTable,
  uint8_t *flagTable
) {
  for (uint32_t tact = 0; tact < totalTacts; tact++) {
    const uint32_t hc = tact % totalHc;
    const uint32_t vc = tact / totalHc;
    hcTable[tact] = (uint16_t)hc;
    vcTable[tact] = (uint16_t)vc;
    const int32_t bitmapY = (int32_t)vc - (int32_t)firstBitmapVc;
    if (bitmapY >= 0 && bitmapY < (int32_t)ZXNEXT_SCREEN_HEIGHT) {
      const int32_t bitmapXBase = ((int32_t)hc - (int32_t)firstVisibleHc) * 2;
      bitmapOffsetTable[tact] = bitmapY * (int32_t)ZXNEXT_SCREEN_WIDTH + bitmapXBase;
    } else {
      bitmapOffsetTable[tact] = -1;
    }
    flagTable[tact] = generateUlaRenderingFlag(is60Hz, vc, hc);
  }
}

static void initializeScreenRenderingTables(void) {
  if (screenTablesInitialized != 0u) return;
  initializeScreenRenderingTable(
    0u,
    ZXNEXT_50HZ_TACTS,
    ZXNEXT_50HZ_TOTAL_HC,
    ZXNEXT_50HZ_FIRST_VISIBLE_HC,
    ZXNEXT_50HZ_FIRST_BITMAP_VC,
    ulaTactToHc50Hz,
    ulaTactToVc50Hz,
    ulaTactToBitmapOffset50Hz,
    ulaRenderingFlags50Hz
  );
  initializeScreenRenderingTable(
    1u,
    ZXNEXT_60HZ_TACTS,
    ZXNEXT_60HZ_TOTAL_HC,
    ZXNEXT_60HZ_FIRST_VISIBLE_HC,
    ZXNEXT_60HZ_FIRST_BITMAP_VC,
    ulaTactToHc60Hz,
    ulaTactToVc60Hz,
    ulaTactToBitmapOffset60Hz,
    ulaRenderingFlags60Hz
  );
  screenTablesInitialized = 1u;
}

static uint8_t *activeUlaRenderingFlags(void) {
  return screenIs60Hz != 0u ? ulaRenderingFlags60Hz : ulaRenderingFlags50Hz;
}

static uint16_t *activeUlaHcTable(void) {
  return screenIs60Hz != 0u ? ulaTactToHc60Hz : ulaTactToHc50Hz;
}

static uint16_t *activeUlaVcTable(void) {
  return screenIs60Hz != 0u ? ulaTactToVc60Hz : ulaTactToVc50Hz;
}

static int32_t *activeUlaBitmapOffsetTable(void) {
  return screenIs60Hz != 0u ? ulaTactToBitmapOffset60Hz : ulaTactToBitmapOffset50Hz;
}

static void resetScreenState(void) {
  initializeScreenRenderingTables();
  for (uint32_t i = 0; i < ZXNEXT_SCREEN_WIDTH * ZXNEXT_SCREEN_HEIGHT; i++) pixelBuffer[i] = 0x00000000u;
  screenRenderCount = 0;
  screenNonBlankPixelCount = 0;
  updateScreenTimingFromNextRegs();
}

static void updateScreenTimingFromNextRegs(void) {
  screenIs60Hz = (nextRegs[0x05] & 0x04u) != 0u;
  if (screenIs60Hz != 0u) {
    screenRenderingTacts = ZXNEXT_60HZ_TOTAL_HC * ZXNEXT_60HZ_TOTAL_VC;
    screenIntStartTact = ZXNEXT_60HZ_INT_START;
    screenIntEndTact = ZXNEXT_60HZ_INT_END;
  } else {
    screenRenderingTacts = ZXNEXT_50HZ_TOTAL_HC * ZXNEXT_50HZ_TOTAL_VC;
    screenIntStartTact = ZXNEXT_50HZ_INT_START;
    screenIntEndTact = ZXNEXT_50HZ_INT_END;
  }
}

uint32_t zxnextReadScreenMemoryOffset(uint32_t offset) {
  return readPhysical(screenBankBase() + (offset & 0x3fffu));
}

uint32_t zxnextRenderInstantScreen(void) {
  initializeScreenRenderingTables();
  updateScreenTimingFromNextRegs();
  const uint32_t borderPixel = zxnextUlaPaletteBgra(16u + (ulaBorderColor & 0x07u));
  for (uint32_t i = 0; i < ZXNEXT_SCREEN_WIDTH * ZXNEXT_SCREEN_HEIGHT; i++) pixelBuffer[i] = 0x00000000u;
  screenNonBlankPixelCount = 0;

  uint8_t *flagTable = activeUlaRenderingFlags();
  uint16_t *hcTable = activeUlaHcTable();
  uint16_t *vcTable = activeUlaVcTable();
  int32_t *bitmapOffsetTable = activeUlaBitmapOffsetTable();
  const uint32_t displayYStart = screenIs60Hz != 0u ? ZXNEXT_60HZ_DISPLAY_Y_START : ZXNEXT_50HZ_DISPLAY_Y_START;

  for (uint32_t tact = 0; tact < screenRenderingTacts; tact++) {
    zxnextCopperExecuteTick(vcTable[tact], hcTable[tact]);
    const uint8_t flags = flagTable[tact];
    const int32_t bitmapOffset = bitmapOffsetTable[tact];
    if (flags == 0u || bitmapOffset < 0) continue;

    uint32_t pixel1 = borderPixel;
    uint32_t pixel2 = borderPixel;
    if ((flags & SCR_DISPLAY_AREA) != 0u) {
      const uint32_t displayHc = (uint32_t)hcTable[tact] - ZXNEXT_50HZ_DISPLAY_X_START;
      const uint32_t displayVc = (uint32_t)vcTable[tact] - displayYStart;
      uint32_t ulaInfo1;
      uint32_t ulaInfo2;
      if (loResEnabled != 0u) {
        ulaInfo1 = zxnextGetLoResPixelInfo(displayHc, displayVc, 0u);
        ulaInfo2 = zxnextGetLoResPixelInfo(displayHc, displayVc, 1u);
      } else {
        const uint32_t byteX = displayHc >> 3u;
        const uint32_t bit = displayHc & 0x07u;
        const uint8_t pixelByte = (uint8_t)zxnextReadScreenMemoryOffset(screenMemoryOffset(displayVc, byteX));
        const uint8_t attrByte = (uint8_t)zxnextReadScreenMemoryOffset(0x1800u + (displayVc >> 3u) * 32u + byteX);
        const uint32_t bright = (attrByte & 0x40u) != 0u ? 8u : 0u;
        const uint32_t ink = bright + (attrByte & 0x07u);
        const uint32_t paper = 16u + bright + ((attrByte >> 3u) & 0x07u);
        const uint32_t paletteIndex = (pixelByte & (0x80u >> bit)) != 0u ? ink : paper;
        ulaInfo1 = zxnextPackLayerPixel(zxnextUlaPaletteRgb333(paletteIndex), 0u);
        ulaInfo2 = ulaInfo1;
      }
      const uint32_t ulaTilemapInfo1 = zxnextGetTilemapPixelInfo(displayHc, displayVc, 0u, ulaInfo1);
      const uint32_t ulaTilemapInfo2 = zxnextGetTilemapPixelInfo(displayHc, displayVc, 1u, ulaInfo2);
      if ((ulaTilemapInfo1 & ZXNEXT_LAYER_PIXEL_VALID) != 0u) ulaInfo1 = ulaTilemapInfo1;
      if ((ulaTilemapInfo2 & ZXNEXT_LAYER_PIXEL_VALID) != 0u) ulaInfo2 = ulaTilemapInfo2;
      const uint32_t layer2Info1 = zxnextGetLayer2PixelInfo(displayHc, displayVc, 0u);
      const uint32_t layer2Info2 = zxnextGetLayer2PixelInfo(displayHc, displayVc, 1u);
      const uint32_t spriteInfo1 = zxnextGetSpritePixelInfo(displayHc, displayVc, 0u);
      const uint32_t spriteInfo2 = zxnextGetSpritePixelInfo(displayHc, displayVc, 1u);
      pixel1 = composeLayerPixelBgra(ulaInfo1, layer2Info1, spriteInfo1);
      pixel2 = composeLayerPixelBgra(ulaInfo2, layer2Info2, spriteInfo2);
    }
    pixelBuffer[(uint32_t)bitmapOffset] = pixel1;
    pixelBuffer[(uint32_t)bitmapOffset + 1u] = pixel2;
    if (pixel1 != 0u) screenNonBlankPixelCount++;
    if (pixel2 != 0u) screenNonBlankPixelCount++;
  }

  screenRenderCount++;
  return 1u;
}

uint32_t zxnextGetPixelBufferStartOffset(void) { return (uint32_t)(uintptr_t)pixelBuffer; }
uint32_t zxnextGetScreenRenderingTacts(void) { return screenRenderingTacts; }
uint32_t zxnextGetScreenIntStartTact(void) { return screenIntStartTact; }
uint32_t zxnextGetScreenIntEndTact(void) { return screenIntEndTact; }
uint32_t zxnextGetScreenIs60Hz(void) { return screenIs60Hz; }
uint32_t zxnextGetScreenRenderCount(void) { return screenRenderCount; }
uint32_t zxnextGetScreenNonBlankPixelCount(void) { return screenNonBlankPixelCount; }
uint32_t zxnextGetScreenBank(void) { return useShadowScreen != 0u ? 7u : 5u; }
uint32_t zxnextGetUlaRenderingFlags(uint32_t tact) {
  initializeScreenRenderingTables();
  updateScreenTimingFromNextRegs();
  if (tact >= screenRenderingTacts) return 0u;
  return activeUlaRenderingFlags()[tact];
}
uint32_t zxnextGetRenderingHc(uint32_t tact) {
  initializeScreenRenderingTables();
  updateScreenTimingFromNextRegs();
  if (tact >= screenRenderingTacts) return 0xffffffffu;
  return activeUlaHcTable()[tact];
}
uint32_t zxnextGetRenderingVc(uint32_t tact) {
  initializeScreenRenderingTables();
  updateScreenTimingFromNextRegs();
  if (tact >= screenRenderingTacts) return 0xffffffffu;
  return activeUlaVcTable()[tact];
}
uint32_t zxnextGetRenderingPixelIndex(uint32_t tact) {
  initializeScreenRenderingTables();
  updateScreenTimingFromNextRegs();
  if (tact >= screenRenderingTacts || activeUlaBitmapOffsetTable()[tact] < 0) return 0xffffffffu;
  return (uint32_t)activeUlaBitmapOffsetTable()[tact];
}
