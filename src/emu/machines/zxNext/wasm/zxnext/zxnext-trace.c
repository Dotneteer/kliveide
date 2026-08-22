#include "zxnext-trace.h"

#define ZXNEXT_TRACE_MAGIC 0x5854465au
#define ZXNEXT_TRACE_VERSION 1u
#define ZXNEXT_TRACE_HEADER_SIZE 64u
#define ZXNEXT_TRACE_RECORD_SIZE 128u
#define ZXNEXT_TRACE_CAPACITY 160000u
#define ZXNEXT_TRACE_TOTAL_SIZE (ZXNEXT_TRACE_HEADER_SIZE + ZXNEXT_TRACE_CAPACITY * ZXNEXT_TRACE_RECORD_SIZE)

#define ZXNEXT_TRACE_MAP_READ_ONLY (1u << 13)
#define ZXNEXT_TRACE_MAP_KIND_NEXT_ROM 1u
#define ZXNEXT_TRACE_MAP_KIND_MAIN_RAM 2u
#define ZXNEXT_TRACE_MAP_KIND_DIVMMC_ROM 3u
#define ZXNEXT_TRACE_MAP_KIND_DIVMMC_RAM 4u
#define ZXNEXT_TRACE_MAP_KIND_MULTIFACE 5u
#define ZXNEXT_TRACE_MAP_KIND_ALT_ROM 6u
#define ZXNEXT_TRACE_MAP_KIND_SENTINEL 7u

#define ZXNEXT_OFFS_DIVMMC_ROM 0x010000u
#define ZXNEXT_OFFS_MULTIFACE_MEM 0x014000u
#define ZXNEXT_OFFS_DIVMMC_RAM 0x020000u
#define ZXNEXT_OFFS_ERR_PAGE (2048u * 1024u)

static uint8_t zxnextFrameTrace[ZXNEXT_TRACE_TOTAL_SIZE];
static uint32_t zxnextTraceEnabled;
static uint32_t zxnextTraceCount;
static uint32_t zxnextTraceOverflow;

static inline void zxnextTraceWrite8(uint32_t offset, uint32_t value) {
  zxnextFrameTrace[offset] = (uint8_t)value;
}

static inline void zxnextTraceWrite16(uint32_t offset, uint32_t value) {
  zxnextFrameTrace[offset] = (uint8_t)(value & 0xffu);
  zxnextFrameTrace[offset + 1u] = (uint8_t)((value >> 8) & 0xffu);
}

static inline void zxnextTraceWrite32(uint32_t offset, uint32_t value) {
  zxnextFrameTrace[offset] = (uint8_t)(value & 0xffu);
  zxnextFrameTrace[offset + 1u] = (uint8_t)((value >> 8) & 0xffu);
  zxnextFrameTrace[offset + 2u] = (uint8_t)((value >> 16) & 0xffu);
  zxnextFrameTrace[offset + 3u] = (uint8_t)((value >> 24) & 0xffu);
}

static inline void zxnextTraceWrite64From32(uint32_t offset, uint32_t value) {
  zxnextTraceWrite32(offset, value);
  zxnextTraceWrite32(offset + 4u, 0u);
}

static inline uint32_t zxnextTraceEncodeMemoryOffset(uint32_t offset, uint32_t readOnly) {
  uint32_t kind = 0u;
  uint32_t page = 0x1ffu;

  if (offset == ZXNEXT_NO_WRITE_OFFSET) {
    return ZXNEXT_TRACE_MAP_READ_ONLY;
  }
  if (offset >= ZXNEXT_OFFS_ERR_PAGE) {
    kind = ZXNEXT_TRACE_MAP_KIND_SENTINEL;
    page = 0x1ffu;
  } else if (offset >= ZXNEXT_OFFS_NEXT_RAM) {
    kind = ZXNEXT_TRACE_MAP_KIND_MAIN_RAM;
    page = ((offset - ZXNEXT_OFFS_NEXT_RAM) >> 13) & 0x1ffu;
  } else if (offset >= ZXNEXT_OFFS_DIVMMC_RAM) {
    kind = ZXNEXT_TRACE_MAP_KIND_DIVMMC_RAM;
    page = ((offset - ZXNEXT_OFFS_DIVMMC_RAM) >> 13) & 0x1ffu;
  } else if (offset >= ZXNEXT_OFFS_ALT_ROM_0 && offset < ZXNEXT_OFFS_ALT_ROM_1 + 0x4000u) {
    kind = ZXNEXT_TRACE_MAP_KIND_ALT_ROM;
    page = ((offset - ZXNEXT_OFFS_ALT_ROM_0) >> 13) & 0x1ffu;
  } else if (offset >= ZXNEXT_OFFS_MULTIFACE_MEM && offset < ZXNEXT_OFFS_MULTIFACE_MEM + 0x4000u) {
    kind = ZXNEXT_TRACE_MAP_KIND_MULTIFACE;
    page = ((offset - ZXNEXT_OFFS_MULTIFACE_MEM) >> 13) & 0x1ffu;
  } else if (offset >= ZXNEXT_OFFS_DIVMMC_ROM && offset < ZXNEXT_OFFS_DIVMMC_ROM + 0x4000u) {
    kind = ZXNEXT_TRACE_MAP_KIND_DIVMMC_ROM;
    page = ((offset - ZXNEXT_OFFS_DIVMMC_ROM) >> 13) & 0x1ffu;
  } else if (offset < 0x010000u) {
    kind = ZXNEXT_TRACE_MAP_KIND_NEXT_ROM;
    page = (offset >> 13) & 0x1ffu;
  }

  return page | (kind << 9) | (readOnly ? ZXNEXT_TRACE_MAP_READ_ONLY : 0u);
}

static inline uint32_t zxnextTracePackCpuFlags(void) {
  return
    (z80GetIff1() ? 0x0001u : 0u) |
    (z80GetIff2() ? 0x0002u : 0u) |
    ((z80GetInterruptMode() & 0x03u) << 2) |
    (z80GetHalted() ? 0x0010u : 0u) |
    ((z80GetPrefix() & 0x0fu) << 5) |
    (z80GetSigInt() ? 0x0200u : 0u) |
    (z80GetSigNmi() ? 0x0400u : 0u) |
    (z80GetRetExecuted() ? 0x0800u : 0u) |
    (z80GetRetnExecuted() ? 0x1000u : 0u);
}

static void zxnextTraceWriteHeader(uint32_t frameIndex) {
  zxnextTraceWrite32(0u, ZXNEXT_TRACE_MAGIC);
  zxnextTraceWrite16(4u, ZXNEXT_TRACE_VERSION);
  zxnextTraceWrite16(6u, ZXNEXT_TRACE_RECORD_SIZE);
  zxnextTraceWrite32(8u, ZXNEXT_TRACE_CAPACITY);
  zxnextTraceWrite32(12u, zxnextTraceCount);
  zxnextTraceWrite32(16u, zxnextTraceOverflow);
  zxnextTraceWrite32(20u, frameIndex);
  zxnextTraceWrite32(24u, ZXNEXT_TACTS_IN_FRAME);
  zxnextTraceWrite64From32(28u, tacts);
  zxnextTraceWrite64From32(36u, 0u);
}

static void zxnextTraceReset(void) {
  zxnextTraceEnabled = 0u;
  zxnextTraceCount = 0u;
  zxnextTraceOverflow = 0u;
  zxnextTraceWriteHeader(0u);
}

static void zxnextTraceSetEnabledImpl(uint32_t enabled) {
  zxnextTraceEnabled = enabled != 0u;
}

static void zxnextTraceClearImpl(uint32_t frameIndex) {
  zxnextTraceCount = 0u;
  zxnextTraceOverflow = 0u;
  for (uint32_t i = 0u; i < ZXNEXT_TRACE_HEADER_SIZE; i++) {
    zxnextFrameTrace[i] = 0u;
  }
  zxnextTraceWriteHeader(frameIndex);
}

static void zxnextTraceFinishFrameImpl(void) {
  zxnextTraceWrite32(12u, zxnextTraceCount);
  zxnextTraceWrite32(16u, zxnextTraceOverflow);
  zxnextTraceWrite64From32(36u, tacts);
}

static void zxnextTraceRecordInstruction(uint32_t pcBefore) {
  if (!zxnextTraceEnabled) return;
  if (zxnextTraceCount >= ZXNEXT_TRACE_CAPACITY) {
    if (zxnextTraceOverflow == 0u) {
      zxnextTraceOverflow = zxnextTraceCount + 1u;
      zxnextTraceWrite32(16u, zxnextTraceOverflow);
    }
    return;
  }

  uint32_t offset = ZXNEXT_TRACE_HEADER_SIZE + zxnextTraceCount * ZXNEXT_TRACE_RECORD_SIZE;
  zxnextTraceWrite32(offset + 0u, zxnextTraceCount);
  zxnextTraceWrite32(offset + 4u, frameTacts28);
  zxnextTraceWrite64From32(offset + 8u, tacts);
  zxnextTraceWrite16(offset + 16u, pcBefore);
  zxnextTraceWrite16(offset + 18u, z80GetPc());
  zxnextTraceWrite16(offset + 20u, z80GetAf());
  zxnextTraceWrite16(offset + 22u, z80GetBc());
  zxnextTraceWrite16(offset + 24u, z80GetDe());
  zxnextTraceWrite16(offset + 26u, z80GetHl());
  zxnextTraceWrite16(offset + 28u, z80GetAfAlt());
  zxnextTraceWrite16(offset + 30u, z80GetBcAlt());
  zxnextTraceWrite16(offset + 32u, z80GetDeAlt());
  zxnextTraceWrite16(offset + 34u, z80GetHlAlt());
  zxnextTraceWrite16(offset + 36u, z80GetIx());
  zxnextTraceWrite16(offset + 38u, z80GetIy());
  zxnextTraceWrite16(offset + 40u, z80GetIr());
  zxnextTraceWrite16(offset + 42u, z80GetWz());
  zxnextTraceWrite16(offset + 44u, z80GetSp());
  zxnextTraceWrite16(offset + 46u, zxnextTracePackCpuFlags());
  zxnextTraceWrite32(offset + 48u, zxnextTraceCount + 1u);
  zxnextTraceWrite32(offset + 52u, totalContentionDelaySinceStart);
  zxnextTraceWrite32(offset + 56u, contentionDelaySincePause);
  zxnextTraceWrite16(offset + 60u, lastMemoryAddress);
  zxnextTraceWrite16(offset + 62u, lastPortAddress);
  zxnextTraceWrite8(offset + 64u, lastMemoryValue);
  zxnextTraceWrite8(offset + 65u, lastPortValue);
  zxnextTraceWrite8(offset + 66u, (lastMemoryAccessed ? 0x01u : 0u) | (lastMemoryIsWrite ? 0x02u : 0u));
  zxnextTraceWrite8(offset + 67u, (lastPortAccessed ? 0x01u : 0u) | (lastPortIsWrite ? 0x02u : 0u));
  zxnextTraceWrite8(offset + 68u, cpuEffectiveSpeed);
  zxnextTraceWrite8(offset + 69u, cpuTactScale);
  zxnextTraceWrite8(offset + 70u, nextRegIndex);
  zxnextTraceWrite8(offset + 71u, 0u);

  for (uint32_t slot = 0u; slot < 8u; slot++) {
    zxnextTraceWrite8(offset + 72u + slot, zxnextNextRegs[0x50u + slot]);
    zxnextTraceWrite16(offset + 80u + slot * 2u, zxnextTraceEncodeMemoryOffset(pageReadOffset[slot], 0u));
    zxnextTraceWrite16(offset + 96u + slot * 2u, zxnextTraceEncodeMemoryOffset(pageWriteOffset[slot], pageWriteOffset[slot] == ZXNEXT_NO_WRITE_OFFSET));
  }

  zxnextTraceWrite8(offset + 112u, zxnextMemoryGetPort7ffd());
  zxnextTraceWrite8(offset + 113u, zxnextMemoryGetPort1ffd());
  zxnextTraceWrite8(offset + 114u, zxnextMemoryGetPortDffd());
  zxnextTraceWrite8(offset + 115u, 0u);
  zxnextTraceWrite8(offset + 116u, zxnextDivMmcGetPortE3());
  zxnextTraceWrite8(offset + 117u, 0u);
  zxnextTraceWrite8(offset + 118u, zxnextNextRegs[0x8cu]);
  zxnextTraceWrite8(offset + 119u, 0u);
  zxnextTraceWrite32(offset + 120u, 0u);
  zxnextTraceWrite32(offset + 124u, 0u);

  zxnextTraceCount++;
  zxnextTraceWrite32(12u, zxnextTraceCount);
}

static uint32_t zxnextTraceGetStartOffsetImpl(void) { return (uint32_t)(uintptr_t)zxnextFrameTrace; }
static uint32_t zxnextTraceGetHeaderSizeImpl(void) { return ZXNEXT_TRACE_HEADER_SIZE; }
static uint32_t zxnextTraceGetRecordSizeImpl(void) { return ZXNEXT_TRACE_RECORD_SIZE; }
static uint32_t zxnextTraceGetCapacityImpl(void) { return ZXNEXT_TRACE_CAPACITY; }
static uint32_t zxnextTraceGetCountImpl(void) { return zxnextTraceCount; }
static uint32_t zxnextTraceGetOverflowImpl(void) { return zxnextTraceOverflow; }
