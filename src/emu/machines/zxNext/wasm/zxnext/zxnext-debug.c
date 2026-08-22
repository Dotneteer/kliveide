#include "zxnext-debug.h"

static uint32_t debugSteps;

static void zxnextDebugReset(void) {
  debugSteps = 0;
}

static uint32_t zxnextDebugExecuteStep(void) {
  debugSteps++;
  tacts += 4;
  currentFrameTact = tacts % ZXNEXT_TACTS_IN_FRAME;
  frameCompleted = 0;
  return debugSteps;
}
