#include "zxnext-tilemap.h"

static uint8_t zxnextTilemapEnabled;
static uint8_t zxnextTilemapClipWindow[4];
static uint8_t zxnextTilemapClipIndex;
static uint16_t zxnextTilemapScrollX;
static uint8_t zxnextTilemapScrollY;
static uint8_t zxnextTilemapTransparencyIndex;
static uint8_t zxnextTilemapControl;
static uint8_t zxnextTilemapDefaultAttr;
static uint8_t zxnextTilemapBaseUseBank7;
static uint8_t zxnextTilemapBaseMsb;
static uint8_t zxnextTilemapDefUseBank7;
static uint8_t zxnextTilemapDefMsb;

static void zxnextTilemapReset(void) {
  zxnextTilemapEnabled = 0u;
  zxnextTilemapClipWindow[0] = 0u;
  zxnextTilemapClipWindow[1] = 159u;
  zxnextTilemapClipWindow[2] = 0u;
  zxnextTilemapClipWindow[3] = 255u;
  zxnextTilemapClipIndex = 0u;
  zxnextTilemapScrollX = 0u;
  zxnextTilemapScrollY = 0u;
  zxnextTilemapTransparencyIndex = 0x0fu;
  zxnextTilemapControl = 0u;
  zxnextTilemapDefaultAttr = 0u;
  zxnextTilemapBaseUseBank7 = 0u;
  zxnextTilemapBaseMsb = 0u;
  zxnextTilemapDefUseBank7 = 0u;
  zxnextTilemapDefMsb = 0u;
}

static void zxnextTilemapSetNextReg(uint32_t reg, uint32_t value) {
  uint8_t byteValue = (uint8_t)value;
  switch (reg & 0xffu) {
    case 0x1bu:
      zxnextTilemapClipWindow[zxnextTilemapClipIndex] = byteValue;
      zxnextTilemapClipIndex = (uint8_t)((zxnextTilemapClipIndex + 1u) & 0x03u);
      break;
    case 0x1cu:
      zxnextTilemapClipIndex = byteValue & 0x03u;
      break;
    case 0x2fu:
      zxnextTilemapScrollX = (uint16_t)(((byteValue & 0x03u) << 8u) | (zxnextTilemapScrollX & 0xffu));
      break;
    case 0x30u:
      zxnextTilemapScrollX = (zxnextTilemapScrollX & 0x300u) | byteValue;
      break;
    case 0x31u:
      zxnextTilemapScrollY = byteValue;
      break;
    case 0x4cu:
      zxnextTilemapTransparencyIndex = byteValue & 0x0fu;
      break;
    case 0x6bu:
      zxnextTilemapEnabled = (byteValue & 0x80u) != 0u;
      zxnextTilemapControl = byteValue & 0x6fu;
      break;
    case 0x6cu:
      zxnextTilemapDefaultAttr = byteValue;
      break;
    case 0x6eu:
      zxnextTilemapBaseUseBank7 = (byteValue & 0x80u) != 0u;
      zxnextTilemapBaseMsb = byteValue & 0x3fu;
      break;
    case 0x6fu:
      zxnextTilemapDefUseBank7 = (byteValue & 0x80u) != 0u;
      zxnextTilemapDefMsb = byteValue & 0x3fu;
      break;
    default:
      break;
  }
}

static uint32_t zxnextTilemapGetNextReg(uint32_t reg) {
  switch (reg & 0xffu) {
    case 0x1bu: return zxnextTilemapClipWindow[zxnextTilemapClipIndex];
    case 0x1cu: return zxnextTilemapClipIndex;
    case 0x2fu: return (zxnextTilemapScrollX >> 8u) & 0x03u;
    case 0x30u: return zxnextTilemapScrollX & 0xffu;
    case 0x31u: return zxnextTilemapScrollY;
    case 0x4cu: return zxnextTilemapTransparencyIndex;
    case 0x6bu: return (zxnextTilemapEnabled ? 0x80u : 0u) | zxnextTilemapControl;
    case 0x6cu: return zxnextTilemapDefaultAttr;
    case 0x6eu: return (zxnextTilemapBaseUseBank7 ? 0x80u : 0u) | zxnextTilemapBaseMsb;
    case 0x6fu: return (zxnextTilemapDefUseBank7 ? 0x80u : 0u) | zxnextTilemapDefMsb;
    default: return 0u;
  }
}

static uint32_t zxnextTilemapGetClip(uint32_t index) { return zxnextTilemapClipWindow[index & 0x03u]; }
static uint32_t zxnextTilemapGetEnabled(void) { return zxnextTilemapEnabled; }
static uint32_t zxnextTilemapGetPaletteOffset(void) { return (zxnextTilemapDefaultAttr >> 4u) & 0x0fu; }
static uint32_t zxnextTilemapGetScrollX(void) { return zxnextTilemapScrollX; }
static uint32_t zxnextTilemapGetScrollY(void) { return zxnextTilemapScrollY; }
static uint32_t zxnextTilemapGetBaseAddressUseBank7(void) { return zxnextTilemapBaseUseBank7; }
static uint32_t zxnextTilemapGetBaseAddressMsb(void) { return zxnextTilemapBaseMsb; }
static uint32_t zxnextTilemapGetDefinitionAddressUseBank7(void) { return zxnextTilemapDefUseBank7; }
static uint32_t zxnextTilemapGetDefinitionAddressMsb(void) { return zxnextTilemapDefMsb; }
