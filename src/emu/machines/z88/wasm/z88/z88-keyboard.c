/*
 * Cambridge Z88 - the keyboard: the 8x8 key matrix, the key interrupt and the wake-up, and the
 * sleep detection the machine reports.
 *
 * A port of `Z88KeyboardDevice.setKeyStatus` and of the sleep check in `Z88Machine.onInitNewFrame`
 * (Step 7 of `.plans/CAMBRIDGE_Z88_WASM_MIGRATION_PLAN.md`). The matrix itself (`z88KeyboardLines`,
 * one byte per address line A8-A15) and the KBD port read are in z88.c and z88-blink.c.
 *
 * Kept for parity: the keyboard reset clears the matrix but not the "a key is pressed" and shift
 * flags - they change only when a key changes (`Z88KeyboardDevice.reset` clears only the lines).
 */

#define Z88_KEY_SHIFT_LEFT 54u
#define Z88_KEY_SHIFT_RIGHT 63u
#define Z88_INT_KEY 0x04u
#define Z88_STA_KEY 0x04u

/*
 * Sets a key's state: the matrix bit, the shift flags, "a key is pressed", then - while a key is
 * pressed - the key interrupt (INT.KEY sets STA.KEY) and the KWAIT wake-up.
 */
void z88SetKeyStatus(uint32_t key, uint32_t down) {
  if (key > 63u) return;
  if (key == Z88_KEY_SHIFT_RIGHT) z88ShiftRightDown = down ? 1u : 0u;
  if (key == Z88_KEY_SHIFT_LEFT) z88ShiftLeftDown = down ? 1u : 0u;

  const uint32_t line = key >> 3;
  const uint8_t mask = (uint8_t)(1u << (key & 0x07u));
  if (down) {
    z88KeyboardLines[line] |= mask;
  } else {
    z88KeyboardLines[line] &= (uint8_t)~mask;
  }

  z88KeyPressed = 0u;
  for (uint32_t i = 0u; i < Z88_KEYBOARD_LINES; i++) {
    if (z88KeyboardLines[i]) z88KeyPressed = 1u;
  }

  if (z88KeyPressed) {
    if ((z88Int & Z88_INT_KEY) && !(z88Sta & Z88_STA_KEY)) {
      z88BlinkSetSta(z88Sta | Z88_STA_KEY);
    }
    if (z88Int & Z88_INT_KWAIT) {
      z80AwakeCpu();
    }
  }
}

uint32_t z88GetKeyLine(uint32_t line) { return z88KeyboardLines[line & 7u]; }
uint32_t z88GetKeyPressed(void) { return z88KeyPressed; }

/*
 * The sleep check of `onInitNewFrame`: HALT with I = $3F is sleep mode; once both shifts have been
 * released, pressing both clears it for this frame. Returns 1 when that happened - the TypeScript
 * machine then returns before the beeper's new frame, and so does the caller.
 */
static uint8_t z88CheckSleepMode(void) {
  if (z80GetHalted() && ((z80GetIr() >> 8) & 0xffu) == 0x3fu) {
    z88SleepMode = 1u;
    if (z88ShiftsReleased) {
      if (z88ShiftLeftDown && z88ShiftRightDown) {
        z88ShiftsReleased = 0u;
        z88SleepMode = 0u;
        return 1u;
      }
    } else if (!z88ShiftLeftDown && !z88ShiftRightDown) {
      z88ShiftsReleased = 1u;
    }
  } else {
    z88SleepMode = 0u;
  }
  return 0u;
}

uint32_t z88GetSleepMode(void) { return z88SleepMode; }
