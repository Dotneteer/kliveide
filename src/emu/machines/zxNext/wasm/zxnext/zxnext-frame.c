#include "zxnext-frame.h"
#include "zxnext-cpu.h"

static void zxnextFrameReset(void) {
  frames = 0;
  tacts = 0;
  currentFrameTact = 0;
  frameCompleted = 0;
}

static uint32_t zxnextFrameExecute(void) {
  frameCompleted = 0;
  while (frameCompleted == 0u) {
    zxnextCpuExecuteInstruction();
  }
  return 0;
}
