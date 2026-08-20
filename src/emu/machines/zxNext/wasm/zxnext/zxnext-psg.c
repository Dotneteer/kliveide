#include "zxnext-psg.h"

static const uint8_t zxnextPsgReadMasks[16] = {
  0xffu, 0x0fu, 0xffu, 0x0fu, 0xffu, 0x0fu, 0x1fu, 0xffu,
  0x1fu, 0x1fu, 0x1fu, 0xffu, 0xffu, 0x0fu, 0xffu, 0xffu
};

static const uint32_t zxnextPsgVolumeTable[32] = {
  0u, 257u, 257u, 514u, 514u, 771u, 771u, 1028u,
  1542u, 1799u, 2313u, 2570u, 3084u, 3598u, 4369u, 4883u,
  5911u, 6939u, 8224u, 9509u, 11308u, 13621u, 15934u, 18247u,
  21588u, 26214u, 30583u, 34952u, 41377u, 49344u, 57568u, 65535u
};

typedef struct ZxNextPsgChip {
  uint8_t regs[16];
  uint8_t selectedReg;
  uint32_t noiseRng;
  uint8_t envelopeStep;
  uint8_t outputs[3];
  uint32_t currentOutput[3];
} ZxNextPsgChip;

static ZxNextPsgChip zxnextPsgChips[3];
static uint8_t zxnextPsgSelectedChip;
static uint8_t zxnextPsgTurbosoundEnabled;
static uint8_t zxnextPsgAyStereoMode;
static uint8_t zxnextPsgChipPanning[3];
static uint8_t zxnextPsgChipMonoMode[3];

static void zxnextPsgResetChip(uint32_t chip) {
  ZxNextPsgChip *state = &zxnextPsgChips[chip % 3u];
  for (uint32_t i = 0u; i < 16u; i++) state->regs[i] = 0u;
  state->regs[7] = 0xffu;
  state->selectedReg = 0u;
  state->noiseRng = 1u;
  state->envelopeStep = 0u;
  for (uint32_t i = 0u; i < 3u; i++) {
    state->outputs[i] = 0u;
    state->currentOutput[i] = 0u;
  }
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
}

static void zxnextPsgSetTurbosoundEnabled(uint32_t enabled) {
  zxnextPsgTurbosoundEnabled = enabled != 0u;
}

static void zxnextPsgSetAyStereoMode(uint32_t enabled) {
  zxnextPsgAyStereoMode = enabled != 0u;
}

static void zxnextPsgSetChipMonoMode(uint32_t chip, uint32_t enabled) {
  zxnextPsgChipMonoMode[chip % 3u] = enabled != 0u;
}

static void zxnextPsgSetRegisterIndex(uint32_t value) {
  uint8_t byteValue = (uint8_t)value;
  if ((byteValue & 0x80u) != 0u && (byteValue & 0x1cu) == 0x1cu) {
    if (zxnextPsgTurbosoundEnabled) {
      uint8_t chipSelect = byteValue & 0x03u;
      if (chipSelect == 0x02u) zxnextPsgSelectedChip = 1u;
      else if (chipSelect == 0x01u) zxnextPsgSelectedChip = 2u;
      else zxnextPsgSelectedChip = 0u;
      zxnextPsgChipPanning[zxnextPsgSelectedChip] = (byteValue >> 5u) & 0x03u;
    }
  } else if ((byteValue & 0xe0u) == 0u) {
    zxnextPsgChips[zxnextPsgSelectedChip].selectedReg = byteValue & 0x0fu;
  }
}

static void zxnextPsgWriteRegisterValue(uint32_t value) {
  ZxNextPsgChip *chip = &zxnextPsgChips[zxnextPsgSelectedChip];
  uint8_t index = chip->selectedReg & 0x0fu;
  chip->regs[index] = (uint8_t)value;
  if (index == 0x0du) chip->envelopeStep = 31u;
}

static uint32_t zxnextPsgReadRegisterValue(void) {
  ZxNextPsgChip *chip = &zxnextPsgChips[zxnextPsgSelectedChip];
  uint8_t index = chip->selectedReg & 0x0fu;
  return chip->regs[index];
}

static void zxnextPsgGenerateOutput(uint32_t chipId) {
  ZxNextPsgChip *chip = &zxnextPsgChips[chipId % 3u];
  chip->noiseRng = (chip->noiseRng >> 1u) |
    (((chip->noiseRng & 0x01u) ^ ((chip->noiseRng >> 3u) & 0x01u)) << 16u);
  if (chip->envelopeStep > 0u) chip->envelopeStep--;
  uint8_t enable = chip->regs[7];
  for (uint32_t channel = 0u; channel < 3u; channel++) {
    uint8_t toneDisabled = (enable & (1u << channel)) != 0u;
    uint8_t noiseDisabled = (enable & (1u << (channel + 3u))) != 0u;
    uint8_t audible = toneDisabled || noiseDisabled || ((chip->noiseRng & 0x01u) != 0u);
    uint8_t volume = chip->regs[8u + channel] & 0x1fu;
    chip->outputs[channel] = audible;
    chip->currentOutput[channel] = audible ? zxnextPsgVolumeTable[volume] : 0u;
  }
}

static uint32_t zxnextPsgGetSelectedChip(void) { return zxnextPsgSelectedChip; }
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

static uint32_t zxnextPsgGetNoiseRng(uint32_t chip) { return zxnextPsgChips[chip % 3u].noiseRng; }
static uint32_t zxnextPsgGetEnvelopeStep(uint32_t chip) { return zxnextPsgChips[chip % 3u].envelopeStep; }
