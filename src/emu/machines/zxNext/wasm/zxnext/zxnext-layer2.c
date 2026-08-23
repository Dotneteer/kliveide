#include "zxnext-layer2.h"

static uint8_t zxnextLayer2Enabled;
static uint8_t zxnextLayer2ActiveRamBank;
static uint8_t zxnextLayer2ShadowRamBank;
static uint8_t zxnextLayer2UseShadowBank;
static uint8_t zxnextLayer2Bank;
static uint8_t zxnextLayer2BankOffset;
static uint8_t zxnextLayer2EnableMappingForReads;
static uint8_t zxnextLayer2EnableMappingForWrites;
static uint8_t zxnextLayer2Resolution;
static uint8_t zxnextLayer2PaletteOffset;
static uint16_t zxnextLayer2ScrollX;
static uint8_t zxnextLayer2ScrollY;
static uint8_t zxnextLayer2ClipWindow[4];
static uint8_t zxnextLayer2ClipIndex;

static uint8_t zxnextLoResEnabled;
static uint8_t zxnextLoResRadastanMode;
static uint8_t zxnextLoResRadastanTimexXor;
static uint8_t zxnextLoResPaletteOffset;
static uint8_t zxnextLoResScrollX;
static uint8_t zxnextLoResScrollY;

static void zxnextLayer2Reset(void) {
  zxnextLayer2Enabled = 0u;
  zxnextLayer2ActiveRamBank = 8u;
  zxnextLayer2ShadowRamBank = 11u;
  zxnextLayer2UseShadowBank = 0u;
  zxnextLayer2Bank = 0u;
  zxnextLayer2BankOffset = 0u;
  zxnextLayer2EnableMappingForReads = 0u;
  zxnextLayer2EnableMappingForWrites = 0u;
  zxnextLayer2Resolution = 0u;
  zxnextLayer2PaletteOffset = 0u;
  zxnextLayer2ScrollX = 0u;
  zxnextLayer2ScrollY = 0u;
  zxnextLayer2ClipWindow[0] = 0u;
  zxnextLayer2ClipWindow[1] = 255u;
  zxnextLayer2ClipWindow[2] = 0u;
  zxnextLayer2ClipWindow[3] = 191u;
  zxnextLayer2ClipIndex = 0u;

  zxnextLoResEnabled = 0u;
  zxnextLoResRadastanMode = 0u;
  zxnextLoResRadastanTimexXor = 0u;
  zxnextLoResPaletteOffset = 0u;
  zxnextLoResScrollX = 0u;
  zxnextLoResScrollY = 0u;
}

static void zxnextLayer2SetNextReg(uint32_t reg, uint32_t value) {
  uint8_t byteValue = (uint8_t)value;
  switch (reg & 0xffu) {
    case 0x12u:
      zxnextLayer2ActiveRamBank = byteValue & 0x7fu;
      break;
    case 0x13u:
      zxnextLayer2ShadowRamBank = byteValue & 0x7fu;
      break;
    case 0x15u:
      zxnextLoResEnabled = (byteValue & 0x80u) != 0u;
      break;
    case 0x16u:
      zxnextLayer2ScrollX = (zxnextLayer2ScrollX & 0x100u) | byteValue;
      break;
    case 0x17u:
      zxnextLayer2ScrollY = byteValue;
      break;
    case 0x18u:
      zxnextLayer2ClipWindow[zxnextLayer2ClipIndex] = byteValue;
      zxnextLayer2ClipIndex = (uint8_t)((zxnextLayer2ClipIndex + 1u) & 0x03u);
      break;
    case 0x32u:
      zxnextLoResScrollX = byteValue;
      break;
    case 0x33u:
      zxnextLoResScrollY = byteValue;
      break;
    case 0x6au:
      zxnextLoResRadastanMode = (byteValue & 0x20u) != 0u;
      zxnextLoResRadastanTimexXor = (byteValue & 0x10u) != 0u;
      zxnextLoResPaletteOffset = byteValue & 0x0fu;
      break;
    case 0x69u:
      zxnextLayer2Enabled = (byteValue & 0x80u) != 0u;
      break;
    case 0x70u:
      zxnextLayer2Resolution = (byteValue >> 4u) & 0x03u;
      zxnextLayer2PaletteOffset = byteValue & 0x0fu;
      break;
    case 0x71u:
      zxnextLayer2ScrollX = (zxnextLayer2ScrollX & 0x0ffu) | ((byteValue & 0x01u) << 8u);
      break;
    default:
      break;
  }
}

static uint32_t zxnextLayer2GetNextReg(uint32_t reg) {
  switch (reg & 0xffu) {
    case 0x12u: return zxnextLayer2ActiveRamBank;
    case 0x13u: return zxnextLayer2ShadowRamBank;
    case 0x15u: return zxnextLoResEnabled ? 0x80u : 0u;
    case 0x16u: return zxnextLayer2ScrollX & 0xffu;
    case 0x17u: return zxnextLayer2ScrollY;
    case 0x18u: return zxnextLayer2ClipWindow[zxnextLayer2ClipIndex];
    case 0x32u: return zxnextLoResScrollX;
    case 0x33u: return zxnextLoResScrollY;
    case 0x6au:
      return (zxnextLoResRadastanMode ? 0x20u : 0u) |
        (zxnextLoResRadastanTimexXor ? 0x10u : 0u) |
        zxnextLoResPaletteOffset;
    case 0x69u:
      return (zxnextLayer2Enabled ? 0x80u : 0u) |
        (zxnextNextRegs[0x69u] & 0x7fu);
    case 0x70u: return ((uint32_t)zxnextLayer2Resolution << 4u) | zxnextLayer2PaletteOffset;
    case 0x71u: return (zxnextLayer2ScrollX >> 8u) & 0x01u;
    default: return 0u;
  }
}

static void zxnextLayer2SetPort123B(uint32_t value) {
  uint8_t byteValue = (uint8_t)value;
  if ((byteValue & 0x10u) == 0u) {
    zxnextLayer2Bank = (byteValue >> 6u) & 0x03u;
    zxnextLayer2UseShadowBank = (byteValue & 0x08u) != 0u;
    zxnextLayer2EnableMappingForReads = (byteValue & 0x04u) != 0u;
    zxnextLayer2Enabled = (byteValue & 0x02u) != 0u;
    zxnextLayer2EnableMappingForWrites = (byteValue & 0x01u) != 0u;
  } else {
    zxnextLayer2BankOffset = byteValue & 0x07u;
  }
}

static uint32_t zxnextLayer2GetPort123B(void) {
  return ((uint32_t)zxnextLayer2Bank << 6u) |
    (zxnextLayer2UseShadowBank ? 0x08u : 0x00u) |
    (zxnextLayer2EnableMappingForReads ? 0x04u : 0x00u) |
    (zxnextLayer2Enabled ? 0x02u : 0x00u) |
    (zxnextLayer2EnableMappingForWrites ? 0x01u : 0x00u);
}

static void zxnextLayer2ResetClipIndex(void) { zxnextLayer2ClipIndex = 0u; }
static uint32_t zxnextLayer2GetClipIndex(void) { return zxnextLayer2ClipIndex; }
static void zxnextLayer2SetEnabled(uint32_t enabled) { zxnextLayer2Enabled = enabled != 0u; }
static uint32_t zxnextLayer2GetEnabled(void) { return zxnextLayer2Enabled; }
static uint32_t zxnextLayer2GetActiveRamBank(void) { return zxnextLayer2ActiveRamBank; }
static uint32_t zxnextLayer2GetShadowRamBank(void) { return zxnextLayer2ShadowRamBank; }
static uint32_t zxnextLayer2GetUseShadowBank(void) { return zxnextLayer2UseShadowBank; }
static uint32_t zxnextLayer2GetBank(void) { return zxnextLayer2Bank; }
static uint32_t zxnextLayer2GetBankOffset(void) { return zxnextLayer2BankOffset; }
static uint32_t zxnextLayer2GetEnableMappingForReads(void) { return zxnextLayer2EnableMappingForReads; }
static uint32_t zxnextLayer2GetEnableMappingForWrites(void) { return zxnextLayer2EnableMappingForWrites; }
static uint32_t zxnextLayer2GetResolution(void) { return zxnextLayer2Resolution; }
static uint32_t zxnextLayer2GetPaletteOffset(void) { return zxnextLayer2PaletteOffset; }
static uint32_t zxnextLayer2GetScrollX(void) { return zxnextLayer2ScrollX; }
static uint32_t zxnextLayer2GetScrollY(void) { return zxnextLayer2ScrollY; }
static uint32_t zxnextLayer2GetClip(uint32_t index) { return zxnextLayer2ClipWindow[index & 0x03u]; }
static uint32_t zxnextLoResGetEnabled(void) { return zxnextLoResEnabled; }
static uint32_t zxnextLoResGetRadastanMode(void) { return zxnextLoResRadastanMode; }
static uint32_t zxnextLoResGetPaletteOffset(void) { return zxnextLoResPaletteOffset; }
static uint32_t zxnextLoResGetScrollX(void) { return zxnextLoResScrollX; }
static uint32_t zxnextLoResGetScrollY(void) { return zxnextLoResScrollY; }

static uint32_t zxnextLoResStandardAddress(uint32_t x, uint32_t y) {
  uint32_t offset = ((y & 0x7fu) << 7u) | (x & 0x7fu);
  return (y & 0x7fu) >= 48u ? offset + 0x0800u : offset;
}

static uint32_t zxnextLoResRadastanAddress(uint32_t x, uint32_t y, uint32_t dfile) {
  return (dfile ? 0x2000u : 0u) | ((y & 0x7fu) << 6u) | (x & 0x3fu);
}

static uint32_t zxnextLayer2ComposeSample(uint32_t layer2Rgb, uint32_t layer2Transparent, uint32_t ulaRgb) {
  return layer2Transparent ? ulaRgb : (layer2Rgb & 0x1ffu);
}
