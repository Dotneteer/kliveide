#include "zxnext-dac.h"

static uint8_t zxnextDacChannels[4];

static void zxnextDacReset(void) {
  zxnextDacChannels[0] = 0x80u;
  zxnextDacChannels[1] = 0x80u;
  zxnextDacChannels[2] = 0x80u;
  zxnextDacChannels[3] = 0x80u;
}

static uint32_t zxnextDacHandlesNextReg(uint32_t reg) {
  uint32_t normalized = reg & 0xffu;
  return normalized == 0x2cu || normalized == 0x2du || normalized == 0x2eu;
}

static void zxnextDacSetNextReg(uint32_t reg, uint32_t value) {
  uint8_t byteValue = (uint8_t)value;
  switch (reg & 0xffu) {
    case 0x2cu:
      zxnextDacChannels[1] = byteValue;
      break;
    case 0x2du:
      zxnextDacChannels[0] = byteValue;
      zxnextDacChannels[3] = byteValue;
      break;
    case 0x2eu:
      zxnextDacChannels[2] = byteValue;
      break;
    default:
      break;
  }
}

static uint32_t zxnextDacGetNextReg(uint32_t reg) {
  switch (reg & 0xffu) {
    case 0x2cu: return zxnextDacChannels[1];
    case 0x2du: return zxnextDacChannels[0];
    case 0x2eu: return zxnextDacChannels[2];
    default: return 0xffu;
  }
}

static void zxnextDacWritePort(uint32_t port, uint32_t value) {
  uint8_t byteValue = (uint8_t)value;
  switch (port & 0x00feu) {
    case 0x001eu:
    case 0x00f0u:
    case 0x003eu:
      zxnextDacChannels[0] = byteValue;
      break;
    case 0x000eu:
    case 0x00f2u:
      zxnextDacChannels[1] = byteValue;
      break;
    case 0x00deu:
    case 0x00fau:
      zxnextDacChannels[0] = byteValue;
      zxnextDacChannels[3] = byteValue;
      break;
    case 0x00b2u:
      zxnextDacChannels[1] = byteValue;
      zxnextDacChannels[2] = byteValue;
      break;
    case 0x004eu:
    case 0x00f8u:
      zxnextDacChannels[2] = byteValue;
      break;
    case 0x005eu:
      zxnextDacChannels[3] = byteValue;
      break;
    default:
      break;
  }
}

static uint32_t zxnextDacGetChannel(uint32_t channel) {
  return zxnextDacChannels[channel & 0x03u];
}

static uint32_t zxnextDacGetStereoLeft(void) {
  return (uint32_t)zxnextDacChannels[0] + (uint32_t)zxnextDacChannels[1];
}

static uint32_t zxnextDacGetStereoRight(void) {
  return (uint32_t)zxnextDacChannels[2] + (uint32_t)zxnextDacChannels[3];
}
