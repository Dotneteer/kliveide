#include "zxnext.h"

static void resetKeyboardState(void) {
  for (uint32_t i = 0; i < ZXNEXT_KEYBOARD_ROW_COUNT; i++) keyboardRows[i] = 0;
  nextRegs[0xb0] = 0u;
  nextRegs[0xb1] = 0u;
  nextRegs[0xb2] = 0u;
  keyboardRowWrites = 0;
}

static uint32_t readKeyboardRows(uint32_t address) {
  uint8_t pressed = 0;
  const uint32_t selectedLines = (~(address >> 8u)) & 0xffu;
  for (uint32_t line = 0; line < ZXNEXT_KEYBOARD_ROW_COUNT; line++) {
    if ((selectedLines & (1u << line)) != 0u) {
      pressed |= keyboardRows[line] & 0x1fu;
    }
  }
  return (~pressed) & 0xffu;
}

void zxnextSetKeyboardRow(uint32_t row, uint32_t value) {
  if (row >= ZXNEXT_KEYBOARD_ROW_COUNT) return;
  const uint8_t rowValue = (uint8_t)(value & 0x1fu);
  if (keyboardRows[row] == rowValue) return;
  keyboardRows[row] = rowValue;
  keyboardRowWrites++;
}

uint32_t zxnextGetKeyboardRow(uint32_t row) {
  return row < ZXNEXT_KEYBOARD_ROW_COUNT ? keyboardRows[row] : 0xffu;
}

uint32_t zxnextGetKeyboardRowWrites(void) {
  return keyboardRowWrites;
}

void zxnextSetExtendedKeyReg(uint32_t index, uint32_t value) {
  if (index >= 3u) return;
  nextRegs[0xb0u + index] = (uint8_t)(value & 0xffu);
}

uint32_t zxnextGetExtendedKeyReg(uint32_t index) {
  return index < 3u ? nextRegs[0xb0u + index] : 0xffu;
}
