/*
 * Cambridge Z88 - the LCD: the Blink renders the screen map at SBR through the font tables PB0-PB3.
 *
 * A port of `Z88ScreenDevice.renderScreen` (Step 8 of `.plans/CAMBRIDGE_Z88_WASM_MIGRATION_PLAN.md`),
 * run at the start of every frame; the picture is drawn every 8th frame (40 ms). Rows of 256 bytes of
 * (char, attribute) cells: LORES cells are 6 pixels wide (9-bit code; $1C0+ are user graphics from
 * LORES0), HIRES cells 8 pixels (10-bit code; $300+ come from HIRES1), the cursor is a LORES cell
 * inverted while TIM0 <= 120, a null cell takes no space, FLS cells vanish every other second.
 *
 * Every byte is read from the physical memory directly (as `directReadMemory` does), so a flash
 * card's command state never affects the picture. Reads beyond the 4 MB read 0, as the TypeScript
 * renderer's out-of-range reads do in its bit arithmetic. Kept for parity: a row of LORES cells leaves
 * the last 4 pixels of a 640-pixel row unpainted.
 */

#define Z88_PX_ON 0xff7d1b46u
#define Z88_PX_OFF 0xffb9e0d2u
#define Z88_PX_GREY 0xffa7b090u
#define Z88_PX_SCREEN_OFF 0xffa0a0a0u

#define Z88_ATTR_HRS 0x20u
#define Z88_ATTR_REV 0x10u
#define Z88_ATTR_FLS 0x08u
#define Z88_ATTR_GRY 0x04u
#define Z88_ATTR_UND 0x02u
#define Z88_ATTR_NUL 0x34u
#define Z88_ATTR_CUR 0x38u

#define Z88_SBR_ROW_WIDTH 256u
#define Z88_TEXT_FLASH_TOGGLE 200u
#define Z88_UI_FRAME_FREQUENCY 8u

static uint8_t z88FlashFlag;
static uint8_t z88TextFlashPhase;
static uint32_t z88TextFlashCount;
static uint8_t z88LcdWentOff;

/* The font table addresses of the current render */
static uint32_t z88LoRes0;
static uint32_t z88LoRes0Bank;
static uint32_t z88LoRes1;
static uint32_t z88LoRes1Bank;
static uint32_t z88HiRes0;
static uint32_t z88HiRes0Bank;
static uint32_t z88HiRes1;
static uint32_t z88HiRes1Bank;
static uint32_t z88LcdWidth;

static inline uint32_t z88ScreenRead(uint32_t address) {
  return address < Z88_MEMORY_SIZE ? z88Memory[address] : 0u;
}

/* The screen reset: the flash state; the LCD registers are reset with the Blink */
static void z88ScreenReset(void) {
  z88FlashFlag = 0u;
  z88TextFlashPhase = 0u;
  z88TextFlashCount = 0u;
  z88LcdWentOff = 0u;
}

static void z88DrawLoResRow(uint32_t ptr, uint32_t color, uint32_t pattern) {
  z88PixelBuffer[ptr] = pattern & 0x20u ? color : Z88_PX_OFF;
  z88PixelBuffer[ptr + 1u] = pattern & 0x10u ? color : Z88_PX_OFF;
  z88PixelBuffer[ptr + 2u] = pattern & 0x08u ? color : Z88_PX_OFF;
  z88PixelBuffer[ptr + 3u] = pattern & 0x04u ? color : Z88_PX_OFF;
  z88PixelBuffer[ptr + 4u] = pattern & 0x02u ? color : Z88_PX_OFF;
  z88PixelBuffer[ptr + 5u] = pattern & 0x01u ? color : Z88_PX_OFF;
}

static void z88DrawHiResRow(uint32_t ptr, uint32_t color, uint32_t pattern) {
  for (uint32_t bit = 0u; bit < 8u; bit++) {
    z88PixelBuffer[ptr + bit] = pattern & (0x80u >> bit) ? color : Z88_PX_OFF;
  }
}

/* The address of a LORES character's font: a user graphic from LORES0, else LORES1 */
static uint32_t z88LoResFontAddress(uint32_t ch, uint32_t attr) {
  uint32_t fontOffset = ((attr & 0x01u) << 8) | ch;
  uint32_t fontBank;
  if (fontOffset >= 0x01c0u) {
    fontOffset = z88LoRes0 + ((ch & 0x3fu) << 3);
    fontBank = z88LoRes0Bank;
  } else {
    fontOffset = z88LoRes1 + (fontOffset << 3);
    fontBank = z88LoRes1Bank;
  }
  return (fontOffset & 0x3fffu) | (fontBank << 14);
}

static void z88DrawLoResChar(uint32_t x, uint32_t y, uint32_t ch, uint32_t attr) {
  if (z88LcdWidth < x + 6u) return;
  uint32_t ptr = x + y * z88LcdWidth;

  if ((attr & Z88_ATTR_FLS) && z88TextFlashPhase) {
    for (uint32_t row = 0u; row < 8u; row++, ptr += z88LcdWidth) {
      z88DrawLoResRow(ptr, Z88_PX_OFF, 0u);
    }
    return;
  }

  const uint32_t color = attr & Z88_ATTR_GRY ? Z88_PX_GREY : Z88_PX_ON;
  const uint32_t fontAddress = z88LoResFontAddress(ch, attr);
  const uint32_t mask = attr & Z88_ATTR_REV ? 0xffu : 0x00u;
  for (uint32_t row = 0u; row < 7u; row++, ptr += z88LcdWidth) {
    z88DrawLoResRow(ptr, color, z88ScreenRead(fontAddress + row) ^ mask);
  }
  if (attr & Z88_ATTR_UND) {
    z88DrawLoResRow(ptr, color, attr & Z88_ATTR_REV ? 0x00u : 0xffu);
    return;
  }
  z88DrawLoResRow(ptr, color, z88ScreenRead(fontAddress + 7u) ^ mask);
}

static void z88DrawLoResCursor(uint32_t x, uint32_t y, uint32_t ch, uint32_t attr) {
  if (z88LcdWidth < x + 6u) return;
  uint32_t ptr = x + y * z88LcdWidth;
  const uint32_t fontAddress = z88LoResFontAddress(ch, attr);
  const uint32_t mask = z88FlashFlag ? 0xffu : 0x00u;
  for (uint32_t row = 0u; row < 8u; row++, ptr += z88LcdWidth) {
    z88DrawLoResRow(ptr, Z88_PX_ON, z88ScreenRead(fontAddress + row) ^ mask);
  }
}

static void z88DrawHiResChar(uint32_t x, uint32_t y, uint32_t ch, uint32_t attr) {
  if (z88LcdWidth < x + 8u) return;
  uint32_t ptr = x + y * z88LcdWidth;

  if ((attr & Z88_ATTR_FLS) && z88TextFlashPhase) {
    for (uint32_t row = 0u; row < 8u; row++, ptr += z88LcdWidth) {
      z88DrawHiResRow(ptr, Z88_PX_OFF, 0u);
    }
    return;
  }

  const uint32_t color = attr & Z88_ATTR_GRY ? Z88_PX_GREY : Z88_PX_ON;
  uint32_t fontOffset = ((attr & 0x03u) << 8) | ch;
  uint32_t fontBank;
  if (fontOffset >= 0x0300u) {
    fontOffset = z88HiRes1 + (ch << 3);
    fontBank = z88HiRes1Bank;
  } else {
    fontOffset = z88HiRes0 + (fontOffset << 3);
    fontBank = z88HiRes0Bank;
  }
  const uint32_t fontAddress = (fontOffset & 0x3fffu) | (fontBank << 14);
  const uint32_t mask = attr & Z88_ATTR_REV ? 0xffu : 0x00u;
  for (uint32_t row = 0u; row < 8u; row++, ptr += z88LcdWidth) {
    z88DrawHiResRow(ptr, color, z88ScreenRead(fontAddress + row) ^ mask);
  }
}

/*
 * The colour around the LCD: what the glass shows where no pixel is lit - unlit green, or grey once
 * the LCD was painted off. The picture has no border of its own, so the renderer pads it with this
 * colour to keep the display's rounded corners off the pixels (issue #1374). It follows the last
 * paint, not COM.LCDON, so the surround never disagrees with the picture it frames.
 */
uint32_t z88GetLcdSurroundColor(void) {
  return z88LcdWentOff ? Z88_PX_SCREEN_OFF : Z88_PX_OFF;
}

static void z88RenderScreenOff(void) {
  const uint32_t words = z88GetScreenWidth() * z88GetScreenHeight();
  for (uint32_t i = 0u; i < words; i++) z88PixelBuffer[i] = Z88_PX_SCREEN_OFF;
}

/* Draws the whole LCD from the current screen map and font tables */
static void z88DrawScreen(void) {
  z88LcdWidth = z88GetScreenWidth();
  const uint32_t ctrlCharsPerRow = z88LcdWidth / 6u;

  uint32_t loRes0 = ((((uint32_t)z88Pb[0] << 3) & 0xf700u) | (((uint32_t)z88Pb[0] << 1) & 0x003fu)) << 8;
  z88LoRes0Bank = loRes0 >> 16;
  z88LoRes0 = loRes0 & 0x3fffu;
  uint32_t loRes1 = ((((uint32_t)z88Pb[1] << 6) & 0xff00u) | (((uint32_t)z88Pb[1] << 4) & 0x0030u)) << 8;
  z88LoRes1Bank = loRes1 >> 16;
  z88LoRes1 = loRes1 & 0x3fffu;
  uint32_t hiRes0 = ((((uint32_t)z88Pb[2] << 7) & 0xff00u) | (((uint32_t)z88Pb[2] << 5) & 0x0020u)) << 8;
  z88HiRes0Bank = hiRes0 >> 16;
  z88HiRes0 = hiRes0 & 0x3fffu;
  uint32_t hiRes1 = ((((uint32_t)z88Pb[3] << 5) & 0xff00u) | (((uint32_t)z88Pb[3] << 3) & 0x0038u)) << 8;
  z88HiRes1Bank = hiRes1 >> 16;
  z88HiRes1 = hiRes1 & 0x3fffu;
  uint32_t sbr = ((((uint32_t)z88Sbr << 5) & 0xff00u) | (((uint32_t)z88Sbr << 3) & 0x0038u)) << 8;
  const uint32_t sbrBank = sbr >> 16;
  sbr &= 0x3fffu;

  uint32_t coordY = 0u;
  uint32_t rowSbrPtr = sbr | (sbrBank << 14);
  for (uint32_t rowCount = z88Sch; rowCount; rowCount--) {
    uint32_t coordX = 0u;
    uint32_t sbrPtr = rowSbrPtr;
    for (uint32_t column = ctrlCharsPerRow + 1u; column; column--, sbrPtr += 2u) {
      const uint32_t ch = z88ScreenRead(sbrPtr);
      const uint32_t attr = z88ScreenRead(sbrPtr + 1u);
      if (!(attr & Z88_ATTR_HRS)) {
        z88DrawLoResChar(coordX, coordY, ch, attr);
        coordX += 6u;
      } else if ((attr & Z88_ATTR_CUR) == Z88_ATTR_CUR) {
        z88DrawLoResCursor(coordX, coordY, ch, attr);
        coordX += 6u;
      } else if ((attr & Z88_ATTR_NUL) != Z88_ATTR_NUL) {
        z88DrawHiResChar(coordX, coordY, ch, attr);
        coordX += 8u;
      }
    }

    /* The pixels right of the last cell are unlit */
    for (uint32_t row = 0u; row < 8u; row++) {
      uint32_t ptr = coordX + (coordY + row) * z88LcdWidth;
      for (uint32_t column = coordX; column < z88LcdWidth; column++) z88PixelBuffer[ptr++] = Z88_PX_OFF;
    }

    coordY += 8u;
    rowSbrPtr += Z88_SBR_ROW_WIDTH;
  }
}

/*
 * The frame-start work of `renderScreen`: the cursor flash follows TIM0, the text flash toggles every
 * 200 frames, and every 8th frame the LCD is drawn - or, with COM.LCDON clear, painted off once.
 */
static void z88RenderScreen(void) {
  z88FlashFlag = z88Tim[0] <= 120u ? 1u : 0u;
  if (++z88TextFlashCount >= Z88_TEXT_FLASH_TOGGLE) {
    z88TextFlashCount = 0u;
    z88TextFlashPhase = !z88TextFlashPhase;
  }

  if (z88Frames % Z88_UI_FRAME_FREQUENCY) return;

  if (!(z88Com & Z88_COM_LCDON)) {
    if (!z88LcdWentOff) z88RenderScreenOff();
    z88LcdWentOff = 1u;
    return;
  }
  z88LcdWentOff = 0u;
  z88DrawScreen();
}
