/*
 * The Philips SAA 1099 (plan §8.1, D8; SOUND_INPUT_IO.md §1), ported from SAASound.
 *
 * Ported from SAASound (https://github.com/stripwax/SAASound, commit 3d92322, pinned in
 * dev/research/sam-coupe/saasound/): SAAFreq.cpp, SAANoise.cpp, SAAEnv.cpp, SAAAmp.cpp and SAADevice.cpp.
 *
 *   Copyright (c) 1998-2004, Dave Hooper <dave@beermex.com>
 *   Copyright (c) 2004-2025, Dave Hooper <dave@beermex.com> + Simon Owen <simon@simonowen.com>
 *   All rights reserved.
 *
 *   Redistribution and use in source and binary forms, with or without modification, are permitted
 *   provided that the following conditions are met:
 *   - Redistributions of source code must retain the above copyright notice, this list of conditions and
 *     the following disclaimer.
 *   - Redistributions in binary form must reproduce the above copyright notice, this list of conditions
 *     and the following disclaimer in the documentation and/or other materials provided with the
 *     distribution.
 *   - Neither the name Dave Hooper nor the names of its contributors may be used to endorse or promote
 *     products derived from this software without specific prior written permission.
 *
 *   THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED
 *   WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A
 *   PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
 *   ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 *   LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 *   INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR
 *   TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF
 *   ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 * What is SAASound's, unchanged: the tone generators' buffered octave/offset rules and sync; the noise
 * generators (18-bit Galois LFSR, taps 20400h, seeded all ones; 31.25/15.6/7.8 kHz or tone 0 / tone 3);
 * the envelope generators (the level tables, buffering at points (3)/(4), the 3/4-bit switch mid-shape,
 * internal clock from tone 1 / tone 4, external clock from an address write of 18h/19h); the mixer
 * (tone * (2 - noise)); the amplitude stage, including the pulse-density table for enveloped channels;
 * which generator feeds which channel; mute and sync.
 *
 * What is Klive's: time. SAASound steps its generators once per output sample (with oversampling) and
 * approximates periods with a 12-bit fraction; here each generator's next edge is an exact time in 24 MHz
 * units from the frame's start (a T-state is 4, a master clock 3), and the generators run in catch-up
 * (`samSaaRunUntil`), events in time order, before every write and every cell. A noise source change keeps
 * the fraction of the period already run, as SAASound's counter does. The output level is the sum of the
 * six channels in SAASound's units (0-480 a channel, 0-2880 a side); the audio integrator (sam-audio.c)
 * averages it over each host sample in place of SAASound's oversampling.
 *
 * The register file (`samSaaRegs`) is kept for the debugger only: the SAA 1099 is write-only.
 */

#define SAM_SAA_UNITS_PER_T 4u
#define SAM_SAA_UNITS_PER_CLOCK 3u

static uint8_t samSaaRegs[32];
static uint8_t samSaaAddress;
/* The device's sync (1Ch bit 1) and output enable (1Ch bit 0) */
static uint8_t samSaaSync;
static uint8_t samSaaOutputEnabled;

/* Tone generators (CSAAFreq) */
static uint8_t samSaaToneLevel[6];
static uint8_t samSaaOctave[6];
static uint8_t samSaaOffset[6];
static uint8_t samSaaNextOctave[6];
static uint8_t samSaaNextOffset[6];
static uint8_t samSaaNewData[6];
static uint8_t samSaaIgnoreOffset[6];
static double samSaaToneNext[6];

/* Noise generators (CSAANoise) */
static uint32_t samSaaLfsr[2];
static uint8_t samSaaNoiseSource[2];
static double samSaaNoiseNext[2];
/* The fraction of a period left while the generator does not run on its own clock (source 3, sync) */
static double samSaaNoiseRemain[2];

/* Envelope generators (CSAAEnv) */
static uint8_t samSaaEnvEnabled[2];
static uint8_t samSaaEnvInvertRight[2];
static uint8_t samSaaEnvShape[2];
static uint8_t samSaaEnvPhase[2];
static uint8_t samSaaEnvPhasePosition[2];
static uint8_t samSaaEnvEnded[2];
static uint8_t samSaaEnvResolution[2];
static uint8_t samSaaEnvNewData[2];
static uint8_t samSaaEnvNextData[2];
static uint8_t samSaaEnvClockExternally[2];
static uint8_t samSaaEnvLeft[2];
static uint8_t samSaaEnvRight[2];

/* Amplitude stages (CSAAAmp): bit 0 tone, bit 1 noise */
static uint8_t samSaaMixMode[6];

/* The time the generators have reached, 24 MHz units from the frame's start */
static double samSaaNow;

/* Per side, the current output level (0-2880: six channels of 0-480) */
static double samSaaLevel[2];

static inline double samSaaHalfPeriod(uint32_t ch) {
  return (double)(((511u - samSaaOffset[ch]) << (8u - samSaaOctave[ch])) * SAM_SAA_UNITS_PER_CLOCK);
}

static inline double samSaaNoisePeriod(uint32_t gen) {
  return (double)((256u << samSaaNoiseSource[gen]) * SAM_SAA_UNITS_PER_CLOCK);
}

/* The noise generator runs on its own clock (sources 0-2, not synced) */
static inline uint8_t samSaaNoiseFreeRunning(uint32_t gen) { return samSaaNoiseSource[gen] != 3u && !samSaaSync; }

// -----------------------------------------------------------------------------
// Noise (SAANoise.cpp)
// -----------------------------------------------------------------------------

/* ChangeLevel: SAA1099P noise as documented by Jepael, x^18 + x^11 + x^1, checked against a recording */
static inline void samSaaNoiseShift(uint32_t gen) {
  samSaaLfsr[gen] = (samSaaLfsr[gen] & 1u) ? (samSaaLfsr[gen] >> 1) ^ 0x20400u : samSaaLfsr[gen] >> 1;
}

/* Parks the generator's progress as a fraction of its period */
static void samSaaNoisePark(uint32_t gen) {
  if (!samSaaNoiseFreeRunning(gen)) return;
  double remain = (samSaaNoiseNext[gen] - samSaaNow) / samSaaNoisePeriod(gen);
  if (remain < 0.0) remain = 0.0;
  if (remain > 1.0) remain = 1.0;
  samSaaNoiseRemain[gen] = remain;
}

/* Resumes a parked generator from its fraction */
static void samSaaNoiseResume(uint32_t gen) {
  if (!samSaaNoiseFreeRunning(gen)) return;
  samSaaNoiseNext[gen] = samSaaNow + samSaaNoiseRemain[gen] * samSaaNoisePeriod(gen);
}

static void samSaaNoiseSetSource(uint32_t gen, uint8_t source) {
  if (source == samSaaNoiseSource[gen]) return;
  samSaaNoisePark(gen);
  samSaaNoiseSource[gen] = source;
  samSaaNoiseResume(gen);
}

/* A tone generator's half cycle: clocks the noise only from source 3 */
static inline void samSaaNoiseTrigger(uint32_t gen) {
  if (samSaaNoiseSource[gen] == 3u) samSaaNoiseShift(gen);
}

// -----------------------------------------------------------------------------
// Envelopes (SAAEnv.cpp)
// -----------------------------------------------------------------------------

/* Phases per shape, whether it loops, and the levels [shape][resolution - 1][phase][position] */
static const uint8_t samSaaEnvPhases[8] = {1u, 1u, 1u, 1u, 2u, 2u, 1u, 1u};
static const uint8_t samSaaEnvLooping[8] = {0u, 1u, 0u, 1u, 0u, 1u, 0u, 1u};
static const uint8_t samSaaEnvLevels[8][2][2][16] = {
    {{{0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}},
     {{0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}}},
    {{{15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15},
      {15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15}},
     {{14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14},
      {14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14}}},
    {{{15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}},
     {{14, 14, 12, 12, 10, 10, 8, 8, 6, 6, 4, 4, 2, 2, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}}},
    {{{15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}},
     {{14, 14, 12, 12, 10, 10, 8, 8, 6, 6, 4, 4, 2, 2, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}}},
    {{{0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15}, {15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0}},
     {{0, 0, 2, 2, 4, 4, 6, 6, 8, 8, 10, 10, 12, 12, 14, 14}, {14, 14, 12, 12, 10, 10, 8, 8, 6, 6, 4, 4, 2, 2, 0, 0}}},
    {{{0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15}, {15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0}},
     {{0, 0, 2, 2, 4, 4, 6, 6, 8, 8, 10, 10, 12, 12, 14, 14}, {14, 14, 12, 12, 10, 10, 8, 8, 6, 6, 4, 4, 2, 2, 0, 0}}},
    {{{0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}},
     {{0, 0, 2, 2, 4, 4, 6, 6, 8, 8, 10, 10, 12, 12, 14, 14}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}}},
    {{{0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}},
     {{0, 0, 2, 2, 4, 4, 6, 6, 8, 8, 10, 10, 12, 12, 14, 14}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}}}};

static void samSaaEnvSetLevels(uint32_t g) {
  const uint8_t shape = samSaaEnvShape[g];
  const uint8_t looping = samSaaEnvLooping[shape];
  // --- The non-looping shapes sustain at zero
  const uint8_t left = (samSaaEnvEnded[g] && !looping)
                           ? 0u
                           : samSaaEnvLevels[shape][samSaaEnvResolution[g] - 1u][samSaaEnvPhase[g]]
                                            [samSaaEnvPhasePosition[g] & 0x0fu];
  samSaaEnvLeft[g] = left;
  if (samSaaEnvInvertRight[g]) {
    samSaaEnvRight[g] = (uint8_t)((samSaaEnvResolution[g] == 2u ? 14u : 15u) - left);
  } else {
    samSaaEnvRight[g] = left;
  }
}

static void samSaaEnvSetNewData(uint32_t g, uint8_t data) {
  samSaaEnvPhase[g] = 0u;
  samSaaEnvPhasePosition[g] = 0u;
  samSaaEnvShape[g] = (uint8_t)((data >> 1) & 7u);
  samSaaEnvInvertRight[g] = (data & 0x01u) != 0u;
  samSaaEnvClockExternally[g] = (data & 0x20u) != 0u;
  samSaaEnvResolution[g] = (data & 0x10u) ? 2u : 1u;
  samSaaEnvEnabled[g] = (data & 0x80u) != 0u;
  if (samSaaEnvEnabled[g]) {
    samSaaEnvEnded[g] = 0u;
  } else {
    samSaaEnvEnded[g] = 1u;
    samSaaEnvPhase[g] = 0u;
    samSaaEnvPhasePosition[g] = 0u;
  }
  samSaaEnvSetLevels(g);
}

static void samSaaEnvSetControl(uint32_t g, uint8_t data) {
  // --- The enable bit acts at once
  const uint8_t enabled = (data & 0x80u) != 0u;
  if (!enabled && !samSaaEnvEnabled[g]) return;
  samSaaEnvEnabled[g] = enabled;
  if (!enabled) {
    // --- Disabled: later control changes are immediate
    samSaaEnvEnded[g] = 1u;
    return;
  }
  // --- So does the resolution: 4 to 3 bits clears the position's LSB, 3 to 4 sets it (test case envext_34b)
  const uint8_t resolution = (data & 0x10u) ? 2u : 1u;
  if (samSaaEnvResolution[g] == 1u && resolution == 2u) {
    samSaaEnvPhasePosition[g] &= 0x0eu;
  } else if (samSaaEnvResolution[g] == 2u && resolution == 1u) {
    samSaaEnvPhasePosition[g] |= 0x01u;
  }
  samSaaEnvResolution[g] = resolution;
  // --- The rest is buffered until the envelope ends
  if (samSaaEnvEnded[g]) {
    samSaaEnvSetNewData(g, data);
    samSaaEnvNewData[g] = 0u;
  } else {
    samSaaEnvSetLevels(g);
    samSaaEnvNewData[g] = 1u;
    samSaaEnvNextData[g] = data;
  }
}

static void samSaaEnvTick(uint32_t g) {
  if (!samSaaEnvEnabled[g]) {
    samSaaEnvEnded[g] = 1u;
    samSaaEnvPhase[g] = 0u;
    samSaaEnvPhasePosition[g] = 0u;
    return;
  }
  if (samSaaEnvEnded[g]) return;
  samSaaEnvPhasePosition[g] = (uint8_t)(samSaaEnvPhasePosition[g] + samSaaEnvResolution[g]);
  uint8_t processNewData = 0u;
  if (samSaaEnvPhasePosition[g] >= 16u) {
    samSaaEnvPhase[g]++;
    if (samSaaEnvPhase[g] == samSaaEnvPhases[samSaaEnvShape[g]]) {
      if (!samSaaEnvLooping[samSaaEnvShape[g]]) {
        // --- Point (3): the envelope ends
        samSaaEnvEnded[g] = 1u;
        processNewData = 1u;
      } else {
        // --- Point (4): the loop; latched data acts only here (test case envext_34c)
        samSaaEnvEnded[g] = 0u;
        samSaaEnvPhase[g] = 0u;
        samSaaEnvPhasePosition[g] = (uint8_t)(samSaaEnvPhasePosition[g] - 16u);
        processNewData = 1u;
      }
    } else {
      // --- The middle of a two-phase (triangle) shape
      samSaaEnvEnded[g] = 0u;
      samSaaEnvPhasePosition[g] = (uint8_t)(samSaaEnvPhasePosition[g] - 16u);
    }
  } else {
    samSaaEnvEnded[g] = 0u;
  }
  if (samSaaEnvNewData[g] && processNewData) {
    samSaaEnvNewData[g] = 0u;
    samSaaEnvSetNewData(g, samSaaEnvNextData[g]);
  } else {
    samSaaEnvSetLevels(g);
  }
}

static inline void samSaaEnvInternalClock(uint32_t g) {
  if (samSaaEnvEnabled[g] && !samSaaEnvClockExternally[g]) samSaaEnvTick(g);
}

static inline void samSaaEnvExternalClock(uint32_t g) {
  if (samSaaEnvClockExternally[g] && samSaaEnvEnabled[g]) samSaaEnvTick(g);
}

// -----------------------------------------------------------------------------
// Tone generators (SAAFreq.cpp)
// -----------------------------------------------------------------------------

static void samSaaSetOffset(uint32_t ch, uint8_t offset) {
  if (!samSaaSync) {
    samSaaNextOffset[ch] = offset;
    samSaaNewData[ch] = 1u;
    // --- With no octave change pending, the offset acts one half cycle later (SAASound's rule)
    if (samSaaNextOctave[ch] == samSaaOctave[ch]) samSaaIgnoreOffset[ch] = 1u;
  } else {
    // --- Synced: at once
    samSaaNewData[ch] = 0u;
    samSaaIgnoreOffset[ch] = 0u;
    samSaaOffset[ch] = offset;
    samSaaNextOffset[ch] = offset;
    samSaaOctave[ch] = samSaaNextOctave[ch];
  }
}

static void samSaaSetOctave(uint32_t ch, uint8_t octave) {
  if (!samSaaSync) {
    samSaaNextOctave[ch] = octave;
    samSaaNewData[ch] = 1u;
    samSaaIgnoreOffset[ch] = 0u;
  } else {
    samSaaNewData[ch] = 0u;
    samSaaIgnoreOffset[ch] = 0u;
    samSaaOctave[ch] = octave;
    samSaaNextOctave[ch] = octave;
    samSaaOffset[ch] = samSaaNextOffset[ch];
  }
}

/* At the end of a half cycle: the buffered octave, and the offset unless it waits one more */
static void samSaaUpdateOctaveOffset(uint32_t ch) {
  if (!samSaaNewData[ch]) return;
  samSaaOctave[ch] = samSaaNextOctave[ch];
  if (!samSaaIgnoreOffset[ch]) {
    samSaaOffset[ch] = samSaaNextOffset[ch];
    samSaaNewData[ch] = 0u;
  }
  samSaaIgnoreOffset[ch] = 0u;
}

/* Tone `ch`'s half cycle ends: the toggle, what it clocks, then the buffered values */
static void samSaaToneToggle(uint32_t ch) {
  samSaaToneLevel[ch] ^= 1u;
  if (ch == 0u) samSaaNoiseTrigger(0u);
  else if (ch == 3u) samSaaNoiseTrigger(1u);
  else if (ch == 1u) samSaaEnvInternalClock(0u);
  else if (ch == 4u) samSaaEnvInternalClock(1u);
  samSaaUpdateOctaveOffset(ch);
  samSaaToneNext[ch] += samSaaHalfPeriod(ch);
}

// -----------------------------------------------------------------------------
// Output (SAAAmp.cpp)
// -----------------------------------------------------------------------------

/* The low-pass result of ANDing the amplitude's and the envelope's PDM patterns */
static const uint8_t samSaaPdm[8][16] = {
    {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0},
    {0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8},
    {0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15},
    {0, 2, 3, 5, 6, 8, 9, 11, 12, 14, 15, 17, 18, 20, 21, 23},
    {0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30},
    {0, 3, 5, 8, 10, 13, 15, 18, 20, 23, 25, 28, 30, 33, 35, 38},
    {0, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36, 39, 42, 45},
    {0, 4, 7, 11, 14, 18, 21, 25, 28, 32, 35, 39, 42, 46, 49, 53}};

/* A channel's mixer output: 0, 1 or 2 */
static inline uint32_t samSaaIntermediate(uint32_t ch) {
  const uint32_t tone = samSaaToneLevel[ch];
  const uint32_t noise = samSaaLfsr[ch / 3u] & 1u;
  switch (samSaaMixMode[ch]) {
    case 1u:
      return tone * 2u;
    case 2u:
      return noise * 2u;
    case 3u:
      return tone * (2u - noise);
    default:
      return 0u;
  }
}

/* The two sides' levels from the generators as they are now */
static void samSaaUpdateLevel(void) {
  samSaaLevel[0] = 0.0;
  samSaaLevel[1] = 0.0;
  if (samSaaSync || !samSaaOutputEnabled) return;
  for (uint32_t ch = 0u; ch < 6u; ch++) {
    const uint32_t inter = samSaaIntermediate(ch);
    const uint32_t ampL = samSaaRegs[ch] & 0x0fu;
    const uint32_t ampR = (samSaaRegs[ch] >> 4) & 0x0fu;
    const uint32_t g = ch / 3u;
    if ((ch == 2u || ch == 5u) && samSaaEnvEnabled[g]) {
      samSaaLevel[0] += (double)(samSaaPdm[ampL >> 1][samSaaEnvLeft[g]] * 4u * (2u - inter));
      samSaaLevel[1] += (double)(samSaaPdm[ampR >> 1][samSaaEnvRight[g]] * 4u * (2u - inter));
    } else {
      samSaaLevel[0] += (double)(ampL * inter * 16u);
      samSaaLevel[1] += (double)(ampR * inter * 16u);
    }
  }
}

// -----------------------------------------------------------------------------
// Time
// -----------------------------------------------------------------------------

/* Defined in sam-audio.c: the integrator takes the level up to `point` */
static void samAudioIntegrateUntil(double point);

/* Runs the generators up to `until` (24 MHz units from the frame's start) */
static void samSaaRunUntil(double until) {
  if (samSaaSync) {
    samAudioIntegrateUntil(until);
    samSaaNow = until;
    return;
  }
  for (;;) {
    double next = until;
    int32_t kind = -1;
    for (uint32_t ch = 0u; ch < 6u; ch++) {
      if (samSaaToneNext[ch] < next) {
        next = samSaaToneNext[ch];
        kind = (int32_t)ch;
      }
    }
    for (uint32_t gen = 0u; gen < 2u; gen++) {
      if (samSaaNoiseSource[gen] != 3u && samSaaNoiseNext[gen] < next) {
        next = samSaaNoiseNext[gen];
        kind = 6 + (int32_t)gen;
      }
    }
    if (kind < 0) break;
    samAudioIntegrateUntil(next);
    samSaaNow = next;
    if (kind < 6) {
      samSaaToneToggle((uint32_t)kind);
    } else {
      const uint32_t gen = (uint32_t)(kind - 6);
      samSaaNoiseShift(gen);
      samSaaNoiseNext[gen] += samSaaNoisePeriod(gen);
    }
    samSaaUpdateLevel();
  }
  samAudioIntegrateUntil(until);
  samSaaNow = until;
}

// -----------------------------------------------------------------------------
// The register file (SAADevice.cpp)
// -----------------------------------------------------------------------------

static void samSaaSetSync(uint8_t sync) {
  if (sync == samSaaSync) return;
  if (sync) {
    // --- Tones: counters cleared, level 1, the next values loaded; noise: counters cleared
    for (uint32_t ch = 0u; ch < 6u; ch++) {
      samSaaToneLevel[ch] = 1u;
      samSaaOctave[ch] = samSaaNextOctave[ch];
      samSaaOffset[ch] = samSaaNextOffset[ch];
    }
    for (uint32_t gen = 0u; gen < 2u; gen++) samSaaNoiseRemain[gen] = 1.0;
    samSaaSync = 1u;
  } else {
    // --- Released: every generator starts a full period from now
    samSaaSync = 0u;
    for (uint32_t ch = 0u; ch < 6u; ch++) samSaaToneNext[ch] = samSaaNow + samSaaHalfPeriod(ch);
    for (uint32_t gen = 0u; gen < 2u; gen++) samSaaNoiseResume(gen);
  }
}

static void samSaaWriteData(uint8_t value) {
  const uint8_t reg = samSaaAddress;
  samSaaRegs[reg] = value;
  if (reg <= 0x05u) {
    // --- Amplitudes: read from the register file
  } else if (reg >= 0x08u && reg <= 0x0du) {
    samSaaSetOffset(reg - 0x08u, value);
  } else if (reg >= 0x10u && reg <= 0x12u) {
    samSaaSetOctave((reg - 0x10u) * 2u, (uint8_t)(value & 7u));
    samSaaSetOctave((reg - 0x10u) * 2u + 1u, (uint8_t)((value >> 4) & 7u));
  } else if (reg == 0x14u || reg == 0x15u) {
    const uint8_t bit = reg == 0x14u ? 0x01u : 0x02u;
    for (uint32_t ch = 0u; ch < 6u; ch++) {
      if ((value >> ch) & 1u) samSaaMixMode[ch] |= bit;
      else samSaaMixMode[ch] &= (uint8_t)~bit;
    }
  } else if (reg == 0x16u) {
    samSaaNoiseSetSource(0u, (uint8_t)(value & 3u));
    samSaaNoiseSetSource(1u, (uint8_t)((value >> 4) & 3u));
  } else if (reg == 0x18u || reg == 0x19u) {
    samSaaEnvSetControl(reg - 0x18u, value);
  } else if (reg == 0x1cu) {
    samSaaSetSync((value & 0x02u) != 0u);
    samSaaOutputEnabled = (value & 0x01u) != 0u;
  }
  samSaaUpdateLevel();
}

static void samSaaWriteAddress(uint8_t value) {
  samSaaAddress = (uint8_t)(value & 0x1fu);
  // --- An address write of 18h/19h is the external envelope clock
  if (samSaaAddress == 0x18u) samSaaEnvExternalClock(0u);
  else if (samSaaAddress == 0x19u) samSaaEnvExternalClock(1u);
  samSaaUpdateLevel();
}

/* The frame ends `length` units after its start: every time moves back by it */
static void samSaaEndFrame(double length) {
  samSaaNow -= length;
  for (uint32_t ch = 0u; ch < 6u; ch++) samSaaToneNext[ch] -= length;
  for (uint32_t gen = 0u; gen < 2u; gen++) samSaaNoiseNext[gen] -= length;
}

/* Power on (the reset button does not reset the SAA, SOUND §1.1): SAASound's constructed state */
static void samSaaPowerOn(void) {
  for (uint32_t i = 0u; i < 32u; i++) samSaaRegs[i] = 0u;
  samSaaAddress = 0u;
  samSaaSync = 0u;
  samSaaOutputEnabled = 0u;
  samSaaNow = 0.0;
  for (uint32_t ch = 0u; ch < 6u; ch++) {
    samSaaToneLevel[ch] = 1u;
    samSaaOctave[ch] = 0u;
    samSaaOffset[ch] = 0u;
    samSaaNextOctave[ch] = 0u;
    samSaaNextOffset[ch] = 0u;
    samSaaNewData[ch] = 0u;
    samSaaIgnoreOffset[ch] = 0u;
    samSaaMixMode[ch] = 0u;
    samSaaToneNext[ch] = samSaaHalfPeriod(ch);
  }
  for (uint32_t gen = 0u; gen < 2u; gen++) {
    samSaaLfsr[gen] = 0xffffffffu;
    samSaaNoiseSource[gen] = 0u;
    samSaaNoiseRemain[gen] = 1.0;
    samSaaNoiseNext[gen] = samSaaNoisePeriod(gen);
  }
  for (uint32_t g = 0u; g < 2u; g++) {
    samSaaEnvEnabled[g] = 0u;
    samSaaEnvInvertRight[g] = 0u;
    samSaaEnvShape[g] = 0u;
    samSaaEnvPhase[g] = 0u;
    samSaaEnvPhasePosition[g] = 0u;
    samSaaEnvEnded[g] = 1u;
    samSaaEnvResolution[g] = 1u;
    samSaaEnvNewData[g] = 0u;
    samSaaEnvNextData[g] = 0u;
    samSaaEnvClockExternally[g] = 0u;
    samSaaEnvLeft[g] = 0u;
    samSaaEnvRight[g] = 0u;
  }
  samSaaUpdateLevel();
}

// -----------------------------------------------------------------------------
// The debugger's view
// -----------------------------------------------------------------------------

uint32_t samSaaGetRegister(uint32_t reg) { return samSaaRegs[reg & 31u]; }
uint32_t samSaaGetAddress(void) { return samSaaAddress; }
/* Bits 0-5: the tone generators' levels; bits 8-9: the noise generators' outputs */
uint32_t samSaaGetOutputs(void) {
  uint32_t v = 0u;
  for (uint32_t ch = 0u; ch < 6u; ch++) v |= (uint32_t)(samSaaSync ? 1u : samSaaToneLevel[ch]) << ch;
  v |= (samSaaLfsr[0] & 1u) << 8;
  v |= (samSaaLfsr[1] & 1u) << 9;
  return v;
}
uint32_t samSaaGetLfsr(uint32_t gen) { return samSaaLfsr[gen & 1u]; }
/*
 * An envelope's state: bits 0-7 the control byte in effect (rebuilt from the generator), 8-15 the position
 * in the shape (0-31), 16 ended, 17 a control byte waiting, 24-27 the left level
 */
uint32_t samSaaGetEnvelope(uint32_t g) {
  g &= 1u;
  const uint32_t control = ((uint32_t)samSaaEnvEnabled[g] << 7) | ((uint32_t)samSaaEnvClockExternally[g] << 5) |
                           ((uint32_t)(samSaaEnvResolution[g] == 2u) << 4) | ((uint32_t)samSaaEnvShape[g] << 1) |
                           samSaaEnvInvertRight[g];
  const uint32_t position = (uint32_t)samSaaEnvPhase[g] * 16u + samSaaEnvPhasePosition[g];
  return control | (position << 8) | ((uint32_t)samSaaEnvEnded[g] << 16) | ((uint32_t)samSaaEnvNewData[g] << 17) |
         ((uint32_t)samSaaEnvLeft[g] << 24);
}
/* A side's level now, in SAASound's units (0-2880) */
uint32_t samSaaGetLevel(uint32_t side) { return (uint32_t)samSaaLevel[side & 1u]; }
uint32_t samSaaGetOctave(uint32_t ch) { return ch < 6u ? samSaaOctave[ch] : 0u; }
uint32_t samSaaGetOffset(uint32_t ch) { return ch < 6u ? samSaaOffset[ch] : 0u; }
