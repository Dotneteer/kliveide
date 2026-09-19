/*
 * Cambridge Z88 - the CPU's view of memory.
 *
 * Status (Step 1): placeholder. Step 4 of `.plans/CAMBRIDGE_Z88_WASM_MIGRATION_PLAN.md` replaces
 * it with the Blink's paging: eight 8K logical pages mapped by SR0-SR3 and COM.RAMS onto the 4 MB
 * physical memory, card chip masks and mirroring, the empty-slot random values, and the card
 * write rules. Until then the CPU reads $FF and its writes are ignored.
 */

static uint32_t z88CpuReadMemory(uint32_t address) {
  (void)address;
  return 0xffu;
}

static void z88CpuWriteMemory(uint32_t address, uint32_t value) {
  (void)address;
  (void)value;
}
