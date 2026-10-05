// ----------------------------------------------------------------------------
// The Timex SCLD: screen modes, port $FF, and the TC2048's Kempston port
//
// `.plans/TIMEX_SCORPION_PLAN.md` G9.4a. Included by `zx-spectrum-ula.c` in place of its own
// renderers when the core defines `SP48_SCLD` (the Timex core, `timex.c`). The state lives in the
// core's statics: `sp48ScldPortFf` (the control register), `sp48ScldHiresBright` (a per-model fact)
// and `sp48KempstonState`.
//
// What the hardware does, and where each fact comes from (plan §8):
//
// - Port $FF (TS2068 Technical Manual, 2.1.13.1 and 5.2): bits 0-2 select the video mode -
//   000 the primary display file at $4000, 001 the second display file at $6000 (same layout),
//   010 extended colour (pixels from the primary file, one attribute byte per 8 x 1 pixels at the
//   same address in the second file), 110 the 64-column (512 x 192) mode (even columns from the
//   primary file, odd columns from the second). Bits 3-5 pick the 64-column ink, the paper being its
//   complement, and the border shows the paper colour. Bit 6 inhibits the frame interrupt. Bit 7
//   selects the cartridge or EXROM bank (the 2068's memory map; nothing on the TC2048).
// - Reading port $FF returns the last value written (World of Spectrum Timex FAQ).
// - The manual calls the other mode values unpredictable. Klive decodes the bits one by one, which
//   is how the Next's implementation of the SCLD reads them (zxula.vhd ~230-260): bit 0 moves the
//   pixel (and plain attribute) fetches to the second file, bit 1 takes the attribute byte from the
//   second file's pixel address, bit 2 draws the two fetched bytes as 16 narrow pixels.
// - 64-column brightness: the TS2068 manual says BRIGHT is fixed at 0; the WoS Timex FAQ (written
//   from the TC2048) says every colour, the border included, is BRIGHT, and the Next agrees. The
//   core keeps it per model (`sp48ScldHiresBright`); the TC2048 is BRIGHT.
//
// The picture has two buffer pixels per Spectrum pixel in every mode (`SP48_PIXEL_SCALE`), so a
// mode change mid-frame needs no size change; the timing tables stay in Spectrum pixels.
// ----------------------------------------------------------------------------

uint32_t sp48ReadFloatingBus(void);

/* The 64-column mode's attribute: ink from bits 3-5, the paper its complement */
static inline uint8_t scldHiresAttr(void) {
  const uint8_t ink = (uint8_t)((sp48ScldPortFf >> 3u) & 0x07u);
  return (uint8_t)((sp48ScldHiresBright != 0u ? 0x40u : 0x00u) | ((ink ^ 0x07u) << 3u) | ink);
}

/* The border: the paper colour in the 64-column mode, port $FE's colour otherwise */
static inline uint32_t scldBorderPixel(void) {
  if ((sp48ScldPortFf & 0x04u) != 0u) {
    return sp48AttrColors[0][scldHiresAttr()][0];
  }
  return getBorderPixel(sp48BorderColor);
}

/* The byte the SCLD fetches at a pixel-fetch tact */
static inline uint8_t scldFetchPixel(uint32_t tact) {
  const uint32_t offset = sp48RenderingPixelAddress[tact];
  return readScreenMemoryOffset((sp48ScldPortFf & 0x01u) != 0u ? offset + 0x2000u : offset);
}

/*
 * The byte the SCLD fetches at an attribute-fetch tact: with bit 1 set, the second display file's
 * byte at the column's pixel address (the extended-colour attribute, or the 64-column mode's odd
 * column); otherwise the attribute file of the selected display file.
 */
static inline uint8_t scldFetchAttr(uint32_t tact) {
  if ((sp48ScldPortFf & 0x02u) != 0u) {
    return readScreenMemoryOffset(sp48RenderingPixelAddress[tact] + 0x2000u);
  }
  const uint32_t offset = sp48RenderingAttributeAddress[tact];
  return readScreenMemoryOffset((sp48ScldPortFf & 0x01u) != 0u ? offset + 0x2000u : offset);
}

/* Four buffer pixels: the two Spectrum pixels of one tact */
static inline void scldPut4(uint32_t index, uint32_t c0, uint32_t c1, uint32_t c2, uint32_t c3) {
  const uint32_t i = index * SP48_PIXEL_SCALE;
  if (i + 3u >= pixelBufferWordCount()) {
    return;
  }
  sp48PixelBuffer[i] = c0;
  sp48PixelBuffer[i + 1u] = c1;
  sp48PixelBuffer[i + 2u] = c2;
  sp48PixelBuffer[i + 3u] = c3;
}

static inline void renderBorderPixelsAt(uint32_t index) {
  const uint32_t pixel = scldBorderPixel();
  scldPut4(index, pixel, pixel, pixel, pixel);
}

/*
 * One tact of a fetched cell. In the 64-column mode the pixel byte (primary file) and the "attribute"
 * byte (the second file's odd column) form one 16-pixel row, drawn 4 narrow pixels a tact; otherwise
 * two Spectrum pixels, each two buffer pixels wide.
 */
static inline void scldRenderCellTact(uint32_t index, uint8_t *pixelByte, uint8_t *attrByte) {
  const uint8_t pixels = *pixelByte;
  if ((sp48ScldPortFf & 0x04u) != 0u) {
    const uint32_t *colors = sp48AttrColors[0][scldHiresAttr()];
    scldPut4(
      index,
      colors[(pixels >> 7u) & 0x01u],
      colors[(pixels >> 6u) & 0x01u],
      colors[(pixels >> 5u) & 0x01u],
      colors[(pixels >> 4u) & 0x01u]
    );
    *pixelByte = (uint8_t)((pixels << 4u) | (*attrByte >> 4u));
    *attrByte = (uint8_t)(*attrByte << 4u);
    return;
  }
  const uint32_t *colors = sp48AttrColors[flashFlag()][*attrByte];
  const uint32_t first = colors[(pixels >> 7u) & 0x01u];
  const uint32_t second = colors[(pixels >> 6u) & 0x01u];
  scldPut4(index, first, first, second, second);
  *pixelByte = (uint8_t)(pixels << 2u);
}

static void renderUlaTact(uint32_t tact) {
  if (tact >= sp48TactsInFrame) {
    return;
  }

  const uint32_t index = sp48RenderingPixelIndex[tact];
  switch (sp48RenderingPhase[tact]) {
    case SP48_RENDER_PHASE_BORDER:
      renderBorderPixelsAt(index);
      break;

    case SP48_RENDER_PHASE_BORDER_FETCH_PIXEL:
      renderBorderPixelsAt(index);
      sp48PixelByte1 = scldFetchPixel(tact);
      break;

    case SP48_RENDER_PHASE_BORDER_FETCH_ATTR:
      renderBorderPixelsAt(index);
      sp48AttrByte1 = scldFetchAttr(tact);
      break;

    case SP48_RENDER_PHASE_DISPLAY_B1:
      scldRenderCellTact(index, &sp48PixelByte1, &sp48AttrByte1);
      break;

    case SP48_RENDER_PHASE_DISPLAY_B1_FETCH_B2:
      scldRenderCellTact(index, &sp48PixelByte1, &sp48AttrByte1);
      sp48PixelByte2 = scldFetchPixel(tact);
      break;

    case SP48_RENDER_PHASE_DISPLAY_B1_FETCH_A2:
      scldRenderCellTact(index, &sp48PixelByte1, &sp48AttrByte1);
      sp48AttrByte2 = scldFetchAttr(tact);
      break;

    case SP48_RENDER_PHASE_DISPLAY_B2:
      scldRenderCellTact(index, &sp48PixelByte2, &sp48AttrByte2);
      break;

    case SP48_RENDER_PHASE_DISPLAY_B2_FETCH_B1:
      scldRenderCellTact(index, &sp48PixelByte2, &sp48AttrByte2);
      sp48PixelByte1 = scldFetchPixel(tact);
      break;

    case SP48_RENDER_PHASE_DISPLAY_B2_FETCH_A1:
      scldRenderCellTact(index, &sp48PixelByte2, &sp48AttrByte2);
      sp48AttrByte1 = scldFetchAttr(tact);
      break;
  }
}

/* The SCLD after a reset: the primary display file, interrupts on, joystick released */
static void scldReset(void) {
  sp48ScldPortFf = 0u;
  sp48KempstonState = 0u;
}

/*
 * Writes the control register. The picture is drawn up to now first, so a mode change takes effect
 * at the tact of the OUT, as the fetches that follow it see the new mode.
 */
static void scldWritePortFf(uint32_t value) {
  const uint8_t next = (uint8_t)(value & 0xffu);
  if (next == sp48ScldPortFf) {
    return;
  }
  renderUlaUntilCurrentTact();
  sp48ScldPortFf = next;
}

/*
 * The ports with A0 set (the ULA's own port has A0 low):
 * - $FF (the full low byte): the SCLD control register, read back as written;
 * - A5 low: the TC2048's built-in Kempston joystick, bits 0-4 right, left, down, up, fire, active
 *   high. Klive decodes A5 alone, as the Kempston interface does (plan §8: the TC2048's own decoding
 *   is not documented);
 * - anything else: the floating bus, as on the 48K.
 */
static uint32_t scldReadNonFePort(uint32_t address) {
  if ((address & 0xffu) == 0xffu) {
    return sp48ScldPortFf;
  }
  if ((address & 0x20u) == 0u) {
    return sp48KempstonState;
  }
  return sp48ReadFloatingBus();
}

static void scldWriteNonFePort(uint32_t address, uint32_t value) {
  if ((address & 0xffu) == 0xffu) {
    scldWritePortFf(value);
  }
}
