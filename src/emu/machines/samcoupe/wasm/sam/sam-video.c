/*
 * The ASIC's picture and its cell stepper (plan §3.3, §7, D6; ASIC_VIDEO_MEMORY_TIMING.md §1, §3).
 *
 * Time: a line is 384 T (48 cells of 8 T), a frame 312 lines; the machine frame starts at the frame
 * interrupt (vc 244, hc 0), so frame line L is vc = (L + 244) % 312 and screen line 0 is frame line 68.
 * `hc` 0 is the start of the right border after the previous screen line; a screen line's pixels are
 * shown at hc 128-383 and fetched one cell earlier (the 8-T pipeline).
 *
 * The stepper runs eagerly, one cell at a time, as the CPU's clock passes the cell's start
 * (`samAdvanceTacts`): the cell is drawn with the registers as they are at its start, so a write lands
 * from the next cell on (plan: SAM_CLUT_LATENCY of one cell; border writes "at the next screen memory
 * sync"). A cell's step also fetches the screen bytes the next cell shows, latches the contention mode
 * (sam-timing.c) and catches the audio up (sam-audio.c).
 *
 * The picture is drawn at the 12 MHz pixel clock (16 pixels a cell), so mode 3's 512 pixels need no
 * special path. The TV window is 640 x 288: hc 96-383 of a line and hc 0-31 of the next (the right
 * border after it), and 48 lines above and below the screen (vc 264-311, 0-191, 192-239; plan Q3).
 *
 * Modes (VMPR bits 6-5): 1 the Spectrum layout (attributes at +1800h), 2 linear with an attribute byte
 * per 8 x 1 cell (+2000h), 3 512 x 192 in 4 colours (bits 7-6 leftmost, pixel 01 -> CLUT 2, 10 -> 1, the
 * high two index bits from HMPR bits 6-5), 4 256 x 192 in 16 colours (high nibble left). Modes 3 and 4
 * use the even page and the next (24K). BRIGHT picks CLUT 8-15; FLASH swaps ink and paper every 16
 * frames. SOFF (border bit 7 in modes 3/4) shows black, fetches nothing and removes the screen's
 * contention.
 */

#define SAM_CELLS_PER_LINE 48u
#define SAM_CELLS_PER_FRAME (SAM_CELLS_PER_LINE * SAM_LINES_PER_FRAME)

/* The TV window (plan Q3): its first hc, the right border's width after the line, rows above the screen */
#define SAM_TV_FIRST_HC 96u
#define SAM_TV_RIGHT_HC 32u
#define SAM_TV_TOP_LINES 48u
#define SAM_TV_BOTTOM_LINES 48u

/* The CLUT: 16 entries of 7 bits (F8h write, entry in A11-A8) */
static uint8_t samClut[16];
/* The border register (FEh write): bits 2-0 + bit 5 the colour, 3 MIC, 4 BEEP, 6 THROM, 7 SOFF */
static uint8_t samBorder;
/* The 128 colours as RGBA */
static uint32_t samPalette[128];
/* FLASH: a 5-bit frame counter, the phase is bit 4 */
static uint8_t samFlashCounter;

/* The next cell's start, absolute tacts */
static uint32_t samNextCellTact;

/* The bytes fetched for the next screen cell, and the mode and HMPR they were fetched with */
static uint8_t samFetch[4];
static uint8_t samFetchValid;
static uint8_t samFetchMode;
static uint8_t samFetchHmpr;
/* The bytes the current cell shows */
static uint8_t samShown[4];
static uint8_t samShownValid;
static uint8_t samShownMode;
static uint8_t samShownHmpr;
/* ATTR (FFh read): the last attribute (modes 1/2) or third byte (modes 3/4) fetched */
static uint8_t samAttrLatch = 0xffu;
/* The last byte the ASIC fetched (unmapped ports read it inside the screen area, plan Q14) */
static uint8_t samFetchByte = 0xffu;
/* The CLUT index of the last pixel drawn (LPEN bit 0) */
static uint8_t samLastPixelIndex;
/* LPEN and HPEN as SOFF froze them (plan Q6) */
static uint8_t samFrozenLpen;
static uint8_t samFrozenHpen = 192u;

/* The video mode, 1-4 */
static inline uint8_t samVideoMode(void) { return (uint8_t)(((samVmpr >> 5) & 3u) + 1u); }

/* SOFF is effective: border bit 7 and a mode-3/4 screen */
static inline uint8_t samScreenOff(void) { return (samBorder & 0x80u) && (samVmpr & 0x40u) ? 1u : 0u; }

static inline uint8_t samBorderIndex(void) { return (uint8_t)(((samBorder & 0x20u) >> 2) | (samBorder & 0x07u)); }

static void samBuildPalette(void) {
  for (uint32_t c = 0u; c < 128u; c++) {
    const uint32_t bright = (c >> 3) & 1u;
    const uint32_t g = ((c >> 6) & 1u) * 4u + ((c >> 2) & 1u) * 2u + bright;
    const uint32_t r = ((c >> 5) & 1u) * 4u + ((c >> 1) & 1u) * 2u + bright;
    const uint32_t b = ((c >> 4) & 1u) * 4u + (c & 1u) * 2u + bright;
    samPalette[c] = 0xff000000u | ((b * 255u / 7u) << 16) | ((g * 255u / 7u) << 8) | (r * 255u / 7u);
  }
}

/* A screen byte: the fitted internal page's byte, FFh for a missing page */
static inline uint8_t samVideoRead(uint32_t page, uint32_t offset) {
  page = (page + (offset >> 14)) & 31u;
  if (page >= samRamPages) return 0xffu;
  return samMemory[SAM_PHYS_RAM + page * SAM_PAGE_SIZE + (offset & 0x3fffu)];
}

/* Fetches the bytes screen line `y`'s column `col` (0-31) shows */
static void samFetchCell(uint32_t y, uint32_t col) {
  const uint8_t mode = samVideoMode();
  const uint32_t page = samVmpr & 0x1fu;
  if (mode == 1u) {
    const uint32_t data = ((y & 0xc0u) << 5) | ((y & 0x07u) << 8) | ((y & 0x38u) << 2) | col;
    samFetch[0] = samVideoRead(page, data);
    samFetch[1] = samVideoRead(page, 0x1800u + (y >> 3) * 32u + col);
  } else if (mode == 2u) {
    samFetch[0] = samVideoRead(page, y * 32u + col);
    samFetch[1] = samVideoRead(page, 0x2000u + y * 32u + col);
  } else {
    const uint32_t offset = y * 128u + col * 4u;
    for (uint32_t i = 0u; i < 4u; i++) samFetch[i] = samVideoRead(page & 0x1eu, offset + i);
  }
  samAttrLatch = mode <= 2u ? samFetch[1] : samFetch[2];
  samFetchByte = mode <= 2u ? samFetch[1] : samFetch[3];
  samFetchMode = mode;
  samFetchHmpr = samHmpr;
  samFetchValid = 1u;
}

/* The 16 pixel-clock CLUT indexes of a screen cell */
static void samCellIndexes(uint8_t *out) {
  const uint8_t mode = samShownMode;
  if (mode <= 2u) {
    const uint8_t data = samShown[0];
    const uint8_t attr = samShown[1];
    const uint8_t bright = (attr & 0x40u) ? 8u : 0u;
    uint8_t ink = (uint8_t)(bright | (attr & 7u));
    uint8_t paper = (uint8_t)(bright | ((attr >> 3) & 7u));
    if ((attr & 0x80u) && (samFlashCounter & 0x10u)) {
      const uint8_t t = ink;
      ink = paper;
      paper = t;
    }
    for (uint32_t i = 0u; i < 8u; i++) {
      const uint8_t idx = (data & (0x80u >> i)) ? ink : paper;
      out[i * 2u] = idx;
      out[i * 2u + 1u] = idx;
    }
  } else if (mode == 3u) {
    const uint8_t base = (uint8_t)((samShownHmpr & 0x60u) >> 3);
    static const uint8_t swap[4] = {0u, 2u, 1u, 3u};
    for (uint32_t b = 0u; b < 4u; b++) {
      for (uint32_t p = 0u; p < 4u; p++) {
        out[b * 4u + p] = (uint8_t)(base | swap[(samShown[b] >> (6u - p * 2u)) & 3u]);
      }
    }
  } else {
    for (uint32_t b = 0u; b < 4u; b++) {
      const uint8_t hi = (uint8_t)(samShown[b] >> 4);
      const uint8_t lo = (uint8_t)(samShown[b] & 0x0fu);
      out[b * 4u] = hi;
      out[b * 4u + 1u] = hi;
      out[b * 4u + 2u] = lo;
      out[b * 4u + 3u] = lo;
    }
  }
}

/* The display row of TV line `vc`, or -1 outside the window */
static inline int32_t samTvRow(uint32_t vc) {
  if (vc >= SAM_LINES_PER_FRAME - SAM_TV_TOP_LINES) return (int32_t)(vc - (SAM_LINES_PER_FRAME - SAM_TV_TOP_LINES));
  if (vc < 192u + SAM_TV_BOTTOM_LINES) return (int32_t)(SAM_TV_TOP_LINES + vc);
  return -1;
}

/* Draws the cell at frame line `line`, hc `hc` */
static void samDrawCell(uint32_t line, uint32_t hc) {
  uint32_t vc = (line + SAM_INT_LINE) % SAM_LINES_PER_FRAME;
  uint32_t x;
  if (hc >= SAM_TV_FIRST_HC) {
    x = (hc - SAM_TV_FIRST_HC) * 2u;
  } else if (hc < SAM_TV_RIGHT_HC) {
    // --- The right border after the previous line
    vc = (vc + SAM_LINES_PER_FRAME - 1u) % SAM_LINES_PER_FRAME;
    x = (SAM_LINE_TACTS - SAM_TV_FIRST_HC + hc) * 2u;
  } else {
    return;
  }
  const int32_t row = samTvRow(vc);
  if (row < 0) return;
  uint32_t *out = &samPixelBuffer[(uint32_t)row * SAM_SCREEN_WIDTH + x];
  if (samScreenOff()) {
    for (uint32_t i = 0u; i < 16u; i++) out[i] = 0xff000000u;
    return;
  }
  const uint8_t screen = vc < 192u && hc >= 128u && samShownValid;
  if (!screen) {
    const uint8_t idx = samBorderIndex();
    const uint32_t colour = samPalette[samClut[idx] & 0x7fu];
    for (uint32_t i = 0u; i < 16u; i++) out[i] = colour;
    samLastPixelIndex = idx;
    return;
  }
  uint8_t idx[16];
  samCellIndexes(idx);
  for (uint32_t i = 0u; i < 16u; i++) out[i] = samPalette[samClut[idx[i]] & 0x7fu];
  samLastPixelIndex = idx[15];
}

/* Defined in sam.c, sam-audio.c, sam-mouse.c */
static void samFrameEnds(void);
static void samAudioCatchUp(void);

/* One cell, the one starting at `samNextCellTact` */
static void samCellStep(void) {
  uint32_t cell = (samNextCellTact - samFrameStart) >> 3;
  if (cell >= SAM_CELLS_PER_FRAME) {
    samFrameEnds();
    cell -= SAM_CELLS_PER_FRAME;
  }
  const uint32_t line = cell / SAM_CELLS_PER_LINE;
  const uint32_t hc = (cell % SAM_CELLS_PER_LINE) * 8u;
  const uint32_t vc = (line + SAM_INT_LINE) % SAM_LINES_PER_FRAME;
  const uint8_t off = samScreenOff();
  // --- The contention region from this cell on (sam-timing.c)
  samContentionMode = off ? SAM_CONT_BORDER : (samVmpr & 0x60u) == 0u ? SAM_CONT_MODE1 : SAM_CONT_MODE234;
  // --- What this cell shows: the bytes fetched in the cell before
  samShownValid = samFetchValid;
  if (samFetchValid) {
    for (uint32_t i = 0u; i < 4u; i++) samShown[i] = samFetch[i];
    samShownMode = samFetchMode;
    samShownHmpr = samFetchHmpr;
  }
  samFetchValid = 0u;
  samDrawCell(line, hc);
  // --- The fetch for the next cell (screen columns are shown at hc 128-383)
  if (vc < 192u && hc >= 120u && hc < SAM_LINE_TACTS - 8u && !off) {
    samFetchCell(vc, (hc + 8u - 128u) >> 3);
  }
  // --- The pens freeze while SOFF is effective
  if (!off) {
    samFrozenHpen = vc < 192u ? (uint8_t)vc : 192u;
  }
  samAudioCatchUp();
}

/* LPEN (F8h read): the beam's position in the screen area, the CLUT bit 0 under it, TXFMST */
static uint8_t samReadLpen(void) {
  const uint8_t tx = samMidiTransmitting() ? 0x02u : 0u;
  if (samScreenOff()) return (uint8_t)((samFrozenLpen & 0xfcu) | (samFrozenLpen & 0x01u) | tx);
  const uint32_t ft = samFrameTact();
  const uint32_t line = ft / SAM_LINE_TACTS;
  const uint32_t hc = ft % SAM_LINE_TACTS;
  const uint32_t vc = (line + SAM_INT_LINE) % SAM_LINES_PER_FRAME;
  uint8_t value;
  if (vc < 192u && hc >= 128u) {
    value = (uint8_t)(((hc - 128u) & 0xfcu) | (samLastPixelIndex & 1u));
  } else {
    value = (uint8_t)(samBorder & 0x01u);
  }
  samFrozenLpen = value;
  return (uint8_t)(value | tx);
}

/* HPEN (1F8h read): the screen line, 192 outside the screen */
static uint8_t samReadHpen(void) {
  if (samScreenOff()) return samFrozenHpen;
  const uint32_t ft = samFrameTact();
  const uint32_t vc = (ft / SAM_LINE_TACTS + SAM_INT_LINE) % SAM_LINES_PER_FRAME;
  const uint32_t hc = ft % SAM_LINE_TACTS;
  (void)hc;
  return vc < 192u ? (uint8_t)vc : 192u;
}

/* Whether the beam is in the screen area (unmapped ports read the fetch byte there, plan Q14) */
static inline uint8_t samBeamInScreen(void) {
  const uint32_t ft = samFrameTact();
  const uint32_t vc = (ft / SAM_LINE_TACTS + SAM_INT_LINE) % SAM_LINES_PER_FRAME;
  return vc < 192u && (ft % SAM_LINE_TACTS) >= 128u && !samScreenOff() ? 1u : 0u;
}

static void samVideoReset(void) {
  samBorder = 0u;
  samFetchValid = 0u;
  samShownValid = 0u;
  samAttrLatch = 0xffu;
  samFetchByte = 0xffu;
  samContentionMode = SAM_CONT_MODE1;
}

/* Power on: the CLUT from a fixed seed (it is not reset by the reset button, and random on a real machine) */
static void samVideoPowerOn(void) {
  uint32_t seed = 0x5a3c96e1u;
  for (uint32_t i = 0u; i < 16u; i++) {
    seed ^= seed << 13;
    seed ^= seed >> 17;
    seed ^= seed << 5;
    samClut[i] = (uint8_t)(seed & 0x7fu);
  }
  samFlashCounter = 0u;
  samFrozenLpen = 0u;
  samFrozenHpen = 192u;
  for (uint32_t i = 0u; i < SAM_SCREEN_WIDTH * SAM_SCREEN_HEIGHT; i++) samPixelBuffer[i] = 0xff000000u;
}

uint32_t samGetClut(uint32_t index) { return samClut[index & 15u]; }
uint32_t samGetBorder(void) { return samBorder; }
uint32_t samGetPaletteRgb(uint32_t colour) { return samPalette[colour & 0x7fu]; }
uint32_t samGetFlashCounter(void) { return samFlashCounter; }
uint32_t samGetAttrLatch(void) { return samAttrLatch; }
uint32_t samGetScreenOff(void) { return samScreenOff(); }
/* The beam: bits 0-15 hc (T), bits 16-31 vc */
uint32_t samGetBeam(void) {
  const uint32_t ft = samFrameTact();
  return (ft % SAM_LINE_TACTS) | (((ft / SAM_LINE_TACTS + SAM_INT_LINE) % SAM_LINES_PER_FRAME) << 16);
}
