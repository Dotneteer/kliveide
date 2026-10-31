/*
 * The Enterprise memory map (plan §5; DAVE_MEMORY_IO.md §2).
 *
 * DAVE's four page registers B0h-B3h (read/write) give the segment each 16K page of the CPU shows:
 * physical address = segment * 4000h + A13-A0, a 4 MB space of 256 segments. Reset clears them, so
 * the Z80 starts in EXOS segment 0.
 *
 *   00h-01h  EXOS                     02h-03h  unmapped on a 32K EXOS (plan Q11)
 *   04h      the cartridge (IS-BASIC) 05h-07h  unmapped
 *   10h      Klive's FILE: ROM        20h-21h  EXDOS
 *   F8h-FBh  RAM on the Enterprise 128
 *   FCh-FFh  RAM, the video RAM: NICK sees it as its 64K (FCh = NICK 0000h, ... FFh = C000h)
 *
 * Every other segment reads FFh and ignores writes (the emulators' value; the real bus floats).
 *
 * BFh bit 0 ("16K on-board RAM", never sold): only FFh counts as video RAM for the CPU's timing.
 *
 * The map is a segment table (physical offset, or the FFh segment) and, per CPU page, its physical
 * base, whether it is writable and whether it is video RAM, rebuilt on every B0h-B3h and BFh write.
 */

#define EP_ROM_CART 0x01u
#define EP_ROM_FILEIO 0x02u
#define EP_ROM_EXDOS 0x04u

/* The ROMs present (`epConfigure`) */
static uint8_t epRomMask = EP_ROM_CART;

/* Every segment's physical offset in `epMemory` (EP_PHYS_UNMAPPED: reads FFh), and whether it is RAM */
static uint32_t epSegmentBase[256];
static uint8_t epSegmentIsRam[256];

static uint8_t epPageReg[4];
static uint32_t epPageBase[4];
/* Bit n: page n is writable / video RAM (NICK's clock stretch, ep-timing.c) */
static uint8_t epPageWritable;
static uint8_t epPageVideo;

/* Defined in ep-dave.c: BFh as last written */
static uint8_t epDaveBf;

static void epBuildSegmentMap(void) {
  for (uint32_t s = 0u; s < 256u; s++) {
    epSegmentBase[s] = EP_PHYS_UNMAPPED;
    epSegmentIsRam[s] = 0u;
  }
  epSegmentBase[0x00] = EP_PHYS_EXOS;
  epSegmentBase[0x01] = EP_PHYS_EXOS + EP_SEG_SIZE;
  if (epRomMask & EP_ROM_CART) epSegmentBase[0x04] = EP_PHYS_CART;
  if (epRomMask & EP_ROM_FILEIO) epSegmentBase[0x10] = EP_PHYS_FILEIO;
  if (epRomMask & EP_ROM_EXDOS) {
    epSegmentBase[0x20] = EP_PHYS_EXDOS;
    epSegmentBase[0x21] = EP_PHYS_EXDOS + EP_SEG_SIZE;
  }
  for (uint32_t s = epIs128 ? 0xf8u : 0xfcu; s < 256u; s++) {
    epSegmentBase[s] = EP_PHYS_RAM + (s - 0xf8u) * EP_SEG_SIZE;
    epSegmentIsRam[s] = 1u;
  }
}

/* Whether a segment is video RAM for the CPU's timing: FCh-FFh, or only FFh with BFh bit 0 set */
static inline uint8_t epSegmentIsVideo(uint8_t segment) {
  return (epDaveBf & 0x01u) ? segment == 0xffu : segment >= 0xfcu;
}

static void epRemap(void) {
  epPageWritable = 0u;
  epPageVideo = 0u;
  for (uint32_t page = 0u; page < 4u; page++) {
    const uint8_t segment = epPageReg[page];
    epPageBase[page] = epSegmentBase[segment];
    if (epSegmentIsRam[segment]) epPageWritable |= (uint8_t)(1u << page);
    if (epSegmentIsVideo(segment)) epPageVideo |= (uint8_t)(1u << page);
  }
}

static void epResetMemoryMap(void) {
  for (uint32_t page = 0u; page < 4u; page++) epPageReg[page] = 0u;
  epRemap();
}

static inline uint32_t epPhysicalAddress(uint16_t address) {
  return epPageBase[address >> 14] + (address & 0x3fffu);
}

static inline uint8_t epPeekMemory(uint16_t address) { return epMemory[epPhysicalAddress(address)]; }

static uint8_t epCpuReadMemory(uint16_t address) { return epPeekMemory(address); }

static void epCpuWriteMemory(uint16_t address, uint8_t value) {
  if (epPageWritable & (1u << (address >> 14))) epMemory[epPhysicalAddress(address)] = value;
}

/* The IDE's writes: RAM as the CPU writes it, and the ROMs too (the memory editor may patch them) */
static void epPokeMemory(uint16_t address, uint8_t value) {
  const uint32_t phys = epPhysicalAddress(address);
  if (phys < EP_PHYS_UNMAPPED) epMemory[phys] = value;
}

/* Side-effect-free reads and writes for the IDE */
uint32_t epReadMemory(uint32_t address) { return epPeekMemory((uint16_t)address); }
void epWriteMemory(uint32_t address, uint32_t value) { epPokeMemory((uint16_t)address, (uint8_t)value); }
/* The physical offset of a CPU address in the core's memory */
uint32_t epGetPhysicalAddress(uint32_t address) { return epPhysicalAddress((uint16_t)address); }
/* A segment's physical offset in the core's memory (EP_PHYS_UNMAPPED for an empty one) */
uint32_t epGetSegmentBase(uint32_t segment) { return epSegmentBase[segment & 0xffu]; }
uint32_t epGetPageRegister(uint32_t page) { return epPageReg[page & 3u]; }
uint32_t epGetIs128(void) { return epIs128; }
/* A byte of the physical 4 MB space (segment * 4000h + offset), FFh where nothing is fitted */
uint32_t epReadPhysical(uint32_t address) {
  return epMemory[epSegmentBase[(address >> 14) & 0xffu] + (address & 0x3fffu)];
}
/* Writes a byte of the physical space where RAM is fitted (the host's FILE: device writes user memory) */
void epWritePhysical(uint32_t address, uint32_t value) {
  const uint32_t segment = (address >> 14) & 0xffu;
  if (epSegmentIsRam[segment]) epMemory[epSegmentBase[segment] + (address & 0x3fffu)] = (uint8_t)value;
}
