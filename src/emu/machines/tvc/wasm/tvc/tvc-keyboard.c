/*
 * The TVC keyboard: an 11 x 8 active-low matrix (rtvc/info/tvc.md "Keyboard"; HW p.97). Port 03h
 * bits 3-0 select the row and port 58h reads its eight columns; a 0 bit is a pressed key. A row
 * outside 0-10 reads FFh. A key code is `row * 8 + column`, as `TvcKeyCode.ts` numbers them.
 */

/* The row port 03h selects */
static uint8_t tvcKeyboardRow;

static void tvcResetKeyboard(void) {
  for (uint32_t i = 0u; i < TVC_KEYBOARD_ROWS; i++) tvcKeyboardLines[i] = 0u;
  tvcKeyboardRow = 0u;
}

static inline uint8_t tvcReadKeyboard(void) {
  return tvcKeyboardRow <= 10u ? (uint8_t)~tvcKeyboardLines[tvcKeyboardRow] : 0xffu;
}

/* Presses (`isDown` nonzero) or releases a key, by its `row * 8 + column` code */
void tvcSetKeyStatus(uint32_t key, uint32_t isDown) {
  const uint32_t row = (key >> 3) & 15u;
  const uint8_t mask = (uint8_t)(1u << (key & 7u));
  if (isDown) {
    tvcKeyboardLines[row] |= mask;
  } else {
    tvcKeyboardLines[row] &= (uint8_t)~mask;
  }
}

uint32_t tvcGetKeyboardLine(uint32_t row) { return tvcKeyboardLines[row & 15u]; }
