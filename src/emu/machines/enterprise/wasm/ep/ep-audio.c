/*
 * DAVE's sound generator and output (plan §8.2-§8.3; DAVE_MEMORY_IO.md §5, DAVE_AUDIO_BACKGROUND.md
 * §1-§4, §7.2). Stepped once per DAVE tick (250 kHz), in the order the pack records for ep128emu, the
 * validated reference (§3.1): the polynomial counters first, then the counters (ep-dave.c), then the
 * channels in the order noise, ch2, ch1, ch0.
 *
 * Tone channels (A0h-A5h): a 12-bit counter reloads with its code n every n + 1 ticks (ep-dave.c). On a
 * reload the channel's flip-flop toggles (a pure tone, 125 000 / (n + 1) Hz), or with distortion
 * (bits 5-4) takes the current bit of the 4-bit, 5-bit or 7-bit polynomial counter. Bit 6: high-pass,
 * the flip-flop is forced to 0 on each falling edge of the next channel (ch0 by ch1, ch1 by ch2, ch2
 * by the noise). Bit 7: ring modulation, the output is the flip-flop XNOR the partner's output (ch0
 * with ch2, ch1 with the noise, ch2 with ch0), applied continuously. Sync (A7h bits 2-0) holds the
 * counter at its code and the flip-flop at 0; the ring modulator still applies (§1 C, D).
 *
 * Noise (A6h): the noise poly steps on falling edges of its clock - the free-running 31.25 kHz square
 * (a toggle every 4 ticks) or ch0/ch1/ch2's output - a tick late, as in ep128emu. Bits 3-2 choose the
 * variable poly's length (17/15/11/9 bits), bit 4 swaps the 7-bit and variable polys between the tones
 * (at 250 kHz) and the noise (at its clock). Bit 5: low-pass, the held bit takes the poly's bit only on
 * ch2's falling edges; bit 6: high-pass by ch0; bit 7: ring with ch1. In that order (§1 H).
 *
 * Polynomial counters (DAVE_MEMORY_IO.md §5.4): shift left, the new bit 0 is the XOR of two taps, the
 * output is the new bit 0. 4-bit 3/2, 5-bit 4/2, 7-bit 6/5, variable 8/4, 10/8, 14/13, 16/13: periods
 * 2^n - 1 (plan Q7). They start from all ones (ep128emu's state; the reset state of the real chip is
 * open). The variable poly is one register whose feedback taps follow the length, so a length change
 * keeps its low bits (the FPGA's model).
 *
 * Output: per side, the sum of the 6-bit amplitudes (A8h-ABh left, ACh-AFh right) of the channels
 * whose output is 1, 0-252. A side in D/A mode (A7h bit 3 left, bit 4 right) outputs its ch0 amplitude
 * x 4 instead (§1 F). The board's first-order low-pass at about 22.6 kHz is run at the tick rate; each
 * host sample is the filtered level's average over its interval, then a DC high-pass stands in for the
 * output coupling. The two sides are independent.
 *
 * Sample times count in half-T units from the frame's start; `epAudioEndFrame` moves them back by the
 * frame's length.
 */

#define EP_AUDIO_SAMPLE_CAPACITY 2048u
/*
 * The output gain: a side's full scale (252, four channels at amplitude 63) to this level before the
 * DC filter, so a full-scale square swings +-0.5 after it. One channel alone is a quarter of that, the
 * proportion ep128emu gives too (one generator is 8064 of its 40320).
 */
#define EP_AUDIO_GAIN 1.0
/* The board's low-pass (1.5 kOhm || 4.7 nF, 22.6 kHz) at the 250 kHz tick: 1 - exp(-2 pi 22 575 / 250 000) */
#define EP_AUDIO_LOWPASS_ALPHA 0.4330

static double epAudioSamples[EP_AUDIO_SAMPLE_CAPACITY * 2u];
static uint32_t epAudioSampleCount;
static uint32_t epAudioSampleRate;
static uint32_t epAudioOverflows;
/* The sample length and the next sample's time, in half-T units from the frame's start */
static double epAudioSampleLength;
static double epAudioNextSample;
static double epDcAlpha;
static double epDcPrevIn[2];
static double epDcPrevOut[2];
/* The filtered level of each side (0-252), integrated since the last sample up to `epAudioLastPoint` */
static double epAudioLevel[2];
static double epAudioAccumulated[2];
static double epAudioAccumulatedHalves;
static double epAudioLastPoint;

// -----------------------------------------------------------------------------
// The generator's state
// -----------------------------------------------------------------------------

/* The polynomial counters */
static uint32_t epPoly4;
static uint32_t epPoly5;
static uint32_t epPoly7;
static uint32_t epPolyVar;
/* Each tone channel's flip-flop, and every channel's output this tick and last tick (index 3: noise) */
static uint8_t epToneFf[3];
static uint8_t epChOut[4];
static uint8_t epChPrev[4];
/* The noise channel: the poly's bit, and the bit the low-pass holds */
static uint8_t epNoiseRaw;
static uint8_t epNoiseHeld;
/* The 31.25 kHz square: its counter (a toggle every 4 ticks) and its level now and before */
static uint8_t epSquareCount;
static uint8_t epSquare;
static uint8_t epSquarePrev;
/* The sides' levels this tick (0-252), before the low-pass */
static uint32_t epAudioRaw[2];

/* The variable poly's length (A6h bits 3-2: 17, 15, 11, 9) and its taps */
static const uint8_t epVarLength[4] = {17u, 15u, 11u, 9u};
static const uint8_t epVarTapA[4] = {16u, 14u, 10u, 8u};
static const uint8_t epVarTapB[4] = {13u, 13u, 8u, 4u};

/* One step of a shift-left poly of `bits` bits with taps `a` and `b`: returns the new register */
static inline uint32_t epPolyStep(uint32_t r, uint32_t bits, uint32_t a, uint32_t b) {
  const uint32_t bit = ((r >> a) ^ (r >> b)) & 1u;
  return ((r << 1) | bit) & ((1u << bits) - 1u);
}

static inline void epStepVar(void) {
  const uint32_t len = (epDaveReg[6] >> 2) & 3u;
  epPolyVar = epPolyStep(epPolyVar, epVarLength[len], epVarTapA[len], epVarTapB[len]);
}

/* Whether channel `ch`'s output fell from the tick before last to the last tick */
static inline uint8_t epChFell(uint32_t ch) { return epChPrev[ch] && !epChOut[ch]; }

/* The bit the tone channels' distortion samples: 1 the 4-bit poly, 2 the 5-bit, 3 the 7-bit (or the variable one, swapped) */
static inline uint8_t epDistortionBit(uint32_t dist) {
  switch (dist) {
    case 1u:
      return (uint8_t)(epPoly4 & 1u);
    case 2u:
      return (uint8_t)(epPoly5 & 1u);
    default:
      return (uint8_t)(((epDaveReg[6] & 0x10u) ? epPolyVar : epPoly7) & 1u);
  }
}

/* The tick's first step: the polys, the noise poly only if its clock fell before this tick */
static void epAudioTickStart(void) {
  const uint8_t swapped = (uint8_t)(epDaveReg[6] & 0x10u);
  epPoly4 = epPolyStep(epPoly4, 4u, 3u, 2u);
  epPoly5 = epPolyStep(epPoly5, 5u, 4u, 2u);
  // --- The 250 kHz one of the 7-bit / variable pair
  if (swapped) {
    epStepVar();
  } else {
    epPoly7 = epPolyStep(epPoly7, 7u, 6u, 5u);
  }
  // --- The noise-clocked one, on a falling edge of the clock as it was at the end of the last tick
  const uint32_t source = epDaveReg[6] & 3u;
  const uint8_t fell = source == 0u ? (uint8_t)(epSquarePrev && !epSquare) : epChFell(source - 1u);
  if (fell) {
    if (swapped) {
      epPoly7 = epPolyStep(epPoly7, 7u, 6u, 5u);
      epNoiseRaw = (uint8_t)(epPoly7 & 1u);
    } else {
      epStepVar();
      epNoiseRaw = (uint8_t)(epPolyVar & 1u);
    }
    if (!(epDaveReg[6] & 0x20u)) epNoiseHeld = epNoiseRaw;
  }
  // --- The 31.25 kHz square toggles every 4 ticks
  epSquarePrev = epSquare;
  if (++epSquareCount >= 4u) {
    epSquareCount = 0u;
    epSquare ^= 1u;
  }
}

/* A tone channel after its counter: the flip-flop, the high-pass by `clock`, the ring with `ring` */
static inline void epToneChannel(uint32_t ch, uint8_t reloaded, uint32_t clock, uint32_t ring) {
  const uint8_t ctrl = epDaveReg[ch * 2u + 1u];
  epChPrev[ch] = epChOut[ch];
  if (epDaveReg[7] & (1u << ch)) {
    epToneFf[ch] = 0u;
  } else if (reloaded & (1u << ch)) {
    const uint32_t dist = (ctrl >> 4) & 3u;
    epToneFf[ch] = dist == 0u ? (uint8_t)(epToneFf[ch] ^ 1u) : epDistortionBit(dist);
  }
  if ((ctrl & 0x40u) && epChFell(clock)) epToneFf[ch] = 0u;
  epChOut[ch] = (ctrl & 0x80u) ? (uint8_t)(!(epToneFf[ch] ^ epChOut[ring])) : epToneFf[ch];
}

/* Integrates the sides' filtered levels up to `point` (half-T units from the frame's start) */
static inline void epAudioIntegrateUntil(double point) {
  if (point <= epAudioLastPoint) return;
  const double d = point - epAudioLastPoint;
  epAudioAccumulated[0] += epAudioLevel[0] * d;
  epAudioAccumulated[1] += epAudioLevel[1] * d;
  epAudioAccumulatedHalves += d;
  epAudioLastPoint = point;
}

static inline double epAudioPointOf(uint32_t at) { return (double)(int32_t)(at - epFrameStartHalf); }

/* The tick's last step: the channels (noise, ch2, ch1, ch0), then the sides' levels from `at` on */
static void epAudioTickEnd(uint32_t at, uint8_t reloaded) {
  const uint8_t noiseCtrl = epDaveReg[6];
  // --- Noise: low-pass by ch2, high-pass by ch0, ring with ch1 (their last tick's values)
  epChPrev[3] = epChOut[3];
  if ((noiseCtrl & 0x20u) && epChFell(2u)) epNoiseHeld = epNoiseRaw;
  if ((noiseCtrl & 0x40u) && epChFell(0u)) epNoiseHeld = 0u;
  epChOut[3] = (noiseCtrl & 0x80u) ? (uint8_t)(!(epNoiseHeld ^ epChOut[1])) : epNoiseHeld;
  // --- The tones: ch2 (high-pass by the noise, ring with ch0), ch1 (ch2, noise), ch0 (ch1, ch2)
  epToneChannel(2u, reloaded, 3u, 0u);
  epToneChannel(1u, reloaded, 2u, 3u);
  epToneChannel(0u, reloaded, 1u, 2u);
  // --- The sides
  for (uint32_t side = 0u; side < 2u; side++) {
    const uint8_t *amp = &epDaveReg[8u + side * 4u];
    uint32_t level;
    if (epDaveReg[7] & (side ? 0x10u : 0x08u)) {
      level = 4u * (amp[0] & 0x3fu);
    } else {
      level = 0u;
      for (uint32_t ch = 0u; ch < 4u; ch++) {
        if (epChOut[ch]) level += amp[ch] & 0x3fu;
      }
    }
    epAudioRaw[side] = level;
  }
  epAudioIntegrateUntil(epAudioPointOf(at));
  epAudioLevel[0] += EP_AUDIO_LOWPASS_ALPHA * ((double)epAudioRaw[0] - epAudioLevel[0]);
  epAudioLevel[1] += EP_AUDIO_LOWPASS_ALPHA * ((double)epAudioRaw[1] - epAudioLevel[1]);
}

// -----------------------------------------------------------------------------
// Samples
// -----------------------------------------------------------------------------

static inline double epAudioNow(void) { return epAudioPointOf(epHalfClock); }

static void EP_NOINLINE epAudioEmitSample(void) {
  epAudioIntegrateUntil(epAudioNextSample);
  double out[2];
  for (uint32_t side = 0u; side < 2u; side++) {
    const double level = epAudioAccumulatedHalves > 0.0 ? epAudioAccumulated[side] / epAudioAccumulatedHalves : epAudioLevel[side];
    const double raw = level / 252.0 * EP_AUDIO_GAIN;
    double v = raw - epDcPrevIn[side] + epDcAlpha * epDcPrevOut[side];
    epDcPrevIn[side] = raw;
    epDcPrevOut[side] = v;
    if (v > 1.0) v = 1.0;
    if (v < -1.0) v = -1.0;
    out[side] = v;
    epAudioAccumulated[side] = 0.0;
  }
  epAudioAccumulatedHalves = 0.0;
  if (epAudioSampleCount < EP_AUDIO_SAMPLE_CAPACITY) {
    epAudioSamples[epAudioSampleCount * 2u] = out[0];
    epAudioSamples[epAudioSampleCount * 2u + 1u] = out[1];
    epAudioSampleCount++;
  } else {
    epAudioOverflows++;
  }
  epAudioNextSample += epAudioSampleLength;
}

/* The samples whose time has come by `point` (half-T units from the frame's start) */
static inline void epAudioEmitUntil(double point) {
  if (epAudioSampleLength <= 0.0) return;
  while (point >= epAudioNextSample) epAudioEmitSample();
}

/* Every clock step: the samples whose time has come */
static inline void epAudioAdvance(void) { epAudioEmitUntil(epAudioNow()); }

/* The frame ends at `newStart`: the levels up to there, then every point moves back by the frame */
static void epAudioEndFrame(uint32_t newStart) {
  const double length = epAudioPointOf(newStart);
  epAudioIntegrateUntil(length);
  epAudioLastPoint -= length;
  epAudioNextSample -= length;
}

static void epAudioNewFrame(void) { epAudioSampleCount = 0u; }

static void epAudioReset(void) {
  epAudioSampleCount = 0u;
  epAudioNextSample = epAudioSampleLength;
  epAudioLastPoint = 0.0;
  epAudioAccumulatedHalves = 0.0;
  for (uint32_t side = 0u; side < 2u; side++) {
    epAudioLevel[side] = 0.0;
    epAudioAccumulated[side] = 0.0;
    epDcPrevIn[side] = 0.0;
    epDcPrevOut[side] = 0.0;
    epAudioRaw[side] = 0u;
  }
  epPoly4 = 0x0fu;
  epPoly5 = 0x1fu;
  epPoly7 = 0x7fu;
  epPolyVar = 0x1ffffu;
  for (uint32_t ch = 0u; ch < 4u; ch++) {
    epChOut[ch] = 0u;
    epChPrev[ch] = 0u;
  }
  for (uint32_t ch = 0u; ch < 3u; ch++) epToneFf[ch] = 0u;
  epNoiseRaw = 0u;
  epNoiseHeld = 0u;
  epSquareCount = 0u;
  epSquare = 0u;
  epSquarePrev = 0u;
}

/* The host's sample rate (0 stops the samples) and the DC filter's coefficient (`exp(-2 pi fc / rate)`) */
void epSetAudioSampleRate(uint32_t rate, double dcAlpha) {
  epAudioSampleRate = rate;
  epAudioSampleLength = rate ? 2.0 * (double)EP_CLOCK / (double)rate : 0.0;
  epDcAlpha = dcAlpha;
  epAudioNextSample = epAudioNow() + epAudioSampleLength;
  epAudioLastPoint = epAudioNow();
  epAudioAccumulatedHalves = 0.0;
  epAudioAccumulated[0] = 0.0;
  epAudioAccumulated[1] = 0.0;
}

uint32_t epAudioSamplesPtr(void) { return (uint32_t)(uintptr_t)epAudioSamples; }
uint32_t epGetAudioSampleCapacity(void) { return EP_AUDIO_SAMPLE_CAPACITY; }
uint32_t epGetAudioSampleCount(void) { return epAudioSampleCount; }
uint32_t epGetAudioSampleRate(void) { return epAudioSampleRate; }
uint32_t epGetAudioOverflows(void) { return epAudioOverflows; }
/* The generator for the IDE and the tests: the channels' outputs (bits 0-3: ch0-ch2, noise), a side's level (0-252) */
uint32_t epGetChannelOutputs(void) {
  return (uint32_t)epChOut[0] | ((uint32_t)epChOut[1] << 1) | ((uint32_t)epChOut[2] << 2) | ((uint32_t)epChOut[3] << 3);
}
uint32_t epGetSideLevel(uint32_t side) { return epAudioRaw[side & 1u]; }
/* The polynomial counters' registers (0: 4-bit, 1: 5-bit, 2: 7-bit, 3: variable) */
uint32_t epGetPoly(uint32_t index) {
  switch (index & 3u) {
    case 0u:
      return epPoly4;
    case 1u:
      return epPoly5;
    case 2u:
      return epPoly7;
    default:
      return epPolyVar;
  }
}
