/*
 * The Philips SAA 1099 (plan §8.1, D8; SOUND_INPUT_IO.md §1). Klive's own model, written from the
 * research pack's facts; where SAASound (the model checked against real chips) and MAME disagree, the
 * pack's record of SAASound's behaviour is the default:
 *
 *   - six square-wave tone generators: a half period of `(511 - N) << (8 - octave)` master clocks (8 MHz),
 *     f = 15 625 * 2^octave / (511 - N) Hz. New octave and offset values are buffered to the end of the
 *     current half cycle; written octave-first, only the octave lands there and the offset one half cycle
 *     later (SAASound's Philips-documented behaviour). While sync (1Ch bit 1) is set the generators stop
 *     at level 1 with their latches loaded and writes act at once;
 *   - two noise generators, each an 18-bit Galois LFSR (taps 0x20400, seeded all ones, output bit 0)
 *     shifted at 31.25 / 15.625 / 7.8125 kHz or on each half-cycle toggle of tone 0 (noise 0) or tone 3
 *     (noise 1);
 *   - two envelope generators (18h, 19h) acting on channels 2 and 5 only: eight shapes, 4- or 3-bit
 *     resolution, clocked by each half-cycle toggle of tone 1 / tone 4 or by an address write of 18h/19h,
 *     the right side optionally mirrored. A new control byte acts at once if the envelope has ended or not
 *     started; otherwise it waits for the end of the current shape (the enable and resolution bits act at
 *     once);
 *   - the mixer: tone alone, noise alone, or both (tone high and noise low: full; both high: half; tone
 *     low: 0). Without an envelope a side is `amplitude * level`; with one, `(amplitude & 0Eh) * envelope
 *     / 16 * (2 - level) / 2` (the envelope gated by the inverse of the tone/noise level, SAASound's rule).
 *     SAASound's pulse-density table for enveloped amplitudes is not reproduced (not in the pack).
 *   - 1Ch bit 0 = 0 mutes every output; the generators keep running.
 *
 * Time: `samSaaNow` counts 24 MHz units from the frame's start (a T-state is 4, a master clock 3). The SAA
 * runs in catch-up (`samSaaRunUntil`): events (tone toggles, noise shifts) in time order, each changing
 * the output level the audio integrator (sam-audio.c) sees.
 */

#define SAM_SAA_UNITS_PER_T 4u
#define SAM_SAA_UNITS_PER_CLOCK 3u

static uint8_t samSaaRegs[32];
static uint8_t samSaaAddress;

/* Tone generators */
static uint8_t samSaaToneLevel[6];
static uint8_t samSaaOctave[6];
static uint8_t samSaaOffset[6];
static uint8_t samSaaPendingOctave[6];
static uint8_t samSaaPendingOffset[6];
/* Bit 0: an octave is pending, bit 1: an offset is pending, bit 2: the offset was written first */
static uint8_t samSaaPending[6];
static double samSaaToneNext[6];

/* Noise generators */
static uint32_t samSaaLfsr[2];
static double samSaaNoiseNext[2];

/* Envelope generators */
static uint8_t samSaaEnvControl[2];
static uint8_t samSaaEnvPendingControl[2];
static uint8_t samSaaEnvHasPending[2];
static uint8_t samSaaEnvPos[2];
static uint8_t samSaaEnvEnded[2];
static uint8_t samSaaEnvStarted[2];

/* The time the generators have reached, 24 MHz units from the frame's start */
static double samSaaNow;

/* Per side, the current output level (0-90: six channels at amplitude 15) */
static double samSaaLevel[2];

static inline double samSaaHalfPeriod(uint32_t ch) {
  return (double)(((511u - samSaaOffset[ch]) << (8u - samSaaOctave[ch])) * SAM_SAA_UNITS_PER_CLOCK);
}

static inline uint8_t samSaaSynced(void) { return (samSaaRegs[0x1c] & 0x02u) != 0u; }

static inline double samSaaNoisePeriod(uint32_t gen) {
  const uint32_t source = (samSaaRegs[0x16] >> (gen * 4u)) & 3u;
  return (double)((256u << source) * SAM_SAA_UNITS_PER_CLOCK);
}

static inline uint8_t samSaaNoiseSource(uint32_t gen) { return (uint8_t)((samSaaRegs[0x16] >> (gen * 4u)) & 3u); }

// -----------------------------------------------------------------------------
// Envelopes
// -----------------------------------------------------------------------------

/* The phases of a shape (16 steps each), and whether it loops */
static const uint8_t samSaaEnvPhases[8] = {1u, 1u, 1u, 1u, 2u, 2u, 1u, 1u};
static const uint8_t samSaaEnvLoops[8] = {0u, 1u, 0u, 1u, 0u, 1u, 0u, 1u};

static inline uint8_t samSaaEnvShape(uint32_t g) { return (uint8_t)((samSaaEnvControl[g] >> 1) & 7u); }
static inline uint8_t samSaaEnv3Bit(uint32_t g) { return (samSaaEnvControl[g] & 0x10u) != 0u; }

/* The left level (0-15) of envelope `g` now */
static uint8_t samSaaEnvLevel(uint32_t g) {
  const uint8_t shape = samSaaEnvShape(g);
  const uint8_t pos = samSaaEnvPos[g];
  uint8_t level;
  if (samSaaEnvEnded[g]) {
    level = shape == 1u ? 15u : 0u;
  } else {
    switch (shape) {
      case 0u:
        level = 0u;
        break;
      case 1u:
        level = 15u;
        break;
      case 2u:
      case 3u:
        level = (uint8_t)(15u - pos);
        break;
      case 4u:
      case 5u:
        level = pos < 16u ? pos : (uint8_t)(31u - pos);
        break;
      default:
        level = pos;
        break;
    }
  }
  return samSaaEnv3Bit(g) ? (uint8_t)(level & 0x0eu) : level;
}

static inline uint8_t samSaaEnvRight(uint32_t g, uint8_t left) {
  if (!(samSaaEnvControl[g] & 0x01u)) return left;
  return samSaaEnv3Bit(g) ? (uint8_t)(14u - left) : (uint8_t)(15u - left);
}

static void samSaaEnvApplyControl(uint32_t g, uint8_t value) {
  samSaaEnvControl[g] = value;
  samSaaEnvPos[g] = 0u;
  samSaaEnvEnded[g] = 0u;
  samSaaEnvStarted[g] = 0u;
}

/* One step of envelope `g` */
static void samSaaEnvClock(uint32_t g) {
  if (!(samSaaEnvControl[g] & 0x80u) || samSaaEnvEnded[g]) return;
  samSaaEnvStarted[g] = 1u;
  const uint8_t shape = samSaaEnvShape(g);
  const uint8_t length = (uint8_t)(samSaaEnvPhases[shape] * 16u);
  uint8_t pos = (uint8_t)(samSaaEnvPos[g] + (samSaaEnv3Bit(g) ? 2u : 1u));
  if (pos >= length) {
    // --- The end of the shape: a buffered control byte lands here
    if (samSaaEnvHasPending[g]) {
      samSaaEnvHasPending[g] = 0u;
      samSaaEnvApplyControl(g, samSaaEnvPendingControl[g]);
      return;
    }
    if (samSaaEnvLoops[shape]) {
      pos = 0u;
    } else {
      samSaaEnvEnded[g] = 1u;
      pos = 0u;
    }
  }
  samSaaEnvPos[g] = pos;
}

static void samSaaEnvWrite(uint32_t g, uint8_t value) {
  // --- Acted on at once if the envelope ended or has not started; otherwise at the end of the shape
  if (!samSaaEnvStarted[g] || samSaaEnvEnded[g] || !(samSaaEnvControl[g] & 0x80u)) {
    samSaaEnvHasPending[g] = 0u;
    samSaaEnvApplyControl(g, value);
    return;
  }
  // --- The enable and resolution bits act at once
  const uint8_t was3 = samSaaEnv3Bit(g);
  samSaaEnvControl[g] = (uint8_t)((samSaaEnvControl[g] & ~0x90u) | (value & 0x90u));
  if (!was3 && samSaaEnv3Bit(g)) samSaaEnvPos[g] &= (uint8_t)~1u;
  if (was3 && !samSaaEnv3Bit(g)) samSaaEnvPos[g] |= 1u;
  if (!(value & 0x80u)) {
    samSaaEnvApplyControl(g, value);
    return;
  }
  samSaaEnvPendingControl[g] = value;
  samSaaEnvHasPending[g] = 1u;
}

// -----------------------------------------------------------------------------
// Output
// -----------------------------------------------------------------------------

/* A channel's level in halves: 0, 1 (half) or 2 (full) */
static inline uint32_t samSaaChannelHalves(uint32_t ch) {
  const uint8_t te = (samSaaRegs[0x14] >> ch) & 1u;
  const uint8_t ne = (samSaaRegs[0x15] >> ch) & 1u;
  const uint8_t tone = samSaaToneLevel[ch];
  const uint8_t noise = (uint8_t)(samSaaLfsr[ch / 3u] & 1u);
  if (te && !ne) return tone ? 2u : 0u;
  if (!te && ne) return noise ? 2u : 0u;
  if (te && ne) return tone ? (noise ? 1u : 2u) : 0u;
  return 0u;
}

/* The two sides' levels from the registers and generators as they are now */
static void samSaaUpdateLevel(void) {
  samSaaLevel[0] = 0.0;
  samSaaLevel[1] = 0.0;
  if (!(samSaaRegs[0x1c] & 0x01u) || samSaaSynced()) return;
  for (uint32_t ch = 0u; ch < 6u; ch++) {
    const uint8_t amp = samSaaRegs[ch];
    const uint32_t halves = samSaaChannelHalves(ch);
    const uint32_t g = ch / 3u;
    if ((ch == 2u || ch == 5u) && (samSaaEnvControl[g] & 0x80u)) {
      const uint8_t left = samSaaEnvLevel(g);
      const uint8_t right = samSaaEnvRight(g, left);
      const double gate = (double)(2u - halves) / 2.0;
      samSaaLevel[0] += (double)((amp & 0x0eu) * left) / 16.0 * gate;
      samSaaLevel[1] += (double)(((amp >> 4) & 0x0eu) * right) / 16.0 * gate;
    } else {
      samSaaLevel[0] += (double)((amp & 0x0fu) * halves) / 2.0;
      samSaaLevel[1] += (double)(((amp >> 4) & 0x0fu) * halves) / 2.0;
    }
  }
}

// -----------------------------------------------------------------------------
// Generators
// -----------------------------------------------------------------------------

static inline void samSaaNoiseShift(uint32_t gen) {
  samSaaLfsr[gen] = (samSaaLfsr[gen] & 1u) ? (samSaaLfsr[gen] >> 1) ^ 0x20400u : samSaaLfsr[gen] >> 1;
}

/* Tone `ch`'s half cycle ends: the toggle, the buffered values, and what it clocks */
static void samSaaToneToggle(uint32_t ch) {
  samSaaToneLevel[ch] ^= 1u;
  const uint8_t p = samSaaPending[ch];
  if (p & 0x01u) {
    samSaaOctave[ch] = samSaaPendingOctave[ch];
    if ((p & 0x02u) && (p & 0x04u)) {
      samSaaOffset[ch] = samSaaPendingOffset[ch];
      samSaaPending[ch] = 0u;
    } else {
      // --- Octave first: the offset waits one more half cycle
      samSaaPending[ch] = (uint8_t)(p & 0x02u ? 0x06u : 0u);
    }
  } else if (p & 0x02u) {
    samSaaOffset[ch] = samSaaPendingOffset[ch];
    samSaaPending[ch] = 0u;
  }
  if (ch == 0u && samSaaNoiseSource(0u) == 3u) samSaaNoiseShift(0u);
  if (ch == 3u && samSaaNoiseSource(1u) == 3u) samSaaNoiseShift(1u);
  if (ch == 1u && !(samSaaEnvControl[0] & 0x20u)) samSaaEnvClock(0u);
  if (ch == 4u && !(samSaaEnvControl[1] & 0x20u)) samSaaEnvClock(1u);
  samSaaToneNext[ch] += samSaaHalfPeriod(ch);
}

/* Defined in sam-audio.c: the integrator takes the level up to `point` */
static void samAudioIntegrateUntil(double point);

/* Runs the generators up to `until` (24 MHz units from the frame's start) */
static void samSaaRunUntil(double until) {
  if (samSaaSynced()) {
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
      if (samSaaNoiseSource(gen) != 3u && samSaaNoiseNext[gen] < next) {
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

/* Restarts every generator in phase at `samSaaNow` (sync released, power on) */
static void samSaaRestart(void) {
  for (uint32_t ch = 0u; ch < 6u; ch++) samSaaToneNext[ch] = samSaaNow + samSaaHalfPeriod(ch);
  for (uint32_t gen = 0u; gen < 2u; gen++) samSaaNoiseNext[gen] = samSaaNow + samSaaNoisePeriod(gen);
}

static void samSaaWriteData(uint8_t value) {
  const uint8_t reg = samSaaAddress;
  const uint8_t wasSynced = samSaaSynced();
  samSaaRegs[reg] = value;
  if (reg >= 0x08u && reg <= 0x0du) {
    const uint32_t ch = reg - 0x08u;
    if (wasSynced) {
      samSaaOffset[ch] = value;
    } else {
      samSaaPendingOffset[ch] = value;
      samSaaPending[ch] |= (uint8_t)((samSaaPending[ch] & 0x01u) ? 0x02u : 0x06u);
    }
  } else if (reg >= 0x10u && reg <= 0x12u) {
    for (uint32_t k = 0u; k < 2u; k++) {
      const uint32_t ch = (reg - 0x10u) * 2u + k;
      const uint8_t octave = (uint8_t)((value >> (k * 4u)) & 7u);
      if (wasSynced) {
        samSaaOctave[ch] = octave;
      } else {
        samSaaPendingOctave[ch] = octave;
        samSaaPending[ch] |= 0x01u;
      }
    }
  } else if (reg == 0x16u) {
    for (uint32_t gen = 0u; gen < 2u; gen++) {
      if (samSaaNoiseNext[gen] <= samSaaNow) samSaaNoiseNext[gen] = samSaaNow + samSaaNoisePeriod(gen);
    }
  } else if (reg == 0x18u || reg == 0x19u) {
    samSaaEnvWrite(reg - 0x18u, value);
  } else if (reg == 0x1cu) {
    if (value & 0x02u) {
      // --- Sync: the generators stop at level 1, counters cleared, latches loaded
      for (uint32_t ch = 0u; ch < 6u; ch++) {
        samSaaToneLevel[ch] = 1u;
        if (samSaaPending[ch] & 0x01u) samSaaOctave[ch] = samSaaPendingOctave[ch];
        if (samSaaPending[ch] & 0x02u) samSaaOffset[ch] = samSaaPendingOffset[ch];
        samSaaPending[ch] = 0u;
      }
    } else if (wasSynced) {
      samSaaRestart();
    }
  }
  samSaaUpdateLevel();
}

static void samSaaWriteAddress(uint8_t value) {
  samSaaAddress = (uint8_t)(value & 0x1fu);
  // --- An address write of 18h/19h is the external envelope clock
  if (samSaaAddress == 0x18u && (samSaaEnvControl[0] & 0x20u)) samSaaEnvClock(0u);
  if (samSaaAddress == 0x19u && (samSaaEnvControl[1] & 0x20u)) samSaaEnvClock(1u);
  samSaaUpdateLevel();
}

/* The frame ends `length` units after its start: every time moves back by it */
static void samSaaEndFrame(double length) {
  samSaaNow -= length;
  for (uint32_t ch = 0u; ch < 6u; ch++) samSaaToneNext[ch] -= length;
  for (uint32_t gen = 0u; gen < 2u; gen++) samSaaNoiseNext[gen] -= length;
}

/* Power on (the reset button does not reset the SAA, SOUND §1.1): SAASound's clear */
static void samSaaPowerOn(void) {
  for (uint32_t i = 0u; i < 32u; i++) samSaaRegs[i] = 0u;
  samSaaAddress = 0u;
  for (uint32_t ch = 0u; ch < 6u; ch++) {
    samSaaToneLevel[ch] = 1u;
    samSaaOctave[ch] = 0u;
    samSaaOffset[ch] = 0u;
    samSaaPending[ch] = 0u;
  }
  samSaaLfsr[0] = 0xffffffffu;
  samSaaLfsr[1] = 0xffffffffu;
  for (uint32_t g = 0u; g < 2u; g++) {
    samSaaEnvControl[g] = 0u;
    samSaaEnvHasPending[g] = 0u;
    samSaaEnvPos[g] = 0u;
    samSaaEnvEnded[g] = 0u;
    samSaaEnvStarted[g] = 0u;
  }
  samSaaNow = 0.0;
  samSaaRestart();
  samSaaUpdateLevel();
}

uint32_t samSaaGetRegister(uint32_t reg) { return samSaaRegs[reg & 31u]; }
uint32_t samSaaGetAddress(void) { return samSaaAddress; }
/* Bits 0-5: the tone generators' levels; bits 8-9: the noise generators' outputs */
uint32_t samSaaGetOutputs(void) {
  uint32_t v = 0u;
  for (uint32_t ch = 0u; ch < 6u; ch++) v |= (uint32_t)samSaaToneLevel[ch] << ch;
  v |= (samSaaLfsr[0] & 1u) << 8;
  v |= (samSaaLfsr[1] & 1u) << 9;
  return v;
}
uint32_t samSaaGetLfsr(uint32_t gen) { return samSaaLfsr[gen & 1u]; }
/* An envelope's state: bits 0-7 the control byte, 8-15 the position, 16 ended, 17 started, 24-27 the left level */
uint32_t samSaaGetEnvelope(uint32_t g) {
  g &= 1u;
  return samSaaEnvControl[g] | ((uint32_t)samSaaEnvPos[g] << 8) | ((uint32_t)samSaaEnvEnded[g] << 16) |
         ((uint32_t)samSaaEnvStarted[g] << 17) | ((uint32_t)samSaaEnvLevel(g) << 24);
}
/* A side's level now, x 1000 (0-90 000) */
uint32_t samSaaGetLevel(uint32_t side) { return (uint32_t)(samSaaLevel[side & 1u] * 1000.0); }
uint32_t samSaaGetOctave(uint32_t ch) { return ch < 6u ? samSaaOctave[ch] : 0u; }
uint32_t samSaaGetOffset(uint32_t ch) { return ch < 6u ? samSaaOffset[ch] : 0u; }
