#include "sp48_core.h"

/*
 * The first vertical slice of the C core. Keep the ABI free of libc, pointers,
 * and host callbacks so it compiles with either clang+wasm-ld or Emscripten.
 * CPU, ULA, tape, audio, and contention move here only behind conformance tests.
 */
static unsigned char memory[0x10000];
static unsigned char ula_port;
static unsigned char machine_state_block[SP48_MACHINE_STATE_BLOCK_SIZE];
static unsigned char input_block[SP48_INPUT_BLOCK_SIZE];
static unsigned char result_block[SP48_RESULT_BLOCK_SIZE];
static unsigned char event_buffer[SP48_EVENT_BUFFER_SIZE];

/* clang may lower simple loops to memset even with -nostdlib. */
void *memset(void *destination, int value, unsigned long length) {
  unsigned char *bytes = (unsigned char *)destination;
  unsigned long index;
  for (index = 0; index < length; index++) bytes[index] = (unsigned char)value;
  return destination;
}

unsigned int sp48_abi_version(void) { return SP48_ABI_VERSION; }

unsigned int sp48_layout_value(unsigned int id) {
  switch (id) {
    case 0: return SP48_LAYOUT_VERSION;
    case 1: return SP48_MACHINE_STATE_BLOCK_SIZE;
    case 2: return SP48_INPUT_BLOCK_SIZE;
    case 3: return SP48_RESULT_BLOCK_SIZE;
    case 4: return SP48_EVENT_BUFFER_SIZE;
    case 5: return SP48_MACHINE_STATE_CPU_STATE_OFFSET;
    case 6: return SP48_MACHINE_STATE_FRAME_TACTS_OFFSET;
    case 7: return SP48_MACHINE_STATE_ULA_PORT_OFFSET;
    case 8: return SP48_INPUT_KEYBOARD_ROWS_OFFSET;
    case 9: return SP48_INPUT_RUN_MODE_OFFSET;
    case 10: return SP48_RESULT_TERMINATION_OFFSET;
    case 11: return SP48_RESULT_EVENT_COUNT_OFFSET;
    default: return 0;
  }
}

unsigned int sp48_machine_state_block_ptr(void) { return (unsigned int)machine_state_block; }

unsigned int sp48_input_block_ptr(void) { return (unsigned int)input_block; }

unsigned int sp48_result_block_ptr(void) { return (unsigned int)result_block; }

unsigned int sp48_event_buffer_ptr(void) { return (unsigned int)event_buffer; }

void sp48_create(void) { sp48_reset(); }

void sp48_reset(void) {
  unsigned int address;
  ula_port = 0;
  for (address = 0x4000; address < 0x10000; address++) memory[address] = 0;
}

void sp48_load_rom_byte(unsigned int address, unsigned int value) {
  if (address < 0x4000) memory[address] = (unsigned char)value;
}

unsigned int sp48_read_memory(unsigned int address) { return memory[address & 0xffff]; }

void sp48_write_memory(unsigned int address, unsigned int value) {
  address &= 0xffff;
  if (address >= 0x4000) memory[address] = (unsigned char)value;
}

unsigned int sp48_read_port(unsigned int address) {
  /* ULA read is intentionally a placeholder until keyboard/floating-bus parity. */
  return (address & 1) == 0 ? 0xff : 0xff;
}

void sp48_write_port(unsigned int address, unsigned int value) {
  if ((address & 1) == 0) ula_port = (unsigned char)value;
}
