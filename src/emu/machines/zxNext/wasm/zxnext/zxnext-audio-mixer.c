#include "zxnext-audio-mixer.h"

#define ZXNEXT_AUDIO_SAMPLE_CAPACITY 2048u
#define ZXNEXT_AUDIO_SAMPLE_RATE 48000u
#define ZXNEXT_AUDIO_BASE_CLOCK 28000000u

static int32_t zxnextMixerEarLevel;
static int32_t zxnextMixerMicLevel;
static uint32_t zxnextMixerPsgLeft;
static uint32_t zxnextMixerPsgRight;
static uint32_t zxnextMixerVolumeScaleMilli;
static uint32_t zxnextMixerSampleCount;
static uint64_t zxnextMixerNextSampleTactScaled;
static int32_t zxnextMixerSamplesLeft[ZXNEXT_AUDIO_SAMPLE_CAPACITY];
static int32_t zxnextMixerSamplesRight[ZXNEXT_AUDIO_SAMPLE_CAPACITY];

static int32_t zxnextMixerClampWord(int32_t value) {
  if (value > 32767) return 32767;
  if (value < -32768) return -32768;
  return value;
}

static void zxnextAudioMixerReset(void) {
  zxnextMixerEarLevel = 0;
  zxnextMixerMicLevel = 0;
  zxnextMixerPsgLeft = 0u;
  zxnextMixerPsgRight = 0u;
  zxnextMixerVolumeScaleMilli = 1000u;
  zxnextAudioMixerBeginFrame();
  for (uint32_t i = 0u; i < ZXNEXT_AUDIO_SAMPLE_CAPACITY; i++) {
    zxnextMixerSamplesLeft[i] = 0;
    zxnextMixerSamplesRight[i] = 0;
  }
}

static void zxnextAudioMixerBeginFrame(void) {
  zxnextMixerSampleCount = 0u;
  zxnextMixerNextSampleTactScaled = 0u;
}

static void zxnextAudioMixerSetEarLevelMilli(int32_t level) {
  zxnextMixerEarLevel = (level * 512) / 1000;
}

static void zxnextAudioMixerSetMicLevelMilli(int32_t level) {
  zxnextMixerMicLevel = (level * 128) / 1000;
}

static void zxnextAudioMixerSetPsgOutput(uint32_t left, uint32_t right) {
  zxnextMixerPsgLeft = left;
  zxnextMixerPsgRight = right;
}

static void zxnextAudioMixerSetVolumeScaleMilli(uint32_t scale) {
  zxnextMixerVolumeScaleMilli = scale > 1000u ? 1000u : scale;
}

static int32_t zxnextAudioMixerGetMixedSide(uint32_t isRight) {
  int32_t mixed = 0;
  mixed += zxnextMixerEarLevel * 12;
  mixed += zxnextMixerMicLevel * 12;

  uint32_t psgLeftScaled = zxnextMixerPsgLeft / 24u;
  uint32_t psgRightScaled = zxnextMixerPsgRight / 24u;
  uint32_t psgPeak = psgLeftScaled > psgRightScaled ? psgLeftScaled : psgRightScaled;
  int32_t midpoint = (int32_t)(psgPeak / 2u);
  mixed += (int32_t)(isRight ? psgRightScaled : psgLeftScaled) - midpoint;

  uint32_t dacSide = isRight ? zxnextDacGetStereoRight() : zxnextDacGetStereoLeft();
  mixed += ((int32_t)dacSide << 2) - 1024;

  int32_t word = (mixed * 55) / 10;
  word = (word * (int32_t)zxnextMixerVolumeScaleMilli) / 1000;
  return zxnextMixerClampWord(word);
}

static int32_t zxnextAudioMixerGetMixedLeftWord(void) {
  return zxnextAudioMixerGetMixedSide(0u);
}

static int32_t zxnextAudioMixerGetMixedRightWord(void) {
  return zxnextAudioMixerGetMixedSide(1u);
}

static uint32_t zxnextAudioMixerAppendCurrentSample(void) {
  if (zxnextMixerSampleCount >= ZXNEXT_AUDIO_SAMPLE_CAPACITY) return 0u;
  zxnextMixerSamplesLeft[zxnextMixerSampleCount] = zxnextAudioMixerGetMixedLeftWord();
  zxnextMixerSamplesRight[zxnextMixerSampleCount] = zxnextAudioMixerGetMixedRightWord();
  zxnextMixerSampleCount++;
  return 1u;
}

static void zxnextAudioMixerRefreshCurrentSources(void) {
  int32_t ear = (int32_t)zxnextBeeperGetSampleLeftMilli();
  int32_t mic = (int32_t)zxnextBeeperGetSampleRightMilli();
  uint32_t psgLeft = 0u;
  uint32_t psgRight = 0u;

  for (uint32_t chip = 0u; chip < 3u; chip++) {
    if (zxnextPsgGetTurbosoundEnabled() || chip == zxnextPsgGetSelectedChip()) {
      psgLeft += zxnextPsgGetStereoLeft(chip);
      psgRight += zxnextPsgGetStereoRight(chip);
    }
  }

  zxnextAudioMixerSetEarLevelMilli(ear);
  zxnextAudioMixerSetMicLevelMilli(mic);
  zxnextAudioMixerSetPsgOutput(psgLeft, psgRight);
}

static void zxnextAudioMixerSetNextSample(uint32_t frameTacts28) {
  uint64_t currentScaled = (uint64_t)frameTacts28 * ZXNEXT_AUDIO_SAMPLE_RATE;
  while (currentScaled > zxnextMixerNextSampleTactScaled) {
    zxnextAudioMixerRefreshCurrentSources();
    if (!zxnextAudioMixerAppendCurrentSample()) return;
    zxnextMixerNextSampleTactScaled += (uint64_t)ZXNEXT_AUDIO_BASE_CLOCK;
  }
}

static uint32_t zxnextAudioMixerGetSampleCount(void) { return zxnextMixerSampleCount; }
static int32_t zxnextAudioMixerGetSampleLeft(uint32_t index) {
  return index < zxnextMixerSampleCount ? zxnextMixerSamplesLeft[index] : 0;
}
static int32_t zxnextAudioMixerGetSampleRight(uint32_t index) {
  return index < zxnextMixerSampleCount ? zxnextMixerSamplesRight[index] : 0;
}
