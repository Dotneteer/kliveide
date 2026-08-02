#include "sp48_core.h"
#include "../../../z80/wasm/z80_abi.h"
#include "../../../z80/wasm/z80_cpu.h"
#include "../../../z80/wasm/z80_state.h"
#include "../../../z80/wasm/z80_test_bus.h"

/*
 * The first vertical slice of the C core. Keep the ABI free of libc, pointers,
 * and host callbacks so it compiles with either clang+wasm-ld or Emscripten.
 * CPU, ULA, tape, audio, and contention move here only behind conformance tests.
 */
static unsigned char memory[SP48_MEMORY_SIZE];
static unsigned char ula_port;
static unsigned char is_16k_model;
static unsigned char machine_state_block[SP48_MACHINE_STATE_BLOCK_SIZE];
static unsigned char input_block[SP48_INPUT_BLOCK_SIZE];
static unsigned char result_block[SP48_RESULT_BLOCK_SIZE];
static unsigned char event_buffer[SP48_EVENT_BUFFER_SIZE];
static unsigned char dirty_ranges[SP48_DIRTY_RANGE_CAPACITY * SP48_DIRTY_RANGE_RECORD_SIZE];
static unsigned int dirty_range_count;

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
    case 5: return SP48_MEMORY_SIZE;
    case 6: return SP48_DIRTY_RANGE_CAPACITY;
    case 7: return SP48_DIRTY_RANGE_RECORD_SIZE;
    case 8: return SP48_MACHINE_STATE_CPU_STATE_OFFSET;
    case 9: return SP48_MACHINE_STATE_FRAME_TACTS_OFFSET;
    case 10: return SP48_MACHINE_STATE_ULA_PORT_OFFSET;
    case 11: return SP48_MACHINE_STATE_IS_16K_MODEL_OFFSET;
    case 12: return SP48_INPUT_KEYBOARD_ROWS_OFFSET;
    case 13: return SP48_INPUT_RUN_MODE_OFFSET;
    case 14: return SP48_INPUT_TERMINATION_POINT_OFFSET;
    case 15: return SP48_INPUT_TERMINATION_POINT_ENABLED_OFFSET;
    case 16: return SP48_RESULT_TERMINATION_OFFSET;
    case 17: return SP48_RESULT_EVENT_COUNT_OFFSET;
    case 18: return SP48_RESULT_DIRTY_RANGE_COUNT_OFFSET;
    case 19: return SP48_RESULT_INSTRUCTION_COUNT_OFFSET;
    case 20: return SP48_RESULT_CPU_STATUS_OFFSET;
    default: return 0;
  }
}

static void put_u16(unsigned char *target, unsigned int offset, unsigned int value) {
  target[offset] = (unsigned char)value;
  target[offset + 1u] = (unsigned char)(value >> 8);
}

static unsigned int get_u16(const unsigned char *source, unsigned int offset) {
  return (unsigned int)source[offset] | ((unsigned int)source[offset + 1u] << 8);
}

static unsigned int get_u32(const unsigned char *source, unsigned int offset) {
  return (unsigned int)source[offset]
    | ((unsigned int)source[offset + 1u] << 8)
    | ((unsigned int)source[offset + 2u] << 16)
    | ((unsigned int)source[offset + 3u] << 24);
}

static void put_u32(unsigned char *target, unsigned int offset, unsigned int value) {
  target[offset] = (unsigned char)value;
  target[offset + 1u] = (unsigned char)(value >> 8);
  target[offset + 2u] = (unsigned char)(value >> 16);
  target[offset + 3u] = (unsigned char)(value >> 24);
}

static void copy_bytes(unsigned char *target, const unsigned char *source, unsigned int length) {
  unsigned int index;
  for (index = 0; index < length; index++) target[index] = source[index];
}

static void record_dirty_range(unsigned int address, unsigned int length) {
  unsigned int offset;
  if (dirty_range_count >= SP48_DIRTY_RANGE_CAPACITY) return;
  offset = dirty_range_count * SP48_DIRTY_RANGE_RECORD_SIZE;
  put_u16(dirty_ranges, offset, address & 0xffffu);
  put_u16(dirty_ranges, offset + 2u, length & 0xffffu);
  dirty_range_count++;
  put_u32(result_block, SP48_RESULT_DIRTY_RANGE_COUNT_OFFSET, dirty_range_count);
}

unsigned int sp48_machine_state_block_ptr(void) { return (unsigned int)machine_state_block; }

unsigned int sp48_input_block_ptr(void) { return (unsigned int)input_block; }

unsigned int sp48_result_block_ptr(void) { return (unsigned int)result_block; }

unsigned int sp48_event_buffer_ptr(void) { return (unsigned int)event_buffer; }

unsigned int sp48_memory_ptr(void) { return (unsigned int)memory; }

unsigned int sp48_memory_size(void) { return SP48_MEMORY_SIZE; }

unsigned int sp48_dirty_ranges_ptr(void) { return (unsigned int)dirty_ranges; }

unsigned int sp48_dirty_range_count(void) { return dirty_range_count; }

void sp48_clear_dirty_ranges(void) {
  unsigned int index;
  dirty_range_count = 0;
  put_u32(result_block, SP48_RESULT_DIRTY_RANGE_COUNT_OFFSET, 0);
  for (index = 0; index < SP48_DIRTY_RANGE_CAPACITY * SP48_DIRTY_RANGE_RECORD_SIZE; index++) {
    dirty_ranges[index] = 0;
  }
}

void sp48_set_16k_model(unsigned int enabled) {
  is_16k_model = enabled != 0;
  sp48_export_state();
}

void sp48_import_state(void) {
  copy_bytes(z80_state_block, machine_state_block + SP48_MACHINE_STATE_CPU_STATE_OFFSET, 64u);
  z80_state_import();
  ula_port = machine_state_block[SP48_MACHINE_STATE_ULA_PORT_OFFSET];
  is_16k_model = machine_state_block[SP48_MACHINE_STATE_IS_16K_MODEL_OFFSET] != 0;
}

void sp48_export_state(void) {
  z80_state_export();
  copy_bytes(machine_state_block + SP48_MACHINE_STATE_CPU_STATE_OFFSET, z80_state_block, 64u);
  machine_state_block[SP48_MACHINE_STATE_ULA_PORT_OFFSET] = ula_port;
  machine_state_block[SP48_MACHINE_STATE_IS_16K_MODEL_OFFSET] = is_16k_model;
}

void sp48_import_snapshot(void) {
  sp48_import_state();
}

void sp48_export_snapshot(void) {
  sp48_export_state();
}

void sp48_create(void) { sp48_reset(); }

void sp48_reset(void) {
  unsigned int address;
  ula_port = 0;
  z80_bus_mode = Z80_BUS_SP48;
  z80_reset();
  sp48_clear_dirty_ranges();
  for (address = 0x4000; address < SP48_MEMORY_SIZE; address++) {
    memory[address] = is_16k_model && address >= 0x8000 ? 0xff : 0;
  }
  record_dirty_range(0x4000, 0xc000);
  put_u32(machine_state_block, SP48_MACHINE_STATE_FRAME_TACTS_OFFSET, 0);
  sp48_export_state();
}

void sp48_load_rom_byte(unsigned int address, unsigned int value) {
  if (address < 0x4000) memory[address] = (unsigned char)value;
}

unsigned int sp48_read_memory(unsigned int address) { return memory[address & 0xffff]; }

void sp48_write_memory(unsigned int address, unsigned int value) {
  address &= 0xffff;
  if (address >= 0x4000 && (!is_16k_model || address < 0x8000)) {
    memory[address] = (unsigned char)value;
    record_dirty_range(address, 1);
  }
}

void sp48_patch_memory(unsigned int address, unsigned int value) {
  address &= 0xffff;
  memory[address] = (unsigned char)value;
  record_dirty_range(address, 1);
}

unsigned int sp48_read_port(unsigned int address) {
  /* ULA read is intentionally a placeholder until keyboard/floating-bus parity. */
  return (address & 1) == 0 ? 0xff : 0xff;
}

void sp48_write_port(unsigned int address, unsigned int value) {
  if ((address & 1) == 0) {
    ula_port = (unsigned char)value;
    sp48_export_state();
  }
}

uint8_t sp48_bus_read_memory(uint16_t address, unsigned int operation) {
  (void)operation;
  return memory[address];
}

void sp48_bus_write_memory(uint16_t address, uint8_t value) {
  sp48_write_memory(address, value);
}

uint8_t sp48_bus_read_port(uint16_t address) {
  return (uint8_t)sp48_read_port(address);
}

void sp48_bus_write_port(uint16_t address, uint8_t value) {
  sp48_write_port(address, value);
}

unsigned int sp48_execute_instructions(
  unsigned int max_instructions,
  unsigned int stop_tact,
  unsigned int mode
) {
  unsigned int instructions = 0;
  unsigned int cpu_status = Z80_EXECUTION_COMPLETED;
  unsigned int start_frames;
  unsigned int termination = 0;
  unsigned int termination_point = get_u16(input_block, SP48_INPUT_TERMINATION_POINT_OFFSET);
  unsigned int termination_point_enabled =
    input_block[SP48_INPUT_TERMINATION_POINT_ENABLED_OFFSET] != 0;

  sp48_import_state();
  z80_bus_mode = Z80_BUS_SP48;
  start_frames = state.frames;
  put_u32(result_block, SP48_RESULT_TERMINATION_OFFSET, termination);
  put_u32(result_block, SP48_RESULT_INSTRUCTION_COUNT_OFFSET, 0);
  put_u32(result_block, SP48_RESULT_CPU_STATUS_OFFSET, Z80_EXECUTION_COMPLETED);

  while (instructions < max_instructions) {
    do {
      cpu_status = z80_cpu_execute_instruction();
    } while (cpu_status == Z80_EXECUTION_PREFIX_PENDING);
    instructions++;

    if (cpu_status != Z80_EXECUTION_COMPLETED) {
      termination = 1u;
      break;
    }
    if (mode == 2u && termination_point_enabled && state.pc == termination_point) {
      termination = 2u;
      break;
    }
    if (state.frames != start_frames) {
      termination = 0u;
      break;
    }
    if (stop_tact != 0u && state.frame_tacts >= stop_tact) {
      termination = 0u;
      break;
    }
  }

  put_u32(result_block, SP48_RESULT_TERMINATION_OFFSET, termination);
  put_u32(result_block, SP48_RESULT_INSTRUCTION_COUNT_OFFSET, instructions);
  put_u32(result_block, SP48_RESULT_CPU_STATUS_OFFSET, cpu_status);
  sp48_export_state();
  return termination;
}
