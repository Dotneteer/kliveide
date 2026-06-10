// ----------------------------------------------------------------------------
// Memory map and CPU bus memory access

static inline uint8_t readScreenMemoryOffset(uint32_t offset) {
  return sp48Memory[0x4000u + (offset & 0x3fffu)];
}

static uint8_t sp48CpuReadMemory(uint32_t address) {
  const uint16_t maskedAddress = (uint16_t)(address & 0xffffu);
  const uint8_t value = sp48Memory[maskedAddress];
  sp48LastMemoryAddress = maskedAddress;
  sp48LastMemoryValue = value;
  sp48LastMemoryIsWrite = 0u;
  sp48HasMemoryEvent = 1u;
  return value;
}

static void sp48CpuWriteMemory(uint32_t address, uint32_t value) {
  const uint16_t maskedAddress = (uint16_t)(address & 0xffffu);
  sp48LastMemoryAddress = maskedAddress;
  sp48LastMemoryValue = (uint8_t)value;
  sp48LastMemoryIsWrite = 1u;
  sp48HasMemoryEvent = 1u;
  if (maskedAddress >= 0x4000u) {
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
    sp48Memory[maskedAddress] = (uint8_t)value;
  }
}

uint32_t sp48ReadScreenMemoryOffset(uint32_t offset) {
  return readScreenMemoryOffset(offset);
}
