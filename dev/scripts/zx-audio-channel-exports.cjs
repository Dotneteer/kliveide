/*
 * The audio mixer's exports and statics (`dev/plans/AUDIO_MIXER_PLAN.md` §3.1). Every core with sound
 * exports the same functions under its prefix (`zxAudioChannelExports`); the TypeScript side is
 * `src/emu/machines/wasmAudioChannelMixer.ts`. The statics come from three modules: the Spectrum
 * family's `zx-spectrum-audio-channels.c` (48K and Timex, 128K, +2E/+3E, and the HT-1080Z, whose AY
 * is the Spectrum's), the Next's `zxnext-audio-channels.c` (listed in its own build script), and
 * `common/wasm/audio-channels.c` (the Z88, the TVC, the Enterprise). Each core adds its own heard-mix
 * statics.
 */

/** The export names without the core's prefix */
const ZX_AUDIO_CHANNEL_EXPORT_SUFFIXES = [
  "AudioSetChannelGain",
  "AudioGetChannelGain",
  "AudioSetTapsEnabled",
  "AudioTapsPtr",
  "GetAudioChannelCount"
];

/**
 * The mixer's statics a Klive state file leaves out: the gains are the user's listening setup, not
 * machine state, and the taps are rewritten every sample
 */
const ZX_AUDIO_CHANNEL_VOLATILE_SYMBOLS = [
  "zxAudioChannelGain",
  "zxAudioChannelGainMilli",
  "zxAudioGainsUnity",
  "zxAudioTapsEnabled",
  "zxAudioTaps",
  // --- The heard mix, which follows the gains: a gain change between recording and a Step Back
  // --- must not read as a replay that diverged
  "zxAudioHeardSamples",
  "zxAudioHeardDcPrevInputLeft",
  "zxAudioHeardDcPrevInputRight",
  "zxAudioHeardDcPrevOutputLeft",
  "zxAudioHeardDcPrevOutputRight"
];

/**
 * The AY's heard-mix statics, in the cores with an AY (`SP128_PSG_CHANNEL_TAPS`). Its per-channel tap
 * statics (`sp128PsgChannel*`) are not listed: they are accumulated always, a function of the machine
 * alone, and the compiler splits those three-element arrays into one global per element anyway.
 */
const ZX_AUDIO_PSG_VOLATILE_SYMBOLS = [
  "sp128PsgHeardRoutedOutput",
  "sp128PsgHeardAccumulatedOutput",
  "sp128PsgHeardAudioSampleLevel"
];

/**
 * The statics of `common/wasm/audio-channels.c` (the Z88, the TVC, the Enterprise): the gains, the
 * taps. Each core adds its own heard-mix statics.
 */
const KLIVE_AUDIO_CHANNEL_VOLATILE_SYMBOLS = [
  "kliveAudioChannelGain",
  "kliveAudioChannelGainMilli",
  "kliveAudioGainsUnity",
  "kliveAudioTapsEnabled",
  "kliveAudioTaps"
];

/**
 * The mixer's exports of one core
 * @param {string} prefix The core's export prefix
 */
function zxAudioChannelExports(prefix) {
  return ZX_AUDIO_CHANNEL_EXPORT_SUFFIXES.map((suffix) => `${prefix}${suffix}`);
}

module.exports = {
  ZX_AUDIO_CHANNEL_EXPORT_SUFFIXES,
  ZX_AUDIO_CHANNEL_VOLATILE_SYMBOLS,
  ZX_AUDIO_PSG_VOLATILE_SYMBOLS,
  KLIVE_AUDIO_CHANNEL_VOLATILE_SYMBOLS,
  zxAudioChannelExports
};
