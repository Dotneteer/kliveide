// ----------------------------------------------------------------------------
// Beeper audio

#ifndef SP48_AUDIO_EXTRA_LEFT
#define SP48_AUDIO_EXTRA_LEFT() 0.0
#endif

#ifndef SP48_AUDIO_EXTRA_RIGHT
#define SP48_AUDIO_EXTRA_RIGHT() 0.0
#endif

#ifndef SP48_AUDIO_BEFORE_SAMPLE
#define SP48_AUDIO_BEFORE_SAMPLE(sampleEndTact) ((void)0)
#endif

#define SP48_AUDIO_DC_CUTOFF_HZ 1.4
#define SP48_AUDIO_TWO_PI 6.28318530717958647692

static inline int16_t clampAudioWord(double value) {
  if (value > 32767.0) {
    return 32767;
  }
  if (value < -32768.0) {
    return -32768;
  }
  return (int16_t)value;
}

static inline double audioDcFilterAlpha(void) {
  const double rate = sp48AudioSampleRate == 0u
    ? (double)SP48_DEFAULT_SAMPLE_RATE
    : (double)sp48AudioSampleRate;
  const double x = (SP48_AUDIO_TWO_PI * SP48_AUDIO_DC_CUTOFF_HZ) / rate;
  const double x2 = x * x;
  const double x3 = x2 * x;
  return 1.0 / (1.0 + x + 0.5 * x2 + (x3 / 6.0));
}

static inline double mixedBeeperLevel(uint8_t ear, uint8_t mic) {
  const uint8_t index = (mic != 0u ? 1u : 0u) | (ear != 0u ? 2u : 0u);
  if (index == 1u) return 0.33;
  if (index == 2u) return 0.66;
  if (index == 3u) return 1.0;
  return 0.0;
}

static inline uint8_t effectiveAudioEarBit(void) {
  return sp48TapeMode == SP48_TAPE_MODE_LOAD ? sp48TapeEarBit : sp48EarBit;
}

static inline void updateNextAudioSampleTactFloor(void) {
  sp48AudioNextSampleTactFloor = sp48AudioNextSampleTact >= 4294967295.0
    ? 0xffffffffu
    : (uint32_t)sp48AudioNextSampleTact;
}

static void resetAudioAccumulator(void) {
  sp48AudioAccumulatedEar = 0.0;
  sp48AudioAccumulatedMic = 0.0;
  sp48AudioAccumulatedTacts = 0.0;
  sp48AudioLastLevelChangeTact = sp48Tacts;
  sp48AudioSampleWindowStartTact = (double)sp48Tacts;
  sp48AudioSampleWindowStartEar = effectiveAudioEarBit();
  sp48AudioSampleWindowStartMic = sp48MicBit;
  sp48AudioTransitionCount = 0u;
}

static void resetAudio(void) {
  sp48AudioSampleCount = 0u;
  sp48AudioSampleLength = (double)sp48BaseClockFrequency / (double)sp48AudioSampleRate;
  sp48AudioNextSampleTact = sp48AudioSampleLength * (double)sp48ClockMultiplier;
  updateNextAudioSampleTactFloor();
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

static void recordAudioTransition(uint32_t tact, uint8_t ear, uint8_t mic) {
  if (sp48AudioTransitionCount >= SP48_AUDIO_TRANSITION_CAPACITY) {
    sp48DiagnosticFlags |= 0x00000001u;
    return;
  }

  const uint32_t index = sp48AudioTransitionCount++;
  sp48AudioTransitionTacts[index] = tact;
  sp48AudioTransitionEar[index] = ear != 0u ? 1u : 0u;
  sp48AudioTransitionMic[index] = mic != 0u ? 1u : 0u;
  sp48AudioLastLevelChangeTact = tact;
}

static void discardAudioTransitions(uint32_t count) {
  if (count == 0u) return;
  if (count >= sp48AudioTransitionCount) {
    sp48AudioTransitionCount = 0u;
    return;
  }

  const uint32_t remaining = sp48AudioTransitionCount - count;
  for (uint32_t i = 0u; i < remaining; i++) {
    const uint32_t from = i + count;
    sp48AudioTransitionTacts[i] = sp48AudioTransitionTacts[from];
    sp48AudioTransitionEar[i] = sp48AudioTransitionEar[from];
    sp48AudioTransitionMic[i] = sp48AudioTransitionMic[from];
  }
  sp48AudioTransitionCount = remaining;
}

static void getExactWindowAudioSample(double sampleEndTact, double *rawLeft, double *rawRight) {
  const double sampleStartTact = sp48AudioSampleWindowStartTact;
  if (sampleEndTact <= sampleStartTact) {
    const double mixed = mixedBeeperLevel(effectiveAudioEarBit(), sp48MicBit);
    *rawLeft = mixed;
    *rawRight = mixed;
    return;
  }

  double cursor = sampleStartTact;
  uint8_t ear = sp48AudioSampleWindowStartEar;
  uint8_t mic = sp48AudioSampleWindowStartMic;
  double totalMixed = 0.0;
  uint32_t consumed = 0u;

  while (consumed < sp48AudioTransitionCount) {
    const double transitionTact = (double)sp48AudioTransitionTacts[consumed];
    if (transitionTact >= sampleEndTact) break;

    const double clippedTact = transitionTact < cursor ? cursor : transitionTact;
    const double duration = clippedTact - cursor;
    if (duration > 0.0) {
      totalMixed += mixedBeeperLevel(ear, mic) * duration;
    }

    cursor = clippedTact;
    ear = sp48AudioTransitionEar[consumed];
    mic = sp48AudioTransitionMic[consumed];
    consumed++;
  }

  const double finalDuration = sampleEndTact - cursor;
  if (finalDuration > 0.0) {
    totalMixed += mixedBeeperLevel(ear, mic) * finalDuration;
  }

  discardAudioTransitions(consumed);
  sp48AudioSampleWindowStartTact = sampleEndTact;
  sp48AudioSampleWindowStartEar = ear;
  sp48AudioSampleWindowStartMic = mic;

  const double totalTacts = sampleEndTact - sampleStartTact;
  const double mixed = totalTacts > 0.0 ? totalMixed / totalTacts : mixedBeeperLevel(ear, mic);
  *rawLeft = mixed;
  *rawRight = mixed;
}

static void setNextAudioSample(void) {
  if (sp48Tacts < sp48AudioNextSampleTactFloor) {
    return;
  }
  if ((double)sp48Tacts < sp48AudioNextSampleTact) {
    return;
  }
  if (sp48AudioSampleCount >= SP48_AUDIO_SAMPLE_CAPACITY) {
    sp48DiagnosticFlags |= 0x00000001u;
    return;
  }

  double rawLeft;
  double rawRight;

  SP48_AUDIO_BEFORE_SAMPLE(sp48AudioNextSampleTact);
  getExactWindowAudioSample(sp48AudioNextSampleTact, &rawLeft, &rawRight);

  const double alpha = audioDcFilterAlpha();
  const double outMono = rawLeft - sp48DcFilterPrevInputLeft + alpha * sp48DcFilterPrevOutputLeft;

  sp48DcFilterPrevInputLeft = rawLeft;
  sp48DcFilterPrevInputRight = rawLeft;
  sp48DcFilterPrevOutputLeft = outMono;
  sp48DcFilterPrevOutputRight = outMono;
  sp48AudioSamples[sp48AudioSampleCount].left =
    clampAudioWord((outMono + SP48_AUDIO_EXTRA_LEFT()) * SP48_AUDIO_SAMPLE_SCALE);
  sp48AudioSamples[sp48AudioSampleCount].right =
    clampAudioWord((outMono + SP48_AUDIO_EXTRA_RIGHT()) * SP48_AUDIO_SAMPLE_SCALE);
  sp48AudioSampleCount++;
  sp48AudioNextSampleTact += sp48AudioSampleLength * (double)sp48ClockMultiplier;
  updateNextAudioSampleTactFloor();
}

void sp48SetAudioSampleRate(uint32_t rate) {
  sp48AudioSampleRate = rate == 0u ? SP48_DEFAULT_SAMPLE_RATE : rate;
  sp48AudioSampleLength = (double)sp48BaseClockFrequency / (double)sp48AudioSampleRate;
  sp48AudioNextSampleTact = sp48AudioSampleLength * (double)sp48ClockMultiplier;
  updateNextAudioSampleTactFloor();
  sp48AudioSampleCount = 0u;
}
