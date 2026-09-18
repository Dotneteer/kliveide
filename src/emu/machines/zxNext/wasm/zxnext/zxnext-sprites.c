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

/*
 * sprites.vhd ~596-616 `mirror_sprite_q`: the sprite the NextReg attribute mirrors write. $34 sets it,
 * $35-$39 write attributes 0-4 of it, $75-$79 do the same and then advance it. It is separate from the
 * port $57 upload index unless NextReg $09 bit 4 ("sprite tie") links the two.
 */
static uint8_t zxnextSpriteMirrorQ;

static uint32_t zxnextSpritesMirrorTied(void) { return (zxnextNextRegs[0x09u] & 0x10u) != 0u; }

/* mirror_num_change with the tie on: the upload and pattern indices follow the mirror (~655, ~733). */
static void zxnextSpritesMirrorNumberChanged(void) {
  if (!zxnextSpritesMirrorTied()) return;
  zxnextSpriteIndex = zxnextSpriteMirrorQ & 0x7fu;
  zxnextSpriteSubIndex = 0u;
  zxnextSpritePatternIndex = zxnextSpriteMirrorQ & 0x3fu;
  zxnextSpritePatternSubIndex = zxnextSpriteMirrorQ & 0x80u;
}

/* attr_num_change with the tie on: the mirror follows the upload index (~609-611). */
static void zxnextSpritesAttrNumberChanged(void) {
  if (!zxnextSpritesMirrorTied()) return;
  zxnextSpriteMirrorQ = (uint8_t)((zxnextSpriteIndex & 0x7fu) | (zxnextSpritePatternSubIndex ? 0x80u : 0x00u));
}

static uint32_t zxnextSpritesGetMirrorNumber(void) { return zxnextSpriteMirrorQ & 0x7fu; }

static void zxnextSpritesMirrorWrite(uint32_t attribute, uint8_t byteValue) {
  uint8_t sprite = zxnextSpriteMirrorQ & 0x7fu;
  zxnextSpriteAttributes[sprite][attribute] = byteValue;
  if (attribute == 3u && (byteValue & 0x80u)) zxnextSpriteLastVisibleIndex = sprite;
}

static void zxnextSpritesReset(void) {
  zxnextSpriteMirrorQ = 0u;
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
      zxnextSpriteMirrorQ = byteValue;
      zxnextSpritesMirrorNumberChanged();
      break;
    case 0x35u:
    case 0x36u:
    case 0x37u:
    case 0x38u:
    case 0x39u:
      zxnextSpritesMirrorWrite((reg & 0xffu) - 0x35u, byteValue);
      break;
    case 0x75u:
    case 0x76u:
    case 0x77u:
    case 0x78u:
    case 0x79u:
      zxnextSpritesMirrorWrite((reg & 0xffu) - 0x75u, byteValue);
      zxnextSpriteMirrorQ = (uint8_t)(((zxnextSpriteMirrorQ + 1u) & 0x7fu) | (zxnextSpritePatternSubIndex ? 0x80u : 0x00u));
      zxnextSpritesMirrorNumberChanged();
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
  zxnextSpritesAttrNumberChanged();
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
    zxnextSpritesAttrNumberChanged();
  }
}

/*
 * Where a pattern pixel lands on screen for one of the 8 transform variants.
 *
 * Both pattern memories hold every variant precomputed, indexed by the *screen* pixel (row << 4 | col
 * within the 16x16 cell), so the renderer reads straight through. The mapping is the inverse of the
 * FPGA's read address (`_input/next-fpga/src/video/sprites.vhd`, `spr_pattern_addr_start`/`_delta`):
 *
 *   no rotate:  pattern row = ymirror ? 15 - sy : sy,   pattern col = xmirror ? 15 - sx : sx
 *   rotate:     pattern row = xmirror ? sx : 15 - sx,   pattern col = ymirror ? 15 - sy : sy
 *
 * i.e. the hardware rotates 90 degrees clockwise first and mirrors in screen space afterwards
 * ("rotation inverts x mirror"). `variant` is `rotate << 2 | xmirror << 1 | ymirror`.
 */
static uint32_t zxnextSpritesVariantScreenOffset(uint32_t variant, uint32_t row, uint32_t col) {
  uint32_t rotate = (variant >> 2u) & 1u;
  uint32_t xmirror = (variant >> 1u) & 1u;
  uint32_t ymirror = variant & 1u;
  uint32_t sx;
  uint32_t sy;
  if (rotate) {
    sx = xmirror ? row : 15u - row;
    sy = ymirror ? 15u - col : col;
  } else {
    sx = xmirror ? 15u - col : col;
    sy = ymirror ? 15u - row : row;
  }
  return (sy << 4u) | sx;
}

/*
 * One byte written to pattern memory through port $5B.
 *
 * The hardware has a single 16K pattern memory addressed by `patternIndex << 8 | subIndex`; the 8-bit
 * and 4-bit engines read it two ways (FPGA `spr_pat_addr`, `spr_nibble_data`):
 *
 * - **8-bit** pattern N is the 256 bytes at N * 256, one byte per pixel.
 * - **4-bit** pattern P is the 128 bytes at P * 128, where P = N * 2 + N6: byte b holds two pixels,
 *   the **high nibble** at pixel address 2b and the low nibble at 2b + 1.
 *
 * So the same write is an 8-bit pixel of pattern N and two 4-bit pixels of pattern
 * `address >> 7`. Both are fanned out to the 8 precomputed transform variants.
 */
static void zxnextSpritesWritePort5b(uint32_t value) {
  uint8_t byteValue = (uint8_t)value;
  uint32_t subIndex = zxnextSpritePatternSubIndex;

  uint32_t base8 = (uint32_t)zxnextSpritePatternIndex << 3u;
  uint32_t row8 = subIndex >> 4u;
  uint32_t col8 = subIndex & 0x0fu;

  uint32_t pattern4 = ((uint32_t)zxnextSpritePatternIndex << 1u) | ((subIndex >> 7u) & 1u);
  uint32_t base4 = pattern4 << 3u;
  uint32_t pixel4High = (subIndex & 0x7fu) << 1u;
  uint32_t pixel4Low = pixel4High | 1u;

  for (uint32_t variant = 0u; variant < 8u; variant++) {
    zxnextSpritePatternMemory8[base8 + variant][zxnextSpritesVariantScreenOffset(variant, row8, col8)] =
      byteValue;
    zxnextSpritePatternMemory4[base4 + variant][
      zxnextSpritesVariantScreenOffset(variant, pixel4High >> 4u, pixel4High & 0x0fu)
    ] = (uint8_t)(byteValue >> 4u);
    zxnextSpritePatternMemory4[base4 + variant][
      zxnextSpritesVariantScreenOffset(variant, pixel4Low >> 4u, pixel4Low & 0x0fu)
    ] = (uint8_t)(byteValue & 0x0fu);
  }

  zxnextSpritePatternSubIndex = (uint8_t)(zxnextSpritePatternSubIndex + 1u);
  if (zxnextSpritePatternSubIndex == 0u) {
    zxnextSpritePatternIndex = (uint8_t)((zxnextSpritePatternIndex + 1u) & 0x3fu);
  }
}

/*
 * Latch the collision flag (status bit 0).
 *
 * Set by the renderer when a sprite writes an opaque pixel onto one another sprite already wrote on the
 * same line — FPGA `status_reg_s(0) <= ... or (spr_line_data_o(8) and spr_line_we)`. Sticky until
 * port $303B is read, like the hardware's.
 */
static void zxnextSpritesSignalCollision(void) { zxnextSpriteCollision = 1u; }

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
