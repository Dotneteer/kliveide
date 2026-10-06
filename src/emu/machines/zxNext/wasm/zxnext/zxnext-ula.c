#include "zxnext-ula.h"
#include "zxnext-keyboard.h"
#include "zxnext-layer2.h"
#include "zxnext-memory.h"
#include "zxnext-palette.h"
#include "zxnext-sprites.h"
#include "zxnext-tape.h"
#include "zxnext-tilemap.h"

#define ZXNEXT_SCREEN_TOTAL_HC zxnextTimingTotalHc
#define ZXNEXT_STANDARD_SCREEN_WIDTH 256u
#define ZXNEXT_STANDARD_SCREEN_SCALE_X 2u
#define ZXNEXT_STANDARD_SCREEN_OUTPUT_WIDTH (ZXNEXT_STANDARD_SCREEN_WIDTH * ZXNEXT_STANDARD_SCREEN_SCALE_X)
#define ZXNEXT_STANDARD_SCREEN_HEIGHT 192u
#define ZXNEXT_STANDARD_SCREEN_X 96u
/*
 * The paper's buffer row: display start minus the first buffer line - 48 at 50 Hz, 24 at 60 Hz (as the
 * TypeScript core frames it). At 60 Hz the 320x256 layers start at row -8: the unsigned row wraps to a
 * huge value and zxnextRenderRowOff skips it.
 */
#define ZXNEXT_STANDARD_SCREEN_Y (zxnextTimingDisplayYStart - zxnextTimingFirstVc)
#define ZXNEXT_LAYER2_320_SCREEN_WIDTH 320u
#define ZXNEXT_LAYER2_320_SCREEN_OUTPUT_WIDTH (ZXNEXT_LAYER2_320_SCREEN_WIDTH * ZXNEXT_STANDARD_SCREEN_SCALE_X)
#define ZXNEXT_LAYER2_WIDE_SCREEN_HEIGHT 256u
#define ZXNEXT_LAYER2_WIDE_SCREEN_X 32u
#define ZXNEXT_LAYER2_WIDE_SCREEN_Y (ZXNEXT_STANDARD_SCREEN_Y - ((ZXNEXT_LAYER2_WIDE_SCREEN_HEIGHT - ZXNEXT_STANDARD_SCREEN_HEIGHT) / 2u))
#define ZXNEXT_TRANSPARENT_PIXEL 0x00000000u
#define ZXNEXT_BLANK_BORDER_PIXEL 0xffb6b6b6u
#define ZXNEXT_LAYER2_RAM_OFFSET 0x040000u
#define ZXNEXT_LORES_BANK_05_OFFSET 0x054000u
#define ZXNEXT_BANK_07_OFFSET 0x05c000u

/*
 * Where the renderers draw, and which buffer rows they may touch.
 *
 * The whole-frame renderers below draw the picture from the *current* register and memory state.
 * By default they draw the whole of `zxnextPixelBuffer` (what `zxnextRenderInstantScreen` does).
 * The raster (see "Beam-racing raster" at the end of this file) points them at a scratch buffer and
 * a narrow row window, so a mid-frame state change - a copper MOVE, a palette write, a border OUT -
 * only affects the pixels the beam draws after it.
 */
static uint32_t* zxnextRenderTarget = zxnextPixelBuffer;
static uint32_t zxnextRenderRowFirst = 0u;
static uint32_t zxnextRenderRowLast = ZXNEXT_SCREEN_HEIGHT - 1u;

static inline uint32_t zxnextRenderRowOff(uint32_t bufferRow) {
  return bufferRow < zxnextRenderRowFirst || bufferRow > zxnextRenderRowLast;
}

/*
 * Per-layer output, composed per pixel by zxnextUlaCompose (zxnext.vhd, video pipeline stage 2).
 *
 * The renderers used to paint RGBA straight into the picture in a fixed order (ULA, tilemap, Layer 2,
 * sprites), so NextReg $15 layer priorities, the Layer 2 priority bit, tilemap-below-ULA pixels, stencil
 * mode and blend modes could not be honoured. Each layer now writes one 16-bit value per buffer pixel:
 * 0 = transparent (nothing drawn), otherwise ZXNEXT_PX_OPAQUE | 9-bit RGB, plus flags.
 */
#define ZXNEXT_PX_RGB 0x01ffu
#define ZXNEXT_PX_L2_PRIORITY 0x0200u
#define ZXNEXT_PX_TM_BELOW 0x0400u
#define ZXNEXT_PX_BORDER 0x0800u
#define ZXNEXT_PX_OPAQUE 0x8000u

static uint16_t zxnextLayerUla[ZXNEXT_PIXEL_COUNT];
static uint16_t zxnextLayerTm[ZXNEXT_PIXEL_COUNT];
static uint16_t zxnextLayerL2[ZXNEXT_PIXEL_COUNT];
static uint16_t zxnextLayerSpr[ZXNEXT_PIXEL_COUNT];

static inline uint16_t zxnextPx(uint32_t rgb333) {
  return (uint16_t)(ZXNEXT_PX_OPAQUE | (rgb333 & ZXNEXT_PX_RGB));
}

static uint8_t ulaFlashCounter;
static uint8_t ulaFlashFlag;
static uint8_t ulaScrollX;
static uint8_t ulaScrollY;

/*
 * The border colour, ULA scroll, Timex screen mode (port $FF bits 5-0) and half-pixel scroll ($68 bit 2)
 * the picture shows. The ULA takes a port $FE / $FF or NextReg $26 / $27 / $69 / $68-bit-2 write only at
 * its next 8-pixel latch point (zxula.vhd attr_reg, px/py/screen_mode; the fine bit is px(8)), so each
 * write is kept as a
 * pending latch and applied by the raster when drawing reaches that point (zxnextRasterRenderTo).
 * The registers above keep the written values for readback.
 */
#define ZXNEXT_ULA_LATCH_BORDER 0u
#define ZXNEXT_ULA_LATCH_SCROLL_X 1u
#define ZXNEXT_ULA_LATCH_SCROLL_Y 2u
#define ZXNEXT_ULA_LATCH_TIMEX 3u
#define ZXNEXT_ULA_LATCH_FINE_SCROLL 4u
#define ZXNEXT_ULA_LATCH_COUNT 5u
static uint8_t ulaShown[ZXNEXT_ULA_LATCH_COUNT];
static uint8_t ulaLatchPending[ZXNEXT_ULA_LATCH_COUNT];
static uint8_t ulaLatchValue[ZXNEXT_ULA_LATCH_COUNT];
static uint32_t ulaLatchTact[ZXNEXT_ULA_LATCH_COUNT];
#define ulaBorderShown ulaShown[ZXNEXT_ULA_LATCH_BORDER]
#define ulaScrollXShown ulaShown[ZXNEXT_ULA_LATCH_SCROLL_X]
#define ulaScrollYShown ulaShown[ZXNEXT_ULA_LATCH_SCROLL_Y]
#define ulaTimexShown ulaShown[ZXNEXT_ULA_LATCH_TIMEX]
#define ulaFineScrollShown ulaShown[ZXNEXT_ULA_LATCH_FINE_SCROLL]

/* Defined with the raster at the end of this file. */
static uint32_t zxnextRasterBorderTact(uint32_t frameTact);
static uint32_t zxnextRasterUlaScrollTact(uint32_t frameTact);
static uint32_t zxnextRasterWriteTact(void);
static uint32_t zxnextUlaScreenMode(void);

static void zxnextUlaScheduleLatch(uint32_t which, uint32_t value, uint32_t frameTact) {
  ulaLatchPending[which] = 1u;
  ulaLatchValue[which] = (uint8_t)value;
  ulaLatchTact[which] = frameTact;
}

/* Applies every pending latch now (frame end, reset). */
static void zxnextUlaApplyAllLatches(void) {
  for (uint32_t i = 0; i < ZXNEXT_ULA_LATCH_COUNT; i++) {
    if (ulaLatchPending[i]) ulaShown[i] = ulaLatchValue[i];
    ulaLatchPending[i] = 0u;
  }
}
static uint8_t ulaClipWindow[4];
static uint8_t ulaClipIndex;
static uint8_t ulaDisableOutput;
static uint8_t ulaBlendingInSluModes;
static uint8_t ulaHalfPixelScroll;
static uint8_t ulaEnableStencilMode;
/* zxnext.vhd port_ff3b_ulap_en: ULA+ palette mapping, set by NextReg $68 bit 3 or port $FF3B (group 01). */
static uint8_t ulaPlusEnabled;
/* zxnext.vhd port_bf3b_ulap_mode / port_bf3b_ulap_index. */
static uint8_t ulaPlusMode;
static uint8_t ulaPlusIndex;
static uint32_t ulaPortBit4ChangedFrom0Tacts;
static uint32_t ulaPortBit4ChangedFrom1Tacts;

static void zxnextUlaReset(void) {
  portFeValue = 0xffu;
  portTimexValue = 0u;
  borderColor = 7u;
  earBit = 0u;
  micBit = 0u;
  ulaFlashCounter = 0u;
  ulaFlashFlag = 0u;
  ulaScrollX = 0u;
  ulaScrollY = 0u;
  for (uint32_t i = 0; i < ZXNEXT_ULA_LATCH_COUNT; i++) ulaLatchPending[i] = 0u;
  ulaBorderShown = 7u;
  ulaScrollXShown = 0u;
  ulaScrollYShown = 0u;
  ulaTimexShown = 0u;
  ulaFineScrollShown = 0u;
  ulaClipWindow[0] = 0u;
  ulaClipWindow[1] = 255u;
  ulaClipWindow[2] = 0u;
  ulaClipWindow[3] = 191u;
  ulaClipIndex = 0u;
  ulaDisableOutput = 0u;
  ulaBlendingInSluModes = 0u;
  ulaHalfPixelScroll = 0u;
  ulaEnableStencilMode = 0u;
  ulaPlusEnabled = 0u;
  zxnextKeyboardSetCancelExtended(0u); /* nr_68_cancel_extended_keys <= '0' (~5006) */
  ulaPlusMode = 0u;
  ulaPlusIndex = 0u;
  ulaPortBit4ChangedFrom0Tacts = 0u;
  ulaPortBit4ChangedFrom1Tacts = 0u;
  for (uint32_t i = 0; i < ZXNEXT_PIXEL_COUNT; i++) {
    zxnextPixelBuffer[i] = ZXNEXT_TRANSPARENT_PIXEL;
  }
}

static inline uint32_t zxnextUlaReadPortFe(uint32_t address) {
  uint8_t portValue = (uint8_t)zxnextKeyboardReadPort(address);
  uint8_t bit4Sensed = earBit;
  if (!bit4Sensed && ulaPortBit4ChangedFrom1Tacts > ulaPortBit4ChangedFrom0Tacts) {
    uint32_t chargeTime = ulaPortBit4ChangedFrom1Tacts - ulaPortBit4ChangedFrom0Tacts;
    chargeTime = chargeTime > 700u ? 2800u : 4u * chargeTime;
    bit4Sensed = (tacts - ulaPortBit4ChangedFrom1Tacts) < chargeTime;
  }
  uint8_t bit6 = 0u;
  if (bit4Sensed) bit6 = 0x40u;
  if (micBit && ((zxnextNextRegs[0x08u] & 0x01u) != 0u)) bit6 = 0x40u;
  return (portValue & 0xbfu) | bit6;
}

static inline void zxnextUlaWritePortFe(uint32_t value) {
  uint8_t byteValue = (uint8_t)value;
  portFeValue = byteValue;
  /* Only a new colour moves the latch: beeper writes repeat the colour without a raster catch-up, and
   * re-scheduling would push an earlier change that has not been drawn yet to a later latch point. */
  if ((byteValue & 0x07u) != borderColor) {
    borderColor = byteValue & 0x07u;
    zxnextUlaScheduleLatch(ZXNEXT_ULA_LATCH_BORDER, borderColor, zxnextRasterBorderTact(currentFrameTact));
  }
  micBit = (byteValue & 0x08u) != 0u;
  uint8_t bit4 = (byteValue & 0x10u) != 0u;
  if (earBit && !bit4) {
    ulaPortBit4ChangedFrom1Tacts = tacts;
  } else if (!earBit && bit4) {
    ulaPortBit4ChangedFrom0Tacts = tacts;
  }
  earBit = bit4;
}

static inline uint32_t zxnextUlaRgb333Color(uint32_t rgb333) {
  static const uint32_t levels[8] = { 0x00u, 0x24u, 0x49u, 0x6du, 0x92u, 0xb6u, 0xdbu, 0xffu };
  uint32_t red = levels[(rgb333 >> 6u) & 0x07u];
  uint32_t green = levels[(rgb333 >> 3u) & 0x07u];
  uint32_t blue = levels[rgb333 & 0x07u];
  return 0xff000000u | (blue << 16u) | (green << 8u) | red;
}

static inline uint32_t zxnextUlaPaletteColor(uint32_t index) {
  uint32_t palette = (zxnextPaletteGetControl() & 0x02u) ? 4u : 0u;
  return zxnextUlaRgb333Color(zxnextPaletteGetEntry(palette, index));
}

/*
 * A ULA pixel (LoRes and border included), encoded for the ULA layer buffer: transparent when its
 * colour's upper 8 bits equal the global transparency colour $14 (zxnext.vhd
 * `ula_mix_transparent <= ... ula_rgb_2(8 downto 1) = transparent_rgb_2`). Clipped pixels are transparent
 * too; what shows through is decided by zxnextUlaCompose.
 */
/* Not a palette index: the ULA selects the fallback colour $4A (zxula.vhd ula_select_bgnd). */
#define ZXNEXT_ULA_SELECT_FALLBACK 0x100u

static inline uint32_t zxnextUlaFallbackRgb(void) {
  uint32_t fb = zxnextNextRegs[0x4au];
  return ((fb << 1u) | ((fb & 0x03u) != 0u ? 1u : 0u)) & 0x1ffu;
}

static inline uint32_t zxnextUlaPx(uint32_t index) {
  uint32_t entry;
  if (index == ZXNEXT_ULA_SELECT_FALLBACK) {
    // --- zxnext.vhd ~6933: the fallback replaces the palette colour before the $14 compare.
    entry = zxnextUlaFallbackRgb();
  } else {
    uint32_t palette = (zxnextPaletteGetControl() & 0x02u) ? 4u : 0u;
    entry = zxnextPaletteGetEntry(palette, index) & 0x1ffu;
  }
  if ((entry >> 1u) == zxnextNextRegs[0x14u]) return 0u;
  return zxnextPx(entry);
}

/*
 * The ULA palette index of an ink or paper pixel (zxula.vhd ~484-553, "Standard ULA, ULAnext, ULA+").
 * ULANext (NextReg $43 bit 0), format f = NextReg $42: ink = attr and f; paper = $80 | attr >> bits(f)
 * for f = $01, $03, ... $7F, the fallback colour for any other f. ULA+: "11" & attr(7:6) & bit 3 &
 * ink attr(2:0) or paper attr(5:3), where bit 3 is 1 for paper and Timex screen mode bit 2 for ink.
 * Neither has FLASH or (ULA+) BRIGHT.
 */
static inline uint32_t zxnextUlaAttrPaletteIndex(uint32_t attr, uint32_t ink) {
  if (zxnextPaletteGetUlaNextEnabled()) {
    uint32_t format = zxnextNextRegs[0x42u];
    if (ink) return attr & format;
    switch (format) {
      case 0x01u: return 0x80u | (attr >> 1u);
      case 0x03u: return 0x80u | (attr >> 2u);
      case 0x07u: return 0x80u | (attr >> 3u);
      case 0x0fu: return 0x80u | (attr >> 4u);
      case 0x1fu: return 0x80u | (attr >> 5u);
      case 0x3fu: return 0x80u | (attr >> 6u);
      case 0x7fu: return 0x80u | (attr >> 7u);
      default: return ZXNEXT_ULA_SELECT_FALLBACK;
    }
  }
  if (ulaPlusEnabled) {
    uint32_t group = (attr >> 6u) << 4u;
    return ink
      ? (0xc0u | group | ((zxnextUlaScreenMode() & 0x04u) ? 0x08u : 0u) | (attr & 0x07u))
      : (0xc8u | group | ((attr >> 3u) & 0x07u));
  }
  uint32_t brightOffset = (attr & 0x40u) ? 0x08u : 0x00u;
  uint32_t inkIndex = (attr & 0x07u) + brightOffset;
  uint32_t paperIndex = ((attr >> 3u) & 0x07u) + brightOffset + 0x10u;
  if (ulaFlashFlag && (attr & 0x80u)) {
    uint32_t swap = inkIndex;
    inkIndex = paperIndex;
    paperIndex = swap;
  }
  return ink ? inkIndex : paperIndex;
}

/* zxula.vhd ~191: the screen mode is port $FF bits 2-0, forced to 0 while the 128K shadow screen
 * (bank 7, which has no second display file) is displayed. */
static uint32_t zxnextUlaScreenMode(void) {
  return zxnextMemoryShadowScreen() ? 0u : (ulaTimexShown & 0x07u);
}

/* zxula.vhd ~431 border_clr_tmx: the HiRes attribute "01" & not n & n, n = port $FF bits 5-3. It is
 * attr_reg in the paper and the border, decoded like any attribute. */
static inline uint32_t zxnextUlaHiResAttr(void) {
  uint32_t n = (ulaTimexShown >> 3u) & 0x07u;
  return 0x40u | ((~n & 0x07u) << 3u) | n;
}

/* zxula.vhd ~232: the pixel byte; screen mode bit 0 selects the second display file at $6000. */
static inline uint32_t zxnextUlaBitmapAddress(uint32_t mode, uint32_t y, uint32_t xByte) {
  return 0x4000u | ((mode & 0x01u) << 13u) | ((y & 0xc0u) << 5u) | ((y & 0x07u) << 8u) | ((y & 0x38u) << 2u) | xByte;
}

/* zxula.vhd ~236-250: the attribute byte - with mode bit 1 (HiColor) $6000 + the pixel offset,
 * otherwise $5800, or $7800 with mode bit 0. HiRes fetches its second pixel byte here too. */
static inline uint32_t zxnextUlaAttributeAddress(uint32_t mode, uint32_t y, uint32_t xByte) {
  if ((mode & 0x02u) != 0u) return 0x2000u | zxnextUlaBitmapAddress(0u, y, xByte);
  return 0x5800u | ((mode & 0x01u) << 13u) | ((y >> 3u) << 5u) | xByte;
}

static inline uint32_t zxnextUlaIsClipped(uint32_t x, uint32_t y) {
  return x < ulaClipWindow[0] || x > ulaClipWindow[1] || y < ulaClipWindow[2] || y > ulaClipWindow[3];
}

static inline uint32_t zxnextUlaLoResWrappedY(uint32_t y) {
  if (y >= 192u) {
    return ((((y >> 6u) + 1u) & 0x03u) << 6u) | (y & 0x3fu);
  }
  return y & 0xffu;
}

/* One ULA pixel of screen modes 0-3: screen row sourceY, screen x sourceX (both already scrolled). */
static uint32_t zxnextUlaStandardPixel(uint32_t mode, uint32_t sourceY, uint32_t sourceX) {
  uint32_t sourceXByte = sourceX >> 3u;
  uint8_t pixels = (uint8_t)zxnextMemoryReadScreenOffset(zxnextUlaBitmapAddress(mode, sourceY, sourceXByte));
  uint8_t attr = (uint8_t)zxnextMemoryReadScreenOffset(zxnextUlaAttributeAddress(mode, sourceY, sourceXByte));
  uint32_t mask = 0x80u >> (sourceX & 0x07u);
  return zxnextUlaPx(zxnextUlaAttrPaletteIndex(attr, (pixels & mask) != 0u));
}

/* Screen modes 0-3 (standard, second display file, HiColor): one pipeline, the mode only picks the
 * fetch addresses (zxula.vhd ~230-250). */
static void zxnextUlaRenderStandardScreen(void) {
  uint32_t fallbackPixel = 0u /* clipped: transparent */;
  uint32_t mode = zxnextUlaScreenMode();
  for (uint32_t y = 0; y < ZXNEXT_STANDARD_SCREEN_HEIGHT; y++) {
    if (zxnextRenderRowOff(ZXNEXT_STANDARD_SCREEN_Y + y)) continue;
    uint32_t outputOffset = (ZXNEXT_STANDARD_SCREEN_Y + y) * ZXNEXT_SCREEN_WIDTH + ZXNEXT_STANDARD_SCREEN_X;
    uint32_t sourceY = (y + ulaScrollYShown) % ZXNEXT_STANDARD_SCREEN_HEIGHT;
    for (uint32_t x = 0; x < 256u; x++) {
      uint32_t pixelOffset = outputOffset + x * ZXNEXT_STANDARD_SCREEN_SCALE_X;
      if (zxnextUlaIsClipped(x, y)) {
        zxnextLayerUla[pixelOffset] = fallbackPixel;
        zxnextLayerUla[pixelOffset + 1u] = fallbackPixel;
        continue;
      }
      uint32_t pixel = zxnextUlaStandardPixel(mode, sourceY, (x + ulaScrollXShown) & 0xffu);
      zxnextLayerUla[pixelOffset] = pixel;
      /* zxula.vhd ~397: the half-pixel scroll ($68 bit 2) loads the shift register one more 14 MHz
       * half pixel to the left, so the second half of paper x is the first half of screen x + 1 */
      zxnextLayerUla[pixelOffset + 1u] =
        ulaFineScrollShown ? zxnextUlaStandardPixel(mode, sourceY, (x + 1u + ulaScrollXShown) & 0xffu) : pixel;
    }
  }
}

/*
 * Screen modes 4-7 (HiRes): each column's pixel byte then its attribute-address byte ($6000 + the pixel
 * offset in mode 6), one buffer pixel per bit (zxula.vhd ~391-395). The scroll moves 2 * $26 half
 * pixels, and the half-pixel scroll one more (~397).
 */
static void zxnextUlaRenderHiResScreen(void) {
  uint32_t fallbackPixel = 0u /* clipped: transparent */;
  uint32_t mode = zxnextUlaScreenMode();
  uint32_t tmxAttr = zxnextUlaHiResAttr();
  uint32_t inkPixel = zxnextUlaPx(zxnextUlaAttrPaletteIndex(tmxAttr, 1u));
  uint32_t paperPixel = zxnextUlaPx(zxnextUlaAttrPaletteIndex(tmxAttr, 0u));
  for (uint32_t y = 0; y < ZXNEXT_STANDARD_SCREEN_HEIGHT; y++) {
    if (zxnextRenderRowOff(ZXNEXT_STANDARD_SCREEN_Y + y)) continue;
    uint32_t outputOffset = (ZXNEXT_STANDARD_SCREEN_Y + y) * ZXNEXT_SCREEN_WIDTH + ZXNEXT_STANDARD_SCREEN_X;
    uint32_t sourceY = (y + ulaScrollYShown) % ZXNEXT_STANDARD_SCREEN_HEIGHT;
    for (uint32_t x = 0; x < ZXNEXT_STANDARD_SCREEN_OUTPUT_WIDTH; x++) {
      uint32_t logicalX = x >> 1u;
      uint32_t pixelOffset = outputOffset + x;
      if (zxnextUlaIsClipped(logicalX, y)) {
        zxnextLayerUla[pixelOffset] = fallbackPixel;
        continue;
      }
      uint32_t sourceX = (x + ((uint32_t)ulaScrollXShown << 1u) + (ulaFineScrollShown ? 1u : 0u)) & 0x1ffu;
      uint32_t sourceXByte = sourceX >> 4u;
      uint32_t pixelInWord = sourceX & 0x0fu;
      uint32_t pixelAddr = pixelInWord < 8u
        ? zxnextUlaBitmapAddress(mode, sourceY, sourceXByte)
        : zxnextUlaAttributeAddress(mode, sourceY, sourceXByte);
      uint8_t pixels = (uint8_t)zxnextMemoryReadScreenOffset(pixelAddr);
      uint32_t mask = 0x80u >> (pixelInWord & 0x07u);
      zxnextLayerUla[pixelOffset] = (pixels & mask) ? inkPixel : paperPixel;
    }
  }
}

static void zxnextUlaRenderLoResScreen(void) {
  uint32_t fallbackPixel = 0u /* clipped: transparent */;
  uint32_t scrollX = zxnextLoResGetScrollX();
  uint32_t scrollY = zxnextLoResGetScrollY();
  uint32_t paletteOffset = zxnextLoResGetPaletteOffset();
  uint32_t radastanMode = zxnextLoResGetRadastanMode();
  uint32_t radastanDFile = ((portTimexValue & 0x01u) != 0u) ^ ((zxnextLayer2GetNextReg(0x6au) & 0x10u) != 0u);

  for (uint32_t y = 0; y < ZXNEXT_STANDARD_SCREEN_HEIGHT; y++) {
    if (zxnextRenderRowOff(ZXNEXT_STANDARD_SCREEN_Y + y)) continue;
    uint32_t outputOffset = (ZXNEXT_STANDARD_SCREEN_Y + y) * ZXNEXT_SCREEN_WIDTH + ZXNEXT_STANDARD_SCREEN_X;
    uint32_t sourceY = zxnextUlaLoResWrappedY(y + scrollY);
    for (uint32_t x = 0; x < ZXNEXT_STANDARD_SCREEN_OUTPUT_WIDTH; x++) {
      uint32_t displayX = x >> 1u;
      uint32_t pixelOffset = outputOffset + x;
      if (zxnextUlaIsClipped(displayX, y)) {
        zxnextLayerUla[pixelOffset] = fallbackPixel;
        continue;
      }

      uint32_t sourceX = (displayX + scrollX) & 0xffu;
      uint32_t paletteIndex;
      if (!radastanMode) {
        uint32_t blockAddr = zxnextLoResStandardAddress(sourceX >> 1u, sourceY >> 1u);
        uint8_t block = (uint8_t)zxnextMemoryReadPhysical(ZXNEXT_LORES_BANK_05_OFFSET + (blockAddr & 0x3fffu));
        uint32_t highNibble = ((block >> 4u) + paletteOffset) & 0x0fu;
        paletteIndex = (highNibble << 4u) | (block & 0x0fu);
      } else {
        uint32_t blockAddr = zxnextLoResRadastanAddress(sourceX >> 2u, sourceY >> 1u, radastanDFile);
        uint8_t block = (uint8_t)zxnextMemoryReadPhysical(ZXNEXT_LORES_BANK_05_OFFSET + (blockAddr & 0x3fffu));
        uint32_t nibble = (sourceX & 0x02u) ? (block & 0x0fu) : ((block >> 4u) & 0x0fu);
        paletteIndex = ((paletteOffset & 0x0fu) << 4u) | nibble;
      }
      zxnextLayerUla[pixelOffset] = zxnextUlaPx(paletteIndex);
    }
  }
}

static inline uint32_t zxnextUlaLayer2WrappedY(uint32_t y) {
  return zxnextUlaLoResWrappedY(y);
}

static inline uint32_t zxnextUlaLayer2WideWrappedX(uint32_t x) {
  x &= 0x3ffu;
  if (x >= 320u) {
    uint32_t upper = ((x >> 6u) & 0x07u) + 3u;
    x = (upper << 6u) | (x & 0x3fu);
  }
  return x & 0x1ffu;
}

/* A Layer 2 pixel byte, or ZXNEXT_L2_NO_PIXEL past the 2 MB SRAM: layer2.vhd takes SRAM bank
 * $12 + 16 + segment and disables the pixel when that sets address bit 21 (bank >= 128). */
#define ZXNEXT_L2_NO_PIXEL 0xffffffffu
static uint32_t zxnextUlaReadLayer2Pixel(uint32_t bank16, uint32_t offset) {
  uint32_t segment16K = (offset >> 14u) & 0x07u;
  if (bank16 + segment16K + 16u >= 128u) return ZXNEXT_L2_NO_PIXEL;
  uint32_t half8K = (offset >> 13u) & 0x01u;
  uint32_t bank8K = ((bank16 + segment16K) << 1u) | half8K;
  return zxnextMemoryReadPhysical(ZXNEXT_LAYER2_RAM_OFFSET + (bank8K << 13u) + (offset & 0x1fffu));
}

static void zxnextUlaRenderLayer2_256x192Screen(void) {
  /* zxnext.vhd ~4203: the display always uses $12; $123B bit 3 ($13) is for paging only */
  uint32_t bank16 = zxnextLayer2GetActiveRamBank();
  uint32_t scrollX = zxnextLayer2GetScrollX();
  uint32_t scrollY = zxnextLayer2GetScrollY();
  uint32_t paletteOffset = zxnextLayer2GetPaletteOffset() & 0x0fu;
  uint32_t clipX1 = zxnextLayer2GetClip(0);
  uint32_t clipX2 = zxnextLayer2GetClip(1);
  uint32_t clipY1 = zxnextLayer2GetClip(2);
  uint32_t clipY2 = zxnextLayer2GetClip(3);
  // --- Layer 2 is transparent where its palette-mapped RGB equals $14 (zxnext.vhd `layer2_transparent`).
  // --- $4B is the sprite transparency index and has no say here.
  uint32_t transparentRgb = zxnextNextRegs[0x14u];

  for (uint32_t y = 0; y < ZXNEXT_STANDARD_SCREEN_HEIGHT; y++) {
    if (zxnextRenderRowOff(ZXNEXT_STANDARD_SCREEN_Y + y)) continue;
    if (y < clipY1 || y > clipY2) continue;
    uint32_t sourceY = zxnextUlaLayer2WrappedY(y + scrollY);
    uint32_t outputOffset = (ZXNEXT_STANDARD_SCREEN_Y + y) * ZXNEXT_SCREEN_WIDTH + ZXNEXT_STANDARD_SCREEN_X;
    for (uint32_t x = 0; x < ZXNEXT_STANDARD_SCREEN_OUTPUT_WIDTH; x++) {
      uint32_t displayX = x >> 1u;
      if (displayX < clipX1 || displayX > clipX2) continue;

      uint32_t sourceX = (displayX + scrollX) & 0xffu;
      uint32_t pixelValue = zxnextUlaReadLayer2Pixel(bank16, (sourceY << 8u) | sourceX);
      if (pixelValue == ZXNEXT_L2_NO_PIXEL) continue;
      uint32_t highNibble = ((pixelValue >> 4u) + paletteOffset) & 0x0fu;
      uint32_t paletteIndex = (highNibble << 4u) | (pixelValue & 0x0fu);
      uint32_t entryRaw = zxnextPaletteGetLayer2Entry(paletteIndex);
      uint32_t entry = entryRaw & 0x1ffu;
      if ((entry >> 1u) == transparentRgb) continue;
      zxnextLayerL2[outputOffset + x] = (uint16_t)(zxnextPx(entry) | ((entryRaw & 0x200u) ? ZXNEXT_PX_L2_PRIORITY : 0u));
    }
  }
}

static void zxnextUlaRenderLayer2_320x256Screen(void) {
  /* zxnext.vhd ~4203: the display always uses $12; $123B bit 3 ($13) is for paging only */
  uint32_t bank16 = zxnextLayer2GetActiveRamBank();
  uint32_t scrollX = zxnextLayer2GetScrollX();
  uint32_t scrollY = zxnextLayer2GetScrollY();
  uint32_t paletteOffset = zxnextLayer2GetPaletteOffset() & 0x0fu;
  uint32_t clipX1 = zxnextLayer2GetClip(0) << 1u;
  uint32_t clipX2 = (zxnextLayer2GetClip(1) << 1u) | 0x01u;
  uint32_t clipY1 = zxnextLayer2GetClip(2);
  uint32_t clipY2 = zxnextLayer2GetClip(3);
  // --- Layer 2 is transparent where its palette-mapped RGB equals $14 (zxnext.vhd `layer2_transparent`).
  // --- $4B is the sprite transparency index and has no say here.
  uint32_t transparentRgb = zxnextNextRegs[0x14u];

  for (uint32_t y = 0; y < ZXNEXT_LAYER2_WIDE_SCREEN_HEIGHT; y++) {
    if (zxnextRenderRowOff(ZXNEXT_LAYER2_WIDE_SCREEN_Y + y)) continue;
    if (y < clipY1 || y > clipY2) continue;
    uint32_t sourceY = (y + scrollY) & 0xffu;
    uint32_t outputOffset = (ZXNEXT_LAYER2_WIDE_SCREEN_Y + y) * ZXNEXT_SCREEN_WIDTH + ZXNEXT_LAYER2_WIDE_SCREEN_X;
    for (uint32_t x = 0; x < ZXNEXT_LAYER2_320_SCREEN_OUTPUT_WIDTH; x++) {
      uint32_t displayX = x >> 1u;
      if (displayX < clipX1 || displayX > clipX2) continue;

      uint32_t sourceX = zxnextUlaLayer2WideWrappedX(displayX + scrollX);
      uint32_t pixelValue = zxnextUlaReadLayer2Pixel(bank16, (sourceX << 8u) | sourceY);
      if (pixelValue == ZXNEXT_L2_NO_PIXEL) continue;
      uint32_t highNibble = ((pixelValue >> 4u) + paletteOffset) & 0x0fu;
      uint32_t paletteIndex = (highNibble << 4u) | (pixelValue & 0x0fu);
      uint32_t entryRaw = zxnextPaletteGetLayer2Entry(paletteIndex);
      uint32_t entry = entryRaw & 0x1ffu;
      if ((entry >> 1u) == transparentRgb) continue;
      zxnextLayerL2[outputOffset + x] = (uint16_t)(zxnextPx(entry) | ((entryRaw & 0x200u) ? ZXNEXT_PX_L2_PRIORITY : 0u));
    }
  }
}

static void zxnextUlaRenderLayer2_640x256Screen(void) {
  /* zxnext.vhd ~4203: the display always uses $12; $123B bit 3 ($13) is for paging only */
  uint32_t bank16 = zxnextLayer2GetActiveRamBank();
  uint32_t scrollX = zxnextLayer2GetScrollX();
  uint32_t scrollY = zxnextLayer2GetScrollY();
  uint32_t paletteOffset = zxnextLayer2GetPaletteOffset() & 0x0fu;
  uint32_t clipX1 = zxnextLayer2GetClip(0) << 1u;
  uint32_t clipX2 = (zxnextLayer2GetClip(1) << 1u) | 0x01u;
  uint32_t clipY1 = zxnextLayer2GetClip(2);
  uint32_t clipY2 = zxnextLayer2GetClip(3);
  // --- Layer 2 is transparent where its palette-mapped RGB equals $14 (zxnext.vhd `layer2_transparent`).
  // --- $4B is the sprite transparency index and has no say here.
  uint32_t transparentRgb = zxnextNextRegs[0x14u];

  for (uint32_t y = 0; y < ZXNEXT_LAYER2_WIDE_SCREEN_HEIGHT; y++) {
    if (zxnextRenderRowOff(ZXNEXT_LAYER2_WIDE_SCREEN_Y + y)) continue;
    if (y < clipY1 || y > clipY2) continue;
    uint32_t sourceY = (y + scrollY) & 0xffu;
    uint32_t outputOffset = (ZXNEXT_LAYER2_WIDE_SCREEN_Y + y) * ZXNEXT_SCREEN_WIDTH + ZXNEXT_LAYER2_WIDE_SCREEN_X;
    for (uint32_t displayClockX = 0; displayClockX < ZXNEXT_LAYER2_320_SCREEN_WIDTH; displayClockX++) {
      if (displayClockX < clipX1 || displayClockX > clipX2) continue;

      uint32_t sourceX = zxnextUlaLayer2WideWrappedX(displayClockX + scrollX);
      uint32_t pixelByte = zxnextUlaReadLayer2Pixel(bank16, (sourceX << 8u) | sourceY);
      if (pixelByte == ZXNEXT_L2_NO_PIXEL) continue;
      uint32_t outputPixel = outputOffset + (displayClockX << 1u);

      uint32_t entry1Raw = zxnextPaletteGetLayer2Entry((paletteOffset << 4u) | ((pixelByte >> 4u) & 0x0fu));
      uint32_t entry1 = entry1Raw & 0x1ffu;
      if ((entry1 >> 1u) != transparentRgb) {
        zxnextLayerL2[outputPixel] = (uint16_t)(zxnextPx(entry1) | ((entry1Raw & 0x200u) ? ZXNEXT_PX_L2_PRIORITY : 0u));
      }

      uint32_t entry2Raw = zxnextPaletteGetLayer2Entry((paletteOffset << 4u) | (pixelByte & 0x0fu));
      uint32_t entry2 = entry2Raw & 0x1ffu;
      if ((entry2 >> 1u) != transparentRgb) {
        zxnextLayerL2[outputPixel + 1u] = (uint16_t)(zxnextPx(entry2) | ((entry2Raw & 0x200u) ? ZXNEXT_PX_L2_PRIORITY : 0u));
      }
    }
  }
}

/*
 * A sprite's attributes as the FPGA's `spr_cur_attr_*` see them: relative sprites composed onto
 * their anchor, and every field decoded once.
 */
typedef struct {
  uint8_t visible;
  uint16_t x;
  uint16_t y;
  uint8_t paletteOffset;
  uint8_t xmirror;
  uint8_t ymirror;
  uint8_t rotate;
  uint8_t scaleX;
  uint8_t scaleY;
  uint8_t is4Bit;
  /* The 7-bit pattern number, `N5..N0 & N6` (FPGA `spr_rel_pattern`). */
  uint8_t pattern7;
} ZxnextResolvedSprite;

static ZxnextResolvedSprite zxnextUlaResolvedSprites[128];

/*
 * Which sprite-space pixels (320 x 256) a sprite has already written this render, for collision
 * detection. One byte per pixel, cleared at the start of each sprite pass.
 */
#define ZXNEXT_SPRITE_SPACE_WIDTH 320u
#define ZXNEXT_SPRITE_SPACE_HEIGHT 256u
static uint8_t zxnextUlaSpriteCoverage[ZXNEXT_SPRITE_SPACE_WIDTH * ZXNEXT_SPRITE_SPACE_HEIGHT];

static uint32_t zxnextUlaSignExtendScale9(uint32_t value8, uint32_t scale) {
  uint32_t value9 = (value8 & 0x80u) ? (value8 | 0x100u) : value8;
  return (value9 << scale) & 0x1ffu;
}

/*
 * Resolve the first `count` sprites in index order into `resolved`, as the FPGA qualifies them.
 *
 * The render resolves into its own cache, `zxnextUlaResolvedSprites`, up to the last visible sprite.
 * The IDE's Sprite Inspector resolves all 128 into a separate, volatile buffer
 * (`zxnextResolveSpritesForIde`), so reading the sprite table never writes machine state
 * (`.plans/SPRITE_INSPECTOR_PLAN.md` trap T3).
 *
 * Follows `_input/next-fpga/src/video/sprites.vhd` ("sort out relative sprite characteristics" and
 * the anchor latch in `S_QUALIFY`):
 *
 * - A sprite is **relative** when it has five attribute bytes and attr4 bits 7:6 are `01`. Every
 *   other sprite, visible or not, becomes the anchor for the relative sprites after it.
 * - An anchor's attr4 is `H N6 T XX YY Y8`: H selects 4-bit patterns, N6 is the 7th pattern bit (only
 *   meaningful with H), and T is the relative type — with T set, relatives inherit the anchor's
 *   rotation, mirroring and scale. X's ninth bit is attr2 bit 0, Y's is attr4 bit 0.
 * - A relative's attr0/attr1 are signed offsets, rotated, mirrored and scaled by the anchor's
 *   transform (all zero for T clear) and added to its position. It inherits H, takes N6 from its own
 *   attr4 bit 5, adds the anchor's pattern when attr4 bit 0 is set, adds the anchor's palette offset
 *   when attr2 bit 0 is set, and is visible only when the anchor is.
 */
static void zxnextUlaResolveSpritesInto(ZxnextResolvedSprite* resolved, uint32_t count) {
  uint32_t anchorVisible = 0u;
  uint32_t anchorRelType = 0u;
  uint32_t anchorH = 0u;
  uint32_t anchorX = 0u;
  uint32_t anchorY = 0u;
  uint32_t anchorPattern = 0u;
  uint32_t anchorPaletteOffset = 0u;
  uint32_t anchorRotate = 0u;
  uint32_t anchorXmirror = 0u;
  uint32_t anchorYmirror = 0u;
  uint32_t anchorScaleX = 0u;
  uint32_t anchorScaleY = 0u;

  for (uint32_t sprite = 0u; sprite < count && sprite < 128u; sprite++) {
    uint32_t attr0 = zxnextSpritesGetAttribute(sprite, 0) & 0xffu;
    uint32_t attr1 = zxnextSpritesGetAttribute(sprite, 1) & 0xffu;
    uint32_t attr2 = zxnextSpritesGetAttribute(sprite, 2) & 0xffu;
    uint32_t attr3 = zxnextSpritesGetAttribute(sprite, 3) & 0xffu;
    uint32_t attr4 = zxnextSpritesGetAttribute(sprite, 4) & 0xffu;
    uint32_t has5Attrs = (attr3 & 0x40u) != 0u;
    uint32_t relative = has5Attrs && ((attr4 >> 6u) & 0x03u) == 0x01u;
    ZxnextResolvedSprite* out = &resolved[sprite];

    if (!relative) {
      uint32_t h = has5Attrs && (attr4 & 0x80u);
      uint32_t n6 = h && (attr4 & 0x40u);
      out->visible = (attr3 & 0x80u) != 0u;
      out->x = (uint16_t)(((attr2 & 0x01u) << 8u) | attr0);
      out->y = (uint16_t)(((has5Attrs ? (attr4 & 0x01u) : 0u) << 8u) | attr1);
      out->paletteOffset = (uint8_t)(attr2 >> 4u);
      out->xmirror = (attr2 & 0x08u) != 0u;
      out->ymirror = (attr2 & 0x04u) != 0u;
      out->rotate = (attr2 & 0x02u) != 0u;
      out->scaleX = has5Attrs ? (uint8_t)((attr4 >> 3u) & 0x03u) : 0u;
      out->scaleY = has5Attrs ? (uint8_t)((attr4 >> 1u) & 0x03u) : 0u;
      out->is4Bit = (uint8_t)h;
      out->pattern7 = (uint8_t)(((attr3 & 0x3fu) << 1u) | n6);

      anchorVisible = out->visible;
      anchorRelType = has5Attrs && (attr4 & 0x20u);
      anchorH = h;
      anchorX = out->x;
      anchorY = out->y;
      anchorPattern = out->pattern7;
      anchorPaletteOffset = out->paletteOffset;
      if (anchorRelType) {
        anchorRotate = out->rotate;
        anchorXmirror = out->xmirror;
        anchorYmirror = out->ymirror;
        anchorScaleX = out->scaleX;
        anchorScaleY = out->scaleY;
      } else {
        anchorRotate = 0u;
        anchorXmirror = 0u;
        anchorYmirror = 0u;
        anchorScaleX = 0u;
        anchorScaleY = 0u;
      }
      continue;
    }

    // --- Relative sprite (`spr_rel_*`).
    uint32_t x0 = anchorRotate ? attr1 : attr0;
    uint32_t y0 = anchorRotate ? attr0 : attr1;
    uint32_t x1 = (anchorRotate ^ anchorXmirror) ? ((~x0 + 1u) & 0xffu) : x0;
    uint32_t y1 = anchorYmirror ? ((~y0 + 1u) & 0xffu) : y0;
    uint32_t x3 = (anchorX + zxnextUlaSignExtendScale9(x1, anchorScaleX)) & 0x1ffu;
    uint32_t y3 = (anchorY + zxnextUlaSignExtendScale9(y1, anchorScaleY)) & 0x1ffu;

    uint32_t ownXmirror = (attr2 >> 3u) & 1u;
    uint32_t ownYmirror = (attr2 >> 2u) & 1u;
    uint32_t ownRotate = (attr2 >> 1u) & 1u;

    out->visible = anchorVisible && (attr3 & 0x80u);
    out->x = (uint16_t)x3;
    out->y = (uint16_t)y3;
    out->paletteOffset = (uint8_t)((attr2 & 0x01u)
      ? ((anchorPaletteOffset + (attr2 >> 4u)) & 0x0fu)
      : (attr2 >> 4u));
    if (anchorRelType) {
      uint32_t relXmirror = anchorRotate ? (ownYmirror ^ ownRotate) : ownXmirror;
      uint32_t relYmirror = anchorRotate ? (ownXmirror ^ ownRotate) : ownYmirror;
      out->xmirror = (uint8_t)(anchorXmirror ^ relXmirror);
      out->ymirror = (uint8_t)(anchorYmirror ^ relYmirror);
      out->rotate = (uint8_t)(anchorRotate ^ ownRotate);
      out->scaleX = (uint8_t)anchorScaleX;
      out->scaleY = (uint8_t)anchorScaleY;
    } else {
      out->xmirror = (uint8_t)ownXmirror;
      out->ymirror = (uint8_t)ownYmirror;
      out->rotate = (uint8_t)ownRotate;
      out->scaleX = (uint8_t)((attr4 >> 3u) & 0x03u);
      out->scaleY = (uint8_t)((attr4 >> 1u) & 0x03u);
    }
    out->is4Bit = (uint8_t)anchorH;
    uint32_t n6 = anchorH && (attr4 & 0x20u);
    uint32_t pattern7 = ((attr3 & 0x3fu) << 1u) | n6;
    if (attr4 & 0x01u) pattern7 = (pattern7 + anchorPattern) & 0x7fu;
    out->pattern7 = (uint8_t)pattern7;
  }
}

/*
 * One pass over the visible sprites, which either draws them or detects collisions — never both.
 *
 * The picture is built whole-frame, and only when the display asks for it (`zxnextRenderInstantScreen`),
 * so drawing cannot be where the hardware's collision flag is raised: a machine running with no display
 * would never see it, and a display refreshed twice would raise it twice for one frame. Collisions are
 * detected once per emulated frame instead, from `zxnextUlaOnFrameCompleted`.
 */
static void zxnextUlaProcessSprites(uint32_t drawPixels, uint32_t detectCollisions);

static void zxnextUlaRenderSpritesScreen(void) { zxnextUlaProcessSprites(1u, 0u); }

/*
 * The first sprite the engine does not get to on each sprite line (128: all of them), by sprites.vhd's time
 * rules as NextComposedScreenDevice.renderSpritesPixel applies them: one 28 MHz clock per sprite qualified,
 * two more plus one per pixel for a sprite drawn on the line; a drawable sprite is not started while the
 * wide counter (511 + (clock + 2) / 4) is in 288-319 under the mask of the previous drawn sprite's X wrap
 * (spr_cur_notime); the line has totalHc * 4 clocks. Either time-out sets $303B bit 1.
 */
static uint8_t zxnextUlaSpriteLineCut[ZXNEXT_SPRITE_SPACE_HEIGHT];

/*
 * `renderedRowsOnly`: compute only the lines the current render window draws. Each line's cut is
 * independent of the others, and the raster re-renders a few pixels at every picture-changing write
 * (a DMA burst to the sprite ports is one per byte), so recomputing all 256 lines x 128 sprites each
 * time cost more than the rest of the emulation together - ScrollNutter ran at ~30 ms a frame.
 */
static uint32_t zxnextUlaComputeSpriteLineCuts(uint32_t lastVisible, uint32_t renderedRowsOnly) {
  static const uint32_t wrapMasks[4] = {0x1cu, 0x18u, 0x10u, 0x00u};
  uint32_t lineClocks = zxnextTimingTotalHc * 4u;
  uint32_t overtime = 0u;
  for (uint32_t v = 0u; v < ZXNEXT_SPRITE_SPACE_HEIGHT; v++) {
    if (renderedRowsOnly && zxnextRenderRowOff(ZXNEXT_LAYER2_WIDE_SCREEN_Y + v)) continue;
    uint32_t clock = 0u;
    uint32_t lastMask = 0x1cu;
    uint32_t cut = 128u;
    for (uint32_t i = 0u; i < 128u; i++) {
      const ZxnextResolvedSprite* r = &zxnextUlaResolvedSprites[i];
      uint32_t drawable = 0u;
      uint32_t width = 16u << (i <= lastVisible ? r->scaleX : 0u);
      if (i <= lastVisible && r->visible) {
        int32_t sx = (int32_t)r->x;
        int32_t sy = (int32_t)r->y;
        if (sx > 319) sx -= 512;
        if (sy > 255) sy -= 512;
        int32_t height = (int32_t)(16u << r->scaleY);
        drawable = (int32_t)v >= sy && (int32_t)v < sy + height && sx <= 319 && sx + (int32_t)width > 0;
      }
      if (!drawable) {
        clock++;
        continue;
      }
      uint32_t whc = (511u + ((clock + 2u) >> 2u)) & 0x1ffu;
      uint32_t mask = lastMask;
      lastMask = wrapMasks[r->scaleX & 3u];
      if (whc >= 288u && whc < 320u && (whc & 0x20u) != 0u && (whc & 0x1fu & mask) == mask) {
        cut = i;
        break;
      }
      if (clock + 2u + width > lineClocks) {
        cut = i;
        break;
      }
      clock += 2u + width;
    }
    zxnextUlaSpriteLineCut[v] = (uint8_t)cut;
    if (cut < 128u) overtime = 1u;
  }
  return overtime;
}

static void zxnextUlaProcessSprites(uint32_t drawPixels, uint32_t detectCollisions) {
  /* The engine runs whether or not $15 bit 0 shows its pixels (zxnext.vhd ~6880): only drawing stops */
  if (drawPixels && !zxnextSpritesGetEnabled()) return;
  uint32_t lastVisible = zxnextSpritesGetLastVisibleSpriteIndex();
  if (lastVisible == 0xffffffffu) return;
  if (lastVisible > 127u) lastVisible = 127u;

  uint32_t clipX1;
  uint32_t clipX2;
  uint32_t clipY1;
  uint32_t clipY2;
  if (zxnextSpritesGetOverBorderEnabled()) {
    if (zxnextSpritesGetClippingEnabled()) {
      clipX1 = zxnextSpritesGetClip(0) << 1u;
      clipX2 = (zxnextSpritesGetClip(1) << 1u) | 1u;
      clipY1 = zxnextSpritesGetClip(2);
      clipY2 = zxnextSpritesGetClip(3);
    } else {
      clipX1 = 0u;
      clipX2 = 319u;
      clipY1 = 0u;
      clipY2 = 255u;
    }
  } else {
    clipX1 = zxnextSpritesGetClip(0) + 32u;
    clipX2 = zxnextSpritesGetClip(1) + 32u;
    clipY1 = zxnextSpritesGetClip(2) + 32u;
    clipY2 = zxnextSpritesGetClip(3) + 32u;
    if (clipY2 > 223u) clipY2 = 223u; /* sprites.vhd: without over-border, vcounter < 224 too */
  }

  zxnextUlaResolveSpritesInto(zxnextUlaResolvedSprites, lastVisible + 1u);
  uint32_t overtime = zxnextUlaComputeSpriteLineCuts(lastVisible, drawPixels && !detectCollisions);
  if (detectCollisions && overtime) zxnextSpritesSignalTooMany();
  if (detectCollisions) {
    for (uint32_t i = 0u; i < ZXNEXT_SPRITE_SPACE_WIDTH * ZXNEXT_SPRITE_SPACE_HEIGHT; i++) {
      zxnextUlaSpriteCoverage[i] = 0u;
    }
  }
  uint32_t collision = 0u;

  int32_t start = zxnextSpritesGetSprite0OnTop() ? (int32_t)lastVisible : 0;
  int32_t end = zxnextSpritesGetSprite0OnTop() ? -1 : (int32_t)lastVisible + 1;
  int32_t step = zxnextSpritesGetSprite0OnTop() ? -1 : 1;
  uint32_t transparencyIndex = zxnextSpritesGetTransparencyIndex();

  for (int32_t sprite = start; sprite != end; sprite += step) {
    const ZxnextResolvedSprite* resolved = &zxnextUlaResolvedSprites[sprite];
    if (!resolved->visible) continue;

    uint32_t is4Bit = resolved->is4Bit;
    uint32_t transformVariant =
      (resolved->rotate ? 4u : 0u) | (resolved->xmirror ? 2u : 0u) | (resolved->ymirror ? 1u : 0u);
    /*
     * The 7-bit pattern number (FPGA `spr_rel_pattern`) names a 4-bit pattern directly; an 8-bit
     * pattern is its top six bits, since N6 is only ever set for a 4-bit sprite.
     */
    uint32_t patternVariantIndex = is4Bit
      ? (((uint32_t)resolved->pattern7 << 3u) | transformVariant)
      : ((((uint32_t)resolved->pattern7 >> 1u) << 3u) | transformVariant);
    uint32_t scaleX = resolved->scaleX;
    uint32_t scaleY = resolved->scaleY;
    /*
     * Scale is applied in screen space and is not swapped by rotation: the FPGA counts the width
     * with the XX scale and the height with YY whatever the rotate bit says.
     */
    uint32_t width = 16u << scaleX;
    uint32_t height = 16u << scaleY;
    int32_t spriteX = (int32_t)resolved->x;
    int32_t spriteY = (int32_t)resolved->y;
    if (spriteX > 319) spriteX -= 512;
    if (spriteY > 255) spriteY -= 512;
    uint32_t paletteOffset = resolved->paletteOffset;

    for (uint32_t py = 0u; py < height; py++) {
      int32_t displayY = spriteY + (int32_t)py;
      if (displayY < 0 || displayY >= (int32_t)ZXNEXT_LAYER2_WIDE_SCREEN_HEIGHT) continue;
      if ((uint32_t)sprite >= zxnextUlaSpriteLineCut[displayY]) continue; /* out of time on this line */
      if (drawPixels && !detectCollisions && zxnextRenderRowOff(ZXNEXT_LAYER2_WIDE_SCREEN_Y + (uint32_t)displayY)) continue;
      /*
       * Clipping applies to what is *shown*, not to what the sprite engine writes: the FPGA fills its
       * line buffer for the whole 320-pixel line and clips on output. Collisions are detected on the
       * line buffer, so a pixel outside the clip window still collides.
       */
      uint32_t rowClipped = displayY < (int32_t)clipY1 || displayY > (int32_t)clipY2;

      uint32_t patternY = (py >> scaleY) & 0x0fu;
      uint32_t outputOffset = (ZXNEXT_LAYER2_WIDE_SCREEN_Y + (uint32_t)displayY) *
        ZXNEXT_SCREEN_WIDTH + ZXNEXT_LAYER2_WIDE_SCREEN_X;
      uint32_t coverageRow = (uint32_t)displayY * ZXNEXT_SPRITE_SPACE_WIDTH;

      for (uint32_t px = 0u; px < width; px++) {
        int32_t displayX = spriteX + (int32_t)px;
        if (displayX < 0 || displayX >= (int32_t)ZXNEXT_LAYER2_320_SCREEN_WIDTH) continue;

        uint32_t patternX = (px >> scaleX) & 0x0fu;
        uint32_t patternOffset = (patternY << 4u) | patternX;
        uint32_t paletteIndex;
        if (is4Bit) {
          // --- A nibble; transparent when it equals the low nibble of Reg $4B (`spr_line_we`).
          uint32_t nibble = zxnextSpritesGetPatternByte4(patternVariantIndex, patternOffset) & 0x0fu;
          if (nibble == (transparencyIndex & 0x0fu)) continue;
          paletteIndex = (paletteOffset << 4u) | nibble;
        } else {
          // --- A whole byte; the palette offset is added to its high nibble.
          uint32_t pixelByte = zxnextSpritesGetPatternByte8(patternVariantIndex, patternOffset) & 0xffu;
          if (pixelByte == (transparencyIndex & 0xffu)) continue;
          paletteIndex = ((((pixelByte >> 4u) + paletteOffset) & 0x0fu) << 4u) | (pixelByte & 0x0fu);
        }

        if (detectCollisions) {
          // --- An opaque pixel onto one another sprite already wrote: a collision.
          uint8_t* covered = &zxnextUlaSpriteCoverage[coverageRow + (uint32_t)displayX];
          if (*covered) collision = 1u;
          *covered = 1u;
          continue;
        }

        if (!drawPixels || rowClipped || displayX < (int32_t)clipX1 || displayX > (int32_t)clipX2) continue;
        uint32_t outputPixel = outputOffset + ((uint32_t)displayX << 1u);
        uint16_t color = zxnextPx(zxnextPaletteGetSpriteEntry(paletteIndex));
        zxnextLayerSpr[outputPixel] = color;
        zxnextLayerSpr[outputPixel + 1u] = color;
      }
    }
  }
  if (collision) zxnextSpritesSignalCollision();
}

static uint32_t zxnextUlaReadTilemapVram(uint32_t useBank7, uint32_t offset, uint32_t address) {
  uint32_t offsetMask = useBank7 ? 0x1fu : 0x3fu;
  uint32_t highByte = ((offset & offsetMask) + ((address >> 8u) & 0x3fu)) & 0x3fu;
  /* Bank 7 is an 8K BRAM addressed by bits 12-0 (zxnext.vhd ~6609-6632): past 8K the fetch wraps to
     the start of bank 7 instead of reading on into page $0F */
  uint32_t fullAddress = ((highByte << 8u) | (address & 0xffu)) & (useBank7 ? 0x1fffu : 0x3fffu);
  uint32_t bankBase = useBank7 ? ZXNEXT_BANK_07_OFFSET : ZXNEXT_LORES_BANK_05_OFFSET;
  return zxnextMemoryReadPhysical(bankBase + fullAddress);
}

static uint32_t zxnextUlaTilemapTransform(uint32_t x, uint32_t y, uint32_t attr) {
  uint32_t rotate = (attr & 0x02u) != 0u;
  uint32_t effectiveX = x;
  uint32_t effectiveY = y;
  if (((attr & 0x08u) != 0u) != rotate) effectiveX = 7u - effectiveX;
  if ((attr & 0x04u) != 0u) effectiveY = 7u - effectiveY;
  return rotate ? ((effectiveY << 16u) | effectiveX) : ((effectiveX << 16u) | effectiveY);
}

static uint32_t zxnextUlaTilemapTextTransparent(uint32_t paletteEntry) {
  return (paletteEntry & 0x1feu) == ((uint32_t)zxnextNextRegs[0x14u] << 1u);
}

/*
 * The tilemap, per pixel, straight from tilemap.vhd (the TypeScript core's renderTilemapPixel is the same):
 * - 320 x 256 from 32 pixels left of / above the paper; 40 columns give one pixel per 7 MHz clock (two
 *   buffer pixels), 80 columns two (640 across).
 * - Tilemap x = (x + scroll X) mod 320 / 640 (tm_x_sum / tm_x_correction, for scroll values below the
 *   width), y = (y + scroll Y) mod 256. Map entry row * 40 (80) + column: tile byte and attribute, or the
 *   tile byte and $6C. 512-tile mode takes tile bit 8 from attribute bit 0.
 * - Standard tiles: X mirror XOR rotate inverts x, Y mirror inverts y, rotate swaps them; byte
 *   tile * 32 + y * 4 + x / 2, high nibble for even x; index attr(7:4) & nibble; transparent when the
 *   nibble equals $4C. Text mode: bit 7 - x of byte tile * 8 + y, no transform; index attr(7:1) & bit;
 *   transparent when its RGB equals $14 (zxnext.vhd ~7055).
 * - Below the ULA when (attribute bit 0 or 512-tile mode) and not $6B bit 0.
 * - Clip: x1 * 2 .. x2 * 2 + 1, y1 .. y2 in 320 x 256 coordinates.
 */
static void zxnextUlaRenderTilemapScreen(void) {
  uint32_t cols80 = zxnextTilemapGet80x32Resolution();
  uint32_t width = cols80 ? 640u : 320u;
  uint32_t columns = cols80 ? 80u : 40u;
  uint32_t textMode = zxnextTilemapGetTextMode();
  uint32_t scrollX = zxnextTilemapGetScrollX();
  uint32_t scrollY = zxnextTilemapGetScrollY();
  uint32_t useBank7 = zxnextTilemapGetBaseAddressUseBank7();
  uint32_t baseMsb = zxnextTilemapGetBaseAddressMsb();
  uint32_t defUseBank7 = zxnextTilemapGetDefinitionAddressUseBank7();
  uint32_t defMsb = zxnextTilemapGetDefinitionAddressMsb();
  uint32_t eliminateAttrs = zxnextTilemapGetEliminateAttributes();
  uint32_t tile512Mode = zxnextTilemapGet512TileMode();
  uint32_t forceOnTop = zxnextTilemapGetForceOnTopOfUla();
  uint32_t defaultAttr = zxnextTilemapGetDefaultAttr();
  uint32_t transparentIndex = zxnextTilemapGetTransparencyIndex() & 0x0fu;
  uint32_t clipX1 = zxnextTilemapGetClip(0) << 1u;
  uint32_t clipX2 = (zxnextTilemapGetClip(1) << 1u) | 0x01u;
  uint32_t clipY1 = zxnextTilemapGetClip(2);
  uint32_t clipY2 = zxnextTilemapGetClip(3);

  for (uint32_t y = 0; y < ZXNEXT_LAYER2_WIDE_SCREEN_HEIGHT; y++) {
    if (zxnextRenderRowOff(ZXNEXT_LAYER2_WIDE_SCREEN_Y + y)) continue;
    if (y < clipY1 || y > clipY2) continue;
    uint32_t ay = (y + scrollY) & 0xffu;
    uint32_t py = ay & 0x07u;
    uint32_t outputOffset = (ZXNEXT_LAYER2_WIDE_SCREEN_Y + y) * ZXNEXT_SCREEN_WIDTH + ZXNEXT_LAYER2_WIDE_SCREEN_X;
    for (uint32_t x = 0; x < width; x++) {
      uint32_t hc = cols80 ? x >> 1u : x;
      if (hc < clipX1 || hc > clipX2) continue;
      uint32_t ax = (x + scrollX) % width;
      uint32_t entry = (ay >> 3u) * columns + (ax >> 3u);
      uint32_t tile;
      uint32_t attr;
      if (eliminateAttrs) {
        tile = zxnextUlaReadTilemapVram(useBank7, baseMsb, entry);
        attr = defaultAttr;
      } else {
        tile = zxnextUlaReadTilemapVram(useBank7, baseMsb, entry << 1u);
        attr = zxnextUlaReadTilemapVram(useBank7, baseMsb, (entry << 1u) | 1u);
      }
      if (tile512Mode && (attr & 0x01u) != 0u) tile |= 0x100u;
      uint16_t below = (((attr & 0x01u) != 0u || tile512Mode) && !forceOnTop) ? ZXNEXT_PX_TM_BELOW : 0u;
      uint32_t px = ax & 0x07u;
      uint32_t paletteEntry;
      uint32_t transparent;
      if (textMode) {
        uint32_t bits = zxnextUlaReadTilemapVram(defUseBank7, defMsb, (tile << 3u) | py);
        paletteEntry = zxnextPaletteGetTilemapEntry((attr & 0xfeu) | ((bits >> (7u - px)) & 0x01u));
        transparent = zxnextUlaTilemapTextTransparent(paletteEntry);
      } else {
        uint32_t transformed = zxnextUlaTilemapTransform(px, py, attr);
        uint32_t tx = transformed >> 16u;
        uint32_t ty = transformed & 0xffffu;
        uint32_t byte = zxnextUlaReadTilemapVram(defUseBank7, defMsb, (tile << 5u) | (ty << 2u) | (tx >> 1u));
        uint32_t nibble = (tx & 0x01u) ? byte & 0x0fu : (byte >> 4u) & 0x0fu;
        transparent = nibble == transparentIndex;
        paletteEntry = zxnextPaletteGetTilemapEntry((attr & 0xf0u) | nibble);
      }
      uint16_t out = transparent ? below : (uint16_t)(zxnextPx(paletteEntry) | below);
      if (cols80) {
        zxnextLayerTm[outputOffset + x] = out;
      } else {
        zxnextLayerTm[outputOffset + (x << 1u)] = out;
        zxnextLayerTm[outputOffset + (x << 1u) + 1u] = out;
      }
    }
  }
}

static uint32_t zxnextRgbaTable[512];
static uint8_t zxnextRgbaTableReady;

static inline void zxnextEnsureRgbaTable(void) {
  if (zxnextRgbaTableReady) return;
  for (uint32_t i = 0u; i < 512u; i++) zxnextRgbaTable[i] = zxnextUlaRgb333Color(i);
  zxnextRgbaTableReady = 1u;
}

/*
 * The mixer's inputs that do not change per pixel (zxnext.vhd stage 2), read from the state once per
 * compose call. Packed into one word (zxnextMixParamsPack) for the layer capture's span table.
 */
typedef struct {
  uint32_t fallbackRgb;    /* $4A as 9-bit RGB */
  uint32_t priorities;     /* $15 bits 4-2 */
  uint32_t ulaEn;          /* not $68 bit 7 */
  uint32_t tmEn;           /* $6B bit 7 */
  uint32_t l2En;
  uint32_t sprEn;          /* $15 bit 0 */
  uint32_t stencil;        /* $68 bit 0, with the ULA and the tilemap both enabled */
  uint32_t blendMode;      /* $68 bits 6-5 */
  uint32_t tmBelowWhenOff; /* not $6B bit 0: where a disabled tilemap's "below" comes from */
} ZxnextMixParams;

static inline void zxnextMixParamsCurrent(ZxnextMixParams* p) {
  uint32_t fb = zxnextNextRegs[0x4au];
  p->fallbackRgb = ((fb << 1u) | ((fb & 0x03u) != 0u ? 1u : 0u)) & 0x1ffu;
  p->priorities = (zxnextNextRegs[0x15u] >> 2u) & 0x07u;
  p->ulaEn = !ulaDisableOutput;
  p->tmEn = zxnextTilemapGetEnabled() ? 1u : 0u;
  p->l2En = zxnextLayer2GetEnabled() ? 1u : 0u;
  p->sprEn = zxnextSpritesGetEnabled() ? 1u : 0u;
  p->stencil = (ulaEnableStencilMode && p->ulaEn && p->tmEn) ? 1u : 0u;
  p->blendMode = ulaBlendingInSluModes & 0x03u;
  p->tmBelowWhenOff = (zxnextNextRegs[0x6bu] & 0x01u) == 0u;
}

/* Bits 0-8 fallback, 9-11 priorities, 12 ULA, 13 tilemap, 14 Layer 2, 15 sprites, 16 stencil,
   17-18 blend mode, 19 tilemap-below-when-off (the probe reports this word to the IDE) */
static inline uint32_t zxnextMixParamsPack(const ZxnextMixParams* p) {
  return (p->fallbackRgb & 0x1ffu) | ((p->priorities & 7u) << 9u) | (p->ulaEn << 12u) | (p->tmEn << 13u) |
    (p->l2En << 14u) | (p->sprEn << 15u) | (p->stencil << 16u) | ((p->blendMode & 3u) << 17u) |
    (p->tmBelowWhenOff << 19u);
}

static inline void zxnextMixParamsUnpack(uint32_t v, ZxnextMixParams* p) {
  p->fallbackRgb = v & 0x1ffu;
  p->priorities = (v >> 9u) & 7u;
  p->ulaEn = (v >> 12u) & 1u;
  p->tmEn = (v >> 13u) & 1u;
  p->l2En = (v >> 14u) & 1u;
  p->sprEn = (v >> 15u) & 1u;
  p->stencil = (v >> 16u) & 1u;
  p->blendMode = (v >> 17u) & 3u;
  p->tmBelowWhenOff = (v >> 19u) & 1u;
}

/*
 * Why a pixel shows what it shows (`.plans/LAYER_COMPOSITION_PLAN.md` D7, T5). Computed by
 * zxnextComposePixel itself, so the explanation can never drift from the mixer (D10). Mirrored by
 * `src/common/zxnext/layers/layerMix.ts`.
 */
#define ZXNEXT_WHY_FALLBACK 0u    /* no layer opaque: $4A */
#define ZXNEXT_WHY_ULA 1u         /* the ULA (or LoRes), through the ULA/tilemap combination */
#define ZXNEXT_WHY_TM 2u          /* the tilemap, through the ULA/tilemap combination */
#define ZXNEXT_WHY_L2 3u          /* Layer 2 by the $15 order */
#define ZXNEXT_WHY_L2_PRIORITY 4u /* Layer 2 by its palette priority bit */
#define ZXNEXT_WHY_SPR 5u         /* sprites by the $15 order */
#define ZXNEXT_WHY_BORDER 6u      /* sprites over an opaque ULA border pixel (LUS/USL/ULS exception) */
#define ZXNEXT_WHY_STENCIL 7u     /* ULA AND tilemap ($68 bit 0) */
#define ZXNEXT_WHY_BLEND_ADD 8u   /* Layer 2 + the blend source, saturated ($15 110) */
#define ZXNEXT_WHY_BLEND_SUB 9u   /* Layer 2 + the blend source - 5 ($15 111) */

/*
 * One pixel of zxnext.vhd stage 2: the four layer values (ZXNEXT_PX_* encoding) to a 9-bit colour in
 * bits 0-8, and the rule that chose it (ZXNEXT_WHY_*) in bits 12-15. The live mixer, the paused
 * recompose and the probe all call this (D10). The "why" travels in the result, never through a
 * pointer: an address-taken local lives on the shadow stack, which is in the state image (T8).
 * `withWhy` is a constant at every call: the live mixer passes 0, and the rule bookkeeping folds away.
 */
#define ZXNEXT_MIX_WHY_SHIFT 12u
#define ZXNEXT_MIX_WHY(v) (((v) >> ZXNEXT_MIX_WHY_SHIFT) & 0x0fu)
static inline __attribute__((always_inline)) uint32_t zxnextComposePixel(const ZxnextMixParams* p, uint32_t u, uint32_t t,
  uint32_t l, uint32_t sp, const uint32_t withWhy) {
  // --- ula_mix_*: the ULA as blended ($68 bit 7 does not apply); ula_*: as layered
  uint32_t ulaMixT = (u & ZXNEXT_PX_OPAQUE) == 0u;
  uint32_t ulaMixRgb = ulaMixT ? 0u : (u & ZXNEXT_PX_RGB);
  uint32_t ulaT = ulaMixT || !p->ulaEn;
  uint32_t ulaRgb = ulaT ? 0u : ulaMixRgb;
  uint32_t border = !ulaT && (u & ZXNEXT_PX_BORDER) != 0u;

  uint32_t tmT = !p->tmEn || (t & ZXNEXT_PX_OPAQUE) == 0u;
  uint32_t tmRgb = tmT ? 0u : (t & ZXNEXT_PX_RGB);
  uint32_t tmBelow = p->tmEn ? ((t & ZXNEXT_PX_TM_BELOW) != 0u) : p->tmBelowWhenOff;

  // --- ula_final_*: stencil_* or ulatm_*
  uint32_t finalT;
  uint32_t finalRgb;
  uint32_t finalWhy;
  if (p->stencil) {
    finalT = ulaT || tmT;
    finalRgb = finalT ? 0u : (ulaRgb & tmRgb);
    finalWhy = ZXNEXT_WHY_STENCIL;
  } else {
    finalT = ulaT && tmT;
    uint32_t tmShows = !tmT && (!tmBelow || ulaT);
    finalRgb = tmShows ? tmRgb : ulaRgb;
    finalWhy = tmShows ? ZXNEXT_WHY_TM : ZXNEXT_WHY_ULA;
  }

  uint32_t sprT = !p->sprEn || (sp & ZXNEXT_PX_OPAQUE) == 0u;
  uint32_t sprRgb = sprT ? 0u : (sp & ZXNEXT_PX_RGB);
  uint32_t l2T = !p->l2En || (l & ZXNEXT_PX_OPAQUE) == 0u;
  uint32_t l2Rgb = l2T ? 0u : (l & ZXNEXT_PX_RGB);
  uint32_t l2Priority = !l2T && (l & ZXNEXT_PX_L2_PRIORITY) != 0u;

  uint32_t out = p->fallbackRgb;
  uint32_t w = ZXNEXT_WHY_FALLBACK;
  // --- The border exception in LUS/USL/ULS: a sprite shows over an opaque ULA border pixel when the
  // --- tilemap is transparent there.
  uint32_t ulaWins = !finalT && !(border && tmT && !sprT);
  // --- A sprite that wins in LUS/USL/ULS where the ULA/tilemap pixel was opaque won by that exception
  uint32_t sprUlaWhy = finalT ? ZXNEXT_WHY_SPR : ZXNEXT_WHY_BORDER;

  switch (p->priorities) {
    case 0u: // SLU
      if (l2Priority) { out = l2Rgb; w = ZXNEXT_WHY_L2_PRIORITY; }
      else if (!sprT) { out = sprRgb; w = ZXNEXT_WHY_SPR; }
      else if (!l2T) { out = l2Rgb; w = ZXNEXT_WHY_L2; }
      else if (!finalT) { out = finalRgb; w = finalWhy; }
      break;
    case 1u: // LSU
      if (!l2T) { out = l2Rgb; w = ZXNEXT_WHY_L2; }
      else if (!sprT) { out = sprRgb; w = ZXNEXT_WHY_SPR; }
      else if (!finalT) { out = finalRgb; w = finalWhy; }
      break;
    case 2u: // SUL
      if (l2Priority) { out = l2Rgb; w = ZXNEXT_WHY_L2_PRIORITY; }
      else if (!sprT) { out = sprRgb; w = ZXNEXT_WHY_SPR; }
      else if (!finalT) { out = finalRgb; w = finalWhy; }
      else if (!l2T) { out = l2Rgb; w = ZXNEXT_WHY_L2; }
      break;
    case 3u: // LUS
      if (!l2T) { out = l2Rgb; w = ZXNEXT_WHY_L2; }
      else if (ulaWins) { out = finalRgb; w = finalWhy; }
      else if (!sprT) { out = sprRgb; w = sprUlaWhy; }
      break;
    case 4u: // USL
      if (l2Priority) { out = l2Rgb; w = ZXNEXT_WHY_L2_PRIORITY; }
      else if (ulaWins) { out = finalRgb; w = finalWhy; }
      else if (!sprT) { out = sprRgb; w = sprUlaWhy; }
      else if (!l2T) { out = l2Rgb; w = ZXNEXT_WHY_L2; }
      break;
    case 5u: // ULS
      if (l2Priority) { out = l2Rgb; w = ZXNEXT_WHY_L2_PRIORITY; }
      else if (ulaWins) { out = finalRgb; w = finalWhy; }
      else if (!l2T) { out = l2Rgb; w = ZXNEXT_WHY_L2; }
      else if (!sprT) { out = sprRgb; w = sprUlaWhy; }
      break;
    default: { // 110 / 111: blend
      // --- mix_* by $68 bits 6-5 (zxnext.vhd `case ula_blend_mode_2`)
      uint32_t mixRgb;
      uint32_t mixT;
      uint32_t topT, topRgb, botT, botRgb, topWhy, botWhy;
      switch (p->blendMode) {
        case 0u:
          mixRgb = ulaMixRgb; mixT = ulaMixT;
          topT = tmT || tmBelow; topRgb = tmRgb;
          botT = tmT || !tmBelow; botRgb = tmRgb;
          topWhy = ZXNEXT_WHY_TM; botWhy = ZXNEXT_WHY_TM;
          break;
        case 2u:
          mixRgb = finalRgb; mixT = finalT;
          topT = 1u; topRgb = tmRgb; botT = 1u; botRgb = tmRgb;
          topWhy = ZXNEXT_WHY_TM; botWhy = ZXNEXT_WHY_TM;
          break;
        case 3u:
          mixRgb = tmRgb; mixT = tmT;
          topT = ulaT || !tmBelow; topRgb = ulaRgb;
          botT = ulaT || tmBelow; botRgb = ulaRgb;
          topWhy = ZXNEXT_WHY_ULA; botWhy = ZXNEXT_WHY_ULA;
          break;
        default:
          mixRgb = 0u; mixT = 1u;
          if (tmBelow) {
            topT = ulaT; topRgb = ulaRgb; botT = tmT; botRgb = tmRgb;
            topWhy = ZXNEXT_WHY_ULA; botWhy = ZXNEXT_WHY_TM;
          } else {
            topT = tmT; topRgb = tmRgb; botT = ulaT; botRgb = ulaRgb;
            topWhy = ZXNEXT_WHY_TM; botWhy = ZXNEXT_WHY_ULA;
          }
          break;
      }
      uint32_t r = ((l2Rgb >> 6u) & 7u) + ((mixRgb >> 6u) & 7u);
      uint32_t g = ((l2Rgb >> 3u) & 7u) + ((mixRgb >> 3u) & 7u);
      uint32_t bl = (l2Rgb & 7u) + (mixRgb & 7u);
      if (p->priorities == 6u) {
        if (r > 7u) r = 7u;
        if (g > 7u) g = 7u;
        if (bl > 7u) bl = 7u;
      } else if (!mixT) {
        r = r <= 4u ? 0u : (r >= 12u ? 7u : r - 5u);
        g = g <= 4u ? 0u : (g >= 12u ? 7u : g - 5u);
        bl = bl <= 4u ? 0u : (bl >= 12u ? 7u : bl - 5u);
      }
      uint32_t mixed = ((r & 7u) << 6u) | ((g & 7u) << 3u) | (bl & 7u);
      uint32_t blendWhy = p->priorities == 6u ? ZXNEXT_WHY_BLEND_ADD : ZXNEXT_WHY_BLEND_SUB;
      if (l2Priority) { out = mixed; w = blendWhy; }
      else if (!topT) { out = topRgb; w = topWhy; }
      else if (!sprT) { out = sprRgb; w = ZXNEXT_WHY_SPR; }
      else if (!botT) { out = botRgb; w = botWhy; }
      else if (!l2T) { out = mixed; w = blendWhy; }
      break;
    }
  }
  return withWhy ? ((out & ZXNEXT_PX_RGB) | (w << ZXNEXT_MIX_WHY_SHIFT)) : (out & ZXNEXT_PX_RGB);
}

// ---------------------------------------------------------------------------
// Layer debugging (`.plans/LAYER_COMPOSITION_PLAN.md`)
//
// The IDE can hide layers, show one alone (solo) and mark the pixels no layer covers. This is applied
// only here, in the mixer (D1): the renderers still run, so sprite collision and "too many sprites"
// ($303B) never change (T1). It is debugging state, not machine state: these statics are volatile
// (ZXNEXT_VOLATILE_SYMBOLS), so a state file neither saves nor restores them (D2, T8).
// ---------------------------------------------------------------------------

#define ZXNEXT_LAYER_BIT_ULA 0x01u
#define ZXNEXT_LAYER_BIT_TM 0x02u
#define ZXNEXT_LAYER_BIT_L2 0x04u
#define ZXNEXT_LAYER_BIT_SPR 0x08u
#define ZXNEXT_LAYER_BITS 0x0fu
#define ZXNEXT_LAYER_DEBUG_SHOW_TRANSPARENT 0x01u
/* What "show transparency" paints where no layer is opaque: magenta, which no fallback default uses */
#define ZXNEXT_LAYER_DEBUG_FLAG_RGB 0x1c7u
/* Solo's checker under a layer's transparent pixels: two greys, 16 x 8 buffer pixels (square on screen) */
#define ZXNEXT_LAYER_DEBUG_CHECKER_A 0x092u
#define ZXNEXT_LAYER_DEBUG_CHECKER_B 0x0dbu

/* The layers the mixer treats as transparent (ZXNEXT_LAYER_BIT_*) */
static uint8_t zxnextLayerDebugMask;
/* 0, or the one layer shown alone */
static uint8_t zxnextLayerDebugSolo;
/* ZXNEXT_LAYER_DEBUG_SHOW_TRANSPARENT */
static uint8_t zxnextLayerDebugFlags;

/*
 * Hides the masked layers' pixels. A hidden tilemap pixel keeps its "below" bit (T4): hiding makes its
 * pixels transparent, it does not disable the tilemap, so the ULA's place above or below it - and
 * stencil mode - stay as the program set them.
 */
static inline uint32_t zxnextLayerDebugMasked(uint32_t mask, uint32_t layerBit, uint32_t v) {
  if (!(mask & layerBit)) return v;
  return layerBit == ZXNEXT_LAYER_BIT_TM ? (v & ZXNEXT_PX_TM_BELOW) : 0u;
}

/*
 * The value a solo layer shows: the layer as the renderer drew it. A disabled tilemap, Layer 2 or
 * sprite layer shows nothing (its buffer is not re-rendered while disabled, so it is stale); the ULA
 * is always rendered and shows even with $68 bit 7 set, because the blend modes still read it.
 */
static inline uint32_t zxnextLayerDebugSoloValue(const ZxnextMixParams* p, uint32_t solo, uint32_t u, uint32_t t,
  uint32_t l, uint32_t sp) {
  switch (solo) {
    case ZXNEXT_LAYER_BIT_ULA: return u;
    case ZXNEXT_LAYER_BIT_TM: return p->tmEn ? t : 0u;
    case ZXNEXT_LAYER_BIT_L2: return p->l2En ? l : 0u;
    default: return p->sprEn ? sp : 0u;
  }
}

/*
 * Composes buffer pixels [first, end) of the given layer buffers into target, with the debug mask,
 * solo and flags in force. Without any of them it is exactly the plain mixer loop.
 */
static void zxnextComposeRange(const ZxnextMixParams* p, uint32_t first, uint32_t end, uint32_t* target,
  const uint16_t* ula, const uint16_t* tm, const uint16_t* l2, const uint16_t* spr) {
  uint32_t mask = zxnextLayerDebugMask & ZXNEXT_LAYER_BITS;
  uint32_t solo = zxnextLayerDebugSolo & ZXNEXT_LAYER_BITS;
  uint32_t showT = (zxnextLayerDebugFlags & ZXNEXT_LAYER_DEBUG_SHOW_TRANSPARENT) != 0u;
  if (!mask && !solo && !showT) {
    for (uint32_t i = first; i < end; i++) {
      target[i] = zxnextRgbaTable[zxnextComposePixel(p, ula[i], tm[i], l2[i], spr[i], 0u)];
    }
    return;
  }
  uint32_t flag = zxnextRgbaTable[ZXNEXT_LAYER_DEBUG_FLAG_RGB];
  if (solo) {
    uint32_t checkerA = zxnextRgbaTable[ZXNEXT_LAYER_DEBUG_CHECKER_A];
    uint32_t checkerB = zxnextRgbaTable[ZXNEXT_LAYER_DEBUG_CHECKER_B];
    for (uint32_t i = first; i < end; i++) {
      uint32_t v = zxnextLayerDebugSoloValue(p, solo, ula[i], tm[i], l2[i], spr[i]);
      if (v & ZXNEXT_PX_OPAQUE) {
        target[i] = zxnextRgbaTable[v & ZXNEXT_PX_RGB];
      } else if (showT) {
        target[i] = flag;
      } else {
        uint32_t x = i % ZXNEXT_SCREEN_WIDTH;
        uint32_t y = i / ZXNEXT_SCREEN_WIDTH;
        target[i] = (((x >> 4u) ^ (y >> 3u)) & 1u) ? checkerB : checkerA;
      }
    }
    return;
  }
  for (uint32_t i = first; i < end; i++) {
    uint32_t out = zxnextComposePixel(p, zxnextLayerDebugMasked(mask, ZXNEXT_LAYER_BIT_ULA, ula[i]),
      zxnextLayerDebugMasked(mask, ZXNEXT_LAYER_BIT_TM, tm[i]), zxnextLayerDebugMasked(mask, ZXNEXT_LAYER_BIT_L2, l2[i]),
      zxnextLayerDebugMasked(mask, ZXNEXT_LAYER_BIT_SPR, spr[i]), 1u);
    target[i] = (showT && ZXNEXT_MIX_WHY(out) == ZXNEXT_WHY_FALLBACK) ? flag : zxnextRgbaTable[out & ZXNEXT_PX_RGB];
  }
}

static inline uint32_t zxnextLayerDebugActive(void) {
  return (zxnextLayerDebugMask & ZXNEXT_LAYER_BITS) || (zxnextLayerDebugSolo & ZXNEXT_LAYER_BITS) ||
    (zxnextLayerDebugFlags & ZXNEXT_LAYER_DEBUG_SHOW_TRANSPARENT);
}

/* The mixer inputs of the most recent compose: the raster's capture records them per span. */
static ZxnextMixParams zxnextLastMixParams;

static void zxnextUlaCompose(void) {
  uint32_t first = zxnextRenderRowFirst * ZXNEXT_SCREEN_WIDTH;
  uint32_t end = (zxnextRenderRowLast + 1u) * ZXNEXT_SCREEN_WIDTH;
  ZxnextMixParams p;
  zxnextMixParamsCurrent(&p);
  zxnextLastMixParams = p;
  zxnextEnsureRgbaTable();

  // --- Fast path: only the ULA can be opaque and no blend mode - the common case. Not with the layer
  // --- debug view on: hiding the ULA, solo and "show transparency" all need the general loop (T9).
  if (!p.tmEn && !p.l2En && !p.sprEn && p.priorities < 6u && !zxnextLayerDebugActive()) {
    uint32_t fallbackPixel = zxnextRgbaTable[p.fallbackRgb];
    if (!p.ulaEn) {
      for (uint32_t i = first; i < end; i++) zxnextRenderTarget[i] = fallbackPixel;
      return;
    }
    for (uint32_t i = first; i < end; i++) {
      uint32_t u = zxnextLayerUla[i];
      zxnextRenderTarget[i] = (u & ZXNEXT_PX_OPAQUE) ? zxnextRgbaTable[u & ZXNEXT_PX_RGB] : fallbackPixel;
    }
    return;
  }

  zxnextComposeRange(&p, first, end, zxnextRenderTarget, zxnextLayerUla, zxnextLayerTm, zxnextLayerL2, zxnextLayerSpr);
}

/*
 * The border's palette index for border attribute attr (zxula.vhd ~491-553 with pixel_en = 0): ULANext
 * $80 + attr(5:3) (the fallback for format $FF), ULA+ $C8 + group + attr(5:3), standard 16 + BRIGHT +
 * attr(5:3). The attribute is border_clr = n & n (border colour n: $80+n, $C8+n, 16+n), or in HiRes the
 * Timex attribute (~431).
 */
static inline uint32_t zxnextUlaBorderPaletteIndexOf(uint32_t attr) {
  uint32_t paper = (attr >> 3u) & 0x07u;
  if (zxnextPaletteGetUlaNextEnabled()) return zxnextNextRegs[0x42u] == 0xffu ? ZXNEXT_ULA_SELECT_FALLBACK : 0x80u + paper;
  if (ulaPlusEnabled) return 0xc8u | ((attr >> 6u) << 4u) | paper;
  return 16u + ((attr & 0x40u) ? 8u : 0u) + paper;
}

static inline uint32_t zxnextUlaBorderPaletteIndex(void) {
  uint32_t n = ulaBorderShown & 0x07u;
  return zxnextUlaBorderPaletteIndexOf((n << 3u) | n);
}

static uint32_t zxnextUlaRenderInstantScreen(void) {
  uint32_t first = zxnextRenderRowFirst * ZXNEXT_SCREEN_WIDTH;
  uint32_t end = (zxnextRenderRowLast + 1u) * ZXNEXT_SCREEN_WIDTH;
  uint32_t tmEn = zxnextTilemapGetEnabled();
  uint32_t l2En = zxnextLayer2GetEnabled();
  uint32_t sprEn = zxnextSpritesGetEnabled();

  // --- ULA layer: the border first (border colour n is ULA entry 16+n; a ULA pixel, so $14 applies),
  // --- then the ULA/LoRes picture. Always rendered: $68 bit 7 is applied by the mixer.
  uint32_t timexMode = zxnextUlaScreenMode();
  uint32_t borderPx = timexMode >= 0x04u
    ? zxnextUlaPx(zxnextUlaBorderPaletteIndexOf(zxnextUlaHiResAttr()))
    : zxnextUlaPx(zxnextUlaBorderPaletteIndex());
  if (borderPx != 0u) borderPx |= ZXNEXT_PX_BORDER;
  for (uint32_t i = first; i < end; i++) zxnextLayerUla[i] = (uint16_t)borderPx;
  if (zxnextLoResGetEnabled()) {
    zxnextUlaRenderLoResScreen();
  } else if (timexMode >= 0x04u) {
    zxnextUlaRenderHiResScreen();
  } else {
    zxnextUlaRenderStandardScreen();
  }

  if (tmEn) {
    for (uint32_t i = first; i < end; i++) zxnextLayerTm[i] = 0u;
    zxnextUlaRenderTilemapScreen();
  }
  if (l2En) {
    for (uint32_t i = first; i < end; i++) zxnextLayerL2[i] = 0u;
    uint32_t resolution = zxnextLayer2GetResolution();
    if (resolution == 0u) zxnextUlaRenderLayer2_256x192Screen();
    else if (resolution == 1u) zxnextUlaRenderLayer2_320x256Screen();
    /* layer2.vhd: `i_resolution` 1X is 640x256 - both 10 and 11 */
    else zxnextUlaRenderLayer2_640x256Screen();
  }
  if (sprEn) {
    for (uint32_t i = first; i < end; i++) zxnextLayerSpr[i] = 0u;
    zxnextUlaRenderSpritesScreen();
  }

  zxnextUlaCompose();
  return ZXNEXT_PIXEL_COUNT;
}

static void zxnextUlaOnFrameCompleted(void) {
  zxnextUlaProcessSprites(0u, 1u);
  ulaFlashCounter = (uint8_t)((ulaFlashCounter + 1u) & 0x1fu);
  ulaFlashFlag = ulaFlashCounter >= 16u;
}

static uint32_t zxnextUlaGetFlashCounter(void) {
  return ulaFlashCounter;
}

static uint32_t zxnextUlaGetFlashFlag(void) {
  return ulaFlashFlag;
}

static void zxnextUlaSetNextReg(uint32_t reg, uint32_t value) {
  uint8_t byteValue = (uint8_t)value;
  switch (reg & 0xffu) {
    case 0x1au:
      ulaClipWindow[ulaClipIndex] = byteValue;
      ulaClipIndex = (uint8_t)((ulaClipIndex + 1u) & 0x03u);
      break;
    case 0x26u:
      ulaScrollX = byteValue;
      zxnextUlaScheduleLatch(ZXNEXT_ULA_LATCH_SCROLL_X, byteValue, zxnextRasterUlaScrollTact(zxnextRasterWriteTact()));
      break;
    case 0x27u:
      ulaScrollY = byteValue;
      zxnextUlaScheduleLatch(ZXNEXT_ULA_LATCH_SCROLL_Y, byteValue, zxnextRasterUlaScrollTact(zxnextRasterWriteTact()));
      break;
    case 0x68u:
      ulaDisableOutput = (byteValue & 0x80u) != 0u;
      ulaBlendingInSluModes = (byteValue >> 5u) & 0x03u;
      ulaHalfPixelScroll = (byteValue & 0x04u) != 0u;
      /* The fine bit is sampled with the coarse scroll, px(8) at hc(3:0) = 3 / B (zxula.vhd ~198): it
       * shows from the next 8-pixel cell, like a $26 write. Bit 7 (ULA output enable) acts per pixel. */
      zxnextUlaScheduleLatch(ZXNEXT_ULA_LATCH_FINE_SCROLL, ulaHalfPixelScroll, zxnextRasterUlaScrollTact(zxnextRasterWriteTact()));
      ulaEnableStencilMode = (byteValue & 0x01u) != 0u;
      ulaPlusEnabled = (byteValue & 0x08u) != 0u;
      /* bit 4: the extra keys stop making matrix entries (membrane.vhd i_cancel_extended_entries) */
      zxnextKeyboardSetCancelExtended(byteValue & 0x10u);
      break;
    case 0x69u:
      /* ~3615: a $69 write sets port_ff_reg(5:0); bits 7-6 stay */
      portTimexValue = (uint8_t)((portTimexValue & 0xc0u) | (byteValue & 0x3fu));
      zxnextUlaScheduleLatch(ZXNEXT_ULA_LATCH_TIMEX, byteValue & 0x3fu, zxnextRasterUlaScrollTact(zxnextRasterWriteTact()));
      break;
    default:
      break;
  }
}

/* Port $BF3B write: mode group (bits 7-6); in group 00 also the palette index (zxnext.vhd ~4504-4517). */
static void zxnextUlaPlusWriteRegisterPort(uint32_t value) {
  ulaPlusMode = (uint8_t)((value >> 6u) & 0x03u);
  if (ulaPlusMode == 0u) ulaPlusIndex = (uint8_t)(value & 0x3fu);
}

/* Port $FF3B write: group 00 writes the ULA+ palette entry, group 01 the enable (~4521-4534). */
static void zxnextUlaPlusWriteDataPort(uint32_t value) {
  if (ulaPlusMode == 0u) zxnextPaletteWriteUlaPlus(ulaPlusIndex, value);
  else if (ulaPlusMode == 1u) ulaPlusEnabled = (value & 0x01u) != 0u;
}

/* Port $FF3B read: group 00 the palette entry, otherwise the enable in bit 0 (~4538-4548). */
static uint32_t zxnextUlaPlusReadDataPort(void) {
  return ulaPlusMode == 0u ? zxnextPaletteReadUlaPlus(ulaPlusIndex) : (ulaPlusEnabled ? 0x01u : 0x00u);
}

static uint32_t zxnextUlaGetNextReg(uint32_t reg) {
  switch (reg & 0xffu) {
    case 0x1au: return ulaClipWindow[ulaClipIndex];
    case 0x26u: return ulaScrollX;
    case 0x27u: return ulaScrollY;
    case 0x68u:
      return (ulaDisableOutput ? 0x80u : 0u) |
        ((uint32_t)ulaBlendingInSluModes << 5u) |
        (zxnextKeyboardGetCancelExtended() ? 0x10u : 0u) |
        (ulaPlusEnabled ? 0x08u : 0u) |
        (ulaHalfPixelScroll ? 0x04u : 0u) |
        (ulaEnableStencilMode ? 0x01u : 0u);
    default: return 0u;
  }
}

static void zxnextUlaResetClipIndex(void) { ulaClipIndex = 0u; }
static uint32_t zxnextUlaGetClipIndex(void) { return ulaClipIndex; }
static uint32_t zxnextUlaGetClip(uint32_t index) { return ulaClipWindow[index & 0x03u]; }
static uint32_t zxnextUlaGetScrollX(void) { return ulaScrollX; }
static uint32_t zxnextUlaGetScrollY(void) { return ulaScrollY; }

static uint32_t zxnextUlaGetPulseIntActive(uint32_t frameTact) {
  /* the Pentagon interrupt starts at the last tact of the frame: the pulse wraps into the next one */
  uint32_t sinceInt = (frameTact + ZXNEXT_RENDERING_TACTS_IN_FRAME - zxnextTimingIntStart) % ZXNEXT_RENDERING_TACTS_IN_FRAME;
  return sinceInt < zxnextTimingIntPulseLength();
}

static uint32_t zxnextNextRegGetMachineTiming(void);

/* p3_floating_bus_dat (zxnext.vhd ~4478-4488): the last byte the CPU moved to or from a contended bank */
static uint8_t zxnextP3FloatingBus = 0xffu;

/*
 * The ULA floating bus at a frame tact (zxula.vhd ~306-340, 573), as NextComposedScreenDevice.floatingBusAt:
 * in the display each 16-HC pair of cells shows pixel, attribute, pixel, attribute for ULA hc 9-10,
 * 11-12, 13-14, 15-0 and $FF for hc 1-8; the border is $FF. +3 timing sets bit 0 of those bytes and
 * shows the contended-access latch the rest of the time. hc_ula = HC - (displayXStart - 12),
 * vc_ula = VC - displayYStart; scrolling and the Timex modes are not applied.
 */
static uint32_t zxnextUlaFloatingBus(uint32_t frameTact) {
  uint32_t p3 = zxnextNextRegGetMachineTiming() == 3u;
  int32_t hc = (int32_t)(frameTact % zxnextTimingTotalHc) - (int32_t)(zxnextTimingDisplayXStart - 12u);
  int32_t vc = (int32_t)(frameTact / zxnextTimingTotalHc) - (int32_t)zxnextTimingDisplayYStart;
  if (hc >= 0 && hc < 256 && vc >= 0 && vc < 192) {
    uint32_t phase = (uint32_t)hc & 0x0fu;
    if ((phase >= 9u || phase == 0u) && hc != 0) {
      uint32_t pair = (uint32_t)(phase == 0u ? hc - 16 : hc) >> 4;
      uint32_t column = pair * 2u + ((phase >= 13u || phase == 0u) ? 1u : 0u);
      uint32_t attribute = phase == 11u || phase == 12u || phase == 15u || phase == 0u;
      uint32_t y = (uint32_t)vc;
      uint32_t offset = attribute
        ? 0x1800u + ((y >> 3) << 5) + column
        : (((y & 0xc0u) << 5) | ((y & 0x07u) << 8) | ((y & 0x38u) << 2) | column);
      uint32_t value = zxnextMemoryReadScreenOffset(offset);
      return p3 ? (value | 0x01u) : value;
    }
  }
  return p3 ? zxnextP3FloatingBus : 0xffu;
}

static uint32_t zxnextUlaGetScanlineForTact(uint32_t tact) {
  return (tact % ZXNEXT_RENDERING_TACTS_IN_FRAME) / ZXNEXT_SCREEN_TOTAL_HC;
}

static uint32_t zxnextUlaGetColumnForTact(uint32_t tact) {
  return (tact % ZXNEXT_RENDERING_TACTS_IN_FRAME) % ZXNEXT_SCREEN_TOTAL_HC;
}

// ---------------------------------------------------------------------------
// Beam-racing raster
//
// The picture used to be produced only by zxnextRenderInstantScreen, once, from end-of-frame state,
// so anything that changed mid-frame - copper MOVEs, palette writes, border colour changes, per-line
// scroll - was invisible: the whole frame showed the last value. (The TypeScript core renders tact
// by tact and never had this problem.)
//
// The raster keeps the renderers but calls them lazily: just before a write that changes what the
// screen shows, it renders the pixels the beam has drawn since the previous such write - with the
// state *before* the write - and at frame completion it renders the rest. A frame with no mid-frame
// changes costs one whole-frame render, as before; each change adds only the rows it spans.
//
// Beam position -> buffer pixel follows the TypeScript core's tact-to-bitmap table
// (NextComposedScreenDevice.generateBitmapOffsetTable, Plus3_50Hz): 456 HC per line, bitmap row 0 at
// VC 16, bitmap x 0 at HC 96, two buffer pixels per HC.
//
// Screen *memory* writes (bank 5/7: ULA, LoRes, tilemap; the displayed Layer 2 bank) catch up too,
// but only to the start of the beam's current row (zxnextRasterMemoryWrite): at most one row render
// per scanline however many bytes a program writes. The row being drawn shows the new contents from
// its first pixel - at most one line of difference from the hardware, which fetches per cell.
// ---------------------------------------------------------------------------

/* Buffer row 0 / x 0 of the current raster: every timing keeps the paper at buffer (96, 48). */
#define ZXNEXT_RASTER_FIRST_VC zxnextTimingFirstVc
#define ZXNEXT_RASTER_FIRST_HC zxnextTimingFirstHc

static uint32_t zxnextRasterScratch[ZXNEXT_PIXEL_COUNT];
/* The frame tact a NextReg write happens at: set by the copper (which runs behind the CPU) while it
   writes; otherwise writes happen at currentFrameTact. */
static uint32_t zxnextNextRegWriteTactOverride = 0xffffffffu;
/* The first buffer pixel of this frame not yet rendered. */
static uint32_t zxnextRasterPixel;

static inline uint32_t zxnextRasterTactToPixel(uint32_t frameTact) {
  uint32_t vc = frameTact / ZXNEXT_SCREEN_TOTAL_HC;
  uint32_t hc = frameTact % ZXNEXT_SCREEN_TOTAL_HC;
  if (vc < ZXNEXT_RASTER_FIRST_VC) return 0u;
  uint32_t row = vc - ZXNEXT_RASTER_FIRST_VC;
  if (row >= ZXNEXT_SCREEN_HEIGHT) return ZXNEXT_PIXEL_COUNT;
  uint32_t x = hc < ZXNEXT_RASTER_FIRST_HC ? 0u : (hc - ZXNEXT_RASTER_FIRST_HC) * 2u;
  return row * ZXNEXT_SCREEN_WIDTH + x;
}

/* The frame tact of the NextReg write in progress: the copper's, or the CPU's. */
static uint32_t zxnextRasterWriteTact(void) {
  return zxnextNextRegWriteTactOverride != 0xffffffffu ? zxnextNextRegWriteTactOverride : currentFrameTact;
}

/*
 * Layer capture (`.plans/LAYER_COMPOSITION_PLAN.md` §4.3, D6, T3, T6, T7).
 *
 * The per-layer buffers hold, per row, the render of that row's *last* span, and the mixer's inputs
 * ($15, $4A, $68, the enables) are read from the current state, so recomposing a paused picture from
 * them is wrong wherever something changed mid-frame. While capture is on (only while an IDE view
 * needs it: T6), every span the raster renders also copies its own pixels of the four layers here,
 * and appends its start pixel and mixer inputs to the frame's span table. A recompose then gives
 * every pixel its own span's inputs: exact on both sides of the beam.
 *
 * The pixel copies need no double buffering - a span overwrites only its own range, so the pixels the
 * beam has not reached this frame still hold last frame's capture. Only the span table is kept twice:
 * this frame's spans cover [0, zxnextRasterPixel), last frame's the rest.
 *
 * All of it is volatile (T8): debugging data, never in a state file.
 */
#define ZXNEXT_CAP_SPAN_MAX 4096u
static uint8_t zxnextLayerCaptureOn;
static uint16_t zxnextCapUla[ZXNEXT_PIXEL_COUNT];
static uint16_t zxnextCapTm[ZXNEXT_PIXEL_COUNT];
static uint16_t zxnextCapL2[ZXNEXT_PIXEL_COUNT];
static uint16_t zxnextCapSpr[ZXNEXT_PIXEL_COUNT];
/* [table][span][0: start pixel, 1: packed ZxnextMixParams] */
static uint32_t zxnextCapSpans[2][ZXNEXT_CAP_SPAN_MAX][2];
static uint32_t zxnextCapSpanCount[2];
/* A table ran out of room: the pixels after its last span are composed with that span's inputs (T7) */
static uint8_t zxnextCapSpanOverflow[2];
/* The table was recorded from its frame's first pixel (capture was on when the frame started) */
static uint8_t zxnextCapSpanComplete[2];
/* Which table is this frame's */
static uint8_t zxnextCapCurrent;
/* The recomposed picture the IDE shows while paused; never zxnextPixelBuffer (§4.2) */
static uint32_t zxnextLayerPreview[ZXNEXT_PIXEL_COUNT];

static void zxnextLayerCaptureInvalidate(void) {
  zxnextCapSpanCount[0] = zxnextCapSpanCount[1] = 0u;
  zxnextCapSpanOverflow[0] = zxnextCapSpanOverflow[1] = 0u;
  zxnextCapSpanComplete[0] = zxnextCapSpanComplete[1] = 0u;
}

/*
 * The debug functions' mixer inputs. A static, not a local: a local whose address is taken lives on
 * the shadow stack, which is linear memory and so in the state image - a probe would have changed it.
 */
static ZxnextMixParams zxnextDebugMixParams;

/* Called by the raster after it rendered (and composed) the span [start, end). */
static void zxnextLayerCaptureSpan(uint32_t start, uint32_t end) {
  for (uint32_t i = start; i < end; i++) {
    zxnextCapUla[i] = zxnextLayerUla[i];
    zxnextCapTm[i] = zxnextLayerTm[i];
    zxnextCapL2[i] = zxnextLayerL2[i];
    zxnextCapSpr[i] = zxnextLayerSpr[i];
  }
  uint32_t t = zxnextCapCurrent;
  uint32_t n = zxnextCapSpanCount[t];
  uint32_t packed = zxnextMixParamsPack(&zxnextLastMixParams);
  // --- Consecutive spans with the same inputs (a memory-write catch-up, a latch) are one span
  if (n > 0u && zxnextCapSpans[t][n - 1u][1] == packed) return;
  if (n >= ZXNEXT_CAP_SPAN_MAX) {
    zxnextCapSpanOverflow[t] = 1u;
    return;
  }
  zxnextCapSpans[t][n][0] = start;
  zxnextCapSpans[t][n][1] = packed;
  zxnextCapSpanCount[t] = n + 1u;
}

/* The frame's picture is complete: its table becomes "last frame's", and a new one starts. */
static void zxnextLayerCaptureFrameDone(void) {
  if (!zxnextLayerCaptureOn) return;
  uint32_t next = zxnextCapCurrent ^ 1u;
  zxnextCapCurrent = (uint8_t)next;
  zxnextCapSpanCount[next] = 0u;
  zxnextCapSpanOverflow[next] = 0u;
  zxnextCapSpanComplete[next] = 1u;
}

static void zxnextLayerSetCapture(uint32_t on) {
  uint32_t was = zxnextLayerCaptureOn;
  zxnextLayerCaptureOn = on ? 1u : 0u;
  if (on && !was) {
    zxnextLayerCaptureInvalidate();
    // --- Switched on between frames: this frame's table starts complete
    zxnextCapSpanComplete[zxnextCapCurrent] = zxnextRasterPixel == 0u;
  }
}

/*
 * The span-table entry that covers pixel i in table t, or -1. Binary search: spans are in pixel order.
 */
static int32_t zxnextLayerCaptureFindSpan(uint32_t t, uint32_t i) {
  int32_t lo = 0, hi = (int32_t)zxnextCapSpanCount[t] - 1, found = -1;
  while (lo <= hi) {
    int32_t mid = (lo + hi) >> 1;
    if (zxnextCapSpans[t][mid][0] <= i) { found = mid; lo = mid + 1; }
    else hi = mid - 1;
  }
  return found;
}

/*
 * The capture status bits zxnextRecomposeForDebug and zxnextProbePixel report:
 * bit 0 exact (every pixel had its own span's inputs), bit 1 capture is on, bit 2 a span table
 * overflowed (T7).
 */
#define ZXNEXT_RECOMPOSE_EXACT 0x01u
#define ZXNEXT_RECOMPOSE_CAPTURED 0x02u
#define ZXNEXT_RECOMPOSE_OVERFLOW 0x04u

/* Composes [from, to) of the capture through table t's spans; returns the status bits it can vouch for. */
static uint32_t zxnextLayerRecomposeTable(uint32_t t, uint32_t from, uint32_t to) {
  if (from >= to) return ZXNEXT_RECOMPOSE_EXACT;
  uint32_t count = zxnextCapSpanCount[t];
  uint32_t exact = zxnextCapSpanComplete[t] && count > 0u;
  ZxnextMixParams* p = &zxnextDebugMixParams;
  int32_t k = zxnextLayerCaptureFindSpan(t, from);
  if (k < 0) {
    // --- Pixels before the table's first span (capture started mid-frame): today's inputs
    uint32_t stop = count > 0u ? zxnextCapSpans[t][0][0] : to;
    if (stop > to) stop = to;
    zxnextMixParamsCurrent(p);
    zxnextComposeRange(p, from, stop, zxnextLayerPreview, zxnextCapUla, zxnextCapTm, zxnextCapL2, zxnextCapSpr);
    from = stop;
    k = 0;
    exact = 0u;
  }
  for (uint32_t s = (uint32_t)k; s < count && from < to; s++) {
    uint32_t spanEnd = s + 1u < count ? zxnextCapSpans[t][s + 1u][0] : to;
    if (spanEnd > to) spanEnd = to;
    if (spanEnd <= from) continue;
    zxnextMixParamsUnpack(zxnextCapSpans[t][s][1], p);
    zxnextComposeRange(p, from, spanEnd, zxnextLayerPreview, zxnextCapUla, zxnextCapTm, zxnextCapL2, zxnextCapSpr);
    from = spanEnd;
  }
  if (zxnextCapSpanOverflow[t]) return ZXNEXT_RECOMPOSE_OVERFLOW;
  return exact ? ZXNEXT_RECOMPOSE_EXACT : 0u;
}

/*
 * Recomposes the paused picture into zxnextLayerPreview with the debug mask in force, and returns the
 * ZXNEXT_RECOMPOSE_* status. With capture on, from the capture (exact unless a table is incomplete or
 * overflowed); otherwise from the live layer buffers with today's mixer inputs (approximate, §4.2).
 */
static uint32_t zxnextLayerRecomposeForDebug(void) {
  zxnextEnsureRgbaTable();
  if (!zxnextLayerCaptureOn) {
    zxnextMixParamsCurrent(&zxnextDebugMixParams);
    zxnextComposeRange(&zxnextDebugMixParams, 0u, ZXNEXT_PIXEL_COUNT, zxnextLayerPreview, zxnextLayerUla, zxnextLayerTm, zxnextLayerL2,
      zxnextLayerSpr);
    return 0u;
  }
  uint32_t beam = zxnextRasterPixel;
  uint32_t cur = zxnextCapCurrent;
  uint32_t a = zxnextLayerRecomposeTable(cur, 0u, beam);
  uint32_t b = zxnextLayerRecomposeTable(cur ^ 1u, beam, ZXNEXT_PIXEL_COUNT);
  return ZXNEXT_RECOMPOSE_CAPTURED | (a & b & ZXNEXT_RECOMPOSE_EXACT) | ((a | b) & ZXNEXT_RECOMPOSE_OVERFLOW);
}

/*
 * What the probe found at one pixel (D7), read by the IDE as 12 words:
 *   0-3  the ULA, tilemap, Layer 2 and sprite values (ZXNEXT_PX_* encoding) the mixer received
 *   4    the packed mixer inputs in force for the pixel (zxnextMixParamsPack)
 *   5    the winner (ZXNEXT_WHY_*) with the debug mask applied
 *   6    the 9-bit colour with the mask applied (what the debug view shows, solo aside)
 *   7    the winner without the mask (what the machine shows)
 *   8    the 9-bit colour without the mask
 *   9    ZXNEXT_RECOMPOSE_* bits for this pixel
 *   10   the span's first pixel (or 0)
 *   11   1 if the pixel was drawn this frame (before the beam), 0 if it is last frame's
 */
static uint32_t zxnextLayerProbe[12];

/*
 * The span pixel i belongs to: fills zxnextDebugMixParams with its mixer inputs and returns
 * ZXNEXT_RECOMPOSE_* bits; zxnextLayerAtSpanStart gets the span's first pixel. Statics, not out
 * parameters: an address-taken local would live on the shadow stack, in the state image (T8).
 */
static uint32_t zxnextLayerAtSpanStart;

static uint32_t zxnextLayerParamsAt(uint32_t i) {
  ZxnextMixParams* p = &zxnextDebugMixParams;
  zxnextLayerAtSpanStart = 0u;
  if (!zxnextLayerCaptureOn) {
    zxnextMixParamsCurrent(p);
    return 0u;
  }
  uint32_t table = i < zxnextRasterPixel ? zxnextCapCurrent : (zxnextCapCurrent ^ 1u);
  int32_t k = zxnextLayerCaptureFindSpan(table, i);
  uint32_t status = ZXNEXT_RECOMPOSE_CAPTURED;
  if (k < 0) {
    zxnextMixParamsCurrent(p);
    return status;
  }
  zxnextMixParamsUnpack(zxnextCapSpans[table][k][1], p);
  zxnextLayerAtSpanStart = zxnextCapSpans[table][k][0];
  if (zxnextCapSpanComplete[table]) status |= ZXNEXT_RECOMPOSE_EXACT;
  if (zxnextCapSpanOverflow[table] && (uint32_t)k + 1u == zxnextCapSpanCount[table]) {
    status = (status & ~ZXNEXT_RECOMPOSE_EXACT) | ZXNEXT_RECOMPOSE_OVERFLOW;
  }
  return status;
}

static uint32_t zxnextLayerProbePixel(uint32_t i) {
  for (uint32_t k = 0u; k < 12u; k++) zxnextLayerProbe[k] = 0u;
  if (i >= ZXNEXT_PIXEL_COUNT) return (uint32_t)(uintptr_t)zxnextLayerProbe;
  const ZxnextMixParams* p = &zxnextDebugMixParams;
  uint32_t status = zxnextLayerParamsAt(i);
  uint32_t cap = zxnextLayerCaptureOn;
  uint32_t u = cap ? zxnextCapUla[i] : zxnextLayerUla[i];
  uint32_t t = cap ? zxnextCapTm[i] : zxnextLayerTm[i];
  uint32_t l = cap ? zxnextCapL2[i] : zxnextLayerL2[i];
  uint32_t sp = cap ? zxnextCapSpr[i] : zxnextLayerSpr[i];
  uint32_t mask = zxnextLayerDebugMask & ZXNEXT_LAYER_BITS;
  uint32_t plain = zxnextComposePixel(p, u, t, l, sp, 1u);
  uint32_t masked = zxnextComposePixel(p, zxnextLayerDebugMasked(mask, ZXNEXT_LAYER_BIT_ULA, u),
    zxnextLayerDebugMasked(mask, ZXNEXT_LAYER_BIT_TM, t), zxnextLayerDebugMasked(mask, ZXNEXT_LAYER_BIT_L2, l),
    zxnextLayerDebugMasked(mask, ZXNEXT_LAYER_BIT_SPR, sp), 1u);
  zxnextLayerProbe[0] = u;
  zxnextLayerProbe[1] = t;
  zxnextLayerProbe[2] = l;
  zxnextLayerProbe[3] = sp;
  zxnextLayerProbe[4] = zxnextMixParamsPack(p);
  zxnextLayerProbe[5] = ZXNEXT_MIX_WHY(masked);
  zxnextLayerProbe[6] = masked & ZXNEXT_PX_RGB;
  zxnextLayerProbe[7] = ZXNEXT_MIX_WHY(plain);
  zxnextLayerProbe[8] = plain & ZXNEXT_PX_RGB;
  zxnextLayerProbe[9] = status;
  zxnextLayerProbe[10] = zxnextLayerAtSpanStart;
  zxnextLayerProbe[11] = i < zxnextRasterPixel;
  return (uint32_t)(uintptr_t)zxnextLayerProbe;
}

/*
 * The machine's own picture at half width (every other column, every row), composed from the capture
 * with no debug view in force: the Layers document's composite (D9). Half the width only, because a
 * buffer pixel is half as wide as it is tall (the 0.5:1 aspect of the Next screen): 360 x 288 square
 * pixels have the screen's shape. The live picture cannot serve, because while running it carries
 * the debug mask.
 */
#define ZXNEXT_LAYER_THUMB_WIDTH (ZXNEXT_SCREEN_WIDTH / 2u)
#define ZXNEXT_LAYER_THUMB_HEIGHT ZXNEXT_SCREEN_HEIGHT
static uint32_t zxnextLayerThumb[ZXNEXT_LAYER_THUMB_WIDTH * ZXNEXT_LAYER_THUMB_HEIGHT];

static uint32_t zxnextLayerRenderComposite(void) {
  zxnextEnsureRgbaTable();
  uint32_t cap = zxnextLayerCaptureOn;
  const uint16_t* ula = cap ? zxnextCapUla : zxnextLayerUla;
  const uint16_t* tm = cap ? zxnextCapTm : zxnextLayerTm;
  const uint16_t* l2 = cap ? zxnextCapL2 : zxnextLayerL2;
  const uint16_t* spr = cap ? zxnextCapSpr : zxnextLayerSpr;
  for (uint32_t y = 0u; y < ZXNEXT_LAYER_THUMB_HEIGHT; y++) {
    for (uint32_t x = 0u; x < ZXNEXT_LAYER_THUMB_WIDTH; x++) {
      uint32_t i = y * ZXNEXT_SCREEN_WIDTH + (x << 1u);
      zxnextLayerParamsAt(i);
      uint32_t out = zxnextComposePixel(&zxnextDebugMixParams, ula[i], tm[i], l2[i], spr[i], 0u);
      zxnextLayerThumb[y * ZXNEXT_LAYER_THUMB_WIDTH + x] = zxnextRgbaTable[out];
    }
  }
  return (uint32_t)(uintptr_t)zxnextLayerThumb;
}

/* Renders buffer pixels [zxnextRasterPixel, endPixel) from the current state. */
static void zxnextRasterRenderSpan(uint32_t endPixel) {
  if (endPixel > ZXNEXT_PIXEL_COUNT) endPixel = ZXNEXT_PIXEL_COUNT;
  uint32_t start = zxnextRasterPixel;
  if (endPixel <= start) return;

  // --- Render whole rows into the scratch buffer, then copy only the span the beam covered.
  zxnextRenderTarget = zxnextRasterScratch;
  zxnextRenderRowFirst = start / ZXNEXT_SCREEN_WIDTH;
  zxnextRenderRowLast = (endPixel - 1u) / ZXNEXT_SCREEN_WIDTH;
  zxnextUlaRenderInstantScreen();
  zxnextRenderTarget = zxnextPixelBuffer;
  zxnextRenderRowFirst = 0u;
  zxnextRenderRowLast = ZXNEXT_SCREEN_HEIGHT - 1u;

  for (uint32_t i = start; i < endPixel; i++) zxnextPixelBuffer[i] = zxnextRasterScratch[i];
  if (zxnextLayerCaptureOn) zxnextLayerCaptureSpan(start, endPixel);
  zxnextRasterPixel = endPixel;
}

/*
 * Renders buffer pixels [zxnextRasterPixel, endPixel), applying each pending ULA latch (border, scroll)
 * at its own pixel: the span before it with the old value, the rest with the new one. So a write never
 * makes the raster draw past the beam, and a change that lands between the write and its latch point
 * (a copper palette MOVE) still shows where it happens.
 */
static void zxnextRasterRenderTo(uint32_t endPixel) {
  for (;;) {
    uint32_t next = ZXNEXT_ULA_LATCH_COUNT;
    for (uint32_t i = 0; i < ZXNEXT_ULA_LATCH_COUNT; i++) {
      if (ulaLatchPending[i] && (next == ZXNEXT_ULA_LATCH_COUNT || ulaLatchTact[i] < ulaLatchTact[next])) next = i;
    }
    if (next == ZXNEXT_ULA_LATCH_COUNT) break;
    uint32_t latchPixel = zxnextRasterTactToPixel(ulaLatchTact[next]);
    if (latchPixel >= endPixel) break;
    zxnextRasterRenderSpan(latchPixel);
    ulaShown[next] = ulaLatchValue[next];
    ulaLatchPending[next] = 0u;
  }
  zxnextRasterRenderSpan(endPixel);
}

/*
 * The frame tact from which a ULA scroll ($26/$27) write shows.
 *
 * The ULA latches scroll once per 8-pixel cell, not per pixel (zxula.vhd: `px`/`py` load at
 * hc(3:0) = 3/B). The TypeScript core samples at raw HC sub-positions 7/F and loads the shift register
 * at 0/8, so a write at raw HC h first affects the cell starting at the next multiple of 8 above h.
 * The pixels before that cell still show the old scroll.
 */
static uint32_t zxnextRasterUlaScrollTact(uint32_t frameTact) {
  uint32_t hc = frameTact % ZXNEXT_SCREEN_TOTAL_HC;
  uint32_t cell = (hc + 1u + 7u) & ~7u;
  return frameTact - hc + cell;
}

/*
 * The frame tact from which a port $FE border colour shows. zxula.vhd ~427-441: the border reaches the
 * picture through attr_reg, which takes the port value only at the shift-register loads, every 8
 * pixels (HC = displayXStart mod 8, like the scroll cells above); Pentagon timing reloads it every
 * clock. The palette lookup stays per pixel.
 */
static uint32_t zxnextRasterBorderTact(uint32_t frameTact) {
  if (zxnextTimingTotalVc == 320u) return frameTact; /* the Pentagon raster */
  uint32_t hc = frameTact % ZXNEXT_SCREEN_TOTAL_HC;
  return frameTact - hc + ((hc + 7u) & ~7u);
}

/* Call just before a write that changes the picture, with the frame tact the write happens at. */
static void zxnextRasterCatchUp(uint32_t frameTact) {
  zxnextRasterRenderTo(zxnextRasterTactToPixel(frameTact));
}

/* Completes the frame's picture; called when the frame completes, before anything resets. */
static void zxnextRasterFinishFrame(void) {
  zxnextRasterRenderTo(ZXNEXT_PIXEL_COUNT);
  zxnextUlaApplyAllLatches(); /* a latch point past the last visible pixel */
  zxnextLayerCaptureFrameDone();
  zxnextRasterPixel = 0u;
}

/*
 * Called by the memory write path with the physical offset about to change. A byte the renderers read
 * - bank 5 or 7 (ULA/HiColor/HiRes/LoRes/tilemap; zxnext.vhd `ula_bank_do`, `tm_mem`) or the five 16K
 * banks from the displayed Layer 2 bank - renders the rows the beam has finished with the old contents.
 */
static void zxnextRasterMemoryWrite(uint32_t physical, uint32_t value) {
  if (zxnextMemoryReadPhysical(physical) == (value & 0xffu)) return;
  uint32_t video = (physical >= ZXNEXT_LORES_BANK_05_OFFSET && physical < ZXNEXT_LORES_BANK_05_OFFSET + 0x4000u) ||
    (physical >= ZXNEXT_BANK_07_OFFSET && physical < ZXNEXT_BANK_07_OFFSET + 0x4000u);
  if (!video && zxnextLayer2GetEnabled()) {
    uint32_t bank16 = zxnextLayer2GetActiveRamBank(); /* the displayed bank: always $12 */
    uint32_t base = ZXNEXT_LAYER2_RAM_OFFSET + (bank16 << 14u);
    video = physical >= base && physical < base + 5u * 0x4000u;
  }
  if (!video) return;
  uint32_t rowStart = (zxnextRasterTactToPixel(currentFrameTact) / ZXNEXT_SCREEN_WIDTH) * ZXNEXT_SCREEN_WIDTH;
  zxnextRasterRenderTo(rowStart);
}

static void zxnextRasterReset(void) {
  zxnextUlaApplyAllLatches();
  zxnextRasterPixel = 0u;
  // --- The capture no longer matches the frame: a reset is not a frame end (T3)
  zxnextLayerCaptureInvalidate();
  zxnextCapSpanComplete[zxnextCapCurrent] = zxnextLayerCaptureOn;
}

/*
 * NextRegs whose value the renderers read. Anything else (MMU, sound, interrupts, CPU speed, copper
 * control, ...) cannot change a pixel, so writing it must not cost a render.
 */
static inline uint32_t zxnextRasterIsVideoNextReg(uint32_t reg) {
  switch (reg & 0xffu) {
    case 0x12u: case 0x13u: case 0x14u: case 0x15u: case 0x16u: case 0x17u: case 0x18u:
    case 0x19u: case 0x1au: case 0x1bu: case 0x1cu:
    case 0x26u: case 0x27u:
    case 0x2fu: case 0x30u: case 0x31u: case 0x32u: case 0x33u:
    case 0x34u: case 0x35u: case 0x36u: case 0x37u: case 0x38u: case 0x39u:
    case 0x41u: case 0x42u: case 0x43u: case 0x44u:
    case 0x4au: case 0x4bu: case 0x4cu:
    case 0x68u: case 0x69u: case 0x6au: case 0x6bu: case 0x6cu: case 0x6eu: case 0x6fu:
    case 0x70u: case 0x71u:
    case 0x75u: case 0x76u: case 0x77u: case 0x78u: case 0x79u:
      return 1u;
    default:
      return 0u;
  }
}
