// ----------------------------------------------------------------------------
// Beeper audio

static inline int16_t clampAudioWord(double value) {
  if (value > 32767.0) {
    return 32767;
  }
  if (value < -32768.0) {
    return -32768;
  }
  return (int16_t)value;
}

static inline uint8_t effectiveAudioEarBit(void) {
  return sp48TapeMode == SP48_TAPE_MODE_LOAD ? sp48TapeEarBit : sp48EarBit;
}

static void resetAudioAccumulator(void) {
  sp48AudioAccumulatedEar = 0.0;
  sp48AudioAccumulatedMic = 0.0;
  sp48AudioAccumulatedTacts = 0.0;
  sp48AudioLastLevelChangeTact = sp48Tacts;
}

static void resetAudio(void) {
  sp48AudioSampleCount = 0u;
  sp48AudioSampleLength = (double)sp48BaseClockFrequency / (double)sp48AudioSampleRate;
  sp48AudioNextSampleTact = 0.0;
  sp48DcFilterPrevInputLeft = 0.0;
  sp48DcFilterPrevInputRight = 0.0;
  sp48DcFilterPrevOutputLeft = 0.0;
  sp48DcFilterPrevOutputRight = 0.0;
  resetAudioAccumulator();
  for (uint32_t i = 0u; i < SP48_AUDIO_SAMPLE_CAPACITY; i++) {
    sp48AudioSamples[i].left = 0;
    sp48AudioSamples[i].right = 0;
  }
}

static void beginAudioFrame(void) {
  sp48AudioSampleCount = 0u;
  resetAudioAccumulator();
}

static void recordAudioTransition(uint32_t tact) {
  const uint8_t currentEar = effectiveAudioEarBit();
  const uint8_t currentMic = sp48MicBit;
  const uint32_t duration = tact - sp48AudioLastLevelChangeTact;

  if (duration > 0u) {
    sp48AudioAccumulatedEar += (currentEar != 0u ? 1.0 : 0.0) * (double)duration;
    sp48AudioAccumulatedMic += (currentMic != 0u ? 1.0 : 0.0) * (double)duration;
    sp48AudioAccumulatedTacts += (double)duration;
  }
  sp48AudioLastLevelChangeTact = tact;
}

static void setNextAudioSample(void) {
  if ((double)sp48Tacts <= sp48AudioNextSampleTact) {
    return;
  }
  if (sp48AudioSampleCount >= SP48_AUDIO_SAMPLE_CAPACITY) {
    sp48DiagnosticFlags |= 0x00000001u;
    return;
  }

  const uint8_t currentEar = effectiveAudioEarBit();
  const uint8_t currentMic = sp48MicBit;
  double rawLeft;
  double rawRight;

  if (sp48AudioAccumulatedTacts > 0.0) {
    const uint32_t finalDuration = sp48Tacts - sp48AudioLastLevelChangeTact;
    const double totalEar =
      sp48AudioAccumulatedEar + (currentEar != 0u ? 1.0 : 0.0) * (double)finalDuration;
    const double totalMic =
      sp48AudioAccumulatedMic + (currentMic != 0u ? 1.0 : 0.0) * (double)finalDuration;
    const double totalTacts = sp48AudioAccumulatedTacts + (double)finalDuration;
    rawLeft = totalTacts > 0.0 ? totalEar / totalTacts : (currentEar != 0u ? 1.0 : 0.0);
    rawRight = totalTacts > 0.0 ? totalMic / totalTacts : (currentMic != 0u ? 1.0 : 0.0);
    resetAudioAccumulator();
  } else {
    rawLeft = currentEar != 0u ? 1.0 : 0.0;
    rawRight = currentMic != 0u ? 1.0 : 0.0;
  }

  const double outLeft = rawLeft - sp48DcFilterPrevInputLeft + 0.995 * sp48DcFilterPrevOutputLeft;
  const double outRight = rawRight - sp48DcFilterPrevInputRight + 0.995 * sp48DcFilterPrevOutputRight;

  sp48DcFilterPrevInputLeft = rawLeft;
  sp48DcFilterPrevInputRight = rawRight;
  sp48DcFilterPrevOutputLeft = outLeft;
  sp48DcFilterPrevOutputRight = outRight;
  sp48AudioSamples[sp48AudioSampleCount].left = clampAudioWord(outLeft * SP48_AUDIO_SAMPLE_SCALE);
  sp48AudioSamples[sp48AudioSampleCount].right = clampAudioWord(outRight * SP48_AUDIO_SAMPLE_SCALE);
  sp48AudioSampleCount++;
  sp48AudioNextSampleTact += sp48AudioSampleLength;
}

void sp48SetAudioSampleRate(uint32_t rate) {
  sp48AudioSampleRate = rate == 0u ? SP48_DEFAULT_SAMPLE_RATE : rate;
  sp48AudioSampleLength = (double)sp48BaseClockFrequency / (double)sp48AudioSampleRate;
  sp48AudioNextSampleTact = 0.0;
  sp48AudioSampleCount = 0u;
}
