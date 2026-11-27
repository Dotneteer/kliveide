/*
 * The SAM's audio output (plan §8.2): the SAA 1099's two sides, the beeper (FEh bit 4, into both sides),
 * and the tape's EAR level (echoed while a tape plays, as SimCoupé does). MIC is not audible (SOUND OQ5).
 *
 * The levels are integrated over each host sample (time in 24 MHz units from the frame's start, as the
 * SAA's), then a DC high-pass (1.4 Hz, set by the host as for every core) stands in for the board's
 * coupling. The beeper's level against the SAA's is unmeasured on hardware (SOUND OQ4); it is SimCoupé
 * 1.2.17's (parity probe `snd-mix`, 2026-11-27): a beeper swing 2.25 times one SAA channel's at amplitude 15.
 *
 * The audio mixer (`common/wasm/audio-channels.c`): sources 0 SAA left, 1 SAA right, 2 beeper, 3 tape.
 * Only the heard mix is computed: with every gain at 1000 it is the core's output. Its integrator and
 * filter state is volatile (the build script lists it): reverse debugging compares machine state, and the
 * user may change a gain between a recording and a Step Back.
 */

#define SAM_AUDIO_SAMPLE_CAPACITY 2048u
/* Full scale per source, as a fraction of the output: the SAA's side (2880, SAASound's units), the beeper
   (2.25 x one channel at amplitude 15, 480 / 2880 x 0.5: SimCoupé's ratio; it was 0.25), the tape */
#define SAM_AUDIO_SAA_SCALE (0.5 / 2880.0)
#define SAM_AUDIO_BEEPER_LEVEL 0.1875
#define SAM_AUDIO_TAPE_LEVEL 0.05

static double samAudioHeardSamples[SAM_AUDIO_SAMPLE_CAPACITY * 2u];
static uint32_t samAudioSampleCount;
static uint32_t samAudioSampleRate;
static uint32_t samAudioOverflows;
/* The sample length and the next sample's time, 24 MHz units */
static double samAudioSampleLength;
static double samAudioNextSample;
static double samAudioDcAlpha;

/* The beeper's level (FEh bit 4) and the tape's EAR level while it plays (0 or 1) */
static uint8_t samBeeperLevel;
static uint8_t samTapeAudioLevel;

/* The integrator (volatile): per source, the level integrated since the last sample */
static double samAudioLastPoint;
static double samAudioAccSaaLeft;
static double samAudioAccSaaRight;
static double samAudioAccBeeper;
static double samAudioAccTape;
static double samAudioAccUnits;
static double samAudioDcInLeft;
static double samAudioDcInRight;
static double samAudioDcOutLeft;
static double samAudioDcOutRight;

static inline double samAudioPointNow(void) { return (double)(int32_t)(cpu.tacts - samFrameStart) * SAM_SAA_UNITS_PER_T; }

static void SAM_NOINLINE samAudioEmitSample(void) {
  const double units = samAudioAccUnits;
  const double saaL = units > 0.0 ? samAudioAccSaaLeft / units : samSaaLevel[0];
  const double saaR = units > 0.0 ? samAudioAccSaaRight / units : samSaaLevel[1];
  const double beep = units > 0.0 ? samAudioAccBeeper / units : (double)samBeeperLevel;
  const double tape = units > 0.0 ? samAudioAccTape / units : (double)samTapeAudioLevel;
  const double srcSaaL = saaL * SAM_AUDIO_SAA_SCALE;
  const double srcSaaR = saaR * SAM_AUDIO_SAA_SCALE;
  const double srcBeep = beep * SAM_AUDIO_BEEPER_LEVEL;
  const double srcTape = tape * SAM_AUDIO_TAPE_LEVEL;
  const double rawL = srcSaaL * kliveAudioChannelGain[0] + srcBeep * kliveAudioChannelGain[2] + srcTape * kliveAudioChannelGain[3];
  const double rawR = srcSaaR * kliveAudioChannelGain[1] + srcBeep * kliveAudioChannelGain[2] + srcTape * kliveAudioChannelGain[3];
  const double outL = rawL - samAudioDcInLeft + samAudioDcAlpha * samAudioDcOutLeft;
  const double outR = rawR - samAudioDcInRight + samAudioDcAlpha * samAudioDcOutRight;
  samAudioDcInLeft = rawL;
  samAudioDcInRight = rawR;
  samAudioDcOutLeft = outL;
  samAudioDcOutRight = outR;
  int16_t *tap = kliveAudioTapRow(samAudioSampleCount);
  if (tap) {
    tap[0] = kliveAudioTapWord(srcSaaL);
    tap[1] = kliveAudioTapWord(srcSaaR);
    tap[2] = kliveAudioTapWord(srcBeep);
    tap[3] = kliveAudioTapWord(srcTape);
  }
  samAudioAccSaaLeft = 0.0;
  samAudioAccSaaRight = 0.0;
  samAudioAccBeeper = 0.0;
  samAudioAccTape = 0.0;
  samAudioAccUnits = 0.0;
  if (samAudioSampleCount < SAM_AUDIO_SAMPLE_CAPACITY) {
    samAudioHeardSamples[samAudioSampleCount * 2u] = kliveAudioClamp(outL);
    samAudioHeardSamples[samAudioSampleCount * 2u + 1u] = kliveAudioClamp(outR);
    samAudioSampleCount++;
  } else {
    samAudioOverflows++;
  }
  samAudioNextSample += samAudioSampleLength;
}

/* The levels as they are now, integrated up to `point`; the samples due on the way */
static void samAudioIntegrateUntil(double point) {
  while (samAudioSampleLength > 0.0 && samAudioNextSample <= point) {
    const double d = samAudioNextSample - samAudioLastPoint;
    if (d > 0.0) {
      samAudioAccSaaLeft += samSaaLevel[0] * d;
      samAudioAccSaaRight += samSaaLevel[1] * d;
      samAudioAccBeeper += (double)samBeeperLevel * d;
      samAudioAccTape += (double)samTapeAudioLevel * d;
      samAudioAccUnits += d;
      samAudioLastPoint = samAudioNextSample;
    }
    samAudioEmitSample();
  }
  const double d = point - samAudioLastPoint;
  if (d <= 0.0) return;
  samAudioAccSaaLeft += samSaaLevel[0] * d;
  samAudioAccSaaRight += samSaaLevel[1] * d;
  samAudioAccBeeper += (double)samBeeperLevel * d;
  samAudioAccTape += (double)samTapeAudioLevel * d;
  samAudioAccUnits += d;
  samAudioLastPoint = point;
}

/* Every cell, and before every write that changes a level: the SAA and the samples up to now */
static void samAudioCatchUp(void) { samSaaRunUntil(samAudioPointNow()); }

static void samBeeperWrite(uint8_t border) {
  const uint8_t level = (border & 0x10u) != 0u;
  if (level == samBeeperLevel) return;
  samAudioCatchUp();
  samBeeperLevel = level;
}

/* The frame ends: every point moves back by the frame's length */
static void samAudioEndFrame(void) {
  const double length = (double)SAM_FRAME_TACTS * SAM_SAA_UNITS_PER_T;
  samSaaRunUntil(length);
  samSaaEndFrame(length);
  samAudioLastPoint -= length;
  samAudioNextSample -= length;
}

static void samAudioNewFrame(void) { samAudioSampleCount = 0u; }

static void samAudioReset(void) {
  samAudioSampleCount = 0u;
  samAudioLastPoint = 0.0;
  samAudioNextSample = samAudioSampleLength;
  samAudioAccSaaLeft = 0.0;
  samAudioAccSaaRight = 0.0;
  samAudioAccBeeper = 0.0;
  samAudioAccTape = 0.0;
  samAudioAccUnits = 0.0;
  samAudioDcInLeft = 0.0;
  samAudioDcInRight = 0.0;
  samAudioDcOutLeft = 0.0;
  samAudioDcOutRight = 0.0;
  samBeeperLevel = 0u;
  samTapeAudioLevel = 0u;
}

/* The host's sample rate (0 stops the samples) and the DC filter's coefficient (`exp(-2 pi fc / rate)`) */
void samSetAudioSampleRate(uint32_t rate, double dcAlpha) {
  samAudioSampleRate = rate;
  samAudioSampleLength = rate ? (double)SAM_CLOCK * SAM_SAA_UNITS_PER_T / (double)rate : 0.0;
  samAudioDcAlpha = dcAlpha;
  samAudioLastPoint = samAudioPointNow();
  samAudioNextSample = samAudioLastPoint + samAudioSampleLength;
  samAudioAccSaaLeft = 0.0;
  samAudioAccSaaRight = 0.0;
  samAudioAccBeeper = 0.0;
  samAudioAccTape = 0.0;
  samAudioAccUnits = 0.0;
}

uint32_t samAudioSamplesPtr(void) { return (uint32_t)(uintptr_t)samAudioHeardSamples; }
void samAudioSetChannelGain(uint32_t channel, uint32_t milli) { kliveAudioSetChannelGainMilli(channel, milli); }
uint32_t samAudioGetChannelGain(uint32_t channel) { return kliveAudioGetChannelGainMilli(channel); }
void samAudioSetTapsEnabled(uint32_t enabled) { kliveAudioSetTapsEnabled(enabled); }
uint32_t samAudioTapsPtr(void) { return (uint32_t)(uintptr_t)kliveAudioTaps; }
uint32_t samGetAudioChannelCount(void) { return KLIVE_AUDIO_CHANNELS; }
uint32_t samGetAudioSampleCapacity(void) { return SAM_AUDIO_SAMPLE_CAPACITY; }
uint32_t samGetAudioSampleCount(void) { return samAudioSampleCount; }
uint32_t samGetAudioSampleRate(void) { return samAudioSampleRate; }
uint32_t samGetAudioOverflows(void) { return samAudioOverflows; }
uint32_t samGetBeeperLevel(void) { return samBeeperLevel; }
