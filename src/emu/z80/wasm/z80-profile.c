/*
 * The access profile: per physical byte, whether it was executed, fetched as code, read, written or
 * self-modified, and - in a pool of 8K pages allocated on first touch - how often, and how much time
 * the instructions starting there took (`.plans/CODE_COVERAGE_AND_HEAT_MAP_PLAN.md` §4.1, D1-D10).
 *
 * One file for every Z80 core. The core includes `z80-profile.h` before `z80.c` (which turns the
 * CPU's profile hooks on) and this file after everything its machine macros use, after defining:
 *
 * - `Z80_PROFILE_FLAG_BYTES`: the core's physical span - every ROM and RAM byte, laid out as one
 *   linear *profile offset* space (§2.2); the TypeScript side names the partitions in it
 *   (`src/common/profile/layouts/`);
 * - `Z80_PROFILE_POOL_PAGES`: how many 8K pages can have counters (D5);
 * - `Z80_PROFILE_PHYS_READ(address)` and `Z80_PROFILE_PHYS_WRITE(address)`: the profile offset a
 *   CPU read (or fetch) and a CPU write of `address` reach through the current mapping, or -1 when
 *   nothing backs it (a write to ROM, an empty slot, the Next's floating page). Reads and writes map
 *   apart (trap T2);
 * - `Z80_PROFILE_FRAME_TICKS()`: a counter in the core's time unit (D8) - CPU T-states, or the
 *   Next's 28 MHz ticks - whose 32-bit differences are durations;
 * - optionally `Z80_PROFILE_MUTED()`: nonzero while the hooks must not count. By default, while the
 *   history recorder verifies a replay (D10, trap T4).
 *
 * The flags and the pool are volatile statics (traps T4, T7): neither a state file nor a keyframe
 * carries them, so a replay must not add to them - hence the muting.
 */

#ifndef Z80_PROFILE_FLAG_BYTES
#error "Z80_PROFILE_FLAG_BYTES must be defined before including z80-profile.c"
#endif
#ifndef Z80_PROFILE_POOL_PAGES
#error "Z80_PROFILE_POOL_PAGES must be defined before including z80-profile.c"
#endif

#ifndef Z80_PROFILE_MUTED
#ifdef Z80_HISTORY_H
#define Z80_PROFILE_MUTED() (z80HistoryHeader.verifyState != 0u)
#else
#define Z80_PROFILE_MUTED() 0
#endif
#endif

#define Z80_PROFILE_MAGIC 0x4652504bu /* "KPRF" */
#define Z80_PROFILE_VERSION 1u
#define Z80_PROFILE_PAGE_SHIFT 13u
#define Z80_PROFILE_PAGE_SIZE 0x2000u
#define Z80_PROFILE_PAGE_MASK 0x1fffu
#define Z80_PROFILE_PAGE_COUNT (((uint32_t)(Z80_PROFILE_FLAG_BYTES) + Z80_PROFILE_PAGE_MASK) >> Z80_PROFILE_PAGE_SHIFT)
#define Z80_PROFILE_NONE 0xffffffffu
/* A page map entry for a page that wanted counters when the pool was full */
#define Z80_PROFILE_PAGE_DROPPED 0xffffu
/* A span longer than this is a counter rebase between BEGIN and END, not an instruction */
#define Z80_PROFILE_MAX_SPAN 0x10000000u

/* One counter entry, 24 bytes, little-endian: the struct is the wire format (`WasmProfileReader.ts`) */
typedef struct Z80ProfileEntry {
  uint32_t exec; /* 0: instruction starts */
  uint32_t read; /* 4: data reads */
  uint32_t write; /* 8: data writes */
  uint32_t pad; /* 12 */
  uint64_t time; /* 16: the time of the instructions that started here (D7, D8) */
} Z80ProfileEntry;

_Static_assert(sizeof(Z80ProfileEntry) == 24, "a profile entry is 24 bytes");
_Static_assert(sizeof(Z80ProfileHeader) == 128, "the profile header is 128 bytes");
_Static_assert(Z80_PROFILE_POOL_PAGES < Z80_PROFILE_PAGE_DROPPED, "the pool's slot numbers fit the page map");

static uint8_t z80ProfileFlags[Z80_PROFILE_PAGE_COUNT * Z80_PROFILE_PAGE_SIZE] __attribute__((aligned(16)));
/* Per 8K page: its pool slot + 1, 0 when it has no counters, Z80_PROFILE_PAGE_DROPPED when the pool was full */
static uint16_t z80ProfilePageMap[Z80_PROFILE_PAGE_COUNT] __attribute__((aligned(16)));
static Z80ProfileEntry z80ProfilePool[Z80_PROFILE_POOL_PAGES][Z80_PROFILE_PAGE_SIZE] __attribute__((aligned(16)));

static void z80ProfileEnsureHeader(void) {
  if (z80ProfileHeader.magic == Z80_PROFILE_MAGIC) return;
  z80ProfileHeader.magic = Z80_PROFILE_MAGIC;
  z80ProfileHeader.version = Z80_PROFILE_VERSION;
  z80ProfileHeader.entrySize = (uint16_t)sizeof(Z80ProfileEntry);
  z80ProfileHeader.flagBytes = (uint32_t)(Z80_PROFILE_FLAG_BYTES);
  z80ProfileHeader.poolPages = (uint32_t)(Z80_PROFILE_POOL_PAGES);
  z80ProfileHeader.firstDroppedPage = Z80_PROFILE_NONE;
  z80ProfileHeader.openPhys = Z80_PROFILE_NONE;
  z80ProfileHeader.flagsOffset = (uint32_t)(uintptr_t)z80ProfileFlags;
  z80ProfileHeader.pageMapOffset = (uint32_t)(uintptr_t)z80ProfilePageMap;
  z80ProfileHeader.poolOffset = (uint32_t)(uintptr_t)z80ProfilePool;
  z80ProfileHeader.pageMapEntries = Z80_PROFILE_PAGE_COUNT;
}

/* Nonzero (and the header says so) while a replay runs; a load and a compare otherwise (T10) */
Z80_ALWAYS_INLINE uint32_t z80ProfileIsMuted(void) {
  if (Z80_PROFILE_MUTED()) {
    z80ProfileHeader.muted = 1u;
    return 1u;
  }
  if (z80ProfileHeader.muted) z80ProfileHeader.muted = 0u;
  return 0u;
}

/* The counter entry of a profile offset, allocating its page on first touch; 0 without counters */
static Z80ProfileEntry *z80ProfileEntryOf(uint32_t phys) {
  if (z80ProfileHeader.countersOn == 0u) return 0;
  const uint32_t page = phys >> Z80_PROFILE_PAGE_SHIFT;
  uint32_t slot = z80ProfilePageMap[page];
  if (slot == 0u) {
    if (z80ProfileHeader.pagesUsed >= (uint32_t)(Z80_PROFILE_POOL_PAGES)) {
      z80ProfilePageMap[page] = (uint16_t)Z80_PROFILE_PAGE_DROPPED;
      if (z80ProfileHeader.pagesDropped == 0u) z80ProfileHeader.firstDroppedPage = page;
      z80ProfileHeader.pagesDropped++;
      return 0;
    }
    slot = ++z80ProfileHeader.pagesUsed;
    z80ProfilePageMap[page] = (uint16_t)slot;
  } else if (slot == Z80_PROFILE_PAGE_DROPPED) {
    return 0;
  }
  return &z80ProfilePool[slot - 1u][phys & Z80_PROFILE_PAGE_MASK];
}

Z80_ALWAYS_INLINE void z80ProfileCountUp(uint32_t *counter) {
  if (*counter != 0xffffffffu) (*counter)++;
}

/* A profile offset, or Z80_PROFILE_NONE when the mapping says nothing backs the address */
Z80_ALWAYS_INLINE uint32_t z80ProfilePhys(int32_t phys) {
  return phys < 0 || (uint32_t)phys >= (uint32_t)(Z80_PROFILE_FLAG_BYTES) ? Z80_PROFILE_NONE : (uint32_t)phys;
}

/*
 * A code fetch (D3, D9): the byte is code; at the M1 of an instruction's first byte it is also an
 * instruction start, counted, and the instruction's span opens (D7) - its start address through the
 * read mapping, and the time before its M1 cycle. A fetch from a byte the program wrote marks it
 * self-modified.
 */
static void z80ProfileFetch(uint32_t address, uint32_t m1) {
  if (z80ProfileIsMuted()) {
    if (m1 != 0u) z80ProfileHeader.openPhys = Z80_PROFILE_NONE;
    return;
  }
  const uint32_t phys = z80ProfilePhys((int32_t)(Z80_PROFILE_PHYS_READ(address & 0xffffu)));
  if (m1 != 0u) {
    z80ProfileHeader.openPhys = phys;
    z80ProfileHeader.openTicks = (uint32_t)(Z80_PROFILE_FRAME_TICKS());
  }
  if (phys == Z80_PROFILE_NONE) return;
  uint8_t flags = z80ProfileFlags[phys];
  flags |= (uint8_t)Z80_PF_C;
  if ((flags & Z80_PF_W) != 0u) flags |= (uint8_t)Z80_PF_S;
  if (m1 != 0u) {
    flags |= (uint8_t)Z80_PF_E;
    if (cpu.interruptDepth != 0u) flags |= (uint8_t)Z80_PF_X;
    z80ProfileHeader.instructions++;
    Z80ProfileEntry *entry = z80ProfileEntryOf(phys);
    if (entry) z80ProfileCountUp(&entry->exec);
  }
  z80ProfileFlags[phys] = flags;
}

static void z80ProfileRead(uint32_t address) {
  if (z80ProfileIsMuted()) return;
  const uint32_t phys = z80ProfilePhys((int32_t)(Z80_PROFILE_PHYS_READ(address & 0xffffu)));
  if (phys == Z80_PROFILE_NONE) return;
  z80ProfileFlags[phys] |= (uint8_t)Z80_PF_R;
  Z80ProfileEntry *entry = z80ProfileEntryOf(phys);
  if (entry) z80ProfileCountUp(&entry->read);
}

/* A data write (D9): a write to a byte already fetched as code marks it self-modified */
static void z80ProfileWrite(uint32_t address) {
  if (z80ProfileIsMuted()) return;
  const uint32_t phys = z80ProfilePhys((int32_t)(Z80_PROFILE_PHYS_WRITE(address & 0xffffu)));
  if (phys == Z80_PROFILE_NONE) return;
  uint8_t flags = z80ProfileFlags[phys];
  flags |= (uint8_t)Z80_PF_W;
  if ((flags & Z80_PF_C) != 0u) flags |= (uint8_t)Z80_PF_S;
  z80ProfileFlags[phys] = flags;
  Z80ProfileEntry *entry = z80ProfileEntryOf(phys);
  if (entry) z80ProfileCountUp(&entry->write);
}

/* The ticks since the last mark or BEGIN; 0 for a span that crossed a counter rebase */
Z80_ALWAYS_INLINE uint32_t z80ProfileSpan(void) {
  const uint32_t span = (uint32_t)(Z80_PROFILE_FRAME_TICKS()) - z80ProfileHeader.openTicks;
  return span > Z80_PROFILE_MAX_SPAN ? 0u : span;
}

/* D7: the instruction completed (no prefix pending): its time goes to its start address */
static void z80ProfileEnd(void) {
  const uint32_t phys = z80ProfileHeader.openPhys;
  if (phys == Z80_PROFILE_NONE) return;
  z80ProfileHeader.openPhys = Z80_PROFILE_NONE;
  if (z80ProfileIsMuted()) return;
  const uint32_t span = z80ProfileSpan();
  z80ProfileHeader.timeTotal += span;
  Z80ProfileEntry *entry = z80ProfileEntryOf(phys);
  if (entry) entry->time += span;
}

/* Starts timing an interrupt acknowledge or a HALTed cycle */
static void z80ProfileMark(void) {
  z80ProfileHeader.openTicks = (uint32_t)(Z80_PROFILE_FRAME_TICKS());
}

/* An interrupt acknowledge is not charged to an address (D7) */
static void z80ProfileAckEnd(uint32_t nmi) {
  if (z80ProfileIsMuted()) return;
  const uint32_t span = z80ProfileSpan();
  if (nmi) {
    z80ProfileHeader.timeNmiAck += span;
  } else {
    z80ProfileHeader.timeIntAck += span;
  }
  z80ProfileHeader.timeTotal += span;
}

/* A HALTed cycle is charged to the HALT's address, and summed apart as idle time (D7) */
static void z80ProfileHaltEnd(void) {
  if (z80ProfileIsMuted()) return;
  const uint32_t span = z80ProfileSpan();
  z80ProfileHeader.timeHalt += span;
  z80ProfileHeader.timeTotal += span;
  const uint32_t phys = z80ProfilePhys((int32_t)(Z80_PROFILE_PHYS_READ(cpu.pc)));
  if (phys == Z80_PROFILE_NONE) return;
  Z80ProfileEntry *entry = z80ProfileEntryOf(phys);
  if (entry) entry->time += span;
}

/*
 * Time a core spends outside the CPU (the Next's DMA holding the bus, the Z88's snooze): a header
 * bucket, never an address (D7, trap T5). A hold that falls inside an instruction still open (between
 * the cycles of a prefixed one) moves its start along, so the instruction is not charged for it.
 */
static void z80ProfileChargeBucket(uint32_t bucket, uint32_t ticks) {
  if (z80ProfileHeader.enabled == 0u || z80ProfileIsMuted()) return;
  if (bucket == Z80_PROFILE_BUCKET_DMA) {
    z80ProfileHeader.timeDma += ticks;
  } else {
    z80ProfileHeader.timeSnooze += ticks;
  }
  z80ProfileHeader.timeTotal += ticks;
  if (z80ProfileHeader.openPhys != Z80_PROFILE_NONE) z80ProfileHeader.openTicks += ticks;
}

// -----------------------------------------------------------------------------
// Exports (`scripts/z80-profile-exports.cjs`): the same names in every core
// -----------------------------------------------------------------------------

/* Where the header is; the header says where the flags, the page map and the pool are */
uint32_t z80ProfileGetHeaderOffset(void) {
  z80ProfileEnsureHeader();
  return (uint32_t)(uintptr_t)&z80ProfileHeader;
}

uint32_t z80ProfileGetFlagsOffset(void) {
  z80ProfileEnsureHeader();
  return z80ProfileHeader.flagsOffset;
}

uint32_t z80ProfileGetPageMapOffset(void) {
  z80ProfileEnsureHeader();
  return z80ProfileHeader.pageMapOffset;
}

uint32_t z80ProfileGetPoolOffset(void) {
  z80ProfileEnsureHeader();
  return z80ProfileHeader.poolOffset;
}

/* Turns profiling on or off; `counters` keeps the counter pool as well as the flags (D2, T10) */
void z80ProfileSetEnabled(uint32_t on, uint32_t counters) {
  z80ProfileEnsureHeader();
  z80ProfileHeader.enabled = on ? 1u : 0u;
  z80ProfileHeader.countersOn = counters ? 1u : 0u;
  z80ProfileHeader.openPhys = Z80_PROFILE_NONE;
}

/* Clears every flag, counter and time bucket; the generation moves on */
void z80ProfileReset(void) {
  z80ProfileEnsureHeader();
  for (uint32_t i = 0u; i < Z80_PROFILE_PAGE_COUNT * Z80_PROFILE_PAGE_SIZE; i++) z80ProfileFlags[i] = 0u;
  for (uint32_t page = 0u; page < Z80_PROFILE_PAGE_COUNT; page++) z80ProfilePageMap[page] = 0u;
  /* Only the slots handed out hold counts */
  for (uint32_t slot = 0u; slot < z80ProfileHeader.pagesUsed; slot++) {
    Z80ProfileEntry *entries = z80ProfilePool[slot];
    for (uint32_t i = 0u; i < Z80_PROFILE_PAGE_SIZE; i++) {
      entries[i].exec = 0u;
      entries[i].read = 0u;
      entries[i].write = 0u;
      entries[i].pad = 0u;
      entries[i].time = 0u;
    }
  }
  z80ProfileHeader.pagesUsed = 0u;
  z80ProfileHeader.pagesDropped = 0u;
  z80ProfileHeader.firstDroppedPage = Z80_PROFILE_NONE;
  z80ProfileHeader.timeIntAck = 0u;
  z80ProfileHeader.timeNmiAck = 0u;
  z80ProfileHeader.timeDma = 0u;
  z80ProfileHeader.timeSnooze = 0u;
  z80ProfileHeader.timeHalt = 0u;
  z80ProfileHeader.timeTotal = 0u;
  z80ProfileHeader.instructions = 0u;
  z80ProfileHeader.openPhys = Z80_PROFILE_NONE;
  z80ProfileHeader.generation++;
}

/*
 * Adds a saved run's byte to the profile (D16: `coverage load` merges `.kcov` files, and G5.5's
 * per-test runs merge the same way): the flags are OR-ed in, the counters added (saturating), the
 * time added. A page the pool cannot take keeps the flags only, as a live run's would (T6).
 */
void z80ProfileMergeByte(uint32_t phys, uint32_t flags, uint32_t exec, uint32_t read, uint32_t write, uint32_t timeLo,
                         uint32_t timeHi) {
  z80ProfileEnsureHeader();
  if (phys >= (uint32_t)(Z80_PROFILE_FLAG_BYTES)) return;
  z80ProfileFlags[phys] |= (uint8_t)flags;
  if ((exec | read | write | timeLo | timeHi) == 0u) return;
  /* Counters are kept for a merge whatever the live switch says: the file has them */
  const uint8_t countersOn = z80ProfileHeader.countersOn;
  z80ProfileHeader.countersOn = 1u;
  Z80ProfileEntry *entry = z80ProfileEntryOf(phys);
  z80ProfileHeader.countersOn = countersOn;
  if (!entry) return;
  entry->exec = entry->exec + exec < entry->exec ? 0xffffffffu : entry->exec + exec;
  entry->read = entry->read + read < entry->read ? 0xffffffffu : entry->read + read;
  entry->write = entry->write + write < entry->write ? 0xffffffffu : entry->write + write;
  entry->time += ((uint64_t)timeHi << 32) | timeLo;
}

/* After a merge: the header's totals and the generation, which the IDE refreshes on */
void z80ProfileMergeTotals(uint32_t instructionsLo, uint32_t instructionsHi, uint32_t timeLo, uint32_t timeHi) {
  z80ProfileEnsureHeader();
  z80ProfileHeader.instructions += ((uint64_t)instructionsHi << 32) | instructionsLo;
  z80ProfileHeader.timeTotal += ((uint64_t)timeHi << 32) | timeLo;
  z80ProfileHeader.generation++;
}
