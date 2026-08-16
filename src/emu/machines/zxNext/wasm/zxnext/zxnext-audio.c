#include "zxnext.h"

static int16_t clampAudioSample(int32_t value) {
  if (value > 32767) return 32767;
  if (value < -32768) return -32768;
  return (int16_t)value;
}

static int32_t floorHalf(int32_t value) {
  if (value >= 0) return value / 2;
  return -(((-value) + 1) / 2);
}

static int16_t scaleMixerOutput(int32_t mixed) {
  return clampAudioSample(floorHalf(mixed * 11));
}

static void resetAudioState(void) {
  dacChannels[0] = 0x80u;
  dacChannels[1] = 0x80u;
  dacChannels[2] = 0x80u;
  dacChannels[3] = 0x80u;
  audioSampleCount = 0u;
  audioBeepOnlyToInternalSpeaker = 0u;
  audioPsgMode = 0u;
  audioAyStereoMode = 0u;
  audioEnableInternalSpeaker = 1u;
  audioEnable8BitDacs = 1u;
  audioSilenceHdmiAudio = 0u;
  audioEnableTurbosound = 1u;
  audioAyMonoEnable[0] = 0u;
  audioAyMonoEnable[1] = 0u;
  audioAyMonoEnable[2] = 0u;
  for (uint32_t i = 0; i < ZXNEXT_AUDIO_SAMPLE_CAPACITY * 2u; i++) audioSamples[i] = 0;
}

static uint32_t audioReadNextReg(uint32_t reg) {
  switch (reg & 0xffu) {
    case 0x2c: return dacChannels[1];
    case 0x2d: return dacChannels[0];
    case 0x2e: return dacChannels[2];
    default: return 0xffffffffu;
  }
}

static uint32_t audioWriteNextReg(uint32_t reg, uint32_t value) {
  const uint8_t byteValue = (uint8_t)(value & 0xffu);
  switch (reg & 0xffu) {
    case 0x00:
      audioBeepOnlyToInternalSpeaker = (byteValue & 0x40u) != 0u;
      audioPsgMode = byteValue & 0x03u;
      return 0u;
    case 0x08:
      audioAyStereoMode = (byteValue & 0x20u) != 0u;
      audioEnableInternalSpeaker = (byteValue & 0x10u) != 0u;
      audioEnable8BitDacs = (byteValue & 0x08u) != 0u;
      audioSilenceHdmiAudio = (byteValue & 0x04u) != 0u;
      audioEnableTurbosound = (byteValue & 0x02u) != 0u;
      if (audioEnable8BitDacs == 0u) {
        dacChannels[0] = 0x80u;
        dacChannels[1] = 0x80u;
        dacChannels[2] = 0x80u;
        dacChannels[3] = 0x80u;
      }
      return 0u;
    case 0x09:
      audioAyMonoEnable[0] = (byteValue & 0x20u) != 0u;
      audioAyMonoEnable[1] = (byteValue & 0x40u) != 0u;
      audioAyMonoEnable[2] = (byteValue & 0x80u) != 0u;
      return 0u;
    case 0x2c:
      dacChannels[1] = byteValue;
      return 1u;
    case 0x2d:
      dacChannels[0] = byteValue;
      dacChannels[3] = byteValue;
      return 1u;
    case 0x2e:
      dacChannels[2] = byteValue;
      return 1u;
    default:
      return 0u;
  }
}

static uint32_t audioFrameSampleTarget(void) {
  return screenIs60Hz != 0u ? 800u : 960u;
}

uint32_t zxnextGenerateAudioSamples(uint32_t requestedCount) {
  uint32_t count = requestedCount;
  if (count == 0u) count = audioFrameSampleTarget();
  if (count > ZXNEXT_AUDIO_SAMPLE_CAPACITY) count = ZXNEXT_AUDIO_SAMPLE_CAPACITY;

  const uint32_t beepExcluded =
    audioBeepOnlyToInternalSpeaker != 0u && audioEnableInternalSpeaker != 0u;
  const int32_t earMixed = beepExcluded == 0u && ulaBeeperEar != 0u ? 512 * 12 : 0;
  const int32_t micMixed = beepExcluded == 0u && ulaBeeperMic != 0u ? 128 * 12 : 0;
  const int32_t dacLeft =
    audioEnable8BitDacs != 0u ? (int32_t)(((uint32_t)dacChannels[0] + (uint32_t)dacChannels[1]) << 2u) - 1024 : 0;
  const int32_t dacRight =
    audioEnable8BitDacs != 0u ? (int32_t)(((uint32_t)dacChannels[2] + (uint32_t)dacChannels[3]) << 2u) - 1024 : 0;
  const uint32_t psgLeftScaled = zxnextPsgMixerLeft() / 24u;
  const uint32_t psgRightScaled = zxnextPsgMixerRight() / 24u;
  const uint32_t psgPeak = psgLeftScaled > psgRightScaled ? psgLeftScaled : psgRightScaled;
  const int32_t psgMidpoint = (int32_t)(psgPeak / 2u);
  const int32_t psgLeft = (int32_t)psgLeftScaled - psgMidpoint;
  const int32_t psgRight = (int32_t)psgRightScaled - psgMidpoint;
  const int16_t left = audioSilenceHdmiAudio != 0u ? 0 : scaleMixerOutput(earMixed + micMixed + psgLeft + dacLeft);
  const int16_t right = audioSilenceHdmiAudio != 0u ? 0 : scaleMixerOutput(earMixed + micMixed + psgRight + dacRight);

  for (uint32_t i = 0; i < count; i++) {
    audioSamples[i * 2u] = left;
    audioSamples[i * 2u + 1u] = right;
  }
  audioSampleCount = count;
  return count;
}

uint32_t zxnextGenerateAudioFrameSamples(void) {
  return zxnextGenerateAudioSamples(audioFrameSampleTarget());
}

uint32_t zxnextGetAudioSampleCount(void) { return audioSampleCount; }
uint32_t zxnextGetDacChannel(uint32_t channel) { return channel < 4u ? dacChannels[channel] : 0xffu; }
uint32_t zxnextGetDacLeftLevel(void) { return (uint32_t)dacChannels[0] + (uint32_t)dacChannels[1]; }
uint32_t zxnextGetDacRightLevel(void) { return (uint32_t)dacChannels[2] + (uint32_t)dacChannels[3]; }
uint32_t zxnextGetAudioBeepOnlyToInternalSpeaker(void) { return audioBeepOnlyToInternalSpeaker; }
uint32_t zxnextGetAudioPsgMode(void) { return audioPsgMode; }
uint32_t zxnextGetAudioAyStereoMode(void) { return audioAyStereoMode; }
uint32_t zxnextGetAudioEnableInternalSpeaker(void) { return audioEnableInternalSpeaker; }
uint32_t zxnextGetAudioEnable8BitDacs(void) { return audioEnable8BitDacs; }
uint32_t zxnextGetAudioSilenceHdmiAudio(void) { return audioSilenceHdmiAudio; }
uint32_t zxnextGetAudioEnableTurbosound(void) { return audioEnableTurbosound; }
uint32_t zxnextGetAudioAyMonoEnable(uint32_t chip) { return chip < 3u ? audioAyMonoEnable[chip] : 0u; }
