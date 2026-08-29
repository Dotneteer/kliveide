#include "zxnext-beeper.h"

#define ZXNEXT_BEEPER_TRANSITION_CAPACITY 8192u

static uint8_t zxnextBeeperEar;
static uint8_t zxnextBeeperMic;
static uint32_t zxnextBeeperTacts;
static double zxnextBeeperFrameStartTact;
static double zxnextBeeperSampleWindowStartTact;
static uint8_t zxnextBeeperSampleWindowStartEar;
static uint8_t zxnextBeeperSampleWindowStartMic;
static uint32_t zxnextBeeperTransitionCount;
static double zxnextBeeperTransitionTacts[ZXNEXT_BEEPER_TRANSITION_CAPACITY];
static uint8_t zxnextBeeperTransitionEar[ZXNEXT_BEEPER_TRANSITION_CAPACITY];
static uint8_t zxnextBeeperTransitionMic[ZXNEXT_BEEPER_TRANSITION_CAPACITY];
static uint32_t zxnextBeeperCachedLeftMilli;
static uint32_t zxnextBeeperCachedRightMilli;
static double zxnextBeeperCachedSampleEndTact;
static uint8_t zxnextBeeperCachedSampleValid;

static void zxnextBeeperReset(void) {
  zxnextBeeperEar = 0u;
  zxnextBeeperMic = 0u;
  zxnextBeeperTacts = 0u;
  zxnextBeeperFrameStartTact = 0.0;
  zxnextBeeperSampleWindowStartTact = 0.0;
  zxnextBeeperSampleWindowStartEar = 0u;
  zxnextBeeperSampleWindowStartMic = 0u;
  zxnextBeeperTransitionCount = 0u;
  zxnextBeeperCachedLeftMilli = 0u;
  zxnextBeeperCachedRightMilli = 0u;
  zxnextBeeperCachedSampleEndTact = 0.0;
  zxnextBeeperCachedSampleValid = 0u;
}

static void zxnextBeeperBeginFrame(void) {
  zxnextBeeperFrameStartTact = (double)zxnextBeeperTacts;
  zxnextBeeperSampleWindowStartTact = zxnextBeeperFrameStartTact;
  zxnextBeeperSampleWindowStartEar = zxnextBeeperEar;
  zxnextBeeperSampleWindowStartMic = zxnextBeeperMic;
  zxnextBeeperTransitionCount = 0u;
  zxnextBeeperCachedSampleValid = 0u;
}

static void zxnextBeeperSetTacts(uint32_t value) {
  zxnextBeeperTacts = value;
}

static inline void zxnextBeeperDiscardTransitions(uint32_t count) {
  if (count == 0u) return;
  if (count >= zxnextBeeperTransitionCount) {
    zxnextBeeperTransitionCount = 0u;
    return;
  }

  const uint32_t remaining = zxnextBeeperTransitionCount - count;
  for (uint32_t i = 0u; i < remaining; i++) {
    const uint32_t from = i + count;
    zxnextBeeperTransitionTacts[i] = zxnextBeeperTransitionTacts[from];
    zxnextBeeperTransitionEar[i] = zxnextBeeperTransitionEar[from];
    zxnextBeeperTransitionMic[i] = zxnextBeeperTransitionMic[from];
  }
  zxnextBeeperTransitionCount = remaining;
}

static inline void zxnextBeeperSetOutput(uint32_t ear, uint32_t mic) {
  uint8_t nextEar = ear != 0u;
  uint8_t nextMic = mic != 0u;
  if (nextEar != zxnextBeeperEar || nextMic != zxnextBeeperMic) {
    if (zxnextBeeperTransitionCount < ZXNEXT_BEEPER_TRANSITION_CAPACITY) {
      const uint32_t index = zxnextBeeperTransitionCount++;
      zxnextBeeperTransitionTacts[index] = (double)zxnextBeeperTacts;
      zxnextBeeperTransitionEar[index] = nextEar;
      zxnextBeeperTransitionMic[index] = nextMic;
    }
    zxnextBeeperCachedSampleValid = 0u;
  }
  zxnextBeeperEar = nextEar;
  zxnextBeeperMic = nextMic;
}

static uint32_t zxnextBeeperGetEar(void) { return zxnextBeeperEar; }
static uint32_t zxnextBeeperGetMic(void) { return zxnextBeeperMic; }

static inline uint32_t zxnextBeeperGetOutputLevelMilli(void) {
  uint32_t index = (zxnextBeeperMic ? 1u : 0u) | (zxnextBeeperEar ? 2u : 0u);
  switch (index) {
    case 1u: return 330u;
    case 2u: return 660u;
    case 3u: return 1000u;
    default: return 0u;
  }
}

static inline void zxnextBeeperUpdateCachedSample(double sampleEndTact) {
  if (zxnextBeeperCachedSampleValid && zxnextBeeperCachedSampleEndTact == sampleEndTact) return;

  const double sampleStartTact = zxnextBeeperSampleWindowStartTact;
  if (sampleEndTact <= sampleStartTact) {
    zxnextBeeperCachedLeftMilli = zxnextBeeperEar ? 1000u : 0u;
    zxnextBeeperCachedRightMilli = zxnextBeeperMic ? 1000u : 0u;
    zxnextBeeperCachedSampleEndTact = sampleEndTact;
    zxnextBeeperCachedSampleValid = 1u;
    return;
  }

  double cursor = sampleStartTact;
  uint8_t ear = zxnextBeeperSampleWindowStartEar;
  uint8_t mic = zxnextBeeperSampleWindowStartMic;
  double totalEar = 0.0;
  double totalMic = 0.0;
  uint32_t consumed = 0u;

  while (consumed < zxnextBeeperTransitionCount) {
    const double transitionTact = zxnextBeeperTransitionTacts[consumed];
    if (transitionTact >= sampleEndTact) break;

    const double clippedTact = transitionTact < cursor ? cursor : transitionTact;
    const double duration = clippedTact - cursor;
    if (duration > 0.0) {
      totalEar += (ear != 0u ? 1.0 : 0.0) * duration;
      totalMic += (mic != 0u ? 1.0 : 0.0) * duration;
    }

    cursor = clippedTact;
    ear = zxnextBeeperTransitionEar[consumed];
    mic = zxnextBeeperTransitionMic[consumed];
    consumed++;
  }

  const double finalDuration = sampleEndTact - cursor;
  if (finalDuration > 0.0) {
    totalEar += (ear != 0u ? 1.0 : 0.0) * finalDuration;
    totalMic += (mic != 0u ? 1.0 : 0.0) * finalDuration;
  }

  zxnextBeeperDiscardTransitions(consumed);
  zxnextBeeperSampleWindowStartTact = sampleEndTact;
  zxnextBeeperSampleWindowStartEar = ear;
  zxnextBeeperSampleWindowStartMic = mic;

  const double totalTacts = sampleEndTact - sampleStartTact;
  zxnextBeeperCachedLeftMilli = totalTacts > 0.0 ? (uint32_t)((totalEar * 1000.0) / totalTacts) : (ear ? 1000u : 0u);
  zxnextBeeperCachedRightMilli = totalTacts > 0.0 ? (uint32_t)((totalMic * 1000.0) / totalTacts) : (mic ? 1000u : 0u);
  zxnextBeeperCachedSampleEndTact = sampleEndTact;
  zxnextBeeperCachedSampleValid = 1u;
}

static uint32_t zxnextBeeperGetSampleLeftMilli(double sampleEndTact) {
  zxnextBeeperUpdateCachedSample(sampleEndTact);
  return zxnextBeeperCachedLeftMilli;
}

static uint32_t zxnextBeeperGetSampleRightMilli(double sampleEndTact) {
  zxnextBeeperUpdateCachedSample(sampleEndTact);
  return zxnextBeeperCachedRightMilli;
}
