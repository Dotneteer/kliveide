/*
 * NICK, the video chip (plan §7; NICK_VIDEO.md, NICK_VIDEO_BACKGROUND.md §2). Phase 1: the slot
 * stepper, the Line Parameter Table walker, the line data pointers, VINT and vertical sync. The pixels
 * come in Phase 3.
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
 */

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

/* A display fetch slot inside the margins: the bytes the mode reads (Phase 3 shows them) */
static inline void epNickFetch(void) {
  switch (epNickMode) {
    case 1u:  // --- PIXEL
      epNickRead(epNickLd1);
      epNickRead((uint16_t)(epNickLd1 + 1u));
      break;
    case 2u:  // --- ATTRIBUTE
      epNickRead(epNickLd1);
      epNickRead(epNickLd2);
      break;
    case 3u:  // --- CH256
      epNickRead((uint16_t)((epNickLd2 << 8) | epNickRead(epNickLd1)));
      break;
    case 4u:  // --- CH128
      epNickRead((uint16_t)((epNickLd2 << 7) | (epNickRead(epNickLd1) & 0x7fu)));
      break;
    case 5u:  // --- CH64
      epNickRead((uint16_t)((epNickLd2 << 6) | (epNickRead(epNickLd1) & 0x3fu)));
      break;
    case 6u:  // --- unused: the generic path, glyph address FFFFh (plan Q4)
      epNickRead(epNickLd1);
      epNickRead(0xffffu);
      break;
    default:  // --- LPIXEL, VSYNC: one byte
      epNickRead(epNickLd1);
      break;
  }
  epNickCountPointers();
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
    if (epNickMode == 0u && !epNickVsyncOn) {
      epNickVsyncOn = 1u;
      epNickLine = 0u;
      epVsyncStarted();
    }
  }
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
