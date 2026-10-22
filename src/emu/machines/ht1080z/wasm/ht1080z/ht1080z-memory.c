/*
 * The HT-1080Z memory map (HARDWARE.md §3; `.plans/HT1080Z_PLAN.md` §3):
 *
 *   0000-2FFF  Level II BASIC ROM (12K)
 *   3000-37FF  the extension EPROM (2K window)
 *   3800-3BFF  the keyboard matrix: A0-A7 select rows, the selected rows ORed (3900-3BFF mirror it)
 *   3C00-3FFF  video RAM, 1K x 8 (D10: all eight bits are stored on every model)
 *   4000-7FFF  RAM (16K), or 4000-FFFF (48K on the /64)
 *
 * Reads above a 16K machine's RAM return FFh (HARDWARE.md §3.5: undocumented, a floating bus that
 * the ROM's MEMORY SIZE probe sees as no RAM). Writes to the ROMs, the keyboard and the empty space
 * are ignored.
 */

static inline uint8_t htPeekMemory(uint16_t address) {
  if (address < HT_KEYBOARD_START) return htMemory[address];
  if (address < HT_VIDEO_RAM_START) return htReadKeyboard(address);
  if ((uint32_t)address >= htRamEnd) return 0xffu;
  return htMemory[address];
}

static uint8_t htCpuReadMemory(uint16_t address) { return htPeekMemory(address); }

static void htCpuWriteMemory(uint16_t address, uint8_t value) {
  if (address >= HT_VIDEO_RAM_START && (uint32_t)address < htRamEnd) {
    htMemory[address] = value;
  }
}

/* The IDE's writes: RAM as the CPU writes it, and the ROMs too (the memory editor may patch them) */
static void htPokeMemory(uint16_t address, uint8_t value) {
  if (address < HT_KEYBOARD_START) {
    htMemory[address] = value;
  } else {
    htCpuWriteMemory(address, value);
  }
}

/* Side-effect-free reads and writes for the IDE */
uint32_t ht1080zReadMemory(uint32_t address) { return htPeekMemory((uint16_t)address); }
void ht1080zWriteMemory(uint32_t address, uint32_t value) { htPokeMemory((uint16_t)address, (uint8_t)value); }
uint32_t ht1080zGetRamSizeKb(void) { return htRamSizeKb; }
