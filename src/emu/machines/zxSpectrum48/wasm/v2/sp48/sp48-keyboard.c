// ----------------------------------------------------------------------------
// Keyboard matrix

static void resetKeyboard(void) {
  for (uint32_t i = 0u; i < 8u; i++) {
    sp48KeyboardLines[i] = 0u;
  }
}

void sp48SetKeyStatus(uint32_t key, uint32_t down) {
  if (key >= 40u) {
    return;
  }

  const uint32_t line = key / 5u;
  const uint8_t mask = (uint8_t)(1u << (key % 5u));
  if (down != 0u) {
    sp48KeyboardLines[line] = (uint8_t)((sp48KeyboardLines[line] | mask) & 0x1fu);
  } else {
    sp48KeyboardLines[line] = (uint8_t)(sp48KeyboardLines[line] & (uint8_t)~mask & 0x1fu);
  }
}

uint32_t sp48GetKeyboardLine(uint32_t line) {
  return sp48KeyboardLines[line & 0x07u];
}
