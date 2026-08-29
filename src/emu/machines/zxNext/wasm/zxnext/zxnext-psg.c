#include "zxnext-psg.h"

static const uint32_t zxnextPsgVolumeTable[32] = {
  0u, 257u, 257u, 514u, 514u, 771u, 771u, 1028u,
  1542u, 1799u, 2313u, 2570u, 3084u, 3598u, 4369u, 4883u,
  5911u, 6939u, 8224u, 9509u, 11308u, 13621u, 15934u, 18247u,
  21588u, 26214u, 30583u, 34952u, 41377u, 49344u, 57568u, 65535u
};

typedef struct ZxNextPsgTone {
  uint16_t period;
  uint8_t volume;
  int32_t count;
  uint8_t dutyCycle;
  uint8_t output;
} ZxNextPsgTone;

typedef struct ZxNextPsgEnvelope {
  uint16_t period;
  int32_t count;
  int32_t step;
  uint8_t volume;
  uint8_t hold;
  uint8_t alternate;
  uint8_t attack;
  uint8_t holding;
} ZxNextPsgEnvelope;

typedef struct ZxNextPsgChip {
  uint8_t regs[16];
  uint8_t selectedReg;
  ZxNextPsgTone tone[3];
  ZxNextPsgEnvelope envelope;
  int32_t noiseCounter;
  uint8_t noisePrescale;
  uint32_t noiseRng;
  uint8_t volEnabled[3];
  uint32_t currentOutput[3];
} ZxNextPsgChip;

static ZxNextPsgChip zxnextPsgChips[3];
static uint8_t zxnextPsgSelectedChip;
static uint8_t zxnextPsgTurbosoundEnabled;
static uint8_t zxnextPsgAyStereoMode;
static uint8_t zxnextPsgChipPanning[3];
static uint8_t zxnextPsgChipMonoMode[3];
static double zxnextPsgNextClockFrameTact;
static double zxnextPsgLastAccumulationFrameTact;
static double zxnextPsgAccumulatedLeft;
static double zxnextPsgAccumulatedRight;
static double zxnextPsgAccumulatedTacts;
static uint32_t zxnextPsgCurrentLeft;
static uint32_t zxnextPsgCurrentRight;
static uint32_t zxnextPsgSampleLeft;
static uint32_t zxnextPsgSampleRight;

static void zxnextPsgRefreshCurrentStereoOutput(void);

static void zxnextPsgResetTone(ZxNextPsgTone *tone) {
  tone->period = 0u;
  tone->volume = 0u;
  tone->count = 0;
  tone->dutyCycle = 0u;
  tone->output = 0u;
}

static void zxnextPsgResetEnvelope(ZxNextPsgEnvelope *envelope) {
  envelope->period = 0u;
  envelope->count = 0;
  envelope->step = 0;
  envelope->volume = 0u;
  envelope->hold = 0u;
  envelope->alternate = 0u;
  envelope->attack = 0u;
  envelope->holding = 0u;
}

static void zxnextPsgResetChip(uint32_t chip) {
  ZxNextPsgChip *state = &zxnextPsgChips[chip % 3u];
  for (uint32_t i = 0u; i < 16u; i++) state->regs[i] = 0u;
  state->regs[7] = 0xffu;
  state->selectedReg = 0u;
  for (uint32_t i = 0u; i < 3u; i++) {
    zxnextPsgResetTone(&state->tone[i]);
    state->volEnabled[i] = 0u;
    state->currentOutput[i] = 0u;
  }
  zxnextPsgResetEnvelope(&state->envelope);
  state->noiseCounter = 0;
  state->noisePrescale = 0u;
  state->noiseRng = 1u;
}

static void zxnextPsgResetAudioWindow(void) {
  zxnextPsgNextClockFrameTact = 128.0;
  zxnextPsgLastAccumulationFrameTact = 0.0;
  zxnextPsgAccumulatedLeft = 0.0;
  zxnextPsgAccumulatedRight = 0.0;
  zxnextPsgAccumulatedTacts = 0.0;
}

static void zxnextPsgReset(void) {
  for (uint32_t chip = 0u; chip < 3u; chip++) {
    zxnextPsgResetChip(chip);
    zxnextPsgChipPanning[chip] = 0x03u;
    zxnextPsgChipMonoMode[chip] = 0u;
  }
  zxnextPsgSelectedChip = 0u;
  zxnextPsgTurbosoundEnabled = 0u;
  zxnextPsgAyStereoMode = 0u;
  zxnextPsgCurrentLeft = 0u;
  zxnextPsgCurrentRight = 0u;
  zxnextPsgSampleLeft = 0u;
  zxnextPsgSampleRight = 0u;
  zxnextPsgResetAudioWindow();
}

static void zxnextPsgBeginFrame(void) {
  zxnextPsgResetAudioWindow();
  zxnextPsgRefreshCurrentStereoOutput();
}

static void zxnextPsgSetTurbosoundEnabled(uint32_t enabled) {
  zxnextPsgAdvanceToFrameTact((double)frameTacts28);
  zxnextPsgTurbosoundEnabled = enabled != 0u;
  zxnextPsgRefreshCurrentStereoOutput();
}

static void zxnextPsgSetAyStereoMode(uint32_t enabled) {
  zxnextPsgAdvanceToFrameTact((double)frameTacts28);
  zxnextPsgAyStereoMode = enabled != 0u;
  zxnextPsgRefreshCurrentStereoOutput();
}

static void zxnextPsgSetChipMonoMode(uint32_t chip, uint32_t enabled) {
  zxnextPsgAdvanceToFrameTact((double)frameTacts28);
  zxnextPsgChipMonoMode[chip % 3u] = enabled != 0u;
  zxnextPsgRefreshCurrentStereoOutput();
}

static inline void zxnextPsgSetTonePeriod(ZxNextPsgChip *chip, uint32_t channel) {
  uint32_t fine = chip->regs[channel * 2u];
  uint32_t coarse = chip->regs[channel * 2u + 1u];
  chip->tone[channel].period = (uint16_t)(fine | (coarse << 8u));
}

static void zxnextPsgSetEnvelopeShape(ZxNextPsgChip *chip, uint32_t shape) {
  ZxNextPsgEnvelope *envelope = &chip->envelope;
  envelope->attack = (shape & 0x04u) != 0u ? 0x1fu : 0u;
  if ((shape & 0x08u) == 0u) {
    envelope->hold = 1u;
    envelope->alternate = envelope->attack;
  } else {
    envelope->hold = (uint8_t)(shape & 0x01u);
    envelope->alternate = (uint8_t)(shape & 0x02u);
  }
  envelope->step = 0x1f;
  envelope->holding = 0u;
  envelope->volume = (uint8_t)(envelope->step ^ envelope->attack);
  envelope->count = 0;
}

static void zxnextPsgWriteRegister(ZxNextPsgChip *chip, uint32_t reg, uint32_t value) {
  uint8_t index = (uint8_t)(reg & 0x0fu);
  uint8_t byteValue = (uint8_t)value;
  chip->regs[index] = byteValue;

  switch (index) {
    case 0x00u:
    case 0x01u:
      zxnextPsgSetTonePeriod(chip, 0u);
      break;
    case 0x02u:
    case 0x03u:
      zxnextPsgSetTonePeriod(chip, 1u);
      break;
    case 0x04u:
    case 0x05u:
      zxnextPsgSetTonePeriod(chip, 2u);
      break;
    case 0x08u:
      chip->tone[0].volume = byteValue;
      break;
    case 0x09u:
      chip->tone[1].volume = byteValue;
      break;
    case 0x0au:
      chip->tone[2].volume = byteValue;
      break;
    case 0x0bu:
    case 0x0cu:
      chip->envelope.period = (uint16_t)(chip->regs[0x0bu] | (chip->regs[0x0cu] << 8u));
      break;
    case 0x0du:
      zxnextPsgSetEnvelopeShape(chip, byteValue & 0x0fu);
      break;
    default:
      break;
  }
}

static void zxnextPsgSetRegisterIndex(uint32_t value) {
  uint8_t byteValue = (uint8_t)value;
  zxnextPsgAdvanceToFrameTact((double)frameTacts28);
  if ((byteValue & 0x80u) != 0u && (byteValue & 0x1cu) == 0x1cu) {
    if (zxnextPsgTurbosoundEnabled) {
      uint8_t chipSelect = byteValue & 0x03u;
      if (chipSelect == 0x02u) zxnextPsgSelectedChip = 1u;
      else if (chipSelect == 0x01u) zxnextPsgSelectedChip = 2u;
      else zxnextPsgSelectedChip = 0u;
      zxnextPsgChipPanning[zxnextPsgSelectedChip] = (byteValue >> 5u) & 0x03u;
      zxnextPsgRefreshCurrentStereoOutput();
    }
  } else if ((byteValue & 0xe0u) == 0u) {
    zxnextPsgChips[zxnextPsgSelectedChip].selectedReg = byteValue & 0x0fu;
  }
}

static void zxnextPsgWriteRegisterValue(uint32_t value) {
  ZxNextPsgChip *chip = &zxnextPsgChips[zxnextPsgSelectedChip];
  zxnextPsgAdvanceToFrameTact((double)frameTacts28);
  zxnextPsgWriteRegister(chip, chip->selectedReg, value);
}

static uint32_t zxnextPsgReadRegisterValue(void) {
  ZxNextPsgChip *chip = &zxnextPsgChips[zxnextPsgSelectedChip];
  uint8_t index = chip->selectedReg & 0x0fu;
  return chip->regs[index];
}

static inline uint32_t zxnextPsgNoisePeriod(ZxNextPsgChip *chip) {
  uint32_t period = chip->regs[0x06u];
  return period == 0u ? 1u : period;
}

static inline void zxnextPsgNoiseRngTick(ZxNextPsgChip *chip) {
  uint32_t feedback = (chip->noiseRng & 0x01u) ^ ((chip->noiseRng >> 3u) & 0x01u);
  chip->noiseRng = ((chip->noiseRng >> 1u) | (feedback << 16u)) & 0x1ffffu;
}

static inline uint32_t zxnextPsgToneDisabled(ZxNextPsgChip *chip, uint32_t channel) {
  return (chip->regs[0x07u] >> channel) & 0x01u;
}

static inline uint32_t zxnextPsgNoiseDisabled(ZxNextPsgChip *chip, uint32_t channel) {
  return (chip->regs[0x07u] >> (channel + 3u)) & 0x01u;
}

static void zxnextPsgUpdateOutputs(ZxNextPsgChip *chip) {
  for (uint32_t channel = 0u; channel < 3u; channel++) {
    uint32_t volumeIndex;
    uint32_t diagnosticIndex;
    ZxNextPsgTone *tone = &chip->tone[channel];
    if ((tone->volume & 0x10u) != 0u) {
      volumeIndex = chip->volEnabled[channel] ? chip->envelope.volume : 0u;
      diagnosticIndex = volumeIndex;
    } else {
      volumeIndex = chip->volEnabled[channel] ? (tone->volume & 0x0fu) : 0u;
      diagnosticIndex = volumeIndex != 0u ? volumeIndex * 2u + 1u : 0u;
    }
    chip->currentOutput[channel] = zxnextPsgVolumeTable[diagnosticIndex & 0x1fu];
  }
}

static void zxnextPsgGenerateOutput(uint32_t chipId) {
  ZxNextPsgChip *chip = &zxnextPsgChips[chipId % 3u];

  for (uint32_t channel = 0u; channel < 3u; channel++) {
    ZxNextPsgTone *tone = &chip->tone[channel];
    uint32_t period = tone->period == 0u ? 1u : tone->period;
    tone->count++;
    while ((uint32_t)tone->count >= period) {
      tone->dutyCycle = (uint8_t)((tone->dutyCycle - 1u) & 0x1fu);
      tone->output = (uint8_t)(tone->dutyCycle & 0x01u);
      tone->count -= (int32_t)period;
    }
  }

  chip->noiseCounter++;
  if ((uint32_t)chip->noiseCounter >= zxnextPsgNoisePeriod(chip)) {
    chip->noiseCounter = 0;
    chip->noisePrescale ^= 1u;
    if (chip->noisePrescale == 0u) {
      zxnextPsgNoiseRngTick(chip);
    }
  }

  for (uint32_t channel = 0u; channel < 3u; channel++) {
    chip->volEnabled[channel] =
      (uint8_t)((chip->tone[channel].output | zxnextPsgToneDisabled(chip, channel)) &
        ((chip->noiseRng & 0x01u) | zxnextPsgNoiseDisabled(chip, channel)));
  }

  if (chip->envelope.holding == 0u) {
    uint32_t period = chip->envelope.period == 0u ? 1u : chip->envelope.period;
    chip->envelope.count++;
    if ((uint32_t)chip->envelope.count >= period) {
      chip->envelope.count = 0;
      chip->envelope.step--;
      if (chip->envelope.step < 0) {
        if (chip->envelope.hold) {
          if (chip->envelope.alternate) {
            chip->envelope.attack ^= 0x1fu;
          }
          chip->envelope.holding = 1u;
          chip->envelope.step = 0;
        } else {
          if (chip->envelope.alternate && (chip->envelope.step & 0x20)) {
            chip->envelope.attack ^= 0x1fu;
          }
          chip->envelope.step &= 0x1f;
        }
      }
    }
  }
  chip->envelope.volume = (uint8_t)(chip->envelope.step ^ chip->envelope.attack);

  zxnextPsgUpdateOutputs(chip);
}

static void zxnextPsgGenerateAllOutput(void) {
  for (uint32_t chip = 0u; chip < 3u; chip++) {
    zxnextPsgGenerateOutput(chip);
  }
  zxnextPsgRefreshCurrentStereoOutput();
}

static void zxnextPsgAccumulateCurrentOutputUntil(double frameTact28) {
  if (frameTact28 <= zxnextPsgLastAccumulationFrameTact) {
    return;
  }

  const double duration = frameTact28 - zxnextPsgLastAccumulationFrameTact;
  zxnextPsgAccumulatedLeft += (double)zxnextPsgCurrentLeft * duration;
  zxnextPsgAccumulatedRight += (double)zxnextPsgCurrentRight * duration;
  zxnextPsgAccumulatedTacts += duration;
  zxnextPsgLastAccumulationFrameTact = frameTact28;
}

static void zxnextPsgAdvanceToFrameTact(double frameTact28) {
  if (frameTact28 < zxnextPsgLastAccumulationFrameTact) {
    zxnextPsgResetAudioWindow();
  }

  while (zxnextPsgNextClockFrameTact <= frameTact28) {
    zxnextPsgAccumulateCurrentOutputUntil(zxnextPsgNextClockFrameTact);
    zxnextPsgGenerateAllOutput();
    zxnextPsgNextClockFrameTact += 128.0;
  }

  zxnextPsgAccumulateCurrentOutputUntil(frameTact28);
}

static void zxnextPsgCalculateCurrentAudioValue(uint32_t frameTact28) {
  zxnextPsgAdvanceToFrameTact((double)frameTact28);
}

static void zxnextPsgPrepareAudioSample(double sampleEndFrameTact28) {
  zxnextPsgAdvanceToFrameTact(sampleEndFrameTact28);

  if (zxnextPsgAccumulatedTacts > 0.0) {
    double left = zxnextPsgAccumulatedLeft / zxnextPsgAccumulatedTacts;
    double right = zxnextPsgAccumulatedRight / zxnextPsgAccumulatedTacts;
    zxnextPsgSampleLeft = (uint32_t)(left >= 0.0 ? left + 0.5 : 0.0);
    zxnextPsgSampleRight = (uint32_t)(right >= 0.0 ? right + 0.5 : 0.0);
  } else {
    zxnextPsgSampleLeft = zxnextPsgCurrentLeft;
    zxnextPsgSampleRight = zxnextPsgCurrentRight;
  }

  zxnextPsgAccumulatedLeft = 0.0;
  zxnextPsgAccumulatedRight = 0.0;
  zxnextPsgAccumulatedTacts = 0.0;
}

static uint32_t zxnextPsgGetSelectedChip(void) { return zxnextPsgSelectedChip; }
static uint32_t zxnextPsgGetTurbosoundEnabled(void) { return zxnextPsgTurbosoundEnabled; }
static uint32_t zxnextPsgGetSelectedRegister(void) {
  return zxnextPsgChips[zxnextPsgSelectedChip].selectedReg;
}
static uint32_t zxnextPsgGetChipPanning(uint32_t chip) { return zxnextPsgChipPanning[chip % 3u]; }
static uint32_t zxnextPsgGetChipMonoMode(uint32_t chip) { return zxnextPsgChipMonoMode[chip % 3u]; }
static uint32_t zxnextPsgGetRegister(uint32_t chip, uint32_t reg) {
  return zxnextPsgChips[chip % 3u].regs[reg & 0x0fu];
}
static uint32_t zxnextPsgGetOutputA(uint32_t chip) { return zxnextPsgChips[chip % 3u].currentOutput[0]; }
static uint32_t zxnextPsgGetOutputB(uint32_t chip) { return zxnextPsgChips[chip % 3u].currentOutput[1]; }
static uint32_t zxnextPsgGetOutputC(uint32_t chip) { return zxnextPsgChips[chip % 3u].currentOutput[2]; }

static uint32_t zxnextPsgGetStereoLeft(uint32_t chipId) {
  uint32_t id = chipId % 3u;
  uint32_t a = zxnextPsgChips[id].currentOutput[0];
  uint32_t b = zxnextPsgChips[id].currentOutput[1];
  uint32_t c = zxnextPsgChips[id].currentOutput[2];
  uint32_t left = zxnextPsgChipMonoMode[id] ? a + b + c : (zxnextPsgAyStereoMode ? a + c : a + b);
  uint8_t pan = zxnextPsgChipPanning[id];
  return pan == 0u || pan == 1u ? 0u : left;
}

static uint32_t zxnextPsgGetStereoRight(uint32_t chipId) {
  uint32_t id = chipId % 3u;
  uint32_t a = zxnextPsgChips[id].currentOutput[0];
  uint32_t b = zxnextPsgChips[id].currentOutput[1];
  uint32_t c = zxnextPsgChips[id].currentOutput[2];
  uint32_t right = zxnextPsgChipMonoMode[id] ? a + b + c : b + c;
  uint8_t pan = zxnextPsgChipPanning[id];
  return pan == 0u || pan == 2u ? 0u : right;
}

static void zxnextPsgRefreshCurrentStereoOutput(void) {
  uint32_t psgLeft = 0u;
  uint32_t psgRight = 0u;

  for (uint32_t chip = 0u; chip < 3u; chip++) {
    if (zxnextPsgGetTurbosoundEnabled() || chip == zxnextPsgGetSelectedChip()) {
      psgLeft += zxnextPsgGetStereoLeft(chip);
      psgRight += zxnextPsgGetStereoRight(chip);
    }
  }

  zxnextPsgCurrentLeft = psgLeft;
  zxnextPsgCurrentRight = psgRight;
}

static uint32_t zxnextPsgGetSampleLeft(void) { return zxnextPsgSampleLeft; }
static uint32_t zxnextPsgGetSampleRight(void) { return zxnextPsgSampleRight; }

static uint32_t zxnextPsgGetNoiseRng(uint32_t chip) { return zxnextPsgChips[chip % 3u].noiseRng; }
static uint32_t zxnextPsgGetEnvelopeStep(uint32_t chip) { return (uint32_t)zxnextPsgChips[chip % 3u].envelope.step; }
