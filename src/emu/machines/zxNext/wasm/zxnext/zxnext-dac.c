#include "zxnext.h"

static void writeDacA(uint32_t value) { dacChannels[0] = (uint8_t)(value & 0xffu); }
static void writeDacB(uint32_t value) { dacChannels[1] = (uint8_t)(value & 0xffu); }
static void writeDacC(uint32_t value) { dacChannels[2] = (uint8_t)(value & 0xffu); }
static void writeDacD(uint32_t value) { dacChannels[3] = (uint8_t)(value & 0xffu); }

static uint32_t zxnextWriteDacPort(uint32_t address, uint32_t value) {
  const uint8_t port = (uint8_t)(address & 0xffu);
  const uint8_t byteValue = (uint8_t)(value & 0xffu);
  switch (port) {
    case 0x1f:
      if (isPortGroupEnabled(2, 1) == 0u) return 1u;
      writeDacA(byteValue);
      return 1u;
    case 0xf1:
      if (isPortGroupEnabled(2, 2) == 0u) return 1u;
      writeDacA(byteValue);
      return 1u;
    case 0x3f:
      if (isPortGroupEnabled(2, 3) == 0u) return 1u;
      writeDacA(byteValue);
      writeDacD(byteValue);
      return 1u;
    case 0x0f:
      if (isPortGroupEnabled(2, 1) == 0u && isPortGroupEnabled(2, 4) == 0u) return 1u;
      writeDacB(byteValue);
      return 1u;
    case 0xf3:
      if (isPortGroupEnabled(2, 2) == 0u) return 1u;
      writeDacB(byteValue);
      return 1u;
    case 0xdf:
      if (isPortGroupEnabled(2, 7) == 0u) return 1u;
      writeDacA(byteValue);
      writeDacD(byteValue);
      return 1u;
    case 0xfb:
      if (isPortGroupEnabled(2, 2) != 0u) {
        writeDacD(byteValue);
        return 1u;
      }
      if (isPortGroupEnabled(2, 5) != 0u) {
        writeDacA(byteValue);
        writeDacD(byteValue);
        return 1u;
      }
      return 1u;
    case 0xb3:
      if (isPortGroupEnabled(2, 6) == 0u) return 1u;
      writeDacB(byteValue);
      writeDacC(byteValue);
      return 1u;
    case 0x4f:
      if (isPortGroupEnabled(2, 1) == 0u && isPortGroupEnabled(2, 4) == 0u) return 1u;
      writeDacC(byteValue);
      return 1u;
    case 0xf9:
      if (isPortGroupEnabled(2, 2) == 0u) return 1u;
      writeDacC(byteValue);
      return 1u;
    case 0x5f:
      if (isPortGroupEnabled(2, 1) == 0u && isPortGroupEnabled(2, 3) == 0u) return 1u;
      writeDacD(byteValue);
      return 1u;
    default:
      return 0u;
  }
}
