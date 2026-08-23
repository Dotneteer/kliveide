#include "zxnext-ula.h"
#include "zxnext-keyboard.h"
#include "zxnext-layer2.h"
#include "zxnext-memory.h"
#include "zxnext-palette.h"
#include "zxnext-tape.h"
#include "zxnext-tilemap.h"

#define ZXNEXT_SCREEN_TOTAL_HC 456u
#define ZXNEXT_STANDARD_SCREEN_WIDTH 256u
#define ZXNEXT_STANDARD_SCREEN_SCALE_X 2u
#define ZXNEXT_STANDARD_SCREEN_OUTPUT_WIDTH (ZXNEXT_STANDARD_SCREEN_WIDTH * ZXNEXT_STANDARD_SCREEN_SCALE_X)
#define ZXNEXT_STANDARD_SCREEN_HEIGHT 192u
#define ZXNEXT_STANDARD_SCREEN_X ((ZXNEXT_SCREEN_WIDTH - ZXNEXT_STANDARD_SCREEN_OUTPUT_WIDTH) / 2u)
#define ZXNEXT_STANDARD_SCREEN_Y ((ZXNEXT_SCREEN_HEIGHT - ZXNEXT_STANDARD_SCREEN_HEIGHT) / 2u)
#define ZXNEXT_LAYER2_320_SCREEN_WIDTH 320u
#define ZXNEXT_LAYER2_320_SCREEN_OUTPUT_WIDTH (ZXNEXT_LAYER2_320_SCREEN_WIDTH * ZXNEXT_STANDARD_SCREEN_SCALE_X)
#define ZXNEXT_LAYER2_WIDE_SCREEN_HEIGHT 256u
#define ZXNEXT_LAYER2_WIDE_SCREEN_X 32u
#define ZXNEXT_LAYER2_WIDE_SCREEN_Y (ZXNEXT_STANDARD_SCREEN_Y - ((ZXNEXT_LAYER2_WIDE_SCREEN_HEIGHT - ZXNEXT_STANDARD_SCREEN_HEIGHT) / 2u))
#define ZXNEXT_TRANSPARENT_PIXEL 0x00000000u
#define ZXNEXT_BLANK_BORDER_PIXEL 0xffb6b6b6u
#define ZXNEXT_50HZ_INT_START_TACT 0x252u
#define ZXNEXT_50HZ_INT_END_TACT 0x272u
#define ZXNEXT_60HZ_INT_START_TACT 0x138u
#define ZXNEXT_60HZ_INT_END_TACT 0x158u
#define ZXNEXT_LAYER2_RAM_OFFSET 0x040000u
#define ZXNEXT_LORES_BANK_05_OFFSET 0x054000u
#define ZXNEXT_BANK_07_OFFSET 0x05c000u

static uint8_t ulaFlashCounter;
static uint8_t ulaFlashFlag;
static uint8_t ulaScrollX;
static uint8_t ulaScrollY;
static uint8_t ulaClipWindow[4];
static uint8_t ulaClipIndex;
static uint32_t ulaPortBit4ChangedFrom0Tacts;
static uint32_t ulaPortBit4ChangedFrom1Tacts;

static void zxnextUlaReset(void) {
  portFeValue = 0xffu;
  portTimexValue = 0u;
  borderColor = 7u;
  earBit = 0u;
  micBit = 0u;
  ulaFlashCounter = 0u;
  ulaFlashFlag = 0u;
  ulaScrollX = 0u;
  ulaScrollY = 0u;
  ulaClipWindow[0] = 0u;
  ulaClipWindow[1] = 255u;
  ulaClipWindow[2] = 0u;
  ulaClipWindow[3] = 191u;
  ulaClipIndex = 0u;
  ulaPortBit4ChangedFrom0Tacts = 0u;
  ulaPortBit4ChangedFrom1Tacts = 0u;
  for (uint32_t i = 0; i < ZXNEXT_PIXEL_COUNT; i++) {
    zxnextPixelBuffer[i] = ZXNEXT_TRANSPARENT_PIXEL;
  }
}

static inline uint32_t zxnextUlaReadPortFe(uint32_t address) {
  uint8_t portValue = (uint8_t)zxnextKeyboardReadPort(address);
  uint8_t bit4Sensed = earBit;
  if (!bit4Sensed && ulaPortBit4ChangedFrom1Tacts > ulaPortBit4ChangedFrom0Tacts) {
    uint32_t chargeTime = ulaPortBit4ChangedFrom1Tacts - ulaPortBit4ChangedFrom0Tacts;
    chargeTime = chargeTime > 700u ? 2800u : 4u * chargeTime;
    bit4Sensed = (tacts - ulaPortBit4ChangedFrom1Tacts) < chargeTime;
  }
  uint8_t bit6 = 0u;
  if (bit4Sensed) bit6 = 0x40u;
  if (micBit && ((zxnextNextRegs[0x08u] & 0x01u) != 0u)) bit6 = 0x40u;
  return (portValue & 0xbfu) | bit6;
}

static inline void zxnextUlaWritePortFe(uint32_t value) {
  uint8_t byteValue = (uint8_t)value;
  portFeValue = byteValue;
  borderColor = byteValue & 0x07u;
  micBit = (byteValue & 0x08u) != 0u;
  uint8_t bit4 = (byteValue & 0x10u) != 0u;
  if (earBit && !bit4) {
    ulaPortBit4ChangedFrom1Tacts = tacts;
  } else if (!earBit && bit4) {
    ulaPortBit4ChangedFrom0Tacts = tacts;
  }
  earBit = bit4;
}

static inline uint32_t zxnextUlaColor(uint32_t color, uint32_t bright) {
  static const uint32_t normalColors[8] = {
    0xff000000u, 0xffb60000u, 0xff0000b6u, 0xffb600b6u,
    0xff00b600u, 0xffb6b600u, 0xff00b6b6u, 0xffb6b6b6u
  };
  static const uint32_t brightColors[8] = {
    0xff000000u, 0xffff0000u, 0xff0000ffu, 0xffff00ffu,
    0xff00ff00u, 0xffffff00u, 0xff00ffffu, 0xffffffffu
  };
  return bright ? brightColors[color & 0x07u] : normalColors[color & 0x07u];
}

static inline uint32_t zxnextUlaRgb333Color(uint32_t rgb333) {
  static const uint32_t levels[8] = { 0x00u, 0x24u, 0x49u, 0x6du, 0x92u, 0xb6u, 0xdbu, 0xffu };
  uint32_t red = levels[(rgb333 >> 6u) & 0x07u];
  uint32_t green = levels[(rgb333 >> 3u) & 0x07u];
  uint32_t blue = levels[rgb333 & 0x07u];
  return 0xff000000u | (blue << 16u) | (green << 8u) | red;
}

static inline uint32_t zxnextUlaFallbackColor(void) {
  uint32_t fallback = zxnextNextRegs[0x4au];
  uint32_t blueLsb = (fallback & 0x02u) | (fallback & 0x01u);
  return zxnextUlaRgb333Color(((fallback << 1u) | blueLsb) & 0x1ffu);
}

static inline uint32_t zxnextUlaPaletteColor(uint32_t index) {
  uint32_t palette = (zxnextPaletteGetControl() & 0x02u) ? 4u : 0u;
  return zxnextUlaRgb333Color(zxnextPaletteGetEntry(palette, index));
}

static inline uint32_t zxnextUlaLayer2PaletteColor(uint32_t index) {
  return zxnextUlaRgb333Color(zxnextPaletteGetLayer2Entry(index) & 0x1ffu);
}

static inline uint32_t zxnextUlaTilemapPaletteColor(uint32_t index) {
  return zxnextUlaRgb333Color(zxnextPaletteGetTilemapEntry(index) & 0x1ffu);
}

static inline uint32_t zxnextUlaAttrPaletteIndex(uint32_t attr, uint32_t ink) {
  uint32_t brightOffset = (attr & 0x40u) ? 0x08u : 0x00u;
  uint32_t inkIndex = (attr & 0x07u) + brightOffset;
  uint32_t paperIndex = ((attr >> 3u) & 0x07u) + brightOffset + 0x10u;
  if (ulaFlashFlag && (attr & 0x80u)) {
    uint32_t swap = inkIndex;
    inkIndex = paperIndex;
    paperIndex = swap;
  }
  return ink ? inkIndex : paperIndex;
}

static inline uint32_t zxnextUlaHiResInkColor(void) {
  return zxnextUlaPaletteColor(8u + ((portTimexValue >> 3u) & 0x07u));
}

static inline uint32_t zxnextUlaHiResPaperColor(void) {
  return zxnextUlaPaletteColor(24u + (7u - ((portTimexValue >> 3u) & 0x07u)));
}

static inline uint32_t zxnextUlaBitmapAddress(uint32_t y, uint32_t xByte) {
  return 0x4000u | ((y & 0xc0u) << 5u) | ((y & 0x07u) << 8u) | ((y & 0x38u) << 2u) | xByte;
}

static inline uint32_t zxnextUlaAttributeAddress(uint32_t y, uint32_t xByte) {
  return 0x5800u | ((y >> 3u) << 5u) | xByte;
}

static inline uint32_t zxnextUlaIsClipped(uint32_t x, uint32_t y) {
  return x < ulaClipWindow[0] || x > ulaClipWindow[1] || y < ulaClipWindow[2] || y > ulaClipWindow[3];
}

static inline uint32_t zxnextUlaLoResWrappedY(uint32_t y) {
  if (y >= 192u) {
    return ((((y >> 6u) + 1u) & 0x03u) << 6u) | (y & 0x3fu);
  }
  return y & 0xffu;
}

static void zxnextUlaRenderStandardScreen(void) {
  uint32_t fallbackPixel = zxnextUlaFallbackColor();
  for (uint32_t y = 0; y < ZXNEXT_STANDARD_SCREEN_HEIGHT; y++) {
    uint32_t outputOffset = (ZXNEXT_STANDARD_SCREEN_Y + y) * ZXNEXT_SCREEN_WIDTH + ZXNEXT_STANDARD_SCREEN_X;
    for (uint32_t xByte = 0; xByte < 32u; xByte++) {
      uint32_t logicalX = xByte * 8u;
      uint32_t sourceY = (y + ulaScrollY) % ZXNEXT_STANDARD_SCREEN_HEIGHT;
      uint32_t outputPixel = outputOffset + xByte * 8u * ZXNEXT_STANDARD_SCREEN_SCALE_X;
      for (uint32_t bit = 0; bit < 8u; bit++) {
        uint32_t x = logicalX + bit;
        uint32_t pixelOffset = outputPixel + bit * ZXNEXT_STANDARD_SCREEN_SCALE_X;
        if (zxnextUlaIsClipped(x, y)) {
          zxnextPixelBuffer[pixelOffset] = fallbackPixel;
          zxnextPixelBuffer[pixelOffset + 1u] = fallbackPixel;
          continue;
        }
        uint32_t sourceX = (x + ulaScrollX) & 0xffu;
        uint32_t sourceXByte = sourceX >> 3u;
        uint8_t pixels = (uint8_t)zxnextMemoryReadScreenOffset(zxnextUlaBitmapAddress(sourceY, sourceXByte));
        uint8_t attr = (uint8_t)zxnextMemoryReadScreenOffset(zxnextUlaAttributeAddress(sourceY, sourceXByte));
        uint32_t mask = 0x80u >> (sourceX & 0x07u);
        uint32_t pixel = zxnextUlaPaletteColor(zxnextUlaAttrPaletteIndex(attr, (pixels & mask) != 0u));
        zxnextPixelBuffer[pixelOffset] = pixel;
        zxnextPixelBuffer[pixelOffset + 1u] = pixel;
      }
    }
  }
}

static void zxnextUlaRenderHiResScreen(void) {
  uint32_t fallbackPixel = zxnextUlaFallbackColor();
  uint32_t inkPixel = zxnextUlaHiResInkColor();
  uint32_t paperPixel = zxnextUlaHiResPaperColor();
  for (uint32_t y = 0; y < ZXNEXT_STANDARD_SCREEN_HEIGHT; y++) {
    uint32_t outputOffset = (ZXNEXT_STANDARD_SCREEN_Y + y) * ZXNEXT_SCREEN_WIDTH + ZXNEXT_STANDARD_SCREEN_X;
    uint32_t sourceY = (y + ulaScrollY) % ZXNEXT_STANDARD_SCREEN_HEIGHT;
    for (uint32_t x = 0; x < ZXNEXT_STANDARD_SCREEN_OUTPUT_WIDTH; x++) {
      uint32_t logicalX = x >> 1u;
      uint32_t pixelOffset = outputOffset + x;
      if (zxnextUlaIsClipped(logicalX, y)) {
        zxnextPixelBuffer[pixelOffset] = fallbackPixel;
        continue;
      }
      uint32_t sourceX = (x + ((uint32_t)ulaScrollX << 1u)) & 0x1ffu;
      uint32_t sourceXByte = sourceX >> 4u;
      uint32_t pixelInWord = sourceX & 0x0fu;
      uint32_t pixelAddr = zxnextUlaBitmapAddress(sourceY, sourceXByte);
      if (pixelInWord >= 8u) {
        pixelAddr |= 0x2000u;
      }
      uint8_t pixels = (uint8_t)zxnextMemoryReadScreenOffset(pixelAddr);
      uint32_t mask = 0x80u >> (pixelInWord & 0x07u);
      zxnextPixelBuffer[pixelOffset] = (pixels & mask) ? inkPixel : paperPixel;
    }
  }
}

static void zxnextUlaRenderLoResScreen(void) {
  uint32_t fallbackPixel = zxnextUlaFallbackColor();
  uint32_t scrollX = zxnextLoResGetScrollX();
  uint32_t scrollY = zxnextLoResGetScrollY();
  uint32_t paletteOffset = zxnextLoResGetPaletteOffset();
  uint32_t radastanMode = zxnextLoResGetRadastanMode();
  uint32_t radastanDFile = ((portTimexValue & 0x01u) != 0u) ^ ((zxnextLayer2GetNextReg(0x6au) & 0x10u) != 0u);

  for (uint32_t y = 0; y < ZXNEXT_STANDARD_SCREEN_HEIGHT; y++) {
    uint32_t outputOffset = (ZXNEXT_STANDARD_SCREEN_Y + y) * ZXNEXT_SCREEN_WIDTH + ZXNEXT_STANDARD_SCREEN_X;
    uint32_t sourceY = zxnextUlaLoResWrappedY(y + scrollY);
    for (uint32_t x = 0; x < ZXNEXT_STANDARD_SCREEN_OUTPUT_WIDTH; x++) {
      uint32_t displayX = x >> 1u;
      uint32_t pixelOffset = outputOffset + x;
      if (zxnextUlaIsClipped(displayX, y)) {
        zxnextPixelBuffer[pixelOffset] = fallbackPixel;
        continue;
      }

      uint32_t sourceX = (displayX + scrollX) & 0xffu;
      uint32_t paletteIndex;
      if (!radastanMode) {
        uint32_t blockAddr = zxnextLoResStandardAddress(sourceX >> 1u, sourceY >> 1u);
        uint8_t block = (uint8_t)zxnextMemoryReadPhysical(ZXNEXT_LORES_BANK_05_OFFSET + (blockAddr & 0x3fffu));
        uint32_t highNibble = ((block >> 4u) + paletteOffset) & 0x0fu;
        paletteIndex = (highNibble << 4u) | (block & 0x0fu);
      } else {
        uint32_t blockAddr = zxnextLoResRadastanAddress(sourceX >> 2u, sourceY >> 1u, radastanDFile);
        uint8_t block = (uint8_t)zxnextMemoryReadPhysical(ZXNEXT_LORES_BANK_05_OFFSET + (blockAddr & 0x3fffu));
        uint32_t nibble = (sourceX & 0x02u) ? (block & 0x0fu) : ((block >> 4u) & 0x0fu);
        paletteIndex = ((paletteOffset & 0x0fu) << 4u) | nibble;
      }
      zxnextPixelBuffer[pixelOffset] = zxnextUlaPaletteColor(paletteIndex);
    }
  }
}

static void zxnextUlaRenderHiColorScreen(void) {
  uint32_t fallbackPixel = zxnextUlaFallbackColor();
  for (uint32_t y = 0; y < ZXNEXT_STANDARD_SCREEN_HEIGHT; y++) {
    uint32_t outputOffset = (ZXNEXT_STANDARD_SCREEN_Y + y) * ZXNEXT_SCREEN_WIDTH + ZXNEXT_STANDARD_SCREEN_X;
    uint32_t sourceY = (y + ulaScrollY) % ZXNEXT_STANDARD_SCREEN_HEIGHT;
    for (uint32_t xByte = 0; xByte < 32u; xByte++) {
      uint32_t logicalX = xByte * 8u;
      uint32_t outputPixel = outputOffset + xByte * 8u * ZXNEXT_STANDARD_SCREEN_SCALE_X;
      for (uint32_t bit = 0; bit < 8u; bit++) {
        uint32_t x = logicalX + bit;
        uint32_t pixelOffset = outputPixel + bit * ZXNEXT_STANDARD_SCREEN_SCALE_X;
        if (zxnextUlaIsClipped(x, y)) {
          zxnextPixelBuffer[pixelOffset] = fallbackPixel;
          zxnextPixelBuffer[pixelOffset + 1u] = fallbackPixel;
          continue;
        }
        uint32_t sourceX = (x + ulaScrollX) & 0xffu;
        uint32_t sourceXByte = sourceX >> 3u;
        uint32_t pixelAddr = zxnextUlaBitmapAddress(sourceY, sourceXByte);
        uint8_t pixels = (uint8_t)zxnextMemoryReadScreenOffset(pixelAddr);
        uint8_t attr = (uint8_t)zxnextMemoryReadScreenOffset(0x2000u | pixelAddr);
        uint32_t mask = 0x80u >> (sourceX & 0x07u);
        uint32_t pixel = zxnextUlaPaletteColor(zxnextUlaAttrPaletteIndex(attr, (pixels & mask) != 0u));
        zxnextPixelBuffer[pixelOffset] = pixel;
        zxnextPixelBuffer[pixelOffset + 1u] = pixel;
      }
    }
  }
}

static inline uint32_t zxnextUlaLayer2WrappedY(uint32_t y) {
  return zxnextUlaLoResWrappedY(y);
}

static inline uint32_t zxnextUlaLayer2WideWrappedX(uint32_t x) {
  x &= 0x3ffu;
  if (x >= 320u) {
    uint32_t upper = ((x >> 6u) & 0x07u) + 3u;
    x = (upper << 6u) | (x & 0x3fu);
  }
  return x & 0x1ffu;
}

static uint32_t zxnextUlaReadLayer2Pixel(uint32_t bank16, uint32_t offset) {
  uint32_t segment16K = (offset >> 14u) & 0x07u;
  uint32_t half8K = (offset >> 13u) & 0x01u;
  uint32_t bank8K = ((bank16 + segment16K) << 1u) | half8K;
  return zxnextMemoryReadPhysical(ZXNEXT_LAYER2_RAM_OFFSET + (bank8K << 13u) + (offset & 0x1fffu));
}

static void zxnextUlaRenderLayer2_256x192Screen(void) {
  uint32_t bank16 = zxnextLayer2GetUseShadowBank()
    ? zxnextLayer2GetShadowRamBank()
    : zxnextLayer2GetActiveRamBank();
  uint32_t scrollX = zxnextLayer2GetScrollX();
  uint32_t scrollY = zxnextLayer2GetScrollY();
  uint32_t paletteOffset = zxnextLayer2GetPaletteOffset() & 0x0fu;
  uint32_t clipX1 = zxnextLayer2GetClip(0);
  uint32_t clipX2 = zxnextLayer2GetClip(1);
  uint32_t clipY1 = zxnextLayer2GetClip(2);
  uint32_t clipY2 = zxnextLayer2GetClip(3);
  uint32_t transparentIndex = zxnextNextRegs[0x4bu];

  for (uint32_t y = 0; y < ZXNEXT_STANDARD_SCREEN_HEIGHT; y++) {
    if (y < clipY1 || y > clipY2) continue;
    uint32_t sourceY = zxnextUlaLayer2WrappedY(y + scrollY);
    uint32_t outputOffset = (ZXNEXT_STANDARD_SCREEN_Y + y) * ZXNEXT_SCREEN_WIDTH + ZXNEXT_STANDARD_SCREEN_X;
    for (uint32_t x = 0; x < ZXNEXT_STANDARD_SCREEN_OUTPUT_WIDTH; x++) {
      uint32_t displayX = x >> 1u;
      if (displayX < clipX1 || displayX > clipX2) continue;

      uint32_t sourceX = (displayX + scrollX) & 0xffu;
      uint32_t pixelValue = zxnextUlaReadLayer2Pixel(bank16, (sourceY << 8u) | sourceX);
      uint32_t highNibble = ((pixelValue >> 4u) + paletteOffset) & 0x0fu;
      uint32_t paletteIndex = (highNibble << 4u) | (pixelValue & 0x0fu);
      if (paletteIndex == transparentIndex) continue;
      zxnextPixelBuffer[outputOffset + x] = zxnextUlaLayer2PaletteColor(paletteIndex);
    }
  }
}

static void zxnextUlaRenderLayer2_320x256Screen(void) {
  uint32_t bank16 = zxnextLayer2GetUseShadowBank()
    ? zxnextLayer2GetShadowRamBank()
    : zxnextLayer2GetActiveRamBank();
  uint32_t scrollX = zxnextLayer2GetScrollX();
  uint32_t scrollY = zxnextLayer2GetScrollY();
  uint32_t paletteOffset = zxnextLayer2GetPaletteOffset() & 0x0fu;
  uint32_t clipX1 = zxnextLayer2GetClip(0) << 1u;
  uint32_t clipX2 = (zxnextLayer2GetClip(1) << 1u) | 0x01u;
  uint32_t clipY1 = zxnextLayer2GetClip(2);
  uint32_t clipY2 = zxnextLayer2GetClip(3);
  uint32_t transparentIndex = zxnextNextRegs[0x4bu];

  for (uint32_t y = 0; y < ZXNEXT_LAYER2_WIDE_SCREEN_HEIGHT; y++) {
    if (y < clipY1 || y > clipY2) continue;
    uint32_t sourceY = (y + scrollY) & 0xffu;
    uint32_t outputOffset = (ZXNEXT_LAYER2_WIDE_SCREEN_Y + y) * ZXNEXT_SCREEN_WIDTH + ZXNEXT_LAYER2_WIDE_SCREEN_X;
    for (uint32_t x = 0; x < ZXNEXT_LAYER2_320_SCREEN_OUTPUT_WIDTH; x++) {
      uint32_t displayX = x >> 1u;
      if (displayX < clipX1 || displayX > clipX2) continue;

      uint32_t sourceX = zxnextUlaLayer2WideWrappedX(displayX + scrollX);
      uint32_t pixelValue = zxnextUlaReadLayer2Pixel(bank16, (sourceX << 8u) | sourceY);
      uint32_t highNibble = ((pixelValue >> 4u) + paletteOffset) & 0x0fu;
      uint32_t paletteIndex = (highNibble << 4u) | (pixelValue & 0x0fu);
      if (paletteIndex == transparentIndex) continue;
      zxnextPixelBuffer[outputOffset + x] = zxnextUlaLayer2PaletteColor(paletteIndex);
    }
  }
}

static uint32_t zxnextUlaReadTilemapVram(uint32_t useBank7, uint32_t offset, uint32_t address) {
  uint32_t offsetMask = useBank7 ? 0x1fu : 0x3fu;
  uint32_t highByte = ((offset & offsetMask) + ((address >> 8u) & 0x3fu)) & 0x3fu;
  uint32_t fullAddress = (highByte << 8u) | (address & 0xffu);
  uint32_t bankBase = useBank7 ? ZXNEXT_BANK_07_OFFSET : ZXNEXT_LORES_BANK_05_OFFSET;
  return zxnextMemoryReadPhysical(bankBase + fullAddress);
}

static uint32_t zxnextUlaTilemapTransform(uint32_t x, uint32_t y, uint32_t attr) {
  uint32_t rotate = (attr & 0x02u) != 0u;
  uint32_t effectiveX = x;
  uint32_t effectiveY = y;
  if (((attr & 0x08u) != 0u) != rotate) effectiveX = 7u - effectiveX;
  if ((attr & 0x04u) != 0u) effectiveY = 7u - effectiveY;
  return rotate ? ((effectiveY << 16u) | effectiveX) : ((effectiveX << 16u) | effectiveY);
}

static void zxnextUlaRenderTilemap_40x32Screen(void) {
  uint32_t scrollX = zxnextTilemapGetScrollX();
  uint32_t scrollY = zxnextTilemapGetScrollY();
  uint32_t useBank7 = zxnextTilemapGetBaseAddressUseBank7();
  uint32_t baseMsb = zxnextTilemapGetBaseAddressMsb();
  uint32_t defUseBank7 = zxnextTilemapGetDefinitionAddressUseBank7();
  uint32_t defMsb = zxnextTilemapGetDefinitionAddressMsb();
  uint32_t eliminateAttrs = zxnextTilemapGetEliminateAttributes();
  uint32_t tile512Mode = zxnextTilemapGet512TileMode();
  uint32_t forceOnTop = zxnextTilemapGetForceOnTopOfUla();
  uint32_t defaultAttr = zxnextTilemapGetDefaultAttr();
  uint32_t transparentIndex = zxnextTilemapGetTransparencyIndex() & 0x0fu;
  uint32_t clipX1 = zxnextTilemapGetClip(0) << 1u;
  uint32_t clipX2 = (zxnextTilemapGetClip(1) << 1u) | 0x01u;
  uint32_t clipY1 = zxnextTilemapGetClip(2);
  uint32_t clipY2 = zxnextTilemapGetClip(3);

  for (uint32_t y = 0; y < ZXNEXT_LAYER2_WIDE_SCREEN_HEIGHT; y++) {
    if (y < clipY1 || y > clipY2) continue;
    uint32_t sourceY = (y + scrollY) & 0xffu;
    uint32_t tileY = sourceY >> 3u;
    uint32_t yInTile = sourceY & 0x07u;
    uint32_t outputOffset = (ZXNEXT_LAYER2_WIDE_SCREEN_Y + y) * ZXNEXT_SCREEN_WIDTH + ZXNEXT_LAYER2_WIDE_SCREEN_X;

    for (uint32_t x = 0; x < ZXNEXT_LAYER2_320_SCREEN_OUTPUT_WIDTH; x++) {
      uint32_t displayX = x >> 1u;
      if (displayX < clipX1 || displayX > clipX2) continue;

      uint32_t sourceX = (displayX + scrollX) % ZXNEXT_LAYER2_320_SCREEN_WIDTH;
      uint32_t tileX = sourceX >> 3u;
      uint32_t xInTile = sourceX & 0x07u;
      uint32_t tileArrayIndex = tileY * 40u + tileX;
      uint32_t tileIndexAddr = eliminateAttrs ? tileArrayIndex : tileArrayIndex << 1u;
      uint32_t tileIndex = zxnextUlaReadTilemapVram(useBank7, baseMsb, tileIndexAddr);
      uint32_t attr = eliminateAttrs
        ? defaultAttr
        : zxnextUlaReadTilemapVram(useBank7, baseMsb, tileIndexAddr + 1u);

      if (tile512Mode && !eliminateAttrs) {
        tileIndex |= (attr & 0x01u) << 8u;
        attr &= 0xfeu;
      }
      if (!forceOnTop && (attr & 0x01u) != 0u) continue;

      uint32_t transformed = zxnextUlaTilemapTransform(xInTile, yInTile, attr);
      uint32_t transformedX = transformed >> 16u;
      uint32_t transformedY = transformed & 0xffffu;
      uint32_t patternAddr = tileIndex * 32u + transformedY * 4u + (transformedX >> 1u);
      uint32_t patternByte = zxnextUlaReadTilemapVram(defUseBank7, defMsb, patternAddr);
      uint32_t pixelValue = (transformedX & 0x01u) == 0u
        ? (patternByte >> 4u) & 0x0fu
        : patternByte & 0x0fu;
      if ((pixelValue & 0x0fu) == transparentIndex) continue;

      uint32_t paletteIndex = (((attr >> 4u) << 4u) | pixelValue) & 0xffu;
      zxnextPixelBuffer[outputOffset + x] = zxnextUlaTilemapPaletteColor(paletteIndex);
    }
  }
}

static void zxnextUlaRenderTilemap_80x32Screen(void) {
  uint32_t scrollX = zxnextTilemapGetScrollX();
  uint32_t scrollY = zxnextTilemapGetScrollY();
  uint32_t useBank7 = zxnextTilemapGetBaseAddressUseBank7();
  uint32_t baseMsb = zxnextTilemapGetBaseAddressMsb();
  uint32_t defUseBank7 = zxnextTilemapGetDefinitionAddressUseBank7();
  uint32_t defMsb = zxnextTilemapGetDefinitionAddressMsb();
  uint32_t eliminateAttrs = zxnextTilemapGetEliminateAttributes();
  uint32_t tile512Mode = zxnextTilemapGet512TileMode();
  uint32_t forceOnTop = zxnextTilemapGetForceOnTopOfUla();
  uint32_t defaultAttr = zxnextTilemapGetDefaultAttr();
  uint32_t transparentIndex = zxnextTilemapGetTransparencyIndex() & 0x0fu;
  uint32_t clipX1 = zxnextTilemapGetClip(0) << 1u;
  uint32_t clipX2 = (zxnextTilemapGetClip(1) << 1u) | 0x01u;
  uint32_t clipY1 = zxnextTilemapGetClip(2);
  uint32_t clipY2 = zxnextTilemapGetClip(3);

  for (uint32_t y = 0; y < ZXNEXT_LAYER2_WIDE_SCREEN_HEIGHT; y++) {
    if (y < clipY1 || y > clipY2) continue;
    uint32_t sourceY = (y + scrollY) & 0xffu;
    uint32_t tileY = sourceY >> 3u;
    uint32_t yInTile = sourceY & 0x07u;
    uint32_t outputOffset = (ZXNEXT_LAYER2_WIDE_SCREEN_Y + y) * ZXNEXT_SCREEN_WIDTH + ZXNEXT_LAYER2_WIDE_SCREEN_X;

    for (uint32_t x = 0; x < ZXNEXT_LAYER2_320_SCREEN_OUTPUT_WIDTH; x++) {
      uint32_t displayClockX = x >> 1u;
      if (displayClockX < clipX1 || displayClockX > clipX2) continue;

      uint32_t sourceClockX = (displayClockX + scrollX) % ZXNEXT_LAYER2_320_SCREEN_WIDTH;
      uint32_t tileX = sourceClockX >> 2u;
      uint32_t xInTile = ((sourceClockX & 0x03u) << 1u) | (x & 0x01u);
      uint32_t tileArrayIndex = tileY * 80u + tileX;
      uint32_t tileIndexAddr = eliminateAttrs ? tileArrayIndex : tileArrayIndex << 1u;
      uint32_t tileIndex = zxnextUlaReadTilemapVram(useBank7, baseMsb, tileIndexAddr);
      uint32_t attr = eliminateAttrs
        ? defaultAttr
        : zxnextUlaReadTilemapVram(useBank7, baseMsb, tileIndexAddr + 1u);

      if (tile512Mode && !eliminateAttrs) {
        tileIndex |= (attr & 0x01u) << 8u;
        attr &= 0xfeu;
      }
      if (!forceOnTop && (attr & 0x01u) != 0u) continue;

      uint32_t transformed = zxnextUlaTilemapTransform(xInTile, yInTile, attr);
      uint32_t transformedX = transformed >> 16u;
      uint32_t transformedY = transformed & 0xffffu;
      uint32_t patternAddr = tileIndex * 32u + transformedY * 4u + (transformedX >> 1u);
      uint32_t patternByte = zxnextUlaReadTilemapVram(defUseBank7, defMsb, patternAddr);
      uint32_t pixelValue = (transformedX & 0x01u) == 0u
        ? (patternByte >> 4u) & 0x0fu
        : patternByte & 0x0fu;
      if ((pixelValue & 0x0fu) == transparentIndex) continue;

      uint32_t paletteIndex = (((attr >> 4u) << 4u) | pixelValue) & 0xffu;
      zxnextPixelBuffer[outputOffset + x] = zxnextUlaTilemapPaletteColor(paletteIndex);
    }
  }
}

static uint32_t zxnextUlaRenderInstantScreen(void) {
  uint32_t timexMode = portTimexValue & 0x07u;
  uint32_t borderPixel = timexMode >= 0x04u ? zxnextUlaHiResPaperColor() : zxnextUlaColor(borderColor, 0u);
  for (uint32_t i = 0; i < ZXNEXT_PIXEL_COUNT; i++) {
    zxnextPixelBuffer[i] = borderPixel;
  }
  if (zxnextLoResGetEnabled()) {
    zxnextUlaRenderLoResScreen();
  } else if (timexMode == 0x02u || timexMode == 0x03u) {
    zxnextUlaRenderHiColorScreen();
  } else if (timexMode >= 0x04u) {
    zxnextUlaRenderHiResScreen();
  } else {
    zxnextUlaRenderStandardScreen();
  }
  if (zxnextTilemapGetEnabled()) {
    if (zxnextTilemapGet80x32Resolution()) {
      zxnextUlaRenderTilemap_80x32Screen();
    } else {
      zxnextUlaRenderTilemap_40x32Screen();
    }
  }
  if (zxnextLayer2GetEnabled() && zxnextLayer2GetResolution() == 0u) {
    zxnextUlaRenderLayer2_256x192Screen();
  } else if (zxnextLayer2GetEnabled() && zxnextLayer2GetResolution() == 1u) {
    zxnextUlaRenderLayer2_320x256Screen();
  }
  return ZXNEXT_PIXEL_COUNT;
}

static void zxnextUlaOnFrameCompleted(void) {
  ulaFlashCounter = (uint8_t)((ulaFlashCounter + 1u) & 0x1fu);
  ulaFlashFlag = ulaFlashCounter >= 16u;
}

static uint32_t zxnextUlaGetFlashCounter(void) {
  return ulaFlashCounter;
}

static uint32_t zxnextUlaGetFlashFlag(void) {
  return ulaFlashFlag;
}

static void zxnextUlaSetNextReg(uint32_t reg, uint32_t value) {
  uint8_t byteValue = (uint8_t)value;
  switch (reg & 0xffu) {
    case 0x1au:
      ulaClipWindow[ulaClipIndex] = byteValue;
      ulaClipIndex = (uint8_t)((ulaClipIndex + 1u) & 0x03u);
      break;
    case 0x26u:
      ulaScrollX = byteValue;
      break;
    case 0x27u:
      ulaScrollY = byteValue;
      break;
    case 0x69u:
      portTimexValue = byteValue & 0x3fu;
      break;
    default:
      break;
  }
}

static uint32_t zxnextUlaGetNextReg(uint32_t reg) {
  switch (reg & 0xffu) {
    case 0x1au: return ulaClipWindow[ulaClipIndex];
    case 0x26u: return ulaScrollX;
    case 0x27u: return ulaScrollY;
    default: return 0u;
  }
}

static void zxnextUlaResetClipIndex(void) { ulaClipIndex = 0u; }
static uint32_t zxnextUlaGetClipIndex(void) { return ulaClipIndex; }
static uint32_t zxnextUlaGetClip(uint32_t index) { return ulaClipWindow[index & 0x03u]; }
static uint32_t zxnextUlaGetScrollX(void) { return ulaScrollX; }
static uint32_t zxnextUlaGetScrollY(void) { return ulaScrollY; }

static uint32_t zxnextUlaGetPulseIntActive(uint32_t frameTact) {
  if ((zxnextNextRegs[0x05u] & 0x04u) != 0u) {
    return frameTact >= ZXNEXT_60HZ_INT_START_TACT && frameTact < ZXNEXT_60HZ_INT_END_TACT;
  }
  return frameTact >= ZXNEXT_50HZ_INT_START_TACT && frameTact < ZXNEXT_50HZ_INT_END_TACT;
}

static uint32_t zxnextUlaGetScanlineForTact(uint32_t tact) {
  return (tact % ZXNEXT_RENDERING_TACTS_IN_FRAME) / ZXNEXT_SCREEN_TOTAL_HC;
}

static uint32_t zxnextUlaGetColumnForTact(uint32_t tact) {
  return (tact % ZXNEXT_RENDERING_TACTS_IN_FRAME) % ZXNEXT_SCREEN_TOTAL_HC;
}
