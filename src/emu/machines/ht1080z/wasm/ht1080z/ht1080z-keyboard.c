/*
 * The HT-1080Z keyboard: the TRS-80 Model I 8 x 8 matrix at 3800-3BFF (HARDWARE.md §7.2; the /64
 * keyboard schematic shows exactly this matrix, `.plans/HT1080Z_PLAN.md` §17).
 *
 * Address bits A0-A7 select rows 0-7; a pressed key in a selected row reads as 1 on its column bit
 * D0-D7, and the selected rows are ORed. A key code is `row * 8 + column`:
 *
 *   row 0 (3801)  @ A B C D E F G
 *   row 1 (3802)  H I J K L M N O
 *   row 2 (3804)  P Q R S T U V W
 *   row 3 (3808)  X Y Z
 *   row 4 (3810)  0 1 2 3 4 5 6 7
 *   row 5 (3820)  8 9 : ; , - . /
 *   row 6 (3840)  ENTER CLEAR BREAK UP DOWN LEFT RIGHT SPACE
 *   row 7 (3880)  SHIFT (both keys on one contact)
 *
 * PAGE and F1 are outside the matrix: software cannot read them.
 */

static void htResetKeyboard(void) {
  for (uint32_t i = 0u; i < HT_KEYBOARD_LINES; i++) htKeyboardLines[i] = 0u;
}

/* A read of 3800-3BFF: the OR of the rows whose address bit is set */
static inline uint8_t htReadKeyboard(uint16_t address) {
  const uint8_t rows = (uint8_t)address;
  uint8_t value = 0u;
  for (uint32_t row = 0u; row < HT_KEYBOARD_LINES; row++) {
    if (rows & (1u << row)) value |= htKeyboardLines[row];
  }
  return value;
}

/* Presses (`isDown` nonzero) or releases a key, by its `row * 8 + column` code */
void ht1080zSetKeyStatus(uint32_t key, uint32_t isDown) {
  const uint32_t row = (key >> 3) & 7u;
  const uint8_t mask = (uint8_t)(1u << (key & 7u));
  if (isDown) {
    htKeyboardLines[row] |= mask;
  } else {
    htKeyboardLines[row] &= (uint8_t)~mask;
  }
}

uint32_t ht1080zGetKeyboardLine(uint32_t row) { return htKeyboardLines[row & 7u]; }
