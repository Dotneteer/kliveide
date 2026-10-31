/*
 * The Enterprise keyboard (plan §9.1; DAVE_MEMORY_IO.md §6): a 10 x 8 active-low matrix. B5h bits 3-0
 * select the row (a 74LS145 drives KB0-KB9 low; values A-F select none) and a B5h read returns it; a
 * 0 bit is a pressed key. A key code is `row * 8 + column`, as `EpKeyCode.ts` numbers them.
 *
 * The external joysticks answer on B6h bit 0 (the "J" column) for the row B5h selects: rows 0-4 are
 * joystick 1's fire, up, down, left, right, rows 5-9 joystick 2's.
 */

/* The row B5h selects */
static uint8_t epKeyboardRow;
/* The external joysticks' J column: bit n set, row n's contact is closed */
static uint16_t epJoystickJ;

static void epResetKeyboard(void) {
  epKeyboardRow = 0u;
}

static inline uint8_t epReadKeyboard(void) {
  return epKeyboardRow <= 9u ? (uint8_t)~epKeyboardLines[epKeyboardRow] : 0xffu;
}

/* B6h bits 2-0: the J, K and L columns for the selected row, active low */
static inline uint8_t epReadControlColumns(void) {
  if (epKeyboardRow > 9u) return 0x07u;
  return (epJoystickJ & (1u << epKeyboardRow)) ? 0x06u : 0x07u;
}

/* Presses (`isDown` nonzero) or releases a key, by its `row * 8 + column` code */
void epSetKeyStatus(uint32_t key, uint32_t isDown) {
  const uint32_t row = (key >> 3) & 15u;
  const uint8_t mask = (uint8_t)(1u << (key & 7u));
  if (isDown) {
    epKeyboardLines[row] |= mask;
  } else {
    epKeyboardLines[row] &= (uint8_t)~mask;
  }
}

uint32_t epGetKeyboardLine(uint32_t row) { return epKeyboardLines[row & 15u]; }

/* The external joysticks' contacts: bit n is row n's J contact (rows 0-4 joystick 1, 5-9 joystick 2) */
void epSetJoystickJ(uint32_t bits) { epJoystickJ = (uint16_t)(bits & 0x3ffu); }
