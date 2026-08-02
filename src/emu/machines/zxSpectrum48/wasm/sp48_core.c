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
static unsigned char border_color;
static unsigned char ear_latch;
static unsigned char mic_latch;
static unsigned char is_16k_model;
static unsigned char machine_state_block[SP48_MACHINE_STATE_BLOCK_SIZE];
static unsigned char input_block[SP48_INPUT_BLOCK_SIZE];
static unsigned char result_block[SP48_RESULT_BLOCK_SIZE];
static unsigned char event_buffer[SP48_EVENT_BUFFER_SIZE];
static unsigned char dirty_ranges[SP48_DIRTY_RANGE_CAPACITY * SP48_DIRTY_RANGE_RECORD_SIZE];
static unsigned char contention_table[SP48_TIMING_TABLE_CAPACITY];
static uint16_t floating_bus_table[SP48_TIMING_TABLE_CAPACITY];
static unsigned char tape_ear_table[SP48_TAPE_EAR_TABLE_CAPACITY];
static unsigned int dirty_range_count;
static unsigned int border_trace_count;
static unsigned int audio_trace_count;
static unsigned int tape_save_trace_count;
static unsigned int event_status;

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
    case 8: return SP48_TIMING_TABLE_CAPACITY;
    case 9: return SP48_FLOATING_BUS_NONE;
    case 10: return SP48_BORDER_TRACE_RECORD_SIZE;
    case 11: return SP48_BORDER_TRACE_CAPACITY;
    case 12: return SP48_BORDER_TRACE_OFFSET;
    case 13: return SP48_AUDIO_TRACE_RECORD_SIZE;
    case 14: return SP48_AUDIO_TRACE_CAPACITY;
    case 15: return SP48_AUDIO_TRACE_OFFSET;
    case 16: return SP48_EVENT_STATUS_AUDIO_OVERFLOW_MASK;
    case 17: return SP48_TAPE_SAVE_TRACE_RECORD_SIZE;
    case 18: return SP48_TAPE_SAVE_TRACE_CAPACITY;
    case 19: return SP48_TAPE_SAVE_TRACE_OFFSET;
    case 20: return SP48_TAPE_EAR_TABLE_CAPACITY;
    case 21: return SP48_EVENT_STATUS_TAPE_SAVE_OVERFLOW_MASK;
    case 22: return SP48_DEBUG_ACCESS_LOG_CAPACITY;
    case 23: return SP48_DEBUG_ACCESS_LOG_RECORD_SIZE;
    case 24: return SP48_MACHINE_STATE_CPU_STATE_OFFSET;
    case 25: return SP48_MACHINE_STATE_FRAME_TACTS_OFFSET;
    case 26: return SP48_MACHINE_STATE_ULA_PORT_OFFSET;
    case 27: return SP48_MACHINE_STATE_IS_16K_MODEL_OFFSET;
    case 28: return SP48_MACHINE_STATE_BORDER_COLOR_OFFSET;
    case 29: return SP48_MACHINE_STATE_EAR_LATCH_OFFSET;
    case 30: return SP48_MACHINE_STATE_MIC_LATCH_OFFSET;
    case 31: return SP48_INPUT_KEYBOARD_ROWS_OFFSET;
    case 32: return SP48_INPUT_RUN_MODE_OFFSET;
    case 33: return SP48_INPUT_TAPE_MODE_OFFSET;
    case 34: return SP48_INPUT_TAPE_EAR_DEFAULT_OFFSET;
    case 35: return SP48_INPUT_TERMINATION_POINT_OFFSET;
    case 36: return SP48_INPUT_TERMINATION_POINT_ENABLED_OFFSET;
    case 37: return SP48_RESULT_TERMINATION_OFFSET;
    case 38: return SP48_RESULT_EVENT_COUNT_OFFSET;
    case 39: return SP48_RESULT_DIRTY_RANGE_COUNT_OFFSET;
    case 40: return SP48_RESULT_INSTRUCTION_COUNT_OFFSET;
    case 41: return SP48_RESULT_CPU_STATUS_OFFSET;
    case 42: return SP48_RESULT_BORDER_TRACE_COUNT_OFFSET;
    case 43: return SP48_RESULT_AUDIO_TRACE_COUNT_OFFSET;
    case 44: return SP48_RESULT_EVENT_STATUS_OFFSET;
    case 45: return SP48_RESULT_TAPE_SAVE_TRACE_COUNT_OFFSET;
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

static void advance_tacts(unsigned int tacts) {
  state.tacts += tacts;
  state.frame_tacts += tacts;
  while (state.frame_tacts >= state.tacts_in_frame && state.tacts_in_frame != 0u) {
    state.frames++;
    state.frame_tacts -= state.tacts_in_frame;
  }
}

static unsigned int future_frame_tact(unsigned int offset) {
  unsigned int tact;
  if (state.tacts_in_frame == 0u) return state.frame_tacts;
  tact = state.frame_tacts + offset;
  while (tact >= state.tacts_in_frame) tact -= state.tacts_in_frame;
  return tact;
}

static unsigned int contention_delay_at_current_tact(void) {
  if (state.frame_tacts >= SP48_TIMING_TABLE_CAPACITY) return 0;
  return contention_table[state.frame_tacts];
}

static unsigned int contention_delay_at_tact(unsigned int tact) {
  if (state.tacts_in_frame != 0u) {
    while (tact >= state.tacts_in_frame) tact -= state.tacts_in_frame;
  }
  if (tact >= SP48_TIMING_TABLE_CAPACITY) return 0;
  return contention_table[tact];
}

static void apply_contention_delay_at_current_tact(void) {
  advance_tacts(contention_delay_at_current_tact());
}

static void apply_memory_contention(uint16_t address) {
  if ((address & 0xc000u) == 0x4000u) {
    apply_contention_delay_at_current_tact();
  }
}

static void apply_port_contention(uint16_t address) {
  unsigned int added = 0;
  unsigned int tact = state.frame_tacts;
  unsigned int delay;
  unsigned int lowbit = (address & 1u) != 0;
  if ((address & 0xc000u) == 0x4000u) {
    delay = contention_delay_at_tact(tact);
    added += delay;
    tact += delay;
    if (lowbit) {
      tact += 1u;
      delay = contention_delay_at_tact(tact);
      added += delay;
      tact += delay + 1u;
      delay = contention_delay_at_tact(tact);
      added += delay;
      tact += delay + 1u;
      delay = contention_delay_at_tact(tact);
      added += delay;
    } else {
      tact += 1u;
      delay = contention_delay_at_tact(tact);
      added += delay;
    }
  } else if ((address & 1u) == 0) {
    tact += 1u;
    delay = contention_delay_at_tact(tact);
    added += delay;
  }
  advance_tacts(added);
}

static unsigned int read_floating_bus_at(unsigned int tact) {
  uint16_t address;
  if (state.tacts_in_frame == 0u) return 0xffu;
  while (tact >= state.tacts_in_frame) tact -= state.tacts_in_frame;
  if (tact >= SP48_TIMING_TABLE_CAPACITY) return 0xffu;
  address = floating_bus_table[tact];
  return address == SP48_FLOATING_BUS_NONE ? 0xffu : memory[address];
}

static unsigned int read_sp48_floating_bus(unsigned int current_frame_tact) {
  if (state.tacts_in_frame == 0u) return 0xffu;
  return read_floating_bus_at(current_frame_tact + state.tacts_in_frame - 5u);
}

static void record_border_trace(unsigned int tact, unsigned int value) {
  unsigned int offset;
  if (border_trace_count >= SP48_BORDER_TRACE_CAPACITY) return;
  offset = SP48_BORDER_TRACE_OFFSET + border_trace_count * SP48_BORDER_TRACE_RECORD_SIZE;
  put_u32(event_buffer, offset, tact);
  event_buffer[offset + 4u] = (unsigned char)value;
  event_buffer[offset + 5u] = border_color;
  event_buffer[offset + 6u] = ear_latch;
  event_buffer[offset + 7u] = mic_latch;
  border_trace_count++;
  put_u32(result_block, SP48_RESULT_EVENT_COUNT_OFFSET, border_trace_count + audio_trace_count);
  put_u32(result_block, SP48_RESULT_BORDER_TRACE_COUNT_OFFSET, border_trace_count);
}

static void record_audio_trace(unsigned int tact, unsigned int value) {
  unsigned int offset;
  if (audio_trace_count >= SP48_AUDIO_TRACE_CAPACITY) {
    event_status |= SP48_EVENT_STATUS_AUDIO_OVERFLOW_MASK;
    put_u32(result_block, SP48_RESULT_EVENT_STATUS_OFFSET, event_status);
    return;
  }
  offset = SP48_AUDIO_TRACE_OFFSET + audio_trace_count * SP48_AUDIO_TRACE_RECORD_SIZE;
  put_u32(event_buffer, offset, tact);
  event_buffer[offset + 4u] = (unsigned char)value;
  event_buffer[offset + 5u] = ear_latch;
  event_buffer[offset + 6u] = mic_latch;
  event_buffer[offset + 7u] = 0;
  audio_trace_count++;
  put_u32(result_block, SP48_RESULT_EVENT_COUNT_OFFSET, border_trace_count + audio_trace_count + tape_save_trace_count);
  put_u32(result_block, SP48_RESULT_AUDIO_TRACE_COUNT_OFFSET, audio_trace_count);
}

static void record_tape_save_trace(unsigned int tact, unsigned int value) {
  unsigned int offset;
  if (tape_save_trace_count >= SP48_TAPE_SAVE_TRACE_CAPACITY) {
    event_status |= SP48_EVENT_STATUS_TAPE_SAVE_OVERFLOW_MASK;
    put_u32(result_block, SP48_RESULT_EVENT_STATUS_OFFSET, event_status);
    return;
  }
  offset = SP48_TAPE_SAVE_TRACE_OFFSET + tape_save_trace_count * SP48_TAPE_SAVE_TRACE_RECORD_SIZE;
  put_u32(event_buffer, offset, tact);
  event_buffer[offset + 4u] = (unsigned char)value;
  event_buffer[offset + 5u] = mic_latch;
  event_buffer[offset + 6u] = ear_latch;
  event_buffer[offset + 7u] = 0;
  tape_save_trace_count++;
  put_u32(result_block, SP48_RESULT_EVENT_COUNT_OFFSET, border_trace_count + audio_trace_count + tape_save_trace_count);
  put_u32(result_block, SP48_RESULT_TAPE_SAVE_TRACE_COUNT_OFFSET, tape_save_trace_count);
}

static unsigned int read_tape_ear_at_current_tact(void) {
  unsigned int tact = state.frame_tacts;
  if (state.tacts_in_frame != 0u) {
    while (tact >= state.tacts_in_frame) tact -= state.tacts_in_frame;
  }
  if (tact >= SP48_TAPE_EAR_TABLE_CAPACITY) {
    return input_block[SP48_INPUT_TAPE_EAR_DEFAULT_OFFSET] != 0;
  }
  return tape_ear_table[tact] != 0;
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

unsigned int sp48_contention_table_ptr(void) { return (unsigned int)contention_table; }

unsigned int sp48_floating_bus_table_ptr(void) { return (unsigned int)floating_bus_table; }

unsigned int sp48_tape_ear_table_ptr(void) { return (unsigned int)tape_ear_table; }

unsigned int sp48_timing_table_capacity(void) { return SP48_TIMING_TABLE_CAPACITY; }

unsigned int sp48_dirty_range_count(void) { return dirty_range_count; }

unsigned int sp48_border_trace_count(void) { return border_trace_count; }

unsigned int sp48_audio_trace_count(void) { return audio_trace_count; }

unsigned int sp48_tape_save_trace_count(void) { return tape_save_trace_count; }

unsigned int sp48_event_status(void) { return event_status; }

unsigned int sp48_debug_memory_log_count(void) { return memory_log_count; }

unsigned int sp48_debug_memory_log_ptr(void) { return (unsigned int)memory_log; }

unsigned int sp48_debug_io_log_count(void) { return io_log_count; }

unsigned int sp48_debug_io_log_ptr(void) { return (unsigned int)io_log; }

void sp48_clear_dirty_ranges(void) {
  unsigned int index;
  dirty_range_count = 0;
  put_u32(result_block, SP48_RESULT_DIRTY_RANGE_COUNT_OFFSET, 0);
  for (index = 0; index < SP48_DIRTY_RANGE_CAPACITY * SP48_DIRTY_RANGE_RECORD_SIZE; index++) {
    dirty_ranges[index] = 0;
  }
}

void sp48_clear_border_trace(void) {
  unsigned int index;
  border_trace_count = 0;
  put_u32(result_block, SP48_RESULT_EVENT_COUNT_OFFSET, audio_trace_count + tape_save_trace_count);
  put_u32(result_block, SP48_RESULT_BORDER_TRACE_COUNT_OFFSET, 0);
  for (index = 0; index < SP48_BORDER_TRACE_CAPACITY * SP48_BORDER_TRACE_RECORD_SIZE; index++) {
    event_buffer[SP48_BORDER_TRACE_OFFSET + index] = 0;
  }
}

void sp48_clear_audio_trace(void) {
  unsigned int index;
  audio_trace_count = 0;
  event_status &= (unsigned int)~SP48_EVENT_STATUS_AUDIO_OVERFLOW_MASK;
  put_u32(result_block, SP48_RESULT_EVENT_COUNT_OFFSET, border_trace_count + tape_save_trace_count);
  put_u32(result_block, SP48_RESULT_AUDIO_TRACE_COUNT_OFFSET, 0);
  put_u32(result_block, SP48_RESULT_EVENT_STATUS_OFFSET, event_status);
  for (index = 0; index < SP48_AUDIO_TRACE_CAPACITY * SP48_AUDIO_TRACE_RECORD_SIZE; index++) {
    event_buffer[SP48_AUDIO_TRACE_OFFSET + index] = 0;
  }
}

void sp48_clear_tape_save_trace(void) {
  unsigned int index;
  tape_save_trace_count = 0;
  event_status &= (unsigned int)~SP48_EVENT_STATUS_TAPE_SAVE_OVERFLOW_MASK;
  put_u32(result_block, SP48_RESULT_EVENT_COUNT_OFFSET, border_trace_count + audio_trace_count);
  put_u32(result_block, SP48_RESULT_TAPE_SAVE_TRACE_COUNT_OFFSET, 0);
  put_u32(result_block, SP48_RESULT_EVENT_STATUS_OFFSET, event_status);
  for (index = 0; index < SP48_TAPE_SAVE_TRACE_CAPACITY * SP48_TAPE_SAVE_TRACE_RECORD_SIZE; index++) {
    event_buffer[SP48_TAPE_SAVE_TRACE_OFFSET + index] = 0;
  }
}

static void sp48_clear_event_traces(void) {
  unsigned int index;
  border_trace_count = 0;
  audio_trace_count = 0;
  tape_save_trace_count = 0;
  event_status = 0;
  put_u32(result_block, SP48_RESULT_EVENT_COUNT_OFFSET, 0);
  put_u32(result_block, SP48_RESULT_BORDER_TRACE_COUNT_OFFSET, 0);
  put_u32(result_block, SP48_RESULT_AUDIO_TRACE_COUNT_OFFSET, 0);
  put_u32(result_block, SP48_RESULT_TAPE_SAVE_TRACE_COUNT_OFFSET, 0);
  put_u32(result_block, SP48_RESULT_EVENT_STATUS_OFFSET, 0);
  for (index = 0; index < SP48_EVENT_BUFFER_SIZE; index++) {
    event_buffer[index] = 0;
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
  border_color = machine_state_block[SP48_MACHINE_STATE_BORDER_COLOR_OFFSET] & 7u;
  ear_latch = machine_state_block[SP48_MACHINE_STATE_EAR_LATCH_OFFSET] != 0;
  mic_latch = machine_state_block[SP48_MACHINE_STATE_MIC_LATCH_OFFSET] != 0;
}

void sp48_export_state(void) {
  z80_state_export();
  copy_bytes(machine_state_block + SP48_MACHINE_STATE_CPU_STATE_OFFSET, z80_state_block, 64u);
  machine_state_block[SP48_MACHINE_STATE_ULA_PORT_OFFSET] = ula_port;
  machine_state_block[SP48_MACHINE_STATE_IS_16K_MODEL_OFFSET] = is_16k_model;
  machine_state_block[SP48_MACHINE_STATE_BORDER_COLOR_OFFSET] = border_color;
  machine_state_block[SP48_MACHINE_STATE_EAR_LATCH_OFFSET] = ear_latch;
  machine_state_block[SP48_MACHINE_STATE_MIC_LATCH_OFFSET] = mic_latch;
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
  border_color = 0;
  ear_latch = 0;
  mic_latch = 0;
  z80_bus_mode = Z80_BUS_SP48;
  z80_reset();
  sp48_clear_dirty_ranges();
  sp48_clear_event_traces();
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
  unsigned int lines;
  unsigned int status;
  unsigned int line;
  if ((address & 1u) != 0) return read_sp48_floating_bus(state.frame_tacts);
  lines = (~(address >> 8)) & 0xffu;
  status = 0;
  for (line = 0; line < 8u; line++) {
    if ((lines & (1u << line)) != 0) {
      status |= input_block[SP48_INPUT_KEYBOARD_ROWS_OFFSET + line];
    }
  }
  return (unsigned int)(((~status) & 0xbfu) | ((input_block[SP48_INPUT_TAPE_MODE_OFFSET] == 1u
    ? read_tape_ear_at_current_tact()
    : ear_latch) ? 0x40u : 0u));
}

void sp48_write_port(unsigned int address, unsigned int value) {
  if ((address & 1) == 0) {
    unsigned int old_ear_latch = ear_latch;
    unsigned int old_mic_latch = mic_latch;
    ula_port = (unsigned char)value;
    border_color = ula_port & 7u;
    mic_latch = (ula_port & 0x08u) != 0;
    ear_latch = (ula_port & 0x10u) != 0;
    record_border_trace(state.frame_tacts, ula_port);
    if (old_ear_latch != ear_latch || old_mic_latch != mic_latch) {
      record_audio_trace(state.frame_tacts, ula_port);
    }
    if (input_block[SP48_INPUT_TAPE_MODE_OFFSET] == 2u && old_mic_latch != mic_latch) {
      record_tape_save_trace(state.frame_tacts, ula_port);
    }
    sp48_export_state();
  }
}

uint8_t sp48_bus_read_memory(uint16_t address, unsigned int operation) {
  (void)operation;
  apply_memory_contention(address);
  return memory[address];
}

void sp48_bus_write_memory(uint16_t address, uint8_t value) {
  apply_memory_contention(address);
  sp48_write_memory(address, value);
}

uint8_t sp48_bus_read_port(uint16_t address) {
  apply_port_contention(address);
  if ((address & 1u) != 0) return (uint8_t)read_sp48_floating_bus(future_frame_tact(4u));
  return (uint8_t)sp48_read_port(address);
}

void sp48_bus_write_port(uint16_t address, uint8_t value) {
  apply_port_contention(address);
  if ((address & 1u) == 0) {
    unsigned int saved_tact = state.frame_tacts;
    state.frame_tacts = future_frame_tact(4u);
    sp48_write_port(address, value);
    state.frame_tacts = saved_tact;
  }
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
  sp48_clear_event_traces();
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

unsigned int sp48_execute_frame(void) {
  unsigned int start_frames;
  sp48_import_state();
  z80_bus_mode = Z80_BUS_SP48;
  sp48_clear_event_traces();
  start_frames = state.frames;
  while (state.frames == start_frames) {
    unsigned int cpu_status;
    state.signals = state.frame_tacts < 32u
      ? (state.signals | Z80_SIGNAL_INT)
      : (state.signals & (unsigned int)~Z80_SIGNAL_INT);
    do {
      cpu_status = z80_cpu_execute_instruction();
    } while (cpu_status == Z80_EXECUTION_PREFIX_PENDING);
    if (cpu_status != Z80_EXECUTION_COMPLETED) {
      put_u32(result_block, SP48_RESULT_TERMINATION_OFFSET, 1u);
      put_u32(result_block, SP48_RESULT_CPU_STATUS_OFFSET, cpu_status);
      sp48_export_state();
      return 1u;
    }
  }
  put_u32(result_block, SP48_RESULT_TERMINATION_OFFSET, 0u);
  put_u32(result_block, SP48_RESULT_CPU_STATUS_OFFSET, Z80_EXECUTION_COMPLETED);
  sp48_export_state();
  return 0u;
}
