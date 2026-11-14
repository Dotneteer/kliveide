// ----------------------------------------------------------------------------
// Beeper audio
//
// Needs `zx-spectrum-audio-channels.c` included first: the beeper, MIC and tape channels' gains and
// the audio mixer's taps.

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

_Static_assert(SP48_AUDIO_SAMPLE_CAPACITY <= ZX_AUDIO_TAP_CAPACITY, "The audio taps are smaller than the sample buffer");

/* The AY's channel level for the taps, or 0 on a core without one */
#ifndef SP48_AUDIO_AY_CHANNEL_LEVEL
#define SP48_AUDIO_AY_CHANNEL_LEVEL(channel) 0.0
#endif
/* The AY's level with the mixer's gains, for the heard mix (the counterpart of SP48_AUDIO_EXTRA_*) */
#ifndef SP48_AUDIO_HEARD_EXTRA_LEFT
#define SP48_AUDIO_HEARD_EXTRA_LEFT() 0.0
#endif
#ifndef SP48_AUDIO_HEARD_EXTRA_RIGHT
#define SP48_AUDIO_HEARD_EXTRA_RIGHT() 0.0
#endif

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
  zxAudioResetHeard();
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

/*
 * The window's mixed level, and in `stateShare` the share of the window each EAR/MIC state took
 * (index: MIC bit 0, EAR bit 1), which the audio mixer's gains and taps are computed from. The mixed
 * level is summed exactly as before the mixer existed, so the unity-gain output is unchanged.
 */
static void getExactWindowAudioSample(double sampleEndTact, double *rawLeft, double *rawRight, double *stateShare) {
  const double sampleStartTact = sp48AudioSampleWindowStartTact;
  stateShare[0] = 0.0;
  stateShare[1] = 0.0;
  stateShare[2] = 0.0;
  stateShare[3] = 0.0;
  if (sampleEndTact <= sampleStartTact) {
    const uint8_t ear = effectiveAudioEarBit();
    const double mixed = mixedBeeperLevel(ear, sp48MicBit);
    stateShare[(sp48MicBit != 0u ? 1u : 0u) | (ear != 0u ? 2u : 0u)] = 1.0;
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
      stateShare[(mic != 0u ? 1u : 0u) | (ear != 0u ? 2u : 0u)] += duration;
    }

    cursor = clippedTact;
    ear = sp48AudioTransitionEar[consumed];
    mic = sp48AudioTransitionMic[consumed];
    consumed++;
  }

  const double finalDuration = sampleEndTact - cursor;
  if (finalDuration > 0.0) {
    totalMixed += mixedBeeperLevel(ear, mic) * finalDuration;
    stateShare[(mic != 0u ? 1u : 0u) | (ear != 0u ? 2u : 0u)] += finalDuration;
  }

  discardAudioTransitions(consumed);
  sp48AudioSampleWindowStartTact = sampleEndTact;
  sp48AudioSampleWindowStartEar = ear;
  sp48AudioSampleWindowStartMic = mic;

  const double totalTacts = sampleEndTact - sampleStartTact;
  const double mixed = totalTacts > 0.0 ? totalMixed / totalTacts : mixedBeeperLevel(ear, mic);
  for (uint32_t i = 0u; i < 4u; i++) {
    stateShare[i] = totalTacts > 0.0 ? stateShare[i] / totalTacts : 0.0;
  }
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
  double stateShare[4];

  SP48_AUDIO_BEFORE_SAMPLE(sp48AudioNextSampleTact);
  getExactWindowAudioSample(sp48AudioNextSampleTact, &rawLeft, &rawRight, stateShare);

  /*
   * The audio mixer's taps (`zx-spectrum-audio-channels.c`). The table level splits into an EAR part
   * (0.66) and a MIC part (0.33). While a tape loads, the EAR line carries the tape, so its part is
   * the tape channel's.
   */
  const uint32_t earChannel = sp48TapeMode == SP48_TAPE_MODE_LOAD ? ZX_AUDIO_CH_TAPE : ZX_AUDIO_CH_BEEPER;
  if (zxAudioTapsEnabled != 0u) {
    int16_t *tap = &zxAudioTaps[sp48AudioSampleCount * ZX_AUDIO_CHANNELS];
    const double earLevel = (stateShare[2] + stateShare[3]) * 0.66;
    tap[ZX_AUDIO_CH_BEEPER] = earChannel == ZX_AUDIO_CH_BEEPER ? zxAudioTapWord(earLevel, SP48_AUDIO_SAMPLE_SCALE) : 0;
    tap[ZX_AUDIO_CH_TAPE] = earChannel == ZX_AUDIO_CH_TAPE ? zxAudioTapWord(earLevel, SP48_AUDIO_SAMPLE_SCALE) : 0;
    tap[ZX_AUDIO_CH_MIC] = zxAudioTapWord((stateShare[1] + stateShare[3]) * 0.33, SP48_AUDIO_SAMPLE_SCALE);
    tap[ZX_AUDIO_CH_AY_A] = zxAudioTapWord(SP48_AUDIO_AY_CHANNEL_LEVEL(0u), SP48_AUDIO_SAMPLE_SCALE);
    tap[ZX_AUDIO_CH_AY_B] = zxAudioTapWord(SP48_AUDIO_AY_CHANNEL_LEVEL(1u), SP48_AUDIO_SAMPLE_SCALE);
    tap[ZX_AUDIO_CH_AY_C] = zxAudioTapWord(SP48_AUDIO_AY_CHANNEL_LEVEL(2u), SP48_AUDIO_SAMPLE_SCALE);
  }

  /*
   * The beeper and the AY are mixed *before* the DC-blocking filter, as the real machines couple
   * their sound through a capacitor. The AY used to be added after it, and its silent level is not
   * zero (volume 0 maps to -0.125 per channel through the resistor table), so a silent 128K, +2 or +3
   * produced a constant offset. Any gap in playback - the audio worklet fades to zero when the
   * machine falls a few samples behind real time, then resumes - stepped from zero back to that
   * offset, an audible thump every few seconds. The 48K, beeper only, was already filtered and silent.
   */
  const double alpha = audioDcFilterAlpha();
  const double inLeft = rawLeft + SP48_AUDIO_EXTRA_LEFT();
  const double inRight = rawLeft + SP48_AUDIO_EXTRA_RIGHT();
  const double outLeft = inLeft - sp48DcFilterPrevInputLeft + alpha * sp48DcFilterPrevOutputLeft;
  const double outRight = inRight - sp48DcFilterPrevInputRight + alpha * sp48DcFilterPrevOutputRight;

  sp48DcFilterPrevInputLeft = inLeft;
  sp48DcFilterPrevInputRight = inRight;
  sp48DcFilterPrevOutputLeft = outLeft;
  sp48DcFilterPrevOutputRight = outRight;
  sp48AudioSamples[sp48AudioSampleCount].left = clampAudioWord(outLeft * SP48_AUDIO_SAMPLE_SCALE);
  sp48AudioSamples[sp48AudioSampleCount].right = clampAudioWord(outRight * SP48_AUDIO_SAMPLE_SCALE);

  /*
   * The heard mix: the same filter on the mix with the mixer's gains, in volatile state only. At
   * unity it takes the core's own input, so it is the same sample, bit for bit. The beeper's gained
   * form keeps the table's levels: EAR alone 0.66, MIC alone 0.33, both 1.0 (2/3 EAR + 1/3 MIC).
   */
  double heardLeft = inLeft;
  double heardRight = inRight;
  if (zxAudioGainsUnity == 0u) {
    const double earGain = zxAudioChannelGain[earChannel];
    const double micGain = zxAudioChannelGain[ZX_AUDIO_CH_MIC];
    const double beeper = stateShare[1] * 0.33 * micGain
      + stateShare[2] * 0.66 * earGain
      + stateShare[3] * (2.0 * earGain + micGain) / 3.0;
    heardLeft = beeper + SP48_AUDIO_HEARD_EXTRA_LEFT();
    heardRight = beeper + SP48_AUDIO_HEARD_EXTRA_RIGHT();
  }
  const double heardOutLeft = heardLeft - zxAudioHeardDcPrevInputLeft + alpha * zxAudioHeardDcPrevOutputLeft;
  const double heardOutRight = heardRight - zxAudioHeardDcPrevInputRight + alpha * zxAudioHeardDcPrevOutputRight;
  zxAudioHeardDcPrevInputLeft = heardLeft;
  zxAudioHeardDcPrevInputRight = heardRight;
  zxAudioHeardDcPrevOutputLeft = heardOutLeft;
  zxAudioHeardDcPrevOutputRight = heardOutRight;
  zxAudioHeardSamples[sp48AudioSampleCount * 2u] = clampAudioWord(heardOutLeft * SP48_AUDIO_SAMPLE_SCALE);
  zxAudioHeardSamples[sp48AudioSampleCount * 2u + 1u] = clampAudioWord(heardOutRight * SP48_AUDIO_SAMPLE_SCALE);
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
