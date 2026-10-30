/*
 * DAVE's sound output (plan §8.2-§8.3). Phase 1 keeps the sample stream only: the host gets a stereo
 * sample for every interval of its rate, silent until Phase 4 adds the tone and noise generator. The
 * per-tick hooks are where that generator goes.
 *
 * Sample times count in half-T units from the frame's start; `epAudioEndFrame` moves them back by the
 * frame's length.
 */

#define EP_AUDIO_SAMPLE_CAPACITY 2048u

static double epAudioSamples[EP_AUDIO_SAMPLE_CAPACITY * 2u];
static uint32_t epAudioSampleCount;
static uint32_t epAudioSampleRate;
static uint32_t epAudioOverflows;
/* The sample length and the next sample's time, in half-T units from the frame's start */
static double epAudioSampleLength;
static double epAudioNextSample;

/* A tone channel's counter reloaded (ep-dave.c) */
static void epAudioToneReload(uint32_t channel) { (void)channel; }

/* One DAVE tick (ep-dave.c) */
static void epAudioTick(void) {}

static inline double epAudioNow(void) { return (double)(int32_t)(epHalfClock - epFrameStartHalf); }

static void EP_NOINLINE epAudioEmitSample(void) {
  if (epAudioSampleCount < EP_AUDIO_SAMPLE_CAPACITY) {
    epAudioSamples[epAudioSampleCount * 2u] = 0.0;
    epAudioSamples[epAudioSampleCount * 2u + 1u] = 0.0;
    epAudioSampleCount++;
  } else {
    epAudioOverflows++;
  }
  epAudioNextSample += epAudioSampleLength;
}

/* Every clock step: the samples whose time has come */
static inline void epAudioAdvance(void) {
  if (epAudioSampleLength <= 0.0) return;
  const double now = epAudioNow();
  while (now >= epAudioNextSample) epAudioEmitSample();
}

/* The frame ends at `newStart`: every point moves back by the frame */
static void epAudioEndFrame(uint32_t newStart) {
  const double length = (double)(int32_t)(newStart - epFrameStartHalf);
  epAudioNextSample -= length;
}

static void epAudioNewFrame(void) { epAudioSampleCount = 0u; }

static void epAudioReset(void) {
  epAudioSampleCount = 0u;
  epAudioNextSample = epAudioSampleLength;
}

/* The host's sample rate (0 stops the samples) and the DC filter's coefficient (unused until Phase 4) */
void epSetAudioSampleRate(uint32_t rate, double dcAlpha) {
  (void)dcAlpha;
  epAudioSampleRate = rate;
  epAudioSampleLength = rate ? 2.0 * (double)EP_CLOCK / (double)rate : 0.0;
  epAudioNextSample = epAudioNow() + epAudioSampleLength;
}

uint32_t epAudioSamplesPtr(void) { return (uint32_t)(uintptr_t)epAudioSamples; }
uint32_t epGetAudioSampleCapacity(void) { return EP_AUDIO_SAMPLE_CAPACITY; }
uint32_t epGetAudioSampleCount(void) { return epAudioSampleCount; }
uint32_t epGetAudioSampleRate(void) { return epAudioSampleRate; }
uint32_t epGetAudioOverflows(void) { return epAudioOverflows; }
