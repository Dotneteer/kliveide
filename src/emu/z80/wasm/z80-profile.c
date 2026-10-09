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
#define Z80_PROFILE_VERSION 2u
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
_Static_assert(sizeof(Z80ProfileHeader) == 192, "the profile header is 192 bytes");

/*
 * The call tracker (`.plans/PROFILER_PLAN.md` §4.2, D9-D12): a shadow stack of open calls and a
 * table of call edges, aggregated here so it never allocates and a CALL/RET costs a hash and an add.
 *
 * Keys are profile offsets (T3: one logical address in two banks is two routines). A caller key
 * above the profile span names a root: the code that ran before any tracked call (T5), or an
 * interrupt (D11), which is a root of its own.
 */
#define Z80_PROFILE_STACK_DEPTH 256u
#define Z80_PROFILE_EDGE_SLOTS 16384u
/* Edges stop being added once this many slots hold one: linear probing stays short */
#define Z80_PROFILE_EDGE_LIMIT (Z80_PROFILE_EDGE_SLOTS - Z80_PROFILE_EDGE_SLOTS / 8u)
/* A push this far below the open frame's slot, or a RET this far above it, is a stack switch (D10) */
#define Z80_PROFILE_RESYNC_DISTANCE 512u

#define Z80_PROFILE_KEY_ROOT 0xffffffffu /* the code outside every tracked call (T5) */
#define Z80_PROFILE_KEY_INT 0xfffffffeu /* the maskable interrupt's root (D11) */
#define Z80_PROFILE_KEY_NMI 0xfffffffdu /* the NMI's root */
#define Z80_PROFILE_KEY_OTHER 0xfffffffcu /* edge slot 0: calls that found the table full (D12) */
/* A callee nothing backs (an empty slot, the Next's floating page): its address, tagged */
#define Z80_PROFILE_KEY_UNMAPPED 0x40000000u

/* The kind of the event that first made an edge (`Z80ProfileEdge.kind`) */
#define Z80_PROFILE_KIND_CALL 1u
#define Z80_PROFILE_KIND_RST 2u
#define Z80_PROFILE_KIND_INT 3u /* IM 0 or IM 1 */
#define Z80_PROFILE_KIND_INT_IM2 4u
#define Z80_PROFILE_KIND_NMI 5u

/* One open call, 48 bytes: the reader folds the open frames into the edges it reports */
typedef struct Z80ProfileFrame {
  uint32_t calleePhys; /* 0: the callee's entry, a profile offset (or a tagged address) */
  uint32_t edge; /* 4: its edge slot */
  uint64_t start; /* 8: the clock (`timeTotal`) when the callee started */
  uint64_t child; /* 16: the inclusive time of the calls it made that returned */
  uint64_t excluded; /* 24: interrupt time inside it, which is not its time (D11) */
  uint16_t calleeAddr; /* 32: the callee's CPU address */
  uint16_t slotSp; /* 34: SP after the push: where its return address is */
  uint8_t isInt; /* 36: an interrupt's frame */
  uint8_t nested; /* 37: the callee was already open below: no inclusive time (D12, recursion) */
  uint16_t pad; /* 38 */
  uint32_t lastCallee; /* 40: the last callee it called, and that edge: a hot pair costs a compare (T8) */
  uint32_t lastEdge; /* 44 */
} Z80ProfileFrame;

/* One call edge, 32 bytes: the struct is the wire format (`WasmProfileReader.ts`) */
typedef struct Z80ProfileEdge {
  uint32_t callerPhys; /* 0: the caller's entry, or a root key */
  uint32_t calleePhys; /* 4 */
  uint32_t calls; /* 8: 0 for an empty slot */
  uint16_t calleeAddr; /* 12 */
  uint8_t kind; /* 14 */
  uint8_t pad; /* 15 */
  uint64_t inclusive; /* 16: counted at the outermost activation only (D12) */
  uint64_t exclusive; /* 24 */
} Z80ProfileEdge;

_Static_assert(sizeof(Z80ProfileFrame) == 48, "a call frame is 48 bytes");
_Static_assert(sizeof(Z80ProfileEdge) == 32, "a call edge is 32 bytes");

static Z80ProfileFrame z80ProfileStack[Z80_PROFILE_STACK_DEPTH] __attribute__((aligned(16)));
static Z80ProfileEdge z80ProfileEdges[Z80_PROFILE_EDGE_SLOTS] __attribute__((aligned(16)));
/* The edge cache of calls made outside every frame */
static uint32_t z80ProfileRootLastCallee = Z80_PROFILE_KEY_ROOT;
static uint32_t z80ProfileRootLastEdge;
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
  z80ProfileHeader.edgesOffset = (uint32_t)(uintptr_t)z80ProfileEdges;
  z80ProfileHeader.edgeCapacity = Z80_PROFILE_EDGE_SLOTS;
  z80ProfileHeader.stackOffset = (uint32_t)(uintptr_t)z80ProfileStack;
  z80ProfileHeader.stackCapacity = Z80_PROFILE_STACK_DEPTH;
  z80ProfileHeader.armedStart = Z80_PROFILE_NONE;
  z80ProfileHeader.armedStop = Z80_PROFILE_NONE;
  z80ProfileEdges[0].callerPhys = Z80_PROFILE_KEY_OTHER;
  z80ProfileEdges[0].calleePhys = Z80_PROFILE_KEY_OTHER;
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

/*
 * Nonzero while nothing may count: a replay runs (D10), or an armed window has not started yet
 * (`profile start -at`, PROFILER_PLAN D2)
 */
Z80_ALWAYS_INLINE uint32_t z80ProfileSkips(void) {
  return z80ProfileIsMuted() || z80ProfileHeader.armedStart != Z80_PROFILE_NONE;
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
  if (m1 != 0u && (z80ProfileHeader.armedStart & z80ProfileHeader.armedStop) != Z80_PROFILE_NONE) {
    /* The armed window (PROFILER_PLAN D2): counting starts at the start marker's M1, and stops at the
       stop marker's next M1 - for `-at X -until X`, the next arrival at X after the start */
    const uint32_t pc = address & 0xffffu;
    if (z80ProfileHeader.armedStart != Z80_PROFILE_NONE) {
      if (pc != z80ProfileHeader.armedStart) {
        z80ProfileHeader.openPhys = Z80_PROFILE_NONE;
        return;
      }
      z80ProfileHeader.armedStart = Z80_PROFILE_NONE;
    } else if (pc == z80ProfileHeader.armedStop) {
      z80ProfileHeader.armedStop = Z80_PROFILE_NONE;
      z80ProfileHeader.enabled = 0u;
      z80ProfileHeader.openPhys = Z80_PROFILE_NONE;
      z80ProfileCallEvent = Z80_PROFILE_EV_NONE;
      z80ProfileHeader.windowClosed++;
      return;
    }
  }
  if (m1 == 0u && z80ProfileHeader.armedStart != Z80_PROFILE_NONE) return;
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
  if (z80ProfileSkips()) return;
  const uint32_t phys = z80ProfilePhys((int32_t)(Z80_PROFILE_PHYS_READ(address & 0xffffu)));
  if (phys == Z80_PROFILE_NONE) return;
  z80ProfileFlags[phys] |= (uint8_t)Z80_PF_R;
  Z80ProfileEntry *entry = z80ProfileEntryOf(phys);
  if (entry) z80ProfileCountUp(&entry->read);
}

/* A data write (D9): a write to a byte already fetched as code marks it self-modified */
static void z80ProfileWrite(uint32_t address) {
  if (z80ProfileSkips()) return;
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

static void z80ProfileCallSettle(void);

/*
 * D7: the instruction completed (no prefix pending): its time goes to its start address. Then the
 * call tracker settles the instruction's CALL, RST or RET, with its time already in the clock: a
 * CALL's own time is its caller's, a RET's its callee's.
 */
static void z80ProfileEnd(void) {
  const uint32_t phys = z80ProfileHeader.openPhys;
  if (phys != Z80_PROFILE_NONE) {
    z80ProfileHeader.openPhys = Z80_PROFILE_NONE;
    if (!z80ProfileSkips()) {
      const uint32_t span = z80ProfileSpan();
      z80ProfileHeader.timeTotal += span;
      Z80ProfileEntry *entry = z80ProfileEntryOf(phys);
      if (entry) entry->time += span;
    }
  }
  if (z80ProfileCallEvent != Z80_PROFILE_EV_NONE) z80ProfileCallSettle();
}

/* Starts timing an interrupt acknowledge or a HALTed cycle */
static void z80ProfileMark(void) {
  z80ProfileHeader.openTicks = (uint32_t)(Z80_PROFILE_FRAME_TICKS());
}

/* An interrupt acknowledge is not charged to an address (D7); its push opens the handler's frame */
static void z80ProfileAckEnd(uint32_t nmi) {
  if (!z80ProfileSkips()) {
    const uint32_t span = z80ProfileSpan();
    if (nmi) {
      z80ProfileHeader.timeNmiAck += span;
    } else {
      z80ProfileHeader.timeIntAck += span;
    }
    z80ProfileHeader.timeTotal += span;
  }
  if (z80ProfileCallEvent != Z80_PROFILE_EV_NONE) z80ProfileCallSettle();
}

/* A HALTed cycle is charged to the HALT's address, and summed apart as idle time (D7) */
static void z80ProfileHaltEnd(void) {
  if (z80ProfileSkips()) return;
  const uint32_t span = z80ProfileSpan();
  z80ProfileHeader.timeHalt += span;
  z80ProfileHeader.timeTotal += span;
  const uint32_t phys = z80ProfilePhys((int32_t)(Z80_PROFILE_PHYS_READ(cpu.pc)));
  if (phys == Z80_PROFILE_NONE) return;
  /* The flat profile moves a HALT's time to its "waiting" row (PROFILER_PLAN D4) */
  z80ProfileFlags[phys] |= (uint8_t)Z80_PF_H;
  Z80ProfileEntry *entry = z80ProfileEntryOf(phys);
  if (entry) entry->time += span;
}

/*
 * Time a core spends outside the CPU (the Next's DMA holding the bus, the Z88's snooze): a header
 * bucket, never an address (D7, trap T5). A hold that falls inside an instruction still open (between
 * the cycles of a prefixed one) moves its start along, so the instruction is not charged for it.
 */
static void z80ProfileChargeBucket(uint32_t bucket, uint32_t ticks) {
  if (z80ProfileHeader.enabled == 0u || z80ProfileSkips()) return;
  if (bucket == Z80_PROFILE_BUCKET_DMA) {
    z80ProfileHeader.timeDma += ticks;
  } else {
    z80ProfileHeader.timeSnooze += ticks;
  }
  z80ProfileHeader.timeTotal += ticks;
  if (z80ProfileHeader.openPhys != Z80_PROFILE_NONE) z80ProfileHeader.openTicks += ticks;
}


// -----------------------------------------------------------------------------
// The call tracker (`.plans/PROFILER_PLAN.md` §4.2, D9-D12)
// -----------------------------------------------------------------------------

Z80_ALWAYS_INLINE uint32_t z80ProfileEdgeHash(uint32_t caller, uint32_t callee) {
  uint32_t h = caller * 0x9e3779b1u ^ callee * 0x85ebca6bu;
  h ^= h >> 15;
  h *= 0x2c1b3c6du;
  h ^= h >> 13;
  return h;
}

/* The edge slot of a caller/callee pair, made on first use; slot 0, (other), when the table is full */
static uint32_t z80ProfileEdgeOf(uint32_t caller, uint32_t callee, uint16_t calleeAddr, uint32_t kind) {
  const uint32_t mask = Z80_PROFILE_EDGE_SLOTS - 1u;
  uint32_t slot = z80ProfileEdgeHash(caller, callee) & mask;
  for (;;) {
    if (slot == 0u) slot = 1u;
    Z80ProfileEdge *edge = &z80ProfileEdges[slot];
    if (edge->calls == 0u) break;
    if (edge->callerPhys == caller && edge->calleePhys == callee) return slot;
    slot = (slot + 1u) & mask;
  }
  if (z80ProfileHeader.edgesUsed >= Z80_PROFILE_EDGE_LIMIT) {
    z80ProfileHeader.edgesDropped++;
    return 0u;
  }
  Z80ProfileEdge *edge = &z80ProfileEdges[slot];
  edge->callerPhys = caller;
  edge->calleePhys = callee;
  edge->calleeAddr = calleeAddr;
  edge->kind = (uint8_t)kind;
  edge->inclusive = 0u;
  edge->exclusive = 0u;
  /* `calls` marks the slot used; the push counts the call itself */
  edge->calls = 0u;
  z80ProfileHeader.edgesUsed++;
  return slot;
}

/*
 * Closes the newest frame at `now`: its inclusive time is what passed since it started, less the
 * interrupts inside it (D11); its exclusive time is that less its returned calls. The parent takes
 * the frame's inclusive time as child time - unless the frame is an interrupt's, whose time is
 * excluded from the routine it interrupted.
 */
static void z80ProfileCallPop(uint64_t now) {
  Z80ProfileFrame *frame = &z80ProfileStack[--z80ProfileHeader.depth];
  const uint64_t spent = now > frame->start ? now - frame->start : 0u;
  const uint64_t inclusive = spent > frame->excluded ? spent - frame->excluded : 0u;
  const uint64_t exclusive = inclusive > frame->child ? inclusive - frame->child : 0u;
  Z80ProfileEdge *edge = &z80ProfileEdges[frame->edge];
  if (!frame->nested) edge->inclusive += inclusive;
  edge->exclusive += exclusive;
  if (z80ProfileHeader.depth == 0u) return;
  Z80ProfileFrame *parent = &z80ProfileStack[z80ProfileHeader.depth - 1u];
  if (frame->isInt) {
    parent->excluded += frame->excluded + inclusive;
  } else {
    parent->child += inclusive;
    parent->excluded += frame->excluded;
  }
}

/* Closes every open frame at `now` */
static void z80ProfileCallFlush(uint64_t now) {
  while (z80ProfileHeader.depth != 0u) z80ProfileCallPop(now);
}

/* Opens a frame for a call or an interrupt whose return address is at `slotSp` */
static void z80ProfileCallPush(uint32_t ev, uint16_t slotSp, uint64_t start) {
  const uint16_t calleeAddr = cpu.pc;
  const int32_t mapped = (int32_t)(Z80_PROFILE_PHYS_READ(calleeAddr));
  const uint32_t callee = z80ProfilePhys(mapped) == Z80_PROFILE_NONE ? Z80_PROFILE_KEY_UNMAPPED | calleeAddr
                                                                     : (uint32_t)mapped;
  const uint32_t isInt = ev == Z80_PROFILE_EV_INT || ev == Z80_PROFILE_EV_NMI;
  if (isInt) {
    z80ProfileHeader.interrupts++;
  } else {
    z80ProfileHeader.calls++;
  }
  if (z80ProfileHeader.depth >= Z80_PROFILE_STACK_DEPTH) {
    z80ProfileHeader.depthOverflows++;
    return;
  }
  Z80ProfileFrame *parent = z80ProfileHeader.depth ? &z80ProfileStack[z80ProfileHeader.depth - 1u] : 0;
  uint32_t edge;
  if (isInt) {
    const uint32_t kind = ev == Z80_PROFILE_EV_NMI   ? Z80_PROFILE_KIND_NMI
                          : cpu.interruptMode == 2u ? Z80_PROFILE_KIND_INT_IM2
                                                    : Z80_PROFILE_KIND_INT;
    edge = z80ProfileEdgeOf(ev == Z80_PROFILE_EV_NMI ? Z80_PROFILE_KEY_NMI : Z80_PROFILE_KEY_INT, callee, calleeAddr, kind);
  } else {
    uint32_t *lastCallee = parent ? &parent->lastCallee : &z80ProfileRootLastCallee;
    uint32_t *lastEdge = parent ? &parent->lastEdge : &z80ProfileRootLastEdge;
    if (*lastCallee == callee) {
      edge = *lastEdge;
    } else {
      edge = z80ProfileEdgeOf(parent ? parent->calleePhys : Z80_PROFILE_KEY_ROOT, callee, calleeAddr,
                              ev == Z80_PROFILE_EV_RST ? Z80_PROFILE_KIND_RST : Z80_PROFILE_KIND_CALL);
      *lastCallee = callee;
      *lastEdge = edge;
    }
  }
  Z80ProfileEdge *e = &z80ProfileEdges[edge];
  if (e->calls != 0xffffffffu) e->calls++;
  /* Recursion (D12): inclusive time only at the callee's outermost activation */
  uint8_t nested = 0u;
  for (uint32_t i = 0u; i < z80ProfileHeader.depth; i++) {
    if (z80ProfileStack[i].calleePhys == callee) {
      nested = 1u;
      break;
    }
  }
  Z80ProfileFrame *frame = &z80ProfileStack[z80ProfileHeader.depth++];
  frame->calleePhys = callee;
  frame->edge = edge;
  frame->start = start;
  frame->child = 0u;
  frame->excluded = 0u;
  frame->calleeAddr = calleeAddr;
  frame->slotSp = slotSp;
  frame->isInt = (uint8_t)isInt;
  frame->nested = nested;
  frame->pad = 0u;
  frame->lastCallee = Z80_PROFILE_KEY_ROOT;
  frame->lastEdge = 0u;
}

/*
 * Settles the event the instruction (or the acknowledge) noted, now that SP and PC are final (D9):
 *
 * - a RET closes every frame whose return slot lies below the new SP: a normal RET, a RET that
 *   skips frames (a "pop and ret" unwinder, the 48K's `RST 8` through ERR_SP, T2), and a routine
 *   that dropped its return address and jumped away all close at the first RET that climbs past;
 *   `PUSH HL / RET` leaves SP where it was and closes nothing (T1);
 * - a push first closes the frames whose return slot it overwrote (their routine discarded its
 *   return address), then opens the callee's frame.
 *
 * A push far below the open frame, or a RET (or push) that closed frames by jumping far above them,
 * is a stack switch: the stack is flushed to the root and `stackResyncs` says so (D10).
 */
static void z80ProfileCallSettle(void) {
  const uint32_t ev = z80ProfileCallEvent;
  z80ProfileCallEvent = Z80_PROFILE_EV_NONE;
  if (z80ProfileSkips()) return;
  const uint64_t now = z80ProfileHeader.timeTotal;
  const uint16_t sp = cpu.sp;
  uint32_t closed = 0u;
  uint16_t lastSlot = 0u;
  if (ev == Z80_PROFILE_EV_RET) {
    while (z80ProfileHeader.depth != 0u && z80ProfileStack[z80ProfileHeader.depth - 1u].slotSp < sp) {
      lastSlot = z80ProfileStack[z80ProfileHeader.depth - 1u].slotSp;
      z80ProfileCallPop(now);
      closed++;
    }
    if (closed && z80ProfileHeader.depth == 0u && (uint32_t)(sp - lastSlot) > Z80_PROFILE_RESYNC_DISTANCE + 2u) {
      z80ProfileHeader.stackResyncs++;
    }
    return;
  }
  while (z80ProfileHeader.depth != 0u && z80ProfileStack[z80ProfileHeader.depth - 1u].slotSp <= sp) {
    lastSlot = z80ProfileStack[z80ProfileHeader.depth - 1u].slotSp;
    z80ProfileCallPop(now);
    closed++;
  }
  if (closed && z80ProfileHeader.depth == 0u && (uint32_t)(sp - lastSlot) > Z80_PROFILE_RESYNC_DISTANCE) {
    z80ProfileHeader.stackResyncs++;
  } else if (z80ProfileHeader.depth != 0u &&
             (uint32_t)(z80ProfileStack[z80ProfileHeader.depth - 1u].slotSp - sp) > Z80_PROFILE_RESYNC_DISTANCE) {
    z80ProfileCallFlush(now);
    z80ProfileHeader.stackResyncs++;
  }
  const uint32_t isInt = ev == Z80_PROFILE_EV_INT || ev == Z80_PROFILE_EV_NMI;
  z80ProfileCallPush(ev, sp, isInt ? z80ProfileCallEventTime : now);
}

/* Empties the call tracker: edges, frames and counters */
static void z80ProfileCallClear(void) {
  for (uint32_t i = 0u; i < Z80_PROFILE_EDGE_SLOTS; i++) {
    z80ProfileEdges[i].calls = 0u;
    z80ProfileEdges[i].inclusive = 0u;
    z80ProfileEdges[i].exclusive = 0u;
  }
  z80ProfileEdges[0].callerPhys = Z80_PROFILE_KEY_OTHER;
  z80ProfileEdges[0].calleePhys = Z80_PROFILE_KEY_OTHER;
  z80ProfileHeader.depth = 0u;
  z80ProfileHeader.edgesUsed = 0u;
  z80ProfileHeader.edgesDropped = 0u;
  z80ProfileHeader.stackResyncs = 0u;
  z80ProfileHeader.depthOverflows = 0u;
  z80ProfileHeader.calls = 0u;
  z80ProfileHeader.interrupts = 0u;
  z80ProfileRootLastCallee = Z80_PROFILE_KEY_ROOT;
  z80ProfileRootLastEdge = 0u;
  z80ProfileCallEvent = Z80_PROFILE_EV_NONE;
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

/*
 * Turns profiling on or off; `counters` keeps the counter pool as well as the flags (D2, T10).
 * Turning it off freezes the call stack (the reader folds the open frames in); turning it back on
 * closes them at the clock, which did not move meanwhile, and starts a fresh stack.
 */
void z80ProfileSetEnabled(uint32_t on, uint32_t counters) {
  z80ProfileEnsureHeader();
  if (on && !z80ProfileHeader.enabled) z80ProfileCallFlush(z80ProfileHeader.timeTotal);
  z80ProfileHeader.enabled = on ? 1u : 0u;
  z80ProfileHeader.countersOn = counters ? 1u : 0u;
  z80ProfileHeader.openPhys = Z80_PROFILE_NONE;
  z80ProfileCallEvent = Z80_PROFILE_EV_NONE;
  if (!on) {
    z80ProfileHeader.armedStart = Z80_PROFILE_NONE;
    z80ProfileHeader.armedStop = Z80_PROFILE_NONE;
  }
}

/*
 * Turns the call tracker on or off (PROFILER_PLAN D1: `profile start -calls`). On starts an empty
 * stack (T5: calls made before it are the root's); off closes the open frames at the clock.
 */
void z80ProfileSetCalls(uint32_t on) {
  z80ProfileEnsureHeader();
  z80ProfileCallFlush(z80ProfileHeader.timeTotal);
  z80ProfileHeader.callsOn = on ? 1u : 0u;
  z80ProfileCallEvent = Z80_PROFILE_EV_NONE;
}

/*
 * Arms the profiling window (PROFILER_PLAN D2): counting waits for the first M1 at `start`, and
 * profiling stops at the next M1 at `stop` after that; 0xFFFFFFFF disarms either. One-shot: a marker
 * that fired is gone. Turning profiling off disarms both.
 */
void z80ProfileArm(uint32_t start, uint32_t stop) {
  z80ProfileEnsureHeader();
  z80ProfileHeader.armedStart = start == Z80_PROFILE_NONE ? Z80_PROFILE_NONE : (start & 0xffffu);
  z80ProfileHeader.armedStop = stop == Z80_PROFILE_NONE ? Z80_PROFILE_NONE : (stop & 0xffffu);
}

/* Where the call edges are (`Z80ProfileEdge[edgeCapacity]`) */
uint32_t z80ProfileGetEdgesOffset(void) {
  z80ProfileEnsureHeader();
  return z80ProfileHeader.edgesOffset;
}

/* Where the call stack is (`Z80ProfileFrame[stackCapacity]`, `depth` of them open) */
uint32_t z80ProfileGetStackOffset(void) {
  z80ProfileEnsureHeader();
  return z80ProfileHeader.stackOffset;
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
  z80ProfileCallClear();
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
