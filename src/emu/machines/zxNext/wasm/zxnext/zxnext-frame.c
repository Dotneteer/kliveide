#include "zxnext-frame.h"
#include "zxnext-cpu.h"
#include "zxnext-audio-mixer.h"
#include "zxnext-psg.h"
#include "zxnext-sd.h"

static void zxnextFrameReset(void) {
  frames = 0;
  tacts = 0;
  frameTacts28 = 0;
  currentFrameTact = 0;
  frameCompleted = 0;
  totalContentionDelaySinceStart = 0;
  contentionDelaySincePause = 0;
}

static uint32_t zxnextFrameExecute(void) {
  frameCompleted = 0;
  zxnextPsgBeginFrame();
  zxnextAudioMixerBeginFrame();
  while (frameCompleted == 0u && zxnextSdGetHostCommand() == ZXNEXT_SD_HOST_COMMAND_NONE) {
    zxnextCpuExecuteInstruction();
  }
  return 0;
}
