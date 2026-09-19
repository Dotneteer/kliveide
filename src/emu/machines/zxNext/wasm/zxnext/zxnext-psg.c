#include "zxnext-psg.h"

/*
 * The three PSGs of TurboSound Next, following `_input/next-fpga/src/audio/ym2149.vhd` (I_SEL_L = '1')
 * and turbosound.vhd; mirrors `NextPsgChip` / `TurboSoundDevice` of the TypeScript core.
 *
 * One `zxnextPsgTick` is one `ena_div` pulse: the 1.75 MHz PSG enable divided by 8, every 128 master
 * clocks. Tone, noise and envelope counters compare with period - 1 (0 for periods 0/1); the noise LFSR
 * steps on every other tick (poly17, feedback bit 0 xor bit 2); an R13 write reloads the envelope and
 * steps it once at once. Levels go through `volTableYm` (5-bit) or, in AY mode ($06 bit 0),
 * `volTableAy` (level bits 4-1), scaled by 257 to the 16-bit range the mixer expects.
 */
static const uint32_t zxnextPsgVolumeTableYm[32] = {
  0u, 257u, 257u, 514u, 514u, 771u, 771u, 1028u,
  1542u, 1799u, 2313u, 2570u, 3084u, 3598u, 4369u, 4883u,
  5911u, 6939u, 8224u, 9509u, 11308u, 13621u, 15934u, 18247u,
  21588u, 26214u, 30583u, 34952u, 41377u, 49344u, 57568u, 65535u
};

static const uint32_t zxnextPsgVolumeTableAy[16] = {
  0u, 771u, 1028u, 1542u, 2570u, 3855u, 5397u, 8738u,
  10280u, 16705u, 23387u, 29298u, 37008u, 46517u, 55255u, 65535u
};

/* AY mode read masks (`reg(n)(7..k) and not ctrl_aymode`) */
static const uint8_t zxnextPsgAyReadMask[16] = {
  0xffu, 0x0fu, 0xffu, 0x0fu, 0xffu, 0x0fu, 0x1fu, 0xffu, 0x1fu, 0x1fu, 0x1fu, 0xffu, 0xffu, 0x0fu, 0xffu, 0xffu
};

typedef struct ZxNextPsgChip {
  uint8_t regs[16];
  uint8_t selectedReg;
  uint16_t toneCount[3];
  uint8_t toneOp[3];
  uint8_t noiseDiv;
  uint8_t noiseCount;
  uint32_t poly17;
  uint16_t envCount;
  uint8_t envVol;
  uint8_t envInc;
  uint8_t envHold;
  uint32_t currentOutput[3];
} ZxNextPsgChip;

static ZxNextPsgChip zxnextPsgChips[3];
static uint8_t zxnextPsgSelectedChip;
static uint8_t zxnextPsgTurbosoundEnabled;
static uint8_t zxnextPsgAyStereoMode;
static uint8_t zxnextPsgChipPanning[3];
static uint8_t zxnextPsgChipMonoMode[3];
/* NextReg $06 bits 1-0: bit 0 = `aymode_i`, 11 = every PSG held in reset (zxnext.vhd ~6325) */
static uint8_t zxnextPsgMode;
static double zxnextPsgNextClockFrameTact;
static double zxnextPsgLastAccumulationFrameTact;
static double zxnextPsgAccumulatedLeft;
static double zxnextPsgAccumulatedRight;
static double zxnextPsgAccumulatedTacts;
static uint32_t zxnextPsgCurrentLeft;
static uint32_t zxnextPsgCurrentRight;
static uint32_t zxnextPsgSampleLeft;
/* The sample's exact average (zxnextPsgSampleLeft/Right are it rounded, for the exports) */
static double zxnextPsgSampleLeftExact;
static double zxnextPsgSampleRightExact;
static uint32_t zxnextPsgSampleRight;

static void zxnextPsgRefreshCurrentStereoOutput(void);

static inline uint32_t zxnextPsgHeld(void) { return zxnextPsgMode == 0x03u; }
static inline uint32_t zxnextPsgAyMode(void) { return (zxnextPsgMode & 0x01u) != 0u; }

/* RESET_H: registers cleared (R7 = $FF), address 0, outputs silent */
static void zxnextPsgResetChipRegisters(uint32_t chip) {
  ZxNextPsgChip *state = &zxnextPsgChips[chip % 3u];
  for (uint32_t i = 0u; i < 16u; i++) state->regs[i] = 0u;
  state->regs[7] = 0xffu;
  state->selectedReg = 0u;
  for (uint32_t i = 0u; i < 3u; i++) state->currentOutput[i] = 0u;
}

static void zxnextPsgResetChip(uint32_t chip) {
  ZxNextPsgChip *state = &zxnextPsgChips[chip % 3u];
  zxnextPsgResetChipRegisters(chip);
  for (uint32_t i = 0u; i < 3u; i++) {
    state->toneCount[i] = 0u;
    state->toneOp[i] = 0u;
  }
  state->noiseDiv = 0u;
  state->noiseCount = 0u;
  state->poly17 = 0u;
  state->envCount = 0u;
  state->envVol = 0u;
  state->envInc = 0u;
  state->envHold = 0u;
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
  zxnextPsgMode = 0u; /* a soft reset restores it from the kept $06 (zxnextReset) */
  zxnextPsgCurrentLeft = 0u;
  zxnextPsgCurrentRight = 0u;
  zxnextPsgSampleLeft = 0u;
  zxnextPsgSampleLeftExact = 0.0;
  zxnextPsgSampleRightExact = 0.0;
  zxnextPsgSampleRight = 0u;
  zxnextPsgResetAudioWindow();
}

/* The PSG clock (ym2149 `ena_div`, every 128 master clocks from a free-running divider) runs on across
   frames: a frame is not a whole number of PSG ticks (567264 = 4431 x 128 + 96 in +3 timing), so
   restarting it each frame shifted its phase by up to a tick and dropped the frame's last part-tick.
   Mirrors TurboSoundDevice.onNewFrame / advancePsgToFrameTact. */
static void zxnextPsgBeginFrame(void) {
  zxnextPsgRefreshCurrentStereoOutput();
}

static void zxnextPsgUpdateOutputs(ZxNextPsgChip *chip);

/* NextReg $06 bits 1-0. Entering mode 11 resets the PSGs and turbosound.vhd's selection and pans. */
static void zxnextPsgSetMode(uint32_t mode) {
  zxnextPsgAdvanceToFrameTact((double)frameTacts28);
  zxnextPsgMode = (uint8_t)(mode & 0x03u);
  if (zxnextPsgHeld()) {
    for (uint32_t chip = 0u; chip < 3u; chip++) {
      zxnextPsgResetChipRegisters(chip);
      zxnextPsgChipPanning[chip] = 0x03u;
    }
    zxnextPsgSelectedChip = 0u;
  } else {
    for (uint32_t chip = 0u; chip < 3u; chip++) zxnextPsgUpdateOutputs(&zxnextPsgChips[chip]);
  }
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

/* ym2149.vhd p_envelope_shape, one `env_ena` event */
static void zxnextPsgStepEnvelope(ZxNextPsgChip *chip) {
  uint32_t shape = chip->regs[13];
  uint32_t vol = chip->envVol;
  uint32_t isZero = (vol >> 1) == 0u;
  uint32_t isOnes = (vol >> 1) == 15u;
  uint32_t isBot = isZero && (vol & 1u) == 0u;
  uint32_t isBotP1 = isZero && (vol & 1u) == 1u;
  uint32_t isTopM1 = isOnes && (vol & 1u) == 0u;
  uint32_t isTop = isOnes && (vol & 1u) == 1u;
  uint8_t hold = chip->envHold;
  uint8_t inc = chip->envInc;
  if (!chip->envHold) chip->envVol = (uint8_t)((chip->envInc ? vol + 1u : vol + 31u) & 31u);
  if ((shape & 0x08u) == 0u) {
    if (!inc ? isBotP1 : isTop) hold = 1u;
  } else if ((shape & 0x01u) != 0u) {
    if (!inc) {
      if ((shape & 0x02u) ? isBot : isBotP1) hold = 1u;
    } else if ((shape & 0x02u) ? isTop : isTopM1) {
      hold = 1u;
    }
  } else if ((shape & 0x02u) != 0u) {
    if (!inc) {
      if (isBotP1) hold = 1u;
      if (isBot) {
        hold = 0u;
        inc = 1u;
      }
    } else {
      if (isTopM1) hold = 1u;
      if (isTop) {
        hold = 0u;
        inc = 0u;
      }
    }
  }
  chip->envHold = hold;
  chip->envInc = inc;
}

static uint32_t zxnextPsgChannelLevel(ZxNextPsgChip *chip, uint32_t channel) {
  uint32_t r7 = chip->regs[7];
  uint32_t mixed = (((r7 >> channel) & 1u) | chip->toneOp[channel]) &
    (((r7 >> (channel + 3u)) & 1u) | (chip->poly17 & 1u));
  if (!mixed) return 0u;
  uint32_t vol = chip->regs[8u + channel];
  if ((vol & 0x10u) != 0u) return chip->envVol;
  return (vol & 0x0fu) != 0u ? ((vol & 0x0fu) << 1) | 1u : 0u;
}

static void zxnextPsgUpdateOutputs(ZxNextPsgChip *chip) {
  for (uint32_t channel = 0u; channel < 3u; channel++) {
    uint32_t level = zxnextPsgChannelLevel(chip, channel);
    chip->currentOutput[channel] = zxnextPsgHeld() ? 0u
      : zxnextPsgAyMode() ? zxnextPsgVolumeTableAy[level >> 1] : zxnextPsgVolumeTableYm[level & 0x1fu];
  }
}

static void zxnextPsgWriteRegister(ZxNextPsgChip *chip, uint32_t reg, uint32_t value) {
  uint8_t index = (uint8_t)(reg & 0x0fu);
  chip->regs[index] = (uint8_t)value;
  if (index == 13u) {
    /* env_reset: the start state, then env_ena = '1' steps it at once */
    chip->envCount = 0u;
    chip->envVol = (chip->regs[13] & 0x04u) != 0u ? 0u : 31u;
    chip->envInc = (chip->regs[13] & 0x04u) != 0u ? 1u : 0u;
    chip->envHold = 0u;
    zxnextPsgStepEnvelope(chip);
  }
  zxnextPsgUpdateOutputs(chip);
}

static void zxnextPsgSetRegisterIndex(uint32_t value) {
  uint8_t byteValue = (uint8_t)value;
  zxnextPsgAdvanceToFrameTact((double)frameTacts28);
  if (zxnextPsgHeld()) return;
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
    /* ym2149.vhd ~173: the register address is 5 bits (bits 7-5 = 000 checked in turbosound.vhd ~140) */
    zxnextPsgChips[zxnextPsgSelectedChip].selectedReg = byteValue & 0x1fu;
  }
}

static void zxnextPsgWriteRegisterValue(uint32_t value) {
  ZxNextPsgChip *chip = &zxnextPsgChips[zxnextPsgSelectedChip];
  /* ym2149.vhd ~188: registers 16-31 do not exist; the write is dropped */
  if ((chip->selectedReg & 0x10u) != 0u || zxnextPsgHeld()) return;
  zxnextPsgAdvanceToFrameTact((double)frameTacts28);
  zxnextPsgWriteRegister(chip, chip->selectedReg, value);
  zxnextPsgRefreshCurrentStereoOutput();
}

static uint32_t zxnextPsgReadRegisterValue(void) {
  ZxNextPsgChip *chip = &zxnextPsgChips[zxnextPsgSelectedChip];
  /* ym2149.vhd ~222: registers 16-31 read $FF in YM mode, register n & 15 in AY mode */
  if ((chip->selectedReg & 0x10u) != 0u && !zxnextPsgAyMode()) return 0xffu;
  uint8_t index = chip->selectedReg & 0x0fu;
  /* R14/R15: the pulled-up I/O port ($FF) while R7 bit 6/7 makes it an input */
  if (index == 14u) return (chip->regs[7] & 0x40u) != 0u ? chip->regs[14] : 0xffu;
  if (index == 15u) return (chip->regs[7] & 0x80u) != 0u ? chip->regs[15] : 0xffu;
  return zxnextPsgAyMode() ? (uint32_t)(chip->regs[index] & zxnextPsgAyReadMask[index]) : chip->regs[index];
}

/* One `ena_div` pulse */
static void zxnextPsgTick(ZxNextPsgChip *chip) {
  for (uint32_t channel = 0u; channel < 3u; channel++) {
    uint32_t freq = ((chip->regs[2u * channel + 1u] & 0x0fu) << 8) | chip->regs[2u * channel];
    uint32_t comp = (freq >> 1) != 0u ? freq - 1u : 0u;
    if (chip->toneCount[channel] >= comp) {
      chip->toneCount[channel] = 0u;
      chip->toneOp[channel] ^= 1u;
    } else {
      chip->toneCount[channel]++;
    }
  }

  uint8_t noiseTick = chip->noiseDiv;
  chip->noiseDiv ^= 1u;
  if (noiseTick) {
    uint32_t period = chip->regs[6] & 0x1fu;
    uint32_t comp = (period >> 1) != 0u ? period - 1u : 0u;
    if (chip->noiseCount >= comp) {
      uint32_t p = chip->poly17;
      uint32_t feedback = (p & 1u) ^ ((p >> 2) & 1u) ^ (p == 0u ? 1u : 0u);
      chip->noiseCount = 0u;
      chip->poly17 = (p >> 1) | (feedback << 16);
    } else {
      chip->noiseCount++;
    }
  }

  uint32_t envFreq = ((uint32_t)chip->regs[12] << 8) | chip->regs[11];
  uint32_t envComp = (envFreq >> 1) != 0u ? envFreq - 1u : 0u;
  if (chip->envCount >= envComp) {
    chip->envCount = 0u;
    zxnextPsgStepEnvelope(chip);
  } else {
    chip->envCount++;
  }

  zxnextPsgUpdateOutputs(chip);
}

static void zxnextPsgGenerateOutput(uint32_t chipId) {
  if (zxnextPsgHeld()) return;
  zxnextPsgTick(&zxnextPsgChips[chipId % 3u]);
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

/* The frame counter wraps: move the PSG clock and its sample window back a frame so they carry on
   (see zxnextPsgBeginFrame). Nothing is advanced here: a sample whose boundary lies before the frame
   end may still be open, and the mixer closes it at that boundary (TurboSoundDevice.followFrameWrap). */
static void zxnextPsgOnFrameWrap(uint32_t frameLength28) {
  zxnextPsgNextClockFrameTact -= (double)frameLength28;
  zxnextPsgLastAccumulationFrameTact -= (double)frameLength28;
}

static void zxnextPsgCalculateCurrentAudioValue(uint32_t frameTact28) {
  zxnextPsgAdvanceToFrameTact((double)frameTact28);
}

static void zxnextPsgPrepareAudioSample(double sampleEndFrameTact28) {
  zxnextPsgAdvanceToFrameTact(sampleEndFrameTact28);

  if (zxnextPsgAccumulatedTacts > 0.0) {
    double left = zxnextPsgAccumulatedLeft / zxnextPsgAccumulatedTacts;
    double right = zxnextPsgAccumulatedRight / zxnextPsgAccumulatedTacts;
    zxnextPsgSampleLeftExact = left;
    zxnextPsgSampleRightExact = right;
    zxnextPsgSampleLeft = (uint32_t)(left >= 0.0 ? left + 0.5 : 0.0);
    zxnextPsgSampleRight = (uint32_t)(right >= 0.0 ? right + 0.5 : 0.0);
  } else {
    zxnextPsgSampleLeftExact = (double)zxnextPsgCurrentLeft;
    zxnextPsgSampleRightExact = (double)zxnextPsgCurrentRight;
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
static double zxnextPsgGetSampleLeftExact(void) { return zxnextPsgSampleLeftExact; }
static double zxnextPsgGetSampleRightExact(void) { return zxnextPsgSampleRightExact; }
static uint32_t zxnextPsgGetSampleRight(void) { return zxnextPsgSampleRight; }

static uint32_t zxnextPsgGetNoiseRng(uint32_t chip) { return zxnextPsgChips[chip % 3u].poly17; }
static uint32_t zxnextPsgGetEnvelopeStep(uint32_t chip) { return zxnextPsgChips[chip % 3u].envVol; }
