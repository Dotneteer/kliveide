#include "z80_abi.h"
#include "z80_state.h"

#define Z80_TEST_MEMORY_SIZE 0x10000u
#define Z80_TEST_LOG_CAPACITY 256u

typedef struct {
  uint16_t address;
  uint8_t value;
  uint8_t operation;
} Z80TestBusLogEntry;

static Z80State state;
static uint8_t test_memory[Z80_TEST_MEMORY_SIZE];
static Z80TestBusLogEntry memory_log[Z80_TEST_LOG_CAPACITY];
static Z80TestBusLogEntry io_log[Z80_TEST_LOG_CAPACITY];
static Z80TestBusLogEntry tbblue_log[Z80_TEST_LOG_CAPACITY];
static uint8_t io_input[Z80_TEST_LOG_CAPACITY];
static unsigned int memory_log_count;
static unsigned int io_log_count;
static unsigned int io_input_count;
static unsigned int io_input_index;

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

static void advance_tacts(unsigned int tacts) {
  state.tacts += tacts;
  state.frame_tacts += tacts;
  if (state.frame_tacts >= state.tacts_in_frame) {
    state.frames++;
    state.frame_tacts -= state.tacts_in_frame;
  }
}

static void refresh_register(void) {
  state.ir.bytes.lo = (uint8_t)(((state.ir.bytes.lo + 1u) & 0x7fu) | (state.ir.bytes.lo & 0x80u));
}

static uint8_t read_memory(uint16_t address, unsigned int operation) {
  uint8_t value = test_memory[address];
  if (memory_log_count < Z80_TEST_LOG_CAPACITY) {
    memory_log[memory_log_count].address = address;
    memory_log[memory_log_count].value = value;
    memory_log[memory_log_count].operation = (uint8_t)operation;
    memory_log_count++;
  }
  advance_tacts(3);
  return value;
}

static void write_memory(uint16_t address, uint8_t value) {
  test_memory[address] = value;
  if (memory_log_count < Z80_TEST_LOG_CAPACITY) {
    memory_log[memory_log_count].address = address;
    memory_log[memory_log_count].value = value;
    memory_log[memory_log_count].operation = 1;
    memory_log_count++;
  }
  advance_tacts(3);
}

static uint8_t read_port(uint16_t address) {
  uint8_t value = io_input_index < io_input_count ? io_input[io_input_index++] : 0;
  if (io_log_count < Z80_TEST_LOG_CAPACITY) {
    io_log[io_log_count].address = address;
    io_log[io_log_count].value = value;
    io_log[io_log_count].operation = 0;
    io_log_count++;
  }
  advance_tacts(4);
  return value;
}

static void write_port(uint16_t address, uint8_t value) {
  if (io_log_count < Z80_TEST_LOG_CAPACITY) {
    io_log[io_log_count].address = address;
    io_log[io_log_count].value = value;
    io_log[io_log_count].operation = 1;
    io_log_count++;
  }
  advance_tacts(4);
}

static void push_pc(void) {
  state.sp--;
  advance_tacts(1);
  write_memory(state.sp, state.pc >> 8);
  state.sp--;
  write_memory(state.sp, state.pc & 0xff);
}

static uint16_t fetch_word(void) {
  uint16_t low = read_memory(state.pc++, 0);
  uint16_t high = read_memory(state.pc++, 0);
  return (uint16_t)(low | (high << 8));
}

static unsigned int condition_is_true(unsigned int condition) {
  uint8_t flags = state.af.bytes.lo;
  switch (condition & 7u) {
    case 0: return (flags & 0x40u) == 0; /* NZ */
    case 1: return (flags & 0x40u) != 0; /* Z */
    case 2: return (flags & 0x01u) == 0; /* NC */
    case 3: return (flags & 0x01u) != 0; /* C */
    case 4: return (flags & 0x04u) == 0; /* PO */
    case 5: return (flags & 0x04u) != 0; /* PE */
    case 6: return (flags & 0x80u) == 0; /* P */
    default: return (flags & 0x80u) != 0; /* M */
  }
}

static uint8_t parity_table[256];
static unsigned int parity_table_initialized;

static void initialize_parity_table(void) {
  unsigned int value;
  if (parity_table_initialized) return;
  for (value = 0; value < 256; value++) {
    unsigned int bits = value;
    unsigned int parity = 0;
    while (bits != 0) {
      parity ^= bits & 1u;
      bits >>= 1;
    }
    parity_table[value] = parity == 0 ? 0x04 : 0;
  }
  parity_table_initialized = 1;
}

static uint8_t add8(uint8_t left, uint8_t right, unsigned int carry) {
  uint16_t sum = (uint16_t)left + right + carry;
  uint8_t result = (uint8_t)sum;
  uint8_t flags = result & 0xa8u;
  if (result == 0) flags |= 0x40u;
  if (((left & 0x0fu) + (right & 0x0fu) + carry) > 0x0fu) flags |= 0x10u;
  if ((~(left ^ right) & (left ^ result) & 0x80u) != 0) flags |= 0x04u;
  if (sum > 0xffu) flags |= 0x01u;
  state.af.bytes.lo = flags;
  return result;
}

static uint8_t sub8(uint8_t left, uint8_t right, unsigned int carry) {
  unsigned int right_with_carry = (unsigned int)right + carry;
  uint8_t result = (uint8_t)((unsigned int)left - right_with_carry);
  uint8_t flags = (uint8_t)(0x02u | (result & 0xa8u));
  if (result == 0) flags |= 0x40u;
  if (((left ^ right ^ result) & 0x10u) != 0) flags |= 0x10u;
  if (((left ^ right) & (left ^ result) & 0x80u) != 0) flags |= 0x04u;
  if ((unsigned int)left < right_with_carry) flags |= 0x01u;
  state.af.bytes.lo = flags;
  return result;
}

static void leave_halt(void) {
  if ((state.flags & Z80_STATE_HALTED) != 0) {
    state.pc++;
    state.flags &= (uint8_t)~Z80_STATE_HALTED;
  }
}

static void apply_ld_air_quirk(void) {
  if ((state.flags & Z80_STATE_AFTER_LD_AIR) != 0) {
    state.af.bytes.lo &= (uint8_t)~0x04u;
    state.flags &= (uint8_t)~Z80_STATE_AFTER_LD_AIR;
  }
}

static void process_nmi(void) {
  advance_tacts(4);
  leave_halt();
  if ((state.flags & Z80_STATE_IFF1) != 0) state.flags |= Z80_STATE_IFF2;
  else state.flags &= (uint8_t)~Z80_STATE_IFF2;
  state.flags &= (uint8_t)~Z80_STATE_IFF1;
  apply_ld_air_quirk();
  push_pc();
  refresh_register();
  state.pc = 0x0066;
  state.wz.word = 0x0066;
}

static void process_int(void) {
  uint16_t vector_address;
  advance_tacts(6);
  leave_halt();
  state.flags &= (uint8_t)~(Z80_STATE_IFF1 | Z80_STATE_IFF2);
  apply_ld_air_quirk();
  push_pc();
  refresh_register();
  if (state.interrupt_mode == 2) {
    vector_address = (uint16_t)(((uint16_t)state.ir.bytes.hi << 8) | state.interrupt_vector);
    state.wz.bytes.lo = read_memory(vector_address, 0);
    state.wz.bytes.hi = read_memory((uint16_t)(vector_address + 1u), 0);
  } else {
    state.wz.word = 0x0038;
  }
  state.pc = state.wz.word;
}

unsigned int z80_execute_instruction(void) {
  uint8_t opcode;

  if (state.ei_backlog > 0) state.ei_backlog--;
  if ((state.signals & Z80_SIGNAL_RST) != 0) {
    z80_reset();
    return Z80_EXECUTION_COMPLETED;
  }
  if ((state.signals & Z80_SIGNAL_NMI) != 0 && state.prefix == 0) {
    process_nmi();
    return Z80_EXECUTION_COMPLETED;
  }
  if ((state.signals & Z80_SIGNAL_INT) != 0 && state.prefix == 0 &&
      (state.flags & Z80_STATE_IFF1) != 0 && state.ei_backlog == 0) {
    process_int();
    return Z80_EXECUTION_COMPLETED;
  }
  state.flags &= (uint8_t)~Z80_STATE_AFTER_LD_AIR;

  if ((state.flags & Z80_STATE_HALTED) != 0) {
    /* HALT repeats an M1 timing cycle without an instruction memory access. */
    advance_tacts(3);
    refresh_register();
    advance_tacts(1);
    return Z80_EXECUTION_COMPLETED;
  }

  if (state.prefix == 0) memory_log_count = 0;
  opcode = read_memory(state.pc, 0);
  state.pc++;
  state.op_code = opcode;

  if (state.prefix == 0) {
    refresh_register();
    advance_tacts(1);
    switch (opcode) {
      case 0x00: return Z80_EXECUTION_COMPLETED; /* NOP */
      case 0xcb: state.prefix = 2; return Z80_EXECUTION_PREFIX_PENDING;
      case 0xed: state.prefix = 1; return Z80_EXECUTION_PREFIX_PENDING;
      case 0xdd: state.prefix = 3; return Z80_EXECUTION_PREFIX_PENDING;
      case 0xfd: state.prefix = 4; return Z80_EXECUTION_PREFIX_PENDING;
      default: return Z80_EXECUTION_NOT_IMPLEMENTED;
    }
  }

  if (state.prefix == 3 || state.prefix == 4) {
    if (opcode == 0xdd) {
      state.prefix = 3;
      return Z80_EXECUTION_PREFIX_PENDING;
    }
    if (opcode == 0xfd) {
      state.prefix = 4;
      return Z80_EXECUTION_PREFIX_PENDING;
    }
    if (opcode == 0xcb) {
      state.prefix = state.prefix == 3 ? 5 : 6;
      return Z80_EXECUTION_PREFIX_PENDING;
    }
  }

  state.prefix = 0;
  return Z80_EXECUTION_NOT_IMPLEMENTED;
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

unsigned int z80_test_fetch_byte(void) { return read_memory(state.pc++, 0); }

unsigned int z80_test_fetch_word(void) { return fetch_word(); }

void z80_test_push_word(unsigned int value) {
  state.sp--;
  advance_tacts(1);
  write_memory(state.sp, (uint8_t)(value >> 8));
  state.sp--;
  write_memory(state.sp, (uint8_t)value);
}

unsigned int z80_test_pop_word(void) {
  uint16_t low = read_memory(state.sp++, 0);
  uint16_t high = read_memory(state.sp++, 0);
  return low | (high << 8);
}

unsigned int z80_test_sign_extend(unsigned int value) {
  return (unsigned int)(int32_t)(int8_t)value;
}

unsigned int z80_test_condition(unsigned int condition) { return condition_is_true(condition); }

unsigned int z80_test_parity(unsigned int value) {
  initialize_parity_table();
  return parity_table[(uint8_t)value];
}

unsigned int z80_test_add8(unsigned int value, unsigned int with_carry) {
  unsigned int carry = with_carry && (state.af.bytes.lo & 0x01u) != 0;
  state.af.bytes.hi = add8(state.af.bytes.hi, (uint8_t)value, carry);
  return state.af.bytes.hi;
}

unsigned int z80_test_sub8(unsigned int value, unsigned int with_carry) {
  unsigned int carry = with_carry && (state.af.bytes.lo & 0x01u) != 0;
  state.af.bytes.hi = sub8(state.af.bytes.hi, (uint8_t)value, carry);
  return state.af.bytes.hi;
}

unsigned int z80_test_port_read(unsigned int address) { return read_port((uint16_t)address); }

void z80_test_port_write(unsigned int address, unsigned int value) {
  write_port((uint16_t)address, (uint8_t)value);
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
