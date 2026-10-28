/*
 * A test-only translation unit for the shared Z80 core's M1 timing hook, Z80_DELAY_OPCODE_FETCH
 * (`.plans/VIDEOTON_TVC_PLAN.md` §5, hook H1). No production core defines it yet. The hook records
 * each address it is called with and adds the fetch's three tacts plus a configurable extra, so
 * `z80-opcode-fetch.test.ts` can pin which fetches the core treats as M1 cycles. It is not a machine.
 */
#include <stdint.h>

#define FETCH_LOG_CAPACITY 64u

static uint32_t fetchAddress[FETCH_LOG_CAPACITY];
static uint32_t fetchTacts[FETCH_LOG_CAPACITY];
static uint32_t fetchCount;
static uint32_t extraTacts;

static void hookDelayOpcodeFetch(uint16_t address);

#define Z80_DELAY_OPCODE_FETCH(address) hookDelayOpcodeFetch(address)

#include "../../../src/emu/z80/wasm/z80.c"

static void hookDelayOpcodeFetch(uint16_t address) {
  if (fetchCount < FETCH_LOG_CAPACITY) {
    fetchAddress[fetchCount] = address;
    fetchTacts[fetchCount] = cpu.tacts;
  }
  fetchCount++;
  tactPlusN(3u + extraTacts);
}

void fetchClear(void) { fetchCount = 0; }
uint32_t fetchHookCount(void) { return fetchCount; }
uint32_t fetchHookAddress(uint32_t index) { return fetchAddress[index % FETCH_LOG_CAPACITY]; }
uint32_t fetchHookTacts(uint32_t index) { return fetchTacts[index % FETCH_LOG_CAPACITY]; }
void fetchSetExtraTacts(uint32_t value) { extraTacts = value; }
