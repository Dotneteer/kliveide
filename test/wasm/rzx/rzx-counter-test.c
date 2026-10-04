/*
 * A test-only translation unit for the RZX module (`zx-spectrum-rzx.c`, `.plans/RZX_PLAN.md`
 * Phase 2): the shared Z80 core with the fetch counter and the IN tap wired exactly as the Spectrum
 * cores wire them, and a fixed live port value. `rzx-counter.test.ts` drives it. It is not a machine.
 */
#include <stdint.h>

static uint32_t testLivePortValue;
static uint32_t testLivePortReads;

static inline void rzxCountFetch(void);
static inline void rzxIntAck(void);
static uint32_t testCpuReadPort(uint32_t address);

#define Z80_REFRESH(address) rzxCountFetch()
#define Z80_INT_ACK() rzxIntAck()
#define Z80_READ_PORT(address) testCpuReadPort((uint32_t)(address))

#include "../../../src/emu/z80/wasm/z80.c"
#define RZX_CORE_PREFIX test
#include "../../../src/emu/machines/zxSpectrum/wasm/common/zx-spectrum-rzx.c"

/* The port the debugger reads: never tapped */
uint32_t testReadPort(uint32_t address) {
  (void)address;
  testLivePortReads++;
  return testLivePortValue;
}

/* The CPU's port read, with the tap as the Spectrum cores have it */
static uint32_t testCpuReadPort(uint32_t address) {
  if (rzxMode == RZX_MODE_OFF) return testReadPort(address);
  uint32_t value;
  if (rzxMode == RZX_MODE_PLAY && rzxPlayNextIn(&value) != 0u) return value;
  value = testReadPort(address);
  if (rzxMode == RZX_MODE_RECORD) rzxRecordIn(value);
  return value;
}

void testSetLivePort(uint32_t value) { testLivePortValue = value; }
uint32_t testGetLivePortReads(void) { return testLivePortReads; }

/* One playback step: what the core's play loop does (returns the RZX_STEP_* code) */
uint32_t testPlayStep(void) {
  const uint32_t step = rzxPlayBeforeStep();
  if (step == RZX_STEP_RUN || step == RZX_STEP_RUN_INT) {
    z80SetSigInt(step == RZX_STEP_RUN_INT ? 1u : 0u);
    z80ExecuteCpuCycle();
    z80SetSigInt(0u);
  }
  return step;
}

/* One recording step, closing a frame when `ulaFrameEnded` */
void testRecordStep(uint32_t sigInt, uint32_t ulaFrameEnded) {
  z80SetSigInt(sigInt);
  z80ExecuteCpuCycle();
  z80SetSigInt(0u);
  rzxRecAfterStep(ulaFrameEnded);
}
