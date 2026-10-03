/*
 * ZX80/ZX81 video: sync and pixel bytes to an RGBA framebuffer.
 *
 * Replaces CLK's `Video.cpp` and its CRT, keeping their semantics (MIT; Copyright (c) 2015 Thomas Harte - the full notice
 * is in zx8081.c and THIRD_PARTY_NOTICES.md): sync is black, idle is white, and a shifted byte paints 8 pixels over 4 T, MSB first,
 * a 1 bit white.
 *
 * The beam: x = 2 pixels per T-state since the end of the last HSYNC, y = lines since the TV frame
 * started; HSYNC's end starts a line. A VSYNC of at least a line ends the TV frame - published from
 * the raw raster into the visible window - once the frame has enough lines for the TV to lock; with no
 * VSYNC (FAST mode, a crashed program) the TV's vertical oscillator ends the frame anyway after 1.25
 * frames of lines, and a line with no HSYNC for two line times is ended by the horizontal one.
 */

/* A VSYNC this long (T-states) is a frame sync; shorter ones (LOAD stripes) only paint black */
#define ZX8081_VSYNC_MIN_TACTS ZX81_LINE_TACTS
/* The TV cannot lock to a frame shorter than this many lines */
#define ZX8081_MIN_FRAME_LINES 200u
#define ZX8081_FLYWHEEL_LINES_PAL 390u
#define ZX8081_FLYWHEEL_LINES_NTSC 328u
/* A line with no HSYNC this long is ended by the TV's horizontal oscillator */
#define ZX8081_HFLYWHEEL_TACTS (2u * ZX81_LINE_TACTS)

/*
 * Where the visible window starts in the raw raster, calibrated so that the ROM's 256 x 192 picture is
 * centred: 48 pixels of border at each side, and 48 lines (PAL, MARGIN 55) or 24 lines (NTSC,
 * MARGIN 31) above it. Measured with the boot screen (`test/zx8081-hw/`).
 */
#define ZX8081_WINDOW_LEFT_ZX81 26u
/* The ZX80's HSYNC ends 1 T later (T 33), so its picture starts 2 pixels later in the raw line */
#define ZX8081_WINDOW_LEFT_ZX80 24u
#define ZX8081_WINDOW_TOP_PAL 9u
#define ZX8081_WINDOW_TOP_NTSC 9u

static uint32_t zx8081ScreenHeight = ZX8081_SCREEN_HEIGHT_PAL;
static uint32_t zx8081WindowTop = ZX8081_WINDOW_TOP_PAL;
static uint32_t zx8081WindowLeft = ZX8081_WINDOW_LEFT_ZX81;
static uint32_t zx8081FlywheelLines = ZX8081_FLYWHEEL_LINES_PAL;

static uint32_t zx8081BeamY;
static uint32_t zx8081LineStartTact;
static uint32_t zx8081VsyncStartTact;
static uint8_t zx8081Vsync;
static uint8_t zx8081Hsync;
static uint32_t zx8081TvFrames;
/* The first line the last published frame drew ink on (diagnostics and calibration); ~0: none */
static uint32_t zx8081FirstInkLine;
static uint32_t zx8081FirstInkX;
static uint32_t zx8081FrameFirstInkLine;
static uint32_t zx8081FrameFirstInkX;
static uint32_t zx8081LastFrameLines;

static void zx8081VideoConfigure(void) {
  zx8081ScreenHeight = zx8081Ntsc ? ZX8081_SCREEN_HEIGHT_NTSC : ZX8081_SCREEN_HEIGHT_PAL;
  zx8081WindowTop = zx8081Ntsc ? ZX8081_WINDOW_TOP_NTSC : ZX8081_WINDOW_TOP_PAL;
  zx8081WindowLeft = zx8081IsZx81 ? ZX8081_WINDOW_LEFT_ZX81 : ZX8081_WINDOW_LEFT_ZX80;
  zx8081FlywheelLines = zx8081Ntsc ? ZX8081_FLYWHEEL_LINES_NTSC : ZX8081_FLYWHEEL_LINES_PAL;
}

static inline uint32_t *zx8081RawLine(uint32_t y) { return zx8081RawRaster + y * ZX8081_RAW_WIDTH; }

static inline uint32_t zx8081BeamX(uint32_t tact) {
  const uint32_t x = (tact - zx8081LineStartTact) * 2u;
  return x < ZX8081_RAW_WIDTH ? x : ZX8081_RAW_WIDTH;
}

static void zx8081PaintFrom(uint32_t x, uint32_t color) {
  uint32_t *line = zx8081RawLine(zx8081BeamY);
  for (; x < ZX8081_RAW_WIDTH; x++) line[x] = color;
}

/* Copies the window out of the raw raster: the picture the IDE shows until the next TV frame */
static void zx8081PublishFrame(void) {
  const uint32_t lines = zx8081BeamY + 1u;
  for (uint32_t y = 0u; y < zx8081ScreenHeight; y++) {
    uint32_t *target = zx8081PixelBuffer + y * ZX8081_SCREEN_WIDTH;
    const uint32_t rawY = zx8081WindowTop + y;
    if (rawY < lines && rawY < ZX8081_RAW_LINES) {
      const uint32_t *source = zx8081RawLine(rawY) + zx8081WindowLeft;
      for (uint32_t x = 0u; x < ZX8081_SCREEN_WIDTH; x++) target[x] = source[x];
    } else {
      /* No signal: the frame ended before this line */
      for (uint32_t x = 0u; x < ZX8081_SCREEN_WIDTH; x++) target[x] = ZX8081_BLACK;
    }
  }
  zx8081LastFrameLines = lines;
  zx8081FrameFirstInkLine = zx8081FirstInkLine;
  zx8081FrameFirstInkX = zx8081FirstInkX;
  zx8081FirstInkLine = 0xffffffffu;
  zx8081FirstInkX = 0xffffffffu;
  zx8081TvFrames++;
}

static void zx8081StartLine(uint32_t tact) {
  zx8081LineStartTact = tact;
  zx8081BeamY++;
  if (zx8081BeamY >= zx8081FlywheelLines || zx8081BeamY >= ZX8081_RAW_LINES) {
    /* The vertical flywheel: no frame sync came */
    zx8081BeamY--;
    zx8081PublishFrame();
    zx8081BeamY = 0u;
  }
  zx8081PaintFrom(0u, zx8081Vsync ? ZX8081_BLACK : ZX8081_WHITE);
}

/* HSYNC ended at `tact`: a new line starts */
static void zx8081VideoHsyncEnd(uint32_t tact) { zx8081StartLine(tact); }

/* Called once an instruction: the horizontal flywheel for a line with no HSYNC (a ZX80 computing) */
static inline void zx8081VideoCheckFlywheel(void) {
  if (cpu.tacts - zx8081LineStartTact >= ZX8081_HFLYWHEEL_TACTS) {
    zx8081StartLine(zx8081LineStartTact + ZX81_LINE_TACTS);
  }
}

static void zx8081VideoSetVsync(uint8_t on) {
  if (on == zx8081Vsync) return;
  const uint32_t x = zx8081BeamX(cpu.tacts);
  if (on) {
    zx8081Vsync = 1u;
    zx8081VsyncStartTact = cpu.tacts;
    zx8081PaintFrom(x, ZX8081_BLACK);
  } else {
    zx8081Vsync = 0u;
    zx8081PaintFrom(x, ZX8081_WHITE);
    if (cpu.tacts - zx8081VsyncStartTact >= ZX8081_VSYNC_MIN_TACTS && zx8081BeamY >= ZX8081_MIN_FRAME_LINES) {
      zx8081PublishFrame();
      zx8081BeamY = 0u;
      /* The rest of this line is the new frame's first line */
      zx8081PaintFrom(0u, ZX8081_WHITE);
    }
  }
}

/* The 8 pixels of a shifted byte (1 bit = white), at the current beam position; none during sync */
static void zx8081VideoOutputByte(uint8_t byte) {
  if (zx8081Vsync || zx8081Hsync) return;
  uint32_t x = zx8081BeamX(cpu.tacts);
  uint32_t *line = zx8081RawLine(zx8081BeamY);
  for (uint32_t bit = 0u; bit < 8u && x < ZX8081_RAW_WIDTH; bit++, x++) {
    const uint8_t white = (uint8_t)((byte << bit) & 0x80u);
    line[x] = white ? ZX8081_WHITE : ZX8081_BLACK;
    if (!white && zx8081FirstInkLine == 0xffffffffu) {
      zx8081FirstInkLine = zx8081BeamY;
      zx8081FirstInkX = x;
    }
    if (!white && zx8081FirstInkLine == zx8081BeamY && x < zx8081FirstInkX) {
      zx8081FirstInkX = x;
    }
  }
}

static void zx8081VideoReset(void) {
  zx8081BeamY = 0u;
  zx8081LineStartTact = cpu.tacts;
  zx8081Vsync = 0u;
  zx8081Hsync = 0u;
  zx8081FirstInkLine = 0xffffffffu;
  zx8081FirstInkX = 0xffffffffu;
  zx8081FrameFirstInkLine = 0xffffffffu;
  zx8081FrameFirstInkX = 0xffffffffu;
  for (uint32_t i = 0u; i < ZX8081_RAW_LINES * ZX8081_RAW_WIDTH; i++) zx8081RawRaster[i] = ZX8081_WHITE;
  for (uint32_t i = 0u; i < ZX8081_SCREEN_WIDTH * ZX8081_SCREEN_HEIGHT_PAL; i++) zx8081PixelBuffer[i] = ZX8081_WHITE;
}

uint32_t zx8081GetScreenWidth(void) { return ZX8081_SCREEN_WIDTH; }
uint32_t zx8081GetScreenHeight(void) { return zx8081ScreenHeight; }
uint32_t zx8081GetTvFrames(void) { return zx8081TvFrames; }
uint32_t zx8081GetLastFrameLines(void) { return zx8081LastFrameLines; }
uint32_t zx8081GetFirstInkLine(void) { return zx8081FrameFirstInkLine; }
uint32_t zx8081GetFirstInkX(void) { return zx8081FrameFirstInkX; }
uint32_t zx8081GetBeamY(void) { return zx8081BeamY; }
