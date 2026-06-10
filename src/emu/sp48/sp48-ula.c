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
  8u, 7u, 49u, 48u, 8u, 192u, 24u, 24u, 128u, 40u, 8u, 2u, 1u, {6u, 5u, 4u, 3u, 2u, 1u, 0u, 0u}
};

static const Sp48ScreenConfig sp48NtscConfig = {
  8u, 15u, 25u, 24u, 0u, 192u, 24u, 24u, 128u, 40u, 8u, 2u, 1u, {6u, 5u, 4u, 3u, 2u, 1u, 0u, 0u}
};

static inline uint32_t currentScreenWidth(void) {
  return sp48TimingScreenWidth == 0u ? SP48_SCREEN_BUFFER_WIDTH_MAX : sp48TimingScreenWidth;
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

static inline uint16_t screenPixelAddress(uint32_t y, uint32_t xByte) {
  return (uint16_t)(0x4000u + ((y & 0xc0u) << 5u) + ((y & 0x07u) << 8u) + ((y & 0x38u) << 2u) + xByte);
}

static inline uint16_t screenAttributeAddress(uint32_t y, uint32_t xByte) {
  return (uint16_t)(0x5800u + ((y >> 3u) << 5u) + xByte);
}

static inline uint32_t getUlaPixelColor(uint8_t pixelSet, uint8_t attr) {
  uint8_t bright = (attr & 0x40u) >> 3u;
  uint8_t ink = (uint8_t)((attr & 0x07u) | bright);
  uint8_t paper = (uint8_t)(((attr >> 3u) & 0x07u) | bright);
  if ((attr & 0x80u) != 0u && flashFlag() != 0u) {
    uint8_t temp = ink;
    ink = paper;
    paper = temp;
  }
  return sp48SpectrumColors[pixelSet != 0u ? ink : paper];
}

static inline uint32_t currentFrameTact(void) {
  return sp48TactsInFrame == 0u ? 0u : sp48Tacts % sp48TactsInFrame;
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

static void initializeTimingTables(const Sp48ScreenConfig *config) {
  clearTimingTables();

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

    if (
      line >= sp48FirstVisibleLine &&
      line <= lastVisibleLine &&
      (tactInLine < lastVisibleLineTact || tactInLine >= sp48FirstVisibleBorderTact)
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
}

static inline void applyContentionDelay(void) {
  const uint32_t delay = sp48Contention[currentFrameTact()];
  sp48Tacts += delay;
  sp48TotalContentionDelaySinceStart += delay;
  sp48ContentionDelaySincePause += delay;
}

static inline uint8_t isContendedIoAddress(uint32_t address) {
  return (address & 0xc000u) == 0x4000u;
}

static inline uint8_t shouldRaiseInterrupt(void) {
  return currentFrameTact() < 32u ? 1u : 0u;
}

static void beginBorderFrame(uint32_t frameStartTact) {
  sp48BorderFrameStartTact = frameStartTact;
  sp48BorderFrameStartColor = sp48BorderColor;
  sp48BorderTransitionCount = 0u;
}

static void recordBorderTransition(uint32_t tact, uint8_t color) {
  if (sp48BorderTransitionCount >= SP48_BORDER_TRANSITION_CAPACITY) {
    sp48DiagnosticFlags |= SP48_DIAGNOSTIC_BORDER_TRANSITION_OVERFLOW;
    return;
  }

  sp48BorderTransitions[sp48BorderTransitionCount].tact = tact;
  sp48BorderTransitions[sp48BorderTransitionCount].color = color;
  sp48BorderTransitionCount++;
}

static inline uint8_t isVisibleBorderPhase(uint8_t phase) {
  return phase == SP48_RENDER_PHASE_BORDER ||
    phase == SP48_RENDER_PHASE_BORDER_FETCH_PIXEL ||
    phase == SP48_RENDER_PHASE_BORDER_FETCH_ATTR;
}

static void renderBorderTransitions(void) {
  uint32_t transitionIndex = 0u;
  uint8_t color = sp48BorderFrameStartColor;
  for (uint32_t tact = 0u; tact < sp48TactsInFrame; tact++) {
    const uint32_t absoluteTact = sp48BorderFrameStartTact + tact;
    while (
      transitionIndex < sp48BorderTransitionCount &&
      sp48BorderTransitions[transitionIndex].tact <= absoluteTact
    ) {
      color = sp48BorderTransitions[transitionIndex].color;
      transitionIndex++;
    }

    if (isVisibleBorderPhase(sp48RenderingPhase[tact]) == 0u) {
      continue;
    }

    const uint32_t index = sp48RenderingPixelIndex[tact];
    if (index + 1u < pixelBufferWordCount()) {
      const uint32_t pixel = getBorderPixel(color);
      sp48PixelBuffer[index] = pixel;
      sp48PixelBuffer[index + 1u] = pixel;
    }
  }
}

static void renderUlaDisplay(void) {
  const uint32_t screenWidth = currentScreenWidth();
  const uint32_t words = pixelBufferWordCount();
  const uint32_t borderPixel = getBorderPixel(sp48BorderColor);
  for (uint32_t i = 0u; i < words; i++) {
    sp48PixelBuffer[i] = borderPixel;
  }

  renderBorderTransitions();

  for (uint32_t y = 0u; y < SP48_DISPLAY_HEIGHT; y++) {
    for (uint32_t xByte = 0u; xByte < 32u; xByte++) {
      uint8_t pixelByte = sp48Memory[screenPixelAddress(y, xByte)];
      uint8_t attr = sp48Memory[screenAttributeAddress(y, xByte)];
      uint32_t index = (sp48DisplayTopLine + y) * screenWidth + sp48DisplayLeftPixel + xByte * 8u;
      for (uint32_t bit = 0u; bit < 8u; bit++) {
        sp48PixelBuffer[index + bit] = getUlaPixelColor(pixelByte & (0x80u >> bit), attr);
      }
    }
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
      return readScreenMemoryOffset(sp48RenderingPixelAddress[currentTactIndex]);
    case SP48_RENDER_PHASE_BORDER_FETCH_ATTR:
    case SP48_RENDER_PHASE_DISPLAY_B1_FETCH_A2:
    case SP48_RENDER_PHASE_DISPLAY_B2_FETCH_A1:
      return readScreenMemoryOffset(sp48RenderingAttributeAddress[currentTactIndex]);
    default:
      return 0xffu;
  }
}
