/*
 * A test-only translation unit for the shared Z80 core's machine hooks that no Spectrum, Next or
 * Z88 core defines: Z80_REFRESH, the opcode-substitution contract of Z80_AFTER_OPCODE_FETCH,
 * Z80_NMI_ACK_WAIT and Z80_INT_ACK (`.plans/ZX8081_WASM_PLAN.md` §5, C1-C3). It records what each
 * hook sees, so `z80-hooks.test.ts` can pin where the core calls it. It is not a machine.
 */
#include <stdint.h>

#define HOOK_LOG_CAPACITY 64u

static uint32_t refreshAddress[HOOK_LOG_CAPACITY];
static uint32_t refreshTacts[HOOK_LOG_CAPACITY];
static uint32_t refreshCount;
static uint32_t forceNopAbove;   /* 0: off; otherwise force NOP for M1 at or above this address */
static uint32_t nmiWaitTacts;
static uint32_t nmiAckWaitTacts; /* cpu.tacts when Z80_NMI_ACK_WAIT ran */
static uint32_t nmiAckWaitCount;
static uint32_t intAckTacts;
static uint32_t intAckCount;
static uint32_t lastForcedOpcode;

static void hookRefresh(uint16_t address);
static void hookAfterOpcodeFetch(void);
static void hookNmiAckWait(void);
static void hookIntAck(void);

#define Z80_REFRESH(address) hookRefresh(address)
#define Z80_AFTER_OPCODE_FETCH() hookAfterOpcodeFetch()
#define Z80_NMI_ACK_WAIT() hookNmiAckWait()
#define Z80_INT_ACK() hookIntAck()

#include "../../../src/emu/z80/wasm/z80.c"

static void hookRefresh(uint16_t address) {
  if (refreshCount < HOOK_LOG_CAPACITY) {
    refreshAddress[refreshCount] = address;
    refreshTacts[refreshCount] = cpu.tacts;
  }
  refreshCount++;
}

static void hookAfterOpcodeFetch(void) {
  if (forceNopAbove && cpu.pc >= forceNopAbove && !(cpu.opCode & 0x40)) {
    lastForcedOpcode = cpu.opCode;
    cpu.opCode = 0x00;
  }
}

static void hookNmiAckWait(void) {
  nmiAckWaitTacts = cpu.tacts;
  nmiAckWaitCount++;
  tactPlusN(nmiWaitTacts);
}

static void hookIntAck(void) {
  intAckTacts = cpu.tacts;
  intAckCount++;
}

void hooksClear(void) {
  refreshCount = 0;
  nmiAckWaitCount = 0;
  intAckCount = 0;
  lastForcedOpcode = 0xffffffffu;
}
uint32_t hooksRefreshCount(void) { return refreshCount; }
uint32_t hooksRefreshAddress(uint32_t index) { return refreshAddress[index % HOOK_LOG_CAPACITY]; }
uint32_t hooksRefreshTacts(uint32_t index) { return refreshTacts[index % HOOK_LOG_CAPACITY]; }
void hooksSetForceNopAbove(uint32_t address) { forceNopAbove = address; }
uint32_t hooksLastForcedOpcode(void) { return lastForcedOpcode; }
void hooksSetNmiWaitTacts(uint32_t value) { nmiWaitTacts = value; }
uint32_t hooksNmiAckWaitTacts(void) { return nmiAckWaitTacts; }
uint32_t hooksNmiAckWaitCount(void) { return nmiAckWaitCount; }
uint32_t hooksIntAckTacts(void) { return intAckTacts; }
uint32_t hooksIntAckCount(void) { return intAckCount; }
