// ----------------------------------------------------------------------------
// ULA timing, display rendering, contention, and floating bus

static const uint32_t sp48SpectrumColors[16] = {
  0xff000000u,
  0xffaa0000u,
  0xff0000aau,
  0xffaa00aau,
  0xff00aa00u,
  0xffaaaa00u,
  0xff00aaaau,
  0xffaaaaaau,
  0xff000000u,
  0xffff0000u,
  0xff0000ffu,
  0xffff00ffu,
  0xff00ff00u,
  0xffffff00u,
  0xff00ffffu,
  0xffffffffu
};

static const Sp48ScreenConfig sp48PalConfig = {
  8u, 7u, 49u, 48u, 8u, 192u, 24u, 24u, 128u, 40u, 8u, 2u, 1u, {6u, 5u, 4u, 3u, 2u, 1u, 0u, 0u}, 4u
};

static const Sp48ScreenConfig sp48NtscConfig = {
  8u, 15u, 25u, 24u, 0u, 192u, 24u, 24u, 128u, 40u, 8u, 2u, 1u, {6u, 5u, 4u, 3u, 2u, 1u, 0u, 0u}, 4u
};

/*
 * Buffer pixels per Spectrum pixel. The Timex core (`zx-spectrum-scld.c`) draws two, so its 512-wide
 * mode fits without a size change mid-frame (`.plans/TIMEX_SCORPION_PLAN.md` P4); the timing tables
 * stay in Spectrum pixels and the renderer scales their indexes.
 */
#ifndef SP48_PIXEL_SCALE
#define SP48_PIXEL_SCALE 1u
#endif

/*
 * The ULA's memory reads and the CPU (`.plans/SPECTRUM_ULA_ACCURACY_PLAN.md` Phases 1, 2, 4, 5).
 *
 * The timing tables fetch each screen byte `ulaFetchDelay` T-states before the real ULA reads it
 * (the screen config's `ulaFetchDelay`): on the 48K the bitmap of $4000 is fetched at 14,334, the
 * hardware reads it at 14,338, three T-states into the contention window that opens at 14,335. The
 * floating bus was calibrated on real machines (FloatSpy, Float48K) with exactly that offset, so the
 * tables stay as they are and the CPU's writes, the border and snow are taken against the real
 * reads by subtracting the delay. With a delay of 0 a machine keeps the old behaviour.
 */
static uint8_t ulaFetchDelay;
/* Late ("alternate") ULA timing: every table one T-state later against the interrupt */
static uint8_t ulaLateTiming;
/* How many T-states the tables are rotated later for late timing (the beam overlay's field 8) */
static uint32_t ulaRasterShift;
/* The config the tables were last built from, so late timing can rebuild them */
static const Sp48ScreenConfig *ulaTimingConfig;
/* The bitmap byte the last first-cell fetch read, before the renderer shifted it out (snow) */
static uint8_t ulaPixelByte1Latch;
/* Snow (Phase 5): on unless switched off; the table tact and low address of the last snowy fetch */
static uint8_t ulaSnowEnabled = 1u;
static uint32_t ulaSnowTact = 0xffffffffu;
static uint8_t ulaSnowLow;

static inline uint32_t ulaMachineTact(void);
static void renderUlaUntilFrameTact(uint32_t lastTact);

static inline uint32_t currentScreenWidth(void) {
  return sp48TimingScreenWidth == 0u ? SP48_SCREEN_BUFFER_WIDTH_MAX : sp48TimingScreenWidth * SP48_PIXEL_SCALE;
}

static inline uint32_t currentScreenHeight(void) {
  return sp48TimingScreenLines == 0u ? SP48_SCREEN_BUFFER_LINES_MAX : sp48TimingScreenLines;
}

static inline uint32_t pixelBufferWordCount(void) {
  return currentScreenWidth() * (currentScreenHeight() + SP48_PIXEL_BUFFER_GUARD_LINES);
}

static inline uint32_t pixelBufferStartOffset(void) {
  return currentScreenWidth();
}

static inline uint32_t getBorderPixel(uint8_t color) {
  return sp48SpectrumColors[color & 0x07u];
}

static inline uint8_t flashFlag(void) {
  return ((sp48Frames / 16u) & 0x01u) == 0u ? 1u : 0u;
}

static void initializeAttrColorTables(void) {
  if (sp48AttrColorsInitialized != 0u) {
    return;
  }

  for (uint32_t flash = 0u; flash < 2u; flash++) {
    for (uint32_t attr = 0u; attr < 256u; attr++) {
      const uint8_t bright = (uint8_t)((attr & 0x40u) >> 3u);
      uint8_t ink = (uint8_t)((attr & 0x07u) | bright);
      uint8_t paper = (uint8_t)(((attr >> 3u) & 0x07u) | bright);
      if ((attr & 0x80u) != 0u && flash != 0u) {
        const uint8_t temp = ink;
        ink = paper;
        paper = temp;
      }
      sp48AttrColors[flash][attr][0] = sp48SpectrumColors[paper];
      sp48AttrColors[flash][attr][1] = sp48SpectrumColors[ink];
    }
  }
  sp48AttrColorsInitialized = 1u;
}

static inline uint32_t getUlaPixelColor(uint8_t pixelSet, uint8_t attr) {
  return sp48AttrColors[flashFlag()][attr][pixelSet != 0u ? 1u : 0u];
}

static inline uint32_t currentFrameTact(void) {
  if (sp48TactsInFrame == 0u) {
    return 0u;
  }

  const uint32_t elapsedTacts =
    sp48Tacts >= sp48NextFrameStartTact ? sp48Tacts - sp48NextFrameStartTact : 0u;
  const uint32_t multiplier = sp48ClockMultiplier == 0u ? 1u : sp48ClockMultiplier;
  uint32_t tact = multiplier == 1u ? elapsedTacts : elapsedTacts / multiplier;
  if (tact >= sp48TactsInFrame) {
    tact = sp48TactsInFrame - 1u;
  }
  return tact;
}

static inline uint16_t calcPixelAddress(uint32_t line, uint32_t tactInLine) {
  const uint32_t row = line - sp48FirstDisplayLine;
  return (uint16_t)(((row & 0xc0u) << 5u) + ((row & 0x07u) << 8u) + ((row & 0x38u) << 2u) + (tactInLine >> 2u));
}

static inline uint16_t calcAttrAddress(uint32_t line, uint32_t tactInLine) {
  return (uint16_t)((tactInLine >> 2u) + (((line - sp48FirstDisplayLine) >> 3u) << 5u) + 0x1800u);
}

static inline uint32_t calculateTimingBufferIndex(uint32_t line, uint32_t tactInLine) {
  if (tactInLine >= sp48FirstVisibleBorderTact) {
    line++;
    tactInLine -= sp48FirstVisibleBorderTact;
  } else {
    tactInLine += 24u;
  }

  return line >= sp48FirstVisibleLine
    ? 2u * ((((line - sp48FirstVisibleLine) * sp48TimingScreenWidth) / 2u) + tactInLine)
    : 0u;
}

static void clearTimingTables(void) {
  for (uint32_t i = 0u; i < SP48_TACTS_PER_FRAME_MAX; i++) {
    sp48Contention[i] = 0u;
    sp48RenderingPhase[i] = SP48_RENDER_PHASE_NONE;
    sp48RenderingPixelAddress[i] = 0u;
    sp48RenderingAttributeAddress[i] = 0u;
    sp48RenderingPixelIndex[i] = 0u;
  }
}

static void setRenderingTact(
  uint32_t tact,
  uint8_t phase,
  uint16_t pixelAddress,
  uint16_t attributeAddress,
  uint8_t contention
) {
  sp48RenderingPhase[tact] = phase;
  sp48RenderingPixelAddress[tact] = pixelAddress;
  sp48RenderingAttributeAddress[tact] = attributeAddress;
  sp48Contention[tact] = contention;
}

/*
 * The SCLD's extended-colour and 512-wide modes fetch, at an attribute tact, the second display
 * file's byte of the *pixel* address of that column, so the Timex core records it there too. The
 * other cores leave attribute tacts without a pixel address, as they always had.
 */
#ifdef SP48_SCLD
#define SP48_ATTR_FETCH_PIXEL_ADDRESS(address) (pixelAddress = (address))
#else
#define SP48_ATTR_FETCH_PIXEL_ADDRESS(address) ((void)0)
#endif

static void ulaRotateTimingTables(uint32_t by);

static void initializeTimingTables(const Sp48ScreenConfig *config) {
  initializeAttrColorTables();
  clearTimingTables();
  ulaTimingConfig = config;
  ulaFetchDelay = config->ulaFetchDelay;
  ulaRasterShift = 0u;
  ulaSnowTact = 0xffffffffu;

  sp48FirstDisplayLine =
    config->verticalSyncLines + config->nonVisibleBorderTopLines + config->borderTopLines;
  const uint32_t lastDisplayLine = sp48FirstDisplayLine + config->displayLines - 1u;
  sp48RasterLines =
    sp48FirstDisplayLine + config->displayLines + config->borderBottomLines + config->nonVisibleBorderBottomLines;
  sp48TimingScreenLines = config->borderTopLines + config->displayLines + config->borderBottomLines - 1u;
  sp48TimingScreenWidth = 2u * (config->borderLeftTime + config->displayLineTime + config->borderRightTime);
  sp48DisplayLeftPixel = 2u * config->borderLeftTime;
  sp48ScreenLineTime =
    config->borderLeftTime + config->displayLineTime + config->borderRightTime +
    config->nonVisibleBorderRightTime + config->horizontalBlankingTime;
  sp48TactsInFrame = sp48RasterLines * sp48ScreenLineTime;
  sp48FirstVisibleLine = config->verticalSyncLines + config->nonVisibleBorderTopLines;
  sp48DisplayTopLine = sp48FirstDisplayLine - sp48FirstVisibleLine;
  const uint32_t lastVisibleLine = sp48RasterLines - config->nonVisibleBorderBottomLines;
  sp48FirstVisibleBorderTact = sp48ScreenLineTime - config->borderLeftTime;
  const uint32_t lastVisibleLineTact = config->displayLineTime + config->borderRightTime;
  const uint32_t borderPixelFetchTact = sp48ScreenLineTime - config->pixelDataPrefetchTime;
  const uint32_t borderAttrFetchTact = sp48ScreenLineTime - config->attributeDataPrefetchTime;

  for (uint32_t tact = 0u; tact < sp48TactsInFrame; tact++) {
    const uint32_t line = tact / sp48ScreenLineTime;
    const uint32_t tactInLine = tact % sp48ScreenLineTime;
    uint8_t phase = SP48_RENDER_PHASE_NONE;
    uint16_t pixelAddress = 0u;
    uint16_t attributeAddress = 0u;
    uint8_t contention = 0u;

    /*
     * A visible row's left border is drawn at the *end* of the raster line before it
     * (`calculateTimingBufferIndex` maps a line's tail to the next row). So row 0's left border is
     * the tail of the line before the first visible one. It was left out, and those pixels were
     * never redrawn: they kept whatever the boot drew there - on every Spectrum core, a grey
     * (non-bright white) segment at the top left once a program changed the border.
     */
    const uint8_t firstRowLeftBorder =
      sp48FirstVisibleLine > 0u &&
      line == sp48FirstVisibleLine - 1u &&
      tactInLine >= sp48FirstVisibleBorderTact;
    if (
      firstRowLeftBorder ||
      (line >= sp48FirstVisibleLine &&
       line <= lastVisibleLine &&
       (tactInLine < lastVisibleLineTact || tactInLine >= sp48FirstVisibleBorderTact))
    ) {
      uint8_t calculated = 0u;
      if (line == sp48FirstDisplayLine - 1u) {
        if (tactInLine == borderPixelFetchTact - 1u) {
          phase = SP48_RENDER_PHASE_BORDER;
          contention = config->contentionValues[6];
          calculated = 1u;
        } else if (tactInLine == borderPixelFetchTact) {
          phase = SP48_RENDER_PHASE_BORDER_FETCH_PIXEL;
          pixelAddress = calcPixelAddress(line + 1u, 0u);
          contention = config->contentionValues[7];
          calculated = 1u;
        } else if (tactInLine == borderAttrFetchTact) {
          phase = SP48_RENDER_PHASE_BORDER_FETCH_ATTR;
          attributeAddress = calcAttrAddress(line + 1u, 0u);
          SP48_ATTR_FETCH_PIXEL_ADDRESS(calcPixelAddress(line + 1u, 0u));
          contention = config->contentionValues[0];
          calculated = 1u;
        }
      }

      if (calculated == 0u) {
        if (
          line >= sp48FirstDisplayLine &&
          line <= lastDisplayLine &&
          tactInLine < config->displayLineTime
        ) {
          const uint32_t pixelTact = tactInLine & 0x07u;
          switch (pixelTact) {
            case 0u:
              phase = SP48_RENDER_PHASE_DISPLAY_B1_FETCH_B2;
              pixelAddress = calcPixelAddress(line, tactInLine + 4u);
              contention = config->contentionValues[1];
              break;
            case 1u:
              phase = SP48_RENDER_PHASE_DISPLAY_B1_FETCH_A2;
              attributeAddress = calcAttrAddress(line, tactInLine + 3u);
              SP48_ATTR_FETCH_PIXEL_ADDRESS(calcPixelAddress(line, tactInLine + 3u));
              contention = config->contentionValues[2];
              break;
            case 2u:
              phase = SP48_RENDER_PHASE_DISPLAY_B1;
              contention = config->contentionValues[3];
              break;
            case 3u:
              phase = SP48_RENDER_PHASE_DISPLAY_B1;
              contention = config->contentionValues[4];
              break;
            case 4u:
              phase = SP48_RENDER_PHASE_DISPLAY_B2;
              contention = config->contentionValues[5];
              break;
            case 5u:
              phase = SP48_RENDER_PHASE_DISPLAY_B2;
              contention = config->contentionValues[6];
              break;
            case 6u:
              phase = SP48_RENDER_PHASE_DISPLAY_B2;
              if (tactInLine < config->displayLineTime - config->pixelDataPrefetchTime) {
                phase = SP48_RENDER_PHASE_DISPLAY_B2_FETCH_B1;
                pixelAddress = calcPixelAddress(line, tactInLine + config->pixelDataPrefetchTime);
                contention = config->contentionValues[7];
              }
              break;
            case 7u:
              phase = SP48_RENDER_PHASE_DISPLAY_B2;
              if (tactInLine < config->displayLineTime - config->attributeDataPrefetchTime) {
                phase = SP48_RENDER_PHASE_DISPLAY_B2_FETCH_A1;
                attributeAddress = calcAttrAddress(line, tactInLine + config->attributeDataPrefetchTime);
                SP48_ATTR_FETCH_PIXEL_ADDRESS(
                  calcPixelAddress(line, tactInLine + config->attributeDataPrefetchTime));
                contention = config->contentionValues[0];
              }
              break;
          }
        } else {
          phase = SP48_RENDER_PHASE_BORDER;
          if (line >= sp48FirstDisplayLine && line < lastDisplayLine) {
            if (tactInLine == borderPixelFetchTact) {
              phase = SP48_RENDER_PHASE_BORDER_FETCH_PIXEL;
              pixelAddress = calcPixelAddress(line + 1u, 0u);
              contention = config->contentionValues[7];
            } else if (tactInLine == borderAttrFetchTact) {
              phase = SP48_RENDER_PHASE_BORDER_FETCH_ATTR;
              attributeAddress = calcAttrAddress(line + 1u, 0u);
              SP48_ATTR_FETCH_PIXEL_ADDRESS(calcPixelAddress(line + 1u, 0u));
              contention = config->contentionValues[0];
            }
          }
        }
      }
    }

    if (phase != SP48_RENDER_PHASE_NONE) {
      sp48RenderingPixelIndex[tact] = calculateTimingBufferIndex(line, tactInLine);
      setRenderingTact(tact, phase, pixelAddress, attributeAddress, contention);
    }
  }

  /*
   * The ULA machines' contention, written group by group (Phase 2): the pattern 6,5,4,3,2,1,0,0
   * sixteen times per display line, each group starting where the config's values put its 6 - one
   * T-state before its cell on the 48K (14,335, WoS 48K FAQ), three on the 128K (14,361, WoS 128K
   * FAQ). Taking the values from the rendering phases above left the 128K, whose pattern starts in
   * the previous group, without the 6 before every line's first group but the top one and with a
   * stray 6 after its last group: ZX Spectrum Timing Tests 128K failed its contended tests.
   */
  if (config->ulaFetchDelay != 0u) {
    uint32_t peak = 0u;
    for (uint32_t i = 1u; i < 8u; i++) {
      if (config->contentionValues[i] > config->contentionValues[peak]) peak = i;
    }
    /* The phase (tact in the 8-tact cell) whose value is the peak, and how far before the cell it is */
    const uint32_t lead = (8u - ((peak + 7u) & 0x07u)) & 0x07u;
    for (uint32_t tact = 0u; tact < sp48TactsInFrame; tact++) sp48Contention[tact] = 0u;
    for (uint32_t line = sp48FirstDisplayLine; line <= lastDisplayLine; line++) {
      for (uint32_t cell = 0u; cell < config->displayLineTime; cell += 8u) {
        const uint32_t start = line * sp48ScreenLineTime + cell - lead;
        for (uint32_t i = 0u; i < 8u; i++) {
          sp48Contention[start + i] = config->contentionValues[(peak + i) & 0x07u];
        }
      }
    }
  }

  /*
   * Late timing (Phase 4): "one cycle later than normal timings" (the SZX specification's
   * ZXSTMF_ALTERNATETIMINGS; the WoS FAQ and the Sinclair Wiki say the same), so contention, the
   * reads, the border and the floating bus all move together. Only the ULA machines have it: the
   * ones with a fetch delay.
   */
  if (ulaLateTiming != 0u && config->ulaFetchDelay != 0u) {
    ulaRotateTimingTables(1u);
    ulaRasterShift = 1u;
  }
}

static void ulaReverseTables(uint32_t lo, uint32_t hi) {
  for (; lo < hi; lo++, hi--) {
    uint8_t b = sp48Contention[lo]; sp48Contention[lo] = sp48Contention[hi]; sp48Contention[hi] = b;
    b = sp48RenderingPhase[lo]; sp48RenderingPhase[lo] = sp48RenderingPhase[hi]; sp48RenderingPhase[hi] = b;
    uint16_t w = sp48RenderingPixelAddress[lo];
    sp48RenderingPixelAddress[lo] = sp48RenderingPixelAddress[hi];
    sp48RenderingPixelAddress[hi] = w;
    w = sp48RenderingAttributeAddress[lo];
    sp48RenderingAttributeAddress[lo] = sp48RenderingAttributeAddress[hi];
    sp48RenderingAttributeAddress[hi] = w;
    const uint32_t d = sp48RenderingPixelIndex[lo];
    sp48RenderingPixelIndex[lo] = sp48RenderingPixelIndex[hi];
    sp48RenderingPixelIndex[hi] = d;
  }
}

/* Moves every table entry `by` tacts later in the frame, the last ones wrapping to its start */
static void ulaRotateTimingTables(uint32_t by) {
  const uint32_t n = sp48TactsInFrame;
  if (by == 0u || by >= n) return;
  ulaReverseTables(0u, n - 1u);
  ulaReverseTables(0u, by - 1u);
  ulaReverseTables(by, n - 1u);
}

/* Switches late timing on or off and rebuilds the tables (the 128K core rebuilds its own way) */
static void ulaSetLateTiming(uint32_t late) {
  ulaLateTiming = late != 0u ? 1u : 0u;
}

static inline void applyContentionDelay(void) {
  const uint32_t delay = sp48Contention[currentFrameTact()];
  sp48Tacts += delay;
  sp48TotalContentionDelaySinceStart += delay;
  sp48ContentionDelaySincePause += delay;
  setNextAudioSample();
}

static inline uint8_t isContendedIoAddress(uint32_t address) {
  return (address & 0xc000u) == 0x4000u;
}

static inline uint8_t shouldRaiseInterrupt(void) {
#ifdef SP48_SCLD
  /* Port $FF bit 6 inhibits the SCLD's frame interrupt (TS2068 Technical Manual 2.1.8.4) */
  if ((sp48ScldPortFf & 0x40u) != 0u) return 0u;
#endif
  return currentFrameTact() < 32u ? 1u : 0u;
}

static void beginBorderFrame(uint32_t frameStartTact) {
  sp48BorderFrameStartTact = frameStartTact;
  sp48LastRenderedFrameTact = 0u;
  ulaSnowTact = 0xffffffffu;
  sp48PixelByte1 = 0u;
  sp48PixelByte2 = 0u;
  sp48AttrByte1 = 0u;
  sp48AttrByte2 = 0u;
}

#ifdef SP48_SCLD
/* The Timex SCLD's screen modes draw the picture (`.plans/TIMEX_SCORPION_PLAN.md` G9.4a) */
#include "zx-spectrum-scld.c"
#define SP48_FILL_BORDER_PIXEL() scldBorderPixel()
/* The Timex's SCLD keeps the old border and snow behaviour (its delay is 0) */
static inline void ulaRepaintBorderForChange(void) {}
static inline void ulaSnowRefresh(uint8_t r) { (void)r; }
#define SP48_FLOATING_PIXEL(tact) scldFetchPixel(tact)
#define SP48_FLOATING_ATTR(tact) scldFetchAttr(tact)
#else
static inline void renderBorderPixelsAt(uint32_t index) {
  if (index + 1u >= pixelBufferWordCount()) {
    return;
  }
  const uint32_t pixel = getBorderPixel(sp48BorderColor);
  sp48PixelBuffer[index] = pixel;
  sp48PixelBuffer[index + 1u] = pixel;
}

static inline void renderByte1PixelsAt(uint32_t index) {
  if (index + 1u >= pixelBufferWordCount()) {
    return;
  }
  const uint32_t (*attrColors)[2] = sp48AttrColors[flashFlag()];
  sp48PixelBuffer[index] = attrColors[sp48AttrByte1][(sp48PixelByte1 & 0x80u) != 0u ? 1u : 0u];
  sp48PixelBuffer[index + 1u] = attrColors[sp48AttrByte1][(sp48PixelByte1 & 0x40u) != 0u ? 1u : 0u];
  sp48PixelByte1 = (uint8_t)(sp48PixelByte1 << 2u);
}

static inline void renderByte2PixelsAt(uint32_t index) {
  if (index + 1u >= pixelBufferWordCount()) {
    return;
  }
  const uint32_t (*attrColors)[2] = sp48AttrColors[flashFlag()];
  sp48PixelBuffer[index] = attrColors[sp48AttrByte2][(sp48PixelByte2 & 0x80u) != 0u ? 1u : 0u];
  sp48PixelBuffer[index + 1u] = attrColors[sp48AttrByte2][(sp48PixelByte2 & 0x40u) != 0u ? 1u : 0u];
  sp48PixelByte2 = (uint8_t)(sp48PixelByte2 << 2u);
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
      sp48PixelByte1 = ulaPixelByte1Latch = readScreenMemoryOffset(sp48RenderingPixelAddress[tact]);
      break;

    case SP48_RENDER_PHASE_BORDER_FETCH_ATTR:
      renderBorderPixelsAt(index);
      sp48AttrByte1 = readScreenMemoryOffset(sp48RenderingAttributeAddress[tact]);
      break;

    case SP48_RENDER_PHASE_DISPLAY_B1:
      renderByte1PixelsAt(index);
      break;

    case SP48_RENDER_PHASE_DISPLAY_B1_FETCH_B2:
      renderByte1PixelsAt(index);
      sp48PixelByte2 = readScreenMemoryOffset(sp48RenderingPixelAddress[tact]);
      break;

    case SP48_RENDER_PHASE_DISPLAY_B1_FETCH_A2:
      renderByte1PixelsAt(index);
      sp48AttrByte2 = readScreenMemoryOffset(sp48RenderingAttributeAddress[tact]);
      break;

    case SP48_RENDER_PHASE_DISPLAY_B2:
      renderByte2PixelsAt(index);
      break;

    case SP48_RENDER_PHASE_DISPLAY_B2_FETCH_B1:
      renderByte2PixelsAt(index);
      sp48PixelByte1 = ulaPixelByte1Latch = readScreenMemoryOffset(sp48RenderingPixelAddress[tact]);
      break;

    case SP48_RENDER_PHASE_DISPLAY_B2_FETCH_A1:
      renderByte2PixelsAt(index);
      sp48AttrByte1 = readScreenMemoryOffset(sp48RenderingAttributeAddress[tact]);
      break;
  }
}

/*
 * Snow (Phase 5; the ZXE wiki's "Snow effect" page). The CPU's refresh puts I and R on the address
 * bus with MREQ; with I in contended memory the ULA takes it for an access it cannot stop. The ULA
 * reads its four bytes in two bursts, the first cell's bitmap and attribute, then the second cell's.
 * When the refresh's second T-state (the M1's fourth) falls on the first burst, both of its reads
 * get R's low seven bits (R already incremented) as their low address bits ("snow"); when it falls
 * on the second burst, the second cell is not read and shows the first cell's bytes again (the
 * "double" effect). `r` is R as the refresh put it on the bus.
 */
static void ulaSnowFetch(uint32_t tact, uint8_t mode, uint8_t low) {
  const uint32_t index = sp48RenderingPixelIndex[tact];
  switch (sp48RenderingPhase[tact]) {
    case SP48_RENDER_PHASE_BORDER_FETCH_PIXEL:
      renderBorderPixelsAt(index);
      sp48PixelByte1 = ulaPixelByte1Latch =
        readScreenMemoryOffset((sp48RenderingPixelAddress[tact] & ~0x7fu) | low);
      break;
    case SP48_RENDER_PHASE_BORDER_FETCH_ATTR:
      renderBorderPixelsAt(index);
      sp48AttrByte1 = readScreenMemoryOffset((sp48RenderingAttributeAddress[tact] & ~0x7fu) | low);
      break;
    case SP48_RENDER_PHASE_DISPLAY_B2_FETCH_B1:
      renderByte2PixelsAt(index);
      sp48PixelByte1 = ulaPixelByte1Latch =
        readScreenMemoryOffset((sp48RenderingPixelAddress[tact] & ~0x7fu) | low);
      break;
    case SP48_RENDER_PHASE_DISPLAY_B2_FETCH_A1:
      renderByte2PixelsAt(index);
      sp48AttrByte1 = readScreenMemoryOffset((sp48RenderingAttributeAddress[tact] & ~0x7fu) | low);
      break;
    case SP48_RENDER_PHASE_DISPLAY_B1_FETCH_B2:
      renderByte1PixelsAt(index);
      if (mode == 2u) sp48PixelByte2 = ulaPixelByte1Latch;
      else sp48PixelByte2 = readScreenMemoryOffset(sp48RenderingPixelAddress[tact]);
      break;
    case SP48_RENDER_PHASE_DISPLAY_B1_FETCH_A2:
      renderByte1PixelsAt(index);
      if (mode == 2u) sp48AttrByte2 = sp48AttrByte1;
      else sp48AttrByte2 = readScreenMemoryOffset(sp48RenderingAttributeAddress[tact]);
      break;
    default:
      renderUlaTact(tact);
      break;
  }
}

static void ulaSnowRefresh(uint8_t r) {
  if (ulaFetchDelay == 0u) return;
  const uint32_t machineTact = ulaMachineTact();
  if (machineTact < ulaFetchDelay) return;
  const uint32_t tact = machineTact - ulaFetchDelay;
  if (tact + 1u >= sp48TactsInFrame || sp48LastRenderedFrameTact > tact) return;
  const uint8_t phase = sp48RenderingPhase[tact];
  uint8_t mode;
  if (phase == SP48_RENDER_PHASE_BORDER_FETCH_PIXEL || phase == SP48_RENDER_PHASE_DISPLAY_B2_FETCH_B1) {
    mode = 1u;
  } else if (phase == SP48_RENDER_PHASE_DISPLAY_B1_FETCH_B2) {
    mode = 2u;
  } else {
    return;
  }
  const uint8_t low = (uint8_t)((r + 1u) & 0x7fu);
  if (tact > 0u) renderUlaUntilFrameTact(tact - 1u);
  /* Rendering one tact past the beam is safe: no write or OUT can land before the next M1 ends */
  ulaSnowFetch(tact, mode, low);
  ulaSnowFetch(tact + 1u, mode, low);
  sp48LastRenderedFrameTact = tact + 2u;
  if (mode == 1u) {
    ulaSnowTact = tact;
    ulaSnowLow = low;
  }
}

/*
 * An OUT that changes the border colour, at the end of its I/O cycle (now). The ULA takes the border
 * colour once per 8 pixels (4 T-states), and an OUT ending in a 4 T-state window lands on one chunk:
 * on the 48K the chunk at $4000's position for an OUT ending at 14,339-14,342 (WoS 48K FAQ), on the
 * 128K at 14,365-14,368 (WoS 128K FAQ). In table tacts that chunk starts `delay - 1` T-states or more
 * before the OUT's end, so it has been drawn in the old colour already: draw its border again.
 */
static void ulaRepaintBorderForChange(void) {
  if (ulaFetchDelay == 0u) return;
  const uint32_t machineTact = ulaMachineTact();
  /* Chunks start where the paper's 8-pixel cells do: a multiple of 4, plus late timing's shift */
  const uint32_t back = (uint32_t)ulaFetchDelay - 1u + ulaRasterShift;
  const uint32_t from = machineTact >= back ? ((machineTact - back) & ~3u) + ulaRasterShift : 0u;
  for (uint32_t tact = from; tact < sp48LastRenderedFrameTact; tact++) {
    switch (sp48RenderingPhase[tact]) {
      case SP48_RENDER_PHASE_BORDER:
      case SP48_RENDER_PHASE_BORDER_FETCH_PIXEL:
      case SP48_RENDER_PHASE_BORDER_FETCH_ATTR:
        renderBorderPixelsAt(sp48RenderingPixelIndex[tact]);
        break;
    }
  }
}

#define SP48_FILL_BORDER_PIXEL() getBorderPixel(sp48BorderColor)
#define SP48_FLOATING_PIXEL(tact) \
  readScreenMemoryOffset((tact) == ulaSnowTact \
    ? ((sp48RenderingPixelAddress[tact] & ~0x7fu) | ulaSnowLow) : sp48RenderingPixelAddress[tact])
#define SP48_FLOATING_ATTR(tact) \
  readScreenMemoryOffset((tact) == ulaSnowTact + 1u \
    ? ((sp48RenderingAttributeAddress[tact] & ~0x7fu) | ulaSnowLow) : sp48RenderingAttributeAddress[tact])
#endif

/* The frame tact the renderer counts from (`sp48BorderFrameStartTact`), clock multiplier applied */
static inline uint32_t ulaMachineTact(void) {
  const uint32_t elapsedTacts =
    sp48Tacts >= sp48BorderFrameStartTact ? sp48Tacts - sp48BorderFrameStartTact : 0u;
  const uint32_t multiplier = sp48ClockMultiplier == 0u ? 1u : sp48ClockMultiplier;
  uint32_t machineTact = elapsedTacts / multiplier;
  if (machineTact >= sp48TactsInFrame) {
    machineTact = sp48TactsInFrame - 1u;
  }
  return machineTact;
}

/* Renders every tact up to and including `lastTact` */
static void renderUlaUntilFrameTact(uint32_t lastTact) {
  while (sp48LastRenderedFrameTact <= lastTact && sp48LastRenderedFrameTact < sp48TactsInFrame) {
    renderUlaTact(sp48LastRenderedFrameTact);
    sp48LastRenderedFrameTact++;
  }
}

static void renderUlaUntilCurrentTact(void) {
  renderUlaUntilFrameTact(ulaMachineTact());
}

/*
 * Brings the picture up to a CPU write to the screen memory, which the caller makes now, at the end
 * of its 3 T-state cycle (Phase 2). A real ULA read sees the new byte from the fourth T-state after
 * the cycle's first on (the data is in the RAM before then; contention keeps the CPU's cycles away
 * from the reads near it, so the edge cases cannot occur). In table tacts that is `delay` earlier:
 * render with the old byte only what comes before it.
 */
static void renderUlaBeforeWrite(void) {
  const uint32_t machineTact = ulaMachineTact();
  if (ulaFetchDelay == 0u) {
    renderUlaUntilFrameTact(machineTact);
  } else if (machineTact >= ulaFetchDelay) {
    renderUlaUntilFrameTact(machineTact - ulaFetchDelay);
  }
}

/*
 * The beam, for the IDE's beam position overlay (`.plans/BEAM_POSITION_OVERLAY_PLAN.md` §4.3), one
 * field per call so no static is needed:
 *   0 the current frame tact   1 tacts per raster line   2 raster lines per frame
 *   3 the first visible line   4 the first display (paper) line   5 the first visible border tact
 *   (a line's left border is drawn at the end of the line before it, from this tact on)
 *   6 the first frame tact not rendered yet   7 tacts in a frame
 *   8 the frame tact raster line 0 starts at: 0 here; a core whose tables are rotated so that frame
 *   tact 0 stays its interrupt (the Pentagon) answers this field itself
 * Rendering to the beam is renderUlaUntilCurrentTact itself (T2): it renders tact by tact from the
 * memory as it is now, which is what the beam saw, and every later write catches up first anyway, so
 * calling it while paused changes nothing the machine shows later.
 */
static uint32_t ulaBeamInfo(uint32_t field) {
  switch (field) {
    case 0u: return currentFrameTact();
    case 1u: return sp48ScreenLineTime;
    case 2u: return sp48RasterLines;
    case 3u: return sp48FirstVisibleLine;
    case 4u: return sp48FirstDisplayLine;
    case 5u: return sp48FirstVisibleBorderTact;
    case 6u: return sp48LastRenderedFrameTact;
    case 7u: return sp48TactsInFrame;
    case 8u: return ulaRasterShift;
    default: return 0u;
  }
}

static void renderUlaDisplay(void) {
  const uint32_t words = pixelBufferWordCount();
  const uint32_t borderPixel = SP48_FILL_BORDER_PIXEL();
  for (uint32_t i = 0u; i < words; i++) {
    sp48PixelBuffer[i] = borderPixel;
  }

  sp48PixelByte1 = 0u;
  sp48PixelByte2 = 0u;
  sp48AttrByte1 = 0u;
  sp48AttrByte2 = 0u;
  for (uint32_t tact = 0u; tact < sp48TactsInFrame; tact++) {
    renderUlaTact(tact);
  }
}

uint32_t sp48ReadFloatingBus(void) {
  const uint32_t currentTactIndex =
    (currentFrameTact() + sp48TactsInFrame - 5u) % sp48TactsInFrame;
  const uint8_t phase = sp48RenderingPhase[currentTactIndex];

  switch (phase) {
    case SP48_RENDER_PHASE_BORDER_FETCH_PIXEL:
    case SP48_RENDER_PHASE_DISPLAY_B1_FETCH_B2:
    case SP48_RENDER_PHASE_DISPLAY_B2_FETCH_B1:
      return SP48_FLOATING_PIXEL(currentTactIndex);
    case SP48_RENDER_PHASE_BORDER_FETCH_ATTR:
    case SP48_RENDER_PHASE_DISPLAY_B1_FETCH_A2:
    case SP48_RENDER_PHASE_DISPLAY_B2_FETCH_A1:
      return SP48_FLOATING_ATTR(currentTactIndex);
    default:
      return 0xffu;
  }
}

#undef SP48_FLOATING_ATTR
#undef SP48_FLOATING_PIXEL
#undef SP48_FILL_BORDER_PIXEL
#undef SP48_ATTR_FETCH_PIXEL_ADDRESS
