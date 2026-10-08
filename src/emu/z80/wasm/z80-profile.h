/*
 * The access profile's hooks (`.plans/CODE_COVERAGE_AND_HEAT_MAP_PLAN.md` §4.1, D1-D10): code
 * coverage (G5.1), the memory heat map (G5.2) and the flat profiler's per-instruction time (G5.3).
 *
 * A core that profiles includes this file BEFORE `z80.c`, and `z80-profile.c` after everything its
 * `Z80_PROFILE_*` machine macros use (see the top of `z80-profile.c`). This file turns the no-op
 * hooks of `z80.c` into one predictable branch each (trap T10): while profiling is off, an access
 * pays a load and a compare.
 *
 * The hooks sit at the CPU's three memory funnels in `z80.c` - code fetch, data read, data write -
 * never in the cores' own memory functions, which also serve the debugger's side-effect-free reads
 * (trap T1).
 */

#ifndef Z80_PROFILE_H
#define Z80_PROFILE_H

#include <stdint.h>

/*
 * The 192-byte header the reader (`WasmProfileReader.ts`) parses. Little-endian, natural alignment:
 * every field sits at the offset in the comment, so the struct is the wire format. Version 2 added
 * the call tracker's fields (`.plans/PROFILER_PLAN.md` §4.2) from offset 116 on.
 */
typedef struct Z80ProfileHeader {
  uint32_t magic; /* 0: "KPRF" */
  uint16_t version; /* 4 */
  uint16_t entrySize; /* 6: bytes per counter entry (24) */
  uint8_t enabled; /* 8: the hooks run */
  uint8_t countersOn; /* 9: the counter pool is kept, not only the flags */
  uint8_t muted; /* 10: 1 while a replay runs (D10); set by the hooks themselves */
  uint8_t callsOn; /* 11: the call tracker runs (PROFILER_PLAN D1, D9) */
  uint32_t flagBytes; /* 12: the size of the flag array - the core's physical span */
  uint32_t poolPages; /* 16: the pool's capacity in 8K pages */
  uint32_t pagesUsed; /* 20 */
  uint32_t pagesDropped; /* 24: pages that wanted counters when the pool was full (T6) */
  uint32_t firstDroppedPage; /* 28: the first of them, 0xFFFFFFFF when none */
  uint64_t timeIntAck; /* 32: maskable interrupt acknowledges (D7) */
  uint64_t timeNmiAck; /* 40: NMI acknowledges */
  uint64_t timeDma; /* 48: the Next's DMA bus holds (T5) */
  uint64_t timeSnooze; /* 56: the Z88's snooze */
  uint64_t timeHalt; /* 64: HALTed cycles; also charged to the HALT's address */
  uint64_t timeTotal; /* 72: everything measured */
  uint64_t instructions; /* 80: instruction starts counted */
  uint32_t generation; /* 88: bumped by every reset; the IDE's profile version */
  uint32_t openPhys; /* 92: the open instruction's physical offset, 0xFFFFFFFF when none */
  uint32_t openTicks; /* 96: the time unit's counter at its start (D8) */
  uint32_t flagsOffset; /* 100: where the flag array is in linear memory */
  uint32_t pageMapOffset; /* 104: where the page map (uint16 per 8K page) is */
  uint32_t poolOffset; /* 108: where the counter pool is */
  uint32_t pageMapEntries; /* 112: 8K pages the flag array spans */
  uint32_t stackResyncs; /* 116: stack switches that flushed the call stack (PROFILER_PLAN D10) */
  uint32_t depthOverflows; /* 120: calls past the call stack's depth, not tracked (D10) */
  uint32_t edgesDropped; /* 124: calls whose edge found the edge table full, charged to (other) (D12) */
  uint32_t edgesOffset; /* 128: where the edge table is in linear memory */
  uint32_t edgeCapacity; /* 132: its slots */
  uint32_t edgesUsed; /* 136 */
  uint32_t stackOffset; /* 140: where the call stack (Z80ProfileFrame[]) is */
  uint32_t stackCapacity; /* 144: its depth */
  uint32_t depth; /* 148: the frames open now */
  uint64_t calls; /* 152: CALL and RST pushes tracked */
  uint64_t interrupts; /* 160: interrupt and NMI pushes tracked */
  uint32_t armedStart; /* 168: the CPU address whose next M1 starts counting, 0xFFFFFFFF when none (D2) */
  uint32_t armedStop; /* 172: the CPU address whose next M1 stops profiling, 0xFFFFFFFF when none (D2) */
  uint32_t windowClosed; /* 176: bumped when an armed stop fired */
  uint32_t pad1; /* 180 */
  uint64_t pad2; /* 184 */
} Z80ProfileHeader;

/*
 * The call tracker's pending event (`.plans/PROFILER_PLAN.md` D9): CALL, RST, RET and interrupt
 * pushes only note it; the instruction's end (or the acknowledge's) settles it once the stack pointer
 * and the program counter are final and the instruction's time is in the clock.
 */
#define Z80_PROFILE_EV_NONE 0u
#define Z80_PROFILE_EV_CALL 1u
#define Z80_PROFILE_EV_RST 2u
#define Z80_PROFILE_EV_RET 3u
#define Z80_PROFILE_EV_INT 4u
#define Z80_PROFILE_EV_NMI 5u
static uint32_t z80ProfileCallEvent;
/* The clock when an interrupt pushed: its frame includes the acknowledge */
static uint64_t z80ProfileCallEventTime;

static Z80ProfileHeader z80ProfileHeader;

/* The flag byte's bits (D3); bit 7 is spare for branch coverage (§1.2) */
#define Z80_PF_E 0x01u /* an instruction started here: M1 of its first opcode or prefix byte */
#define Z80_PF_C 0x02u /* fetched as code: opcode, prefix, displacement or operand */
#define Z80_PF_R 0x04u /* data read */
#define Z80_PF_W 0x08u /* data write */
#define Z80_PF_S 0x10u /* self-modified (D9) */
#define Z80_PF_X 0x20u /* an instruction started here inside an interrupt service */
#define Z80_PF_H 0x40u /* a HALT waited here: its time is mostly waiting (PROFILER_PLAN D4) */

/* The header's time buckets a core charges directly (`z80ProfileChargeBucket`) */
#define Z80_PROFILE_BUCKET_DMA 0u
#define Z80_PROFILE_BUCKET_SNOOZE 1u

/*
 * Out of line on purpose: the hooks sit at every memory access of every opcode, and inlining the
 * bodies there would grow a core by more than half (measured on the 48K: 235 KB to 390 KB) for a
 * path that runs only while profiling is on (trap T10)
 */
#define Z80_PROFILE_NOINLINE __attribute__((noinline))
static void Z80_PROFILE_NOINLINE z80ProfileFetch(uint32_t address, uint32_t m1);
static void Z80_PROFILE_NOINLINE z80ProfileRead(uint32_t address);
static void Z80_PROFILE_NOINLINE z80ProfileWrite(uint32_t address);
static void Z80_PROFILE_NOINLINE z80ProfileEnd(void);
static void Z80_PROFILE_NOINLINE z80ProfileMark(void);
static void Z80_PROFILE_NOINLINE z80ProfileAckEnd(uint32_t nmi);
static void Z80_PROFILE_NOINLINE z80ProfileHaltEnd(void);
static void Z80_PROFILE_NOINLINE z80ProfileChargeBucket(uint32_t bucket, uint32_t ticks);

#define Z80_PROFILE_FETCH(address, m1) \
  do { \
    if (z80ProfileHeader.enabled) z80ProfileFetch((uint32_t)(address), (uint32_t)(m1)); \
  } while (0)
#define Z80_PROFILE_READ(address) \
  do { \
    if (z80ProfileHeader.enabled) z80ProfileRead((uint32_t)(address)); \
  } while (0)
#define Z80_PROFILE_WRITE(address) \
  do { \
    if (z80ProfileHeader.enabled) z80ProfileWrite((uint32_t)(address)); \
  } while (0)
#define Z80_PROFILE_END() \
  do { \
    if (z80ProfileHeader.enabled) z80ProfileEnd(); \
  } while (0)
#define Z80_PROFILE_MARK() \
  do { \
    if (z80ProfileHeader.enabled) z80ProfileMark(); \
  } while (0)
#define Z80_PROFILE_ACK_END(nmi) \
  do { \
    if (z80ProfileHeader.enabled) z80ProfileAckEnd(nmi); \
  } while (0)
#define Z80_PROFILE_HALT_END() \
  do { \
    if (z80ProfileHeader.enabled) z80ProfileHaltEnd(); \
  } while (0)

/* The call tracker's hooks (PROFILER_PLAN D9): a load, a compare and a store while it runs */
#define Z80_PROFILE_CALLS_ON() ((z80ProfileHeader.enabled & z80ProfileHeader.callsOn) != 0u)
#define Z80_PROFILE_CALL(rst) \
  do { \
    if (Z80_PROFILE_CALLS_ON()) z80ProfileCallEvent = (rst) ? Z80_PROFILE_EV_RST : Z80_PROFILE_EV_CALL; \
  } while (0)
#define Z80_PROFILE_RET() \
  do { \
    if (Z80_PROFILE_CALLS_ON()) z80ProfileCallEvent = Z80_PROFILE_EV_RET; \
  } while (0)
#define Z80_PROFILE_INT(nmi) \
  do { \
    if (Z80_PROFILE_CALLS_ON()) { \
      z80ProfileCallEvent = (nmi) ? Z80_PROFILE_EV_NMI : Z80_PROFILE_EV_INT; \
      z80ProfileCallEventTime = z80ProfileHeader.timeTotal; \
    } \
  } while (0)

#endif
