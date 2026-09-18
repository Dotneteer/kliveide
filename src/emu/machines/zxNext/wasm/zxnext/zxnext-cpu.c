#include "zxnext-cpu.h"
#include "zxnext-copper.h"
#include "zxnext-trace.h"
#include "zxnext-ula.h"
#include "zxnext-psg.h"

static uint32_t zxnextSharedCpuExecutedInstructions;

static uint32_t zxnextCpuSharedReadMemory(uint32_t address);
static uint32_t zxnextCpuSharedFetchCodeByte(uint32_t address);
static void zxnextCpuSharedWriteMemory(uint32_t address, uint32_t value);
static uint32_t zxnextCpuSharedReadPort(uint32_t address);
static void zxnextCpuSharedWritePort(uint32_t address, uint32_t value);
static void zxnextCpuSharedWriteTbBlue(uint32_t address, uint32_t value);
static inline void zxnextCpuTactPlusN(uint32_t value);
static inline void zxnextCpuDelayMemoryRead(uint32_t address);
static inline void zxnextCpuDelayMemoryWrite(uint32_t address);
static inline void zxnextCpuDelayPortAccess(uint32_t address);
static inline uint32_t zxnextCpuShouldRaiseInt(void);
static inline void zxnextCpuCaptureVideoInterrupts(void);

/* zxnext.vhd ~1784: during a stackless NMI acknowledge (`z80_stackless_nmi`) the CPU's push cycles run
   with MREQ held high - SP moves and the cycles take their time, but no byte reaches memory. */
static uint8_t zxnextCpuMreqSuppressed;

#define Z80_EXTERNAL_BUS 1
#define Z80_MEMORY_PTR() zxnextMemory
#define Z80_READ_MEMORY(address) zxnextCpuSharedReadMemory(address)
#define Z80_FETCH_CODE_BYTE(address) zxnextCpuSharedFetchCodeByte(address)
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
  // --- The picture of the frame that just ended, before anything resets for the next one.
  zxnextRasterFinishFrame();
  frames++;
  frameCompleted = 1;
  zxnextUlaOnFrameCompleted();
  zxnextCopperOnFrameCompleted();
  /* The next frame runs on the raster NextReg $03 selects now (NextComposedScreenDevice.onNewFrame) */
  zxnextTimingSelect();
}

static inline void zxnextCpuTactPlusN(uint32_t value) {
  cpu.tacts += value;
  tacts += value;
  frameTacts28 += value * zxnextCpuTactScale();
  while (frameTacts28 >= ZXNEXT_TACTS_IN_FRAME) {
    zxnextCtcOnFrameCompleted();
    frameTacts28 -= ZXNEXT_TACTS_IN_FRAME;
    zxnextAudioMixerOnFrameWrap();
    zxnextCpuMarkFrameCompleted();
  }
  currentFrameTact = frameTacts28 >> 2;
  // Advance the copper's beam to the current ULA tact. The `frameCompleted` guard mirrors
  // `ZxNextMachine.onTactIncremented`, which returns early once the frame is done: a frame
  // can complete part-way through an instruction, and the remaining tact groups of that
  // instruction must not tick the copper into the next frame.
  if (frameCompleted == 0u) zxnextCopperAdvanceTo(currentFrameTact);
  zxnextCpuCaptureVideoInterrupts();
  zxnextBeeperSetTacts(tacts);
  zxnextAudioMixerSetNextSample(frameTacts28);
}

/*
 * Charge a DMA byte's clocks. The DMA runs from the 28 MHz system clock, so its clocks go to the
 * frame unscaled, and the CPU T-state counters advance by the equivalent (at least one), as in
 * ZxNextMachine.tactPlusDmaTicks.
 */
static inline void zxnextCpuTactPlusDmaTicks(uint32_t ticks) {
  const uint32_t scale = zxnextCpuTactScale();
  uint32_t cpuTacts = (ticks + scale - 1u) / scale;
  if (cpuTacts == 0u) cpuTacts = 1u;
  cpu.tacts += cpuTacts;
  tacts += cpuTacts;
  frameTacts28 += ticks;
  while (frameTacts28 >= ZXNEXT_TACTS_IN_FRAME) {
    zxnextCtcOnFrameCompleted();
    frameTacts28 -= ZXNEXT_TACTS_IN_FRAME;
    zxnextAudioMixerOnFrameWrap();
    zxnextCpuMarkFrameCompleted();
  }
  currentFrameTact = frameTacts28 >> 2;
  if (frameCompleted == 0u) zxnextCopperAdvanceTo(currentFrameTact);
  zxnextCpuCaptureVideoInterrupts();
  zxnextBeeperSetTacts(tacts);
  zxnextAudioMixerSetNextSample(frameTacts28);
}

/*
 * Run the DMA while it owns, or is about to request, the bus (ZxNextMachine.runDmaUntilCpuCanRun).
 *
 * Called before every instruction. The CPU grants a bus request at once, and a continuous transfer
 * keeps the bus until its block is done, so the whole block moves before the next instruction. Byte
 * mode and paced burst mode release the bus between bytes and let the CPU run in between.
 */
static void zxnextCpuRunDma(void) {
  if (!zxnextDmaIsActive()) return;
  for (uint32_t step = 0; step < 0x20000u; step++) {
    zxnextDmaAcknowledgeBusIfRequested();
    const uint32_t ticks = zxnextDmaStep();
    if (ticks > 0u) {
      zxnextCpuTactPlusDmaTicks(ticks);
      if (zxnextInterruptsDmaRequestActive()) zxnextDmaSetDelay(1u);
    }
    if (!zxnextDmaBusRequested()) break;
  }
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

/*
 * The video interrupt sources at the last rendered tact, and their status flags.
 *
 * Mirrors ZxNextMachine.onTactIncremented: the ULA and line pulses set their status flags on the rising
 * edge (when the source is enabled), which is what hardware IM2 mode's daisy chain reads. Before this,
 * nothing in the WASM core ever set them from the video timing.
 */
static uint8_t zxnextCpuPrevUlaPulse;
static uint8_t zxnextCpuPrevLinePulse;

static inline void zxnextCpuCaptureVideoInterrupts(void) {
  uint32_t renderedFrameTact = currentFrameTact == 0u ? 0u : currentFrameTact - 1u;
  uint8_t ulaPulse = (uint8_t)zxnextUlaGetPulseIntActive(renderedFrameTact);
  uint8_t linePulse = (uint8_t)zxnextVideoLineIntActive(renderedFrameTact);
  if (ulaPulse && !zxnextCpuPrevUlaPulse && !ulaInterruptDisabled) zxnextInterruptsRequest(ZXNEXT_INT_ULA, 1, 0);
  if (linePulse && !zxnextCpuPrevLinePulse && lineInterruptEnabled) zxnextInterruptsRequest(ZXNEXT_INT_LINE, 1, 0);
  zxnextCpuPrevUlaPulse = ulaPulse;
  zxnextCpuPrevLinePulse = linePulse;
}

static inline uint32_t zxnextCpuShouldRaiseInt(void) {
  zxnextCtcSync();
  if (zxnextInterruptsGetHardwareIm2Mode()) {
    /* The chain interrupts a CPU in IM 2 only; the ULA (EXCEPTION) and requests raised while the CPU was
       not in IM 2 pulse instead */
    uint32_t renderedFrameTact = currentFrameTact == 0u ? 0u : currentFrameTact - 1u;
    return zxnextInterruptsShouldAcceptInt() ||
      (z80GetInterruptMode() != 2u && frames != 0u && !ulaInterruptDisabled && zxnextUlaGetPulseIntActive(renderedFrameTact)) ||
      zxnextInterruptsPulseActive();
  }
  // --- Pulse mode: any enabled source starts the INT pulse (peripherals.vhd `o_pulse_en`). The ULA frame
  // --- interrupt obeys its disable bit; the line interrupt used to be missing altogether.
  uint32_t renderedFrameTact = currentFrameTact == 0u ? 0u : currentFrameTact - 1u;
  return zxnextInterruptsGetSignalInt() ||
    (frames != 0u && !ulaInterruptDisabled && zxnextUlaGetPulseIntActive(renderedFrameTact)) ||
    (lineInterruptEnabled && zxnextVideoLineIntActive(renderedFrameTact)) ||
    zxnextInterruptsPulseActive() ||
    zxnextDmaGetIpSignal();
}

/* ~4472: in +3 timing banks 4-7 (MMU pages $08-$0F) are contended; the page is the MMU's */
static inline void zxnextCpuLatchP3FloatingBus(uint32_t address, uint32_t value) {
  if (zxnextNextRegGetMachineTiming() != 3u) return;
  if ((zxnextNextRegs[0x50u + ((address >> 13) & 0x07u)] & 0xf8u) == 0x08u) zxnextP3FloatingBus = (uint8_t)value;
}

static uint32_t zxnextCpuSharedReadMemory(uint32_t address) {
  uint32_t value = zxnextMemoryReadMapped(address & 0xffffu);
  zxnextCpuLatchP3FloatingBus(address, value);
  lastMemoryAddress = (uint16_t)address;
  lastMemoryValue = (uint8_t)value;
  lastMemoryAccessed = 1;
  lastMemoryIsWrite = 0;
  return value;
}

static uint32_t zxnextCpuSharedFetchCodeByte(uint32_t address) {
  const uint32_t normalized = address & 0xffffu;
  zxnextCpuDelayMemoryRead(normalized);
  uint32_t value = zxnextMemoryPeekMapped(normalized);
  zxnextCpuLatchP3FloatingBus(normalized, value);
  return value;
}

static void zxnextCpuSharedWriteMemory(uint32_t address, uint32_t value) {
  if (zxnextCpuMreqSuppressed) return;
  zxnextMemoryWriteMapped(address & 0xffffu, value & 0xffu);
  zxnextCpuLatchP3FloatingBus(address, value);
  lastMemoryAddress = (uint16_t)address;
  lastMemoryValue = (uint8_t)value;
  lastMemoryAccessed = 1;
  lastMemoryIsWrite = 1;
}

static uint32_t zxnextCpuSharedReadPort(uint32_t address) {
  return zxnextPortsRead(address & 0xffffu);
}

static void zxnextCpuSharedWritePort(uint32_t address, uint32_t value) {
  zxnextPortsWrite(address & 0xffffu, value & 0xffu);
}

/* NEXTREG n,v / n,A: zxnext.vhd ~4719-4725 requests the write with the instruction's own register
   number; `nr_register` (the $243B selection) changes only on a $243B write. */
static void zxnextCpuSharedWriteTbBlue(uint32_t address, uint32_t value) {
  zxnextNextRegSetDirect(address & 0xffu, value & 0xffu);
}

static void zxnextCpuSyncFrameState(uint32_t previousTacts, uint32_t currentTacts) {
  (void)previousTacts;
  tacts = currentTacts;
}

static void zxnextCpuClearInstructionAccesses(void) {
  lastMemoryAddress = 0;
  lastMemoryValue = 0;
  lastMemoryAccessed = 0;
  lastMemoryIsWrite = 0;
  lastPortAddress = 0;
  lastPortValue = 0;
  lastPortAccessed = 0;
  lastPortIsWrite = 0;
}

static void zxnextCpuReset(void) {
  zxnextSharedCpuExecutedInstructions = 0;
  z80Reset();
  z80SetZ80NMode(1);
  z80SetTacts(tacts);
}

static uint32_t zxnextCpuExecuteInstruction(void) {
  uint16_t pcBefore = (uint16_t)z80GetPc();
  uint32_t previousTacts = z80GetTacts();
  uint8_t rawIntSignal = zxnextCpuShouldRaiseInt() != 0u;
  uint8_t shouldAcceptInt = rawIntSignal && z80GetIff1();
  uint8_t nmiSignal = zxnextNmiGetSignal();
  uint8_t wasHalted = z80GetHalted() != 0u;
  uint8_t isRetiInstruction = zxnextMemoryPeekMapped(pcBefore) == 0xedu &&
    zxnextMemoryPeekMapped((pcBefore + 1u) & 0xffffu) == 0x4du;
  uint32_t cyclesExecuted = 0;

  frameCompleted = 0;
  if (!wasHalted || nmiSignal || shouldAcceptInt) {
    zxnextCpuClearInstructionAccesses();
  }

  // --- The DMA goes first, after the INT line is sampled, as in ZxNextMachine.beforeInstructionExecuted.
  cpuTactScale = 8u >> (cpuEffectiveSpeed & 0x03u);
  zxnextCpuRunDma();
  /* zxnext.vhd ~2008-2041: the acknowledge's push always lands in $C2/$C3; with $C0 bit 3 it does not
     reach memory. The pushed address is past a HALT, as removeFromHaltedState makes it. */
  uint16_t nmiReturnAddress = (uint16_t)(pcBefore + (wasHalted ? 1u : 0u));
  zxnextCpuMreqSuppressed = nmiSignal && zxnextNmiGetStacklessEnabled();

  cpuTactScale = 8u >> (cpuEffectiveSpeed & 0x03u);
  zxnextDivMmcBeforeOpcodeFetch(pcBefore);
  /* An NMI acknowledge fetches no opcode; the state machine steps at real opcode fetches only. */
  if (!nmiSignal) zxnextNmiBeforeOpcodeFetch(pcBefore);
  z80SetSigNmi(nmiSignal);
  z80SetSigInt(rawIntSignal);
  /* The acknowledge moves a device to S_ACK, so it must happen only when the core really takes the
     interrupt: not on the instruction after EI (the core decrements eiBacklog first), not with a prefix
     pending or an NMI in front of it - and only a CPU in IM 2 acknowledges the chain (im2_device
     i_im2_mode); an IM 0/1 acceptance of the ULA pulse leaves the chain alone. */
  uint8_t intTaken = shouldAcceptInt && !nmiSignal && z80GetPrefix() == 0u && z80GetEiBacklog() <= 1u;
  if (intTaken) {
    z80SetInterruptVector(zxnextInterruptsGetHardwareIm2Mode() && z80GetInterruptMode() == 2u
      ? zxnextInterruptsAcknowledge() : 0xffu);
  }

  do {
    z80ExecuteCpuCycle();
    cyclesExecuted++;
  } while (z80GetPrefix() != 0 && cyclesExecuted < 4u);

  zxnextCpuMreqSuppressed = 0u;
  zxnextSharedCpuExecutedInstructions++;
  zxnextCpuSyncFrameState(previousTacts, z80GetTacts());

  if (nmiSignal) {
    zxnextNmiSetReturnAddress(nmiReturnAddress);
    zxnextNmiMarkAccepted();
  }
  if (isRetiInstruction) {
    zxnextInterruptsReti();
    // --- RETI in hardware IM2 mode also lifts the DMA's interrupt stall (ZxNextMachine.onRetnExecuted).
    if (zxnextInterruptsGetHardwareIm2Mode()) zxnextDmaSetDelay(0u);
  }
  /* divmmc_retn_seen <= retn and not mf_is_active (~4091): a RETN that ends a Multiface NMI does not
     reach DivMMC. cpu_retn_seen clears the Multiface state unconditionally. */
  uint32_t mfWasActive = 0u;
  if (z80GetRetnExecuted()) {
    mfWasActive = zxnextMultifaceIsActive();
    zxnextMultifaceRetn();
  }
  if (z80GetRetnExecuted()) {
    uint8_t stacklessProcessed = zxnextNmiGetStacklessProcessed();
    uint32_t stacklessReturnAddress = zxnextNmiGetReturnAddress();
    zxnextNmiAfterRetn();
    if (stacklessProcessed) {
      z80SetPc(stacklessReturnAddress);
    }
  }
  zxnextDivMmcAfterOpcodeFetch(z80GetRetnExecuted(), mfWasActive);
  if (z80GetRetExecuted()) {
    z80SetRetExecuted(0);
  }
  zxnextPsgCalculateCurrentAudioValue(frameTacts28);
  zxnextTraceRecordInstruction(pcBefore);
  return zxnextSharedCpuExecutedInstructions;
}
