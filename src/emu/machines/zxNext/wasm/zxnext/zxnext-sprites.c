#include "zxnext.h"

#define ZXNEXT_SPRITE_COUNT 128u
#define ZXNEXT_SPRITE_PATTERN_VARIANTS 8u
#define ZXNEXT_SPRITE_PATTERN_PIXELS 256u
#define ZXNEXT_SPRITE_8BIT_VARIANT_COUNT 512u
#define ZXNEXT_SPRITE_4BIT_VARIANT_COUNT 1024u

typedef struct {
  uint16_t x;
  uint16_t y;
  uint8_t paletteOffset;
  uint8_t mirrorX;
  uint8_t mirrorY;
  uint8_t rotate;
  uint8_t attributeFlag1;
  uint8_t visible;
  uint8_t has5AttributeBytes;
  uint8_t patternIndex;
  uint8_t colorMode;
  uint8_t attributeFlag2;
  uint8_t scaleX;
  uint8_t scaleY;
  uint8_t is4BitPattern;
  uint8_t patternRelative;
  uint8_t transformVariant;
  uint16_t patternVariantIndex;
  uint16_t width;
  uint16_t height;
} ZxNextSpriteAttributes;

static ZxNextSpriteAttributes spriteAttributes[ZXNEXT_SPRITE_COUNT];
static uint8_t spritePatternMemory8bit[ZXNEXT_SPRITE_8BIT_VARIANT_COUNT][ZXNEXT_SPRITE_PATTERN_PIXELS];
static uint8_t spritePatternMemory4bit[ZXNEXT_SPRITE_4BIT_VARIANT_COUNT][ZXNEXT_SPRITE_PATTERN_PIXELS];
static uint8_t spriteMirrorTie = 0u;
static uint8_t spriteMirrorQ = 0u;
static uint8_t spriteMirrorIndex = 7u;
static uint8_t spriteMirrorInc = 0u;
static uint8_t sprite0OnTop = 0u;
static uint8_t spriteClippingEnabled = 0u;
static uint8_t spritesEnabled = 0u;
static uint8_t spritesOverBorderEnabled = 0u;
static uint8_t spriteClipWindowX1 = 0u;
static uint8_t spriteClipWindowX2 = 255u;
static uint8_t spriteClipWindowY1 = 0u;
static uint8_t spriteClipWindowY2 = 191u;
static uint8_t spriteClipIndex = 0u;
static uint8_t spriteTransparencyIndex = 0xe3u;
static uint8_t spritePatternIndex = 0u;
static uint8_t spritePatternSubIndex = 0u;
static uint8_t spriteIndex = 0u;
static uint8_t spriteSubIndex = 0u;
static uint8_t spriteTooManySpritesPerLine = 0u;
static uint8_t spriteCollisionDetected = 0u;
static int16_t spriteLastVisibleSpriteIndex = -1;

static void spriteUpdateDimensions(ZxNextSpriteAttributes *sprite) {
  const uint16_t scaledWidth = (uint16_t)(16u << sprite->scaleX);
  const uint16_t scaledHeight = (uint16_t)(16u << sprite->scaleY);
  if (sprite->rotate != 0u) {
    sprite->width = scaledHeight;
    sprite->height = scaledWidth;
  } else {
    sprite->width = scaledWidth;
    sprite->height = scaledHeight;
  }
}

static void spriteUpdatePatternVariantIndex(ZxNextSpriteAttributes *sprite) {
  if (sprite->is4BitPattern != 0u) {
    const uint16_t pattern7 = (uint16_t)((sprite->patternIndex << 1u) | (sprite->attributeFlag2 != 0u ? 1u : 0u));
    sprite->patternVariantIndex = (uint16_t)((pattern7 << 3u) | sprite->transformVariant);
  } else {
    sprite->patternVariantIndex = (uint16_t)((sprite->patternIndex << 3u) | sprite->transformVariant);
  }
}

static void spriteResetAttributes(void) {
  for (uint32_t i = 0; i < ZXNEXT_SPRITE_COUNT; i++) {
    spriteAttributes[i].x = 0u;
    spriteAttributes[i].y = 0u;
    spriteAttributes[i].paletteOffset = 0u;
    spriteAttributes[i].mirrorX = 0u;
    spriteAttributes[i].mirrorY = 0u;
    spriteAttributes[i].rotate = 0u;
    spriteAttributes[i].attributeFlag1 = 0u;
    spriteAttributes[i].visible = 0u;
    spriteAttributes[i].has5AttributeBytes = 0u;
    spriteAttributes[i].patternIndex = 0u;
    spriteAttributes[i].colorMode = 0u;
    spriteAttributes[i].attributeFlag2 = 0u;
    spriteAttributes[i].scaleX = 0u;
    spriteAttributes[i].scaleY = 0u;
    spriteAttributes[i].is4BitPattern = 0u;
    spriteAttributes[i].patternRelative = 0u;
    spriteAttributes[i].transformVariant = 0u;
    spriteAttributes[i].patternVariantIndex = 0u;
    spriteAttributes[i].width = 16u;
    spriteAttributes[i].height = 16u;
  }
}

static void resetSpriteState(void) {
  spriteMirrorTie = 0u;
  spriteMirrorQ = 0u;
  spriteMirrorIndex = 7u;
  spriteMirrorInc = 0u;
  sprite0OnTop = 0u;
  spriteClippingEnabled = 0u;
  spritesEnabled = 0u;
  spritesOverBorderEnabled = 0u;
  spriteClipWindowX1 = 0u;
  spriteClipWindowX2 = 255u;
  spriteClipWindowY1 = 0u;
  spriteClipWindowY2 = 191u;
  spriteClipIndex = 0u;
  spriteTransparencyIndex = 0xe3u;
  spritePatternIndex = 0u;
  spritePatternSubIndex = 0u;
  spriteIndex = 0u;
  spriteSubIndex = 0u;
  spriteTooManySpritesPerLine = 0u;
  spriteCollisionDetected = 0u;
  spriteLastVisibleSpriteIndex = -1;
  spriteResetAttributes();
}

static void spriteWriteIndexedAttribute(uint32_t spriteIdx, uint32_t attrIdx, uint32_t value) {
  if (spriteIdx >= ZXNEXT_SPRITE_COUNT) return;
  ZxNextSpriteAttributes *sprite = &spriteAttributes[spriteIdx];
  const uint8_t byteValue = (uint8_t)(value & 0xffu);
  switch (attrIdx & 0x07u) {
    case 0u:
      sprite->x = (uint16_t)(((sprite->x & 0x100u) | byteValue) & 0x1ffu);
      break;
    case 1u:
      sprite->y = (uint16_t)(((sprite->y & 0x100u) | byteValue) & 0x1ffu);
      break;
    case 2u:
      sprite->paletteOffset = (byteValue >> 4u) & 0x0fu;
      sprite->mirrorX = (byteValue & 0x08u) != 0u;
      sprite->mirrorY = (byteValue & 0x04u) != 0u;
      sprite->rotate = (byteValue & 0x02u) != 0u;
      sprite->attributeFlag1 = (byteValue & 0x01u) != 0u;
      sprite->transformVariant =
        (uint8_t)((sprite->rotate != 0u ? 4u : 0u) |
        (sprite->mirrorX != 0u ? 2u : 0u) |
        (sprite->mirrorY != 0u ? 1u : 0u));
      spriteUpdatePatternVariantIndex(sprite);
      spriteUpdateDimensions(sprite);
      break;
    case 3u:
      sprite->visible = (byteValue & 0x80u) != 0u;
      sprite->has5AttributeBytes = (byteValue & 0x40u) != 0u;
      sprite->patternIndex = byteValue & 0x3fu;
      spriteUpdatePatternVariantIndex(sprite);
      if (sprite->visible != 0u) {
        if ((int16_t)spriteIdx > spriteLastVisibleSpriteIndex) {
          spriteLastVisibleSpriteIndex = (int16_t)spriteIdx;
        } else {
          spriteLastVisibleSpriteIndex = -1;
          for (int32_t i = 127; i > 0; i--) {
            if (spriteAttributes[i].visible != 0u) {
              spriteLastVisibleSpriteIndex = (int16_t)i;
              break;
            }
          }
        }
      }
      break;
    default:
      sprite->colorMode = (byteValue >> 6u) & 0x03u;
      sprite->attributeFlag2 = (byteValue & 0x20u) != 0u;
      sprite->is4BitPattern = (byteValue & 0x80u) != 0u;
      sprite->scaleX = (byteValue >> 3u) & 0x03u;
      sprite->scaleY = (byteValue >> 1u) & 0x03u;
      spriteUpdatePatternVariantIndex(sprite);
      spriteUpdateDimensions(sprite);
      if (sprite->colorMode != 0x01u) {
        sprite->x = (uint16_t)((((uint16_t)byteValue & 0x01u) << 8u) | (sprite->x & 0xffu));
      } else {
        sprite->patternRelative = (byteValue & 0x01u) != 0u;
      }
      break;
  }
}

static void spriteMirrorDataW(uint32_t data) {
  if (spriteMirrorIndex <= 4u) {
    spriteWriteIndexedAttribute(spriteMirrorQ, spriteMirrorIndex, data);
  }
  uint8_t mirrorNumChange = 0u;
  if (spriteMirrorIndex == 7u) {
    spriteMirrorQ = (uint8_t)(data & 0x7fu);
    mirrorNumChange = 1u;
  } else if (spriteMirrorInc != 0u) {
    spriteMirrorQ = (uint8_t)((spriteMirrorQ + 1u) & 0x7fu);
    mirrorNumChange = 1u;
  }
  if (mirrorNumChange != 0u && spriteMirrorTie != 0u) {
    spriteIndex = spriteMirrorQ;
    spritePatternIndex = spriteMirrorQ & 0x3fu;
    spritePatternSubIndex = 0u;
    spriteSubIndex = 0u;
  }
}

static uint32_t zxnextReadSpritePort303b(void) {
  const uint32_t result =
    (spriteTooManySpritesPerLine != 0u ? 0x02u : 0x00u) |
    (spriteCollisionDetected != 0u ? 0x01u : 0x00u);
  spriteTooManySpritesPerLine = 0u;
  spriteCollisionDetected = 0u;
  return result;
}

static void zxnextWriteSpritePort303b(uint32_t value) {
  const uint8_t byteValue = (uint8_t)(value & 0xffu);
  spritePatternIndex = byteValue & 0x3fu;
  spritePatternSubIndex = byteValue & 0x80u;
  spriteIndex = byteValue & 0x7fu;
  spriteSubIndex = 0u;
}

static void zxnextWriteSpriteAttributePort(uint32_t value) {
  spriteWriteIndexedAttribute(spriteIndex, spriteSubIndex, value);
  ZxNextSpriteAttributes *sprite = &spriteAttributes[spriteIndex];
  if (spriteSubIndex == 3u && sprite->has5AttributeBytes == 0u) {
    spriteSubIndex++;
    sprite->colorMode = 0u;
    sprite->attributeFlag2 = 0u;
    sprite->scaleX = 0u;
    sprite->scaleY = 0u;
    sprite->is4BitPattern = 0u;
    spriteUpdatePatternVariantIndex(sprite);
    spriteUpdateDimensions(sprite);
  }
  spriteSubIndex++;
  if (spriteSubIndex >= 5u) {
    spriteSubIndex = 0u;
    spriteIndex = (uint8_t)((spriteIndex + 1u) & 0x7fu);
    if (spriteMirrorTie != 0u) spriteMirrorQ = spriteIndex;
  }
}

static void zxnextWriteSpritePatternPort(uint32_t value) {
  const uint8_t byteValue = (uint8_t)(value & 0xffu);
  const uint32_t srcIdx = spritePatternSubIndex;
  const uint32_t srcY = srcIdx >> 4u;
  const uint32_t srcX = srcIdx & 0x0fu;
  const uint32_t dstIdx[8] = {
    srcIdx,
    ((15u - srcY) << 4u) | srcX,
    (srcY << 4u) | (15u - srcX),
    ((15u - srcY) << 4u) | (15u - srcX),
    (srcX << 4u) | (15u - srcY),
    (srcX << 4u) | srcY,
    ((15u - srcX) << 4u) | (15u - srcY),
    ((15u - srcX) << 4u) | srcY
  };
  const uint32_t baseVariant8 = spritePatternIndex << 3u;
  for (uint32_t i = 0; i < 8u; i++) {
    spritePatternMemory8bit[baseVariant8 + i][dstIdx[i]] = byteValue;
  }
  const uint32_t pattern4bitIndex = (spritePatternIndex << 1u) | ((spritePatternSubIndex >> 7u) & 0x01u);
  const uint32_t baseVariant4 = pattern4bitIndex << 3u;
  const uint8_t value4bit = byteValue & 0x0fu;
  for (uint32_t i = 0; i < 8u; i++) {
    spritePatternMemory4bit[baseVariant4 + i][dstIdx[i]] = value4bit;
  }
  spritePatternSubIndex = (uint8_t)((spritePatternSubIndex + 1u) & 0xffu);
  if (spritePatternSubIndex == 0u) spritePatternIndex = (uint8_t)((spritePatternIndex + 1u) & 0x3fu);
}

static uint32_t spritesReadNextReg(uint32_t reg) {
  switch (reg & 0xffu) {
    case 0x09u:
      return (nextRegs[0x09u] & 0xefu) | (spriteMirrorTie != 0u ? 0x10u : 0x00u);
    case 0x15u:
      return
        (loResEnabled != 0u ? 0x80u : 0x00u) |
        (sprite0OnTop != 0u ? 0x40u : 0x00u) |
        (spriteClippingEnabled != 0u ? 0x20u : 0x00u) |
        (nextRegs[0x15u] & 0x1cu) |
        (spritesOverBorderEnabled != 0u ? 0x02u : 0x00u) |
        (spritesEnabled != 0u ? 0x01u : 0x00u);
    case 0x19u:
      switch (spriteClipIndex & 0x03u) {
        case 0u: return spriteClipWindowX1;
        case 1u: return spriteClipWindowX2;
        case 2u: return spriteClipWindowY1;
        default: return spriteClipWindowY2;
      }
    case 0x34u:
      return spriteMirrorQ & 0x7fu;
    case 0x4bu:
      return spriteTransparencyIndex;
    default:
      return 0xffffffffu;
  }
}

static uint32_t spritesWriteNextReg(uint32_t reg, uint32_t value) {
  const uint8_t byteValue = (uint8_t)(value & 0xffu);
  const uint32_t maskedReg = reg & 0xffu;
  switch (maskedReg) {
    case 0x09u:
      spriteMirrorTie = (byteValue & 0x10u) != 0u;
      return 0u;
    case 0x15u:
      sprite0OnTop = (byteValue & 0x40u) != 0u;
      spriteClippingEnabled = (byteValue & 0x20u) != 0u;
      spritesOverBorderEnabled = (byteValue & 0x02u) != 0u;
      spritesEnabled = (byteValue & 0x01u) != 0u;
      return 0u;
    case 0x19u:
      switch (spriteClipIndex & 0x03u) {
        case 0u: spriteClipWindowX1 = byteValue; break;
        case 1u: spriteClipWindowX2 = byteValue; break;
        case 2u: spriteClipWindowY1 = byteValue; break;
        default: spriteClipWindowY2 = byteValue; break;
      }
      spriteClipIndex = (uint8_t)((spriteClipIndex + 1u) & 0x03u);
      return 1u;
    case 0x1cu:
      if ((byteValue & 0x02u) != 0u) spriteClipIndex = 0u;
      return 0u;
    case 0x34u:
      spriteMirrorDataW(byteValue);
      return 1u;
    case 0x35u:
    case 0x36u:
    case 0x37u:
    case 0x38u:
    case 0x39u:
      spriteMirrorInc = 0u;
      spriteMirrorIndex = (uint8_t)(maskedReg - 0x35u);
      spriteMirrorDataW(byteValue);
      return 1u;
    case 0x75u:
    case 0x76u:
    case 0x77u:
    case 0x78u:
    case 0x79u:
      spriteMirrorInc = 1u;
      spriteMirrorIndex = (uint8_t)(maskedReg - 0x75u);
      spriteMirrorDataW(byteValue);
      return 1u;
    case 0x4bu:
      spriteTransparencyIndex = byteValue;
      return 1u;
    default:
      return 0u;
  }
}

static uint32_t spriteIsInsideClip(uint32_t x, uint32_t y) {
  if (spritesOverBorderEnabled == 0u) {
    return
      x >= ((uint32_t)spriteClipWindowX1 + 32u) &&
      x <= ((uint32_t)spriteClipWindowX2 + 32u) &&
      y >= ((uint32_t)spriteClipWindowY1 + 32u) &&
      y <= ((uint32_t)spriteClipWindowY2 + 32u);
  }
  if (spriteClippingEnabled == 0u) return x < 320u && y < 256u;
  return
    x >= ((uint32_t)spriteClipWindowX1 << 1u) &&
    x <= (((uint32_t)spriteClipWindowX2 << 1u) | 1u) &&
    y >= spriteClipWindowY1 &&
    y <= spriteClipWindowY2;
}

static uint32_t zxnextGetSpritePixelInfo(uint32_t displayHc, uint32_t displayVc, uint32_t phase) {
  if (spritesEnabled == 0u) return 0u;
  const uint32_t x = displayHc + 32u + (phase & 0x01u);
  const uint32_t y = displayVc + 32u;
  if (spriteIsInsideClip(x, y) == 0u) return 0u;

  uint32_t foundPixel = 0u;
  uint32_t foundCount = 0u;
  for (uint32_t order = 0u; order < ZXNEXT_SPRITE_COUNT; order++) {
    const uint32_t idx = sprite0OnTop != 0u ? order : (ZXNEXT_SPRITE_COUNT - 1u - order);
    ZxNextSpriteAttributes *sprite = &spriteAttributes[idx];
    if (sprite->visible == 0u || (sprite->has5AttributeBytes != 0u && sprite->colorMode == 0x01u)) continue;

    int32_t spriteX = sprite->x;
    int32_t spriteY = sprite->y;
    if (spriteX >= 320) spriteX -= 512;
    if (spriteY >= 256) spriteY -= 512;
    const int32_t localX = (int32_t)x - spriteX;
    const int32_t localY = (int32_t)y - spriteY;
    if (localX < 0 || localY < 0 || localX >= sprite->width || localY >= sprite->height) continue;

    const uint32_t patternX = ((uint32_t)localX >> sprite->scaleX) & 0x0fu;
    const uint32_t patternY = ((uint32_t)localY >> sprite->scaleY) & 0x0fu;
    const uint32_t patternOffset = (patternY << 4u) | patternX;
    const uint8_t rawPixel = sprite->is4BitPattern != 0u
      ? spritePatternMemory4bit[sprite->patternVariantIndex & 0x3ffu][patternOffset]
      : spritePatternMemory8bit[sprite->patternVariantIndex & 0x1ffu][patternOffset];
    const uint8_t transparent = sprite->is4BitPattern != 0u ? (spriteTransparencyIndex & 0x0fu) : spriteTransparencyIndex;
    if (rawPixel == transparent) continue;

    uint32_t paletteIndex;
    if (sprite->is4BitPattern != 0u) {
      paletteIndex = ((uint32_t)(sprite->paletteOffset & 0x0fu) << 4u) | (rawPixel & 0x0fu);
    } else {
      const uint32_t upper = (((rawPixel >> 4u) + (sprite->paletteOffset & 0x0fu)) & 0x0fu);
      paletteIndex = (upper << 4u) | (rawPixel & 0x0fu);
    }
    if (foundCount != 0u) {
      spriteCollisionDetected = 1u;
    } else {
      foundPixel = zxnextPackLayerPixel(spritePaletteRgb333(paletteIndex), 0u);
    }
    foundCount++;
  }
  return foundPixel;
}

static uint32_t zxnextGetSpritePixelBgra(uint32_t displayHc, uint32_t displayVc, uint32_t phase) {
  return zxnextLayerPixelBgra(zxnextGetSpritePixelInfo(displayHc, displayVc, phase));
}

uint32_t zxnextGetSpriteMirrorTie(void) { return spriteMirrorTie; }
uint32_t zxnextGetSpriteMirrorQ(void) { return spriteMirrorQ; }
uint32_t zxnextGetSpriteMirrorIndex(void) { return spriteMirrorIndex; }
uint32_t zxnextGetSpriteMirrorInc(void) { return spriteMirrorInc; }
uint32_t zxnextGetSprite0OnTop(void) { return sprite0OnTop; }
uint32_t zxnextGetSpriteClippingEnabled(void) { return spriteClippingEnabled; }
uint32_t zxnextGetSpritesEnabled(void) { return spritesEnabled; }
uint32_t zxnextGetSpritesOverBorderEnabled(void) { return spritesOverBorderEnabled; }
uint32_t zxnextGetSpriteClipIndex(void) { return spriteClipIndex; }
uint32_t zxnextGetSpriteClipWindowX1(void) { return spriteClipWindowX1; }
uint32_t zxnextGetSpriteClipWindowX2(void) { return spriteClipWindowX2; }
uint32_t zxnextGetSpriteClipWindowY1(void) { return spriteClipWindowY1; }
uint32_t zxnextGetSpriteClipWindowY2(void) { return spriteClipWindowY2; }
uint32_t zxnextGetSpriteTransparencyIndex(void) { return spriteTransparencyIndex; }
uint32_t zxnextGetSpritePatternIndex(void) { return spritePatternIndex; }
uint32_t zxnextGetSpritePatternSubIndex(void) { return spritePatternSubIndex; }
uint32_t zxnextGetSpriteIndex(void) { return spriteIndex; }
uint32_t zxnextGetSpriteSubIndex(void) { return spriteSubIndex; }
uint32_t zxnextGetSpriteLastVisibleSpriteIndex(void) { return (uint32_t)(int32_t)spriteLastVisibleSpriteIndex; }
uint32_t zxnextReadSpritePattern8(uint32_t variant, uint32_t offset) {
  return spritePatternMemory8bit[variant & 0x1ffu][offset & 0xffu];
}
uint32_t zxnextReadSpritePattern4(uint32_t variant, uint32_t offset) {
  return spritePatternMemory4bit[variant & 0x3ffu][offset & 0xffu];
}
uint32_t zxnextGetSpriteAttribute(uint32_t index, uint32_t field) {
  ZxNextSpriteAttributes *sprite = &spriteAttributes[index & 0x7fu];
  switch (field & 0x1fu) {
    case 0u: return sprite->x;
    case 1u: return sprite->y;
    case 2u: return sprite->paletteOffset;
    case 3u: return sprite->mirrorX;
    case 4u: return sprite->mirrorY;
    case 5u: return sprite->rotate;
    case 6u: return sprite->attributeFlag1;
    case 7u: return sprite->visible;
    case 8u: return sprite->has5AttributeBytes;
    case 9u: return sprite->patternIndex;
    case 10u: return sprite->colorMode;
    case 11u: return sprite->attributeFlag2;
    case 12u: return sprite->scaleX;
    case 13u: return sprite->scaleY;
    case 14u: return sprite->is4BitPattern;
    case 15u: return sprite->patternRelative;
    case 16u: return sprite->transformVariant;
    case 17u: return sprite->patternVariantIndex;
    case 18u: return sprite->width;
    case 19u: return sprite->height;
    default: return 0u;
  }
}
