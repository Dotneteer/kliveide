#include "zxnext-frame.h"

static void zxnextFrameResetScaffold(void) {
  frames = 0;
  tacts = 0;
  currentFrameTact = 0;
  frameCompleted = 0;
}

static uint32_t zxnextFrameExecuteScaffold(void) {
  frames++;
  tacts += ZXNEXT_TACTS_IN_FRAME;
  currentFrameTact = 0;
  frameCompleted = 1;
  return 0;
}

static uint32_t zxnextFrameRenderScaffold(void) {
  return ZXNEXT_PIXEL_COUNT;
}
