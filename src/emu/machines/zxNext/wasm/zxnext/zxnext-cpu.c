#include "zxnext-cpu.h"

static uint32_t zxnextSharedCpuExecutedInstructions;

static uint32_t zxnextCpuSharedReadMemory(uint32_t address);
static void zxnextCpuSharedWriteMemory(uint32_t address, uint32_t value);
static uint32_t zxnextCpuSharedReadPort(uint32_t address);
static void zxnextCpuSharedWritePort(uint32_t address, uint32_t value);
static void zxnextCpuSharedWriteTbBlue(uint32_t address, uint32_t value);

#define Z80_EXTERNAL_BUS 1
#define Z80_MEMORY_PTR() zxnextMemory
#define Z80_READ_MEMORY(address) zxnextCpuSharedReadMemory(address)
#define Z80_WRITE_MEMORY(address, value) zxnextCpuSharedWriteMemory(address, value)
#define Z80_POKE_MEMORY(address, value) zxnextCpuSharedWriteMemory(address, value)
#define Z80_READ_PORT(address) zxnextCpuSharedReadPort(address)
#define Z80_WRITE_PORT(address, value) zxnextCpuSharedWritePort(address, value)
#define Z80_WRITE_TBBLUE(address, value) zxnextCpuSharedWriteTbBlue(address, value)

#include "../../../../z80/wasm/z80.c"

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
  uint32_t previousFrameTact = currentFrameTact;
  uint32_t deltaTacts = currentTacts - previousTacts;
  uint32_t nextFrameTact = (previousFrameTact + deltaTacts * 2u) % ZXNEXT_RENDERING_TACTS_IN_FRAME;
  tacts = currentTacts;
  currentFrameTact = nextFrameTact;
  if (currentTacts != previousTacts && nextFrameTact < previousFrameTact) {
    frames++;
    frameCompleted = 1;
    zxnextUlaOnFrameCompleted();
  } else {
    frameCompleted = 0;
  }
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

  if (nmiSignal && zxnextNmiGetStacklessEnabled()) {
    return zxnextCpuProcessStacklessNmi();
  }

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
