#include "z80_abi.h"
#include "z80_cpu.h"
#include "z80_state.h"
#include "z80_test_bus.h"

extern Z80State state;
uint8_t test_memory[Z80_TEST_MEMORY_SIZE];
Z80TestBusLogEntry memory_log[Z80_TEST_LOG_CAPACITY];
Z80TestBusLogEntry io_log[Z80_TEST_LOG_CAPACITY];
Z80TestBusLogEntry tbblue_log[Z80_TEST_LOG_CAPACITY];
uint8_t io_input[Z80_TEST_LOG_CAPACITY];
unsigned int memory_log_count;
unsigned int io_log_count;
unsigned int tbblue_log_count;
unsigned int io_input_count;
unsigned int io_input_index;
unsigned int z80_bus_mode;
uint8_t z80_state_block[64];

unsigned int z80_abi_version(void) { return 1; }

static void put_u16(unsigned int offset, uint16_t value) {
  z80_state_block[offset] = (uint8_t)value;
  z80_state_block[offset + 1u] = (uint8_t)(value >> 8);
}

static uint16_t get_u16(unsigned int offset) {
  return (uint16_t)(z80_state_block[offset] | ((uint16_t)z80_state_block[offset + 1u] << 8));
}

static void put_u32(unsigned int offset, uint32_t value) {
  z80_state_block[offset] = (uint8_t)value;
  z80_state_block[offset + 1u] = (uint8_t)(value >> 8);
  z80_state_block[offset + 2u] = (uint8_t)(value >> 16);
  z80_state_block[offset + 3u] = (uint8_t)(value >> 24);
}

static uint32_t get_u32(unsigned int offset) {
  return (uint32_t)z80_state_block[offset]
    | ((uint32_t)z80_state_block[offset + 1u] << 8)
    | ((uint32_t)z80_state_block[offset + 2u] << 16)
    | ((uint32_t)z80_state_block[offset + 3u] << 24);
}

static void set_flag(uint8_t flag, uint8_t enabled) {
  if (enabled) state.flags |= flag;
  else state.flags &= (uint8_t)~flag;
}

static void set_signal(uint8_t signal, uint8_t enabled) {
  if (enabled) state.signals |= signal;
  else state.signals &= (uint8_t)~signal;
}

void z80_reset(void) {
  state.af.word = 0xffff;
  state.af_alt.word = 0xffff;
  state.ir.word = 0;
  state.pc = 0;
  state.sp = 0xffff;
  state.wz.word = 0;
  state.interrupt_mode = 0;
  state.prefix = 0;
  state.signals = 0;
  state.flags = 0;
  state.ei_backlog = 0;
  state.op_code = 0;
  state.interrupt_vector = 0xff;
  state.z80n_mode = 0;
  state.cpu_tact_scale = 1;
  state.tacts = 0;
  state.frame_tacts = 0;
  state.frames = 0;
  state.tacts_in_frame = 1000000u;
  memory_log_count = 0;
  z80_state_export();
}

unsigned int z80_state_block_ptr(void) { return (unsigned int)(uintptr_t)z80_state_block; }

unsigned int z80_state_block_size(void) { return sizeof z80_state_block; }

void z80_state_export(void) {
  put_u16(0u, state.af.word);
  put_u16(2u, state.bc.word);
  put_u16(4u, state.de.word);
  put_u16(6u, state.hl.word);
  put_u16(8u, state.af_alt.word);
  put_u16(10u, state.bc_alt.word);
  put_u16(12u, state.de_alt.word);
  put_u16(14u, state.hl_alt.word);
  put_u16(16u, state.ix.word);
  put_u16(18u, state.iy.word);
  put_u16(20u, state.ir.word);
  put_u16(22u, state.wz.word);
  put_u16(24u, state.pc);
  put_u16(26u, state.sp);
  put_u32(28u, state.tacts);
  put_u32(32u, state.frame_tacts);
  put_u32(36u, state.frames);
  put_u32(40u, state.tacts_in_frame);
  z80_state_block[44u] = state.prefix;
  z80_state_block[45u] = (state.flags & Z80_STATE_HALTED) != 0;
  z80_state_block[46u] = state.op_code;
  z80_state_block[47u] = state.interrupt_mode;
  z80_state_block[48u] = (state.flags & Z80_STATE_IFF1) != 0;
  z80_state_block[49u] = (state.flags & Z80_STATE_IFF2) != 0;
  z80_state_block[50u] = (state.signals & Z80_SIGNAL_INT) != 0;
  z80_state_block[51u] = (state.signals & Z80_SIGNAL_NMI) != 0;
  z80_state_block[52u] = (state.signals & Z80_SIGNAL_RST) != 0;
  z80_state_block[53u] = state.ei_backlog;
  z80_state_block[54u] = (state.flags & Z80_STATE_AFTER_LD_AIR) != 0;
  z80_state_block[55u] = state.interrupt_vector;
  z80_state_block[56u] = state.z80n_mode;
  z80_state_block[57u] = state.cpu_tact_scale;
}

void z80_state_import(void) {
  state.af.word = get_u16(0u);
  state.bc.word = get_u16(2u);
  state.de.word = get_u16(4u);
  state.hl.word = get_u16(6u);
  state.af_alt.word = get_u16(8u);
  state.bc_alt.word = get_u16(10u);
  state.de_alt.word = get_u16(12u);
  state.hl_alt.word = get_u16(14u);
  state.ix.word = get_u16(16u);
  state.iy.word = get_u16(18u);
  state.ir.word = get_u16(20u);
  state.wz.word = get_u16(22u);
  state.pc = get_u16(24u);
  state.sp = get_u16(26u);
  state.tacts = get_u32(28u);
  state.frame_tacts = get_u32(32u);
  state.frames = get_u32(36u);
  state.tacts_in_frame = get_u32(40u) == 0 ? 1000000u : get_u32(40u);
  state.prefix = z80_state_block[44u];
  set_flag(Z80_STATE_HALTED, z80_state_block[45u] != 0);
  state.op_code = z80_state_block[46u];
  state.interrupt_mode = z80_state_block[47u];
  set_flag(Z80_STATE_IFF1, z80_state_block[48u] != 0);
  set_flag(Z80_STATE_IFF2, z80_state_block[49u] != 0);
  set_signal(Z80_SIGNAL_INT, z80_state_block[50u] != 0);
  set_signal(Z80_SIGNAL_NMI, z80_state_block[51u] != 0);
  set_signal(Z80_SIGNAL_RST, z80_state_block[52u] != 0);
  state.ei_backlog = z80_state_block[53u];
  set_flag(Z80_STATE_AFTER_LD_AIR, z80_state_block[54u] != 0);
  state.interrupt_vector = z80_state_block[55u];
  state.z80n_mode = z80_state_block[56u] != 0;
  state.cpu_tact_scale = z80_state_block[57u] == 0 ? 1 : z80_state_block[57u];
}

unsigned int z80_execute_instruction(void) {
  unsigned int result;
  z80_state_import();
  result = z80_cpu_execute_instruction();
  z80_state_export();
  return result;
}

unsigned int z80_test_memory_ptr(void) { return (unsigned int)(uintptr_t)test_memory; }

unsigned int z80_test_memory_size(void) { return Z80_TEST_MEMORY_SIZE; }

unsigned int z80_test_memory_log_capacity(void) { return Z80_TEST_LOG_CAPACITY; }

unsigned int z80_test_io_log_capacity(void) { return Z80_TEST_LOG_CAPACITY; }

unsigned int z80_test_tbblue_log_capacity(void) { return Z80_TEST_LOG_CAPACITY; }

unsigned int z80_test_memory_log_count(void) { return memory_log_count; }

unsigned int z80_test_memory_log_ptr(void) { return (unsigned int)(uintptr_t)memory_log; }

unsigned int z80_test_io_log_count(void) { return io_log_count; }

unsigned int z80_test_io_log_ptr(void) { return (unsigned int)(uintptr_t)io_log; }

unsigned int z80_test_tbblue_log_count(void) { return tbblue_log_count; }

unsigned int z80_test_tbblue_log_ptr(void) { return (unsigned int)(uintptr_t)tbblue_log; }

unsigned int z80_test_io_input_ptr(void) { return (unsigned int)(uintptr_t)io_input; }

void z80_test_io_input_count_set(unsigned int count) {
  io_input_count = count > Z80_TEST_LOG_CAPACITY ? Z80_TEST_LOG_CAPACITY : count;
  io_input_index = 0;
}

void z80_test_bus_reset(void) {
  unsigned int index;
  for (index = 0; index < Z80_TEST_MEMORY_SIZE; index++) test_memory[index] = 0;
  for (index = 0; index < Z80_TEST_LOG_CAPACITY; index++) {
    memory_log[index].operation = 0;
    io_log[index].operation = 0;
    tbblue_log[index].operation = 0;
    io_input[index] = 0;
  }
  memory_log_count = 0;
  io_log_count = 0;
  tbblue_log_count = 0;
  io_input_count = 0;
  io_input_index = 0;
  z80_bus_mode = Z80_BUS_TEST;
}
