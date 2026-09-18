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
/* The next sample's time: frame 28 MHz clocks x sample rate. It carries across the frame wrap
   (zxnextAudioMixerOnFrameWrap), so a frame yields rate x frame length / 28 MHz samples on average -
   restarting it every frame dropped the fraction of a sample at each frame end (0.45 at 48 kHz). */
static int64_t zxnextMixerNextSampleTactScaled;
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
  zxnextMixerNextSampleTactScaled = (int64_t)ZXNEXT_AUDIO_BASE_CLOCK;
  for (uint32_t i = 0u; i < ZXNEXT_AUDIO_SAMPLE_CAPACITY; i++) {
    zxnextMixerSamplesLeft[i] = 0;
    zxnextMixerSamplesRight[i] = 0;
  }
}

static void zxnextAudioMixerBeginFrame(void) {
  zxnextMixerSampleCount = 0u;
}

/* The frame counter wrapped: the sample times are frame-relative, so move the schedule back a frame */
static void zxnextAudioMixerOnFrameWrap(void) {
  zxnextMixerNextSampleTactScaled -= (int64_t)ZXNEXT_TACTS_IN_FRAME * (int64_t)zxnextAudioSampleRate;
}

static void zxnextAudioMixerSetSampleRate(uint32_t rate) {
  zxnextAudioSampleRate = rate == 0u ? ZXNEXT_DEFAULT_AUDIO_SAMPLE_RATE : rate;
  zxnextMixerBeeperDcPrevInputEarMilli = 0;
  zxnextMixerBeeperDcPrevInputMicMilli = 0;
  zxnextMixerBeeperDcPrevOutputEarMilli = 0.0;
  zxnextMixerBeeperDcPrevOutputMicMilli = 0.0;
  zxnextAudioMixerBeginFrame();
  zxnextMixerNextSampleTactScaled = (int64_t)ZXNEXT_AUDIO_BASE_CLOCK;
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

/*
 * audio_mixer.vhd: pcm = ear + mic + ay + dac + i2s, each side on its own, in these units: EAR 512 and
 * MIC 128 while high, a full YM channel 255 (the PSG output is that table x 257), one DAC channel 4 per
 * step. The beeper arrives DC-filtered and the DACs are taken about their $80 centre, so silence is 0;
 * the AY stays unipolar. ZXNEXT_MIXER_GAIN maps the sum to 16 bits: chosen (2026-09-18) so that a full
 * AY channel keeps the level it had before the mixer followed the VHDL proportions. Mirrors
 * AudioMixerDevice.getMixedOutput.
 */
#define ZXNEXT_MIXER_GAIN 29.44
static int32_t zxnextAudioMixerGetMixedSide(uint32_t isRight) {
  double mixed = (double)zxnextMixerEarLevel + (double)zxnextMixerMicLevel;
  mixed += (double)(isRight ? zxnextMixerPsgRight : zxnextMixerPsgLeft) / 257.0;
  uint32_t dacSide = isRight ? zxnextDacGetStereoRight() : zxnextDacGetStereoLeft();
  mixed += ((double)dacSide - 256.0) * 4.0;
  double scaled = mixed * ZXNEXT_MIXER_GAIN * (double)zxnextMixerVolumeScaleMilli / 1000.0;
  if (scaled > 32767.0) scaled = 32767.0;
  if (scaled < -32768.0) scaled = -32768.0;
  return (int32_t)scaled;
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
  /* ~6450 `beep_spkr_excl`: with $06 bit 6 and the internal speaker ($08 bit 4) on, the beeper goes
     to the speaker only - EAR and MIC leave the mix */
  if ((zxnextNextRegs[0x06u] & 0x40u) != 0u && (zxnextNextRegs[0x08u] & 0x10u) != 0u) {
    ear = 0;
    mic = 0;
  }
  zxnextAudioMixerSetEarLevelMilli(ear);
  zxnextAudioMixerSetMicLevelMilli(mic);
  zxnextAudioMixerSetPsgOutput(zxnextPsgGetSampleLeft(), zxnextPsgGetSampleRight());
}

static void zxnextAudioMixerSetNextSample(uint32_t frameTacts28) {
  int64_t currentScaled = (int64_t)frameTacts28 * (int64_t)zxnextAudioSampleRate;
  while (currentScaled >= zxnextMixerNextSampleTactScaled) {
    /* A full buffer: nobody began this frame's audio. The IDE's per-instruction loop (it carries the
       whole NextZXOS boot of a NEX launch) never calls BeginFrame. Drop the sample but keep the
       schedule moving; otherwise the wrap would pull it back every frame and each T-state would
       redo the source refresh for a sample it cannot store. */
    if (zxnextMixerSampleCount >= ZXNEXT_AUDIO_SAMPLE_CAPACITY) {
      zxnextMixerNextSampleTactScaled += (int64_t)ZXNEXT_AUDIO_BASE_CLOCK;
      continue;
    }
    const double tactScale = cpuTactScale == 0u ? 1.0 : (double)cpuTactScale;
    const double sampleEndFrameTacts28 = (double)zxnextMixerNextSampleTactScaled / (double)zxnextAudioSampleRate;
    const double sampleEndTact = zxnextBeeperFrameStartTact + sampleEndFrameTacts28 / tactScale;
    zxnextAudioMixerRefreshCurrentSources(sampleEndTact, sampleEndFrameTacts28);
    zxnextAudioMixerAppendCurrentSample();
    zxnextMixerNextSampleTactScaled += (int64_t)ZXNEXT_AUDIO_BASE_CLOCK;
  }
}

static uint32_t zxnextAudioMixerGetSampleCount(void) { return zxnextMixerSampleCount; }
static int32_t zxnextAudioMixerGetSampleLeft(uint32_t index) {
  return index < zxnextMixerSampleCount ? zxnextMixerSamplesLeft[index] : 0;
}
static int32_t zxnextAudioMixerGetSampleRight(uint32_t index) {
  return index < zxnextMixerSampleCount ? zxnextMixerSamplesRight[index] : 0;
}
