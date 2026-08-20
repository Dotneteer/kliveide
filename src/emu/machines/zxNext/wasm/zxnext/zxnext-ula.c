#include "zxnext-ula.h"
#include "zxnext-keyboard.h"
#include "zxnext-tape.h"

#define ZXNEXT_SCREEN_TOTAL_HC 456u
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

static uint32_t zxnextUlaRenderInstantScreen(void) {
  for (uint32_t i = 0; i < ZXNEXT_PIXEL_COUNT; i++) {
    zxnextPixelBuffer[i] = ZXNEXT_BLANK_BORDER_PIXEL;
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

static uint32_t zxnextUlaGetScanlineForTact(uint32_t tact) {
  return (tact % ZXNEXT_RENDERING_TACTS_IN_FRAME) / ZXNEXT_SCREEN_TOTAL_HC;
}

static uint32_t zxnextUlaGetColumnForTact(uint32_t tact) {
  return (tact % ZXNEXT_RENDERING_TACTS_IN_FRAME) % ZXNEXT_SCREEN_TOTAL_HC;
}
