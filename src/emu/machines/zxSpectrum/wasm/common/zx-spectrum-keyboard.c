// ----------------------------------------------------------------------------
// Keyboard matrix

static void rebuildKeyboardSelectedLineValues(void) {
  for (uint32_t selectedLines = 0u; selectedLines < 256u; selectedLines++) {
    uint8_t status = 0u;
    for (uint32_t line = 0u; line < 8u; line++) {
      if ((selectedLines & (1u << line)) != 0u) {
        status |= sp48KeyboardLines[line];
      }
    }
    sp48KeyboardSelectedLineValue[selectedLines] = status;
  }
}

static void resetKeyboard(void) {
  for (uint32_t i = 0u; i < 8u; i++) {
    sp48KeyboardLines[i] = 0u;
  }
  rebuildKeyboardSelectedLineValues();
}

void sp48SetKeyStatus(uint32_t key, uint32_t down) {
  if (key >= 40u) {
    return;
  }

  const uint32_t line = key / 5u;
  const uint8_t mask = (uint8_t)(1u << (key % 5u));
  const uint8_t oldValue = sp48KeyboardLines[line];
  if (down != 0u) {
    sp48KeyboardLines[line] = (uint8_t)((sp48KeyboardLines[line] | mask) & 0x1fu);
  } else {
    sp48KeyboardLines[line] = (uint8_t)(sp48KeyboardLines[line] & (uint8_t)~mask & 0x1fu);
  }
  if (sp48KeyboardLines[line] != oldValue) {
    rebuildKeyboardSelectedLineValues();
  }
}

uint32_t sp48GetKeyboardLine(uint32_t line) {
  return sp48KeyboardLines[line & 0x07u];
}
