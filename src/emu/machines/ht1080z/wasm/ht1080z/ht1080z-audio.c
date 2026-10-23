/*
 * The HT-1080Z's sound (`.plans/HT1080Z_PLAN.md` §10; `_input/ht1080z/SOUND_AY.md`): one speaker
 * fed by the port-FF beeper and the AY-3-8910, sampled at the host's audio rate.
 *
 * - The beeper: port FF bits 0-1 drive the three-level cassette output, which also drives the
 *   speaker - 01 high, 10 low, 00 and 11 the middle - except while bit 2 (the recorder relay) is
 *   on, which mutes it (HARDWARE.md §4.2, §6.1). Its level is averaged over each sample.
 * - The AY: the Spectrum's PSG (`zx-spectrum-psg.c`, shared - §5), clocked at the CPU clock: its
 *   prescaler steps every 8 T (`SP128_PSG_CLOCK_STEP`), where the Spectrum's AY at half the CPU
 *   clock steps every 16. Its three channels are tied together on the board: a mono sum.
 * - The mix: beeper and AY into one channel, copied to both sides of the stereo buffer, then a DC
 *   high-pass (its coefficient from the host - `exp` is not available here) and a clamp to [-1, 1],
 *   as the Z88's beeper does (`z88-beeper.c`).
 *
 * Time: the PSG and the sample schedule count in the frame's tacts (`htFrameTacts`), not the CPU's
 * 32-bit counter, so nothing wraps. At the end of a frame every absolute point here is moved back by
 * the frame's length (`htAudioEndFrame`). A new absolute point must be added there.
 *
 * Reset: the beeper and the sample schedule at every reset; the AY only at power-on - the RESET key
 * is an NMI and, as far as SOUND_AY.md §6 can tell, does not reach the AY (unverified).
 */

#define HT_AUDIO_SAMPLE_CAPACITY 2048u
/* The AY's input clock is the CPU clock and its prescaler divides by 8 */
#define SP128_PSG_CLOCK_STEP 8u
/* Each channel's level is 0-1; three tied channels at full volume make 0.75 */
#define SP128_PSG_ROUTE_GAIN 0.25
/* The beeper's swing against the AY's: a full-volume square wave either way */
#define HT_BEEPER_GAIN 0.5
#define HT_AUDIO_EPSILON 1.0e-7

#define sp128Tacts htFrameTacts
#include "../../../zxSpectrum/wasm/common/zx-spectrum-psg.c"
#undef sp128Tacts

static double htAudioSamples[HT_AUDIO_SAMPLE_CAPACITY * 2u];
static uint32_t htAudioSampleCount;
static uint32_t htAudioSampleRate;
static uint32_t htAudioOverflows;
/* The sample length in CPU tacts (at the current clock multiplier), and the next sample's tact */
static double htAudioSampleLength;
static double htAudioNextSampleTact;
static double htDcAlpha;
static double htDcPrevInput;
static double htDcPrevOutput;

/* The beeper: its level now (-1, 0, 1), and its level integrated since the last sample */
static double htBeeperLevel;
static double htBeeperAccumulated;
static double htBeeperAccumulatedTacts;
static double htBeeperLastTact;

/* Integrates the beeper's level up to `tact` (a frame tact) */
static void htBeeperAccumulateUntil(double tact) {
  if (tact <= htBeeperLastTact) return;
  const double duration = tact - htBeeperLastTact;
  htBeeperAccumulated += htBeeperLevel * duration;
  htBeeperAccumulatedTacts += duration;
  htBeeperLastTact = tact;
}

/* A write to port FF changes the speaker level from this tact on */
static void htBeeperPortWrite(uint8_t value) {
  htBeeperAccumulateUntil((double)htFrameTacts);
  if (value & 0x04u) {
    htBeeperLevel = 0.0;
  } else {
    const uint8_t bits = value & 0x03u;
    htBeeperLevel = bits == 0x01u ? 1.0 : bits == 0x02u ? -1.0 : 0.0;
  }
}

/* One sample at `htAudioNextSampleTact`: the beeper's average, the AY's average, mixed and filtered */
static void HT_NOINLINE htAudioEmitSample(void) {
  const double at = htAudioNextSampleTact;
  htBeeperAccumulateUntil(at);
  double beeper = htBeeperLevel;
  if (htBeeperAccumulatedTacts > 0.0) beeper = htBeeperAccumulated / htBeeperAccumulatedTacts;
  htBeeperAccumulated = 0.0;
  htBeeperAccumulatedTacts = 0.0;
  sp128PsgPrepareAudioSample(at);
  const double raw = beeper * HT_BEEPER_GAIN + sp128PsgAudioLevel();
  double out = raw - htDcPrevInput + htDcAlpha * htDcPrevOutput;
  htDcPrevInput = raw;
  htDcPrevOutput = out;
  if (out > 1.0) out = 1.0;
  if (out < -1.0) out = -1.0;
  if (htAudioSampleCount < HT_AUDIO_SAMPLE_CAPACITY) {
    htAudioSamples[htAudioSampleCount * 2u] = out;
    htAudioSamples[htAudioSampleCount * 2u + 1u] = out;
    htAudioSampleCount++;
  } else {
    htAudioOverflows++;
  }
  htAudioNextSampleTact += htAudioSampleLength;
}

/* Every clock step: the samples whose point the frame has reached */
static inline void htAudioAdvance(void) {
  while (htAudioSampleLength > 0.0 && (double)htFrameTacts + HT_AUDIO_EPSILON >= htAudioNextSampleTact) {
    htAudioEmitSample();
  }
}

/*
 * The end of a frame (`htFrameTacts` is about to drop by `frameLength`): the AY and the beeper are
 * brought up to the frame's end, then every absolute point moves back by the frame's length
 */
static void htAudioEndFrame(uint32_t frameLength) {
  const double length = (double)frameLength;
  sp128PsgAdvanceToTact(length);
  htBeeperAccumulateUntil(length);
  sp128PsgNextClockTact -= frameLength;
  sp128PsgLastAccumulationTact -= length;
  htBeeperLastTact -= length;
  htAudioNextSampleTact -= length;
}

/*
 * A new frame's samples start at the front of the buffer. A clock multiplier set for this frame
 * changes how many CPU tacts a sample lasts: the samples keep their real-time rate.
 */
static void htAudioNewFrame(void) {
  htAudioSampleCount = 0u;
  if (htAudioSampleRate) {
    htAudioSampleLength = (double)htClockFrequency * (double)htClockMultiplier / (double)htAudioSampleRate;
  }
}

static void htAudioReset(void) {
  htAudioSampleCount = 0u;
  htAudioNextSampleTact = (double)htFrameTacts + htAudioSampleLength;
  htDcPrevInput = 0.0;
  htDcPrevOutput = 0.0;
  htBeeperLevel = 0.0;
  htBeeperAccumulated = 0.0;
  htBeeperAccumulatedTacts = 0.0;
  htBeeperLastTact = (double)htFrameTacts;
}

/* The AY's ports: OUT 1Fh latches the register, OUT 1Eh writes it, IN 1Fh reads it (SOUND_AY.md §2) */
static void htAyAddressWrite(uint8_t value) { sp128PsgAddressWrite(value); }
static void htAyDataWrite(uint8_t value) { sp128PsgDataWrite(value); }

/*
 * IN 1Fh. I/O ports A and B (R14, R15) read their pins: FFh while a port is an input (R7 bits 6
 * and 7 clear), since nothing is attached to the user port; an output reads back what was written.
 */
static uint8_t htAyDataRead(void) {
  if (sp128PsgActive) {
    const uint8_t index = sp128PsgRegisterIndex & 0x0fu;
    if (index == 14u && !(sp128PsgRegisters[7] & 0x40u)) return 0xffu;
    if (index == 15u && !(sp128PsgRegisters[7] & 0x80u)) return 0xffu;
  }
  return (uint8_t)sp128PsgDataRead();
}

/*
 * The host's sample rate and the DC filter's coefficient (`exp(-2 * pi * 1.4 / rate)`); 0 stops the
 * samples. The first sample is one sample length from now.
 */
void ht1080zSetAudioSampleRate(uint32_t rate, double dcAlpha) {
  htAudioSampleRate = rate;
  htAudioSampleLength = rate ? (double)htClockFrequency * (double)htClockMultiplier / (double)rate : 0.0;
  htAudioNextSampleTact = (double)htFrameTacts + htAudioSampleLength;
  htDcAlpha = rate ? dcAlpha : 0.0;
}

uint32_t ht1080zAudioSamplesPtr(void) { return (uint32_t)(uintptr_t)htAudioSamples; }
uint32_t ht1080zGetAudioSampleCapacity(void) { return HT_AUDIO_SAMPLE_CAPACITY; }
uint32_t ht1080zGetAudioSampleCount(void) { return htAudioSampleCount; }
uint32_t ht1080zGetAudioSampleRate(void) { return htAudioSampleRate; }
uint32_t ht1080zGetAudioOverflows(void) { return htAudioOverflows; }
/* The beeper's level now: -1, 0 or 1, times 100 (an integer for the export) */
int32_t ht1080zGetBeeperLevel(void) { return (int32_t)(htBeeperLevel * 100.0); }

/* --- The AY, under the names the PSG panel's adapter reads (`WasmSpectrumPsgDevice`) */
uint32_t ht1080zGetPsgRegisterIndex(void) { return sp128PsgRegisterIndex; }
uint32_t ht1080zGetPsgRegisterValue(uint32_t index) { return sp128PsgGetRegisterValue(index); }
uint32_t ht1080zReadPsgRegisterValue(void) { return htAyDataRead(); }
uint32_t ht1080zGetPsgToneA(void) { return sp128PsgGetToneA(); }
uint32_t ht1080zGetPsgToneB(void) { return sp128PsgTone[1].period; }
uint32_t ht1080zGetPsgToneC(void) { return sp128PsgTone[2].period; }
uint32_t ht1080zGetPsgVolumeA(void) { return sp128PsgGetVolumeA(); }
uint32_t ht1080zGetPsgVolumeB(void) { return sp128PsgTone[1].volume & 0x0fu; }
uint32_t ht1080zGetPsgVolumeC(void) { return sp128PsgTone[2].volume & 0x0fu; }
uint32_t ht1080zGetPsgCurrentOutput(void) { return (uint32_t)sp128PsgCurrentOutput; }
