#include "zxnext-cpu.h"

static uint32_t zxnextSharedCpuExecutedInstructions;

static uint32_t zxnextCpuSharedReadMemory(uint32_t address);
static void zxnextCpuSharedWriteMemory(uint32_t address, uint32_t value);
static uint32_t zxnextCpuSharedReadPort(uint32_t address);
static void zxnextCpuSharedWritePort(uint32_t address, uint32_t value);
static void zxnextCpuSharedWriteTbBlue(uint32_t address, uint32_t value);
static inline void zxnextCpuTactPlusN(uint32_t value);
static inline void zxnextCpuDelayMemoryRead(uint32_t address);
static inline void zxnextCpuDelayMemoryWrite(uint32_t address);
static inline void zxnextCpuDelayPortAccess(uint32_t address);

#define Z80_EXTERNAL_BUS 1
#define Z80_MEMORY_PTR() zxnextMemory
#define Z80_READ_MEMORY(address) zxnextCpuSharedReadMemory(address)
#define Z80_WRITE_MEMORY(address, value) zxnextCpuSharedWriteMemory(address, value)
#define Z80_POKE_MEMORY(address, value) zxnextCpuSharedWriteMemory(address, value)
#define Z80_READ_PORT(address) zxnextCpuSharedReadPort(address)
#define Z80_WRITE_PORT(address, value) zxnextCpuSharedWritePort(address, value)
#define Z80_WRITE_TBBLUE(address, value) zxnextCpuSharedWriteTbBlue(address, value)
#define Z80_TACT_PLUS_N(value) zxnextCpuTactPlusN(value)
#define Z80_DELAY_MEMORY_READ(address) zxnextCpuDelayMemoryRead(address)
#define Z80_DELAY_MEMORY_WRITE(address) zxnextCpuDelayMemoryWrite(address)
#define Z80_DELAY_PORT_READ(address) zxnextCpuDelayPortAccess(address)
#define Z80_DELAY_PORT_WRITE(address) zxnextCpuDelayPortAccess(address)

#include "../../../../z80/wasm/z80.c"

static inline uint32_t zxnextCpuTactScale(void) {
  return cpuTactScale;
}

static inline void zxnextCpuMarkFrameCompleted(void) {
  frames++;
  frameCompleted = 1;
  zxnextUlaOnFrameCompleted();
}

static inline void zxnextCpuTactPlusN(uint32_t value) {
  cpu.tacts += value;
  tacts += value;
  frameTacts28 += value * zxnextCpuTactScale();
  while (frameTacts28 >= ZXNEXT_TACTS_IN_FRAME) {
    zxnextCtcOnFrameCompleted();
    frameTacts28 -= ZXNEXT_TACTS_IN_FRAME;
    zxnextCpuMarkFrameCompleted();
  }
  currentFrameTact = frameTacts28 >> 2;
  zxnextBeeperSetTacts(tacts);
  zxnextAudioMixerSetNextSample(frameTacts28);
}

static inline uint32_t zxnextCpuReadsBank7(uint32_t address) {
  const uint32_t pageIndex = (address >> 13) & 0x07u;
  return zxnextMemoryGetPageBank8(pageIndex) == 0x0eu;
}

static inline uint32_t zxnextCpuIsContendedIoAddress(uint32_t address) {
  if (cpuEffectiveSpeed != 0u) return 0;
  if ((zxnextNextRegs[0x08u] & 0x40u) != 0u) return 0;
  const uint32_t page = address & 0xc000u;
  return page == 0x4000u || (page == 0xc000u && (zxnextMemoryGetSelectedRamBank() & 0x01u) != 0u);
}

static inline void zxnextCpuDelayMemoryRead(uint32_t address) {
  zxnextCpuTactPlusN(3u);
  if (cpuEffectiveSpeed == 3u && !zxnextCpuReadsBank7(address)) {
    zxnextCpuTactPlusN(1u);
    totalContentionDelaySinceStart++;
    contentionDelaySincePause++;
  }
}

static inline void zxnextCpuDelayMemoryWrite(uint32_t address) {
  (void)address;
  zxnextCpuTactPlusN(3u);
  totalContentionDelaySinceStart += 3u;
  contentionDelaySincePause += 3u;
}

static inline void zxnextCpuDelayPortAccess(uint32_t address) {
  const uint32_t lowBit = address & 0x0001u;
  if (zxnextCpuIsContendedIoAddress(address)) {
    if (lowBit != 0u) {
      zxnextCpuTactPlusN(1u);
      zxnextCpuTactPlusN(1u);
      zxnextCpuTactPlusN(1u);
      zxnextCpuTactPlusN(1u);
    } else {
      zxnextCpuTactPlusN(1u);
      zxnextCpuTactPlusN(3u);
    }
  } else if (lowBit != 0u) {
    zxnextCpuTactPlusN(4u);
  } else {
    zxnextCpuTactPlusN(1u);
    zxnextCpuTactPlusN(3u);
  }
}

static uint32_t zxnextCpuSharedReadMemory(uint32_t address) {
  uint32_t value = zxnextMemoryReadMapped(address & 0xffffu);
  lastMemoryAddress = (uint16_t)address;
  lastMemoryValue = (uint8_t)value;
  lastMemoryIsWrite = 0;
  return value;
}

static void zxnextCpuSharedWriteMemory(uint32_t address, uint32_t value) {
  zxnextMemoryWriteMapped(address & 0xffffu, value & 0xffu);
  lastMemoryAddress = (uint16_t)address;
  lastMemoryValue = (uint8_t)value;
  lastMemoryIsWrite = 1;
}

static uint32_t zxnextCpuSharedReadPort(uint32_t address) {
  return zxnextPortsRead(address & 0xffffu);
}

static void zxnextCpuSharedWritePort(uint32_t address, uint32_t value) {
  zxnextPortsWrite(address & 0xffffu, value & 0xffu);
}

static void zxnextCpuSharedWriteTbBlue(uint32_t address, uint32_t value) {
  zxnextNextRegSetDirect(address & 0xffu, value & 0xffu);
}

static void zxnextCpuSyncFrameState(uint32_t previousTacts, uint32_t currentTacts) {
  (void)previousTacts;
  tacts = currentTacts;
}

static void zxnextCpuReset(void) {
  zxnextSharedCpuExecutedInstructions = 0;
  z80Reset();
  z80SetZ80NMode(1);
  z80SetTacts(tacts);
}

static uint32_t zxnextCpuProcessStacklessNmi(void) {
  uint32_t previousTacts = z80GetTacts();
  uint32_t pc = z80GetPc();
  uint32_t sp = z80GetSp();
  z80TactPlusN(4);
  if (z80GetHalted()) {
    pc = (pc + 1u) & 0xffffu;
  }
  z80SetIff2(z80GetIff1());
  z80SetIff1(0);
  z80SetSp((sp - 2u) & 0xffffu);
  z80SetWz(0);
  z80SetPc(0x0066u);
  zxnextNmiSetReturnAddress(pc);
  zxnextNmiMarkAccepted();
  zxnextSharedCpuExecutedInstructions++;
  zxnextCpuSyncFrameState(previousTacts, z80GetTacts());
  return zxnextSharedCpuExecutedInstructions;
}

static uint32_t zxnextCpuExecuteInstruction(void) {
  uint16_t pcBefore = (uint16_t)z80GetPc();
  uint32_t previousTacts = z80GetTacts();
  uint8_t shouldAcceptInt = zxnextInterruptsShouldAcceptInt() && z80GetIff1();
  uint8_t nmiSignal = zxnextNmiGetSignal();
  uint8_t isRetiInstruction = zxnextMemoryPeekMapped(pcBefore) == 0xedu &&
    zxnextMemoryPeekMapped((pcBefore + 1u) & 0xffffu) == 0x4du;
  uint32_t cyclesExecuted = 0;

  frameCompleted = 0;
  if (nmiSignal && zxnextNmiGetStacklessEnabled()) {
    return zxnextCpuProcessStacklessNmi();
  }

  cpuTactScale = 8u >> (cpuEffectiveSpeed & 0x03u);
  zxnextDivMmcBeforeOpcodeFetch(pcBefore);
  z80SetSigNmi(nmiSignal);
  z80SetSigInt(shouldAcceptInt);
  if (shouldAcceptInt) {
    z80SetInterruptVector(zxnextInterruptsAcknowledge());
  }

  do {
    z80ExecuteCpuCycle();
    cyclesExecuted++;
  } while (z80GetPrefix() != 0 && cyclesExecuted < 4u);

  zxnextSharedCpuExecutedInstructions++;
  zxnextCpuSyncFrameState(previousTacts, z80GetTacts());

  if (nmiSignal) {
    zxnextNmiMarkAccepted();
  }
  if (isRetiInstruction) {
    zxnextInterruptsReti();
  }
  if (z80GetRetnExecuted()) {
    uint8_t stacklessProcessed = zxnextNmiGetStacklessProcessed();
    uint32_t stacklessReturnAddress = zxnextNmiGetReturnAddress();
    zxnextNmiAfterRetn();
    if (stacklessProcessed) {
      z80SetPc(stacklessReturnAddress);
    }
  }
  zxnextDivMmcAfterOpcodeFetch(z80GetRetnExecuted(), 0);
  return zxnextSharedCpuExecutedInstructions;
}
