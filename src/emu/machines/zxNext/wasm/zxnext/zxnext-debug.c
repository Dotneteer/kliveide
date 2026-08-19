#include "zxnext-debug.h"

static uint32_t scaffoldDebugSteps;

static void zxnextDebugResetScaffold(void) {
  scaffoldDebugSteps = 0;
}

static uint32_t zxnextDebugExecuteScaffoldStep(void) {
  scaffoldDebugSteps++;
  tacts += 4;
  currentFrameTact = tacts % ZXNEXT_TACTS_IN_FRAME;
  frameCompleted = 0;
  return scaffoldDebugSteps;
}
