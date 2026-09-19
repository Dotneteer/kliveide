#include "zxnext-dac.h"
#include "zxnext-expansion.h"

static uint8_t zxnextDacChannels[4];
/* zxnext.vhd ~6382: the soundrive module's reset is `reset or not nr_08_dac_en`, so while NextReg $08
   bit 3 is 0 every channel is held at the silent centre ($80) and writes are ignored. */
static uint8_t zxnextDacEnabled;

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

static void zxnextDacSetEnabled(uint32_t enabled) {
  zxnextDacEnabled = enabled != 0u;
  if (!zxnextDacEnabled) zxnextDacReset();
}

static void zxnextDacSetNextReg(uint32_t reg, uint32_t value) {
  uint8_t byteValue = (uint8_t)value;
  if (!zxnextDacEnabled) return;
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

/* zxnext.vhd ~5952-5961: $2C/$2E read bits 9-2 of the Pi I2S sample and $2D its latched bits 1-0 - not
   the DACs. With I2S off the sample is "10" & X"00" (~2314): $80, $80 and $00. */
static uint32_t zxnextDacGetNextReg(uint32_t reg) {
  switch (reg & 0xffu) {
    case 0x2cu: return 0x80u;
    case 0x2du: return 0x00u;
    case 0x2eu: return 0x80u;
    default: return 0xffu;
  }
}

/* internal_port_enable bit n: $82 + n / 8, bit n % 8 (zxnext.vhd ~2348) */
static inline uint32_t zxnextDacPortEnabled(uint32_t bit) {
  return zxnextExpansionPortEnabled(bit);
}

/*
 * The DAC port decode (zxnext.vhd ~2378-2395): the full low byte, one enable bit per port family -
 * 17 Soundrive 1 ($1F $0F $4F $5F), 18 Soundrive 2 ($F1 $F3 $F9 $FB), 19 Profi Covox ($3F $5F),
 * 20 Covox ($0F $4F), 21 Pentagon mono ($FB, only with bit 18 off), 22 GS Covox ($B3), 23 Specdrum
 * ($DF). Writes need $08 bit 3 (`dac_hw_en`).
 */
static void zxnextDacWritePort(uint32_t port, uint32_t value) {
  uint8_t byteValue = (uint8_t)value;
  if (!zxnextDacEnabled) return;
  uint32_t lsb = port & 0x00ffu;
  uint32_t sd1 = zxnextDacPortEnabled(17u);
  uint32_t sd2 = zxnextDacPortEnabled(18u);
  uint32_t profi = zxnextDacPortEnabled(19u);
  uint32_t covox = zxnextDacPortEnabled(20u);
  uint32_t monoAD = (lsb == 0xfbu && zxnextDacPortEnabled(21u) && !sd2) || (lsb == 0xdfu && zxnextDacPortEnabled(23u));
  uint32_t monoBC = lsb == 0xb3u && zxnextDacPortEnabled(22u);
  if (monoAD || (lsb == 0x1fu && sd1) || (lsb == 0xf1u && sd2) || (lsb == 0x3fu && profi)) zxnextDacChannels[0] = byteValue;
  if (monoBC || (lsb == 0x0fu && (sd1 || covox)) || (lsb == 0xf3u && sd2)) zxnextDacChannels[1] = byteValue;
  if (monoBC || (lsb == 0x4fu && (sd1 || covox)) || (lsb == 0xf9u && sd2)) zxnextDacChannels[2] = byteValue;
  if (monoAD || (lsb == 0x5fu && (sd1 || profi)) || (lsb == 0xfbu && sd2)) zxnextDacChannels[3] = byteValue;
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
