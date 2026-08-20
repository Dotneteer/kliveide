#include "zxnext-beeper.h"

static uint8_t zxnextBeeperEar;
static uint8_t zxnextBeeperMic;
static uint32_t zxnextBeeperTacts;
static uint32_t zxnextBeeperLastChangeTact;
static uint32_t zxnextBeeperAccumulatedEar;
static uint32_t zxnextBeeperAccumulatedMic;
static uint32_t zxnextBeeperAccumulatedTacts;
static uint32_t zxnextBeeperCachedLeftMilli;
static uint32_t zxnextBeeperCachedRightMilli;
static uint8_t zxnextBeeperCachedSampleValid;

static void zxnextBeeperReset(void) {
  zxnextBeeperEar = 0u;
  zxnextBeeperMic = 0u;
  zxnextBeeperTacts = 0u;
  zxnextBeeperLastChangeTact = 0u;
  zxnextBeeperAccumulatedEar = 0u;
  zxnextBeeperAccumulatedMic = 0u;
  zxnextBeeperAccumulatedTacts = 0u;
  zxnextBeeperCachedLeftMilli = 0u;
  zxnextBeeperCachedRightMilli = 0u;
  zxnextBeeperCachedSampleValid = 0u;
}

static void zxnextBeeperSetTacts(uint32_t value) {
  zxnextBeeperTacts = value;
}

static void zxnextBeeperRecordTransition(void) {
  uint32_t duration = zxnextBeeperTacts - zxnextBeeperLastChangeTact;
  if (duration > 0u) {
    zxnextBeeperAccumulatedEar += zxnextBeeperEar ? duration : 0u;
    zxnextBeeperAccumulatedMic += zxnextBeeperMic ? duration : 0u;
    zxnextBeeperAccumulatedTacts += duration;
  }
  zxnextBeeperLastChangeTact = zxnextBeeperTacts;
}

static void zxnextBeeperSetOutput(uint32_t ear, uint32_t mic) {
  uint8_t nextEar = ear != 0u;
  uint8_t nextMic = mic != 0u;
  if (nextEar != zxnextBeeperEar || nextMic != zxnextBeeperMic) {
    zxnextBeeperRecordTransition();
  }
  zxnextBeeperCachedSampleValid = 0u;
  zxnextBeeperEar = nextEar;
  zxnextBeeperMic = nextMic;
}

static uint32_t zxnextBeeperGetEar(void) { return zxnextBeeperEar; }
static uint32_t zxnextBeeperGetMic(void) { return zxnextBeeperMic; }

static uint32_t zxnextBeeperGetOutputLevelMilli(void) {
  uint32_t index = (zxnextBeeperMic ? 1u : 0u) | (zxnextBeeperEar ? 2u : 0u);
  switch (index) {
    case 1u: return 330u;
    case 2u: return 660u;
    case 3u: return 1000u;
    default: return 0u;
  }
}

static void zxnextBeeperUpdateCachedSample(void) {
  if (zxnextBeeperCachedSampleValid) return;
  if (zxnextBeeperAccumulatedTacts > 0u) {
    uint32_t finalDuration = zxnextBeeperTacts - zxnextBeeperLastChangeTact;
    uint32_t totalTacts = zxnextBeeperAccumulatedTacts + finalDuration;
    uint32_t totalEar = zxnextBeeperAccumulatedEar + (zxnextBeeperEar ? finalDuration : 0u);
    uint32_t totalMic = zxnextBeeperAccumulatedMic + (zxnextBeeperMic ? finalDuration : 0u);
    zxnextBeeperCachedLeftMilli = totalTacts > 0u ? (totalEar * 1000u) / totalTacts : (zxnextBeeperEar ? 1000u : 0u);
    zxnextBeeperCachedRightMilli = totalTacts > 0u ? (totalMic * 1000u) / totalTacts : (zxnextBeeperMic ? 1000u : 0u);
    zxnextBeeperAccumulatedEar = 0u;
    zxnextBeeperAccumulatedMic = 0u;
    zxnextBeeperAccumulatedTacts = 0u;
    zxnextBeeperLastChangeTact = zxnextBeeperTacts;
  } else {
    zxnextBeeperCachedLeftMilli = zxnextBeeperEar ? 1000u : 0u;
    zxnextBeeperCachedRightMilli = zxnextBeeperMic ? 1000u : 0u;
  }
  zxnextBeeperCachedSampleValid = 1u;
}

static uint32_t zxnextBeeperGetSampleLeftMilli(void) {
  zxnextBeeperUpdateCachedSample();
  return zxnextBeeperCachedLeftMilli;
}

static uint32_t zxnextBeeperGetSampleRightMilli(void) {
  zxnextBeeperUpdateCachedSample();
  return zxnextBeeperCachedRightMilli;
}
