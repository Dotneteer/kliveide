#include "zxnext-sprites.h"

static uint8_t zxnextSpriteClipWindow[4];
static uint8_t zxnextSpriteClipIndex;
static uint8_t zxnextSpriteTransparencyIndex;
static uint8_t zxnextSpritePatternIndex;
static uint8_t zxnextSpritePatternSubIndex;
static uint8_t zxnextSpriteIndex;
static uint8_t zxnextSpriteSubIndex;
static uint8_t zxnextSprite0OnTop;
static uint8_t zxnextSpriteClippingEnabled;
static uint8_t zxnextSpritesOverBorderEnabled;
static uint8_t zxnextSpritesEnabled;
static uint8_t zxnextSpriteLayerPriority;
static uint8_t zxnextSpriteTooMany;
static uint8_t zxnextSpriteCollision;
static int16_t zxnextSpriteLastVisibleIndex;
static uint8_t zxnextSpriteAttributes[128][5];
static uint8_t zxnextSpritePatternMemory8[512][256];
static uint8_t zxnextSpritePatternMemory4[1024][256];

static void zxnextSpritesReset(void) {
  zxnextSpriteClipWindow[0] = 0u;
  zxnextSpriteClipWindow[1] = 255u;
  zxnextSpriteClipWindow[2] = 0u;
  zxnextSpriteClipWindow[3] = 191u;
  zxnextSpriteClipIndex = 0u;
  zxnextSpriteTransparencyIndex = 0xe3u;
  zxnextSpritePatternIndex = 0u;
  zxnextSpritePatternSubIndex = 0u;
  zxnextSpriteIndex = 0u;
  zxnextSpriteSubIndex = 0u;
  zxnextSprite0OnTop = 0u;
  zxnextSpriteClippingEnabled = 0u;
  zxnextSpritesOverBorderEnabled = 0u;
  zxnextSpritesEnabled = 0u;
  zxnextSpriteLayerPriority = 0u;
  zxnextSpriteTooMany = 0u;
  zxnextSpriteCollision = 0u;
  zxnextSpriteLastVisibleIndex = -1;
  for (uint32_t i = 0u; i < 128u; i++) {
    for (uint32_t a = 0u; a < 5u; a++) zxnextSpriteAttributes[i][a] = 0u;
  }
  for (uint32_t v = 0u; v < 512u; v++) {
    for (uint32_t i = 0u; i < 256u; i++) zxnextSpritePatternMemory8[v][i] = 0u;
  }
  for (uint32_t v = 0u; v < 1024u; v++) {
    for (uint32_t i = 0u; i < 256u; i++) zxnextSpritePatternMemory4[v][i] = 0u;
  }
}

static void zxnextSpritesSetNextReg(uint32_t reg, uint32_t value) {
  uint8_t byteValue = (uint8_t)value;
  switch (reg & 0xffu) {
    case 0x19u:
      zxnextSpriteClipWindow[zxnextSpriteClipIndex] = byteValue;
      zxnextSpriteClipIndex = (uint8_t)((zxnextSpriteClipIndex + 1u) & 0x03u);
      break;
    case 0x4bu:
      zxnextSpriteTransparencyIndex = byteValue;
      break;
    case 0x15u:
      zxnextSprite0OnTop = (byteValue & 0x40u) != 0u;
      zxnextSpriteClippingEnabled = (byteValue & 0x20u) != 0u;
      zxnextSpriteLayerPriority = (byteValue >> 2u) & 0x07u;
      zxnextSpritesOverBorderEnabled = (byteValue & 0x02u) != 0u;
      zxnextSpritesEnabled = (byteValue & 0x01u) != 0u;
      break;
    case 0x34u:
    case 0x35u:
    case 0x36u:
    case 0x37u:
    case 0x38u:
      zxnextSpriteAttributes[zxnextSpriteIndex & 0x7fu][(reg - 0x34u) & 0x07u] = byteValue;
      if (((reg - 0x34u) & 0x07u) == 3u && (byteValue & 0x80u)) {
        zxnextSpriteLastVisibleIndex = zxnextSpriteIndex & 0x7f;
      }
      break;
    case 0x75u:
    case 0x76u:
    case 0x77u:
    case 0x78u:
    case 0x79u:
      zxnextSpriteAttributes[zxnextSpriteIndex & 0x7fu][(reg - 0x75u) & 0x07u] = byteValue;
      if (((reg - 0x75u) & 0x07u) == 3u && (byteValue & 0x80u)) {
        zxnextSpriteLastVisibleIndex = zxnextSpriteIndex & 0x7f;
      }
      zxnextSpriteIndex = (uint8_t)((zxnextSpriteIndex + 1u) & 0x7fu);
      break;
    default:
      break;
  }
}

static uint32_t zxnextSpritesGetNextReg(uint32_t reg) {
  switch (reg & 0xffu) {
    case 0x19u: return zxnextSpriteClipWindow[zxnextSpriteClipIndex];
    case 0x4bu: return zxnextSpriteTransparencyIndex;
    case 0x15u:
      return (zxnextSprite0OnTop ? 0x40u : 0u) |
        (zxnextSpriteClippingEnabled ? 0x20u : 0u) |
        ((uint32_t)zxnextSpriteLayerPriority << 2u) |
        (zxnextSpritesOverBorderEnabled ? 0x02u : 0u) |
        (zxnextSpritesEnabled ? 0x01u : 0u);
    default: return 0u;
  }
}

static void zxnextSpritesResetClipIndex(void) { zxnextSpriteClipIndex = 0u; }
static uint32_t zxnextSpritesGetClipIndex(void) { return zxnextSpriteClipIndex; }
static void zxnextSpritesWritePort303b(uint32_t value) {
  uint8_t byteValue = (uint8_t)value;
  zxnextSpritePatternIndex = byteValue & 0x3fu;
  zxnextSpritePatternSubIndex = byteValue & 0x80u;
  zxnextSpriteIndex = byteValue & 0x7fu;
  zxnextSpriteSubIndex = 0u;
}

static void zxnextSpritesWritePort57(uint32_t value) {
  uint8_t sprite = zxnextSpriteIndex & 0x7fu;
  zxnextSpriteAttributes[sprite][zxnextSpriteSubIndex] = (uint8_t)value;
  if (zxnextSpriteSubIndex == 3u && (value & 0x80u)) zxnextSpriteLastVisibleIndex = sprite;
  if (zxnextSpriteSubIndex == 3u && (value & 0x40u) == 0u) {
    zxnextSpriteAttributes[sprite][4] = 0u;
    zxnextSpriteSubIndex++;
  }
  zxnextSpriteSubIndex++;
  if (zxnextSpriteSubIndex >= 5u) {
    zxnextSpriteSubIndex = 0u;
    zxnextSpriteIndex = (uint8_t)((zxnextSpriteIndex + 1u) & 0x7fu);
  }
}

static void zxnextSpritesWritePort5b(uint32_t value) {
  uint32_t srcIdx = zxnextSpritePatternSubIndex;
  uint32_t srcY = srcIdx >> 4u;
  uint32_t srcX = srcIdx & 0x0fu;
  uint32_t dst[8];
  uint8_t byteValue = (uint8_t)value;
  uint32_t base8 = (uint32_t)zxnextSpritePatternIndex << 3u;
  uint32_t pattern4 = ((uint32_t)zxnextSpritePatternIndex << 1u) | ((zxnextSpritePatternSubIndex >> 7u) & 1u);
  uint32_t base4 = pattern4 << 3u;

  dst[0] = srcIdx;
  dst[1] = ((15u - srcY) << 4u) | srcX;
  dst[2] = (srcY << 4u) | (15u - srcX);
  dst[3] = ((15u - srcY) << 4u) | (15u - srcX);
  dst[4] = (srcX << 4u) | (15u - srcY);
  dst[5] = (srcX << 4u) | srcY;
  dst[6] = ((15u - srcX) << 4u) | (15u - srcY);
  dst[7] = ((15u - srcX) << 4u) | srcY;

  for (uint32_t i = 0u; i < 8u; i++) {
    zxnextSpritePatternMemory8[base8 + i][dst[i]] = byteValue;
    zxnextSpritePatternMemory4[base4 + i][dst[i]] = byteValue & 0x0fu;
  }

  zxnextSpritePatternSubIndex = (uint8_t)(zxnextSpritePatternSubIndex + 1u);
  if (zxnextSpritePatternSubIndex == 0u) {
    zxnextSpritePatternIndex = (uint8_t)((zxnextSpritePatternIndex + 1u) & 0x3fu);
  }
}

static uint32_t zxnextSpritesReadPort303b(void) {
  uint32_t value = (zxnextSpriteTooMany ? 0x02u : 0u) | (zxnextSpriteCollision ? 0x01u : 0u);
  zxnextSpriteTooMany = 0u;
  zxnextSpriteCollision = 0u;
  return value;
}

static uint32_t zxnextSpritesGetClip(uint32_t index) { return zxnextSpriteClipWindow[index & 0x03u]; }
static uint32_t zxnextSpritesGetTransparencyIndex(void) { return zxnextSpriteTransparencyIndex; }
static uint32_t zxnextSpritesGetSpriteIndex(void) { return zxnextSpriteIndex; }
static uint32_t zxnextSpritesGetPatternIndex(void) { return zxnextSpritePatternIndex; }
static uint32_t zxnextSpritesGetPatternSubIndex(void) { return zxnextSpritePatternSubIndex; }
static uint32_t zxnextSpritesGetSpriteSubIndex(void) { return zxnextSpriteSubIndex; }
static uint32_t zxnextSpritesGetAttribute(uint32_t sprite, uint32_t attr) {
  return zxnextSpriteAttributes[sprite & 0x7fu][attr % 5u];
}
static uint32_t zxnextSpritesGetPatternByte8(uint32_t variant, uint32_t offset) {
  return zxnextSpritePatternMemory8[variant & 0x1ffu][offset & 0xffu];
}
static uint32_t zxnextSpritesGetPatternByte4(uint32_t variant, uint32_t offset) {
  return zxnextSpritePatternMemory4[variant & 0x3ffu][offset & 0xffu];
}
static uint32_t zxnextSpritesGetLastVisibleSpriteIndex(void) {
  return zxnextSpriteLastVisibleIndex < 0 ? 0xffffffffu : (uint32_t)zxnextSpriteLastVisibleIndex;
}
static uint32_t zxnextSpritesGetSprite0OnTop(void) { return zxnextSprite0OnTop; }
static uint32_t zxnextSpritesGetClippingEnabled(void) { return zxnextSpriteClippingEnabled; }
static uint32_t zxnextSpritesGetOverBorderEnabled(void) { return zxnextSpritesOverBorderEnabled; }
static uint32_t zxnextSpritesGetEnabled(void) { return zxnextSpritesEnabled; }
