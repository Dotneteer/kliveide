#include "zxnext.h"

#define ZXNEXT_INPUT_INVALID_PORT 0xffffffffu
#define ZXNEXT_JOYSTICK_MODE_KEMPSTON1 1u
#define ZXNEXT_JOYSTICK_MODE_KEMPSTON2 4u
#define ZXNEXT_JOYSTICK_MODE_MD1 5u
#define ZXNEXT_JOYSTICK_MODE_MD2 6u

static void resetInputState(void) {
  joystick1Mode = 0u;
  joystick2Mode = 0u;
  joystickIoModeEnabled = 0u;
  joystickIoMode = 0u;
  joystickIoModeParam = 1u;
  joystickLeftState = 0u;
  joystickRightState = 0u;
  joystickStateWriteCount = 0u;
  mouseXPos = 0u;
  mouseYPos = 0u;
  mouseWheelZ = 0u;
  mouseButtonLeft = 0u;
  mouseButtonRight = 0u;
  mouseButtonMiddle = 0u;
  mouseSwapButtons = 0u;
  mouseDpi = 1u;
  mouseStateWriteCount = 0u;
}

static void syncPeripheral1FromNextReg(uint32_t value) {
  const uint8_t byteValue = (uint8_t)(value & 0xffu);
  joystick1Mode = (uint8_t)(((byteValue & 0xc0u) >> 6u) | ((byteValue & 0x08u) >> 1u));
  joystick2Mode = (uint8_t)(((byteValue & 0x30u) >> 4u) | ((byteValue & 0x02u) << 1u));
}

static void syncPeripheral5InputFromNextReg(uint32_t value) {
  const uint8_t byteValue = (uint8_t)(value & 0xffu);
  mouseSwapButtons = (byteValue & 0x08u) != 0u;
  mouseDpi = byteValue & 0x03u;
}

static void syncJoystickIoFromNextReg(uint32_t value) {
  const uint8_t byteValue = (uint8_t)(value & 0xffu);
  joystickIoModeEnabled = (byteValue & 0x80u) != 0u;
  joystickIoMode = (byteValue >> 4u) & 0x03u;
  joystickIoModeParam = byteValue & 0x01u;
}

static void syncInputStateFromNextRegs(void) {
  syncPeripheral1FromNextReg(nextRegs[0x05u]);
  syncPeripheral5InputFromNextReg(nextRegs[0x0au]);
  syncJoystickIoFromNextReg(nextRegs[0x0bu]);
}

static uint32_t inputReadNextReg(uint32_t reg) {
  if ((reg & 0xffu) == 0x0au) {
    return ((uint32_t)(divMmcMultifaceType & 0x03u) << 6u) |
      (divMmcEnableAutomap != 0u ? 0x10u : 0x00u) |
      (mouseSwapButtons != 0u ? 0x08u : 0x00u) |
      (mouseDpi & 0x03u);
  }
  if ((reg & 0xffu) == 0x0bu) {
    return (joystickIoModeEnabled != 0u ? 0x80u : 0x00u) |
      ((uint32_t)(joystickIoMode & 0x03u) << 4u) |
      (joystickIoModeParam & 0x01u);
  }
  return 0xffffffffu;
}

static uint32_t joystickStateContribution(uint8_t state, uint8_t mode, uint8_t kempstonMode, uint8_t mdMode) {
  if (mode == kempstonMode) return state & 0x3fu;
  if (mode == mdMode) return state;
  return 0u;
}

static uint32_t zxnextReadJoystick1Port(void) {
  return joystickStateContribution(
    joystickLeftState,
    joystick1Mode,
    ZXNEXT_JOYSTICK_MODE_KEMPSTON1,
    ZXNEXT_JOYSTICK_MODE_MD1
  ) | joystickStateContribution(
    joystickRightState,
    joystick2Mode,
    ZXNEXT_JOYSTICK_MODE_KEMPSTON1,
    ZXNEXT_JOYSTICK_MODE_MD1
  );
}

static uint32_t zxnextReadJoystick2Port(void) {
  return joystickStateContribution(
    joystickLeftState,
    joystick1Mode,
    ZXNEXT_JOYSTICK_MODE_KEMPSTON2,
    ZXNEXT_JOYSTICK_MODE_MD2
  ) | joystickStateContribution(
    joystickRightState,
    joystick2Mode,
    ZXNEXT_JOYSTICK_MODE_KEMPSTON2,
    ZXNEXT_JOYSTICK_MODE_MD2
  );
}

static uint32_t zxnextReadMouseButtonsWheelPort(void) {
  const uint8_t primaryButton = mouseSwapButtons != 0u ? mouseButtonRight : mouseButtonLeft;
  const uint8_t secondaryButton = mouseSwapButtons != 0u ? mouseButtonLeft : mouseButtonRight;
  return ((uint32_t)(mouseWheelZ & 0x0fu) << 4u) |
    0x08u |
    (mouseButtonMiddle != 0u ? 0x04u : 0x00u) |
    (primaryButton != 0u ? 0x02u : 0x00u) |
    (secondaryButton != 0u ? 0x01u : 0x00u);
}

static uint32_t zxnextReadMousePort(uint32_t address) {
  const uint16_t port = (uint16_t)(address & 0xffffu);
  const uint16_t maskedPort = port & 0x0fffu;
  if (maskedPort == 0x0bdfu) return isPortGroupEnabled(1u, 5u) != 0u ? mouseXPos : 0xffu;
  if (maskedPort == 0x0fdfu) return isPortGroupEnabled(1u, 5u) != 0u ? mouseYPos : 0xffu;
  if (maskedPort == 0x0adfu) {
    return isPortGroupEnabled(1u, 5u) != 0u ? zxnextReadMouseButtonsWheelPort() : 0xffu;
  }
  return ZXNEXT_INPUT_INVALID_PORT;
}

static uint32_t zxnextReadJoystickPort(uint32_t address) {
  const uint16_t lowByte = (uint16_t)(address & 0x00ffu);
  if (lowByte == 0x001fu) return isPortGroupEnabled(0u, 6u) != 0u ? zxnextReadJoystick1Port() : 0xffu;
  if (lowByte == 0x0037u) return isPortGroupEnabled(0u, 7u) != 0u ? zxnextReadJoystick2Port() : 0xffu;
  if (lowByte == 0x00dfu) {
    return isPortGroupEnabled(0u, 6u) != 0u && isPortGroupEnabled(1u, 5u) == 0u
      ? zxnextReadJoystick1Port()
      : 0xffu;
  }
  return ZXNEXT_INPUT_INVALID_PORT;
}

void zxnextSetJoystickState(uint32_t left, uint32_t right) {
  joystickLeftState = (uint8_t)(left & 0xffu);
  joystickRightState = (uint8_t)(right & 0xffu);
  joystickStateWriteCount++;
}

void zxnextSetMouseState(
  uint32_t x,
  uint32_t y,
  uint32_t wheel,
  uint32_t left,
  uint32_t right,
  uint32_t middle,
  uint32_t swap,
  uint32_t dpi
) {
  mouseXPos = (uint8_t)(x & 0xffu);
  mouseYPos = (uint8_t)(y & 0xffu);
  mouseWheelZ = (uint8_t)(wheel & 0x0fu);
  mouseButtonLeft = left != 0u;
  mouseButtonRight = right != 0u;
  mouseButtonMiddle = middle != 0u;
  mouseSwapButtons = swap != 0u;
  mouseDpi = (uint8_t)(dpi & 0x03u);
  mouseStateWriteCount++;
}

void zxnextAddMouseDelta(int32_t dx, int32_t dy) {
  if (mouseDpi == 0u) {
    dx <<= 1;
    dy <<= 1;
  } else if (mouseDpi == 2u) {
    dx >>= 1;
    dy >>= 1;
  } else if (mouseDpi == 3u) {
    dx >>= 2;
    dy >>= 2;
  }
  mouseXPos = (uint8_t)(((int32_t)mouseXPos + dx) & 0xff);
  mouseYPos = (uint8_t)(((int32_t)mouseYPos + dy) & 0xff);
  mouseStateWriteCount++;
}

void zxnextAddMouseWheelDelta(int32_t dz) {
  mouseWheelZ = (uint8_t)(((int32_t)mouseWheelZ + dz) & 0x0f);
  mouseStateWriteCount++;
}

void zxnextSetMouseButtons(uint32_t left, uint32_t right, uint32_t middle) {
  mouseButtonLeft = left != 0u;
  mouseButtonRight = right != 0u;
  mouseButtonMiddle = middle != 0u;
  mouseStateWriteCount++;
}

uint32_t zxnextGetJoystick1Mode(void) { return joystick1Mode; }
uint32_t zxnextGetJoystick2Mode(void) { return joystick2Mode; }
uint32_t zxnextGetJoystickIoModeEnabled(void) { return joystickIoModeEnabled; }
uint32_t zxnextGetJoystickIoMode(void) { return joystickIoMode; }
uint32_t zxnextGetJoystickIoModeParam(void) { return joystickIoModeParam; }
uint32_t zxnextGetJoystickLeftState(void) { return joystickLeftState; }
uint32_t zxnextGetJoystickRightState(void) { return joystickRightState; }
uint32_t zxnextGetJoystickStateWriteCount(void) { return joystickStateWriteCount; }
uint32_t zxnextGetMouseX(void) { return mouseXPos; }
uint32_t zxnextGetMouseY(void) { return mouseYPos; }
uint32_t zxnextGetMouseWheel(void) { return mouseWheelZ; }
uint32_t zxnextGetMouseButtonLeft(void) { return mouseButtonLeft; }
uint32_t zxnextGetMouseButtonRight(void) { return mouseButtonRight; }
uint32_t zxnextGetMouseButtonMiddle(void) { return mouseButtonMiddle; }
uint32_t zxnextGetMouseSwapButtons(void) { return mouseSwapButtons; }
uint32_t zxnextGetMouseDpi(void) { return mouseDpi; }
uint32_t zxnextGetMouseStateWriteCount(void) { return mouseStateWriteCount; }
