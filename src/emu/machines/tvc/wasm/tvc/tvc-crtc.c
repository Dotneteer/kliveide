/*
 * The TVC's 6845 CRT controller (TVC_VIDEO_GENERATION.md Part 3; HW pp.163-194).
 *
 * It only counts: a horizontal counter (characters 0-R0), a raster counter (0-R9) inside a
 * character row, a row counter (0-R4) and R5 adjust lines. The memory address MA is the row's start
 * plus the horizontal count, so it keeps counting through the border and blanking. Display enable
 * (DE) is high for characters below R1 on rows below R6. HS starts at character R2, VS at the start
 * of row R7. The cursor output is high on the character whose MA is R14-R15, on rasters R10-R11,
 * only while DE is high.
 *
 * The variant (plan D6): Hitachi/UMC "type 0" by default, as the manual describes it - R3's high
 * nibble sets the VS width in lines (0 is 16) and R12-R13 read back. `tvcCrtcSetMotorola` switches
 * to the Motorola MC6845: VS is always 16 lines and only R14-R17 read back. Write-only registers
 * read 00h (an assumption: the manual says nothing).
 *
 * The ports (plan §7): A0 is the register select, so 70h-7Fh repeat 70h (address) and 71h (data).
 * `tvcCrtcTick` runs one character: it computes the outputs for the current position into
 * `tvcCrtc` and then advances the counters.
 */

typedef struct TvcCrtcOutputs {
  uint16_t ma;
  uint8_t ra;
  uint8_t de;
  uint8_t hs;
  uint8_t vs;
  uint8_t cursor;
} TvcCrtcOutputs;

static uint8_t tvcCrtcReg[18];
static uint8_t tvcCrtcAddress;
static uint8_t tvcCrtcMotorola;

static uint8_t tvcCrtcH;
static uint8_t tvcCrtcRow;
static uint8_t tvcCrtcRaster;
static uint8_t tvcCrtcAdjustLine;
static uint8_t tvcCrtcInAdjust;
static uint16_t tvcCrtcRowStart;
static uint8_t tvcCrtcHsRemaining;
static uint8_t tvcCrtcVsRemaining;
/* Fields since power-on, for the cursor's blink modes */
static uint32_t tvcCrtcField;

static TvcCrtcOutputs tvcCrtc;

static inline uint16_t tvcCrtcStartAddress(void) {
  return (uint16_t)((((uint32_t)tvcCrtcReg[12] & 0x3fu) << 8) | tvcCrtcReg[13]);
}

static inline uint16_t tvcCrtcCursorAddress(void) {
  return (uint16_t)((((uint32_t)tvcCrtcReg[14] & 0x3fu) << 8) | tvcCrtcReg[15]);
}

static inline uint8_t tvcCrtcHsWidth(void) {
  const uint8_t width = tvcCrtcReg[3] & 0x0fu;
  return width == 0u ? 16u : width;
}

static inline uint8_t tvcCrtcVsWidth(void) {
  if (tvcCrtcMotorola) return 16u;
  const uint8_t width = (uint8_t)(tvcCrtcReg[3] >> 4);
  return width == 0u ? 16u : width;
}

/* Whether the cursor shows in this field: R10 bits 6-5 are 00 steady, 01 off, 10/11 blinking */
static inline uint8_t tvcCrtcCursorVisible(void) {
  switch ((tvcCrtcReg[10] >> 5) & 3u) {
    case 0u: return 1u;
    case 1u: return 0u;
    case 2u: return ((tvcCrtcField >> 3) & 1u) == 0u;
    default: return ((tvcCrtcField >> 4) & 1u) == 0u;
  }
}

/* A new CRTC frame: the row and raster counters restart and MA reloads from R12-R13 */
static void tvcCrtcStartFrame(void) {
  tvcCrtcRow = 0u;
  tvcCrtcRaster = 0u;
  tvcCrtcAdjustLine = 0u;
  tvcCrtcInAdjust = 0u;
  tvcCrtcRowStart = tvcCrtcStartAddress();
  tvcCrtcField++;
  tvcCrtcFrameBegan = 1u;
}

/* One character: the outputs for the current position, then the counters advance */
static void tvcCrtcTick(void) {
  const uint8_t *r = tvcCrtcReg;
  if (tvcCrtcH == 0u && !tvcCrtcInAdjust && tvcCrtcRaster == 0u && tvcCrtcRow == (r[7] & 0x7fu)) {
    tvcCrtcVsRemaining = tvcCrtcVsWidth();
  }
  if (tvcCrtcH == r[2]) tvcCrtcHsRemaining = tvcCrtcHsWidth();

  const uint16_t ma = (uint16_t)((tvcCrtcRowStart + tvcCrtcH) & 0x3fffu);
  const uint8_t de = !tvcCrtcInAdjust && tvcCrtcRow < (r[6] & 0x7fu) && tvcCrtcH < r[1];
  const uint8_t rasterLow = r[10] & 0x1fu;
  const uint8_t rasterHigh = r[11] & 0x1fu;
  tvcCrtc.ma = ma;
  tvcCrtc.ra = tvcCrtcRaster;
  tvcCrtc.de = de;
  tvcCrtc.hs = tvcCrtcHsRemaining != 0u;
  tvcCrtc.vs = tvcCrtcVsRemaining != 0u;
  tvcCrtc.cursor = de && ma == tvcCrtcCursorAddress() && tvcCrtcRaster >= rasterLow && tvcCrtcRaster <= rasterHigh &&
                   tvcCrtcCursorVisible();

  // --- Advance
  if (tvcCrtcHsRemaining != 0u) tvcCrtcHsRemaining--;
  if (tvcCrtcH != r[0]) {
    tvcCrtcH++;
    return;
  }
  tvcCrtcH = 0u;
  if (tvcCrtcVsRemaining != 0u) tvcCrtcVsRemaining--;
  if (tvcCrtcInAdjust) {
    tvcCrtcAdjustLine++;
    if (tvcCrtcAdjustLine >= (r[5] & 0x1fu)) tvcCrtcStartFrame();
    return;
  }
  if (tvcCrtcRaster != (r[9] & 0x1fu)) {
    tvcCrtcRaster = (uint8_t)((tvcCrtcRaster + 1u) & 0x1fu);
    return;
  }
  tvcCrtcRaster = 0u;
  if (tvcCrtcRow != (r[4] & 0x7fu)) {
    tvcCrtcRow = (uint8_t)((tvcCrtcRow + 1u) & 0x7fu);
    tvcCrtcRowStart = (uint16_t)((tvcCrtcRowStart + r[1]) & 0x3fffu);
  } else if (r[5] & 0x1fu) {
    tvcCrtcInAdjust = 1u;
    tvcCrtcAdjustLine = 0u;
  } else {
    tvcCrtcStartFrame();
  }
}

/* The frame length the registers give, in T-states (2 T a character) */
static uint32_t tvcCrtcFrameTacts(void) {
  const uint8_t *r = tvcCrtcReg;
  const uint32_t lines = ((uint32_t)(r[4] & 0x7fu) + 1u) * ((uint32_t)(r[9] & 0x1fu) + 1u) + (r[5] & 0x1fu);
  return ((uint32_t)r[0] + 1u) * 2u * lines;
}

static void tvcCrtcReset(void) {
  tvcCrtcH = 0u;
  tvcCrtcRow = 0u;
  tvcCrtcRaster = 0u;
  tvcCrtcAdjustLine = 0u;
  tvcCrtcInAdjust = 0u;
  tvcCrtcRowStart = tvcCrtcStartAddress();
  tvcCrtcHsRemaining = 0u;
  tvcCrtcVsRemaining = 0u;
  tvcCrtc = (TvcCrtcOutputs){0};
}

static void tvcCrtcPowerOn(void) {
  for (uint32_t i = 0u; i < 18u; i++) tvcCrtcReg[i] = 0u;
  tvcCrtcAddress = 0u;
  tvcCrtcField = 0u;
}

static void tvcCrtcWritePort(uint8_t port, uint8_t value) {
  if ((port & 1u) == 0u) {
    tvcCrtcAddress = value & 0x1fu;
  } else if (tvcCrtcAddress < 16u) {
    tvcCrtcReg[tvcCrtcAddress] = value;
  }
}

static uint8_t tvcCrtcReadPort(uint8_t port) {
  if ((port & 1u) == 0u) return 0xffu;
  switch (tvcCrtcAddress) {
    case 12u:
    case 13u:
      if (tvcCrtcMotorola) return 0u;
      return tvcCrtcAddress == 12u ? (uint8_t)(tvcCrtcReg[12] & 0x3fu) : tvcCrtcReg[13];
    case 14u:
    case 16u:
      return (uint8_t)(tvcCrtcReg[tvcCrtcAddress] & 0x3fu);
    case 15u:
    case 17u:
      return tvcCrtcReg[tvcCrtcAddress];
    default:
      return 0u;
  }
}

/* Plan D6: 0 the Hitachi/UMC type 0 (the default), 1 the Motorola MC6845 */
void tvcCrtcSetMotorola(uint32_t motorola) { tvcCrtcMotorola = motorola != 0u; }
uint32_t tvcCrtcGetRegister(uint32_t index) { return index < 18u ? tvcCrtcReg[index] : 0u; }
uint32_t tvcCrtcGetAddressRegister(void) { return tvcCrtcAddress; }
/* The counters, for the IDE and the tests: h | raster << 8 | row << 16 | inAdjust << 24 */
uint32_t tvcCrtcGetCounters(void) {
  return (uint32_t)tvcCrtcH | ((uint32_t)tvcCrtcRaster << 8) | ((uint32_t)tvcCrtcRow << 16) |
         ((uint32_t)tvcCrtcInAdjust << 24);
}
uint32_t tvcCrtcGetRowStart(void) { return tvcCrtcRowStart; }
