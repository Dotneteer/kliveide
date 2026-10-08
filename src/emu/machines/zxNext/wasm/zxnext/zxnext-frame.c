#include "zxnext-frame.h"
#include "zxnext-cpu.h"
#include "zxnext-audio-mixer.h"
#include "zxnext-psg.h"
#include "zxnext-sd.h"

/* The history recorder's stop check (`z80-history.c`, included later in this translation unit) */
static uint32_t z80HistoryStopNow(void);

/*
 * A frame has begun since the reset - here or through `zxnextBeginAudioFrame`, as the debug loop
 * begins its frames. With `frameCompleted` clear, that frame is still in progress - a history stop
 * target or the debug loop left it mid-way - and the next fast frame continues it instead of
 * beginning another (REVERSE_DEBUGGING_PLAN D4).
 */
static uint32_t zxnextFrameBegun;

static void zxnextFrameReset(void) {
  frames = 0;
  tacts = 0;
  frameTacts28 = 0;
  currentFrameTact = 0;
  frameCompleted = 0;
  zxnextFrameBegun = 0u;
  totalContentionDelaySinceStart = 0;
  contentionDelaySincePause = 0;
}

static uint32_t zxnextFrameExecute(void) {
  /* A frame a stop target or the debug loop left mid-way goes on where it stopped */
  if (frameCompleted != 0u || zxnextFrameBegun == 0u) {
    frameCompleted = 0;
    zxnextFrameBegun = 1u;
    zxnextBeeperBeginFrame();
    zxnextPsgBeginFrame();
    zxnextAudioMixerBeginFrame();
  }
  /* A fast frame logs no CPU accesses - unless the frame is traced, whose records carry one */
  zxnextCaptureBusEvents = zxnextTraceEnabled != 0u;
  while (frameCompleted == 0u && zxnextSdGetHostCommand() == ZXNEXT_SD_HOST_COMMAND_NONE && zxnextResetRequest == 0u) {
    zxnextCpuExecuteInstruction();
    /* Checked on the frame's last instruction too: the host reads the reached mark after the call */
    const uint32_t stop = z80HistoryStopNow();
    if (frameCompleted == 0u && stop != 0u) break;
  }
  zxnextCaptureBusEvents = 1u;
  return 0;
}
