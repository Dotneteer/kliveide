#include "zxnext-keyboard.h"

static uint8_t zxnextKeyboardSelectedLineValues[256];

static inline void zxnextKeyboardRebuildSelectedLineValues(void) {
  for (uint32_t selectedLines = 0u; selectedLines < 256u; selectedLines++) {
    uint8_t status = 0u;
    for (uint32_t line = 0u; line < ZXNEXT_KEYBOARD_LINE_COUNT; line++) {
      if ((selectedLines & (1u << line)) != 0u) {
        status |= zxnextKeyboardLines[line];
      }
    }
    zxnextKeyboardSelectedLineValues[selectedLines] = status;
  }
}

static void zxnextKeyboardReset(void) {
  for (uint32_t i = 0; i < ZXNEXT_KEYBOARD_LINE_COUNT; i++) zxnextKeyboardLines[i] = 0;
  zxnextKeyboardRebuildSelectedLineValues();
}

static void zxnextKeyboardSetKeyStatus(uint32_t key, uint32_t isDown) {
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

static uint32_t zxnextKeyboardGetLine(uint32_t line) {
  return line < ZXNEXT_KEYBOARD_LINE_COUNT ? zxnextKeyboardLines[line] : 0;
}

static inline uint32_t zxnextKeyboardReadPort(uint32_t address) {
  uint32_t selectedLines = (~(address >> 8u)) & 0xffu;
  uint8_t pressed = zxnextKeyboardSelectedLineValues[selectedLines];
  return (uint8_t)~pressed;
}
