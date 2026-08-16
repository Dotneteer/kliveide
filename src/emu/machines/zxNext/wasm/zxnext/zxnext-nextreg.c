#include "zxnext.h"

static void setNextRegDefault(uint32_t reg, uint32_t value) {
  nextRegs[reg & 0xffu] = (uint8_t)(value & 0xffu);
}

static void resetNextRegs(uint32_t hard) {
  nextRegConfigMode = 0u;
  nextRegLastReadValue = 0xffu;
  if (hard != 0u) {
    for (uint32_t i = 0; i < ZXNEXT_NEXTREG_COUNT; i++) {
      nextRegs[i] = 0xffu;
      nextRegLastWrite[i] = 0;
      nextRegHasLastWrite[i] = 0;
    }
    nr02ResetType = 0x04u;
    interruptLastWasHardReset = 1u;
    interruptLastWasSoftReset = 0u;
    setCpuProgrammedSpeed(0u);
    setNextRegDefault(0x02, 0x02);
    setNextRegDefault(0x03, 0x03);
    setNextRegDefault(0x04, 0x03);
    setNextRegDefault(0x05, 0x41);
    setNextRegDefault(0x06, 0x80);
    setNextRegDefault(0x07, 0x00);
    setNextRegDefault(0x08, 0x1a);
    setNextRegDefault(0x09, 0x00);
    setNextRegDefault(0x0a, 0x01);
    setNextRegDefault(0x0b, 0x01);
    setNextRegDefault(0x0f, 0x02);
    setNextRegDefault(0x80, 0x00);
    setNextRegDefault(0x81, 0x00);
    setNextRegDefault(0x82, 0xff);
    setNextRegDefault(0x83, 0xff);
    setNextRegDefault(0x84, 0xff);
    setNextRegDefault(0x85, 0x0f);
    setNextRegDefault(0x86, 0xff);
    setNextRegDefault(0x87, 0xff);
    setNextRegDefault(0x88, 0xff);
    setNextRegDefault(0x89, 0x8f);
    setNextRegDefault(0x8a, 0x00);
    setNextRegDefault(0x8c, 0x00);
    setNextRegDefault(0xa2, 0x02);
    setNextRegDefault(0xc4, 0x01);
    internalPortEnables[0] = 0xffu;
    internalPortEnables[1] = 0xffu;
    internalPortEnables[2] = 0xffu;
    internalPortEnables[3] = 0x0fu;
    busPortEnables[0] = 0xffu;
    busPortEnables[1] = 0xffu;
    busPortEnables[2] = 0xffu;
    busPortEnables[3] = 0x8fu;
  } else {
    const uint32_t rt = nr02ResetType;
    nr02ResetType = (uint8_t)(((rt >> 1u) & 0x02u) | (((rt & 0x03u) != 0u) ? 0x01u : 0x00u));
    interruptLastWasHardReset = 0u;
    interruptLastWasSoftReset = 1u;
    setNextRegDefault(0x02, nr02ResetType != 0u ? 0x01u : 0x00u);
    setNextRegDefault(0x05, (nextRegs[0x05] & 0x05u) | 0x40u);
    setNextRegDefault(0x06, nextRegs[0x06] | 0xa0u);
    setNextRegDefault(0x80, ((nextRegs[0x80] & 0x0fu) << 4u) | (nextRegs[0x80] & 0x0fu));
    setNextRegDefault(0x8c, ((nextRegs[0x8c] & 0x0fu) << 4u) | (nextRegs[0x8c] & 0x0fu));
  }

  setNextRegDefault(0x00, 0x08);
  setNextRegDefault(0x01, 0x32);
  setNextRegDefault(0x0e, 0x00);
  setNextRegDefault(0x12, 0x08);
  setNextRegDefault(0x13, 0x0b);
  setNextRegDefault(0x14, 0xe3);
  setNextRegDefault(0x15, 0x00);
  setNextRegDefault(0x16, 0x00);
  setNextRegDefault(0x17, 0x00);
  setNextRegDefault(0x1c, 0x00);
  setNextRegDefault(0x1e, 0x00);
  setNextRegDefault(0x1f, 0x00);
  setNextRegDefault(0x22, 0x00);
  setNextRegDefault(0x23, 0x00);
  setNextRegDefault(0x32, 0x00);
  setNextRegDefault(0x33, 0x00);
  setNextRegDefault(0x42, 0x07);
  setNextRegDefault(0x43, 0x00);
  setNextRegDefault(0x4a, 0x00);
  setNextRegDefault(0x4b, 0xe3);
  setNextRegDefault(0x4c, 0x0f);
  setNextRegDefault(0x50, mmuRegs[0]);
  setNextRegDefault(0x51, mmuRegs[1]);
  setNextRegDefault(0x52, mmuRegs[2]);
  setNextRegDefault(0x53, mmuRegs[3]);
  setNextRegDefault(0x54, mmuRegs[4]);
  setNextRegDefault(0x55, mmuRegs[5]);
  setNextRegDefault(0x56, mmuRegs[6]);
  setNextRegDefault(0x57, mmuRegs[7]);
  setNextRegDefault(0x61, 0x00);
  setNextRegDefault(0x62, 0x00);
  setNextRegDefault(0x6b, 0x00);
  setNextRegDefault(0x70, 0x00);
  setNextRegDefault(0xa9, 0x05);
  setNextRegDefault(0xb8, 0x83);
  setNextRegDefault(0xb9, 0x01);
  setNextRegDefault(0xba, 0x00);
  setNextRegDefault(0xbb, 0xcd);
  syncDivMmcStateFromNextRegs();
  syncInputStateFromNextRegs();
  setCpuProgrammedSpeed(cpuProgrammedSpeed);
  rebuildFlatMemory();
}

static uint32_t isPortGroupEnabled(uint32_t regIndex, uint32_t bit) {
  if (regIndex >= 4u || bit >= 8u) return 1u;
  if (regIndex == 3u && bit >= 4u) return 1u;
  const uint32_t internal = internalPortEnables[regIndex] & (1u << bit);
  if (internal == 0u) return 0u;
  if ((nextRegs[0x80] & 0x80u) == 0u) return 1u;
  return (busPortEnables[regIndex] & (1u << bit)) != 0u;
}

uint32_t zxnextReadNextReg(uint32_t reg) {
  const uint32_t maskedReg = reg & 0xffu;
  const uint32_t interruptValue = interruptReadNextReg(maskedReg);
  if (interruptValue != 0xffffffffu) return interruptValue;
  const uint32_t paletteValue = paletteReadNextReg(maskedReg);
  if (paletteValue != 0xffffffffu) return paletteValue;
  const uint32_t layer2Value = layer2ReadNextReg(maskedReg);
  if (layer2Value != 0xffffffffu) return layer2Value;
  const uint32_t tilemapValue = tilemapReadNextReg(maskedReg);
  if (tilemapValue != 0xffffffffu) return tilemapValue;
  const uint32_t spritesValue = spritesReadNextReg(maskedReg);
  if (spritesValue != 0xffffffffu) return spritesValue;
  const uint32_t audioValue = audioReadNextReg(maskedReg);
  if (audioValue != 0xffffffffu) return audioValue;
  const uint32_t copperValue = copperReadNextReg(maskedReg);
  if (copperValue != 0xffffffffu) return copperValue;
  const uint32_t expansionValue = expansionReadNextReg(maskedReg);
  if (expansionValue != 0xffffffffu) return expansionValue;
  const uint32_t inputValue = inputReadNextReg(maskedReg);
  if (inputValue != 0xffffffffu) return inputValue;
  if (maskedReg >= 0x50u && maskedReg <= 0x57u) return mmuRegs[maskedReg - 0x50u];
  if (maskedReg == 0x07u) return (cpuProgrammedSpeed & 0x03u) | (cpuEffectiveSpeed << 4u);
  if (maskedReg == 0x69u) {
    const uint32_t shadowBit = useShadowScreen != 0u ? 0x40u : 0x00u;
    return (nextRegs[0x69u] & 0xbfu) | shadowBit;
  }
  if (maskedReg >= 0xb0u && maskedReg <= 0xb2u) return nextRegs[maskedReg];
  if (maskedReg >= 0x82u && maskedReg <= 0x85u) return internalPortEnables[maskedReg - 0x82u];
  if (maskedReg >= 0x86u && maskedReg <= 0x89u) return busPortEnables[maskedReg - 0x86u];
  nextRegLastReadValue = nextRegs[maskedReg];
  return nextRegs[maskedReg];
}

void zxnextWriteNextReg(uint32_t reg, uint32_t value) {
  writeNextRegInternal(reg, value);
}

static void writeNextRegInternal(uint32_t reg, uint32_t value) {
  const uint32_t maskedReg = reg & 0xffu;
  uint8_t byteValue = (uint8_t)(value & 0xffu);
  nextRegLastWrite[maskedReg] = byteValue;
  nextRegHasLastWrite[maskedReg] = 1u;
  if (maskedReg == 0x85u || maskedReg == 0x89u) byteValue &= 0x8fu;
  if (maskedReg == 0x8au) byteValue &= 0x3fu;
  nextRegs[maskedReg] = byteValue;
  if (interruptWriteNextReg(maskedReg, byteValue) != 0u) return;
  if (paletteWriteNextReg(maskedReg, byteValue) != 0u) return;
  const uint32_t layer2Handled = layer2WriteNextReg(maskedReg, byteValue);
  const uint32_t tilemapHandled = tilemapWriteNextReg(maskedReg, byteValue);
  const uint32_t spritesHandled = spritesWriteNextReg(maskedReg, byteValue);
  const uint32_t audioHandled = audioWriteNextReg(maskedReg, byteValue);
  const uint32_t copperHandled = copperWriteNextReg(maskedReg, byteValue);
  const uint32_t expansionHandled = expansionWriteNextReg(maskedReg, byteValue);
  if (
    layer2Handled != 0u ||
    tilemapHandled != 0u ||
    spritesHandled != 0u ||
    audioHandled != 0u ||
    copperHandled != 0u ||
    expansionHandled != 0u
  ) return;
  if (maskedReg >= 0x50u && maskedReg <= 0x57u) {
    mmuRegs[maskedReg - 0x50u] = byteValue;
    updateMemoryConfig(0);
    return;
  }
  if (maskedReg >= 0x82u && maskedReg <= 0x85u) {
    const uint8_t oldValue = internalPortEnables[maskedReg - 0x82u];
    internalPortEnables[maskedReg - 0x82u] = byteValue;
    if (maskedReg == 0x83u) {
      zxnextSetDivMmcEnabled(byteValue & 0x01u);
      if ((oldValue & 0x02u) != 0u && (byteValue & 0x02u) == 0u) resetMultifaceState();
    }
    return;
  }
  if (maskedReg >= 0x86u && maskedReg <= 0x89u) {
    busPortEnables[maskedReg - 0x86u] = byteValue;
    return;
  }
  if (maskedReg == 0x03u) {
    const uint32_t machineType = byteValue & 0x07u;
    if (machineType == 0x07u) {
      nextRegConfigMode = 1u;
    } else if (machineType != 0u) {
      nextRegConfigMode = 0u;
    }
  }
  if (maskedReg == 0x05u) {
    updateScreenTimingFromNextRegs();
    syncPeripheral1FromNextReg(byteValue);
  }
  if (maskedReg == 0x07u) {
    setCpuProgrammedSpeed(byteValue);
  }
  if (maskedReg == 0x09u) {
    divMmcResetMapramFlag = (byteValue & 0x08u) != 0u;
  }
  if (maskedReg == 0x0au) {
    syncPeripheral5FromNextReg(byteValue);
    syncPeripheral5InputFromNextReg(byteValue);
  }
  if (maskedReg == 0x0bu) {
    syncJoystickIoFromNextReg(byteValue);
  }
  if (maskedReg == 0x69u) {
    useShadowScreen = (byteValue & 0x40u) != 0u;
  }
  if (maskedReg == 0xb8u) {
    divMmcRstTrapEnabled = byteValue;
  }
  if (maskedReg == 0xb9u) {
    divMmcRstTrapOnlyWithRom3 = (uint8_t)(~byteValue);
  }
  if (maskedReg == 0xbau) {
    divMmcRstTrapInstant = byteValue;
  }
  if (maskedReg == 0xbbu) {
    divMmcEntry1 = byteValue;
  }
}

uint32_t zxnextGetNextRegIndex(void) { return nextRegIndex; }
void zxnextSetNextRegIndex(uint32_t reg) { nextRegIndex = (uint8_t)(reg & 0xffu); }
uint32_t zxnextReadNextRegData(void) { return zxnextReadNextReg(nextRegIndex); }
void zxnextWriteNextRegData(uint32_t value) { writeNextRegInternal(nextRegIndex, value); }
uint32_t zxnextGetNextRegLastReadValue(void) { return nextRegLastReadValue; }
uint32_t zxnextGetNextRegLastWrite(uint32_t reg) { return nextRegLastWrite[reg & 0xffu]; }
uint32_t zxnextGetNextRegHasLastWrite(uint32_t reg) { return nextRegHasLastWrite[reg & 0xffu]; }
uint32_t zxnextGetNextRegConfigMode(void) { return nextRegConfigMode; }
uint32_t zxnextIsPortGroupEnabled(uint32_t regIndex, uint32_t bit) { return isPortGroupEnabled(regIndex, bit); }
uint32_t zxnextGetInternalPortEnable(uint32_t regIndex) { return regIndex < 4u ? internalPortEnables[regIndex] : 0xffu; }
uint32_t zxnextGetBusPortEnable(uint32_t regIndex) { return regIndex < 4u ? busPortEnables[regIndex] : 0xffu; }
void zxnextNextRegHardReset(void) {
  resetMmuLayout();
  resetNextRegs(1);
  resetLayer2State();
  resetTilemapState();
  resetSpriteState();
  resetAudioState();
  resetCopperState();
  resetCtcState();
  updateScreenTimingFromNextRegs();
}
void zxnextNextRegReset(void) {
  resetMmuLayout();
  resetNextRegs(0);
  resetLayer2State();
  resetTilemapState();
  resetSpriteState();
  resetAudioState();
  resetCopperState();
  resetCtcState();
  updateScreenTimingFromNextRegs();
}
