// ----------------------------------------------------------------------------
// ZX Spectrum 128K AY-3-8912 PSG
//
// This implementation follows MAME's ay8910_device in AY compatible mode:
// three output streams, AY-3-8910 resistor table, legacy normalized output,
// AY envelope step multiplier 2, and the 17-bit noise LFSR with the /2
// prescaler. The Spectrum 128 routes all three AY outputs to the speaker at
// gain 0.25.

#define SP128_PSG_CLOCK_STEP 16u
#define SP128_PSG_ENV_STEP_MASK 0x0fu
#define SP128_PSG_ROUTE_GAIN 0.25

enum {
  SP128_AY_AFINE = 0x00,
  SP128_AY_ACOARSE = 0x01,
  SP128_AY_BFINE = 0x02,
  SP128_AY_BCOARSE = 0x03,
  SP128_AY_CFINE = 0x04,
  SP128_AY_CCOARSE = 0x05,
  SP128_AY_NOISEPER = 0x06,
  SP128_AY_ENABLE = 0x07,
  SP128_AY_AVOL = 0x08,
  SP128_AY_BVOL = 0x09,
  SP128_AY_CVOL = 0x0a,
  SP128_AY_EAFINE = 0x0b,
  SP128_AY_EACOARSE = 0x0c,
  SP128_AY_EASHAPE = 0x0d,
  SP128_AY_PORTA = 0x0e,
  SP128_AY_PORTB = 0x0f
};

typedef struct Sp128PsgTone {
  uint32_t period;
  uint8_t volume;
  int32_t count;
  uint8_t dutyCycle;
  uint8_t output;
} Sp128PsgTone;

typedef struct Sp128PsgEnvelope {
  uint32_t period;
  int32_t count;
  int32_t step;
  uint8_t volume;
  uint8_t hold;
  uint8_t alternate;
  uint8_t attack;
  uint8_t holding;
} Sp128PsgEnvelope;

static uint8_t sp128PsgRegisterIndex;
static uint8_t sp128PsgActive;
static uint8_t sp128PsgRegisters[16];
static Sp128PsgTone sp128PsgTone[3];
static Sp128PsgEnvelope sp128PsgEnvelope;
static int32_t sp128PsgNoiseCounter;
static uint8_t sp128PsgNoisePrescale;
static uint32_t sp128PsgNoiseRng;
static uint8_t sp128PsgVolEnabled[3];
static uint32_t sp128PsgNextClockTact;
static double sp128PsgStreamOutput[3];
static double sp128PsgCurrentRoutedOutput;
static double sp128PsgAccumulatedOutput;
static double sp128PsgAccumulatedTacts;
static double sp128PsgLastAccumulationTact;
static double sp128PsgAudioSampleLevel;
static int32_t sp128PsgCurrentOutput;
static uint8_t sp128PsgMixerTablesInitialized;
static double sp128PsgVolumeTable[16];
static double sp128PsgEnvelopeTable[16];

static const uint8_t sp128AyReadMasks[16] = {
  0xffu, 0x0fu, 0xffu, 0x0fu, 0xffu, 0x0fu, 0x1fu, 0xffu,
  0x1fu, 0x1fu, 0x1fu, 0xffu, 0xffu, 0x0fu, 0xffu, 0xffu
};

static const int32_t sp128AyVolumeTable[16] = {
  0, 771, 1028, 1542, 2570, 3855, 5397, 8738,
  10280, 16705, 23387, 29298, 37008, 46517, 55255, 65535
};

static const double sp128AyResistors[16] = {
  15950.0, 15350.0, 15090.0, 14760.0, 14275.0, 13620.0, 12890.0, 11370.0,
  10600.0, 8590.0, 7190.0, 5985.0, 4820.0, 3945.0, 3017.0, 2345.0
};

static void sp128PsgBuildSingleTable(double *table, uint8_t zeroIsOff) {
  double temp[16];
  double min = 10.0;
  double max = 0.0;

  for (uint32_t i = 0u; i < 16u; i++) {
    double rt = 1.0 / 8000000.0 + 1.0 / 1000.0;
    double rw = 1.0 / sp128AyResistors[i];
    rt += 1.0 / sp128AyResistors[i];

    if (!(zeroIsOff != 0u && i == 0u)) {
      rw += 1.0 / 800000.0;
      rt += 1.0 / 800000.0;
    }

    temp[i] = rw / rt;
    if (temp[i] < min) {
      min = temp[i];
    }
    if (temp[i] > max) {
      max = temp[i];
    }
  }

  for (uint32_t i = 0u; i < 16u; i++) {
    table[i] = (((temp[i] - min) / (max - min)) - 0.25) * 0.5;
  }
}

static void sp128PsgInitializeMixerTables(void) {
  if (sp128PsgMixerTablesInitialized != 0u) {
    return;
  }
  sp128PsgBuildSingleTable(sp128PsgVolumeTable, 1u);
  sp128PsgBuildSingleTable(sp128PsgEnvelopeTable, 0u);
  sp128PsgMixerTablesInitialized = 1u;
}

static void sp128PsgToneReset(Sp128PsgTone *tone) {
  tone->period = 0u;
  tone->volume = 0u;
  tone->count = 0;
  tone->dutyCycle = 0u;
  tone->output = 0u;
}

static void sp128PsgEnvelopeReset(Sp128PsgEnvelope *envelope) {
  envelope->period = 0u;
  envelope->count = 0;
  envelope->step = 0;
  envelope->volume = 0u;
  envelope->hold = 0u;
  envelope->alternate = 0u;
  envelope->attack = 0u;
  envelope->holding = 0u;
}

static void sp128PsgSetEnvelopeShape(uint8_t shape) {
  sp128PsgEnvelope.attack = (shape & 0x04u) != 0u ? SP128_PSG_ENV_STEP_MASK : 0u;
  if ((shape & 0x08u) == 0u) {
    sp128PsgEnvelope.hold = 1u;
    sp128PsgEnvelope.alternate = sp128PsgEnvelope.attack;
  } else {
    sp128PsgEnvelope.hold = (uint8_t)(shape & 0x01u);
    sp128PsgEnvelope.alternate = (uint8_t)(shape & 0x02u);
  }
  sp128PsgEnvelope.step = (int32_t)SP128_PSG_ENV_STEP_MASK;
  sp128PsgEnvelope.holding = 0u;
  sp128PsgEnvelope.volume = (uint8_t)(sp128PsgEnvelope.step ^ sp128PsgEnvelope.attack);
}

static void resetPsg(void) {
  sp128PsgInitializeMixerTables();
  sp128PsgRegisterIndex = 0u;
  sp128PsgActive = 1u;
  for (uint32_t i = 0u; i < 16u; i++) {
    sp128PsgRegisters[i] = 0u;
  }
  for (uint32_t channel = 0u; channel < 3u; channel++) {
    sp128PsgToneReset(&sp128PsgTone[channel]);
    sp128PsgVolEnabled[channel] = 0u;
    sp128PsgStreamOutput[channel] = 0.0;
  }
  sp128PsgEnvelopeReset(&sp128PsgEnvelope);
  sp128PsgNoiseCounter = 0;
  sp128PsgNoisePrescale = 0u;
  sp128PsgNoiseRng = 1u;
  sp128PsgNextClockTact = sp128Tacts + SP128_PSG_CLOCK_STEP;
  sp128PsgCurrentRoutedOutput = 0.0;
  sp128PsgAccumulatedOutput = 0.0;
  sp128PsgAccumulatedTacts = 0.0;
  sp128PsgLastAccumulationTact = (double)sp128Tacts;
  sp128PsgAudioSampleLevel = 0.0;
  sp128PsgCurrentOutput = 0;
}

static void sp128PsgSetTonePeriod(uint32_t channel) {
  const uint32_t fine = sp128PsgRegisters[channel * 2u];
  const uint32_t coarse = sp128PsgRegisters[channel * 2u + 1u] & 0x0fu;
  sp128PsgTone[channel].period = fine | (coarse << 8u);
}

static void sp128PsgWriteRegister(uint32_t registerIndex, uint8_t value) {
  const uint32_t index = registerIndex & 0x0fu;
  sp128PsgRegisters[index] = value;

  switch (index) {
    case SP128_AY_AFINE:
    case SP128_AY_ACOARSE:
      sp128PsgSetTonePeriod(0u);
      break;
    case SP128_AY_BFINE:
    case SP128_AY_BCOARSE:
      sp128PsgSetTonePeriod(1u);
      break;
    case SP128_AY_CFINE:
    case SP128_AY_CCOARSE:
      sp128PsgSetTonePeriod(2u);
      break;
    case SP128_AY_AVOL:
      sp128PsgTone[0].volume = value;
      break;
    case SP128_AY_BVOL:
      sp128PsgTone[1].volume = value;
      break;
    case SP128_AY_CVOL:
      sp128PsgTone[2].volume = value;
      break;
    case SP128_AY_EAFINE:
    case SP128_AY_EACOARSE:
      sp128PsgEnvelope.period =
        (uint32_t)sp128PsgRegisters[SP128_AY_EAFINE] |
        ((uint32_t)sp128PsgRegisters[SP128_AY_EACOARSE] << 8u);
      break;
    case SP128_AY_EASHAPE:
      sp128PsgSetEnvelopeShape(value & 0x0fu);
      break;
    default:
      break;
  }
}

static void sp128PsgNoiseRngTick(void) {
  const uint32_t feedback = (sp128PsgNoiseRng & 0x01u) ^ ((sp128PsgNoiseRng >> 3u) & 0x01u);
  sp128PsgNoiseRng = (sp128PsgNoiseRng >> 1u) | (feedback << 16u);
}

static void sp128PsgGenerateStreamSample(void) {
  for (uint32_t channel = 0u; channel < 3u; channel++) {
    Sp128PsgTone *tone = &sp128PsgTone[channel];
    const int32_t period = tone->period == 0u ? 1 : (int32_t)tone->period;
    tone->count++;
    while (tone->count >= period) {
      tone->dutyCycle = (uint8_t)((tone->dutyCycle - 1u) & 0x1fu);
      tone->output = (uint8_t)(tone->dutyCycle & 0x01u);
      tone->count -= period;
    }
  }

  sp128PsgNoiseCounter++;
  const uint8_t noisePeriod = sp128PsgRegisters[SP128_AY_NOISEPER] & 0x1fu;
  if ((uint32_t)sp128PsgNoiseCounter >= noisePeriod) {
    sp128PsgNoiseCounter = 0;
    sp128PsgNoisePrescale ^= 1u;
    if (sp128PsgNoisePrescale == 0u) {
      sp128PsgNoiseRngTick();
    }
  }

  const uint8_t enable = sp128PsgRegisters[SP128_AY_ENABLE];
  for (uint32_t channel = 0u; channel < 3u; channel++) {
    Sp128PsgTone *tone = &sp128PsgTone[channel];
    const uint8_t toneDisabled = (enable & (1u << channel)) != 0u ? 1u : 0u;
    const uint8_t noiseDisabled = (enable & (1u << (channel + 3u))) != 0u ? 1u : 0u;
    const uint8_t toneOutput = tone->output | toneDisabled;
    const uint8_t noiseOutput = (sp128PsgNoiseRng & 0x01u) | noiseDisabled;
    sp128PsgVolEnabled[channel] = (uint8_t)(toneOutput & noiseOutput);
  }

  if (sp128PsgEnvelope.holding == 0u) {
    const uint32_t period = sp128PsgEnvelope.period * 2u;
    sp128PsgEnvelope.count++;
    if ((uint32_t)sp128PsgEnvelope.count >= period) {
      sp128PsgEnvelope.count = 0;
      sp128PsgEnvelope.step--;
      if (sp128PsgEnvelope.step < 0) {
        if (sp128PsgEnvelope.hold != 0u) {
          if (sp128PsgEnvelope.alternate != 0u) {
            sp128PsgEnvelope.attack ^= SP128_PSG_ENV_STEP_MASK;
          }
          sp128PsgEnvelope.holding = 1u;
          sp128PsgEnvelope.step = 0;
        } else {
          if (sp128PsgEnvelope.alternate != 0u && (sp128PsgEnvelope.step & 0x10) != 0) {
            sp128PsgEnvelope.attack ^= SP128_PSG_ENV_STEP_MASK;
          }
          sp128PsgEnvelope.step &= SP128_PSG_ENV_STEP_MASK;
        }
      }
    }
  }
  sp128PsgEnvelope.volume = (uint8_t)(sp128PsgEnvelope.step ^ sp128PsgEnvelope.attack);

  int32_t diagnosticOutput = 0;
  double routedOutput = 0.0;
  for (uint32_t channel = 0u; channel < 3u; channel++) {
    Sp128PsgTone *tone = &sp128PsgTone[channel];
    const uint8_t toneVolume = tone->volume;
    uint8_t volumeIndex;
    if (((toneVolume >> 4u) & 0x01u) != 0u) {
      volumeIndex = sp128PsgVolEnabled[channel] != 0u ? sp128PsgEnvelope.volume : 0u;
      sp128PsgStreamOutput[channel] = sp128PsgEnvelopeTable[volumeIndex & 0x0fu];
    } else {
      volumeIndex = sp128PsgVolEnabled[channel] != 0u ? toneVolume : 0u;
      sp128PsgStreamOutput[channel] = sp128PsgVolumeTable[volumeIndex & 0x0fu];
    }
    diagnosticOutput += sp128AyVolumeTable[volumeIndex & 0x0fu];
    routedOutput += sp128PsgStreamOutput[channel] * SP128_PSG_ROUTE_GAIN;
  }
  sp128PsgCurrentOutput = diagnosticOutput;
  sp128PsgCurrentRoutedOutput = routedOutput;
}

static void sp128PsgAccumulateCurrentOutputUntil(double tact) {
  if (tact <= sp128PsgLastAccumulationTact) {
    return;
  }
  const double duration = tact - sp128PsgLastAccumulationTact;
  sp128PsgAccumulatedOutput += sp128PsgCurrentRoutedOutput * duration;
  sp128PsgAccumulatedTacts += duration;
  sp128PsgLastAccumulationTact = tact;
}

static void sp128PsgAdvanceToTact(double tact) {
  while ((double)sp128PsgNextClockTact <= tact) {
    sp128PsgAccumulateCurrentOutputUntil((double)sp128PsgNextClockTact);
    sp128PsgGenerateStreamSample();
    sp128PsgNextClockTact += SP128_PSG_CLOCK_STEP;
  }
  sp128PsgAccumulateCurrentOutputUntil(tact);
}

static void sp128PsgPrepareAudioSample(double sampleEndTact) {
  sp128PsgAdvanceToTact(sampleEndTact);
  if (sp128PsgAccumulatedTacts > 0.0) {
    sp128PsgAudioSampleLevel = sp128PsgAccumulatedOutput / sp128PsgAccumulatedTacts;
    sp128PsgAccumulatedOutput = 0.0;
    sp128PsgAccumulatedTacts = 0.0;
  }
}

static double sp128PsgAudioLevel(void) {
  return sp128PsgAudioSampleLevel;
}

static void sp128PsgAddressWrite(uint32_t value) {
  sp128PsgAdvanceToTact((double)sp128Tacts);
  sp128PsgActive = ((value >> 4u) == 0u) ? 1u : 0u;
  sp128PsgRegisterIndex = (uint8_t)(value & 0x1fu);
}

static void sp128PsgDataWrite(uint32_t value) {
  if (sp128PsgActive == 0u) {
    return;
  }
  sp128PsgAdvanceToTact((double)sp128Tacts);
  sp128PsgWriteRegister(sp128PsgRegisterIndex, (uint8_t)value);
}

static uint32_t sp128PsgDataRead(void) {
  if (sp128PsgActive == 0u) {
    return 0xffu;
  }
  const uint8_t index = sp128PsgRegisterIndex & 0x0fu;
  return sp128PsgRegisters[index] & sp128AyReadMasks[index];
}

static void writePsgRegister(uint32_t value) {
  sp128PsgDataWrite(value);
}

static void sp128PsgSetRegisterIndex(uint32_t index) {
  sp128PsgActive = ((index >> 4u) == 0u) ? 1u : 0u;
  sp128PsgRegisterIndex = (uint8_t)(index & 0x1fu);
}

static uint32_t sp128PsgGetRegisterValue(uint32_t index) {
  return sp128PsgRegisters[index & 0x0fu];
}

static uint32_t sp128PsgGetToneA(void) {
  return sp128PsgTone[0].period;
}

static uint32_t sp128PsgGetVolumeA(void) {
  return sp128PsgTone[0].volume & 0x0fu;
}

#undef SP128_PSG_ENV_STEP_MASK
#undef SP128_PSG_ROUTE_GAIN
#undef SP128_PSG_CLOCK_STEP
