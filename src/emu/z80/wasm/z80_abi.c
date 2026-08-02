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
unsigned int io_input_count;
unsigned int io_input_index;

unsigned int z80_abi_version(void) { return 1; }

unsigned int z80_state_size(void) { return (unsigned int)sizeof(Z80State); }

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
  state.tacts = 0;
  state.frame_tacts = 0;
  state.frames = 0;
  state.tacts_in_frame = 1000000u;
  memory_log_count = 0;
}

unsigned int z80_state_read_word(unsigned int field) {
  switch (field) {
    case Z80_WORD_AF: return state.af.word;
    case Z80_WORD_BC: return state.bc.word;
    case Z80_WORD_DE: return state.de.word;
    case Z80_WORD_HL: return state.hl.word;
    case Z80_WORD_AF_ALT: return state.af_alt.word;
    case Z80_WORD_BC_ALT: return state.bc_alt.word;
    case Z80_WORD_DE_ALT: return state.de_alt.word;
    case Z80_WORD_HL_ALT: return state.hl_alt.word;
    case Z80_WORD_IX: return state.ix.word;
    case Z80_WORD_IY: return state.iy.word;
    case Z80_WORD_IR: return state.ir.word;
    case Z80_WORD_WZ: return state.wz.word;
    case Z80_WORD_PC: return state.pc;
    case Z80_WORD_SP: return state.sp;
    default: return 0;
  }
}

void z80_state_write_word(unsigned int field, unsigned int value) {
  uint16_t word = (uint16_t)value;
  switch (field) {
    case Z80_WORD_AF: state.af.word = word; break;
    case Z80_WORD_BC: state.bc.word = word; break;
    case Z80_WORD_DE: state.de.word = word; break;
    case Z80_WORD_HL: state.hl.word = word; break;
    case Z80_WORD_AF_ALT: state.af_alt.word = word; break;
    case Z80_WORD_BC_ALT: state.bc_alt.word = word; break;
    case Z80_WORD_DE_ALT: state.de_alt.word = word; break;
    case Z80_WORD_HL_ALT: state.hl_alt.word = word; break;
    case Z80_WORD_IX: state.ix.word = word; break;
    case Z80_WORD_IY: state.iy.word = word; break;
    case Z80_WORD_IR: state.ir.word = word; break;
    case Z80_WORD_WZ: state.wz.word = word; break;
    case Z80_WORD_PC: state.pc = word; break;
    case Z80_WORD_SP: state.sp = word; break;
    default: break;
  }
}

unsigned int z80_state_read_byte(unsigned int field) {
  switch (field) {
    case Z80_BYTE_A: return state.af.bytes.hi;
    case Z80_BYTE_F: return state.af.bytes.lo;
    case Z80_BYTE_B: return state.bc.bytes.hi;
    case Z80_BYTE_C: return state.bc.bytes.lo;
    case Z80_BYTE_D: return state.de.bytes.hi;
    case Z80_BYTE_E: return state.de.bytes.lo;
    case Z80_BYTE_H: return state.hl.bytes.hi;
    case Z80_BYTE_L: return state.hl.bytes.lo;
    case Z80_BYTE_IXH: return state.ix.bytes.hi;
    case Z80_BYTE_IXL: return state.ix.bytes.lo;
    case Z80_BYTE_IYH: return state.iy.bytes.hi;
    case Z80_BYTE_IYL: return state.iy.bytes.lo;
    case Z80_BYTE_I: return state.ir.bytes.hi;
    case Z80_BYTE_R: return state.ir.bytes.lo;
    default: return 0;
  }
}

void z80_state_write_byte(unsigned int field, unsigned int value) {
  uint8_t byte = (uint8_t)value;
  switch (field) {
    case Z80_BYTE_A: state.af.bytes.hi = byte; break;
    case Z80_BYTE_F: state.af.bytes.lo = byte; break;
    case Z80_BYTE_B: state.bc.bytes.hi = byte; break;
    case Z80_BYTE_C: state.bc.bytes.lo = byte; break;
    case Z80_BYTE_D: state.de.bytes.hi = byte; break;
    case Z80_BYTE_E: state.de.bytes.lo = byte; break;
    case Z80_BYTE_H: state.hl.bytes.hi = byte; break;
    case Z80_BYTE_L: state.hl.bytes.lo = byte; break;
    case Z80_BYTE_IXH: state.ix.bytes.hi = byte; break;
    case Z80_BYTE_IXL: state.ix.bytes.lo = byte; break;
    case Z80_BYTE_IYH: state.iy.bytes.hi = byte; break;
    case Z80_BYTE_IYL: state.iy.bytes.lo = byte; break;
    case Z80_BYTE_I: state.ir.bytes.hi = byte; break;
    case Z80_BYTE_R: state.ir.bytes.lo = byte; break;
    default: break;
  }
}

unsigned int z80_state_read_control(unsigned int field) {
  switch (field) {
    case Z80_CONTROL_PREFIX: return state.prefix;
    case Z80_CONTROL_HALTED: return (state.flags & Z80_STATE_HALTED) != 0;
    case Z80_CONTROL_OPCODE: return state.op_code;
    case Z80_CONTROL_INTERRUPT_MODE: return state.interrupt_mode;
    case Z80_CONTROL_IFF1: return (state.flags & Z80_STATE_IFF1) != 0;
    case Z80_CONTROL_IFF2: return (state.flags & Z80_STATE_IFF2) != 0;
    case Z80_CONTROL_SIGNAL_INT: return (state.signals & Z80_SIGNAL_INT) != 0;
    case Z80_CONTROL_SIGNAL_NMI: return (state.signals & Z80_SIGNAL_NMI) != 0;
    case Z80_CONTROL_SIGNAL_RST: return (state.signals & Z80_SIGNAL_RST) != 0;
    case Z80_CONTROL_EI_BACKLOG: return state.ei_backlog;
    case Z80_CONTROL_AFTER_LD_AIR: return (state.flags & Z80_STATE_AFTER_LD_AIR) != 0;
    case Z80_CONTROL_INTERRUPT_VECTOR: return state.interrupt_vector;
    default: return 0;
  }
}

void z80_state_write_control(unsigned int field, unsigned int value) {
  switch (field) {
    case Z80_CONTROL_PREFIX: state.prefix = (uint8_t)value; break;
    case Z80_CONTROL_HALTED:
      if (value) state.flags |= Z80_STATE_HALTED;
      else state.flags &= (uint8_t)~Z80_STATE_HALTED;
      break;
    case Z80_CONTROL_OPCODE: state.op_code = (uint8_t)value; break;
    case Z80_CONTROL_INTERRUPT_MODE: state.interrupt_mode = (uint8_t)value; break;
    case Z80_CONTROL_IFF1:
      if (value) state.flags |= Z80_STATE_IFF1;
      else state.flags &= (uint8_t)~Z80_STATE_IFF1;
      break;
    case Z80_CONTROL_IFF2:
      if (value) state.flags |= Z80_STATE_IFF2;
      else state.flags &= (uint8_t)~Z80_STATE_IFF2;
      break;
    case Z80_CONTROL_SIGNAL_INT:
      if (value) state.signals |= Z80_SIGNAL_INT;
      else state.signals &= (uint8_t)~Z80_SIGNAL_INT;
      break;
    case Z80_CONTROL_SIGNAL_NMI:
      if (value) state.signals |= Z80_SIGNAL_NMI;
      else state.signals &= (uint8_t)~Z80_SIGNAL_NMI;
      break;
    case Z80_CONTROL_SIGNAL_RST:
      if (value) state.signals |= Z80_SIGNAL_RST;
      else state.signals &= (uint8_t)~Z80_SIGNAL_RST;
      break;
    case Z80_CONTROL_EI_BACKLOG: state.ei_backlog = (uint8_t)value; break;
    case Z80_CONTROL_AFTER_LD_AIR:
      if (value) state.flags |= Z80_STATE_AFTER_LD_AIR;
      else state.flags &= (uint8_t)~Z80_STATE_AFTER_LD_AIR;
      break;
    case Z80_CONTROL_INTERRUPT_VECTOR: state.interrupt_vector = (uint8_t)value; break;
    default: break;
  }
}

unsigned int z80_state_read_counter(unsigned int field) {
  switch (field) {
    case Z80_COUNTER_TACTS: return state.tacts;
    case Z80_COUNTER_FRAME_TACTS: return state.frame_tacts;
    case Z80_COUNTER_FRAMES: return state.frames;
    default: return 0;
  }
}

unsigned int z80_register_layout_probe(void) {
  Z80Register16 probe;
  probe.word = 0x1234;
  return ((unsigned int)probe.bytes.hi << 8) | probe.bytes.lo;
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

unsigned int z80_test_io_input_ptr(void) { return (unsigned int)(uintptr_t)io_input; }

void z80_test_io_input_count_set(unsigned int count) {
  io_input_count = count > Z80_TEST_LOG_CAPACITY ? Z80_TEST_LOG_CAPACITY : count;
  io_input_index = 0;
}

void z80_test_begin_instruction(void) {
  state.pc = 0;
  state.prefix = 0;
  state.flags &= (uint8_t)~Z80_STATE_HALTED;
  state.tacts = 0;
  state.frame_tacts = 0;
  state.frames = 0;
  memory_log_count = 0;
  io_log_count = 0;
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
  io_input_count = 0;
  io_input_index = 0;
}
