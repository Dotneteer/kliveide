#include "zxnext-keyboard.h"

static void zxnextKeyboardReset(void) {
  for (uint32_t i = 0; i < ZXNEXT_KEYBOARD_LINE_COUNT; i++) zxnextKeyboardLines[i] = 0;
}

static void zxnextKeyboardSetKeyStatus(uint32_t key, uint32_t isDown) {
  uint32_t line = key / 5u;
  uint32_t bit = key % 5u;
  if (line >= ZXNEXT_KEYBOARD_LINE_COUNT) return;
  if (isDown != 0) {
    zxnextKeyboardLines[line] |= (uint8_t)(1u << bit);
  } else {
    zxnextKeyboardLines[line] &= (uint8_t)~(1u << bit);
  }
}

static uint32_t zxnextKeyboardGetLine(uint32_t line) {
  return line < ZXNEXT_KEYBOARD_LINE_COUNT ? zxnextKeyboardLines[line] : 0;
}

static uint32_t zxnextKeyboardReadPort(uint32_t address) {
  uint8_t pressed = 0;
  uint8_t selector = (uint8_t)(address >> 8);
  for (uint32_t line = 0; line < ZXNEXT_KEYBOARD_LINE_COUNT; line++) {
    if ((selector & (1u << line)) == 0) {
      pressed |= zxnextKeyboardLines[line];
    }
  }
  return (uint8_t)~pressed;
}
