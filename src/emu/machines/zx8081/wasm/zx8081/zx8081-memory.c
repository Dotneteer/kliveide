/*
 * ZX80/ZX81 memory map. Ported from CLK `Machines/Sinclair/ZX8081/ZX8081.cpp` (MIT; Copyright (c)
 * 2015 Thomas Harte - the full notice is in zx8081.c and THIRD_PARTY_NOTICES.md).
 *
 * Below `zx8081RamBase` the ROM, mirrored to its size (8K ZX81 ROM: $0000 and $2000; 4K ZX80 ROM:
 * four times). From `zx8081RamBase` the RAM, masked to its size, so 1K and 16K mirror up to $FFFF -
 * the ROM's display routine runs the display file through its upper-32K echo. Writes below the RAM
 * are ignored.
 */

/* Set by Z80_BEFORE_OPCODE_FETCH: the next memory read is the opcode read of an unprefixed M1 */
static uint8_t zx8081M1Fetch;

/*
 * Whether the last opcode read of an unprefixed M1 was a NOP the ULA forced onto the bus: the
 * execution-history recorder merges those into runs (`Z80_HISTORY_FORCED_NOP`, zx8081.c). Written on
 * every such read, so it is never stale; debug bookkeeping, volatile.
 */
static uint8_t zx8081HistoryForcedNop;

/* The display byte the ULA latched at an M1 above 32K, waiting for the refresh that draws it */
static uint8_t zx8081LatchedVideoByte;
static uint8_t zx8081HasLatchedVideoByte;

static inline uint8_t zx8081PeekMemory(uint16_t address) {
  return address < zx8081RamBase ? zx8081Rom[address & zx8081RomMask] : zx8081Ram[address & zx8081RamMask];
}

static void zx8081BeforeM1(void) { zx8081M1Fetch = 1u; }

/*
 * The opcode read of an unprefixed M1. Above 32K (A15 set), from RAM, a byte with bit 6 clear is
 * latched for the video and the ULA puts $00 (NOP) on the data bus (CLK l.276). HALT ($76, bit 6 set)
 * runs as itself and ends a display line.
 *
 * This is done on the read, not in `Z80_AFTER_OPCODE_FETCH`: the shared core calls `Z80_REFRESH`
 * before that hook, and the refresh that follows this read is what draws the latched byte.
 *
 * Out of line: `zx8081CpuReadMemory` is inlined at every memory access of every opcode. While this
 * body was inlined too, the compiler could drop it after an instruction's first read only as long as
 * nothing opaque ran between the reads; the access profile's hook calls (`z80-profile.h`) are opaque,
 * and inlined it grew the core from 192 KB to 281 KB (`.plans/CODE_COVERAGE_AND_HEAT_MAP_PLAN.md` T10).
 */
static uint8_t ZX8081_NOINLINE zx8081CpuReadOpcode(uint16_t address) {
  uint8_t value = zx8081PeekMemory(address);
  zx8081M1Fetch = 0u;
  zx8081HistoryForcedNop = 0u;
  /*
   * The 64K model: an opcode fetch above 32K reads the lower 32K, as the RAM packs that keep the
   * display working do - the ROM runs the display file (below 32K) through its upper echo, which a
   * full 64K of RAM would otherwise not be. CLK's 64K map lacks this and shows no picture. Data
   * reads and writes see all 64K. Running code above 32K needs the "M1NOT" modification, which is
   * not modelled: on a stock ZX81 the ULA turns most of such code into NOPs.
   */
  if (zx8081RamSizeKb == 64u && (address & 0x8000u)) {
    value = zx8081Ram[address & 0x7fffu];
  }
  if ((address & 0x8000u) && address >= zx8081RamBase && !(value & 0x40u)) {
    zx8081LatchedVideoByte = value;
    zx8081HasLatchedVideoByte = 1u;
    zx8081HistoryForcedNop = 1u;
    value = 0x00u;
  }
  return value;
}

/* A memory read by the CPU: the opcode read of an M1 goes through the ULA (above) */
static uint8_t zx8081CpuReadMemory(uint16_t address) {
  if (zx8081M1Fetch) return zx8081CpuReadOpcode(address);
  return zx8081PeekMemory(address);
}

static void zx8081CpuWriteMemory(uint16_t address, uint8_t value) {
  if (address >= zx8081RamBase) {
    zx8081Ram[address & zx8081RamMask] = value;
  }
}

/* The IDE's writes: RAM as the CPU writes it, and the ROM too (the memory editor may patch it) */
static void zx8081PokeMemory(uint16_t address, uint8_t value) {
  if (address >= zx8081RamBase) {
    zx8081Ram[address & zx8081RamMask] = value;
  } else {
    zx8081Rom[address & zx8081RomMask] = value;
  }
}

/* Side-effect-free reads and writes for the IDE */
uint32_t zx8081ReadMemory(uint32_t address) { return zx8081PeekMemory((uint16_t)address); }
void zx8081WriteMemory(uint32_t address, uint32_t value) { zx8081PokeMemory((uint16_t)address, (uint8_t)value); }
uint32_t zx8081GetRamBase(void) { return zx8081RamBase; }
uint32_t zx8081GetRamSizeKb(void) { return zx8081RamSizeKb; }
