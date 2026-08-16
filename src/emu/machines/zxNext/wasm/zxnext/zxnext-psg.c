#include "zxnext.h"

static const uint8_t psgWriteMasks[16] = {
  0xffu, 0x0fu, 0xffu, 0x0fu, 0xffu, 0x0fu, 0x1fu, 0x3fu,
  0x1fu, 0x1fu, 0x1fu, 0xffu, 0xffu, 0xffu, 0xffu, 0xffu
};

static void resetPsgState(void) {
  for (uint32_t chip = 0; chip < 3u; chip++) {
    for (uint32_t reg = 0; reg < 16u; reg++) psgRegisters[chip][reg] = 0u;
    psgRegisterIndex[chip] = 0u;
    psgPanning[chip] = 0x03u;
  }
  psgSelectedChip = 0u;
}

static uint32_t isAyRegPort(uint16_t port) {
  return port == 0xfffdu;
}

static uint32_t isAyDataPort(uint16_t port) {
  return port == 0xbffdu;
}

static uint32_t isAyInfoPort(uint16_t port) {
  return port == 0xbff5u;
}

static uint32_t selectedPsgRegister(void) {
  return psgRegisterIndex[psgSelectedChip] & 0x1fu;
}

static uint32_t psgChipIdFromSelect(uint32_t value) {
  const uint32_t chipSelect = value & 0x03u;
  if (chipSelect == 0x02u) return 1u;
  if (chipSelect == 0x01u) return 2u;
  return 0u;
}

static void psgWriteRegister(uint32_t value) {
  const uint32_t reg = selectedPsgRegister();
  if (reg >= 16u) return;
  psgRegisters[psgSelectedChip][reg] = (uint8_t)(value & psgWriteMasks[reg]);
}

static uint32_t psgReadRegister(void) {
  const uint32_t reg = selectedPsgRegister();
  if (reg >= 16u) return 0xffu;
  return psgRegisters[psgSelectedChip][reg] & psgWriteMasks[reg];
}

static uint32_t zxnextReadAyPort(uint32_t address) {
  const uint16_t port = (uint16_t)(address & 0xffffu);
  if (isAyRegPort(port) != 0u) {
    return isPortGroupEnabled(2, 0) != 0u ? 0xffu : 0xffu;
  }
  if (isAyInfoPort(port) != 0u) {
    if (isPortGroupEnabled(2, 0) == 0u) return 0xffu;
    const uint32_t ayId = psgSelectedChip == 0u ? 3u : psgSelectedChip == 1u ? 2u : 1u;
    return (ayId << 6u) | selectedPsgRegister();
  }
  if (isAyDataPort(port) != 0u) {
    return isPortGroupEnabled(2, 0) != 0u ? psgReadRegister() : 0xffu;
  }
  return 0xffffffffu;
}

static uint32_t zxnextWriteAyPort(uint32_t address, uint32_t value) {
  const uint16_t port = (uint16_t)(address & 0xffffu);
  const uint8_t byteValue = (uint8_t)(value & 0xffu);
  if (isAyRegPort(port) != 0u) {
    if (isPortGroupEnabled(2, 0) != 0u) {
      if ((byteValue & 0x9cu) == 0x9cu) {
        if (audioEnableTurbosound != 0u) {
          psgSelectedChip = (uint8_t)psgChipIdFromSelect(byteValue);
          psgPanning[psgSelectedChip] = (byteValue >> 5u) & 0x03u;
        }
      } else if ((byteValue & 0xe0u) == 0u) {
        psgRegisterIndex[psgSelectedChip] = byteValue & 0x1fu;
      }
    }
    return 1u;
  }
  if (isAyDataPort(port) != 0u || isAyInfoPort(port) != 0u) {
    if (isPortGroupEnabled(2, 0) != 0u) psgWriteRegister(byteValue);
    return 1u;
  }
  return 0u;
}

static uint32_t psgChannelLevel(uint32_t chip, uint32_t channel) {
  const uint32_t reg = 8u + channel;
  const uint32_t volume = psgRegisters[chip][reg] & 0x0fu;
  return volume * 4096u;
}

static void psgChipStereo(uint32_t chip, uint32_t *left, uint32_t *right) {
  const uint32_t a = psgChannelLevel(chip, 0);
  const uint32_t b = psgChannelLevel(chip, 1);
  const uint32_t c = psgChannelLevel(chip, 2);
  if (audioAyMonoEnable[chip] != 0u) {
    *left = a + b + c;
    *right = *left;
  } else if (audioAyStereoMode != 0u) {
    *left = a + c;
    *right = b + c;
  } else {
    *left = a + b;
    *right = b + c;
  }

  switch (psgPanning[chip] & 0x03u) {
    case 0x00:
      *left = 0u;
      *right = 0u;
      break;
    case 0x01:
      *left = 0u;
      break;
    case 0x02:
      *right = 0u;
      break;
    default:
      break;
  }
}

static void psgMixerTotals(uint32_t *left, uint32_t *right) {
  *left = 0u;
  *right = 0u;
  for (uint32_t chip = 0; chip < 3u; chip++) {
    if (audioEnableTurbosound == 0u && chip != psgSelectedChip) continue;
    uint32_t chipLeft = 0u;
    uint32_t chipRight = 0u;
    psgChipStereo(chip, &chipLeft, &chipRight);
    *left += chipLeft;
    *right += chipRight;
  }
}

static uint32_t zxnextPsgMixerLeft(void) {
  uint32_t left = 0u;
  uint32_t right = 0u;
  psgMixerTotals(&left, &right);
  return left;
}

static uint32_t zxnextPsgMixerRight(void) {
  uint32_t left = 0u;
  uint32_t right = 0u;
  psgMixerTotals(&left, &right);
  return right;
}

uint32_t zxnextGetPsgSelectedChip(void) { return psgSelectedChip; }
uint32_t zxnextGetPsgSelectedRegister(void) { return selectedPsgRegister(); }
uint32_t zxnextGetPsgRegister(uint32_t chip, uint32_t reg) {
  if (chip >= 3u || reg >= 16u) return 0xffu;
  return psgRegisters[chip][reg];
}
uint32_t zxnextGetPsgPanning(uint32_t chip) { return chip < 3u ? psgPanning[chip] : 0xffu; }
uint32_t zxnextGetPsgMixerLeft(void) { return zxnextPsgMixerLeft(); }
uint32_t zxnextGetPsgMixerRight(void) { return zxnextPsgMixerRight(); }
