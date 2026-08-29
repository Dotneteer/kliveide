#include "zxnext-audio-mixer.h"

#define ZXNEXT_AUDIO_SAMPLE_CAPACITY 2048u
#define ZXNEXT_DEFAULT_AUDIO_SAMPLE_RATE 48000u
#define ZXNEXT_AUDIO_BASE_CLOCK 28000000u
#define ZXNEXT_AUDIO_DC_CUTOFF_HZ 1.4
#define ZXNEXT_AUDIO_TWO_PI 6.28318530717958647692

static uint32_t zxnextAudioSampleRate = ZXNEXT_DEFAULT_AUDIO_SAMPLE_RATE;
static int32_t zxnextMixerEarLevel;
static int32_t zxnextMixerMicLevel;
static uint32_t zxnextMixerPsgLeft;
static uint32_t zxnextMixerPsgRight;
static uint32_t zxnextMixerVolumeScaleMilli;
static uint32_t zxnextMixerSampleCount;
static uint64_t zxnextMixerNextSampleTactScaled;
static int32_t zxnextMixerBeeperDcPrevInputEarMilli;
static int32_t zxnextMixerBeeperDcPrevInputMicMilli;
static double zxnextMixerBeeperDcPrevOutputEarMilli;
static double zxnextMixerBeeperDcPrevOutputMicMilli;
static int32_t zxnextMixerSamplesLeft[ZXNEXT_AUDIO_SAMPLE_CAPACITY];
static int32_t zxnextMixerSamplesRight[ZXNEXT_AUDIO_SAMPLE_CAPACITY];

static int32_t zxnextMixerClampWord(int32_t value) {
  if (value > 32767) return 32767;
  if (value < -32768) return -32768;
  return value;
}

static inline double zxnextMixerDcFilterAlpha(void) {
  const double rate = zxnextAudioSampleRate == 0u
    ? (double)ZXNEXT_DEFAULT_AUDIO_SAMPLE_RATE
    : (double)zxnextAudioSampleRate;
  const double x = (ZXNEXT_AUDIO_TWO_PI * ZXNEXT_AUDIO_DC_CUTOFF_HZ) / rate;
  const double x2 = x * x;
  const double x3 = x2 * x;
  return 1.0 / (1.0 + x + 0.5 * x2 + (x3 / 6.0));
}

static int32_t zxnextAudioMixerFilterBeeperMilli(
  int32_t rawMilli,
  int32_t *prevInputMilli,
  double *prevOutputMilli
) {
  const double alpha = zxnextMixerDcFilterAlpha();
  const double out = (double)rawMilli - (double)(*prevInputMilli) + alpha * (*prevOutputMilli);
  *prevInputMilli = rawMilli;
  *prevOutputMilli = out;
  return (int32_t)(out >= 0.0 ? out + 0.5 : out - 0.5);
}

static void zxnextAudioMixerReset(void) {
  zxnextMixerEarLevel = 0;
  zxnextMixerMicLevel = 0;
  zxnextMixerPsgLeft = 0u;
  zxnextMixerPsgRight = 0u;
  zxnextMixerVolumeScaleMilli = 1000u;
  zxnextMixerBeeperDcPrevInputEarMilli = 0;
  zxnextMixerBeeperDcPrevInputMicMilli = 0;
  zxnextMixerBeeperDcPrevOutputEarMilli = 0.0;
  zxnextMixerBeeperDcPrevOutputMicMilli = 0.0;
  zxnextAudioMixerBeginFrame();
  for (uint32_t i = 0u; i < ZXNEXT_AUDIO_SAMPLE_CAPACITY; i++) {
    zxnextMixerSamplesLeft[i] = 0;
    zxnextMixerSamplesRight[i] = 0;
  }
}

static void zxnextAudioMixerBeginFrame(void) {
  zxnextMixerSampleCount = 0u;
  zxnextMixerNextSampleTactScaled = (uint64_t)ZXNEXT_AUDIO_BASE_CLOCK;
}

static void zxnextAudioMixerSetSampleRate(uint32_t rate) {
  zxnextAudioSampleRate = rate == 0u ? ZXNEXT_DEFAULT_AUDIO_SAMPLE_RATE : rate;
  zxnextMixerBeeperDcPrevInputEarMilli = 0;
  zxnextMixerBeeperDcPrevInputMicMilli = 0;
  zxnextMixerBeeperDcPrevOutputEarMilli = 0.0;
  zxnextMixerBeeperDcPrevOutputMicMilli = 0.0;
  zxnextAudioMixerBeginFrame();
}

static uint32_t zxnextAudioMixerGetSampleRate(void) {
  return zxnextAudioSampleRate;
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

static void zxnextAudioMixerRefreshCurrentSources(double sampleEndTact, double sampleEndFrameTacts28) {
  int32_t ear = zxnextAudioMixerFilterBeeperMilli(
    (int32_t)zxnextBeeperGetSampleLeftMilli(sampleEndTact),
    &zxnextMixerBeeperDcPrevInputEarMilli,
    &zxnextMixerBeeperDcPrevOutputEarMilli
  );
  int32_t mic = zxnextAudioMixerFilterBeeperMilli(
    (int32_t)zxnextBeeperGetSampleRightMilli(sampleEndTact),
    &zxnextMixerBeeperDcPrevInputMicMilli,
    &zxnextMixerBeeperDcPrevOutputMicMilli
  );
  zxnextPsgPrepareAudioSample(sampleEndFrameTacts28);

  zxnextAudioMixerSetEarLevelMilli(ear);
  zxnextAudioMixerSetMicLevelMilli(mic);
  zxnextAudioMixerSetPsgOutput(zxnextPsgGetSampleLeft(), zxnextPsgGetSampleRight());
}

static void zxnextAudioMixerSetNextSample(uint32_t frameTacts28) {
  uint64_t currentScaled = (uint64_t)frameTacts28 * zxnextAudioSampleRate;
  while (currentScaled >= zxnextMixerNextSampleTactScaled) {
    const double tactScale = cpuTactScale == 0u ? 1.0 : (double)cpuTactScale;
    const double sampleEndFrameTacts28 = (double)zxnextMixerNextSampleTactScaled / (double)zxnextAudioSampleRate;
    const double sampleEndTact = zxnextBeeperFrameStartTact + sampleEndFrameTacts28 / tactScale;
    zxnextAudioMixerRefreshCurrentSources(sampleEndTact, sampleEndFrameTacts28);
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
