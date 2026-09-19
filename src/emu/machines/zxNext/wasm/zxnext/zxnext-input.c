#include "zxnext-input.h"

/*
 * The Kempston mouse (input/ps2_mouse.v; MouseDevice.ts is the TypeScript counterpart): each PS/2 packet
 * latches the buttons and adds its deltas to 8-bit counters, with NextReg $0A bit 3 (button reverse)
 * and bits 1-0 (DPI) applied as the packet arrives. Only power-on clears the counters.
 */
static uint8_t zxnextMouseX;
static uint8_t zxnextMouseY;
static uint8_t zxnextMouseWheel;
/* {mthird, mright, mleft}: bit 2 middle, bit 1 right, bit 0 left (1 = pressed) */
static uint8_t zxnextMouseButtons;

/*
 * Joysticks (zxnext.vhd ~3426-3496, membrane_stick.vhd, md6_joystick_connector_x2.vhd). The modes come
 * from NextReg $05 (joystick 1: bit 3 & bits 7-6, joystick 2: bit 1 & bits 5-4), the I/O mode from $0B
 * bit 7. JoystickDevice.ts is the TypeScript counterpart.
 */

/* The connectors: 12 bits, active high: MODE X Z Y START A C B U D L R */
static uint16_t zxnextJoystickLeftState;
static uint16_t zxnextJoystickRightState;
/* membrane_stick.vhd udk_map: initialised by a core load (keyjoy_64_6.coe), kept by resets */
static uint8_t zxnextJoymap[64];
static uint8_t zxnextKeymapSelectJoy;
static uint16_t zxnextKeymapAddress;

/* keyjoy_64_6.coe, each half: 0-4 Sinclair "011", 5-9 Sinclair "000", 10-14 Cursor, 16-27 user keys */
static const uint8_t zxnextJoymapInit[32] = {
  043, 044, 042, 041, 040, 031, 030, 032, 033, 034, 042, 034, 044, 043, 040, 077,
  007, 007, 007, 007, 007, 007, 007, 007, 007, 007, 007, 007, 007, 007, 007, 007
};

static uint32_t zxnextJoystickMode(uint32_t side) {
  uint8_t r = zxnextNextRegs[0x05u];
  return side == 0u ? (((r >> 3) & 1u) << 2) | ((r >> 6) & 3u) : (((r >> 1) & 1u) << 2) | ((r >> 4) & 3u);
}

static uint8_t zxnextJoystickIoMode(void) { return (zxnextNextRegs[0x0bu] & 0x80u) != 0u; }

/* What a connector reports: in I/O mode only its six raw pins (C B U D L R) */
static uint32_t zxnextJoystickConnector(uint32_t side) {
  uint32_t state = side == 0u ? zxnextJoystickLeftState : zxnextJoystickRightState;
  return zxnextJoystickIoMode() ? (state & 0x3fu) : state;
}

/* A Next reset reaches neither the joysticks nor the mouse (its reset is the power-on m_reset) */
void zxnextInputReset(void) {}

static void zxnextMouseHardReset(void) {
  zxnextMouseX = 0;
  zxnextMouseY = 0;
  zxnextMouseWheel = 0;
  zxnextMouseButtons = 0;
}

/* A core load: the joymap's initial contents */
static void zxnextJoystickHardReset(void) {
  for (uint32_t i = 0; i < 32u; i++) {
    zxnextJoymap[i] = zxnextJoymapInit[i];
    zxnextJoymap[32u + i] = zxnextJoymapInit[i];
  }
  zxnextKeymapSelectJoy = 0;
  zxnextKeymapAddress = 0;
}

void zxnextSetJoystickLeftState(uint32_t state) { zxnextJoystickLeftState = (uint16_t)(state & 0xfffu); }
void zxnextSetJoystickRightState(uint32_t state) { zxnextJoystickRightState = (uint16_t)(state & 0xfffu); }

/* ~3469-3491: Kempston modes give bits 5-0, MD modes also START (7) and A (6) */
static uint32_t zxnextJoystickContribution(uint32_t side, uint32_t kempston, uint32_t md) {
  uint32_t mode = zxnextJoystickMode(side);
  uint32_t state = zxnextJoystickConnector(side);
  if (mode == md) return state & 0xffu;
  if (mode == kempston) return state & 0x3fu;
  return 0;
}

/* ~2410, ~2630: $1F answers only while a joystick is in Kempston 1 or MD 1 mode */
static uint8_t zxnextJoystickPort1fDecoded(void) {
  uint32_t a = zxnextJoystickMode(0), b = zxnextJoystickMode(1);
  return a == 1u || a == 5u || b == 1u || b == 5u;
}

static uint8_t zxnextJoystickPort37Decoded(void) {
  uint32_t a = zxnextJoystickMode(0), b = zxnextJoystickMode(1);
  return a == 4u || a == 6u || b == 4u || b == 6u;
}

uint32_t zxnextJoystickReadPort1f(void) {
  if (!zxnextJoystickPort1fDecoded()) return 0xffu;
  return zxnextJoystickContribution(0, 1, 5) | zxnextJoystickContribution(1, 1, 5);
}

uint32_t zxnextJoystickReadPort37(void) {
  if (!zxnextJoystickPort37Decoded()) return 0xffu;
  return zxnextJoystickContribution(0, 4, 6) | zxnextJoystickContribution(1, 4, 6);
}

/* ~6161: $B2 = right X Z Y MODE, left X Z Y MODE */
static uint32_t zxnextJoystickGetNextRegB2(void) {
  uint32_t l = zxnextJoystickConnector(0), r = zxnextJoystickConnector(1);
  return (((r >> 8) & 7u) << 5) | (((r >> 11) & 1u) << 4) | (((l >> 8) & 7u) << 1) | ((l >> 11) & 1u);
}

/* ~6244-6268: $28 bit 7 selects the joymap, bit 0 is address bit 8; $29 bits 7-0; $2B writes and advances */
static void zxnextJoystickWriteKeymapRegister(uint32_t reg, uint32_t value) {
  switch (reg) {
    case 0x28u:
      zxnextKeymapSelectJoy = (value & 0x80u) != 0u;
      zxnextKeymapAddress = (uint16_t)(((value & 0x01u) << 8) | (zxnextKeymapAddress & 0xffu));
      break;
    case 0x29u:
      zxnextKeymapAddress = (uint16_t)((zxnextKeymapAddress & 0x100u) | (value & 0xffu));
      break;
    case 0x2bu:
      if (zxnextKeymapSelectJoy) {
        uint32_t a = zxnextKeymapAddress;
        zxnextJoymap[((a & 0x10u) << 1) | 0x10u | (a & 0x0fu)] = (uint8_t)(value & 0x3fu);
      }
      zxnextKeymapAddress = (uint16_t)((zxnextKeymapAddress + 1u) & 0x1ffu);
      break;
  }
}

static uint8_t zxnextJoystickAnyPressed(void) {
  return (zxnextJoystickLeftState | zxnextJoystickRightState) != 0u;
}

/*
 * membrane_stick.vhd: the membrane keys the joysticks hold, by their modes and the joymap - matrix rows
 * (bits 4-0) and extra keys (row r column 5 = bit 2r, column 6 = bit 2r + 1). None in I/O mode.
 */
static void zxnextJoystickKeys(uint8_t *lines, uint16_t *extended) {
  for (uint32_t i = 0; i < 8u; i++) lines[i] = 0;
  *extended = 0;
  if (zxnextJoystickIoMode()) return;
  for (uint32_t side = 0; side < 2u; side++) {
    uint32_t state = side == 0u ? zxnextJoystickLeftState : zxnextJoystickRightState;
    if (state == 0u) continue;
    uint32_t start, first, last;
    switch (zxnextJoystickMode(side)) {
      case 3u: start = 0; first = 0; last = 4; break;
      case 0u: start = 5; first = 0; last = 4; break;
      case 2u: start = 10; first = 0; last = 4; break;
      case 7u: start = 16; first = 0; last = 11; break;
      case 1u: case 4u: start = 21; first = 5; last = 11; break;
      default: start = 24; first = 8; last = 11; break;
    }
    for (uint32_t bit = first; bit <= last; bit++) {
      if ((state & (1u << bit)) == 0u) continue;
      uint8_t entry = zxnextJoymap[side * 32u + start + bit - first];
      uint32_t row = (entry >> 3) & 7u, col = entry & 7u;
      if (col < 5u) lines[row] |= (uint8_t)(1u << col);
      else if (col < 7u) *extended |= (uint16_t)(1u << (row * 2u + (col == 6u ? 1u : 0u)));
    }
  }
}

/* ps2_mouse.v xydelta: the packet's data byte by DPI (00 doubled, 01 as is, 10 / 11 arithmetic shifts) */
static uint8_t zxnextMouseScaled(int32_t delta) {
  uint8_t b = (uint8_t)delta;
  switch (zxnextNextRegs[0x0au] & 0x03u) {
    case 0: return (uint8_t)(b << 1);
    case 1: return b;
    case 2: return (uint8_t)((b & 0x80u) | (b >> 1));
    default: return (uint8_t)(((b & 0x80u) ? 0xc0u : 0x00u) | (b >> 2));
  }
}

/* One PS/2 packet: buttons (bit 0 left, 1 right, 2 middle), X / Y deltas (right / up), 4-bit wheel */
void zxnextMousePacket(uint32_t buttons, int32_t dx, int32_t dy, int32_t dz) {
  uint8_t left = (buttons & 0x01u) != 0u, right = (buttons & 0x02u) != 0u;
  if ((zxnextNextRegs[0x0au] & 0x08u) != 0u) {
    uint8_t t = left;
    left = right;
    right = t;
  }
  zxnextMouseButtons = (uint8_t)((buttons & 0x04u) | (right ? 0x02u : 0u) | (left ? 0x01u : 0u));
  zxnextMouseX = (uint8_t)(zxnextMouseX + zxnextMouseScaled(dx));
  zxnextMouseY = (uint8_t)(zxnextMouseY + zxnextMouseScaled(dy));
  uint8_t nibble = (uint8_t)(dz & 0x0f);
  zxnextMouseWheel = (uint8_t)(zxnextMouseWheel + ((nibble & 0x08u) ? (nibble | 0xf0u) : nibble));
}

uint32_t zxnextMouseReadPortFbdf(void) { return zxnextMouseX; }
uint32_t zxnextMouseReadPortFfdf(void) { return zxnextMouseY; }
/* zxnext.vhd ~3557: wheel & '1' & not middle & not left & not right (0 = pressed) */
uint32_t zxnextMouseReadPortFadf(void) {
  return ((uint32_t)(zxnextMouseWheel & 0x0fu) << 4) | 0x08u | (~(((zxnextMouseButtons & 0x04u)) |
    ((zxnextMouseButtons & 0x01u) << 1) | ((zxnextMouseButtons & 0x02u) >> 1)) & 0x07u);
}

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
