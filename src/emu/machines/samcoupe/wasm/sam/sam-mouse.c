/*
 * The MGT mouse interface (plan §9.2; SOUND_INPUT_IO.md §4), read at FFFEh beside keyboard row 8.
 *
 * Each read returns the next nibble in bits 0-3: 0 the strobe (Fh), 1 a dummy (Fh), 2 the buttons
 * (active low: bit 0 left, bit 1 right, bit 2 middle), 3-5 the Y movement (bits 11-8, 7-4, 3-0), 6-8 the X
 * movement, as 12-bit two's-complement deltas since the last complete read, latched as read 2 is about to
 * be returned. After read 8 the sequence goes on at read 1 ("stays strobed"). With no read for
 * SAM_MOUSE_TIMEOUT_T the sequence starts again at read 0 (plan Q18: SimCoupé's 38 us). Bit 4 stays the
 * keyboard's (SimCoupé returns F0h | nibble).
 *
 * Positive X is right and positive Y is up in the deltas the host gives (`samMouseMove`).
 */

#define SAM_MOUSE_TIMEOUT_T 228u

static uint8_t samMouseFitted = 1u;
static uint8_t samMouseIndex;
static uint32_t samMouseLastRead;
static uint8_t samMouseEverRead;
/* The movement since the last latch, and the latched values */
static int32_t samMouseDx;
static int32_t samMouseDy;
static uint16_t samMouseLatchX;
static uint16_t samMouseLatchY;
/* The buttons: bit 0 left, bit 1 right, bit 2 middle (1 = pressed) */
static uint8_t samMouseButtons;

static inline uint16_t samMouseClamp(int32_t v) {
  if (v > 2047) v = 2047;
  if (v < -2048) v = -2048;
  return (uint16_t)(v & 0xfff);
}

/* The next nibble (bits 0-3) */
static uint8_t samMouseRead(void) {
  if (!samMouseEverRead || cpu.tacts - samMouseLastRead > SAM_MOUSE_TIMEOUT_T) samMouseIndex = 0u;
  samMouseEverRead = 1u;
  samMouseLastRead = cpu.tacts;
  uint8_t nibble;
  switch (samMouseIndex) {
    case 2u:
      samMouseLatchX = samMouseClamp(samMouseDx);
      samMouseLatchY = samMouseClamp(samMouseDy);
      samMouseDx = 0;
      samMouseDy = 0;
      nibble = (uint8_t)(~samMouseButtons & 0x0fu);
      break;
    case 3u:
      nibble = (uint8_t)((samMouseLatchY >> 8) & 0x0fu);
      break;
    case 4u:
      nibble = (uint8_t)((samMouseLatchY >> 4) & 0x0fu);
      break;
    case 5u:
      nibble = (uint8_t)(samMouseLatchY & 0x0fu);
      break;
    case 6u:
      nibble = (uint8_t)((samMouseLatchX >> 8) & 0x0fu);
      break;
    case 7u:
      nibble = (uint8_t)((samMouseLatchX >> 4) & 0x0fu);
      break;
    case 8u:
      nibble = (uint8_t)(samMouseLatchX & 0x0fu);
      break;
    default:
      nibble = 0x0fu;
      break;
  }
  samMouseIndex = samMouseIndex >= 8u ? 1u : (uint8_t)(samMouseIndex + 1u);
  return nibble;
}

static void samMouseReset(void) {
  samMouseIndex = 0u;
  samMouseEverRead = 0u;
  samMouseDx = 0;
  samMouseDy = 0;
  samMouseLatchX = 0u;
  samMouseLatchY = 0u;
}

/* The host's movement (added up until the guest reads it) and buttons */
void samMouseMove(int32_t dx, int32_t dy) {
  samMouseDx += dx;
  samMouseDy += dy;
}
void samMouseSetButtons(uint32_t buttons) { samMouseButtons = (uint8_t)(buttons & 7u); }
uint32_t samMouseGetIndex(void) { return samMouseIndex; }
