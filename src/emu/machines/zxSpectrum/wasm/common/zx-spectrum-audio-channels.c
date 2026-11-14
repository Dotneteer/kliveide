// ----------------------------------------------------------------------------
// The sound sources of the Spectrum family, one by one (`dev/plans/AUDIO_MIXER_PLAN.md` §3.1)
//
// The audio mixer shows each source's level and spectrum and lets the user mute it or change its
// level. A core already computes every source before it sums them, so it keeps two things per
// source here:
//
// - A gain, applied in a parallel "heard" mix (`zx-spectrum-beeper.c`, `zx-spectrum-psg.c`). The
//   core's own mix runs exactly as before - its DC filter, its accumulators, its sample buffer - and
//   the heard mix beside it applies the gains, through its own DC filter, into `zxAudioHeardSamples`,
//   which is what the host plays (`<core>AudioSamplesPtr`). With every gain at unity the heard mix
//   takes the core's own input, so the output is bit-identical. Gain 0 is mute.
//
//   **The rule: the gains and the taps switch change only volatile statics.** Reverse debugging
//   compares replayed memory against its keyframes (`ReplayDesyncError`), and the user may change a
//   gain between recording and a Step Back; anything a gain could reach in the machine's image would
//   read as a replay that diverged. So the heard mix, its filter and the taps are volatile (each
//   core's build script lists them), and everything the core's own mix keeps stays gain-free.
// - A tap: each host audio sample, every source's level *before* its gain (a pre-fader tap, so a
//   muted channel's meter still moves) and before the mix's DC filter. Int16 at the mix's scale,
//   laid out [sample][channel]. Written only while taps are on: a closed mixer costs one branch per
//   sample.
//
// Both are host settings, not machine state: a state file, checkpoint or keyframe neither saves nor
// restores them.
//
// The channel layout is fixed for the family; a machine without an AY (the 48K, the TC2048) leaves
// those channels silent and the host does not list them. The tape is a channel of its own: while a
// tape loads, the EAR line the beeper level is taken from carries the tape (`effectiveAudioEarBit`),
// so that level goes to the tape channel instead of the beeper's.
//
// Include this before `zx-spectrum-psg.c` (with `SP128_PSG_CHANNEL_TAPS` defined) and
// `zx-spectrum-beeper.c`.

#define ZX_AUDIO_CH_BEEPER 0u
#define ZX_AUDIO_CH_MIC 1u
#define ZX_AUDIO_CH_TAPE 2u
#define ZX_AUDIO_CH_AY_A 3u
#define ZX_AUDIO_CH_AY_B 4u
#define ZX_AUDIO_CH_AY_C 5u
#define ZX_AUDIO_CHANNELS 6u
/* At least every Spectrum core's audio sample capacity (checked where the beeper is included) */
#define ZX_AUDIO_TAP_CAPACITY 2048u
/* The highest gain the host may set, x4 */
#define ZX_AUDIO_MAX_GAIN_MILLI 4000u

static double zxAudioChannelGain[ZX_AUDIO_CHANNELS] = { 1.0, 1.0, 1.0, 1.0, 1.0, 1.0 };
static uint32_t zxAudioChannelGainMilli[ZX_AUDIO_CHANNELS] = { 1000u, 1000u, 1000u, 1000u, 1000u, 1000u };
/* Every gain is 1000: the beeper takes its original path, bit for bit */
static uint8_t zxAudioGainsUnity = 1u;
static uint8_t zxAudioTapsEnabled;
static int16_t zxAudioTaps[ZX_AUDIO_TAP_CAPACITY * ZX_AUDIO_CHANNELS];
/* The heard mix: interleaved left/right words (the layout of the core's own sample buffer), and its
   DC filter's state */
static int16_t zxAudioHeardSamples[ZX_AUDIO_TAP_CAPACITY * 2u];
static double zxAudioHeardDcPrevInputLeft;
static double zxAudioHeardDcPrevInputRight;
static double zxAudioHeardDcPrevOutputLeft;
static double zxAudioHeardDcPrevOutputRight;

static void zxAudioResetHeard(void) {
  zxAudioHeardDcPrevInputLeft = 0.0;
  zxAudioHeardDcPrevInputRight = 0.0;
  zxAudioHeardDcPrevOutputLeft = 0.0;
  zxAudioHeardDcPrevOutputRight = 0.0;
  for (uint32_t i = 0u; i < ZX_AUDIO_TAP_CAPACITY * 2u; i++) zxAudioHeardSamples[i] = 0;
}

static void zxAudioSetChannelGainMilli(uint32_t channel, uint32_t milli) {
  if (channel >= ZX_AUDIO_CHANNELS) return;
  if (milli > ZX_AUDIO_MAX_GAIN_MILLI) milli = ZX_AUDIO_MAX_GAIN_MILLI;
  zxAudioChannelGainMilli[channel] = milli;
  zxAudioChannelGain[channel] = (double)milli / 1000.0;
  uint8_t unity = 1u;
  for (uint32_t i = 0u; i < ZX_AUDIO_CHANNELS; i++) {
    if (zxAudioChannelGainMilli[i] != 1000u) unity = 0u;
  }
  zxAudioGainsUnity = unity;
}

static uint32_t zxAudioGetChannelGainMilli(uint32_t channel) {
  return channel < ZX_AUDIO_CHANNELS ? zxAudioChannelGainMilli[channel] : 0u;
}

static void zxAudioSetTapsEnabled(uint32_t enabled) {
  zxAudioTapsEnabled = enabled != 0u ? 1u : 0u;
}

/* One source's level for the tap, at the mix's scale */
static inline int16_t zxAudioTapWord(double level, double scale) {
  const double value = level * scale;
  if (value > 32767.0) return 32767;
  if (value < -32768.0) return -32768;
  return (int16_t)value;
}
