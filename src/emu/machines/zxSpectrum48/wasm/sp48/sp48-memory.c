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

#ifdef SP48_SCLD
// ----------------------------------------------------------------------------
// The Timex 2068 memory map (`.plans/TIMEX_SCORPION_PLAN.md` G9.4b; TS2068 Technical Manual
// 2.1.8.1, 2.1.13.5). `sp48Memory` is the HOME bank: the 16K HOME ROM, then 48K of RAM, which the
// SCLD's display reads whatever the CPU sees. Each 8K chunk the CPU addresses comes from HOME, or -
// when its bit in port $F4 is set - from the DOCK (port $FF bit 7 clear) or the EXROM bank (set).
// The 8K EXROM answers in every chunk of its bank; a DOCK chunk the cartridge does not populate,
// and the EXROM bank with no EXROM, read $FF and ignore writes. The TC2048 always maps HOME.

#define TIMEX_CHUNK_HOME 0u
#define TIMEX_CHUNK_DOCK 1u
#define TIMEX_CHUNK_EXROM 2u
#define TIMEX_CHUNK_NONE 3u

static void timexRebuildChunkMap(void) {
  if (sp48TimexOpenBus[0] != 0xffu) {
    for (uint32_t i = 0u; i < 0x2000u; i++) sp48TimexOpenBus[i] = 0xffu;
  }
  const uint8_t exromBank = (sp48ScldPortFf & 0x80u) != 0u ? 1u : 0u;
  for (uint32_t chunk = 0u; chunk < 8u; chunk++) {
    const uint8_t external = sp48TimexChunked != 0u && (sp48TimexPortF4 & (1u << chunk)) != 0u;
    if (!external) {
      sp48TimexChunkBase[chunk] = &sp48Memory[chunk * 0x2000u];
      sp48TimexChunkWritable[chunk] = chunk >= 2u ? 1u : 0u;
      sp48TimexChunkSource[chunk] = TIMEX_CHUNK_HOME;
    } else if (exromBank != 0u) {
      sp48TimexChunkBase[chunk] = sp48TimexExromLoaded != 0u ? sp48TimexExrom : sp48TimexOpenBus;
      sp48TimexChunkWritable[chunk] = 0u;
      sp48TimexChunkSource[chunk] = sp48TimexExromLoaded != 0u ? TIMEX_CHUNK_EXROM : TIMEX_CHUNK_NONE;
    } else {
      const uint8_t type = sp48TimexDockChunkType[chunk];
      const uint8_t present = (type & 0x03u) != 0u;
      sp48TimexChunkBase[chunk] = present ? &sp48TimexDock[chunk * 0x2000u] : sp48TimexOpenBus;
      sp48TimexChunkWritable[chunk] = present && (type & 0x01u) != 0u ? 1u : 0u;
      sp48TimexChunkSource[chunk] = present ? TIMEX_CHUNK_DOCK : TIMEX_CHUNK_NONE;
    }
  }
  sp48TimexChunkMapValid = 1u;
}

static inline uint8_t sp48CpuReadMemory(uint32_t address) {
  if (sp48TimexChunkMapValid == 0u) timexRebuildChunkMap();
  const uint32_t a = address & 0xffffu;
  return sp48TimexChunkBase[a >> 13u][a & 0x1fffu];
}

static void timexWriteMapped(uint32_t address, uint32_t value) {
  if (sp48TimexChunkMapValid == 0u) timexRebuildChunkMap();
  const uint32_t a = address & 0xffffu;
  const uint32_t chunk = a >> 13u;
  if (sp48TimexChunkWritable[chunk] == 0u) {
    return;
  }
  if (sp48TimexChunkSource[chunk] == TIMEX_CHUNK_HOME && a < SP48_DISPLAY_MEMORY_END) {
    renderUlaUntilCurrentTact();
  }
  sp48TimexChunkBase[chunk][a & 0x1fffu] = (uint8_t)value;
}

static void sp48CpuWriteMemory(uint32_t address, uint32_t value) {
  timexWriteMapped(address, value);
}

/* The SCLD stops the CPU only for the display RAM: HOME chunks 2 and 3 */
#define SP48_CONTENDED_MEMORY(address) \
  (((address) & 0xc000u) == 0x4000u && sp48TimexChunkSource[((address) >> 13u) & 0x07u] == TIMEX_CHUNK_HOME)

#else

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

#define SP48_CONTENDED_MEMORY(address) (((address) & 0xc000u) == 0x4000u)

#endif

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

#ifdef SP48_SCLD
/* What the CPU reads at an address (the IDE's view) */
uint32_t sp48ReadMemory(uint32_t address) {
  return sp48CpuReadMemory(address);
}

/* Writes as the CPU would: ROM and unpopulated chunks ignore it */
void sp48WriteMemory(uint32_t address, uint32_t value) {
  sp48CpuWriteMemory(address, value);
}
#else
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
#endif

uint32_t sp48ReadScreenMemoryOffset(uint32_t offset) {
  return readScreenMemoryOffset(offset);
}
