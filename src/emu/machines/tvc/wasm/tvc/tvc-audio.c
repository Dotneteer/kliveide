/*
 * The TVC's sound and timer (`.plans/VIDEOTON_TVC_PLAN.md` §10; TVC_HARDWARE_OVERVIEW.md §5; HW
 * pp.99-103; rtvc/info/tvc.md "Sound and Timer").
 *
 *   3.125 MHz -> 12-bit divider (4096 - n clocks) -> 4-bit counter; bit 3 (QD) is the square wave
 *   n = port 05h bits 3-0 : port 04h
 *   port 05h bit 4: the square wave gates the amplitude; clear, the amplitude goes straight out (DAC)
 *   port 05h bit 5: QD is the sound interrupt input (SDINT) of the shared flip-flop (tvc-video.c)
 *   port 06h bits 5-2: the 4-bit amplitude
 *   IN 5Bh/5Fh: reloads the divider and clears the counter
 *
 * The divider runs on the fixed 3.125 MHz clock (2 half-T units a count), so the counter is a
 * function of time: counter(t) = floor((t - anchor) / period) mod 16, with `period` the divider's
 * length in half-T units and `anchor` the half-T time the counter was last 0 with a fresh divider.
 * Nothing runs per T-state. A divider change keeps the counter's value and starts the new length
 * from now (the hardware reloads at the next carry; the difference is under one divider period).
 *
 * The first interrupt after a restart comes 16 divider periods later, when the counter wraps (plan
 * Q2: the manual says 8, both emulators 16; `TVC_SOUND_FIRST_IT_PERIODS` holds the choice).
 *
 * Samples: each is the output's average over its interval (the square wave integrated in closed
 * form), unipolar 0-1 as the DAC is, then a DC high-pass (the output is AC-coupled) and both sides
 * of a stereo buffer, as the HT-1080Z's (`ht1080z-audio.c`). Sample times count in half-T units from
 * the frame's start; `tvcAudioEndFrame` moves them back by the frame's length.
 */

#define TVC_AUDIO_SAMPLE_CAPACITY 2048u
#define TVC_SOUND_FIRST_IT_PERIODS 16u
#define TVC_SOUND_GAIN 0.5
/* Re-anchor the counter long before `tvcHalfClock - anchor` could wrap */
#define TVC_SOUND_REANCHOR_HALVES 0x40000000u

static double tvcAudioSamples[TVC_AUDIO_SAMPLE_CAPACITY * 2u];
static uint32_t tvcAudioSampleCount;
static uint32_t tvcAudioSampleRate;
static uint32_t tvcAudioOverflows;
/* The sample length and the next sample's time, in half-T units from the frame's start */
static double tvcAudioSampleLength;
static double tvcAudioNextSample;
static double tvcDcAlpha;
static double tvcDcPrevInput;
static double tvcDcPrevOutput;
/* The output integrated since the last sample, and up to when (half-T units from the frame's start) */
static double tvcAudioAccumulated;
static double tvcAudioAccumulatedHalves;
static double tvcAudioLastPoint;

/* The divider: its length in half-T units and the time the counter was last 0 */
static uint32_t tvcSoundPeriod = 2u * 4096u;
static uint32_t tvcSoundAnchor;

static inline uint32_t tvcSoundDivisor(void) { return ((uint32_t)(tvcPort05 & 0x0fu) << 8) | tvcPort04; }

/* The 4-bit counter at half-T time `t` */
static inline uint32_t tvcSoundCounterAt(uint32_t t) { return ((t - tvcSoundAnchor) / tvcSoundPeriod) & 15u; }

/*
 * Moves the anchor forward by whole counter cycles (16 periods), so `t - anchor` never wraps; the
 * counter's value at every time is unchanged. Called by every reader of the counter.
 */
static inline void tvcSoundReanchor(uint32_t t) {
  if (t - tvcSoundAnchor >= TVC_SOUND_REANCHOR_HALVES && (int32_t)(t - tvcSoundAnchor) > 0) {
    const uint32_t cycle = 16u * tvcSoundPeriod;
    tvcSoundAnchor += ((t - tvcSoundAnchor) / cycle - 1u) * cycle;
  }
}

/* The sound interrupt input now: QD, when port 05h bit 5 enables it */
static inline uint8_t tvcSoundItLevel(uint32_t t) {
  tvcSoundReanchor(t);
  if (!(tvcPort05 & 0x20u)) return 0u;
  return (uint8_t)((tvcSoundCounterAt(t) >> 3) & 1u);
}

/* The largest integer not above `x` (no libm here) */
static inline double tvcFloor(double x) {
  double i = (double)(int64_t)x;
  return i > x ? i - 1.0 : i;
}

/* Half-T units QD is high in [anchor, anchor + d): 8 periods of every 16 (d may be negative) */
static inline double tvcSoundHighUntil(double d) {
  const double period = (double)tvcSoundPeriod;
  const double cycle = 16.0 * period;
  const double cycles = tvcFloor(d / cycle);
  double rem = d - cycles * cycle - 8.0 * period;
  if (rem < 0.0) rem = 0.0;
  return cycles * 8.0 * period + rem;
}

/* The output's level now (0-1, before the gain): the amplitude, gated by QD when port 05h bit 4 is set */
static inline double tvcSoundAmplitude(void) { return (double)((tvcPort06 >> 2) & 15u) / 15.0; }

/* The current frame's start is `tvcFrameStartHalf`: a point as half-T units from it */
static inline double tvcAudioNow(void) { return (double)(int32_t)(tvcHalfClock - tvcFrameStartHalf); }

/* Integrates the output from the last point up to `point` (half-T units from the frame's start) */
static void tvcAudioAccumulateUntil(double point) {
  if (point <= tvcAudioLastPoint) return;
  tvcSoundReanchor(tvcHalfClock);
  const double duration = point - tvcAudioLastPoint;
  const double amplitude = tvcSoundAmplitude();
  if (tvcPort05 & 0x10u) {
    // --- The square wave's high time in the interval, measured from the anchor
    const double base = (double)(int32_t)(tvcFrameStartHalf - tvcSoundAnchor);
    const double high = tvcSoundHighUntil(base + point) - tvcSoundHighUntil(base + tvcAudioLastPoint);
    tvcAudioAccumulated += amplitude * high;
  } else {
    tvcAudioAccumulated += amplitude * duration;
  }
  tvcAudioAccumulatedHalves += duration;
  tvcAudioLastPoint = point;
}

static void TVC_NOINLINE tvcAudioEmitSample(void) {
  tvcAudioAccumulateUntil(tvcAudioNextSample);
  const double level = tvcAudioAccumulatedHalves > 0.0 ? tvcAudioAccumulated / tvcAudioAccumulatedHalves : 0.0;
  tvcAudioAccumulated = 0.0;
  tvcAudioAccumulatedHalves = 0.0;
  const double raw = level * TVC_SOUND_GAIN;
  double out = raw - tvcDcPrevInput + tvcDcAlpha * tvcDcPrevOutput;
  tvcDcPrevInput = raw;
  tvcDcPrevOutput = out;
  if (out > 1.0) out = 1.0;
  if (out < -1.0) out = -1.0;
  if (tvcAudioSampleCount < TVC_AUDIO_SAMPLE_CAPACITY) {
    tvcAudioSamples[tvcAudioSampleCount * 2u] = out;
    tvcAudioSamples[tvcAudioSampleCount * 2u + 1u] = out;
    tvcAudioSampleCount++;
  } else {
    tvcAudioOverflows++;
  }
  tvcAudioNextSample += tvcAudioSampleLength;
}

/* Every clock step: the samples whose time has come */
static inline void tvcAudioAdvance(void) {
  if (tvcAudioSampleLength <= 0.0) return;
  const double now = tvcAudioNow();
  while (now >= tvcAudioNextSample) tvcAudioEmitSample();
}

/* A register write changes the output from now on: integrate up to now with the old values first */
static inline void tvcAudioBeforeChange(void) { tvcAudioAccumulateUntil(tvcAudioNow()); }

/* Port 04h or 05h written: a new divisor keeps the counter's value, its new length runs from now */
static void tvcSoundSetDivisor(void) {
  const uint32_t now = tvcHalfClock;
  const uint32_t counter = tvcSoundCounterAt(now);
  tvcSoundPeriod = 2u * (4096u - tvcSoundDivisor());
  tvcSoundAnchor = now - counter * tvcSoundPeriod;
}

/* IN 5Bh/5Fh: the divider reloads and the counter clears */
static void tvcSoundRestart(void) {
  tvcAudioBeforeChange();
  tvcSoundAnchor = tvcHalfClock - (16u - TVC_SOUND_FIRST_IT_PERIODS) * tvcSoundPeriod;
}

/* The frame ends at `newStart`: the output up to there, then every point moves back by the frame */
static void tvcAudioEndFrame(uint32_t newStart) {
  const double length = (double)(int32_t)(newStart - tvcFrameStartHalf);
  tvcAudioAccumulateUntil(length);
  tvcAudioLastPoint -= length;
  tvcAudioNextSample -= length;
}

static void tvcAudioNewFrame(void) { tvcAudioSampleCount = 0u; }

static void tvcAudioReset(void) {
  tvcAudioSampleCount = 0u;
  tvcAudioNextSample = tvcAudioSampleLength;
  tvcAudioAccumulated = 0.0;
  tvcAudioAccumulatedHalves = 0.0;
  tvcAudioLastPoint = 0.0;
  tvcDcPrevInput = 0.0;
  tvcDcPrevOutput = 0.0;
  tvcSoundPeriod = 2u * 4096u;
  tvcSoundAnchor = 0u;
}

/*
 * The host's sample rate and the DC filter's coefficient (`exp(-2 * pi * 1.4 / rate)`); 0 stops the
 * samples. The first sample is one sample length from now.
 */
void tvcSetAudioSampleRate(uint32_t rate, double dcAlpha) {
  tvcAudioSampleRate = rate;
  tvcAudioSampleLength = rate ? 2.0 * (double)TVC_CLOCK / (double)rate : 0.0;
  tvcDcAlpha = dcAlpha;
  tvcAudioNextSample = tvcAudioNow() + tvcAudioSampleLength;
  tvcAudioLastPoint = tvcAudioNow();
}

uint32_t tvcAudioSamplesPtr(void) { return (uint32_t)(uintptr_t)tvcAudioSamples; }
uint32_t tvcGetAudioSampleCapacity(void) { return TVC_AUDIO_SAMPLE_CAPACITY; }
uint32_t tvcGetAudioSampleCount(void) { return tvcAudioSampleCount; }
uint32_t tvcGetAudioSampleRate(void) { return tvcAudioSampleRate; }
uint32_t tvcGetAudioOverflows(void) { return tvcAudioOverflows; }
/* The sound generator, for the IDE and the tests: the divisor, the counter now, the amplitude */
uint32_t tvcGetSoundDivisor(void) { return tvcSoundDivisor(); }
uint32_t tvcGetSoundCounter(void) { return tvcSoundCounterAt(tvcHalfClock); }
uint32_t tvcGetSoundAmplitude(void) { return (tvcPort06 >> 2) & 15u; }
