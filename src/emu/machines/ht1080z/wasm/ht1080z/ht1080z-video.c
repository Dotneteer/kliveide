/*
 * The HT-1080Z video: a catch-up raster renderer against the CPU clock (`.plans/HT1080Z_PLAN.md` §6;
 * `_input/ht1080z/VIDEO_TIMING.md`).
 *
 * One T-state is one character slot: a frame is 312 lines of 112 slots, and slot `s` of the frame is
 * the CPU's frame tact `s`. On lines 0-191 the display *reads* video-RAM column n (0-63) at slot n,
 * latches it at slot n+1 and shifts its 6 dots out at slot n+2: slots 2-65 are the visible window.
 * The rest is blanking, drawn black.
 *
 * Nothing is drawn per T-state. `htVideoRenderedRead` is the next read slot not drawn yet; the
 * renderer catches up to the CPU when the CPU is about to touch 3C00h-3FFFh, when VIDEO CUT, PAGE or
 * the dash setting change, and at the end of the frame. A write therefore shows on the current scan
 * line only in columns the beam has not read yet, and from the next scan line elsewhere - the
 * hardware's tearing inside a 12-line row.
 *
 * The black dash (D7): the CPU's video-RAM access switches the RAM to the CPU bus and clears the data
 * latch while VID is low, so every character whose latch strobe falls then is shown blank. VID is low
 * about 2 T-states, from the middle of T1 to the middle of T3 of the memory cycle (an inference from
 * the Z80's MREQ timing, VIDEO_TIMING.md §5), covering the strobes at the start of T2 and T3: the
 * characters read at T1's and T2's slots. `HT_DASH_READ_OFFSET` and `HT_DASH_LENGTH` hold that rule,
 * relative to the slot of the access's T1, so a later measurement is a one-line change (plan §16).
 *
 * Content timing: a read at the access's own T1 slot or earlier sees the old byte; a later one the
 * new byte (the RAM is the CPU's from the middle of T1). With the dash on, the two reads in between
 * are blank either way.
 *
 * VIDEO CUT (32 columns) and PAGE: each column lasts 2 slots and its dots are drawn 2 wide; PAGE
 * selects columns 0-31 or 32-63. Slot x shows the left (x - 2 even) or right half of column
 * page * 32 + (x - 2) / 2, read at slot x - 2. The line and frame totals do not change.
 *
 * Characters (D7 = 0): the character ROM's row `scan` of the glyph D0-D6; dots are bits 7-3 (bit 7
 * leftmost) and the 6th dot is blank. Series I/II draw codes 00h-1Fh as 40h-5Fh (D10, revised after
 * Phase 2: their BASIC stores every letter there); the /64 shows its own glyphs there.
 * Semigraphics (D7 = 1): scan lines 0-3, 4-7 and 8-11 show bit pairs D0/D1, D2/D3 and D4/D5; the even
 * bit lights the left 3 dots, the odd bit the right 3. D6 is ignored.
 */

#define HT_VISIBLE_LINES 192u
#define HT_COLUMNS 64u
#define HT_CELL_DOTS 6u
#define HT_CELL_LINES 12u
/* The visible window inside the picture (D6): 72 dots and 48 lines of border */
#define HT_BORDER_LEFT 72u
#define HT_BORDER_TOP 48u
/* The display shows the byte read at slot n at slot n + 2 */
#define HT_PIPELINE_SLOTS 2u
/* The dash: the reads at the access's T1 slot + 0 and + 1 are latched as zero (see above) */
#define HT_DASH_READ_OFFSET 0u
#define HT_DASH_LENGTH 2u

#define HT_WHITE 0xffffffffu

/* The next read slot of the frame not drawn yet (0 - HT_TACTS_IN_FRAME) */
static uint32_t htVideoRenderedRead;
/* The read slots the current dash blanks: [start, end) */
static uint32_t htVideoDashStart;
static uint32_t htVideoDashEnd;
/* The machine controls (not ports): VIDEO CUT, PAGE, and whether the CPU-access dash is drawn */
static uint8_t htVideoCut;
static uint8_t htVideoPage;
static uint8_t htVideoDashOn = 1u;
/* Series I/II draw codes 00h-1Fh as 40h-5Fh; the /64 does not (set by `ht1080zConfigure`) */
static uint8_t htVideoFoldsLowCodes = 1u;

/* The 6 dots of a byte on a scan line, bit 5 the leftmost dot */
static inline uint32_t htVideoDots(uint8_t value, uint32_t scan) {
  if (value & 0x80u) {
    const uint32_t shift = (scan >> 2) << 1;
    return ((value >> shift) & 1u ? 0x38u : 0u) | ((value >> (shift + 1u)) & 1u ? 0x07u : 0u);
  }
  uint32_t code = value & 0x7fu;
  if (code < 0x20u && htVideoFoldsLowCodes) code += 0x40u;
  return (uint32_t)(htChargen[(code << 4) | scan] >> 3) << 1;
}

/* Draws the visible character slots whose read slot is in [from, to) of one line */
static void htVideoDrawLine(uint32_t line, uint32_t from, uint32_t to) {
  if (to > HT_COLUMNS) to = HT_COLUMNS;
  const uint32_t lineStart = line * HT_TACTS_PER_LINE;
  const uint32_t scan = line % HT_CELL_LINES;
  const uint8_t *row = &htMemory[HT_VIDEO_RAM_START + (line / HT_CELL_LINES) * HT_COLUMNS];
  uint32_t *pixel = &htPixelBuffer[(HT_BORDER_TOP + line) * HT_SCREEN_WIDTH + HT_BORDER_LEFT + from * HT_CELL_DOTS];
  for (uint32_t read = from; read < to; read++) {
    const uint32_t slot = lineStart + read;
    uint32_t dots = 0u;
    if (!(htVideoDashOn && slot >= htVideoDashStart && slot < htVideoDashEnd)) {
      if (htVideoCut) {
        const uint32_t cell = row[(htVideoPage ? 32u : 0u) + (read >> 1)];
        const uint32_t whole = htVideoDots((uint8_t)cell, scan);
        /* The left or right 3 dots of the column, each drawn twice */
        const uint32_t half = (read & 1u) ? (whole & 0x07u) : (whole >> 3);
        dots = ((half & 4u) ? 0x30u : 0u) | ((half & 2u) ? 0x0cu : 0u) | ((half & 1u) ? 0x03u : 0u);
      } else {
        dots = htVideoDots(row[read], scan);
      }
    }
    for (uint32_t dot = 0u; dot < HT_CELL_DOTS; dot++) {
      *pixel++ = (dots & (0x20u >> dot)) ? HT_WHITE : HT_BLACK;
    }
  }
}

/* Draws every read slot before `target` (a frame tact) not drawn yet */
static void HT_NOINLINE htVideoCatchUp(uint32_t target) {
  if (target > HT_TACTS_IN_FRAME) target = HT_TACTS_IN_FRAME;
  while (htVideoRenderedRead < target) {
    const uint32_t line = htVideoRenderedRead / HT_TACTS_PER_LINE;
    if (line >= HT_VISIBLE_LINES) {
      htVideoRenderedRead = target;
      break;
    }
    const uint32_t lineStart = line * HT_TACTS_PER_LINE;
    const uint32_t from = htVideoRenderedRead - lineStart;
    const uint32_t lineEnd = lineStart + HT_TACTS_PER_LINE;
    const uint32_t to = (target < lineEnd ? target : lineEnd) - lineStart;
    if (from < HT_COLUMNS) htVideoDrawLine(line, from, to);
    htVideoRenderedRead = lineStart + to;
  }
}

/* The beam's slot in the frame: the frame tact, on the video clock when the CPU runs faster */
static inline uint32_t htVideoSlot(void) { return htFrameTacts / htClockMultiplier; }

/*
 * A CPU memory cycle at `address` is about to start (its T1 is the current slot): if it is a
 * video-RAM access, the picture is drawn up to the reads that still see the old byte, and the dash
 * is placed. Opcode fetches count too (an M1 cycle drives MREQ as well).
 */
static void HT_NOINLINE htVideoCpuAccess(void) {
  const uint32_t slot = htVideoSlot();
  /* The reads before this access, with the previous dash still in place */
  htVideoCatchUp(slot + HT_DASH_READ_OFFSET);
  htVideoDashStart = slot + HT_DASH_READ_OFFSET;
  htVideoDashEnd = htVideoDashStart + HT_DASH_LENGTH;
  /* The read at T1 still sees the old byte; later reads see the new one */
  htVideoCatchUp(slot + 1u);
}

#define HT_IS_VIDEO_RAM(address) (((address) & 0xfc00u) == HT_VIDEO_RAM_START)

/* The memory delay hooks: the default 3 T, after telling the video about a video-RAM access */
static inline void htDelayMemory(uint16_t address) {
  if (HT_IS_VIDEO_RAM(address)) htVideoCpuAccess();
  tactPlusN(3);
}

/* The end of a frame: the rest of the picture, then the next frame's raster starts over */
static void htVideoEndFrame(void) {
  htVideoCatchUp(HT_TACTS_IN_FRAME);
  htVideoRenderedRead = 0u;
  htVideoDashStart = htVideoDashEnd = 0u;
}

static void htVideoReset(void) {
  htVideoRenderedRead = 0u;
  htVideoDashStart = htVideoDashEnd = 0u;
  for (uint32_t i = 0u; i < HT_SCREEN_WIDTH * HT_SCREEN_HEIGHT; i++) htPixelBuffer[i] = HT_BLACK;
}

/* Draws up to the beam before a control changes what the rest of the frame shows */
static void htVideoBeforeControlChange(void) { htVideoCatchUp(htVideoSlot()); }

void ht1080zSetVideoCut(uint32_t on) {
  htVideoBeforeControlChange();
  htVideoCut = on != 0u;
}
void ht1080zSetVideoPage(uint32_t page) {
  htVideoBeforeControlChange();
  htVideoPage = page != 0u;
}
void ht1080zSetVideoDash(uint32_t on) {
  htVideoBeforeControlChange();
  htVideoDashOn = on != 0u;
}
uint32_t ht1080zGetVideoCut(void) { return htVideoCut; }
uint32_t ht1080zGetVideoPage(void) { return htVideoPage; }
uint32_t ht1080zGetVideoDash(void) { return htVideoDashOn; }
/* Draws the picture up to the beam: a paused machine's screen shows the frame so far */
void ht1080zRenderToBeam(void) { htVideoCatchUp(htVideoSlot()); }
