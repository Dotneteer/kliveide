#include "sp48_core.h"
#include "../../../z80/wasm/reference/fast_z80_sp48_adapter.h"
#include "../../../z80/wasm/z80_abi.h"
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
static unsigned int resume_frame_after_tape_mode_boundary;
static unsigned int diagnostics_instruction_count;
static unsigned int diagnostics_memory_read_count;
static unsigned int diagnostics_memory_write_count;
static unsigned int diagnostics_port_read_count;
static unsigned int diagnostics_port_write_count;
static unsigned int diagnostics_contention_delay_count;
static unsigned int diagnostics_floating_bus_read_count;
static unsigned int diagnostics_trace_event_count;
static unsigned int diagnostics_tape_boundary_yield_count;

static const unsigned int SP48_TAPE_MODE_PASSIVE = 0u;
static const unsigned int SP48_TAPE_LOAD_BYTES_ROUTINE = 0x056cu;
static const unsigned int SP48_TAPE_SAVE_BYTES_ROUTINE = 0x04c2u;
static const unsigned int SP48_TERMINATION_TAPE_MODE_BOUNDARY = 2u;

enum Sp48DiagnosticsCounter {
  SP48_DIAGNOSTICS_INSTRUCTIONS = 0,
  SP48_DIAGNOSTICS_MEMORY_READS = 1,
  SP48_DIAGNOSTICS_MEMORY_WRITES = 2,
  SP48_DIAGNOSTICS_PORT_READS = 3,
  SP48_DIAGNOSTICS_PORT_WRITES = 4,
  SP48_DIAGNOSTICS_CONTENTION_DELAYS = 5,
  SP48_DIAGNOSTICS_FLOATING_BUS_READS = 6,
  SP48_DIAGNOSTICS_TRACE_EVENTS = 7,
  SP48_DIAGNOSTICS_TAPE_BOUNDARY_YIELDS = 8
};

static inline unsigned int sp48_read_port_core(unsigned int address);
static void sp48_write_port_core(unsigned int address, unsigned int value, unsigned int export_state);
void sp48_bus_delay_memory_read(uint16_t address);
void sp48_bus_delay_memory_write(uint16_t address);
void sp48_bus_delay_port_read(uint16_t address);
void sp48_bus_delay_port_write(uint16_t address);
uint8_t sp48_bus_read_port_value(uint16_t address);
void sp48_bus_write_port_value(uint16_t address, uint8_t value);

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

static inline void put_u16(unsigned char *target, unsigned int offset, unsigned int value) {
  target[offset] = (unsigned char)value;
  target[offset + 1u] = (unsigned char)(value >> 8);
}

static inline unsigned int get_u16(const unsigned char *source, unsigned int offset) {
  return (unsigned int)source[offset] | ((unsigned int)source[offset + 1u] << 8);
}

static inline unsigned int get_u32(const unsigned char *source, unsigned int offset) {
  return (unsigned int)source[offset]
    | ((unsigned int)source[offset + 1u] << 8)
    | ((unsigned int)source[offset + 2u] << 16)
    | ((unsigned int)source[offset + 3u] << 24);
}

static inline void put_u32(unsigned char *target, unsigned int offset, unsigned int value) {
  target[offset] = (unsigned char)value;
  target[offset + 1u] = (unsigned char)(value >> 8);
  target[offset + 2u] = (unsigned char)(value >> 16);
  target[offset + 3u] = (unsigned char)(value >> 24);
}

static inline unsigned int normalize_frame_tact(unsigned int tact, unsigned int tacts_in_frame) {
  if (tacts_in_frame == 0u) return tact;
  if (tact < tacts_in_frame) return tact;
  tact -= tacts_in_frame;
  if (tact < tacts_in_frame) return tact;
  return tact % tacts_in_frame;
}

static inline void advance_tacts(unsigned int tacts) {
  unsigned int frame_tacts;
  unsigned int tacts_in_frame;
  state.tacts += tacts;
  frame_tacts = state.frame_tacts + tacts;
  tacts_in_frame = state.tacts_in_frame;
  if (tacts_in_frame != 0u && frame_tacts >= tacts_in_frame) {
    frame_tacts -= tacts_in_frame;
    state.frames++;
    if (frame_tacts >= tacts_in_frame) {
      state.frames += frame_tacts / tacts_in_frame;
      frame_tacts %= tacts_in_frame;
    }
  }
  state.frame_tacts = frame_tacts;
}

static inline unsigned int future_frame_tact(unsigned int offset) {
  return normalize_frame_tact(state.frame_tacts + offset, state.tacts_in_frame);
}

static inline unsigned int contention_delay_at_current_tact(void) {
  unsigned int tact = state.frame_tacts;
  if (tact >= SP48_TIMING_TABLE_CAPACITY) return 0;
  return contention_table[tact];
}

static inline unsigned int contention_delay_at_tact(unsigned int tact) {
  tact = normalize_frame_tact(tact, state.tacts_in_frame);
  if (tact >= SP48_TIMING_TABLE_CAPACITY) return 0;
  return contention_table[tact];
}

static inline void apply_memory_contention(uint16_t address) {
  if ((address & 0xc000u) == 0x4000u) {
    unsigned int delay = contention_delay_at_current_tact();
    diagnostics_contention_delay_count += delay;
    advance_tacts(delay);
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
  diagnostics_contention_delay_count += added;
  advance_tacts(added);
}

static inline unsigned int read_floating_bus_at(unsigned int tact) {
  unsigned int frame_tacts = state.tacts_in_frame;
  uint16_t address;
  if (frame_tacts == 0u) return 0xffu;
  tact = normalize_frame_tact(tact, frame_tacts);
  if (tact >= SP48_TIMING_TABLE_CAPACITY) return 0xffu;
  address = floating_bus_table[tact];
  return address == SP48_FLOATING_BUS_NONE ? 0xffu : memory[address];
}

static inline unsigned int read_sp48_floating_bus(unsigned int current_frame_tact) {
  unsigned int frame_tacts = state.tacts_in_frame;
  if (frame_tacts == 0u) return 0xffu;
  diagnostics_floating_bus_read_count++;
  return read_floating_bus_at(current_frame_tact + frame_tacts - 5u);
}

static void sync_event_result_counts(void) {
  put_u32(result_block, SP48_RESULT_EVENT_COUNT_OFFSET, border_trace_count + audio_trace_count + tape_save_trace_count);
  put_u32(result_block, SP48_RESULT_BORDER_TRACE_COUNT_OFFSET, border_trace_count);
  put_u32(result_block, SP48_RESULT_AUDIO_TRACE_COUNT_OFFSET, audio_trace_count);
  put_u32(result_block, SP48_RESULT_TAPE_SAVE_TRACE_COUNT_OFFSET, tape_save_trace_count);
  put_u32(result_block, SP48_RESULT_EVENT_STATUS_OFFSET, event_status);
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
  diagnostics_trace_event_count++;
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
  diagnostics_trace_event_count++;
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
  diagnostics_trace_event_count++;
}

static inline unsigned int read_tape_ear_at_current_tact(void) {
  unsigned int tact = normalize_frame_tact(state.frame_tacts, state.tacts_in_frame);
  if (tact >= SP48_TAPE_EAR_TABLE_CAPACITY) {
    return input_block[SP48_INPUT_TAPE_EAR_DEFAULT_OFFSET] != 0;
  }
  return tape_ear_table[tact] != 0;
}

static inline unsigned int should_yield_for_tape_mode_boundary(void) {
  if (input_block[SP48_INPUT_TAPE_MODE_OFFSET] != SP48_TAPE_MODE_PASSIVE) return 0u;
  return state.pc == SP48_TAPE_LOAD_BYTES_ROUTINE ||
    state.pc == SP48_TAPE_SAVE_BYTES_ROUTINE;
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

void sp48_diagnostics_reset(void) {
  diagnostics_instruction_count = 0;
  diagnostics_memory_read_count = 0;
  diagnostics_memory_write_count = 0;
  diagnostics_port_read_count = 0;
  diagnostics_port_write_count = 0;
  diagnostics_contention_delay_count = 0;
  diagnostics_floating_bus_read_count = 0;
  diagnostics_trace_event_count = 0;
  diagnostics_tape_boundary_yield_count = 0;
}

unsigned int sp48_diagnostics_value(unsigned int id) {
  switch (id) {
    case SP48_DIAGNOSTICS_INSTRUCTIONS: return diagnostics_instruction_count;
    case SP48_DIAGNOSTICS_MEMORY_READS: return diagnostics_memory_read_count;
    case SP48_DIAGNOSTICS_MEMORY_WRITES: return diagnostics_memory_write_count;
    case SP48_DIAGNOSTICS_PORT_READS: return diagnostics_port_read_count;
    case SP48_DIAGNOSTICS_PORT_WRITES: return diagnostics_port_write_count;
    case SP48_DIAGNOSTICS_CONTENTION_DELAYS: return diagnostics_contention_delay_count;
    case SP48_DIAGNOSTICS_FLOATING_BUS_READS: return diagnostics_floating_bus_read_count;
    case SP48_DIAGNOSTICS_TRACE_EVENTS: return diagnostics_trace_event_count;
    case SP48_DIAGNOSTICS_TAPE_BOUNDARY_YIELDS: return diagnostics_tape_boundary_yield_count;
    default: return 0;
  }
}

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
  sync_event_result_counts();
  for (index = 0; index < SP48_BORDER_TRACE_CAPACITY * SP48_BORDER_TRACE_RECORD_SIZE; index++) {
    event_buffer[SP48_BORDER_TRACE_OFFSET + index] = 0;
  }
}

void sp48_clear_audio_trace(void) {
  unsigned int index;
  audio_trace_count = 0;
  event_status &= (unsigned int)~SP48_EVENT_STATUS_AUDIO_OVERFLOW_MASK;
  sync_event_result_counts();
  for (index = 0; index < SP48_AUDIO_TRACE_CAPACITY * SP48_AUDIO_TRACE_RECORD_SIZE; index++) {
    event_buffer[SP48_AUDIO_TRACE_OFFSET + index] = 0;
  }
}

void sp48_clear_tape_save_trace(void) {
  unsigned int index;
  tape_save_trace_count = 0;
  event_status &= (unsigned int)~SP48_EVENT_STATUS_TAPE_SAVE_OVERFLOW_MASK;
  sync_event_result_counts();
  for (index = 0; index < SP48_TAPE_SAVE_TRACE_CAPACITY * SP48_TAPE_SAVE_TRACE_RECORD_SIZE; index++) {
    event_buffer[SP48_TAPE_SAVE_TRACE_OFFSET + index] = 0;
  }
}

static void sp48_clear_event_traces(void) {
  border_trace_count = 0;
  audio_trace_count = 0;
  tape_save_trace_count = 0;
  event_status = 0;
  resume_frame_after_tape_mode_boundary = 0;
  sync_event_result_counts();
}

void sp48_set_16k_model(unsigned int enabled) {
  is_16k_model = enabled != 0;
  sp48_export_state();
}

static void sp48_import_cpu_state_block(void) {
  const unsigned char *source = machine_state_block + SP48_MACHINE_STATE_CPU_STATE_OFFSET;
  unsigned int tacts_in_frame;
  state.af.word = (uint16_t)get_u16(source, 0u);
  state.bc.word = (uint16_t)get_u16(source, 2u);
  state.de.word = (uint16_t)get_u16(source, 4u);
  state.hl.word = (uint16_t)get_u16(source, 6u);
  state.af_alt.word = (uint16_t)get_u16(source, 8u);
  state.bc_alt.word = (uint16_t)get_u16(source, 10u);
  state.de_alt.word = (uint16_t)get_u16(source, 12u);
  state.hl_alt.word = (uint16_t)get_u16(source, 14u);
  state.ix.word = (uint16_t)get_u16(source, 16u);
  state.iy.word = (uint16_t)get_u16(source, 18u);
  state.ir.word = (uint16_t)get_u16(source, 20u);
  state.wz.word = (uint16_t)get_u16(source, 22u);
  state.pc = (uint16_t)get_u16(source, 24u);
  state.sp = (uint16_t)get_u16(source, 26u);
  state.tacts = get_u32(source, 28u);
  state.frame_tacts = get_u32(source, 32u);
  state.frames = get_u32(source, 36u);
  tacts_in_frame = get_u32(source, 40u);
  state.tacts_in_frame = tacts_in_frame == 0 ? 1000000u : tacts_in_frame;
  state.prefix = source[44u];
  state.halted = source[45u] != 0;
  state.op_code = source[46u];
  state.interrupt_mode = source[47u];
  state.iff1 = source[48u] != 0;
  state.iff2 = source[49u] != 0;
  state.sig_int = source[50u] != 0;
  state.sig_nmi = source[51u] != 0;
  state.sig_rst = source[52u] != 0;
  state.ei_backlog = source[53u];
  state.after_ld_air = source[54u] != 0;
  state.interrupt_vector = source[55u];
  state.z80n_mode = source[56u] != 0;
  state.cpu_tact_scale = source[57u] == 0 ? 1 : source[57u];
}

static void sp48_export_cpu_state_block(void) {
  unsigned char *target = machine_state_block + SP48_MACHINE_STATE_CPU_STATE_OFFSET;
  put_u16(target, 0u, state.af.word);
  put_u16(target, 2u, state.bc.word);
  put_u16(target, 4u, state.de.word);
  put_u16(target, 6u, state.hl.word);
  put_u16(target, 8u, state.af_alt.word);
  put_u16(target, 10u, state.bc_alt.word);
  put_u16(target, 12u, state.de_alt.word);
  put_u16(target, 14u, state.hl_alt.word);
  put_u16(target, 16u, state.ix.word);
  put_u16(target, 18u, state.iy.word);
  put_u16(target, 20u, state.ir.word);
  put_u16(target, 22u, state.wz.word);
  put_u16(target, 24u, state.pc);
  put_u16(target, 26u, state.sp);
  put_u32(target, 28u, state.tacts);
  put_u32(target, 32u, state.frame_tacts);
  put_u32(target, 36u, state.frames);
  put_u32(target, 40u, state.tacts_in_frame);
  target[44u] = state.prefix;
  target[45u] = state.halted != 0;
  target[46u] = state.op_code;
  target[47u] = state.interrupt_mode;
  target[48u] = state.iff1 != 0;
  target[49u] = state.iff2 != 0;
  target[50u] = state.sig_int != 0;
  target[51u] = state.sig_nmi != 0;
  target[52u] = state.sig_rst != 0;
  target[53u] = state.ei_backlog;
  target[54u] = state.after_ld_air != 0;
  target[55u] = state.interrupt_vector;
  target[56u] = state.z80n_mode;
  target[57u] = state.cpu_tact_scale;
}

void sp48_import_state(void) {
  sp48_import_cpu_state_block();
  ula_port = machine_state_block[SP48_MACHINE_STATE_ULA_PORT_OFFSET];
  is_16k_model = machine_state_block[SP48_MACHINE_STATE_IS_16K_MODEL_OFFSET] != 0;
  border_color = machine_state_block[SP48_MACHINE_STATE_BORDER_COLOR_OFFSET] & 7u;
  ear_latch = machine_state_block[SP48_MACHINE_STATE_EAR_LATCH_OFFSET] != 0;
  mic_latch = machine_state_block[SP48_MACHINE_STATE_MIC_LATCH_OFFSET] != 0;
}

void sp48_export_state(void) {
  sp48_export_cpu_state_block();
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
  fast_sp48_z80_reset();
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
  return sp48_read_port_core(address);
}

static inline unsigned int sp48_read_port_core(unsigned int address) {
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

static void sp48_write_port_core(unsigned int address, unsigned int value, unsigned int export_state) {
  if ((address & 1) == 0) {
    unsigned int old_border_color = border_color;
    unsigned int old_ear_latch = ear_latch;
    unsigned int old_mic_latch = mic_latch;
    ula_port = (unsigned char)value;
    border_color = ula_port & 7u;
    mic_latch = (ula_port & 0x08u) != 0;
    ear_latch = (ula_port & 0x10u) != 0;
    if (old_border_color != border_color) {
      record_border_trace(state.frame_tacts, ula_port);
    }
    if (old_ear_latch != ear_latch || old_mic_latch != mic_latch) {
      record_audio_trace(state.frame_tacts, ula_port);
    }
    if (input_block[SP48_INPUT_TAPE_MODE_OFFSET] == 2u && old_mic_latch != mic_latch) {
      record_tape_save_trace(state.frame_tacts, ula_port);
    }
    if (export_state) {
      sync_event_result_counts();
      sp48_export_state();
    }
  }
}

void sp48_write_port(unsigned int address, unsigned int value) {
  sp48_write_port_core(address, value, 1u);
}

uint8_t sp48_bus_read_memory(uint16_t address, unsigned int operation) {
  (void)operation;
  sp48_bus_delay_memory_read(address);
  return memory[address];
}

void sp48_bus_write_memory(uint16_t address, uint8_t value) {
  sp48_bus_delay_memory_write(address);
  sp48_write_memory(address, value);
}

uint8_t sp48_bus_read_port(uint16_t address) {
  sp48_bus_delay_port_read(address);
  return sp48_bus_read_port_value(address);
}

void sp48_bus_write_port(uint16_t address, uint8_t value) {
  sp48_bus_delay_port_write(address);
  sp48_bus_write_port_value(address, value);
}

void sp48_bus_delay_memory_read(uint16_t address) {
  diagnostics_memory_read_count++;
  apply_memory_contention(address);
  advance_tacts(3u);
}

void sp48_bus_delay_memory_write(uint16_t address) {
  diagnostics_memory_write_count++;
  apply_memory_contention(address);
  advance_tacts(3u);
}

void sp48_bus_delay_port_read(uint16_t address) {
  diagnostics_port_read_count++;
  apply_port_contention(address);
  advance_tacts(4u);
}

void sp48_bus_delay_port_write(uint16_t address) {
  diagnostics_port_write_count++;
  apply_port_contention(address);
  advance_tacts(4u);
}

uint8_t sp48_bus_read_port_value(uint16_t address) {
  if ((address & 1u) != 0) return (uint8_t)read_sp48_floating_bus(state.frame_tacts);
  return (uint8_t)sp48_read_port_core(address);
}

void sp48_bus_write_port_value(uint16_t address, uint8_t value) {
  if ((address & 1u) == 0) {
    sp48_write_port_core(address, value, 0u);
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
  fast_sp48_z80_import_state();
  sp48_clear_event_traces();
  start_frames = state.frames;
  put_u32(result_block, SP48_RESULT_TERMINATION_OFFSET, termination);
  put_u32(result_block, SP48_RESULT_INSTRUCTION_COUNT_OFFSET, 0);
  put_u32(result_block, SP48_RESULT_CPU_STATUS_OFFSET, Z80_EXECUTION_COMPLETED);

  while (instructions < max_instructions) {
    do {
      cpu_status = fast_sp48_z80_execute_debug_instruction();
    } while (cpu_status == Z80_EXECUTION_PREFIX_PENDING);
    instructions++;
    diagnostics_instruction_count++;

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
  sync_event_result_counts();
  sp48_export_state();
  return termination;
}

unsigned int sp48_execute_frame(void) {
  unsigned int start_frames;
  sp48_import_state();
  fast_sp48_z80_import_state();
  if (resume_frame_after_tape_mode_boundary) {
    resume_frame_after_tape_mode_boundary = 0;
  } else {
    sp48_clear_event_traces();
  }
  start_frames = state.frames;
  while (state.frames == start_frames) {
    unsigned int cpu_status;
    state.sig_int = state.frame_tacts < 32u;
    do {
      cpu_status = fast_sp48_z80_execute_instruction();
    } while (cpu_status == Z80_EXECUTION_PREFIX_PENDING);
    diagnostics_instruction_count++;
    if (cpu_status != Z80_EXECUTION_COMPLETED) {
      put_u32(result_block, SP48_RESULT_TERMINATION_OFFSET, 1u);
      put_u32(result_block, SP48_RESULT_CPU_STATUS_OFFSET, cpu_status);
      sync_event_result_counts();
      sp48_export_state();
      return 1u;
    }
    if (should_yield_for_tape_mode_boundary()) {
      put_u32(result_block, SP48_RESULT_TERMINATION_OFFSET, SP48_TERMINATION_TAPE_MODE_BOUNDARY);
      put_u32(result_block, SP48_RESULT_CPU_STATUS_OFFSET, Z80_EXECUTION_COMPLETED);
      diagnostics_tape_boundary_yield_count++;
      resume_frame_after_tape_mode_boundary = 1;
      sync_event_result_counts();
      sp48_export_state();
      return SP48_TERMINATION_TAPE_MODE_BOUNDARY;
    }
  }
  put_u32(result_block, SP48_RESULT_TERMINATION_OFFSET, 0u);
  put_u32(result_block, SP48_RESULT_CPU_STATUS_OFFSET, Z80_EXECUTION_COMPLETED);
  sync_event_result_counts();
  sp48_export_state();
  return 0u;
}
