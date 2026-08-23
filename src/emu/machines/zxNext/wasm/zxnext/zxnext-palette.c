#include "zxnext-palette.h"

#define ZXNEXT_PALETTE_COUNT 8u
#define ZXNEXT_PALETTE_SIZE 256u

static const uint16_t zxnextDefaultUlaColors[16] = {
  0x000u, 0x005u, 0x140u, 0x145u, 0x028u, 0x02du, 0x168u, 0x16du,
  0x000u, 0x007u, 0x1c0u, 0x1c7u, 0x038u, 0x03fu, 0x1f8u, 0x1ffu
};

static uint16_t zxnextPalettes[ZXNEXT_PALETTE_COUNT][ZXNEXT_PALETTE_SIZE];
static uint8_t zxnextPaletteIndex;
static uint8_t zxnextPaletteDisableAutoInc;
static uint8_t zxnextPaletteSelected;
static uint8_t zxnextPaletteSecondSprite;
static uint8_t zxnextPaletteSecondLayer2;
static uint8_t zxnextPaletteSecondUla;
static uint8_t zxnextPaletteSecondTilemap;
static uint8_t zxnextPaletteEnableUlaNext;
static uint8_t zxnextPaletteSecondWrite;
static uint8_t zxnextPaletteStoredValue;

static uint32_t zxnextPaletteCurrentSlot(void) {
  switch (zxnextPaletteSelected & 0x07u) {
    case 0u: return 0u;
    case 1u: return 1u;
    case 2u: return 2u;
    case 3u: return 3u;
    case 4u: return 4u;
    case 5u: return 5u;
    case 6u: return 6u;
    default: return 7u;
  }
}

static void zxnextPaletteReset(void) {
  zxnextPaletteIndex = 0u;
  zxnextPaletteDisableAutoInc = 0u;
  zxnextPaletteSelected = 0u;
  zxnextPaletteSecondSprite = 0u;
  zxnextPaletteSecondLayer2 = 0u;
  zxnextPaletteSecondUla = 0u;
  zxnextPaletteSecondTilemap = 0u;
  zxnextPaletteEnableUlaNext = 0u;
  zxnextPaletteSecondWrite = 0u;
  zxnextPaletteStoredValue = 0u;

  for (uint32_t i = 0u; i < ZXNEXT_PALETTE_SIZE; i++) {
    uint16_t color = (uint16_t)((i << 1u) | ((i & 0x02u) ? 1u : 0u));
    zxnextPalettes[1][i] = color;
    zxnextPalettes[2][i] = color;
    zxnextPalettes[3][i] = color;
    zxnextPalettes[5][i] = color;
    zxnextPalettes[6][i] = color;
    zxnextPalettes[7][i] = color;
  }

  for (uint32_t block = 0u; block < 16u; block++) {
    for (uint32_t i = 0u; i < 16u; i++) {
      uint32_t index = (block << 4u) | i;
      uint16_t color = i != 11u ? zxnextDefaultUlaColors[i] : 0x1cfu;
      zxnextPalettes[0][index] = color;
      zxnextPalettes[4][index] = color;
    }
  }
}

static void zxnextPaletteSetNextReg(uint32_t reg, uint32_t value) {
  uint8_t byteValue = (uint8_t)value;
  uint32_t slot = zxnextPaletteCurrentSlot();
  switch (reg & 0xffu) {
    case 0x40u:
      zxnextPaletteIndex = byteValue;
      zxnextPaletteSecondWrite = 0u;
      break;
    case 0x41u:
      zxnextPalettes[slot][zxnextPaletteIndex] =
        (uint16_t)(((byteValue << 1u) | ((byteValue & 0x03u) ? 1u : 0u)) & 0x1ffu);
      if (!zxnextPaletteDisableAutoInc) zxnextPaletteIndex = (uint8_t)(zxnextPaletteIndex + 1u);
      zxnextPaletteSecondWrite = 0u;
      break;
    case 0x43u:
      zxnextPaletteDisableAutoInc = (byteValue & 0x80u) != 0u;
      zxnextPaletteSelected = (byteValue >> 4u) & 0x07u;
      zxnextPaletteSecondSprite = (byteValue & 0x08u) != 0u;
      zxnextPaletteSecondLayer2 = (byteValue & 0x04u) != 0u;
      zxnextPaletteSecondUla = (byteValue & 0x02u) != 0u;
      zxnextPaletteEnableUlaNext = (byteValue & 0x01u) != 0u;
      zxnextPaletteSecondWrite = 0u;
      break;
    case 0x44u:
      if (!zxnextPaletteSecondWrite) {
        zxnextPaletteStoredValue = byteValue;
        zxnextPalettes[slot][zxnextPaletteIndex] = (uint16_t)((byteValue << 1u) & 0x1feu);
      } else {
        zxnextPalettes[slot][zxnextPaletteIndex] =
          (uint16_t)((zxnextPalettes[slot][zxnextPaletteIndex] & ~0x001u) |
            (byteValue & 0x01u) |
            ((byteValue & 0x80u) ? 0x200u : 0u));
        if (!zxnextPaletteDisableAutoInc) zxnextPaletteIndex = (uint8_t)(zxnextPaletteIndex + 1u);
      }
      zxnextPaletteSecondWrite = !zxnextPaletteSecondWrite;
      break;
    default:
      break;
  }
}

static uint32_t zxnextPaletteGetNextReg(uint32_t reg) {
  uint16_t entry = zxnextPalettes[zxnextPaletteCurrentSlot()][zxnextPaletteIndex];
  switch (reg & 0xffu) {
    case 0x40u:
      return zxnextPaletteIndex;
    case 0x41u:
      return entry >> 1u;
    case 0x43u:
      return (zxnextPaletteDisableAutoInc ? 0x80u : 0u) |
        ((uint32_t)zxnextPaletteSelected << 4u) |
        (zxnextPaletteSecondSprite ? 0x08u : 0u) |
        (zxnextPaletteSecondLayer2 ? 0x04u : 0u) |
        (zxnextPaletteSecondUla ? 0x02u : 0u) |
        (zxnextPaletteEnableUlaNext ? 0x01u : 0u);
    case 0x44u:
      return ((entry & 0x200u) ? 0x80u : 0u) | ((entry & 0x400u) ? 0x40u : 0u) | (entry & 0x01u);
    default:
      return 0u;
  }
}

static uint32_t zxnextPaletteGetEntry(uint32_t palette, uint32_t index) {
  return zxnextPalettes[palette & 0x07u][index & 0xffu];
}

static uint32_t zxnextPaletteGetLayer2Entry(uint32_t index) {
  return zxnextPalettes[zxnextPaletteSecondLayer2 ? 5u : 1u][index & 0xffu];
}

static uint32_t zxnextPaletteGetSpriteEntry(uint32_t index) {
  return zxnextPalettes[zxnextPaletteSecondSprite ? 6u : 2u][index & 0xffu];
}

static uint32_t zxnextPaletteGetTilemapEntry(uint32_t index) {
  return zxnextPalettes[zxnextPaletteSecondTilemap ? 7u : 3u][index & 0xffu];
}

static uint32_t zxnextPaletteGetCurrentEntry(uint32_t index) {
  return zxnextPalettes[zxnextPaletteCurrentSlot()][index & 0xffu];
}

static uint32_t zxnextPaletteGetPaletteIndex(void) { return zxnextPaletteIndex; }
static uint32_t zxnextPaletteGetControl(void) { return zxnextPaletteGetNextReg(0x43u); }
static uint32_t zxnextPaletteGetSecondWrite(void) { return zxnextPaletteSecondWrite; }
static uint32_t zxnextPaletteGetStoredValue(void) { return zxnextPaletteStoredValue; }
static void zxnextPaletteSetSecondTilemap(uint32_t value) { zxnextPaletteSecondTilemap = value != 0u; }
static uint32_t zxnextPaletteGetSecondTilemap(void) { return zxnextPaletteSecondTilemap; }
