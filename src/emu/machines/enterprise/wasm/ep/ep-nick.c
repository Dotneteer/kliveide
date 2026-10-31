/*
 * NICK, the video chip (plan §7; NICK_VIDEO.md, NICK_VIDEO_BACKGROUND.md §2): the slot stepper, the
 * Line Parameter Table walker, the line data pointers, VINT, vertical sync, and the picture.
 *
 * NICK sees the 64K of segments FCh-FFh as its own address space (NICK 0000h = FCh:0000h). A line is
 * 57 slots of 16 NICK clocks (BG §2.4):
 *   0-7    the Line Parameter Block, two bytes a slot: SC/MB, LM/RM, LD1, LD2, COL0-7
 *   8-53   display fetches inside the margins
 *   54-56  DRAM refresh; slot 56 resets the slot counter
 *   HSYNC slots 0-3, colour burst 6-9, blanking from 56 through 9 (colour 0, not the border)
 *
 * The LPB is fetched on every line (BG §2.6), not once per block. Only a block's first line loads the
 * line counter (256 - SC lines) and LD2, and LD1 loads on it - and on every line while MB bit 4 (VRES)
 * is clear. In the character modes LD2 counts once a line (the next font row).
 *
 * Margins (NICK §3.3, BG §2.5) are 6-bit slot numbers compared with the slot counter before the slot's
 * own fetch, right margin first: display is on from the left margin up to the right one. A right
 * margin of 57 or more never matches, so display - or vertical sync - runs on into later lines. The
 * mode is latched at the left margin. Inside the margins LD1 counts every slot (twice in PIXEL), the
 * control slots included, where nothing is fetched; LD2 counts every slot in ATTRIBUTE.
 *
 * Mode byte (MB): bit 7 VINT, bits 6-5 colours, bit 4 VRES, bits 3-1 the mode (0 VSYNC, 1 PIXEL,
 * 2 ATTRIBUTE, 3 CH256, 4 CH128, 5 CH64, 6 unused, 7 LPIXEL), bit 0 RELOAD.
 *
 * VSYNC mode: the left margin turns vertical sync on, the right margin - or slot 0 of a line in another
 * mode - turns it off. The machine's frame ends where it turns on (ep.c, plan §3.2).
 *
 * VINT: MB bit 7 is the /VIRQ level for the line, set as MB is fetched in slot 0 (DAVE takes the edge,
 * ep-dave.c).
 *
 * The LPT pointer (NICK §3.5, BG §2.7): after a block's last line it advances by 16, or goes back to
 * the base after a RELOAD block. Port 83h bits 7-6 are the counter's LOAD and CLOCK controls, whose
 * visible behaviour is this flag model: writing bit 6 = 0 stops the counter and drops any pending
 * request; a 0 -> 1 of bit 6 asks for a step at the end of this line, and bit 6 = 1 with bit 7 = 0 makes
 * that step (and every block end) a reload. A requested step mid-block starts a new block on the next
 * line.
 *
 * Port reads return the last byte NICK fetched (the video bus has no pull-ups, BG §3.4).
 *
 * The picture (plan §3.4, §7.2, BG §2.4-§2.5, §2.8, §3.3):
 *   - one slot of pipeline: the bytes fetched in slot n are shown in slot n + 1, and so is "active"
 *     (inside the margins); outside it a slot shows the border (port 81h);
 *   - the buffers load only in display-fetch slots (8-53), so a later active slot (54, 55) shows the
 *     last bytes fetched again;
 *   - slots 56 and 0-9 are blanked: colour 0 whatever the margins; a VSYNC line is blanked throughout;
 *   - 16 pixels a slot at the 14 MHz dot clock: PIXEL shows two bytes (8 dots each), LPIXEL and the
 *     character modes one byte across the slot, ATTRIBUTE one bitmap byte coloured by its attribute;
 *   - 2/4/16/256 colours: a byte is 8 dots of palette 0-1, 4 of 0-3 (pixel k: bits 3-k and 7-k), 2 of
 *     0-15 (b1 b5 b3 b7 and b0 b4 b2 b6, most significant first) or 1 dot of its own colour;
 *   - palette 0-7 from the LPB, 8-15 from FIXBIAS bits 4-0 and the index's low 3 bits; the palette bus
 *     bits a mode does not drive are 0 and the ALT offsets are OR-ed onto them (DPC12 p. 14): MSBALT
 *     (LM bit 7) and LSBALT (bit 6) take a bitmap byte's bit 7 / bit 0 off it as +2 / +4; ALTIND1 and
 *     ALTIND0 do the same from a character code's bit 7 / bit 6 (EP_ALTIND1_BIT, plan Q2);
 *   - the colour byte is G0 R0 B0 G1 R1 B1 G2 R2 (bit 7 to 0); the levels are the board's resistor DAC
 *     (R and G 470/220/100 ohm, B 220/82 ohm), or the guide's linear rule (`epNickSetLinearPalette`).
 *
 * The TV window (D7): the unblanked slots 10-55 (736 pixels), and 288 lines starting
 * EP_TV_FIRST_LINE lines after vertical sync starts: EXOS's 252-line picture then has 18 lines of
 * border above it and 18 below.
 */

/*
 * Which RM bit is ALTIND1, the one that moves character code bit 7 to colours 2/3 (plan Q2, BG N8):
 * bit 6 in the Programmer's Guide and ep128emu, bit 7 in both editions of "The Nick Chip". ALTIND0 is
 * the other one. EXOS's text screen decides it (`test/ep-hw/nick-picture.test.ts`).
 */
#define EP_ALTIND1_BIT 0x40u
#define EP_ALTIND0_BIT (EP_ALTIND1_BIT ^ 0xc0u)

/* The TV window's first line, counted from where vertical sync starts */
#define EP_TV_FIRST_LINE 25u
/* The window's first slot (the first unblanked one) and how many it shows */
#define EP_TV_FIRST_SLOT 10u
#define EP_TV_SLOTS 46u

#define EP_NICK_FLAG_RELOAD 0x40u
#define EP_NICK_FLAG_STEP 0x80u

/* Ports 80h-83h as last written (FIXBIAS, BORDER, LPL, LPH) */
static uint8_t epNickPort[4];
/* The LPT pointer, the current LPB's bytes (as fetched so far this line) */
static uint16_t epNickLptAddr;
static uint8_t epNickLpb[16];
/* Lines left in the current block (0: the next line starts a new block); whether this line is a first */
static uint32_t epNickLinesLeft;
static uint8_t epNickFirstLine;
static uint16_t epNickLd1;
static uint16_t epNickLd2;
/* The slot that runs next (0-56) */
static uint8_t epNickSlotNo;
static uint8_t epNickDisplayOn;
static uint8_t epNickVsyncOn;
/* The mode latched at the left margin (MB bits 3-1) */
static uint8_t epNickMode;
static uint8_t epNickFlags;
/* The last byte NICK fetched: the floating video bus */
static uint8_t epNickDataBus;
/* Lines since vertical sync started (the beam) */
static uint32_t epNickLine;
/*
 * The picture's pipeline: what the current slot fetched (shown by the next one), and what the previous
 * slot fetched (shown now). `Buf1`/`Buf2` are the two data buffers; `Code` a character code or the
 * attribute byte. The mode, colours and ALT bits are the ones latched at the left margin.
 */
typedef struct {
  uint8_t active;
  uint8_t mode;
  uint8_t colours;
  uint8_t alt;
  uint8_t buf1;
  uint8_t buf2;
  uint8_t code;
} EpNickShown;
static EpNickShown epNickNow;
static EpNickShown epNickShown;
/* The current line is a VSYNC-mode line (blanked throughout) */
static uint8_t epNickLineBlank;
/* LM and RM as latched at the left margin: their top bits are the ALT options */
static uint8_t epNickAltBits;
/* The colour byte to RGBA table (0xAABBGGRR), resistor or linear levels */
static uint32_t epNickRgb[256];
static uint8_t epNickLinearPalette;
/* Frames ended by the two-frame guard in a row: no usable vertical sync (`epIsVideoSignalLost`) */
static uint32_t epNickNoSyncFrames;
/* Where in its line the last vertical sync started (the slot): tells interlaced fields apart */
static uint8_t epNickSyncSlot;

/* The power-on seed for the port registers (on the real machine they are random, plan Q13) */
static uint32_t epNickSeed = 0x2545f491u;

static inline uint8_t epNickRead(uint16_t address) {
  const uint8_t value = epMemory[EP_PHYS_VRAM + address];
  epNickDataBus = value;
  return value;
}

static inline uint16_t epNickLptBase(void) {
  return (uint16_t)(((uint16_t)(epNickPort[3] & 0x0fu) << 12) | ((uint16_t)epNickPort[2] << 4));
}

static inline uint8_t epNickMbMode(void) { return (uint8_t)((epNickLpb[1] >> 1) & 7u); }

/* LD1 and LD2 counting in a slot inside the margins, for the latched mode */
static inline void epNickCountPointers(void) {
  switch (epNickMode) {
    case 1u:  // --- PIXEL: two bytes a slot
      epNickLd1 = (uint16_t)(epNickLd1 + 2u);
      break;
    case 2u:  // --- ATTRIBUTE: the attribute and the bitmap byte
      epNickLd1++;
      epNickLd2++;
      break;
    default:
      epNickLd1++;
      break;
  }
}

/* A display fetch slot inside the margins: the bytes the mode reads, into the data buffers */
static inline void epNickFetch(void) {
  switch (epNickMode) {
    case 1u:  // --- PIXEL: two bitmap bytes
      epNickNow.buf1 = epNickRead(epNickLd1);
      epNickNow.buf2 = epNickRead((uint16_t)(epNickLd1 + 1u));
      break;
    case 2u:  // --- ATTRIBUTE: the attribute and the bitmap byte
      epNickNow.code = epNickRead(epNickLd1);
      epNickNow.buf1 = epNickRead(epNickLd2);
      break;
    case 3u: {  // --- CH256
      const uint8_t code = epNickRead(epNickLd1);
      epNickNow.code = code;
      epNickNow.buf1 = epNickRead((uint16_t)((epNickLd2 << 8) | code));
      break;
    }
    case 4u: {  // --- CH128
      const uint8_t code = epNickRead(epNickLd1);
      epNickNow.code = code;
      epNickNow.buf1 = epNickRead((uint16_t)((epNickLd2 << 7) | (code & 0x7fu)));
      break;
    }
    case 5u: {  // --- CH64
      const uint8_t code = epNickRead(epNickLd1);
      epNickNow.code = code;
      epNickNow.buf1 = epNickRead((uint16_t)((epNickLd2 << 6) | (code & 0x3fu)));
      break;
    }
    case 6u:  // --- unused: a character mode whose glyph address is FFFFh (plan Q4)
      epNickNow.code = epNickRead(epNickLd1);
      epNickNow.buf1 = epNickRead(0xffffu);
      break;
    default:  // --- LPIXEL, VSYNC: one byte
      epNickNow.buf1 = epNickRead(epNickLd1);
      break;
  }
  epNickCountPointers();
}

// -----------------------------------------------------------------------------
// The picture
// -----------------------------------------------------------------------------

/* The palette entry an index (0-15) gives */
static inline uint8_t epNickPalette(uint32_t index) {
  return index < 8u ? epNickLpb[8u + index] : (uint8_t)(((epNickPort[0] & 0x1fu) << 3) | (index & 7u));
}

/* Pixel k's index of a byte: 2 colours (8 pixels), 4 (4), 16 (2) */
static inline uint32_t epNickIndex2(uint8_t b, uint32_t k) { return (b >> (7u - k)) & 1u; }
static inline uint32_t epNickIndex4(uint8_t b, uint32_t k) {
  return ((b >> (7u - k)) & 1u) | (((b >> (3u - k)) & 1u) << 1);
}
static inline uint32_t epNickIndex16(uint8_t b, uint32_t k) {
  return k == 0u ? ((b >> 7) & 1u) | (((b >> 3) & 1u) << 1) | (((b >> 5) & 1u) << 2) | (((b >> 1) & 1u) << 3)
                 : ((b >> 6) & 1u) | (((b >> 2) & 1u) << 1) | (((b >> 4) & 1u) << 2) | ((b & 1u) << 3);
}

/*
 * One byte as `width` hi-res dots (8 for PIXEL's two bytes, 16 for one byte across the slot) into
 * `out`: the colour mode decides how many pixels it holds; `offset` is OR-ed onto every index
 */
static inline void epNickByteDots(uint8_t *out, uint8_t b, uint32_t colours, uint32_t offset, uint32_t width) {
  switch (colours) {
    case 0u: {
      const uint32_t w = width >> 3;
      for (uint32_t k = 0u; k < 8u; k++) {
        const uint8_t c = epNickPalette(epNickIndex2(b, k) | offset);
        for (uint32_t i = 0u; i < w; i++) *out++ = c;
      }
      break;
    }
    case 1u: {
      const uint32_t w = width >> 2;
      for (uint32_t k = 0u; k < 4u; k++) {
        const uint8_t c = epNickPalette(epNickIndex4(b, k) | offset);
        for (uint32_t i = 0u; i < w; i++) *out++ = c;
      }
      break;
    }
    case 2u: {
      const uint32_t w = width >> 1;
      for (uint32_t k = 0u; k < 2u; k++) {
        const uint8_t c = epNickPalette(epNickIndex16(b, k) | offset);
        for (uint32_t i = 0u; i < w; i++) *out++ = c;
      }
      break;
    }
    default:
      for (uint32_t i = 0u; i < width; i++) *out++ = b;
      break;
  }
}

/* A bitmap byte's ALT offset (MSBALT: bit 7 -> +2, LSBALT: bit 0 -> +4), and the byte without those bits */
static inline uint32_t epNickBitmapAlt(uint8_t alt, uint8_t *b) {
  uint32_t offset = 0u;
  if (alt & 0x80u) {
    if (*b & 0x80u) offset |= 2u;
    *b &= 0x7fu;
  }
  if (alt & 0x40u) {
    if (*b & 0x01u) offset |= 4u;
    *b &= 0xfeu;
  }
  return offset;
}

/* A character code's ALT offset (ALTIND1: code bit 7 -> +2, ALTIND0: code bit 6 -> +4) */
static inline uint32_t epNickCodeAlt(uint8_t alt, uint8_t code) {
  uint32_t offset = 0u;
  if ((alt & EP_ALTIND1_BIT) && (code & 0x80u)) offset |= 2u;
  if ((alt & EP_ALTIND0_BIT) && (code & 0x40u)) offset |= 4u;
  return offset;
}

/* The 16 colour bytes a slot shows for what the previous slot fetched */
static void epNickSlotColours(const EpNickShown *v, uint8_t *out) {
  switch (v->mode) {
    case 1u: {  // --- PIXEL: two bytes of 8 dots; MSBALT/LSBALT from LM (`alt` bits 7-6)
      uint8_t b1 = v->buf1;
      uint8_t b2 = v->buf2;
      const uint32_t o1 = epNickBitmapAlt((uint8_t)(v->alt & 0xc0u), &b1);
      const uint32_t o2 = epNickBitmapAlt((uint8_t)(v->alt & 0xc0u), &b2);
      epNickByteDots(out, b1, v->colours, o1, 8u);
      epNickByteDots(out + 8, b2, v->colours, o2, 8u);
      break;
    }
    case 7u: {  // --- LPIXEL: one byte across the slot
      uint8_t b = v->buf1;
      const uint32_t o = epNickBitmapAlt((uint8_t)(v->alt & 0xc0u), &b);
      epNickByteDots(out, b, v->colours, o, 16u);
      break;
    }
    case 2u: {  // --- ATTRIBUTE: bit 1 the low nibble (ink), bit 0 the high (paper), 8 dots of 2 pixels
      const uint8_t ink = epNickPalette(v->code & 0x0fu);
      const uint8_t paper = epNickPalette(v->code >> 4);
      for (uint32_t k = 0u; k < 8u; k++) {
        const uint8_t c = (v->buf1 >> (7u - k)) & 1u ? ink : paper;
        out[2u * k] = c;
        out[2u * k + 1u] = c;
      }
      break;
    }
    case 3u:
    case 4u:
    case 5u:
    case 6u:  // --- the character modes: the glyph byte across the slot, ALTIND from RM (`alt` bits 7-6 of RM)
      epNickByteDots(out, v->buf1, v->colours, epNickCodeAlt((uint8_t)(v->alt << 2), v->code), 16u);
      break;
    default:  // --- VSYNC: nothing shown
      for (uint32_t i = 0u; i < 16u; i++) out[i] = 0u;
      break;
  }
}

/* The slot that runs now, drawn into the TV window (if it is in it) */
static void epNickDraw(uint8_t slot) {
  if (slot < EP_TV_FIRST_SLOT || slot >= EP_TV_FIRST_SLOT + EP_TV_SLOTS) return;
  if (epNickLine < EP_TV_FIRST_LINE || epNickLine >= EP_TV_FIRST_LINE + EP_SCREEN_HEIGHT) return;
  uint32_t *row = &epPixelBuffer[(epNickLine - EP_TV_FIRST_LINE) * EP_SCREEN_WIDTH + (slot - EP_TV_FIRST_SLOT) * 16u];
  if (epNickLineBlank) {
    for (uint32_t i = 0u; i < 16u; i++) row[i] = epNickRgb[0];
    return;
  }
  if (!epNickShown.active) {
    const uint32_t border = epNickRgb[epNickPort[1]];
    for (uint32_t i = 0u; i < 16u; i++) row[i] = border;
    return;
  }
  uint8_t colours[16];
  epNickSlotColours(&epNickShown, colours);
  for (uint32_t i = 0u; i < 16u; i++) row[i] = epNickRgb[colours[i]];
}

/*
 * The colour byte's levels: R = bits 0/3/6, G = 1/4/7, B = 2/5, most significant first. The resistor
 * DAC's relative levels (BG §3.3, equal source voltage into a common load), or the linear n/7, n/3.
 */
static const double epNickRgLevels[8] = {0.0, 0.128, 0.273, 0.400, 0.600, 0.728, 0.872, 1.0};
static const double epNickBLevels[4] = {0.0, 0.27, 0.73, 1.0};

static void epNickBuildRgb(void) {
  for (uint32_t c = 0u; c < 256u; c++) {
    const uint32_t r = ((c & 1u) << 2) | (((c >> 3) & 1u) << 1) | ((c >> 6) & 1u);
    const uint32_t g = (((c >> 1) & 1u) << 2) | (((c >> 4) & 1u) << 1) | ((c >> 7) & 1u);
    const uint32_t b = (((c >> 2) & 1u) << 1) | ((c >> 5) & 1u);
    const double rl = epNickLinearPalette ? r / 7.0 : epNickRgLevels[r];
    const double gl = epNickLinearPalette ? g / 7.0 : epNickRgLevels[g];
    const double bl = epNickLinearPalette ? b / 3.0 : epNickBLevels[b];
    const uint32_t red = (uint32_t)(rl * 255.0 + 0.5);
    const uint32_t green = (uint32_t)(gl * 255.0 + 0.5);
    const uint32_t blue = (uint32_t)(bl * 255.0 + 0.5);
    epNickRgb[c] = 0xff000000u | (blue << 16) | (green << 8) | red;
  }
}

/* The end of a line (slot 56): the line counter and the LPT pointer */
static void epNickEndOfLine(void) {
  if (epNickLinesLeft != 0u) epNickLinesLeft--;
  const uint8_t blockEnded = epNickLinesLeft == 0u;
  if ((blockEnded || (epNickFlags & EP_NICK_FLAG_STEP)) && (epNickPort[3] & 0x40u)) {
    if ((epNickLpb[1] & 0x01u) || (epNickFlags & EP_NICK_FLAG_RELOAD)) {
      epNickLptAddr = epNickLptBase();
    } else {
      epNickLptAddr = (uint16_t)(epNickLptAddr + 16u);
    }
    epNickLinesLeft = 0u;
  } else if (blockEnded) {
    // --- The counter is stopped: the same LPB starts again
    epNickLinesLeft = 0u;
  }
  epNickFlags = (epNickPort[3] & 0xc0u) == 0x40u ? EP_NICK_FLAG_RELOAD : 0u;
  epNickLine++;
}

/* One slot, as the clock passes its start (ep.c) */
static void epNickSlot(void) {
  const uint8_t slot = epNickSlotNo;
  // --- The margin compares, right margin first, against the bytes latched so far
  if (slot == (epNickLpb[3] & 0x3fu)) {
    epNickDisplayOn = 0u;
    epNickVsyncOn = 0u;
  }
  if (slot == (epNickLpb[2] & 0x3fu)) {
    epNickDisplayOn = 1u;
    epNickMode = epNickMbMode();
    epNickNow.mode = epNickMode;
    epNickNow.colours = (uint8_t)((epNickLpb[1] >> 5) & 3u);
    epNickNow.alt = (uint8_t)((epNickLpb[2] & 0xc0u) | ((epNickLpb[3] >> 2) & 0x30u));
    if (epNickMode == 0u && !epNickVsyncOn) {
      epNickVsyncOn = 1u;
      epNickLine = 0u;
      epNickSyncSlot = slot;
      epNickNoSyncFrames = 0u;
      epVsyncStarted();
    }
  }
  // --- The picture shows what the previous slot fetched
  epNickDraw(slot);
  if (slot < 8u) {
    // --- The LPB, two bytes a slot
    if (epNickDisplayOn) epNickCountPointers();
    const uint16_t at = (uint16_t)(epNickLptAddr + slot * 2u);
    epNickLpb[slot * 2u] = epNickRead(at);
    epNickLpb[slot * 2u + 1u] = epNickRead((uint16_t)(at + 1u));
    switch (slot) {
      case 0u:
        epNickFirstLine = epNickLinesLeft == 0u;
        epDaveSetInt1Level((uint8_t)(epNickLpb[1] >> 7));
        epNickLineBlank = epNickMbMode() == 0u;
        if (epNickVsyncOn && epNickMbMode() != 0u) epNickVsyncOn = 0u;
        break;
      case 2u:
        if (epNickFirstLine || !(epNickLpb[1] & 0x10u)) {
          epNickLd1 = (uint16_t)(epNickLpb[4] | (epNickLpb[5] << 8));
        }
        break;
      case 3u: {
        const uint8_t mode = epNickMbMode();
        if (mode >= 3u && mode <= 5u) epNickLd2++;
        if (epNickFirstLine) {
          epNickLd2 = (uint16_t)(epNickLpb[6] | (epNickLpb[7] << 8));
          epNickLinesLeft = 256u - epNickLpb[0];
        }
        break;
      }
      default:
        break;
    }
  } else if (slot < 54u) {
    if (epNickDisplayOn) epNickFetch();
  } else if (epNickDisplayOn) {
    // --- Refresh: nothing fetched, but the pointers count inside the margins
    epNickCountPointers();
  }
  // --- What this slot fetched (or the stale buffers) is shown by the next
  epNickNow.active = epNickDisplayOn;
  epNickShown = epNickNow;
  if (slot == EP_SLOTS_PER_LINE - 1u) {
    epNickEndOfLine();
    epNickSlotNo = 0u;
  } else {
    epNickSlotNo = (uint8_t)(slot + 1u);
  }
}

static void epNickWritePort(uint8_t port, uint8_t value) {
  const uint8_t index = port & 3u;
  const uint8_t old = epNickPort[index];
  epNickPort[index] = value;
  if (index == 3u) {
    if (!(value & 0x40u)) {
      epNickFlags = 0u;
    } else {
      if (!(old & 0x40u)) epNickFlags |= EP_NICK_FLAG_STEP;
      if (!(value & 0x80u)) epNickFlags |= EP_NICK_FLAG_RELOAD;
    }
  }
}

static void epNickReset(void) {
  epNickSlotNo = 0u;
  epNickDisplayOn = 0u;
  epNickVsyncOn = 0u;
  epNickLine = 0u;
}

/* Power on: the port registers and the LPT pointer from the seed, everything else clear */
static void epNickPowerOn(void) {
  uint32_t x = epNickSeed;
  for (uint32_t i = 0u; i < 4u; i++) {
    x = x * 1664525u + 1013904223u;
    epNickPort[i] = (uint8_t)(x >> 24);
  }
  x = x * 1664525u + 1013904223u;
  epNickLptAddr = (uint16_t)((x >> 16) & 0xfff0u);
  for (uint32_t i = 0u; i < 16u; i++) epNickLpb[i] = 0u;
  epNickLinesLeft = 0u;
  epNickFirstLine = 1u;
  epNickLd1 = 0u;
  epNickLd2 = 0u;
  epNickMode = 0u;
  epNickFlags = 0u;
  epNickDataBus = 0xffu;
  epNickNow = (EpNickShown){0};
  epNickShown = epNickNow;
  epNickLineBlank = 0u;
  epNickNoSyncFrames = 0u;
  epNickBuildRgb();
  for (uint32_t i = 0u; i < EP_SCREEN_WIDTH * EP_SCREEN_HEIGHT; i++) epPixelBuffer[i] = 0xff000000u;
}

uint32_t epNickGetPort(uint32_t index) { return epNickPort[index & 3u]; }
uint32_t epNickGetLptAddress(void) { return epNickLptAddr; }
uint32_t epNickGetLptBase(void) { return epNickLptBase(); }
uint32_t epNickGetLpbByte(uint32_t index) { return epNickLpb[index & 15u]; }
uint32_t epNickGetLd1(void) { return epNickLd1; }
uint32_t epNickGetLd2(void) { return epNickLd2; }
uint32_t epNickGetLinesLeft(void) { return epNickLinesLeft; }
/* The beam: the slot that runs next, the lines since vertical sync, display and sync on */
uint32_t epNickGetSlot(void) { return epNickSlotNo; }
uint32_t epNickGetLine(void) { return epNickLine; }
uint32_t epNickGetState(void) {
  return (uint32_t)epNickDisplayOn | ((uint32_t)epNickVsyncOn << 1) | ((uint32_t)epNickMode << 4) | ((uint32_t)epNickFlags << 8);
}
uint32_t epNickGetDataBus(void) { return epNickDataBus; }
/* The power-on seed of the port registers (applies at the next hard reset) */
void epNickSetSeed(uint32_t seed) { epNickSeed = seed; }
/* The guide's linear levels instead of the board's resistor DAC (`MC_EP_PALETTE`) */
void epNickSetLinearPalette(uint32_t linear) {
  epNickLinearPalette = linear != 0u;
  epNickBuildRgb();
}
/* A colour byte's RGBA (0xAABBGGRR), as the picture shows it */
uint32_t epNickGetRgb(uint32_t colour) { return epNickRgb[colour & 0xffu]; }
/* The slot the last vertical sync started at (interlaced fields start half a line apart) */
uint32_t epNickGetSyncSlot(void) { return epNickSyncSlot; }
/* Whether a TV would have lost the picture: no vertical sync for the last frames */
uint32_t epIsVideoSignalLost(void) { return epNickNoSyncFrames >= 2u; }
