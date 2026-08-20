#include "zxnext-tape.h"

static uint8_t tapeMode;
static uint8_t tapeEarBit = 1u;

static void zxnextTapeReset(void) {
  tapeMode = ZXNEXT_TAPE_MODE_PASSIVE;
  tapeEarBit = 1u;
  micBit = 0u;
}

static void zxnextTapeSetMode(uint32_t mode) {
  tapeMode = (uint8_t)(mode > ZXNEXT_TAPE_MODE_SAVE ? ZXNEXT_TAPE_MODE_PASSIVE : mode);
}

static uint32_t zxnextTapeGetMode(void) {
  return tapeMode;
}

static uint32_t zxnextTapeGetEarBit(void) {
  return tapeEarBit;
}

static uint32_t zxnextTapeGetMicBit(void) {
  return micBit;
}

static void zxnextTapeProcessMicBit(uint32_t value) {
  if (tapeMode == ZXNEXT_TAPE_MODE_SAVE) {
    micBit = value != 0;
  }
}
