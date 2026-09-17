#include "zxnext-ula.h"
#include "zxnext-keyboard.h"
#include "zxnext-layer2.h"
#include "zxnext-memory.h"
#include "zxnext-palette.h"
#include "zxnext-sprites.h"
#include "zxnext-tape.h"
#include "zxnext-tilemap.h"

#define ZXNEXT_SCREEN_TOTAL_HC 456u
#define ZXNEXT_STANDARD_SCREEN_WIDTH 256u
#define ZXNEXT_STANDARD_SCREEN_SCALE_X 2u
#define ZXNEXT_STANDARD_SCREEN_OUTPUT_WIDTH (ZXNEXT_STANDARD_SCREEN_WIDTH * ZXNEXT_STANDARD_SCREEN_SCALE_X)
#define ZXNEXT_STANDARD_SCREEN_HEIGHT 192u
#define ZXNEXT_STANDARD_SCREEN_X 96u
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

/*
 * Where the renderers draw, and which buffer rows they may touch.
 *
 * The whole-frame renderers below draw the picture from the *current* register and memory state.
 * By default they draw the whole of `zxnextPixelBuffer` (what `zxnextRenderInstantScreen` does).
 * The raster (see "Beam-racing raster" at the end of this file) points them at a scratch buffer and
 * a narrow row window, so a mid-frame state change - a copper MOVE, a palette write, a border OUT -
 * only affects the pixels the beam draws after it.
 */
static uint32_t* zxnextRenderTarget = zxnextPixelBuffer;
static uint32_t zxnextRenderRowFirst = 0u;
static uint32_t zxnextRenderRowLast = ZXNEXT_SCREEN_HEIGHT - 1u;

static inline uint32_t zxnextRenderRowOff(uint32_t bufferRow) {
  return bufferRow < zxnextRenderRowFirst || bufferRow > zxnextRenderRowLast;
}

static uint8_t ulaFlashCounter;
static uint8_t ulaFlashFlag;
static uint8_t ulaScrollX;
static uint8_t ulaScrollY;
static uint8_t ulaClipWindow[4];
static uint8_t ulaClipIndex;
static uint8_t ulaDisableOutput;
static uint8_t ulaBlendingInSluModes;
static uint8_t ulaHalfPixelScroll;
static uint8_t ulaEnableStencilMode;
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
  ulaDisableOutput = 0u;
  ulaBlendingInSluModes = 0u;
  ulaHalfPixelScroll = 0u;
  ulaEnableStencilMode = 0u;
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

static inline uint32_t zxnextUlaSpritePaletteColor(uint32_t index) {
  return zxnextUlaRgb333Color(zxnextPaletteGetSpriteEntry(index) & 0x1ffu);
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
    if (zxnextRenderRowOff(ZXNEXT_STANDARD_SCREEN_Y + y)) continue;
    uint32_t outputOffset = (ZXNEXT_STANDARD_SCREEN_Y + y) * ZXNEXT_SCREEN_WIDTH + ZXNEXT_STANDARD_SCREEN_X;
    uint32_t previousPixel = zxnextRenderTarget[outputOffset - 1u];
    for (uint32_t xByte = 0; xByte < 32u; xByte++) {
      uint32_t logicalX = xByte * 8u;
      uint32_t sourceY = (y + ulaScrollY) % ZXNEXT_STANDARD_SCREEN_HEIGHT;
      uint32_t outputPixel = outputOffset + xByte * 8u * ZXNEXT_STANDARD_SCREEN_SCALE_X;
      for (uint32_t bit = 0; bit < 8u; bit++) {
        uint32_t x = logicalX + bit;
        uint32_t pixelOffset = outputPixel + bit * ZXNEXT_STANDARD_SCREEN_SCALE_X;
        if (zxnextUlaIsClipped(x, y)) {
          if (ulaHalfPixelScroll) {
            zxnextRenderTarget[pixelOffset] = previousPixel;
            zxnextRenderTarget[pixelOffset + 1u] = fallbackPixel;
            previousPixel = fallbackPixel;
          } else {
            zxnextRenderTarget[pixelOffset] = fallbackPixel;
            zxnextRenderTarget[pixelOffset + 1u] = fallbackPixel;
          }
          continue;
        }
        uint32_t sourceX = (x + ulaScrollX) & 0xffu;
        uint32_t sourceXByte = sourceX >> 3u;
        uint8_t pixels = (uint8_t)zxnextMemoryReadScreenOffset(zxnextUlaBitmapAddress(sourceY, sourceXByte));
        uint8_t attr = (uint8_t)zxnextMemoryReadScreenOffset(zxnextUlaAttributeAddress(sourceY, sourceXByte));
        uint32_t mask = 0x80u >> (sourceX & 0x07u);
        uint32_t pixel = zxnextUlaPaletteColor(zxnextUlaAttrPaletteIndex(attr, (pixels & mask) != 0u));
        if (ulaHalfPixelScroll) {
          zxnextRenderTarget[pixelOffset] = previousPixel;
          zxnextRenderTarget[pixelOffset + 1u] = pixel;
          previousPixel = pixel;
        } else {
          zxnextRenderTarget[pixelOffset] = pixel;
          zxnextRenderTarget[pixelOffset + 1u] = pixel;
        }
      }
    }
  }
}

static void zxnextUlaRenderHiResScreen(void) {
  uint32_t fallbackPixel = zxnextUlaFallbackColor();
  uint32_t inkPixel = zxnextUlaHiResInkColor();
  uint32_t paperPixel = zxnextUlaHiResPaperColor();
  for (uint32_t y = 0; y < ZXNEXT_STANDARD_SCREEN_HEIGHT; y++) {
    if (zxnextRenderRowOff(ZXNEXT_STANDARD_SCREEN_Y + y)) continue;
    uint32_t outputOffset = (ZXNEXT_STANDARD_SCREEN_Y + y) * ZXNEXT_SCREEN_WIDTH + ZXNEXT_STANDARD_SCREEN_X;
    uint32_t sourceY = (y + ulaScrollY) % ZXNEXT_STANDARD_SCREEN_HEIGHT;
    for (uint32_t x = 0; x < ZXNEXT_STANDARD_SCREEN_OUTPUT_WIDTH; x++) {
      uint32_t logicalX = x >> 1u;
      uint32_t pixelOffset = outputOffset + x;
      if (zxnextUlaIsClipped(logicalX, y)) {
        zxnextRenderTarget[pixelOffset] = fallbackPixel;
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
      zxnextRenderTarget[pixelOffset] = (pixels & mask) ? inkPixel : paperPixel;
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
    if (zxnextRenderRowOff(ZXNEXT_STANDARD_SCREEN_Y + y)) continue;
    uint32_t outputOffset = (ZXNEXT_STANDARD_SCREEN_Y + y) * ZXNEXT_SCREEN_WIDTH + ZXNEXT_STANDARD_SCREEN_X;
    uint32_t sourceY = zxnextUlaLoResWrappedY(y + scrollY);
    for (uint32_t x = 0; x < ZXNEXT_STANDARD_SCREEN_OUTPUT_WIDTH; x++) {
      uint32_t displayX = x >> 1u;
      uint32_t pixelOffset = outputOffset + x;
      if (zxnextUlaIsClipped(displayX, y)) {
        zxnextRenderTarget[pixelOffset] = fallbackPixel;
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
      zxnextRenderTarget[pixelOffset] = zxnextUlaPaletteColor(paletteIndex);
    }
  }
}

static void zxnextUlaRenderHiColorScreen(void) {
  uint32_t fallbackPixel = zxnextUlaFallbackColor();
  for (uint32_t y = 0; y < ZXNEXT_STANDARD_SCREEN_HEIGHT; y++) {
    if (zxnextRenderRowOff(ZXNEXT_STANDARD_SCREEN_Y + y)) continue;
    uint32_t outputOffset = (ZXNEXT_STANDARD_SCREEN_Y + y) * ZXNEXT_SCREEN_WIDTH + ZXNEXT_STANDARD_SCREEN_X;
    uint32_t sourceY = (y + ulaScrollY) % ZXNEXT_STANDARD_SCREEN_HEIGHT;
    for (uint32_t xByte = 0; xByte < 32u; xByte++) {
      uint32_t logicalX = xByte * 8u;
      uint32_t outputPixel = outputOffset + xByte * 8u * ZXNEXT_STANDARD_SCREEN_SCALE_X;
      for (uint32_t bit = 0; bit < 8u; bit++) {
        uint32_t x = logicalX + bit;
        uint32_t pixelOffset = outputPixel + bit * ZXNEXT_STANDARD_SCREEN_SCALE_X;
        if (zxnextUlaIsClipped(x, y)) {
          zxnextRenderTarget[pixelOffset] = fallbackPixel;
          zxnextRenderTarget[pixelOffset + 1u] = fallbackPixel;
          continue;
        }
        uint32_t sourceX = (x + ulaScrollX) & 0xffu;
        uint32_t sourceXByte = sourceX >> 3u;
        uint32_t pixelAddr = zxnextUlaBitmapAddress(sourceY, sourceXByte);
        uint8_t pixels = (uint8_t)zxnextMemoryReadScreenOffset(pixelAddr);
        uint8_t attr = (uint8_t)zxnextMemoryReadScreenOffset(0x2000u | pixelAddr);
        uint32_t mask = 0x80u >> (sourceX & 0x07u);
        uint32_t pixel = zxnextUlaPaletteColor(zxnextUlaAttrPaletteIndex(attr, (pixels & mask) != 0u));
        zxnextRenderTarget[pixelOffset] = pixel;
        zxnextRenderTarget[pixelOffset + 1u] = pixel;
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
    if (zxnextRenderRowOff(ZXNEXT_STANDARD_SCREEN_Y + y)) continue;
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
      zxnextRenderTarget[outputOffset + x] = zxnextUlaLayer2PaletteColor(paletteIndex);
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
    if (zxnextRenderRowOff(ZXNEXT_LAYER2_WIDE_SCREEN_Y + y)) continue;
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
      zxnextRenderTarget[outputOffset + x] = zxnextUlaLayer2PaletteColor(paletteIndex);
    }
  }
}

static void zxnextUlaRenderLayer2_640x256Screen(void) {
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
    if (zxnextRenderRowOff(ZXNEXT_LAYER2_WIDE_SCREEN_Y + y)) continue;
    if (y < clipY1 || y > clipY2) continue;
    uint32_t sourceY = (y + scrollY) & 0xffu;
    uint32_t outputOffset = (ZXNEXT_LAYER2_WIDE_SCREEN_Y + y) * ZXNEXT_SCREEN_WIDTH + ZXNEXT_LAYER2_WIDE_SCREEN_X;
    for (uint32_t displayClockX = 0; displayClockX < ZXNEXT_LAYER2_320_SCREEN_WIDTH; displayClockX++) {
      if (displayClockX < clipX1 || displayClockX > clipX2) continue;

      uint32_t sourceX = zxnextUlaLayer2WideWrappedX(displayClockX + scrollX);
      uint32_t pixelByte = zxnextUlaReadLayer2Pixel(bank16, (sourceX << 8u) | sourceY);
      uint32_t outputPixel = outputOffset + (displayClockX << 1u);

      uint32_t paletteIndex1 = (paletteOffset << 4u) | ((pixelByte >> 4u) & 0x0fu);
      if (paletteIndex1 != transparentIndex) {
        zxnextRenderTarget[outputPixel] = zxnextUlaLayer2PaletteColor(paletteIndex1);
      }

      uint32_t paletteIndex2 = (paletteOffset << 4u) | (pixelByte & 0x0fu);
      if (paletteIndex2 != transparentIndex) {
        zxnextRenderTarget[outputPixel + 1u] = zxnextUlaLayer2PaletteColor(paletteIndex2);
      }
    }
  }
}

/*
 * A sprite's attributes as the FPGA's `spr_cur_attr_*` see them: relative sprites composed onto
 * their anchor, and every field decoded once.
 */
typedef struct {
  uint8_t visible;
  uint16_t x;
  uint16_t y;
  uint8_t paletteOffset;
  uint8_t xmirror;
  uint8_t ymirror;
  uint8_t rotate;
  uint8_t scaleX;
  uint8_t scaleY;
  uint8_t is4Bit;
  /* The 7-bit pattern number, `N5..N0 & N6` (FPGA `spr_rel_pattern`). */
  uint8_t pattern7;
} ZxnextResolvedSprite;

static ZxnextResolvedSprite zxnextUlaResolvedSprites[128];

/*
 * Which sprite-space pixels (320 x 256) a sprite has already written this render, for collision
 * detection. One byte per pixel, cleared at the start of each sprite pass.
 */
#define ZXNEXT_SPRITE_SPACE_WIDTH 320u
#define ZXNEXT_SPRITE_SPACE_HEIGHT 256u
static uint8_t zxnextUlaSpriteCoverage[ZXNEXT_SPRITE_SPACE_WIDTH * ZXNEXT_SPRITE_SPACE_HEIGHT];

static uint32_t zxnextUlaSignExtendScale9(uint32_t value8, uint32_t scale) {
  uint32_t value9 = (value8 & 0x80u) ? (value8 | 0x100u) : value8;
  return (value9 << scale) & 0x1ffu;
}

/*
 * Resolve every sprite up to `lastVisible` in index order, as the FPGA qualifies them.
 *
 * Follows `_input/next-fpga/src/video/sprites.vhd` ("sort out relative sprite characteristics" and
 * the anchor latch in `S_QUALIFY`):
 *
 * - A sprite is **relative** when it has five attribute bytes and attr4 bits 7:6 are `01`. Every
 *   other sprite, visible or not, becomes the anchor for the relative sprites after it.
 * - An anchor's attr4 is `H N6 T XX YY Y8`: H selects 4-bit patterns, N6 is the 7th pattern bit (only
 *   meaningful with H), and T is the relative type — with T set, relatives inherit the anchor's
 *   rotation, mirroring and scale. X's ninth bit is attr2 bit 0, Y's is attr4 bit 0.
 * - A relative's attr0/attr1 are signed offsets, rotated, mirrored and scaled by the anchor's
 *   transform (all zero for T clear) and added to its position. It inherits H, takes N6 from its own
 *   attr4 bit 5, adds the anchor's pattern when attr4 bit 0 is set, adds the anchor's palette offset
 *   when attr2 bit 0 is set, and is visible only when the anchor is.
 */
static void zxnextUlaResolveSprites(uint32_t lastVisible) {
  uint32_t anchorVisible = 0u;
  uint32_t anchorRelType = 0u;
  uint32_t anchorH = 0u;
  uint32_t anchorX = 0u;
  uint32_t anchorY = 0u;
  uint32_t anchorPattern = 0u;
  uint32_t anchorPaletteOffset = 0u;
  uint32_t anchorRotate = 0u;
  uint32_t anchorXmirror = 0u;
  uint32_t anchorYmirror = 0u;
  uint32_t anchorScaleX = 0u;
  uint32_t anchorScaleY = 0u;

  for (uint32_t sprite = 0u; sprite <= lastVisible && sprite < 128u; sprite++) {
    uint32_t attr0 = zxnextSpritesGetAttribute(sprite, 0) & 0xffu;
    uint32_t attr1 = zxnextSpritesGetAttribute(sprite, 1) & 0xffu;
    uint32_t attr2 = zxnextSpritesGetAttribute(sprite, 2) & 0xffu;
    uint32_t attr3 = zxnextSpritesGetAttribute(sprite, 3) & 0xffu;
    uint32_t attr4 = zxnextSpritesGetAttribute(sprite, 4) & 0xffu;
    uint32_t has5Attrs = (attr3 & 0x40u) != 0u;
    uint32_t relative = has5Attrs && ((attr4 >> 6u) & 0x03u) == 0x01u;
    ZxnextResolvedSprite* out = &zxnextUlaResolvedSprites[sprite];

    if (!relative) {
      uint32_t h = has5Attrs && (attr4 & 0x80u);
      uint32_t n6 = h && (attr4 & 0x40u);
      out->visible = (attr3 & 0x80u) != 0u;
      out->x = (uint16_t)(((attr2 & 0x01u) << 8u) | attr0);
      out->y = (uint16_t)(((has5Attrs ? (attr4 & 0x01u) : 0u) << 8u) | attr1);
      out->paletteOffset = (uint8_t)(attr2 >> 4u);
      out->xmirror = (attr2 & 0x08u) != 0u;
      out->ymirror = (attr2 & 0x04u) != 0u;
      out->rotate = (attr2 & 0x02u) != 0u;
      out->scaleX = has5Attrs ? (uint8_t)((attr4 >> 3u) & 0x03u) : 0u;
      out->scaleY = has5Attrs ? (uint8_t)((attr4 >> 1u) & 0x03u) : 0u;
      out->is4Bit = (uint8_t)h;
      out->pattern7 = (uint8_t)(((attr3 & 0x3fu) << 1u) | n6);

      anchorVisible = out->visible;
      anchorRelType = has5Attrs && (attr4 & 0x20u);
      anchorH = h;
      anchorX = out->x;
      anchorY = out->y;
      anchorPattern = out->pattern7;
      anchorPaletteOffset = out->paletteOffset;
      if (anchorRelType) {
        anchorRotate = out->rotate;
        anchorXmirror = out->xmirror;
        anchorYmirror = out->ymirror;
        anchorScaleX = out->scaleX;
        anchorScaleY = out->scaleY;
      } else {
        anchorRotate = 0u;
        anchorXmirror = 0u;
        anchorYmirror = 0u;
        anchorScaleX = 0u;
        anchorScaleY = 0u;
      }
      continue;
    }

    // --- Relative sprite (`spr_rel_*`).
    uint32_t x0 = anchorRotate ? attr1 : attr0;
    uint32_t y0 = anchorRotate ? attr0 : attr1;
    uint32_t x1 = (anchorRotate ^ anchorXmirror) ? ((~x0 + 1u) & 0xffu) : x0;
    uint32_t y1 = anchorYmirror ? ((~y0 + 1u) & 0xffu) : y0;
    uint32_t x3 = (anchorX + zxnextUlaSignExtendScale9(x1, anchorScaleX)) & 0x1ffu;
    uint32_t y3 = (anchorY + zxnextUlaSignExtendScale9(y1, anchorScaleY)) & 0x1ffu;

    uint32_t ownXmirror = (attr2 >> 3u) & 1u;
    uint32_t ownYmirror = (attr2 >> 2u) & 1u;
    uint32_t ownRotate = (attr2 >> 1u) & 1u;

    out->visible = anchorVisible && (attr3 & 0x80u);
    out->x = (uint16_t)x3;
    out->y = (uint16_t)y3;
    out->paletteOffset = (uint8_t)((attr2 & 0x01u)
      ? ((anchorPaletteOffset + (attr2 >> 4u)) & 0x0fu)
      : (attr2 >> 4u));
    if (anchorRelType) {
      uint32_t relXmirror = anchorRotate ? (ownYmirror ^ ownRotate) : ownXmirror;
      uint32_t relYmirror = anchorRotate ? (ownXmirror ^ ownRotate) : ownYmirror;
      out->xmirror = (uint8_t)(anchorXmirror ^ relXmirror);
      out->ymirror = (uint8_t)(anchorYmirror ^ relYmirror);
      out->rotate = (uint8_t)(anchorRotate ^ ownRotate);
      out->scaleX = (uint8_t)anchorScaleX;
      out->scaleY = (uint8_t)anchorScaleY;
    } else {
      out->xmirror = (uint8_t)ownXmirror;
      out->ymirror = (uint8_t)ownYmirror;
      out->rotate = (uint8_t)ownRotate;
      out->scaleX = (uint8_t)((attr4 >> 3u) & 0x03u);
      out->scaleY = (uint8_t)((attr4 >> 1u) & 0x03u);
    }
    out->is4Bit = (uint8_t)anchorH;
    uint32_t n6 = anchorH && (attr4 & 0x20u);
    uint32_t pattern7 = ((attr3 & 0x3fu) << 1u) | n6;
    if (attr4 & 0x01u) pattern7 = (pattern7 + anchorPattern) & 0x7fu;
    out->pattern7 = (uint8_t)pattern7;
  }
}

/*
 * One pass over the visible sprites, which either draws them or detects collisions — never both.
 *
 * The picture is built whole-frame, and only when the display asks for it (`zxnextRenderInstantScreen`),
 * so drawing cannot be where the hardware's collision flag is raised: a machine running with no display
 * would never see it, and a display refreshed twice would raise it twice for one frame. Collisions are
 * detected once per emulated frame instead, from `zxnextUlaOnFrameCompleted`.
 */
static void zxnextUlaProcessSprites(uint32_t drawPixels, uint32_t detectCollisions);

static void zxnextUlaRenderSpritesScreen(void) { zxnextUlaProcessSprites(1u, 0u); }

static void zxnextUlaProcessSprites(uint32_t drawPixels, uint32_t detectCollisions) {
  if (!zxnextSpritesGetEnabled()) return;
  uint32_t lastVisible = zxnextSpritesGetLastVisibleSpriteIndex();
  if (lastVisible == 0xffffffffu) return;
  if (lastVisible > 127u) lastVisible = 127u;

  uint32_t clipX1;
  uint32_t clipX2;
  uint32_t clipY1;
  uint32_t clipY2;
  if (zxnextSpritesGetOverBorderEnabled()) {
    if (zxnextSpritesGetClippingEnabled()) {
      clipX1 = zxnextSpritesGetClip(0) << 1u;
      clipX2 = (zxnextSpritesGetClip(1) << 1u) | 1u;
      clipY1 = zxnextSpritesGetClip(2);
      clipY2 = zxnextSpritesGetClip(3);
    } else {
      clipX1 = 0u;
      clipX2 = 319u;
      clipY1 = 0u;
      clipY2 = 255u;
    }
  } else {
    clipX1 = zxnextSpritesGetClip(0) + 32u;
    clipX2 = zxnextSpritesGetClip(1) + 32u;
    clipY1 = zxnextSpritesGetClip(2) + 32u;
    clipY2 = zxnextSpritesGetClip(3) + 32u;
  }

  zxnextUlaResolveSprites(lastVisible);
  if (detectCollisions) {
    for (uint32_t i = 0u; i < ZXNEXT_SPRITE_SPACE_WIDTH * ZXNEXT_SPRITE_SPACE_HEIGHT; i++) {
      zxnextUlaSpriteCoverage[i] = 0u;
    }
  }
  uint32_t collision = 0u;

  int32_t start = zxnextSpritesGetSprite0OnTop() ? (int32_t)lastVisible : 0;
  int32_t end = zxnextSpritesGetSprite0OnTop() ? -1 : (int32_t)lastVisible + 1;
  int32_t step = zxnextSpritesGetSprite0OnTop() ? -1 : 1;
  uint32_t transparencyIndex = zxnextSpritesGetTransparencyIndex();

  for (int32_t sprite = start; sprite != end; sprite += step) {
    const ZxnextResolvedSprite* resolved = &zxnextUlaResolvedSprites[sprite];
    if (!resolved->visible) continue;

    uint32_t is4Bit = resolved->is4Bit;
    uint32_t transformVariant =
      (resolved->rotate ? 4u : 0u) | (resolved->xmirror ? 2u : 0u) | (resolved->ymirror ? 1u : 0u);
    /*
     * The 7-bit pattern number (FPGA `spr_rel_pattern`) names a 4-bit pattern directly; an 8-bit
     * pattern is its top six bits, since N6 is only ever set for a 4-bit sprite.
     */
    uint32_t patternVariantIndex = is4Bit
      ? (((uint32_t)resolved->pattern7 << 3u) | transformVariant)
      : ((((uint32_t)resolved->pattern7 >> 1u) << 3u) | transformVariant);
    uint32_t scaleX = resolved->scaleX;
    uint32_t scaleY = resolved->scaleY;
    /*
     * Scale is applied in screen space and is not swapped by rotation: the FPGA counts the width
     * with the XX scale and the height with YY whatever the rotate bit says.
     */
    uint32_t width = 16u << scaleX;
    uint32_t height = 16u << scaleY;
    int32_t spriteX = (int32_t)resolved->x;
    int32_t spriteY = (int32_t)resolved->y;
    if (spriteX > 319) spriteX -= 512;
    if (spriteY > 255) spriteY -= 512;
    uint32_t paletteOffset = resolved->paletteOffset;

    for (uint32_t py = 0u; py < height; py++) {
      int32_t displayY = spriteY + (int32_t)py;
      if (displayY < 0 || displayY >= (int32_t)ZXNEXT_LAYER2_WIDE_SCREEN_HEIGHT) continue;
      if (drawPixels && !detectCollisions && zxnextRenderRowOff(ZXNEXT_LAYER2_WIDE_SCREEN_Y + (uint32_t)displayY)) continue;
      /*
       * Clipping applies to what is *shown*, not to what the sprite engine writes: the FPGA fills its
       * line buffer for the whole 320-pixel line and clips on output. Collisions are detected on the
       * line buffer, so a pixel outside the clip window still collides.
       */
      uint32_t rowClipped = displayY < (int32_t)clipY1 || displayY > (int32_t)clipY2;

      uint32_t patternY = (py >> scaleY) & 0x0fu;
      uint32_t outputOffset = (ZXNEXT_LAYER2_WIDE_SCREEN_Y + (uint32_t)displayY) *
        ZXNEXT_SCREEN_WIDTH + ZXNEXT_LAYER2_WIDE_SCREEN_X;
      uint32_t coverageRow = (uint32_t)displayY * ZXNEXT_SPRITE_SPACE_WIDTH;

      for (uint32_t px = 0u; px < width; px++) {
        int32_t displayX = spriteX + (int32_t)px;
        if (displayX < 0 || displayX >= (int32_t)ZXNEXT_LAYER2_320_SCREEN_WIDTH) continue;

        uint32_t patternX = (px >> scaleX) & 0x0fu;
        uint32_t patternOffset = (patternY << 4u) | patternX;
        uint32_t paletteIndex;
        if (is4Bit) {
          // --- A nibble; transparent when it equals the low nibble of Reg $4B (`spr_line_we`).
          uint32_t nibble = zxnextSpritesGetPatternByte4(patternVariantIndex, patternOffset) & 0x0fu;
          if (nibble == (transparencyIndex & 0x0fu)) continue;
          paletteIndex = (paletteOffset << 4u) | nibble;
        } else {
          // --- A whole byte; the palette offset is added to its high nibble.
          uint32_t pixelByte = zxnextSpritesGetPatternByte8(patternVariantIndex, patternOffset) & 0xffu;
          if (pixelByte == (transparencyIndex & 0xffu)) continue;
          paletteIndex = ((((pixelByte >> 4u) + paletteOffset) & 0x0fu) << 4u) | (pixelByte & 0x0fu);
        }

        if (detectCollisions) {
          // --- An opaque pixel onto one another sprite already wrote: a collision.
          uint8_t* covered = &zxnextUlaSpriteCoverage[coverageRow + (uint32_t)displayX];
          if (*covered) collision = 1u;
          *covered = 1u;
          continue;
        }

        if (!drawPixels || rowClipped || displayX < (int32_t)clipX1 || displayX > (int32_t)clipX2) continue;
        uint32_t outputPixel = outputOffset + ((uint32_t)displayX << 1u);
        uint32_t color = zxnextUlaSpritePaletteColor(paletteIndex);
        zxnextRenderTarget[outputPixel] = color;
        zxnextRenderTarget[outputPixel + 1u] = color;
      }
    }
  }
  if (collision) zxnextSpritesSignalCollision();
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

static uint32_t zxnextUlaTilemapTextTransparent(uint32_t paletteEntry) {
  return (paletteEntry & 0x1feu) == ((uint32_t)zxnextNextRegs[0x14u] << 1u);
}

static void zxnextUlaUnpackTilemapTextPattern(uint32_t patternByte, uint8_t* buffer) {
  buffer[0] = (uint8_t)((patternByte >> 7u) & 0x01u);
  buffer[1] = (uint8_t)((patternByte >> 6u) & 0x01u);
  buffer[2] = (uint8_t)((patternByte >> 5u) & 0x01u);
  buffer[3] = (uint8_t)((patternByte >> 4u) & 0x01u);
  buffer[4] = (uint8_t)((patternByte >> 3u) & 0x01u);
  buffer[5] = (uint8_t)((patternByte >> 2u) & 0x01u);
  buffer[6] = (uint8_t)((patternByte >> 1u) & 0x01u);
  buffer[7] = (uint8_t)(patternByte & 0x01u);
}

static void zxnextUlaRenderTilemapTextPixelPair(
  uint32_t outputOffset,
  uint32_t paletteIndex,
  uint32_t clipped,
  uint32_t belowUla
) {
  if (clipped || belowUla) return;
  if (zxnextUlaTilemapTextTransparent(zxnextPaletteGetTilemapEntry(paletteIndex))) return;
  uint32_t color = zxnextUlaTilemapPaletteColor(paletteIndex);
  zxnextRenderTarget[outputOffset] = color;
  zxnextRenderTarget[outputOffset + 1u] = color;
}

static void zxnextUlaRenderTilemapText_40x32Screen(void) {
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
  uint32_t clipX1 = zxnextTilemapGetClip(0) << 1u;
  uint32_t clipX2 = (zxnextTilemapGetClip(1) << 1u) | 0x01u;
  uint32_t clipY1 = zxnextTilemapGetClip(2);
  uint32_t clipY2 = zxnextTilemapGetClip(3);

  uint8_t buffer0[8] = {0};
  uint8_t buffer1[8] = {0};
  uint32_t currentBuffer = 0u;
  uint32_t bufferPosition = 0u;
  uint32_t currentTileIndex = 0u;
  uint32_t currentAttr = 0u;
  uint32_t tileAttr = 0u;
  uint32_t nextTileAttr = 0u;
  uint32_t tilePriority = 0u;
  uint32_t nextTilePriority = 0u;
  uint32_t sampledEliminateAttrs = eliminateAttrs;
  uint32_t sampledTile512Mode = tile512Mode;

  for (uint32_t y = 0; y < ZXNEXT_LAYER2_WIDE_SCREEN_HEIGHT; y++) {
    if (zxnextRenderRowOff(ZXNEXT_LAYER2_WIDE_SCREEN_Y + y)) continue;
    uint32_t sourceY = (y + scrollY) & 0xffu;
    for (int32_t displayX = -8; displayX < 320; displayX++) {
      if (displayX >= 0 && ((((uint32_t)displayX) & 0x07u) == 0u)) {
        sampledEliminateAttrs = eliminateAttrs;
        sampledTile512Mode = tile512Mode;
      }

      int32_t fetchX = displayX + 8;
      if (fetchX >= 0 && fetchX < 320) {
        uint32_t fetchAbsX = ((uint32_t)fetchX + scrollX) % ZXNEXT_LAYER2_320_SCREEN_WIDTH;
        uint32_t fetchAbsY = sourceY;
        uint32_t tileArrayIndex = (fetchAbsY >> 3u) * 40u + (fetchAbsX >> 3u);
        uint32_t tileIndexAddr = sampledEliminateAttrs ? tileArrayIndex : tileArrayIndex << 1u;
        uint32_t hcInTile = (uint32_t)displayX & 0x07u;

        if (hcInTile == 6u) {
          currentTileIndex = zxnextUlaReadTilemapVram(useBank7, baseMsb, tileIndexAddr);
        }
        if (hcInTile == 7u) {
          if (sampledTile512Mode && !sampledEliminateAttrs) {
            currentAttr = zxnextUlaReadTilemapVram(useBank7, baseMsb, tileIndexAddr + 1u);
            currentTileIndex |= (currentAttr & 0x01u) << 8u;
          } else if (!sampledEliminateAttrs) {
            currentAttr = zxnextUlaReadTilemapVram(useBank7, baseMsb, tileIndexAddr + 1u);
          } else {
            currentAttr = defaultAttr;
          }
          nextTileAttr = currentAttr;
          nextTilePriority = sampledTile512Mode ? 0u : ((currentAttr & 0x01u) != 0u);

          uint8_t* nextBuffer = currentBuffer == 0u ? buffer1 : buffer0;
          uint32_t patternAddr = currentTileIndex * 8u + (fetchAbsY & 0x07u);
          uint32_t patternByte = zxnextUlaReadTilemapVram(defUseBank7, defMsb, patternAddr);
          zxnextUlaUnpackTilemapTextPattern(patternByte, nextBuffer);
        }
      }

      if (displayX < 0) continue;
      if ((((uint32_t)displayX) & 0x07u) == 0u) {
        bufferPosition = 0u;
        tileAttr = sampledEliminateAttrs ? defaultAttr : nextTileAttr;
        tilePriority = nextTilePriority;
        currentBuffer = 1u - currentBuffer;
      }

      uint8_t* current = currentBuffer == 0u ? buffer0 : buffer1;
      uint32_t pixelValue = current[bufferPosition++ & 0x07u];
      uint32_t paletteIndex = (((tileAttr >> 1u) << 1u) | pixelValue) & 0xffu;
      uint32_t clipped = ((uint32_t)displayX < clipX1) || ((uint32_t)displayX > clipX2) || y < clipY1 || y > clipY2;
      uint32_t belowUla = !forceOnTop && tilePriority;
      uint32_t outputOffset = (ZXNEXT_LAYER2_WIDE_SCREEN_Y + y) * ZXNEXT_SCREEN_WIDTH + ZXNEXT_LAYER2_WIDE_SCREEN_X + ((uint32_t)displayX << 1u);
      zxnextUlaRenderTilemapTextPixelPair(outputOffset, paletteIndex, clipped, belowUla);
    }
  }
}

static void zxnextUlaRenderTilemapText_80x32Screen(void) {
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
  uint32_t clipX1 = zxnextTilemapGetClip(0) << 1u;
  uint32_t clipX2 = (zxnextTilemapGetClip(1) << 1u) | 0x01u;
  uint32_t clipY1 = zxnextTilemapGetClip(2);
  uint32_t clipY2 = zxnextTilemapGetClip(3);

  uint8_t buffer0[8] = {0};
  uint8_t buffer1[8] = {0};
  uint32_t currentBuffer = 0u;
  uint32_t bufferPosition = 0u;
  uint32_t currentTileIndex = 0u;
  uint32_t currentAttr = 0u;
  uint32_t tileAttr = 0u;
  uint32_t nextTileAttr = 0u;
  uint32_t tilePriority = 0u;
  uint32_t nextTilePriority = 0u;
  uint32_t sampledEliminateAttrs = eliminateAttrs;
  uint32_t sampledTile512Mode = tile512Mode;

  for (uint32_t y = 0; y < ZXNEXT_LAYER2_WIDE_SCREEN_HEIGHT; y++) {
    if (zxnextRenderRowOff(ZXNEXT_LAYER2_WIDE_SCREEN_Y + y)) continue;
    uint32_t sourceY = (y + scrollY) & 0xffu;
    for (int32_t displayClockX = -8; displayClockX < 320; displayClockX++) {
      if (displayClockX >= 0 && ((((uint32_t)displayClockX) & 0x03u) == 0u)) {
        sampledEliminateAttrs = eliminateAttrs;
        sampledTile512Mode = tile512Mode;
      }

      int32_t fetchX = displayClockX + 4;
      if (fetchX >= 0 && fetchX < 320) {
        uint32_t fetchAbsX = ((uint32_t)fetchX + scrollX) % ZXNEXT_LAYER2_320_SCREEN_WIDTH;
        uint32_t fetchAbsY = sourceY;
        uint32_t tileArrayIndex = (fetchAbsY >> 3u) * 80u + (fetchAbsX >> 2u);
        uint32_t tileIndexAddr = sampledEliminateAttrs ? tileArrayIndex : tileArrayIndex << 1u;
        uint32_t hcInTile = (uint32_t)displayClockX & 0x03u;

        if (hcInTile == 1u) {
          currentTileIndex = zxnextUlaReadTilemapVram(useBank7, baseMsb, tileIndexAddr);
        }
        if (hcInTile == 2u) {
          if (sampledTile512Mode && !sampledEliminateAttrs) {
            currentAttr = zxnextUlaReadTilemapVram(useBank7, baseMsb, tileIndexAddr + 1u);
            currentTileIndex |= (currentAttr & 0x01u) << 8u;
          } else if (!sampledEliminateAttrs) {
            currentAttr = zxnextUlaReadTilemapVram(useBank7, baseMsb, tileIndexAddr + 1u);
          } else {
            currentAttr = defaultAttr;
          }
          nextTileAttr = currentAttr;
          nextTilePriority = sampledTile512Mode ? 0u : ((currentAttr & 0x01u) != 0u);
        }
        if (hcInTile == 3u) {
          uint8_t* nextBuffer = currentBuffer == 0u ? buffer1 : buffer0;
          uint32_t patternAddr = currentTileIndex * 8u + (fetchAbsY & 0x07u);
          uint32_t patternByte = zxnextUlaReadTilemapVram(defUseBank7, defMsb, patternAddr);
          zxnextUlaUnpackTilemapTextPattern(patternByte, nextBuffer);
        }
      }

      if (displayClockX < 0) continue;
      if ((((uint32_t)displayClockX) & 0x03u) == 0u) {
        bufferPosition = 0u;
        tileAttr = sampledEliminateAttrs ? defaultAttr : nextTileAttr;
        tilePriority = nextTilePriority;
        currentBuffer = 1u - currentBuffer;
      }

      uint8_t* current = currentBuffer == 0u ? buffer0 : buffer1;
      uint32_t clippedY = y < clipY1 || y > clipY2;
      uint32_t belowUla = !forceOnTop && tilePriority;
      uint32_t outputOffset = (ZXNEXT_LAYER2_WIDE_SCREEN_Y + y) * ZXNEXT_SCREEN_WIDTH + ZXNEXT_LAYER2_WIDE_SCREEN_X + ((uint32_t)displayClockX << 1u);

      uint32_t pixelValue1 = current[bufferPosition++ & 0x07u];
      uint32_t paletteIndex1 = (((tileAttr >> 1u) << 1u) | pixelValue1) & 0xffu;
      uint32_t clipped1 = clippedY || ((uint32_t)displayClockX < clipX1) || ((uint32_t)displayClockX > clipX2);
      if (!clipped1 && !belowUla && !zxnextUlaTilemapTextTransparent(zxnextPaletteGetTilemapEntry(paletteIndex1))) {
        zxnextRenderTarget[outputOffset] = zxnextUlaTilemapPaletteColor(paletteIndex1);
      }

      uint32_t pixelValue2 = current[bufferPosition++ & 0x07u];
      uint32_t paletteIndex2 = (((tileAttr >> 1u) << 1u) | pixelValue2) & 0xffu;
      uint32_t displayX2 = (uint32_t)displayClockX + 1u;
      uint32_t clipped2 = clippedY || displayX2 < clipX1 || displayX2 > clipX2;
      if (!clipped2 && !belowUla && !zxnextUlaTilemapTextTransparent(zxnextPaletteGetTilemapEntry(paletteIndex2))) {
        zxnextRenderTarget[outputOffset + 1u] = zxnextUlaTilemapPaletteColor(paletteIndex2);
      }
    }
  }
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
    if (zxnextRenderRowOff(ZXNEXT_LAYER2_WIDE_SCREEN_Y + y)) continue;
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
      zxnextRenderTarget[outputOffset + x] = zxnextUlaTilemapPaletteColor(paletteIndex);
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
    if (zxnextRenderRowOff(ZXNEXT_LAYER2_WIDE_SCREEN_Y + y)) continue;
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
      zxnextRenderTarget[outputOffset + x] = zxnextUlaTilemapPaletteColor(paletteIndex);
    }
  }
}

static uint32_t zxnextUlaRenderInstantScreen(void) {
  uint32_t timexMode = portTimexValue & 0x07u;
  uint32_t borderPixel = timexMode >= 0x04u ? zxnextUlaHiResPaperColor() : zxnextUlaColor(borderColor, 0u);
  for (uint32_t i = zxnextRenderRowFirst * ZXNEXT_SCREEN_WIDTH; i < (zxnextRenderRowLast + 1u) * ZXNEXT_SCREEN_WIDTH; i++) {
    zxnextRenderTarget[i] = borderPixel;
  }
  if (ulaDisableOutput) {
    /* Keep border-only frame; ULA output is disabled before later layers compose. */
  } else if (zxnextLoResGetEnabled()) {
    zxnextUlaRenderLoResScreen();
  } else if (timexMode == 0x02u || timexMode == 0x03u) {
    zxnextUlaRenderHiColorScreen();
  } else if (timexMode >= 0x04u) {
    zxnextUlaRenderHiResScreen();
  } else {
    zxnextUlaRenderStandardScreen();
  }
  if (zxnextTilemapGetEnabled()) {
    if (zxnextTilemapGetTextMode()) {
      if (zxnextTilemapGet80x32Resolution()) {
        zxnextUlaRenderTilemapText_80x32Screen();
      } else {
        zxnextUlaRenderTilemapText_40x32Screen();
      }
    } else if (zxnextTilemapGet80x32Resolution()) {
      zxnextUlaRenderTilemap_80x32Screen();
    } else {
      zxnextUlaRenderTilemap_40x32Screen();
    }
  }
  if (zxnextLayer2GetEnabled() && zxnextLayer2GetResolution() == 0u) {
    zxnextUlaRenderLayer2_256x192Screen();
  } else if (zxnextLayer2GetEnabled() && zxnextLayer2GetResolution() == 1u) {
    zxnextUlaRenderLayer2_320x256Screen();
  } else if (zxnextLayer2GetEnabled() && zxnextLayer2GetResolution() == 2u) {
    zxnextUlaRenderLayer2_640x256Screen();
  }
  zxnextUlaRenderSpritesScreen();
  return ZXNEXT_PIXEL_COUNT;
}

static void zxnextUlaOnFrameCompleted(void) {
  zxnextUlaProcessSprites(0u, 1u);
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
    case 0x68u:
      ulaDisableOutput = (byteValue & 0x80u) != 0u;
      ulaBlendingInSluModes = (byteValue >> 5u) & 0x03u;
      ulaHalfPixelScroll = (byteValue & 0x04u) != 0u;
      ulaEnableStencilMode = (byteValue & 0x01u) != 0u;
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
    case 0x68u:
      return (ulaDisableOutput ? 0x80u : 0u) |
        ((uint32_t)ulaBlendingInSluModes << 5u) |
        (ulaHalfPixelScroll ? 0x04u : 0u) |
        (ulaEnableStencilMode ? 0x01u : 0u);
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

// ---------------------------------------------------------------------------
// Beam-racing raster
//
// The picture used to be produced only by zxnextRenderInstantScreen, once, from end-of-frame state,
// so anything that changed mid-frame - copper MOVEs, palette writes, border colour changes, per-line
// scroll - was invisible: the whole frame showed the last value. (The TypeScript core renders tact
// by tact and never had this problem.)
//
// The raster keeps the renderers but calls them lazily: just before a write that changes what the
// screen shows, it renders the pixels the beam has drawn since the previous such write - with the
// state *before* the write - and at frame completion it renders the rest. A frame with no mid-frame
// changes costs one whole-frame render, as before; each change adds only the rows it spans.
//
// Beam position -> buffer pixel follows the TypeScript core's tact-to-bitmap table
// (NextComposedScreenDevice.generateBitmapOffsetTable, Plus3_50Hz): 456 HC per line, bitmap row 0 at
// VC 16, bitmap x 0 at HC 96, two buffer pixels per HC.
//
// Not covered: writes to screen *memory* mid-frame (the region is rendered with the memory as it is
// at the next catch-up or at frame end).
// ---------------------------------------------------------------------------

#define ZXNEXT_RASTER_FIRST_VC 16u
#define ZXNEXT_RASTER_FIRST_HC 96u

static uint32_t zxnextRasterScratch[ZXNEXT_PIXEL_COUNT];
/* The frame tact a NextReg write happens at: set by the copper (which runs behind the CPU) while it
   writes; otherwise writes happen at currentFrameTact. */
static uint32_t zxnextNextRegWriteTactOverride = 0xffffffffu;
/* The first buffer pixel of this frame not yet rendered. */
static uint32_t zxnextRasterPixel;

static inline uint32_t zxnextRasterTactToPixel(uint32_t frameTact) {
  uint32_t vc = frameTact / ZXNEXT_SCREEN_TOTAL_HC;
  uint32_t hc = frameTact % ZXNEXT_SCREEN_TOTAL_HC;
  if (vc < ZXNEXT_RASTER_FIRST_VC) return 0u;
  uint32_t row = vc - ZXNEXT_RASTER_FIRST_VC;
  if (row >= ZXNEXT_SCREEN_HEIGHT) return ZXNEXT_PIXEL_COUNT;
  uint32_t x = hc < ZXNEXT_RASTER_FIRST_HC ? 0u : (hc - ZXNEXT_RASTER_FIRST_HC) * 2u;
  return row * ZXNEXT_SCREEN_WIDTH + x;
}

/* Renders buffer pixels [zxnextRasterPixel, endPixel) from the current state. */
static void zxnextRasterRenderTo(uint32_t endPixel) {
  if (endPixel > ZXNEXT_PIXEL_COUNT) endPixel = ZXNEXT_PIXEL_COUNT;
  uint32_t start = zxnextRasterPixel;
  if (endPixel <= start) return;

  // --- Render whole rows into the scratch buffer, then copy only the span the beam covered.
  zxnextRenderTarget = zxnextRasterScratch;
  zxnextRenderRowFirst = start / ZXNEXT_SCREEN_WIDTH;
  zxnextRenderRowLast = (endPixel - 1u) / ZXNEXT_SCREEN_WIDTH;
  zxnextUlaRenderInstantScreen();
  zxnextRenderTarget = zxnextPixelBuffer;
  zxnextRenderRowFirst = 0u;
  zxnextRenderRowLast = ZXNEXT_SCREEN_HEIGHT - 1u;

  for (uint32_t i = start; i < endPixel; i++) zxnextPixelBuffer[i] = zxnextRasterScratch[i];
  zxnextRasterPixel = endPixel;
}

/* Call just before a write that changes the picture, with the frame tact the write happens at. */
static void zxnextRasterCatchUp(uint32_t frameTact) {
  zxnextRasterRenderTo(zxnextRasterTactToPixel(frameTact));
}

/* Completes the frame's picture; called when the frame completes, before anything resets. */
static void zxnextRasterFinishFrame(void) {
  zxnextRasterRenderTo(ZXNEXT_PIXEL_COUNT);
  zxnextRasterPixel = 0u;
}

static void zxnextRasterReset(void) {
  zxnextRasterPixel = 0u;
}

/*
 * NextRegs whose value the renderers read. Anything else (MMU, sound, interrupts, CPU speed, copper
 * control, ...) cannot change a pixel, so writing it must not cost a render.
 */
static inline uint32_t zxnextRasterIsVideoNextReg(uint32_t reg) {
  switch (reg & 0xffu) {
    case 0x12u: case 0x13u: case 0x14u: case 0x15u: case 0x16u: case 0x17u: case 0x18u:
    case 0x19u: case 0x1au: case 0x1bu: case 0x1cu:
    case 0x26u: case 0x27u:
    case 0x2fu: case 0x30u: case 0x31u: case 0x32u: case 0x33u:
    case 0x34u: case 0x35u: case 0x36u: case 0x37u: case 0x38u: case 0x39u:
    case 0x41u: case 0x42u: case 0x43u: case 0x44u:
    case 0x4au: case 0x4bu: case 0x4cu:
    case 0x68u: case 0x69u: case 0x6au: case 0x6bu: case 0x6cu: case 0x6eu: case 0x6fu:
    case 0x70u: case 0x71u:
    case 0x75u: case 0x76u: case 0x77u: case 0x78u: case 0x79u:
      return 1u;
    default:
      return 0u;
  }
}
