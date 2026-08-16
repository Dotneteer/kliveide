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

static const uint16_t defaultUlaColors[16] = {
  0x000u, 0x005u, 0x140u, 0x145u, 0x028u, 0x02du, 0x168u, 0x16du,
  0x000u, 0x007u, 0x1c0u, 0x1cfu, 0x038u, 0x03fu, 0x1f8u, 0x1ffu
};

static uint32_t ulaLevel(uint32_t value) {
  static const uint8_t levels[8] = { 0, 36, 73, 109, 146, 182, 219, 255 };
  return levels[value & 0x07u];
}

static uint32_t bgraFromRgb333(uint32_t rgb333) {
  return 0xff000000u |
    (ulaLevel(rgb333 & 0x07u) << 16u) |
    (ulaLevel((rgb333 >> 3u) & 0x07u) << 8u) |
    ulaLevel((rgb333 >> 6u) & 0x07u);
}

static uint32_t defaultUlaPaletteBgra(uint32_t index) {
  return bgraFromRgb333(defaultUlaColors[index & 0x0fu]);
}

static uint32_t screenMemoryOffset(uint32_t y, uint32_t byteX) {
  return ((y & 0xc0u) << 5u) + ((y & 0x07u) << 8u) + ((y & 0x38u) << 2u) + byteX;
}

static uint32_t screenBankBase(void) {
  return ZXNEXT_NEXT_RAM_OFFSET + (useShadowScreen != 0u ? 7u : 5u) * 0x4000u;
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
  const uint32_t borderPixel = defaultUlaPaletteBgra(16u + (ulaBorderColor & 0x07u));
  for (uint32_t i = 0; i < ZXNEXT_SCREEN_WIDTH * ZXNEXT_SCREEN_HEIGHT; i++) pixelBuffer[i] = 0x00000000u;
  screenNonBlankPixelCount = 0;

  uint8_t *flagTable = activeUlaRenderingFlags();
  uint16_t *hcTable = activeUlaHcTable();
  uint16_t *vcTable = activeUlaVcTable();
  int32_t *bitmapOffsetTable = activeUlaBitmapOffsetTable();
  const uint32_t displayYStart = screenIs60Hz != 0u ? ZXNEXT_60HZ_DISPLAY_Y_START : ZXNEXT_50HZ_DISPLAY_Y_START;

  for (uint32_t tact = 0; tact < screenRenderingTacts; tact++) {
    const uint8_t flags = flagTable[tact];
    const int32_t bitmapOffset = bitmapOffsetTable[tact];
    if (flags == 0u || bitmapOffset < 0) continue;

    uint32_t pixel = borderPixel;
    if ((flags & SCR_DISPLAY_AREA) != 0u) {
      const uint32_t displayHc = (uint32_t)hcTable[tact] - ZXNEXT_50HZ_DISPLAY_X_START;
      const uint32_t displayVc = (uint32_t)vcTable[tact] - displayYStart;
      const uint32_t byteX = displayHc >> 3u;
      const uint32_t bit = displayHc & 0x07u;
      const uint8_t pixelByte = (uint8_t)zxnextReadScreenMemoryOffset(screenMemoryOffset(displayVc, byteX));
      const uint8_t attrByte = (uint8_t)zxnextReadScreenMemoryOffset(0x1800u + (displayVc >> 3u) * 32u + byteX);
      const uint32_t bright = (attrByte & 0x40u) != 0u ? 8u : 0u;
      const uint32_t ink = bright + (attrByte & 0x07u);
      const uint32_t paper = 16u + bright + ((attrByte >> 3u) & 0x07u);
      const uint32_t paletteIndex = (pixelByte & (0x80u >> bit)) != 0u ? ink : paper;
      pixel = defaultUlaPaletteBgra(paletteIndex);
    }
    pixelBuffer[(uint32_t)bitmapOffset] = pixel;
    pixelBuffer[(uint32_t)bitmapOffset + 1u] = pixel;
    if (pixel != 0u) screenNonBlankPixelCount += 2u;
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
