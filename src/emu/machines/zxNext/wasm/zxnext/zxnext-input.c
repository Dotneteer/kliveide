#include "zxnext-input.h"

static uint8_t zxnextJoystick1Mode;
static uint8_t zxnextJoystick2Mode;
static uint8_t zxnextJoystickLeftState;
static uint8_t zxnextJoystickRightState;
static uint8_t zxnextMouseSwapButtons;
static uint8_t zxnextMouseDpi;
static uint8_t zxnextMouseX;
static uint8_t zxnextMouseY;
static uint8_t zxnextMouseWheel;
static uint8_t zxnextMouseButtons;

void zxnextInputReset(void) {
  zxnextJoystick1Mode = 0;
  zxnextJoystick2Mode = 0;
  zxnextJoystickLeftState = 0;
  zxnextJoystickRightState = 0;
  zxnextMouseSwapButtons = 0;
  zxnextMouseDpi = 1;
  zxnextMouseX = 0;
  zxnextMouseY = 0;
  zxnextMouseWheel = 0;
  zxnextMouseButtons = 0;
}

void zxnextSetJoystickModes(uint32_t joystick1Mode, uint32_t joystick2Mode) {
  zxnextJoystick1Mode = joystick1Mode & 7u;
  zxnextJoystick2Mode = joystick2Mode & 7u;
}

void zxnextSetJoystickLeftState(uint32_t state) { zxnextJoystickLeftState = state & 0xffu; }
void zxnextSetJoystickRightState(uint32_t state) { zxnextJoystickRightState = state & 0xffu; }

static uint8_t zxnextJoystickContribution(uint8_t mode, uint8_t state, uint8_t port37) {
  uint8_t md = port37 ? (mode == 6) : (mode == 5);
  uint8_t kempston = port37 ? (mode == 4) : (mode == 1);
  uint8_t value = 0;
  if (kempston || md) value |= state & 0x3fu;
  if (md) value |= state & 0xc0u;
  return value;
}

uint32_t zxnextJoystickReadPort1f(void) {
  return zxnextJoystickContribution(zxnextJoystick1Mode, zxnextJoystickLeftState, 0) |
    zxnextJoystickContribution(zxnextJoystick2Mode, zxnextJoystickRightState, 0);
}

uint32_t zxnextJoystickReadPort37(void) {
  return zxnextJoystickContribution(zxnextJoystick1Mode, zxnextJoystickLeftState, 1) |
    zxnextJoystickContribution(zxnextJoystick2Mode, zxnextJoystickRightState, 1);
}

void zxnextMouseSetNextReg0A(uint32_t value) {
  zxnextMouseDpi = value & 0x03u;
  zxnextMouseSwapButtons = (value & 0x08u) != 0;
}

void zxnextMouseAddDelta(int32_t dx, int32_t dy) {
  switch (zxnextMouseDpi & 3u) {
    case 0: dx <<= 1; dy <<= 1; break;
    case 2: dx >>= 1; dy >>= 1; break;
    case 3: dx >>= 2; dy >>= 2; break;
    default: break;
  }
  zxnextMouseX = (uint8_t)(zxnextMouseX + dx);
  zxnextMouseY = (uint8_t)(zxnextMouseY + dy);
}

void zxnextMouseAddWheelDelta(int32_t dz) { zxnextMouseWheel = (zxnextMouseWheel + dz) & 0x0fu; }

void zxnextMouseSetButtons(uint32_t left, uint32_t right, uint32_t middle) {
  zxnextMouseButtons = (left ? 0x02u : 0u) | (right ? 0x01u : 0u) | (middle ? 0x04u : 0u);
}

uint32_t zxnextMouseReadPortFbdf(void) { return zxnextMouseX; }
uint32_t zxnextMouseReadPortFfdf(void) { return zxnextMouseY; }
uint32_t zxnextMouseReadPortFadf(void) {
  uint8_t left = zxnextMouseButtons & 0x02u;
  uint8_t right = zxnextMouseButtons & 0x01u;
  uint8_t middle = zxnextMouseButtons & 0x04u;
  if (zxnextMouseSwapButtons) {
    uint8_t swappedLeft = right ? 0x02u : 0u;
    uint8_t swappedRight = left ? 0x01u : 0u;
    left = swappedLeft;
    right = swappedRight;
  }
  return ((uint32_t)(zxnextMouseWheel & 0x0fu) << 4) | 0x08u | middle | left | right;
}
uint32_t zxnextGetMouseDpi(void) { return zxnextMouseDpi; }
uint32_t zxnextGetMouseSwapButtons(void) { return zxnextMouseSwapButtons; }

uint32_t zxnextInputReadPort(uint32_t address) {
  switch (address & 0xffffu) {
    case 0x001fu: return zxnextJoystickReadPort1f();
    case 0x0037u: return zxnextJoystickReadPort37();
    case 0xfbdfu: return zxnextMouseReadPortFbdf();
    case 0xffdfu: return zxnextMouseReadPortFfdf();
    case 0xfadfu: return zxnextMouseReadPortFadf();
    default: return 0xffu;
  }
}
