/*
 * Cambridge Z88 - the beeper: the speaker level, sampled at the audio rate and DC-filtered.
 *
 * A port of `Z88BeeperDevice` on `AudioDeviceBase` (Step 9 of
 * `.plans/CAMBRIDGE_Z88_WASM_MIGRATION_PLAN.md`). With COM.SRUN set the speaker plays the Blink's
 * 3200 Hz oscillator (silenced by COM.SBIT); with SRUN clear, the ear bit (COM.SBIT) drives it.
 *
 * The arithmetic is the TypeScript device's, in doubles, so the samples are the same numbers: one
 * sample at most per CPU clock step (`setNextAudioSample` runs once per `tactPlusN`), when the tact
 * count reaches the next sample point; the DC high-pass filter `y = x - x' + alpha * y'` (alpha is
 * computed by the host - `exp` is not available here); the output clamped to [-1, 1]. The oscillator
 * bit a sample uses is the one computed after the previous instruction, as on the TypeScript machine.
 *
 * Not kept: without a sample rate the TypeScript device emits a sample at every clock step (its
 * sample length is 0); here it emits none. The app always sets a rate.
 */

#define Z88_SAMPLE_TACT_EPSILON 1.0e-7
/* The CPU's tact counter is 32 bits: it wraps after 2^32 tacts, about 22 minutes at 1x */
#define Z88_TACT_WRAP 4294967296.0
#define Z88_TACT_HALF_WRAP 2147483648.0

static double z88AudioSamples[Z88_AUDIO_SAMPLE_CAPACITY * 2u];
static uint32_t z88AudioSampleCount;
static uint32_t z88AudioSampleRate;
static uint32_t z88AudioOverflows;
static double z88AudioSampleLength;
static double z88AudioNextSampleTact;
static double z88DcAlpha;
static double z88DcPrevInput;
static double z88DcPrevOutput;

/* The oscillator bit, computed after each instruction; a reset keeps it (the TypeScript one does) */
static uint8_t z88OscillatorBit;

/* `AudioDeviceBase.reset`: the schedule and the filter start over; the rate is set again by the host */
static void z88BeeperReset(void) {
  z88AudioSampleLength = 0.0;
  z88AudioNextSampleTact = 0.0;
  z88AudioSampleCount = 0u;
  z88DcPrevInput = 0.0;
  z88DcPrevOutput = 0.0;
}

/* The beeper's new frame (`onNewFrame`): this frame's samples start */
static void z88BeeperNewFrame(void) {
  z88AudioSampleCount = 0u;
}

/* `calculateOscillatorBit`: after each instruction */
static void z88CalculateOscillatorBit(void) {
  const uint32_t period = (Z88_BASE_CLOCK_FREQUENCY * z88ClockMultiplier) / 6400u;
  z88OscillatorBit = (uint8_t)((cpu.tacts / period) & 0x01u);
}

/*
 * `setNextAudioSample`: at most one sample per clock step, when the next sample point is reached.
 *
 * The next sample point is kept in the counter's own range, [0, 2^32), and compared by the signed
 * distance to it, so the schedule survives `cpu.tacts` wrapping. Comparing the raw values stopped
 * the samples for good after about 22 minutes: the wrapped counter never caught up with a point
 * past 2^32 again (issue #1374). The TypeScript device counted tacts in a JS number and never wrapped.
 */
static void z88SetNextAudioSample(void) {
  if (z88AudioSampleLength <= 0.0) return;
  double ahead = z88AudioNextSampleTact - (double)cpu.tacts;
  if (ahead >= Z88_TACT_HALF_WRAP) {
    ahead -= Z88_TACT_WRAP;
  } else if (ahead < -Z88_TACT_HALF_WRAP) {
    ahead += Z88_TACT_WRAP;
  }
  if (ahead > Z88_SAMPLE_TACT_EPSILON) return;

  const double raw = (z88Com & Z88_COM_SRUN) ? ((z88Com & Z88_COM_SBIT) ? 0.0 : (z88OscillatorBit ? 1.0 : 0.0))
                                             : (z88EarBit ? 1.0 : 0.0);
  double out = raw - z88DcPrevInput + z88DcAlpha * z88DcPrevOutput;
  z88DcPrevInput = raw;
  z88DcPrevOutput = out;
  if (out > 1.0) out = 1.0;
  if (out < -1.0) out = -1.0;

  if (z88AudioSampleCount < Z88_AUDIO_SAMPLE_CAPACITY) {
    z88AudioSamples[z88AudioSampleCount * 2u] = out;
    z88AudioSamples[z88AudioSampleCount * 2u + 1u] = out;
    z88AudioSampleCount++;
  } else {
    z88AudioOverflows++;
  }
  z88AudioNextSampleTact += z88AudioSampleLength * (double)z88ClockMultiplier;
  if (z88AudioNextSampleTact >= Z88_TACT_WRAP) {
    z88AudioNextSampleTact -= Z88_TACT_WRAP;
  }
}

/*
 * `setAudioSampleRate`: the sample length in tacts and the DC filter's alpha
 * (`exp(-2 * pi * 1.4 / rate)`, computed by the host). A rate of 0 stops the samples.
 *
 * The first sample point is one sample length after the current tact. The host sets the rate at
 * reset, where that is the TypeScript device's point (the counter is 0); counting from 0 anywhere
 * else would put the point up to half the counter's range behind it.
 */
void z88SetAudioSampleRate(uint32_t rate, double dcAlpha) {
  z88AudioSampleRate = rate;
  z88AudioSampleLength = rate ? (double)Z88_BASE_CLOCK_FREQUENCY / (double)rate : 0.0;
  z88AudioNextSampleTact = (double)cpu.tacts + z88AudioSampleLength * (double)z88ClockMultiplier;
  if (z88AudioNextSampleTact >= Z88_TACT_WRAP) {
    z88AudioNextSampleTact -= Z88_TACT_WRAP;
  }
  z88DcAlpha = rate ? dcAlpha : 0.0;
}

uint32_t z88AudioSamplesPtr(void) { return (uint32_t)(uintptr_t)z88AudioSamples; }
uint32_t z88GetAudioSampleCapacity(void) { return Z88_AUDIO_SAMPLE_CAPACITY; }
uint32_t z88GetAudioSampleCount(void) { return z88AudioSampleCount; }
uint32_t z88GetAudioSampleRate(void) { return z88AudioSampleRate; }
uint32_t z88GetAudioOverflows(void) { return z88AudioOverflows; }
uint32_t z88GetOscillatorBit(void) { return z88OscillatorBit; }
