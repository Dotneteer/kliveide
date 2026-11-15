/*
 * The audio mixer's per-source gains and taps for a core with a handful of sources
 * (`dev/plans/AUDIO_MIXER_PLAN.md` §3.1, phase 3): the Cambridge Z88, the Videoton TVC and the
 * Enterprise. The Spectrum family (and the HT-1080Z, whose AY is the Spectrum's) has its own,
 * `zxSpectrum/wasm/common/zx-spectrum-audio-channels.c`, the Next `zxnext-audio-channels.c`; the rules
 * are the same:
 *
 * - **A gain per source**, applied in a parallel "heard" mix that the host plays: the core's own mix
 *   runs exactly as before, and at unity the heard mix is its words, bit for bit. Gain 0 is mute.
 * - **A tap per source**: each host sample, the source's level before its gain and before the DC
 *   filter, int16 at KLIVE_AUDIO_TAP_SCALE per 1.0 of the core's output, [sample][channel]. Written
 *   only while taps are on.
 * - **The gains and the taps switch change only volatile statics** (each core's build script lists
 *   these and its own heard-mix statics): reverse debugging compares replayed memory with its
 *   keyframes, and the user may change a gain before a Step Back.
 *
 * The core defines KLIVE_AUDIO_CHANNELS (its sources) before including this file.
 */

#ifndef KLIVE_AUDIO_CHANNELS
#error "Define KLIVE_AUDIO_CHANNELS before including audio-channels.c"
#endif

/* The gain tables hold this many */
#define KLIVE_AUDIO_MAX_CHANNELS 8u
#define KLIVE_AUDIO_TAP_CAPACITY 2048u
#define KLIVE_AUDIO_MAX_GAIN_MILLI 4000u
/* A tap word per 1.0 of the core's output (the host divides by the same) */
#define KLIVE_AUDIO_TAP_SCALE 32768.0

_Static_assert(KLIVE_AUDIO_CHANNELS <= KLIVE_AUDIO_MAX_CHANNELS, "Too many audio channels");

/*
 * `used`: each of these stays one whole object under its own name, which the build script's volatile
 * list needs. Without it the compiler reshapes them to fit one core's use - a one-channel core's
 * gain table becomes a scalar, a flag a core never reads disappears - and the name is gone.
 */
#define KLIVE_AUDIO_KEPT __attribute__((used))
static KLIVE_AUDIO_KEPT double kliveAudioChannelGain[KLIVE_AUDIO_MAX_CHANNELS] = { 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0 };
static KLIVE_AUDIO_KEPT uint32_t kliveAudioChannelGainMilli[KLIVE_AUDIO_MAX_CHANNELS] = {
  1000u, 1000u, 1000u, 1000u, 1000u, 1000u, 1000u, 1000u
};
/* Every gain is 1000: the heard mix is the core's own words */
static KLIVE_AUDIO_KEPT uint8_t kliveAudioGainsUnity = 1u;
static KLIVE_AUDIO_KEPT uint8_t kliveAudioTapsEnabled;
static KLIVE_AUDIO_KEPT int16_t kliveAudioTaps[KLIVE_AUDIO_TAP_CAPACITY * KLIVE_AUDIO_CHANNELS];

static void kliveAudioSetChannelGainMilli(uint32_t channel, uint32_t milli) {
  if (channel >= KLIVE_AUDIO_CHANNELS) return;
  if (milli > KLIVE_AUDIO_MAX_GAIN_MILLI) milli = KLIVE_AUDIO_MAX_GAIN_MILLI;
  kliveAudioChannelGainMilli[channel] = milli;
  kliveAudioChannelGain[channel] = (double)milli / 1000.0;
  uint8_t unity = 1u;
  for (uint32_t i = 0u; i < KLIVE_AUDIO_CHANNELS; i++) {
    if (kliveAudioChannelGainMilli[i] != 1000u) unity = 0u;
  }
  kliveAudioGainsUnity = unity;
}

static uint32_t kliveAudioGetChannelGainMilli(uint32_t channel) {
  return channel < KLIVE_AUDIO_CHANNELS ? kliveAudioChannelGainMilli[channel] : 0u;
}

/* One source's level (1.0 = the core's full scale) as a tap word */
static inline int16_t kliveAudioTapWord(double level) {
  const double value = level * KLIVE_AUDIO_TAP_SCALE;
  if (value > 32767.0) return 32767;
  if (value < -32768.0) return -32768;
  return (int16_t)value;
}

/* The tap row of the sample at `index`, or 0 while the taps are off or past the capacity */
static inline int16_t *kliveAudioTapRow(uint32_t index) {
  if (!kliveAudioTapsEnabled || index >= KLIVE_AUDIO_TAP_CAPACITY) return 0;
  return &kliveAudioTaps[index * KLIVE_AUDIO_CHANNELS];
}

/* A clamp to the cores' [-1, 1] output range */
static inline double kliveAudioClamp(double v) {
  if (v > 1.0) return 1.0;
  if (v < -1.0) return -1.0;
  return v;
}

/*
 * Each core writes its five exports out under its prefix (`<prefix>AudioSetChannelGain`,
 * `AudioGetChannelGain`, `AudioSetTapsEnabled`, `AudioTapsPtr`, `GetAudioChannelCount`), calling the
 * functions above: a build test lists every non-static function of a core's sources as its exports,
 * and a macro-made one would hide from it.
 */
static inline void kliveAudioSetTapsEnabled(uint32_t enabled) { kliveAudioTapsEnabled = enabled != 0u ? 1u : 0u; }
