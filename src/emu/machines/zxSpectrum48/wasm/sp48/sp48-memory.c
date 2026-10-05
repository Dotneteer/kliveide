// ----------------------------------------------------------------------------
// Memory map and CPU bus memory access

/*
 * Writes below this address can change the picture, so the renderer catches up first. The Timex
 * SCLD also shows the second display file ($6000-$7AFF).
 */
#ifdef SP48_SCLD
#define SP48_DISPLAY_MEMORY_END 0x7b00u
#else
#define SP48_DISPLAY_MEMORY_END 0x5b00u
#endif

static inline uint8_t readScreenMemoryOffset(uint32_t offset) {
  return sp48Memory[0x4000u + (offset & 0x3fffu)];
}

static uint8_t sp48CpuReadMemory(uint32_t address) {
  const uint16_t maskedAddress = (uint16_t)(address & 0xffffu);
  return sp48Memory[maskedAddress];
}

static void sp48CpuWriteMemory(uint32_t address, uint32_t value) {
  const uint16_t maskedAddress = (uint16_t)(address & 0xffffu);
  if (maskedAddress >= 0x4000u) {
    if (maskedAddress < SP48_DISPLAY_MEMORY_END) {
      renderUlaUntilCurrentTact();
    }
    sp48Memory[maskedAddress] = (uint8_t)value;
  }
}

static void clearRam(uint32_t is16k) {
  for (uint32_t i = 0x4000u; i < SP48_MEMORY_SIZE; i++) {
    sp48Memory[i] = is16k != 0u && i >= 0x8000u ? 0xffu : 0u;
  }
}

void sp48UploadRomByte(uint32_t offset, uint32_t value) {
  if (offset < 0x4000u) {
    sp48Memory[offset] = (uint8_t)value;
    if (offset == 0u) {
      sp48RomUploadCount = 0u;
      sp48RomChecksum = 0u;
    }
    sp48RomUploadCount++;
    sp48RomChecksum = ((sp48RomChecksum << 5u) | (sp48RomChecksum >> 27u)) ^ ((uint8_t)value + offset);
  }
}

uint32_t sp48ReadMemory(uint32_t address) {
  return sp48Memory[address & 0xffffu];
}

void sp48WriteMemory(uint32_t address, uint32_t value) {
  const uint32_t maskedAddress = address & 0xffffu;
  if (maskedAddress >= 0x4000u) {
    if (maskedAddress < SP48_DISPLAY_MEMORY_END) {
      renderUlaUntilCurrentTact();
    }
    sp48Memory[maskedAddress] = (uint8_t)value;
  }
}

uint32_t sp48ReadScreenMemoryOffset(uint32_t offset) {
  return readScreenMemoryOffset(offset);
}
