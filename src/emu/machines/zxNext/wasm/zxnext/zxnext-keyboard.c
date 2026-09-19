#include "zxnext-keyboard.h"

/*
 * The Next's membrane (input/membrane/membrane.vhd): the 8x5 matrix (codes 0-39, SpectrumKeyCode) and
 * the 16 extra keys (codes 40-55: 40 + the key's bit in o_extended_keys). An extra key also presses
 * two matrix keys (CAPS or SYMBOL SHIFT and a key) unless NextReg $68 bit 4 cancels those entries;
 * $B0/$B1 read the extra keys themselves. NextKeyboardDevice.ts is the TypeScript counterpart.
 */

/* Defined later in the unity build (zxnext-input.c): the keys the joysticks hold (membrane_stick.vhd) */
static uint8_t zxnextJoystickAnyPressed(void);
static void zxnextJoystickKeys(uint8_t *lines, uint16_t *extended);

static uint8_t zxnextKeyboardSelectedLineValues[256];
static uint16_t zxnextKeyboardExtended;
static uint8_t zxnextKeyboardCancelExtended;
/* The matrix entries of the pressed extra keys, per line */
static uint8_t zxnextKeyboardExtendedLines[ZXNEXT_KEYBOARD_LINE_COUNT];

/* membrane.vhd matrix_work_ex: the two matrix key codes of each extra key, by extra-key bit */
static const uint8_t zxnextKeyboardExtraCombos[16][2] = {
  { 0, 36 },  /* EXTEND: CAPS + SYM */
  { 0, 23 },  /* UP: CAPS + 7 */
  { 0, 16 },  /* CAPS LOCK: CAPS + 2 */
  { 0, 21 },  /* GRAPH: CAPS + 9 */
  { 0, 17 },  /* TRUE VIDEO: CAPS + 3 */
  { 0, 18 },  /* INV VIDEO: CAPS + 4 */
  { 0, 35 },  /* BREAK: CAPS + SPACE */
  { 0, 15 },  /* EDIT: CAPS + 1 */
  { 36, 26 }, /* ;: SYM + O */
  { 36, 25 }, /* ": SYM + P */
  { 36, 38 }, /* ,: SYM + N */
  { 36, 37 }, /* .: SYM + M */
  { 0, 20 },  /* DELETE: CAPS + 0 */
  { 0, 22 },  /* RIGHT: CAPS + 8 */
  { 0, 19 },  /* LEFT: CAPS + 5 */
  { 0, 24 }   /* DOWN: CAPS + 6 */
};

static inline void zxnextKeyboardRebuildSelectedLineValues(void) {
  for (uint32_t line = 0u; line < ZXNEXT_KEYBOARD_LINE_COUNT; line++) zxnextKeyboardExtendedLines[line] = 0u;
  if (!zxnextKeyboardCancelExtended) {
    for (uint32_t bit = 0u; bit < 16u; bit++) {
      if ((zxnextKeyboardExtended & (1u << bit)) == 0u) continue;
      for (uint32_t k = 0u; k < 2u; k++) {
        uint32_t code = zxnextKeyboardExtraCombos[bit][k];
        zxnextKeyboardExtendedLines[code / 5u] |= (uint8_t)(1u << (code % 5u));
      }
    }
  }
  for (uint32_t selectedLines = 0u; selectedLines < 256u; selectedLines++) {
    uint8_t status = 0u;
    for (uint32_t line = 0u; line < ZXNEXT_KEYBOARD_LINE_COUNT; line++) {
      if ((selectedLines & (1u << line)) != 0u) {
        status |= zxnextKeyboardLines[line] | zxnextKeyboardExtendedLines[line];
      }
    }
    zxnextKeyboardSelectedLineValues[selectedLines] = status;
  }
}

static void zxnextKeyboardReset(void) {
  for (uint32_t i = 0; i < ZXNEXT_KEYBOARD_LINE_COUNT; i++) zxnextKeyboardLines[i] = 0;
  zxnextKeyboardExtended = 0;
  zxnextKeyboardCancelExtended = 0;
  zxnextKeyboardRebuildSelectedLineValues();
}

/* Codes 0-39: the matrix keys; 40-55: the extra keys */
static void zxnextKeyboardSetKeyStatus(uint32_t key, uint32_t isDown) {
  if (key >= 40u && key < 56u) {
    uint16_t mask = (uint16_t)(1u << (key - 40u));
    uint16_t old = zxnextKeyboardExtended;
    zxnextKeyboardExtended = isDown ? (uint16_t)(old | mask) : (uint16_t)(old & ~mask);
    if (zxnextKeyboardExtended != old) zxnextKeyboardRebuildSelectedLineValues();
    return;
  }
  uint32_t line = key / 5u;
  uint32_t bit = key % 5u;
  if (line >= ZXNEXT_KEYBOARD_LINE_COUNT) return;
  uint8_t oldValue = zxnextKeyboardLines[line];
  if (isDown != 0) {
    zxnextKeyboardLines[line] = (uint8_t)((zxnextKeyboardLines[line] | (uint8_t)(1u << bit)) & 0x1fu);
  } else {
    zxnextKeyboardLines[line] = (uint8_t)(zxnextKeyboardLines[line] & (uint8_t)~(1u << bit) & 0x1fu);
  }
  if (zxnextKeyboardLines[line] != oldValue) {
    zxnextKeyboardRebuildSelectedLineValues();
  }
}

/* NextReg $68 bit 4 (zxnext.vhd nr_68_cancel_extended_keys, reset to 0) */
static void zxnextKeyboardSetCancelExtended(uint32_t cancel) {
  uint8_t value = cancel != 0u;
  if (value == zxnextKeyboardCancelExtended) return;
  zxnextKeyboardCancelExtended = value;
  zxnextKeyboardRebuildSelectedLineValues();
}

static uint32_t zxnextKeyboardGetCancelExtended(void) { return zxnextKeyboardCancelExtended; }

/* The extra keys held on the membrane: the keyboard's and the joysticks' */
static uint32_t zxnextKeyboardMembraneExtended(void) {
  if (!zxnextJoystickAnyPressed()) return zxnextKeyboardExtended;
  uint8_t lines[8];
  uint16_t extended;
  zxnextJoystickKeys(lines, &extended);
  return zxnextKeyboardExtended | extended;
}

/* zxnext.vhd ~6154: ; " , . UP DOWN LEFT RIGHT */
static uint32_t zxnextKeyboardGetNextRegB0(void) {
  uint32_t e = zxnextKeyboardMembraneExtended();
  return (((e >> 8) & 1u) << 7) | (((e >> 9) & 1u) << 6) | (((e >> 10) & 1u) << 5) | (((e >> 11) & 1u) << 4) |
    (((e >> 1) & 1u) << 3) | (((e >> 15) & 1u) << 2) | (((e >> 14) & 1u) << 1) | ((e >> 13) & 1u);
}

/* zxnext.vhd ~6158: DELETE EDIT BREAK INV TRUE GRAPH CAPSLOCK EXTEND */
static uint32_t zxnextKeyboardGetNextRegB1(void) {
  uint32_t e = zxnextKeyboardMembraneExtended();
  return (((e >> 12) & 1u) << 7) | (((e >> 2) & 0x3fu) << 1) | (e & 1u);
}

static uint32_t zxnextKeyboardGetLine(uint32_t line) {
  return line < ZXNEXT_KEYBOARD_LINE_COUNT ? zxnextKeyboardLines[line] : 0;
}

static inline uint32_t zxnextKeyboardReadPort(uint32_t address) {
  uint32_t selectedLines = (~(address >> 8u)) & 0xffu;
  if (!zxnextJoystickAnyPressed()) return (uint8_t)~zxnextKeyboardSelectedLineValues[selectedLines];
  /* A joystick holds keys: the rows and the extra keys (with their entries) of both, per read */
  uint8_t lines[8];
  uint16_t joyExtended;
  zxnextJoystickKeys(lines, &joyExtended);
  uint16_t extended = (uint16_t)(zxnextKeyboardExtended | joyExtended);
  for (uint32_t line = 0u; line < ZXNEXT_KEYBOARD_LINE_COUNT; line++) lines[line] |= zxnextKeyboardLines[line];
  if (!zxnextKeyboardCancelExtended) {
    for (uint32_t bit = 0u; bit < 16u; bit++) {
      if ((extended & (1u << bit)) == 0u) continue;
      for (uint32_t k = 0u; k < 2u; k++) {
        uint32_t code = zxnextKeyboardExtraCombos[bit][k];
        lines[code / 5u] |= (uint8_t)(1u << (code % 5u));
      }
    }
  }
  uint8_t pressed = 0u;
  for (uint32_t line = 0u; line < ZXNEXT_KEYBOARD_LINE_COUNT; line++) {
    if ((selectedLines & (1u << line)) != 0u) pressed |= lines[line];
  }
  return (uint8_t)~pressed;
}
