/*
 * The SAM Coupé keyboard and joysticks (plan §9.1; SOUND_INPUT_IO.md §3).
 *
 * A 9 x 8 active-low matrix. Rows 0-7 are selected by a 0 on A8-A15 (several at once AND together);
 * row 8 (CNTRL and the cursor keys) when A8-A15 are all 1 (port FFFEh), shared with the mouse. Bits 0-4
 * read on FEh (the Spectrum's matrix), bits 5-7 (the SAM's extra keys) on F9h's STATUS; row 8 has only
 * the five FEh bits. A key code is `row * 8 + bit`, as `SamKeyCode.ts` numbers them.
 *
 * The joysticks are wired onto rows 4 (stick 1, A12) and 3 (stick 2, A11), Interface 2 style: the host
 * presses the matching keys (`SamKeyMappings.ts`).
 */

#define SAM_KEYBOARD_ROWS 9u

/* The matrix: one byte per row, a set bit is a pressed key */
static uint8_t samKeyboardLines[16];

/* The pressed bits of the rows `high` (A8-A15) selects; row 8 when they are all 1 */
static inline uint8_t samKeyRowsPressed(uint8_t high) {
  if (high == 0xffu) return samKeyboardLines[8];
  uint8_t pressed = 0u;
  for (uint32_t row = 0u; row < 8u; row++) {
    if ((high & (1u << row)) == 0u) pressed |= samKeyboardLines[row];
  }
  return pressed;
}

/* Presses (`isDown` nonzero) or releases a key, by its `row * 8 + bit` code */
void samSetKeyStatus(uint32_t key, uint32_t isDown) {
  const uint32_t row = (key >> 3) & 15u;
  const uint8_t mask = (uint8_t)(1u << (key & 7u));
  if (row >= SAM_KEYBOARD_ROWS) return;
  if (isDown) {
    samKeyboardLines[row] |= mask;
  } else {
    samKeyboardLines[row] &= (uint8_t)~mask;
  }
}

uint32_t samGetKeyboardLine(uint32_t row) { return samKeyboardLines[row & 15u]; }
uint32_t samKeyboardLinesPtr(void) { return (uint32_t)(uintptr_t)samKeyboardLines; }
