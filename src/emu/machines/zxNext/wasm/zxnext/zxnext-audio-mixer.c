#include "zxnext-audio-mixer.h"

#define ZXNEXT_AUDIO_SAMPLE_CAPACITY 2048u
#define ZXNEXT_DEFAULT_AUDIO_SAMPLE_RATE 48000u
#define ZXNEXT_AUDIO_BASE_CLOCK 28000000u
#define ZXNEXT_AUDIO_DC_CUTOFF_HZ 1.4
#define ZXNEXT_AUDIO_TWO_PI 6.28318530717958647692

static uint32_t zxnextAudioSampleRate = ZXNEXT_DEFAULT_AUDIO_SAMPLE_RATE;
static int32_t zxnextMixerEarLevel;
static int32_t zxnextMixerMicLevel;
static double zxnextMixerPsgLeft;
static double zxnextMixerPsgRight;
/* The Pi I2S sample per side, about its $200 rest (zxnext-pi-i2s.c) */
static int32_t zxnextMixerPiLeft;
static int32_t zxnextMixerPiRight;
static uint32_t zxnextMixerVolumeScaleMilli;
static uint32_t zxnextMixerSampleCount;
/* Which of the Next's outputs the stream plays (ZXNEXT_AUDIO_OUT_*): a host setting, so no reset
   touches it. The jack wraps the sum past 4,095, the speaker plays one mono mix, HDMI the whole sum. */
static uint32_t zxnextMixerOutput = ZXNEXT_AUDIO_OUT_JACK;
/* The beeper as the hardware sums it, unfiltered (EAR 0-512, MIC 0-128; 0 while diverted to the
   speaker), for the jack's 12-bit wrap; and EAR + MIC filtered but not diverted, for the speaker */
static double zxnextMixerEarRaw;
static double zxnextMixerMicRaw;
static int32_t zxnextMixerSpeakerBeeper;
static uint8_t zxnextMixerBeeperDiverted;
/* The next sample's time: frame 28 MHz clocks x sample rate. It carries across the frame wrap
   (zxnextAudioMixerOnFrameWrap), so a frame yields rate x frame length / 28 MHz samples on average -
   restarting it every frame dropped the fraction of a sample at each frame end (0.45 at 48 kHz). */
static int64_t zxnextMixerNextSampleTactScaled;
/* DC high-pass filter state on the beeper's EAR / MIC fractions (AudioDeviceBase.setNextAudioSample) */
static double zxnextMixerBeeperDcPrevInputEar;
static double zxnextMixerBeeperDcPrevInputMic;
static double zxnextMixerBeeperDcPrevOutputEar;
static double zxnextMixerBeeperDcPrevOutputMic;
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

static double zxnextAudioMixerFilterBeeper(double raw, double *prevInput, double *prevOutput) {
  const double alpha = zxnextMixerDcFilterAlpha();
  const double out = raw - *prevInput + alpha * (*prevOutput);
  *prevInput = raw;
  *prevOutput = out;
  return out;
}

/* JavaScript's Math.round (half up) and Math.trunc / Math.floor, so the TypeScript core's arithmetic is
   reproduced to the bit */
static inline double zxnextMixerFloor(double x) {
  double t = (double)(int64_t)x;
  return t > x ? t - 1.0 : t;
}
static inline double zxnextMixerTrunc(double x) { return (double)(int64_t)x; }
static inline int32_t zxnextMixerRound(double x) { return (int32_t)zxnextMixerFloor(x + 0.5); }

static void zxnextAudioMixerReset(void) {
  zxnextMixerEarLevel = 0;
  zxnextMixerMicLevel = 0;
  zxnextMixerPsgLeft = 0.0;
  zxnextMixerPsgRight = 0.0;
  zxnextMixerPiLeft = 0;
  zxnextMixerPiRight = 0;
  zxnextMixerEarRaw = 0.0;
  zxnextMixerMicRaw = 0.0;
  zxnextMixerSpeakerBeeper = 0;
  zxnextMixerBeeperDiverted = 0u;
  zxnextMixerVolumeScaleMilli = 1000u;
  zxnextMixerBeeperDcPrevInputEar = 0.0;
  zxnextMixerBeeperDcPrevInputMic = 0.0;
  zxnextMixerBeeperDcPrevOutputEar = 0.0;
  zxnextMixerBeeperDcPrevOutputMic = 0.0;
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
  zxnextMixerBeeperDcPrevInputEar = 0.0;
  zxnextMixerBeeperDcPrevInputMic = 0.0;
  zxnextMixerBeeperDcPrevOutputEar = 0.0;
  zxnextMixerBeeperDcPrevOutputMic = 0.0;
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
  zxnextMixerPsgLeft = (double)left;
  zxnextMixerPsgRight = (double)right;
}

static void zxnextAudioMixerSetVolumeScaleMilli(uint32_t scale) {
  zxnextMixerVolumeScaleMilli = scale > 1000u ? 1000u : scale;
}

/*
 * audio_mixer.vhd: pcm = ear + mic + ay + dac + i2s, each side on its own, in these units: EAR 512 and
 * MIC 128 while high, a full YM channel 255 (the PSG output is that table x 257), one DAC channel 4 per
 * step, the Pi I2S sample 1 per step (0-1023). The beeper arrives DC-filtered and the DACs and I2S are
 * taken about their centres ($80, $200), so silence is 0; the AY stays unipolar. ZXNEXT_MIXER_GAIN maps
 * the sum to 16 bits with the headroom of the audio jack: its converters take the sum's low 12 bits
 * (zxnext_top_issue4.vhd ~1279, `zxn_audio_L(11 downto 0)`), 0-4095, and silence there is 1536 (the DACs
 * at $80, the Pi at its rest), so the jack plays up to 2559 units above silence cleanly. 2559 x 12.8 =
 * 32755: whatever the jack plays without wrapping plays here without clamping; only a mix that already
 * wraps on the jack clamps. (Until 2026-10 the gain was 29.44, which clamped three AY chips at full
 * volume, 1530 units.)
 */
#define ZXNEXT_MIXER_GAIN 12.8
/*
 * The other outputs keep the same idea, each output's room above its silence mapped to 16 bits:
 * - The internal speaker (zxnext_top_issue4.vhd ~1313-1320) plays L(11..0) + R(11..0), the two jack
 *   values, through a 13-bit converter: silence 3,072, room 2 x 2,559 = 5,118, x 6.4 = 32,755. With the
 *   beeper diverted ($06 bit 6 and $08 bit 4) its word is EAR at bit 10 and MIC at bit 8 (1,024 and 256)
 *   and nothing else. $08 bit 4 off holds its pin low: silence. Issue 2 boards bias the speaker word
 *   for their transistor; Klive follows issue 4.
 * - HDMI (~1522) carries the whole 13-bit sum, so it never wraps: every source at its largest is 4,462
 *   above silence, x 7.34 = 32,751. It takes the sum's value at each sample (no averaging), so the
 *   beeper and the PSGs are point-sampled; $09 bit 2 silences it.
 */
#define ZXNEXT_SPEAKER_GAIN 6.4
#define ZXNEXT_HDMI_GAIN 7.34
#define ZXNEXT_SUM_SILENCE 1536.0

/* The mix about silence (0): the DC-filtered beeper, the AY, the DACs and the Pi about their rests */
static double zxnextAudioMixerCentredSide(uint32_t isRight) {
  double mixed = (double)zxnextMixerEarLevel + (double)zxnextMixerMicLevel;
  mixed += (isRight ? zxnextMixerPsgRight : zxnextMixerPsgLeft) / 257.0;
  uint32_t dacSide = isRight ? zxnextDacGetStereoRight() : zxnextDacGetStereoLeft();
  mixed += ((double)dacSide - 256.0) * 4.0;
  mixed += (double)(isRight ? zxnextMixerPiRight : zxnextMixerPiLeft);
  return mixed;
}

/* audio_mixer.vhd's unsigned sum, 0-5,998: the beeper unfiltered, the DACs x 4, the Pi from 0 */
static double zxnextAudioMixerHardwareSum(uint32_t isRight) {
  double sum = zxnextMixerEarRaw + zxnextMixerMicRaw;
  sum += (isRight ? zxnextMixerPsgRight : zxnextMixerPsgLeft) / 257.0;
  sum += (double)(isRight ? zxnextDacGetStereoRight() : zxnextDacGetStereoLeft()) * 4.0;
  sum += (double)(isRight ? zxnextMixerPiRight : zxnextMixerPiLeft) + 512.0;
  return sum;
}

/* The jack's side about silence: the jack takes the sum's low 12 bits, so a sum of 4,096 or more
   loses 4,096 for each time it passed (zxnext_top_issue4.vhd ~1279, `zxn_audio_L(11 downto 0)`) */
static double zxnextAudioMixerJackSide(uint32_t isRight) {
  double mixed = zxnextAudioMixerCentredSide(isRight);
  const double sum = zxnextAudioMixerHardwareSum(isRight);
  if (sum >= 4096.0) mixed -= 4096.0 * zxnextMixerFloor(sum / 4096.0);
  return mixed;
}

static int32_t zxnextAudioMixerGetMixedSide(uint32_t isRight) {
  double mixed;
  double gain;
  switch (zxnextMixerOutput) {
    case ZXNEXT_AUDIO_OUT_SPEAKER:
      gain = ZXNEXT_SPEAKER_GAIN;
      if ((zxnextNextRegs[0x08u] & 0x10u) == 0u) {
        mixed = 0.0;
      } else if (zxnextMixerBeeperDiverted) {
        mixed = 2.0 * (double)zxnextMixerSpeakerBeeper;
      } else {
        mixed = zxnextAudioMixerJackSide(0u) + zxnextAudioMixerJackSide(1u);
      }
      break;
    case ZXNEXT_AUDIO_OUT_HDMI:
      gain = ZXNEXT_HDMI_GAIN;
      mixed = (zxnextNextRegs[0x09u] & 0x04u) != 0u ? 0.0 : zxnextAudioMixerCentredSide(isRight);
      break;
    default:
      gain = ZXNEXT_MIXER_GAIN;
      mixed = zxnextAudioMixerJackSide(isRight);
      break;
  }
  /* AudioMixerDevice.getMixedOutput: trunc(mixed x gain), then floor(x volume), then the clamp */
  double scaled = zxnextMixerTrunc(mixed * gain);
  scaled = zxnextMixerFloor(scaled * ((double)zxnextMixerVolumeScaleMilli / 1000.0));
  if (scaled > 32767.0) scaled = 32767.0;
  if (scaled < -32768.0) scaled = -32768.0;
  return (int32_t)scaled;
}

static void zxnextAudioMixerSetOutput(uint32_t output) {
  zxnextMixerOutput = output <= ZXNEXT_AUDIO_OUT_HDMI ? output : ZXNEXT_AUDIO_OUT_JACK;
}

static uint32_t zxnextAudioMixerGetOutput(void) { return zxnextMixerOutput; }

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
  /* The Pi I2S receiver up to now, first: its EAR bit's MIC transitions reach the beeper before the
     beeper's sample is taken. A sample-end in the past sees the words latched since, at most one
     audio sample late (zxnext-pi-i2s.c keeps time lazily and never runs backwards). */
  zxnextPiI2sSync();
  /* The tape input up to now too: its changes reach the MIC line before the beeper's sample is taken */
  (void)zxnextTapeGetInput();
  /* HDMI takes the sum's value at the sample's moment (no averaging): the beeper's level at the
     window's end instead of its time-weighted share, and the PSGs' current output */
  const uint32_t pointSampled = zxnextMixerOutput == ZXNEXT_AUDIO_OUT_HDMI;
  double earIn = zxnextBeeperGetSampleLeft(sampleEndTact);
  double micIn = zxnextBeeperGetSampleRight(sampleEndTact);
  if (pointSampled) {
    earIn = zxnextBeeperSampleWindowStartEar ? 1.0 : 0.0;
    micIn = zxnextBeeperSampleWindowStartMic ? 1.0 : 0.0;
  }
  /* AudioMixerDevice.setEarLevel / setMicLevel: round(level x 512) / round(level x 128) of the
     DC-filtered time-weighted fractions */
  int32_t ear = zxnextMixerRound(zxnextAudioMixerFilterBeeper(
    earIn,
    &zxnextMixerBeeperDcPrevInputEar,
    &zxnextMixerBeeperDcPrevOutputEar
  ) * 512.0);
  int32_t mic = zxnextMixerRound(zxnextAudioMixerFilterBeeper(
    micIn,
    &zxnextMixerBeeperDcPrevInputMic,
    &zxnextMixerBeeperDcPrevOutputMic
  ) * 128.0);
  zxnextPsgPrepareAudioSample(sampleEndFrameTacts28);
  /* ~6450 `beep_spkr_excl`: with $06 bit 6 and the internal speaker ($08 bit 4) on, the beeper goes
     to the speaker only - EAR and MIC leave the mix */
  zxnextMixerSpeakerBeeper = ear + mic;
  zxnextMixerBeeperDiverted =
    (zxnextNextRegs[0x06u] & 0x40u) != 0u && (zxnextNextRegs[0x08u] & 0x10u) != 0u ? 1u : 0u;
  if (zxnextMixerBeeperDiverted) {
    ear = 0;
    mic = 0;
  }
  zxnextMixerEarLevel = ear;
  zxnextMixerMicLevel = mic;
  zxnextMixerEarRaw = zxnextMixerBeeperDiverted ? 0.0 : earIn * 512.0;
  zxnextMixerMicRaw = zxnextMixerBeeperDiverted ? 0.0 : micIn * 128.0;
  zxnextMixerPsgLeft = pointSampled ? (double)zxnextPsgCurrentLeft : zxnextPsgGetSampleLeftExact();
  zxnextMixerPsgRight = pointSampled ? (double)zxnextPsgCurrentRight : zxnextPsgGetSampleRightExact();
  zxnextMixerPiLeft = zxnextPiI2sGetMixLeft();
  zxnextMixerPiRight = zxnextPiI2sGetMixRight();
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
    /* The beeper counts CPU tacts: the sample end is that far back from now. (From the frame's first
       executed tact it was off by the previous frame's overrun - the part of its last instruction past
       the frame end - and by any speed change in the frame.) */
    const double sampleEndTact = (double)zxnextBeeperTacts - ((double)frameTacts28 - sampleEndFrameTacts28) / tactScale;
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
