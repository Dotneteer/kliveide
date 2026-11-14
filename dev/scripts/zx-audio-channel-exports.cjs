/*
 * The audio mixer's exports and statics (`dev/plans/AUDIO_MIXER_PLAN.md` §3.1). The Spectrum family's
 * cores share them (`src/emu/machines/zxSpectrum/wasm/common/zx-spectrum-audio-channels.c`): the 48K
 * (and the Timex, which builds the 48K's source), 128K and +2E/+3E build scripts add them with their
 * own prefix, and `src/emu/machines/zxSpectrum/spectrumAudioChannels.ts` is the TypeScript side. The
 * Next exports the same functions (`zxnext-audio-channels.c`) and lists its own volatile statics.
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
  zxAudioChannelExports
};
