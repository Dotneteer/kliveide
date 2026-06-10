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

static void resetAudio(void) {
  sp48AudioSampleCount = 0u;
  sp48AudioTransitionCount = 0u;
  sp48AudioFrameStartTact = sp48Tacts;
  sp48AudioFrameStartEarBit = effectiveAudioEarBit();
  sp48AudioFrameStartMicBit = sp48MicBit;
  sp48AudioSampleLength = (double)sp48BaseClockFrequency / (double)sp48AudioSampleRate;
  sp48AudioNextSampleTact = 0.0;
  sp48DcFilterPrevInputLeft = 0.0;
  sp48DcFilterPrevInputRight = 0.0;
  sp48DcFilterPrevOutputLeft = 0.0;
  sp48DcFilterPrevOutputRight = 0.0;
  for (uint32_t i = 0u; i < SP48_AUDIO_SAMPLE_CAPACITY; i++) {
    sp48AudioSamples[i].left = 0;
    sp48AudioSamples[i].right = 0;
  }
}

static void beginAudioFrame(void) {
  sp48AudioSampleCount = 0u;
  sp48AudioTransitionCount = 0u;
  sp48AudioFrameStartTact = sp48Tacts;
  sp48AudioFrameStartEarBit = effectiveAudioEarBit();
  sp48AudioFrameStartMicBit = sp48MicBit;
}

static void recordAudioTransition(uint32_t tact, uint8_t earBit, uint8_t micBit) {
  if (sp48AudioTransitionCount >= SP48_AUDIO_TRANSITION_CAPACITY) {
    sp48DiagnosticFlags |= 0x00000002u;
    return;
  }

  Sp48AudioTransition *transition = &sp48AudioTransitions[sp48AudioTransitionCount++];
  transition->tact = tact;
  transition->earBit = earBit;
  transition->micBit = micBit;
}

static void renderBeeperAudio(uint32_t frameStartTact, uint32_t frameEndTact) {
  uint32_t transitionIndex = 0u;
  uint8_t currentEar = sp48AudioFrameStartEarBit;
  uint8_t currentMic = sp48AudioFrameStartMicBit;

  double sampleWindowStart = (double)frameStartTact;
  sp48AudioSampleCount = 0u;
  while (sp48AudioNextSampleTact <= sampleWindowStart) {
    sp48AudioNextSampleTact += sp48AudioSampleLength;
  }

  while ((double)frameEndTact > sp48AudioNextSampleTact) {
    if (sp48AudioSampleCount >= SP48_AUDIO_SAMPLE_CAPACITY) {
      sp48DiagnosticFlags |= 0x00000001u;
      break;
    }

    double sampleWindowEnd = sp48AudioNextSampleTact;
    if (sampleWindowEnd > (double)frameEndTact) {
      sampleWindowEnd = (double)frameEndTact;
    }

    double totalEar = 0.0;
    double totalMic = 0.0;
    double position = sampleWindowStart;

    while (
      transitionIndex < sp48AudioTransitionCount &&
      (double)sp48AudioTransitions[transitionIndex].tact <= sampleWindowEnd
    ) {
      const double transitionTact = (double)sp48AudioTransitions[transitionIndex].tact;
      const double segmentEnd = transitionTact > position ? transitionTact : position;
      const double duration = segmentEnd - position;
      if (duration > 0.0) {
        totalEar += (currentEar != 0u ? 1.0 : 0.0) * duration;
        totalMic += (currentMic != 0u ? 1.0 : 0.0) * duration;
      }
      currentEar = sp48AudioTransitions[transitionIndex].earBit;
      currentMic = sp48AudioTransitions[transitionIndex].micBit;
      position = transitionTact > position ? transitionTact : position;
      transitionIndex++;
    }

    const double finalDuration = sampleWindowEnd - position;
    if (finalDuration > 0.0) {
      totalEar += (currentEar != 0u ? 1.0 : 0.0) * finalDuration;
      totalMic += (currentMic != 0u ? 1.0 : 0.0) * finalDuration;
    }

    const double windowDuration = sampleWindowEnd - sampleWindowStart;
    const double rawLeft = windowDuration > 0.0 ? totalEar / windowDuration : (currentEar != 0u ? 1.0 : 0.0);
    const double rawRight = windowDuration > 0.0 ? totalMic / windowDuration : (currentMic != 0u ? 1.0 : 0.0);
    const double outLeft = rawLeft - sp48DcFilterPrevInputLeft + 0.995 * sp48DcFilterPrevOutputLeft;
    const double outRight = rawRight - sp48DcFilterPrevInputRight + 0.995 * sp48DcFilterPrevOutputRight;

    sp48DcFilterPrevInputLeft = rawLeft;
    sp48DcFilterPrevInputRight = rawRight;
    sp48DcFilterPrevOutputLeft = outLeft;
    sp48DcFilterPrevOutputRight = outRight;
    sp48AudioSamples[sp48AudioSampleCount].left = clampAudioWord(outLeft * SP48_AUDIO_SAMPLE_SCALE);
    sp48AudioSamples[sp48AudioSampleCount].right = clampAudioWord(outRight * SP48_AUDIO_SAMPLE_SCALE);
    sp48AudioSampleCount++;

    sampleWindowStart = sampleWindowEnd;
    sp48AudioNextSampleTact += sp48AudioSampleLength;
  }
}

void sp48SetAudioSampleRate(uint32_t rate) {
  sp48AudioSampleRate = rate == 0u ? SP48_DEFAULT_SAMPLE_RATE : rate;
  sp48AudioSampleLength = (double)sp48BaseClockFrequency / (double)sp48AudioSampleRate;
  sp48AudioNextSampleTact = 0.0;
  sp48AudioSampleCount = 0u;
}
