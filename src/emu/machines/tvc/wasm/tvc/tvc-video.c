/*
 * The TVC video: from CRTC address to TV picture, one CRTC character (640 ns, 2 T) at a time
 * (TVC_VIDEO_GENERATION.md Parts 4-10; plan §7). `tvcVideoCharacter` runs at the start of every
 * character, eagerly, as the CPU clock passes it (`tvcAdvanceTacts`): palette, border and mode
 * writes and video RAM writes land at the character they happen in.
 *
 * Per character:
 *  1. The CRTC runs the character (`tvcCrtcTick`): MA, RA, DE, HS, VS, cursor.
 *  2. What reaches the video register now is the byte fetched in the previous character, shown as
 *     paper or border by the previous character's DE: both the shift registers and the border flip-
 *     flop (G15, clocked by DEB) work one character late (Part 8).
 *  3. Blanking clears the video register (Part 8): a 14.4 us monostable from HS rising (22.5
 *     characters, 180 dots at 12.5 MHz), and a latch set by the VS monostable and cleared while MA9
 *     is 1.
 *  4. The TV (Part 9, plan D4): the line sync starts on HS falling, the frame sync on VS rising. The
 *     picture is 70 characters by 288 lines, placed as a television would with the ROM's values:
 *     21 characters after the line sync and 26 line syncs after the frame sync, which centres the
 *     512 x 240 paper with 24 dots and 24 lines of border around it. The window starts just after
 *     the horizontal blank ends (20.5 characters after the line sync), so no blanked dot shows.
 *  5. The byte for this character is fetched from video RAM (the displayed bank on the 64K+):
 *     address bits 0-5 = MA0-5, 6-7 = RA0-1, 8-13 = MA6-11 (Part 4).
 *  6. The interrupt flip-flop is clocked by NOR(cursor, sound IT): it is set when the cursor pulse
 *     ends, or when the sound counter wraps (QD falls) with port 05h bit 5 set (Part 10). While one
 *     input is high, the other's pulse makes no edge: a held sound input masks the cursor.
 *
 * Pixels (Part 6): 2-colour, bit 7 first, palette 0/1; 4-colour, pixel n = palette[2*bit(3-n) +
 * bit(7-n)], each two dots wide; 16-colour, the left pixel bits 7/5/3/1 and the right 6/4/2/0 as
 * I/G/R/B, each four dots wide. The palette (60h-63h) takes I/G/R/B from bits 6/4/2/0, the border
 * (00h) from bits 7/5/3/1. Colours (Part 7): a gun is off, dark (270 ohm alone) or bright (with the
 * 360 ohm intensity resistor), about 57% and 100% of the bright level; "bright black" is black.
 */

#define TVC_DOTS_PER_CHAR 8u
#define TVC_SCREEN_CHARS (TVC_SCREEN_WIDTH / TVC_DOTS_PER_CHAR)
/* The horizontal blank: 0.45 * 6.8k * 4.7n = 14.4 us = 180 dots at 12.5 MHz (Part 9) */
#define TVC_HBLANK_DOTS 180u
/* The frame-sync monostable: 0.45 * 30k * 10n = 135 us = 211 characters */
#define TVC_VSYNC_CHARS 211u
/* Where the TV window sits after its syncs (D4) */
#define TVC_TV_FIRST_CHAR 21u
#define TVC_TV_FIRST_LINE 26u
/* Without a line sync this long, or a frame sync, the TV has lost the picture */
#define TVC_TV_LOST_CHARS 300u
#define TVC_TV_LOST_LINES 400u

/* 0xAABBGGRR; a gun's two levels (Part 7, the 270/360 ohm network) */
#define TVC_LEVEL_DARK 0x92u
#define TVC_LEVEL_BRIGHT 0xffu

static uint32_t tvcColors[16];

/* The registers the CPU writes: mode (port 06h bits 1-0), palette (60h-63h), border (00h), as IGRB */
static uint8_t tvcVideoMode;
static uint8_t tvcPalette[4];
static uint8_t tvcBorder;

/* The pipeline: the byte fetched in the previous character and whether its DE was high */
static uint8_t tvcFetched;
static uint8_t tvcFetchedDe;
/* The blanking: dots of horizontal blank left, the vertical latch, the frame-sync pulse left */
static uint32_t tvcHblankDots;
static uint8_t tvcVblank;
static uint32_t tvcVsyncChars;
/* The CRTC's previous HS and VS, for their edges; the previous NOR input of the IT flip-flop */
static uint8_t tvcPrevHs;
static uint8_t tvcPrevVs;
static uint8_t tvcPrevItSource;
/* The TV: characters since the line sync, lines since the frame sync, and whether it has lost sync */
static uint32_t tvcTvChars = TVC_TV_LOST_CHARS;
static uint32_t tvcTvLines = TVC_TV_LOST_LINES;

/* A palette or border port value as IGRB: I bit 3, G bit 2, R bit 1, B bit 0 */
static inline uint8_t tvcIgrbOf(uint8_t value) {
  return (uint8_t)(((value & 0x40u) >> 3) | ((value & 0x10u) >> 2) | ((value & 0x04u) >> 1) | (value & 0x01u));
}

static void tvcVideoBuildColors(void) {
  for (uint32_t igrb = 0u; igrb < 16u; igrb++) {
    const uint32_t level = (igrb & 8u) ? TVC_LEVEL_BRIGHT : TVC_LEVEL_DARK;
    const uint32_t g = (igrb & 4u) ? level : 0u;
    const uint32_t r = (igrb & 2u) ? level : 0u;
    const uint32_t b = (igrb & 1u) ? level : 0u;
    tvcColors[igrb] = 0xff000000u | (b << 16) | (g << 8) | r;
  }
}

/* The eight dots of a character as IGRB values, from the previous character's byte and DE */
static inline void tvcVideoDots(uint8_t *dots) {
  if (!tvcFetchedDe) {
    for (uint32_t i = 0u; i < 8u; i++) dots[i] = tvcBorder;
    return;
  }
  const uint8_t b = tvcFetched;
  switch (tvcVideoMode) {
    case 0u:
      for (uint32_t i = 0u; i < 8u; i++) dots[i] = tvcPalette[(b >> (7u - i)) & 1u];
      return;
    case 1u:
      for (uint32_t n = 0u; n < 4u; n++) {
        const uint8_t color = tvcPalette[(((b >> (3u - n)) & 1u) << 1) | ((b >> (7u - n)) & 1u)];
        dots[2u * n] = color;
        dots[2u * n + 1u] = color;
      }
      return;
    default: {
      const uint8_t left = tvcIgrbOf((uint8_t)(b >> 1));
      const uint8_t right = tvcIgrbOf(b);
      for (uint32_t i = 0u; i < 4u; i++) {
        dots[i] = left;
        dots[i + 4u] = right;
      }
      return;
    }
  }
}

/* One CRTC character, starting at `charStart` (half-T units) */
static void tvcVideoCharacter(uint32_t charStart) {
  tvcCrtcFrameBegan = 0u;
  tvcCrtcTick();
  const TvcCrtcOutputs out = tvcCrtc;

  // --- The syncs and the blanking triggered by the CRTC's edges
  const uint8_t hsRise = out.hs && !tvcPrevHs;
  const uint8_t hsFall = !out.hs && tvcPrevHs;
  const uint8_t vsRise = out.vs && !tvcPrevVs;
  tvcPrevHs = out.hs;
  tvcPrevVs = out.vs;
  if (hsRise) tvcHblankDots = TVC_HBLANK_DOTS;
  if (vsRise) tvcVsyncChars = TVC_VSYNC_CHARS;
  // --- The vertical latch: the VS monostable sets it, MA9 clears it; both at once, MA9 decides
  const uint8_t ma9 = (out.ma & 0x0200u) != 0u;
  if (tvcVsyncChars != 0u) {
    tvcVblank = !ma9;
    tvcVsyncChars--;
  } else if (ma9) {
    tvcVblank = 0u;
  }
  // --- The TV: a line sync starts a TV line, a frame sync a TV frame
  if (hsFall) {
    tvcTvChars = 0u;
    if (tvcTvLines < TVC_TV_LOST_LINES) tvcTvLines++;
  } else if (tvcTvChars < TVC_TV_LOST_CHARS) {
    tvcTvChars++;
  }
  if (vsRise) tvcTvLines = 0u;

  // --- The dots the video register shows now
  const uint32_t x = tvcTvChars - TVC_TV_FIRST_CHAR;
  const uint32_t y = tvcTvLines - TVC_TV_FIRST_LINE;
  if (x < TVC_SCREEN_CHARS && y < TVC_SCREEN_HEIGHT && tvcTvChars < TVC_TV_LOST_CHARS) {
    uint32_t *pixel = &tvcPixelBuffer[y * TVC_SCREEN_WIDTH + x * TVC_DOTS_PER_CHAR];
    uint8_t dots[8];
    tvcVideoDots(dots);
    for (uint32_t i = 0u; i < 8u; i++) {
      const uint8_t blank = tvcVblank || tvcHblankDots > i;
      pixel[i] = blank ? tvcColors[0] : tvcColors[dots[i]];
    }
  }
  tvcHblankDots = tvcHblankDots > TVC_DOTS_PER_CHAR ? tvcHblankDots - TVC_DOTS_PER_CHAR : 0u;

  // --- The fetch for this character, shown in the next
  const uint32_t vram = ((uint32_t)(out.ra & 3u) << 6) | (out.ma & 0x3fu) | (((uint32_t)out.ma & 0x0fc0u) << 2);
  tvcFetched = tvcMemory[TVC_VID0 + (uint32_t)tvcDisplayBank * TVC_BANK_SIZE + vram];
  tvcFetchedDe = out.de;

  // --- The interrupt flip-flop: set when NOR(cursor, sound IT) rises, that is, when the pulse ends
  const uint8_t itSource = out.cursor || tvcSoundItLevel(charStart);
  if (tvcPrevItSource && !itSource) {
    tvcItPending = 1u;
    cpu.sigInt = 1u;
  }
  tvcPrevItSource = itSource;

  /* This was the frame's last character: the next one starts the new CRTC frame */
  if (tvcCrtcFrameBegan) tvcCrtcFrameStarted(charStart + TVC_CHAR_HALVES);
}

static void tvcVideoReset(void) {
  tvcFetched = 0u;
  tvcFetchedDe = 0u;
  tvcHblankDots = 0u;
  tvcVblank = 0u;
  tvcVsyncChars = 0u;
  tvcPrevHs = 0u;
  tvcPrevVs = 0u;
  tvcPrevItSource = 0u;
  tvcTvChars = TVC_TV_LOST_CHARS;
  tvcTvLines = TVC_TV_LOST_LINES;
  /* The border register is cleared by RESET (HW p.104); the palette and mode latches are not */
  tvcBorder = 0u;
}

static void tvcVideoPowerOn(void) {
  tvcVideoBuildColors();
  tvcVideoMode = 0u;
  for (uint32_t i = 0u; i < 4u; i++) tvcPalette[i] = 0u;
  for (uint32_t i = 0u; i < TVC_SCREEN_WIDTH * TVC_SCREEN_HEIGHT; i++) tvcPixelBuffer[i] = 0xff000000u;
}

static inline void tvcVideoSetMode(uint8_t value) { tvcVideoMode = value & 3u; }
static inline void tvcVideoSetPalette(uint32_t index, uint8_t value) { tvcPalette[index & 3u] = tvcIgrbOf(value); }
static inline void tvcVideoSetBorder(uint8_t value) { tvcBorder = tvcIgrbOf((uint8_t)(value >> 1)); }

uint32_t tvcGetVideoMode(void) { return tvcVideoMode; }
uint32_t tvcGetPalette(uint32_t index) { return tvcPalette[index & 3u]; }
uint32_t tvcGetBorder(void) { return tvcBorder; }
/* Whether the TV has lost the picture: no line sync, or no frame sync, for too long */
uint32_t tvcIsVideoSignalLost(void) { return tvcTvChars >= TVC_TV_LOST_CHARS || tvcTvLines >= TVC_TV_LOST_LINES; }
/* The beam, for the IDE and the tests: TV characters since the line sync | TV lines since the frame sync << 16 */
uint32_t tvcGetTvPosition(void) { return (tvcTvChars & 0xffffu) | ((tvcTvLines & 0xffffu) << 16); }
uint32_t tvcGetVerticalBlank(void) { return tvcVblank; }
