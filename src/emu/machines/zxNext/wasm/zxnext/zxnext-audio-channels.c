/*
 * The ZX Spectrum Next's sound sources, one by one, for the audio mixer (`dev/plans/AUDIO_MIXER_PLAN.md`
 * §3.1, phase 2). The Spectrum family's counterpart is `zx-spectrum-audio-channels.c`; the rules are
 * the same:
 *
 * - **A gain per source**, applied in a parallel "heard" mix (`zxnext-audio-mixer.c`,
 *   `zxnext-psg.c`): the core's own mix runs exactly as before and fills its own buffers; the heard
 *   mix applies the gains to the same sources, into `zxnextMixerHeardLeft/Right`, which is what the
 *   host plays. At unity it copies the core's own words, bit for bit. Gain 0 is mute.
 * - **A tap per source**: each host sample, the source's level before its gain (pre-fader), in the
 *   jack's units x ZXNEXT_MIXER_GAIN (the scale of the jack's output words), int16, [sample][channel].
 *   Written only while taps are on.
 * - **The gains and the taps switch change only volatile statics**: reverse debugging compares
 *   replayed memory with its keyframes, and the user may change a gain before a Step Back. The
 *   heard mix, the gains and the taps are volatile (`dev/scripts/build-zxnext-wasm.cjs`); every
 *   other static added for the mixer is a function of the machine alone.
 *
 * The sources (slot: what):
 *  0      EAR, the beeper (512 units while high)
 *  1      the MIC line (128 units), which on the Next also carries the tape input and the Pi's EAR bit:
 *         the hardware XORs them into one line (`beep_mic_final`, zxnext-beeper.c), so they cannot be
 *         told apart in the sound and share one channel
 *  2-10   TurboSound AY1 A-C, AY2 A-C, AY3 A-C (chip x 3 + channel)
 *  11-14  DAC A-D (about their $80 centre)
 *  15-16  the Pi I2S input, left and right
 */

#define ZXNEXT_AUDIO_CH_EAR 0u
#define ZXNEXT_AUDIO_CH_MIC 1u
#define ZXNEXT_AUDIO_CH_AY 2u
#define ZXNEXT_AUDIO_CH_DAC 11u
#define ZXNEXT_AUDIO_CH_PI_LEFT 15u
#define ZXNEXT_AUDIO_CH_PI_RIGHT 16u
#define ZXNEXT_AUDIO_CHANNELS 17u
/* The mixer's sample capacity (ZXNEXT_AUDIO_SAMPLE_CAPACITY, checked in zxnext-audio-mixer.c) */
#define ZXNEXT_AUDIO_TAP_CAPACITY 2048u
#define ZXNEXT_AUDIO_MAX_GAIN_MILLI 4000u

static double zxnextAudioChannelGain[ZXNEXT_AUDIO_CHANNELS] = {
  1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0
};
static uint32_t zxnextAudioChannelGainMilli[ZXNEXT_AUDIO_CHANNELS] = {
  1000u, 1000u, 1000u, 1000u, 1000u, 1000u, 1000u, 1000u, 1000u,
  1000u, 1000u, 1000u, 1000u, 1000u, 1000u, 1000u, 1000u
};
/* Every gain is 1000: the heard mix copies the core's own words */
static uint8_t zxnextAudioGainsUnity = 1u;
static uint8_t zxnextAudioTapsEnabled;
static int16_t zxnextAudioTaps[ZXNEXT_AUDIO_TAP_CAPACITY * ZXNEXT_AUDIO_CHANNELS];

static void zxnextAudioSetChannelGainMilli(uint32_t channel, uint32_t milli) {
  if (channel >= ZXNEXT_AUDIO_CHANNELS) return;
  if (milli > ZXNEXT_AUDIO_MAX_GAIN_MILLI) milli = ZXNEXT_AUDIO_MAX_GAIN_MILLI;
  zxnextAudioChannelGainMilli[channel] = milli;
  zxnextAudioChannelGain[channel] = (double)milli / 1000.0;
  uint8_t unity = 1u;
  for (uint32_t i = 0u; i < ZXNEXT_AUDIO_CHANNELS; i++) {
    if (zxnextAudioChannelGainMilli[i] != 1000u) unity = 0u;
  }
  zxnextAudioGainsUnity = unity;
}

static inline int16_t zxnextAudioTapWord(double units) {
  const double value = units * 12.8; /* ZXNEXT_MIXER_GAIN: the jack's scale */
  if (value > 32767.0) return 32767;
  if (value < -32768.0) return -32768;
  return (int16_t)value;
}
