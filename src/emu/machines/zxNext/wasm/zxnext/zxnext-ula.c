#include "zxnext-ula.h"
#include "zxnext-keyboard.h"
#include "zxnext-memory.h"
#include "zxnext-tape.h"

#define ZXNEXT_SCREEN_TOTAL_HC 456u
#define ZXNEXT_STANDARD_SCREEN_WIDTH 256u
#define ZXNEXT_STANDARD_SCREEN_HEIGHT 192u
#define ZXNEXT_STANDARD_SCREEN_X ((ZXNEXT_SCREEN_WIDTH - ZXNEXT_STANDARD_SCREEN_WIDTH) / 2u)
#define ZXNEXT_STANDARD_SCREEN_Y ((ZXNEXT_SCREEN_HEIGHT - ZXNEXT_STANDARD_SCREEN_HEIGHT) / 2u)
#define ZXNEXT_TRANSPARENT_PIXEL 0x00000000u
#define ZXNEXT_BLANK_BORDER_PIXEL 0xffb6b6b6u

static uint8_t ulaFlashCounter;
static uint8_t ulaFlashFlag;

static void zxnextUlaReset(void) {
  portFeValue = 0xffu;
  portTimexValue = 0u;
  borderColor = 7u;
  earBit = 0u;
  micBit = 0u;
  ulaFlashCounter = 0u;
  ulaFlashFlag = 0u;
  for (uint32_t i = 0; i < ZXNEXT_PIXEL_COUNT; i++) {
    zxnextPixelBuffer[i] = ZXNEXT_TRANSPARENT_PIXEL;
  }
}

static uint32_t zxnextUlaReadPortFe(uint32_t address) {
  uint8_t portValue = (uint8_t)zxnextKeyboardReadPort(address);
  uint8_t bit6 = 0u;
  if (earBit) bit6 = 0x40u;
  if (micBit && ((zxnextNextRegs[0x08u] & 0x01u) != 0u)) bit6 = 0x40u;
  return (portValue & 0xbfu) | bit6;
}

static void zxnextUlaWritePortFe(uint32_t value) {
  uint8_t byteValue = (uint8_t)value;
  portFeValue = byteValue;
  borderColor = byteValue & 0x07u;
  micBit = (byteValue & 0x08u) != 0u;
  earBit = (byteValue & 0x10u) != 0u;
  zxnextTapeProcessMicBit(micBit);
}

static uint32_t zxnextUlaColor(uint32_t color, uint32_t bright) {
  static const uint32_t normalColors[8] = {
    0xff000000u, 0xff0000b6u, 0xffb60000u, 0xffb600b6u,
    0xff00b600u, 0xff00b6b6u, 0xffb6b600u, 0xffb6b6b6u
  };
  static const uint32_t brightColors[8] = {
    0xff000000u, 0xff0000ffu, 0xffff0000u, 0xffff00ffu,
    0xff00ff00u, 0xff00ffffu, 0xffffff00u, 0xffffffffu
  };
  return bright ? brightColors[color & 0x07u] : normalColors[color & 0x07u];
}

static uint32_t zxnextUlaBitmapAddress(uint32_t y, uint32_t xByte) {
  return 0x4000u | ((y & 0xc0u) << 5u) | ((y & 0x07u) << 8u) | ((y & 0x38u) << 2u) | xByte;
}

static uint32_t zxnextUlaAttributeAddress(uint32_t y, uint32_t xByte) {
  return 0x5800u | ((y >> 3u) << 5u) | xByte;
}

static void zxnextUlaRenderStandardScreen(void) {
  for (uint32_t y = 0; y < ZXNEXT_STANDARD_SCREEN_HEIGHT; y++) {
    uint32_t outputOffset = (ZXNEXT_STANDARD_SCREEN_Y + y) * ZXNEXT_SCREEN_WIDTH + ZXNEXT_STANDARD_SCREEN_X;
    for (uint32_t xByte = 0; xByte < 32u; xByte++) {
      uint8_t pixels = (uint8_t)zxnextMemoryReadMapped(zxnextUlaBitmapAddress(y, xByte));
      uint8_t attr = (uint8_t)zxnextMemoryReadMapped(zxnextUlaAttributeAddress(y, xByte));
      uint32_t ink = attr & 0x07u;
      uint32_t paper = (attr >> 3u) & 0x07u;
      if ((attr & 0x80u) != 0u && ulaFlashFlag) {
        uint32_t swap = ink;
        ink = paper;
        paper = swap;
      }
      uint32_t inkPixel = zxnextUlaColor(ink, attr & 0x40u);
      uint32_t paperPixel = zxnextUlaColor(paper, attr & 0x40u);
      uint32_t outputPixel = outputOffset + xByte * 8u;
      for (uint32_t bit = 0; bit < 8u; bit++) {
        uint32_t mask = 0x80u >> bit;
        zxnextPixelBuffer[outputPixel + bit] = (pixels & mask) ? inkPixel : paperPixel;
      }
    }
  }
}

static uint32_t zxnextUlaRenderInstantScreen(void) {
  uint32_t borderPixel = zxnextUlaColor(borderColor, 0u);
  for (uint32_t i = 0; i < ZXNEXT_PIXEL_COUNT; i++) {
    zxnextPixelBuffer[i] = borderPixel;
  }
  zxnextUlaRenderStandardScreen();
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

static uint32_t zxnextUlaGetScanlineForTact(uint32_t tact) {
  return (tact % ZXNEXT_RENDERING_TACTS_IN_FRAME) / ZXNEXT_SCREEN_TOTAL_HC;
}

static uint32_t zxnextUlaGetColumnForTact(uint32_t tact) {
  return (tact % ZXNEXT_RENDERING_TACTS_IN_FRAME) % ZXNEXT_SCREEN_TOTAL_HC;
}
