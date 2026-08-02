// CPU execution implementation; compiled separately from z80_abi.c.
#include "z80_abi.h"
#include "z80_state.h"
#include "z80_test_bus.h"

Z80State state;

void *memcpy(void *destination, const void *source, unsigned long count) {
  unsigned char *target = (unsigned char *)destination;
  const unsigned char *origin = (const unsigned char *)source;
  unsigned long index;

  for (index = 0; index < count; index++) target[index] = origin[index];
  return destination;
}

static void initializeParityTable(void);
static uint8_t readRegister(unsigned int registerCode);
static void writeRegister(unsigned int registerCode, uint8_t value);
uint8_t sp48_bus_read_memory(uint16_t address, unsigned int operation);
void sp48_bus_write_memory(uint16_t address, uint8_t value);
uint8_t sp48_bus_read_port(uint16_t address);
void sp48_bus_write_port(uint16_t address, uint8_t value);

static void tactPlusN(unsigned int tacts) {
  state.tacts += tacts;
  state.frame_tacts += tacts * (state.z80n_mode ? state.cpu_tact_scale : 1u);
  if (state.frame_tacts >= state.tacts_in_frame) {
    state.frames++;
    state.frame_tacts -= state.tacts_in_frame;
  }
}

static void refreshMemory(void) {
  state.ir.bytes.lo = (uint8_t)(((state.ir.bytes.lo + 1u) & 0x7fu) | (state.ir.bytes.lo & 0x80u));
}

static uint8_t readMemory(uint16_t address, unsigned int operation) {
  uint8_t value = z80_bus_mode == Z80_BUS_SP48
    ? sp48_bus_read_memory(address, operation)
    : test_memory[address];
  if ((z80_bus_mode == Z80_BUS_TEST || z80_bus_mode == Z80_BUS_SP48) && memory_log_count < Z80_TEST_LOG_CAPACITY) {
    memory_log[memory_log_count].address = address;
    memory_log[memory_log_count].value = value;
    memory_log[memory_log_count].operation = (uint8_t)operation;
    memory_log_count++;
  }
  tactPlusN(3);
  return value;
}

static void writeMemory(uint16_t address, uint8_t value) {
  if (z80_bus_mode == Z80_BUS_SP48) sp48_bus_write_memory(address, value);
  else test_memory[address] = value;
  if ((z80_bus_mode == Z80_BUS_TEST || z80_bus_mode == Z80_BUS_SP48) && memory_log_count < Z80_TEST_LOG_CAPACITY) {
    memory_log[memory_log_count].address = address;
    memory_log[memory_log_count].value = value;
    memory_log[memory_log_count].operation = 1;
    memory_log_count++;
  }
  tactPlusN(3);
}

static uint8_t readPort(uint16_t address) {
  uint8_t value = z80_bus_mode == Z80_BUS_SP48
    ? sp48_bus_read_port(address)
    : (io_input_index < io_input_count ? io_input[io_input_index++] : 0);
  if ((z80_bus_mode == Z80_BUS_TEST || z80_bus_mode == Z80_BUS_SP48) && io_log_count < Z80_TEST_LOG_CAPACITY) {
    io_log[io_log_count].address = address;
    io_log[io_log_count].value = value;
    io_log[io_log_count].operation = 0;
    io_log_count++;
  }
  tactPlusN(4);
  return value;
}

static void writePort(uint16_t address, uint8_t value) {
  if (z80_bus_mode == Z80_BUS_SP48) sp48_bus_write_port(address, value);
  if ((z80_bus_mode == Z80_BUS_TEST || z80_bus_mode == Z80_BUS_SP48) && io_log_count < Z80_TEST_LOG_CAPACITY) {
    io_log[io_log_count].address = address;
    io_log[io_log_count].value = value;
    io_log[io_log_count].operation = 1;
    io_log_count++;
  }
  tactPlusN(4);
}

static void tbblueOut(uint8_t address, uint8_t value) {
  if (tbblue_log_count < Z80_TEST_LOG_CAPACITY) {
    tbblue_log[tbblue_log_count].address = address;
    tbblue_log[tbblue_log_count].value = value;
    tbblue_log[tbblue_log_count].operation = 1;
    tbblue_log_count++;
  }
}

static void push_pc(void) {
  state.sp--;
  tactPlusN(1);
  writeMemory(state.sp, state.pc >> 8);
  state.sp--;
  writeMemory(state.sp, state.pc & 0xff);
}

static uint16_t fetchCodeWord(void) {
  uint16_t low = readMemory(state.pc++, 0);
  uint16_t high = readMemory(state.pc++, 0);
  return (uint16_t)(low | (high << 8));
}

static unsigned int conditionIsTrue(unsigned int condition) {
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

static void initializeParityTable(void) {
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

static uint8_t inc8(uint8_t value) {
  uint8_t result = (uint8_t)(value + 1u);
  uint8_t flags = (state.af.bytes.lo & 0x01u) | (result & 0xa8u);
  if (result == 0) flags |= 0x40u;
  if ((value & 0x0fu) == 0x0fu) flags |= 0x10u;
  if (result == 0x80u) flags |= 0x04u;
  state.af.bytes.lo = flags;
  return result;
}

static uint8_t dec8(uint8_t value) {
  uint8_t result = (uint8_t)(value - 1u);
  uint8_t flags = (uint8_t)((state.af.bytes.lo & 0x01u) | 0x02u | (result & 0xa8u));
  if (result == 0) flags |= 0x40u;
  if ((value & 0x0fu) == 0) flags |= 0x10u;
  if (result == 0x7fu) flags |= 0x04u;
  state.af.bytes.lo = flags;
  return result;
}

static uint8_t sz53pv(uint8_t value) {
  uint8_t flags = value & 0xa8u;

  initializeParityTable();
  if (value == 0) flags |= 0x40u;
  return (uint8_t)(flags | parity_table[value]);
}

static uint8_t sz53(uint8_t value) {
  uint8_t flags = value & 0xa8u;

  if (value == 0) flags |= 0x40u;
  return flags;
}

static uint8_t rlc8(uint8_t value) {
  uint8_t result = (uint8_t)((value << 1) | (value >> 7));

  state.af.bytes.lo = (uint8_t)((value >> 7) | sz53pv(result));
  return result;
}

static uint8_t rrc8(uint8_t value) {
  uint8_t result = (uint8_t)((value >> 1) | (value << 7));

  state.af.bytes.lo = (uint8_t)((value & 1u) | sz53pv(result));
  return result;
}

static uint8_t rl8(uint8_t value) {
  uint8_t result = (uint8_t)((value << 1) | (state.af.bytes.lo & 1u));

  state.af.bytes.lo = (uint8_t)((value >> 7) | sz53pv(result));
  return result;
}

static uint8_t rr8(uint8_t value) {
  uint8_t result = (uint8_t)((value >> 1) | ((state.af.bytes.lo & 1u) << 7));

  state.af.bytes.lo = (uint8_t)((value & 1u) | sz53pv(result));
  return result;
}

static uint8_t sla8(uint8_t value) {
  uint8_t result = (uint8_t)(value << 1);

  state.af.bytes.lo = (uint8_t)((value >> 7) | sz53pv(result));
  return result;
}

static uint8_t sra8(uint8_t value) {
  uint8_t result = (uint8_t)((value >> 1) | (value & 0x80u));

  state.af.bytes.lo = (uint8_t)((value & 1u) | sz53pv(result));
  return result;
}

static uint8_t sll8(uint8_t value) {
  uint8_t result = (uint8_t)((value << 1) | 1u);

  state.af.bytes.lo = (uint8_t)((value >> 7) | sz53pv(result));
  return result;
}

static uint8_t srl8(uint8_t value) {
  uint8_t result = (uint8_t)(value >> 1);

  state.af.bytes.lo = (uint8_t)((value & 1u) | sz53pv(result));
  return result;
}

static uint16_t add16(uint16_t left, uint16_t right) {
  uint32_t sum = (uint32_t)left + right;
  uint16_t result = (uint16_t)sum;
  uint8_t flags = (uint8_t)((state.af.bytes.lo & 0xc4u) | ((result >> 8) & 0x28u));
  if (((left & 0x0fffu) + (right & 0x0fffu)) > 0x0fffu) flags |= 0x10u;
  if (sum > 0xffffu) flags |= 0x01u;
  state.af.bytes.lo = flags;
  state.wz.word = (uint16_t)(left + 1u);
  return result;
}

typedef void (*Z80Operation)(void);

static void illegal_operation(void) {
}

static uint8_t executeBitRotateShift(uint8_t value, unsigned int group) {
  switch (group) {
    case 0: return rlc8(value);
    case 1: return rrc8(value);
    case 2: return rl8(value);
    case 3: return rr8(value);
    case 4: return sla8(value);
    case 5: return sra8(value);
    case 6: return sll8(value);
    default: return srl8(value);
  }
}

/* CB 0x00-0x3F: RLC/RRC/RL/RR/SLA/SRA/SLL/SRL r/(HL). */
static void bitRotateShift(void) {
  unsigned int selector = state.op_code & 7u;
  unsigned int group = (state.op_code >> 3) & 7u;
  uint8_t value = readRegister(selector);
  uint8_t result = executeBitRotateShift(value, group);

  writeRegister(selector, result);
  tactPlusN(1);
  if (selector == 6) tactPlusN(1);
}

/* CB 0x40-0x7F: BIT b,r/(HL). */
static void bitTest(void) {
  unsigned int selector = state.op_code & 7u;
  unsigned int bit = (state.op_code >> 3) & 7u;
  uint8_t value = readRegister(selector);
  uint8_t mask = (uint8_t)(1u << bit);
  uint8_t undocumented_source = selector == 6 ? state.wz.bytes.hi : value;
  uint8_t flags = (uint8_t)((state.af.bytes.lo & 1u) | 0x10u | (undocumented_source & 0x28u));

  if ((value & mask) == 0) flags |= 0x44u;
  if (bit == 7 && (value & 0x80u) != 0) flags |= 0x80u;
  state.af.bytes.lo = flags;
  tactPlusN(1);
  if (selector == 6) tactPlusN(1);
}

/* CB 0x80-0xBF: RES b,r/(HL). */
static void bitReset(void) {
  unsigned int selector = state.op_code & 7u;
  uint8_t mask = (uint8_t)(1u << ((state.op_code >> 3) & 7u));
  uint8_t result = (uint8_t)(readRegister(selector) & ~mask);

  writeRegister(selector, result);
  tactPlusN(1);
  if (selector == 6) tactPlusN(1);
}

/* CB 0xC0-0xFF: SET b,r/(HL). */
static void bitSet(void) {
  unsigned int selector = state.op_code & 7u;
  uint8_t mask = (uint8_t)(1u << ((state.op_code >> 3) & 7u));
  uint8_t result = (uint8_t)(readRegister(selector) | mask);

  writeRegister(selector, result);
  tactPlusN(1);
  if (selector == 6) tactPlusN(1);
}

static uint16_t selectRegisterPair(unsigned int selector) {
  switch (selector & 3u) {
    case 0: return state.bc.word;
    case 1: return state.de.word;
    case 2: return state.hl.word;
    default: return state.sp;
  }
}

static void storeRegisterPair(unsigned int selector, uint16_t value) {
  switch (selector & 3u) {
    case 0: state.bc.word = value; break;
    case 1: state.de.word = value; break;
    case 2: state.hl.word = value; break;
    default: state.sp = value; break;
  }
}

static uint16_t adc16(uint16_t left, uint16_t right) {
  unsigned int carry = state.af.bytes.lo & 1u;
  uint32_t sum = (uint32_t)left + right + carry;
  uint16_t result = (uint16_t)sum;
  uint8_t flags = (uint8_t)((result >> 8) & 0xa8u);

  if (result == 0) flags |= 0x40u;
  if (((left & 0x0fffu) + (right & 0x0fffu) + carry) > 0x0fffu) flags |= 0x10u;
  if ((~(left ^ right) & (left ^ result) & 0x8000u) != 0) flags |= 0x04u;
  if (sum > 0xffffu) flags |= 0x01u;
  state.af.bytes.lo = flags;
  return result;
}

static uint16_t sbc16(uint16_t left, uint16_t right) {
  unsigned int carry = state.af.bytes.lo & 1u;
  unsigned int operand = (unsigned int)right + carry;
  uint16_t result = (uint16_t)((unsigned int)left - operand);
  uint8_t flags = (uint8_t)(0x02u | ((result >> 8) & 0xa8u));

  if (result == 0) flags |= 0x40u;
  if (((left ^ right ^ result) & 0x1000u) != 0) flags |= 0x10u;
  if (((left ^ right) & (left ^ result) & 0x8000u) != 0) flags |= 0x04u;
  if ((unsigned int)left < operand) flags |= 0x01u;
  state.af.bytes.lo = flags;
  return result;
}

/* ED 0x40-0x7F: IN r,(C) / OUT (C),r. */
static void extendedInOut(void) {
  unsigned int register_code = (state.op_code >> 3) & 7u;

  state.wz.word = (uint16_t)(state.bc.word + 1u);
  if ((state.op_code & 1u) == 0) {
    uint8_t value = readPort(state.bc.word);
    if (register_code != 6) writeRegister(register_code, value);
    state.af.bytes.lo = (uint8_t)((state.af.bytes.lo & 1u) | sz53(value));
  } else {
    writePort(state.bc.word, register_code == 6 ? 0 : readRegister(register_code));
  }
}

/* ED 0x42/52/62/72 and 0x4A/5A/6A/7A: SBC/ADC HL,ss. */
static void extendedAdcSbcHl(void) {
  uint16_t operand = selectRegisterPair((state.op_code >> 4) & 3u);

  tactPlusN(7);
  if ((state.op_code & 0x08u) == 0) state.hl.word = sbc16(state.hl.word, operand);
  else state.hl.word = adc16(state.hl.word, operand);
}

/* ED 0x43/53/63/73 and 0x4B/5B/6B/7B: LD (nn),ss / LD ss,(nn). */
static void extendedLoad16(void) {
  uint16_t address = fetchCodeWord();
  unsigned int selector = (state.op_code >> 4) & 3u;

  if ((state.op_code & 0x08u) == 0) {
    uint16_t value = selectRegisterPair(selector);
    writeMemory(address, (uint8_t)value);
    state.wz.word = (uint16_t)(address + 1u);
    writeMemory(state.wz.word, (uint8_t)(value >> 8));
  } else {
    uint8_t low = readMemory(address, 0);
    state.wz.word = (uint16_t)(address + 1u);
    storeRegisterPair(selector, (uint16_t)(low | (readMemory(state.wz.word, 0) << 8)));
  }
}

static void neg(void) {
  uint8_t value = state.af.bytes.hi;
  state.af.bytes.hi = sub8(0, value, 0);
}

static void retn(void) {
  state.flags = (uint8_t)((state.flags & ~Z80_STATE_IFF1) |
    ((state.flags & Z80_STATE_IFF2) != 0 ? Z80_STATE_IFF1 : 0));
  state.wz.bytes.lo = readMemory(state.sp++, 0);
  state.wz.bytes.hi = readMemory(state.sp++, 0);
  state.pc = state.wz.word;
}

static void extendedIm(void) {
  state.interrupt_mode = state.op_code == 0x56 || state.op_code == 0x76 ? 1 :
    (state.op_code == 0x5e || state.op_code == 0x7e ? 2 : 0);
}

static void ldIA(void) { tactPlusN(1); state.ir.bytes.hi = state.af.bytes.hi; }
static void ldRA(void) { tactPlusN(1); state.ir.bytes.lo = state.af.bytes.hi; }
static void ldAI(void) {
  uint8_t carry = state.af.bytes.lo & 1u;
  tactPlusN(1);
  state.af.bytes.hi = state.ir.bytes.hi;
  state.af.bytes.lo = (uint8_t)(carry | sz53(state.af.bytes.hi) | ((state.flags & Z80_STATE_IFF2) != 0 ? 4u : 0));
  state.flags |= Z80_STATE_AFTER_LD_AIR;
}
static void ldAR(void) {
  uint8_t carry = state.af.bytes.lo & 1u;
  tactPlusN(1);
  state.af.bytes.hi = state.ir.bytes.lo;
  state.af.bytes.lo = (uint8_t)(carry | sz53(state.af.bytes.hi) | ((state.flags & Z80_STATE_IFF2) != 0 ? 4u : 0));
  state.flags |= Z80_STATE_AFTER_LD_AIR;
}

static void rrd(void) {
  uint8_t value = readMemory(state.hl.word, 0);
  tactPlusN(4);
  writeMemory(state.hl.word, (uint8_t)((state.af.bytes.hi << 4) | (value >> 4)));
  state.af.bytes.hi = (uint8_t)((state.af.bytes.hi & 0xf0u) | (value & 0x0fu));
  state.af.bytes.lo = (uint8_t)((state.af.bytes.lo & 1u) | sz53pv(state.af.bytes.hi));
  state.wz.word = (uint16_t)(state.hl.word + 1u);
}

static void rld(void) {
  uint8_t value = readMemory(state.hl.word, 0);
  tactPlusN(4);
  writeMemory(state.hl.word, (uint8_t)((value << 4) | (state.af.bytes.hi & 0x0fu)));
  state.af.bytes.hi = (uint8_t)((state.af.bytes.hi & 0xf0u) | (value >> 4));
  state.af.bytes.lo = (uint8_t)((state.af.bytes.lo & 1u) | sz53pv(state.af.bytes.hi));
  state.wz.word = (uint16_t)(state.hl.word + 1u);
}

static uint8_t halfCarrySubFlag(uint8_t left, uint8_t right, uint8_t result) {
  return ((left ^ right ^ result) & 0x10u) != 0 ? 0x10u : 0;
}

static void blockTransfer(unsigned int decrement, unsigned int repeat) {
  uint8_t value = readMemory(state.hl.word, 0);
  uint16_t adjusted_bc;
  uint8_t tmp;

  writeMemory(state.de.word, value);
  tactPlusN(2);
  state.bc.word--;
  adjusted_bc = state.bc.word;
  tmp = (uint8_t)(value + state.af.bytes.hi);
  state.af.bytes.lo = (uint8_t)((state.af.bytes.lo & 0xc1u) |
    (adjusted_bc != 0 ? 0x04u : 0) |
    (tmp & 0x08u) |
    ((tmp & 0x02u) != 0 ? 0x20u : 0));
  if (repeat && adjusted_bc != 0) {
    tactPlusN(5);
    state.pc = (uint16_t)(state.pc - 2u);
    state.wz.word = (uint16_t)(state.pc + 1u);
  }
  if (decrement) {
    state.hl.word--;
    state.de.word--;
  } else {
    state.hl.word++;
    state.de.word++;
  }
}

static void blockCompare(unsigned int decrement, unsigned int repeat) {
  uint8_t value = readMemory(state.hl.word, 0);
  uint8_t tmp = (uint8_t)(state.af.bytes.hi - value);
  uint8_t flags;

  tactPlusN(5);
  state.bc.word--;
  flags = (uint8_t)((state.af.bytes.lo & 1u) | 0x02u |
    (state.bc.word != 0 ? 0x04u : 0) |
    halfCarrySubFlag(state.af.bytes.hi, value, tmp) |
    (tmp == 0 ? 0x40u : 0) |
    (tmp & 0x80u));
  if ((flags & 0x10u) != 0) tmp--;
  flags |= (uint8_t)((tmp & 0x08u) | ((tmp & 0x02u) != 0 ? 0x20u : 0));
  state.af.bytes.lo = flags;
  if (repeat && (flags & 0x44u) == 0x04u) {
    tactPlusN(5);
    state.pc = (uint16_t)(state.pc - 2u);
    state.wz.word = (uint16_t)(state.pc + 1u);
  } else {
    state.wz.word = (uint16_t)(state.wz.word + (decrement ? -1 : 1));
  }
  if (decrement) state.hl.word--;
  else state.hl.word++;
}

static void blockInput(unsigned int decrement, unsigned int repeat) {
  uint8_t value;
  uint8_t tmp2;

  initializeParityTable();
  tactPlusN(1);
  value = readPort(state.bc.word);
  writeMemory(state.hl.word, value);
  state.wz.word = (uint16_t)(state.bc.word + (decrement ? -1 : 1));
  state.bc.bytes.hi--;
  if (decrement) {
    state.hl.word--;
    tmp2 = (uint8_t)(value + state.bc.bytes.lo - 1u);
  } else {
    state.hl.word++;
    tmp2 = (uint8_t)(value + state.bc.bytes.lo + 1u);
  }
  state.af.bytes.lo = (uint8_t)(((value & 0x80u) != 0 ? 0x02u : 0) |
    (tmp2 < value ? 0x11u : 0) |
    (parity_table[(tmp2 & 0x07u) ^ state.bc.bytes.hi] != 0 ? 0x04u : 0) |
    sz53(state.bc.bytes.hi));
  if (repeat && state.bc.bytes.hi != 0) {
    tactPlusN(5);
    state.pc = (uint16_t)(state.pc - 2u);
  }
}

static void blockOutput(unsigned int decrement, unsigned int repeat) {
  uint8_t value;
  uint8_t tmp2;

  initializeParityTable();
  tactPlusN(1);
  value = readMemory(state.hl.word, 0);
  state.bc.bytes.hi--;
  state.wz.word = (uint16_t)(state.bc.word + (decrement ? -1 : 1));
  writePort(state.bc.word, value);
  if (decrement) {
    state.hl.word--;
  } else {
    state.hl.word++;
  }
  tmp2 = (uint8_t)(value + state.hl.bytes.lo);
  state.af.bytes.lo = (uint8_t)(((value & 0x80u) != 0 ? 0x02u : 0) |
    (tmp2 < value ? 0x11u : 0) |
    (parity_table[(tmp2 & 0x07u) ^ state.bc.bytes.hi] != 0 ? 0x04u : 0) |
    sz53(state.bc.bytes.hi));
  if (repeat && state.bc.bytes.hi != 0) {
    tactPlusN(5);
    state.pc = (uint16_t)(state.pc - 2u);
  }
}

static void ldi(void) { blockTransfer(0, 0); }
static void cpi(void) { blockCompare(0, 0); }
static void ini(void) { blockInput(0, 0); }
static void outi(void) { blockOutput(0, 0); }
static void ldd(void) { blockTransfer(1, 0); }
static void cpd(void) { blockCompare(1, 0); }
static void ind(void) { blockInput(1, 0); }
static void outd(void) { blockOutput(1, 0); }
static void ldir(void) { blockTransfer(0, 1); }
static void cpir(void) { blockCompare(0, 1); }
static void inir(void) { blockInput(0, 1); }
static void otir(void) { blockOutput(0, 1); }
static void lddr(void) { blockTransfer(1, 1); }
static void cpdr(void) { blockCompare(1, 1); }
static void indr(void) { blockInput(1, 1); }
static void otdr(void) { blockOutput(1, 1); }

static uint8_t mirrorByte(uint8_t value) {
  uint8_t result = 0;
  unsigned int index;

  for (index = 0; index < 8; index++) {
    result = (uint8_t)((result << 1) | (value & 1u));
    value >>= 1;
  }
  return result;
}

static void swapnib(void) {
  state.af.bytes.hi = (uint8_t)((state.af.bytes.hi << 4) | (state.af.bytes.hi >> 4));
}

static void mirrorA(void) {
  state.af.bytes.hi = mirrorByte(state.af.bytes.hi);
}

static void testN(void) {
  uint8_t value = readMemory(state.pc++, 0);

  state.af.bytes.lo = (uint8_t)(0x10u | sz53pv(state.af.bytes.hi & value));
}

static void bsla(void) {
  unsigned int shift = state.bc.bytes.hi & 0x1fu;

  if (shift == 0) return;
  state.de.word = shift >= 0x10u ? 0 : (uint16_t)(state.de.word << shift);
}

static void bsra(void) {
  unsigned int shift = state.bc.bytes.hi & 0x1fu;
  unsigned int negative = state.de.word & 0x8000u;

  if (shift == 0) return;
  if (shift >= 15u) state.de.word = negative ? 0xffffu : 0;
  else state.de.word = (uint16_t)((state.de.word >> shift) | (negative ? (0xffffu << (15u - shift)) : 0));
}

static void bsrl(void) {
  unsigned int shift = state.bc.bytes.hi & 0x1fu;

  if (shift == 0) return;
  state.de.word = shift >= 0x10u ? 0 : (uint16_t)(state.de.word >> shift);
}

static void bsrf(void) {
  unsigned int shift = state.bc.bytes.hi & 0x1fu;

  if (shift == 0) return;
  state.de.word = shift >= 0x10u ? 0xffffu : (uint16_t)((state.de.word >> shift) | (0xffffu << (16u - shift)));
}

static void brlc(void) {
  unsigned int rolls = state.bc.bytes.hi & 0x0fu;

  if (rolls != 0) state.de.word = (uint16_t)((state.de.word << rolls) | (state.de.word >> (16u - rolls)));
}

static void mulDE(void) {
  state.de.word = (uint16_t)((unsigned int)state.de.bytes.hi * state.de.bytes.lo);
}

static void addHLA(void) { state.hl.word = (uint16_t)(state.hl.word + state.af.bytes.hi); }
static void addDEA(void) { state.de.word = (uint16_t)(state.de.word + state.af.bytes.hi); }
static void addBCA(void) { state.bc.word = (uint16_t)(state.bc.word + state.af.bytes.hi); }
static void addHLNN(void) { state.hl.word = (uint16_t)(state.hl.word + fetchCodeWord()); tactPlusN(2); }
static void addDENN(void) { state.de.word = (uint16_t)(state.de.word + fetchCodeWord()); tactPlusN(2); }
static void addBCNN(void) { state.bc.word = (uint16_t)(state.bc.word + fetchCodeWord()); tactPlusN(2); }

static void pushNN(void) {
  state.sp--;
  writeMemory(state.sp, readMemory(state.pc++, 0));
  state.sp--;
  writeMemory(state.sp, readMemory(state.pc++, 0));
  tactPlusN(3);
}

static void outinb(void) {
  uint8_t value;

  tactPlusN(1);
  value = readMemory(state.hl.word, 0);
  writePort(state.bc.word, value);
  state.hl.word++;
}

static void nextregn(void) {
  uint8_t reg = readMemory(state.pc++, 0);
  uint8_t value = readMemory(state.pc++, 0);

  tbblueOut(reg, value);
  tactPlusN(6);
}

static void nextrega(void) {
  uint8_t reg = readMemory(state.pc++, 0);

  tbblueOut(reg, state.af.bytes.hi);
  tactPlusN(3);
}

static void pixeldn(void) {
  uint16_t hl = state.hl.word;

  if ((hl & 0x0700u) != 0x0700u) state.hl.bytes.hi++;
  else if ((hl & 0xe0u) != 0xe0u) state.hl.word = (uint16_t)((hl & 0xf8ffu) + 0x20u);
  else state.hl.word = (uint16_t)((hl & 0xf81fu) + 0x0800u);
}

static void pixelad(void) {
  state.hl.word = (uint16_t)(0x4000u + ((state.de.bytes.hi & 0xc0u) << 5) +
    ((state.de.bytes.hi & 0x07u) << 8) + ((state.de.bytes.hi & 0x38u) << 2) +
    (state.de.bytes.lo >> 3));
}

static void setae(void) {
  state.af.bytes.hi = (uint8_t)(0x80u >> (state.de.bytes.lo & 7u));
}

static void jpc(void) {
  state.pc = state.wz.word = (uint16_t)((state.pc & 0xc000u) | (readPort(state.bc.word) << 6));
  tactPlusN(1);
}

static void nextBlockTransfer(unsigned int decrement, unsigned int repeat, unsigned int pixel) {
  uint16_t source = pixel ? (uint16_t)((state.hl.word & ~0x07u) | (state.de.bytes.lo & 7u)) : state.hl.word;
  uint8_t value;

  if (pixel && (state.bc.bytes.hi != 0 || state.bc.bytes.lo != 1)) state.wz.word = state.pc;
  value = readMemory(source, 0);
  if (value != state.af.bytes.hi) writeMemory(state.de.word, value);
  else tactPlusN(3);
  tactPlusN(2);
  state.bc.word--;
  if (repeat && state.bc.word != 0) {
    tactPlusN(5);
    state.pc = (uint16_t)(state.pc - 2u);
  }
  state.de.word++;
  if (!pixel) {
    if (decrement) state.hl.word--;
    else state.hl.word++;
  }
}

static void ldix(void) { nextBlockTransfer(0, 0, 0); }
static void lddx(void) { nextBlockTransfer(1, 0, 0); }
static void ldirx(void) { nextBlockTransfer(0, 1, 0); }
static void ldpirx(void) { nextBlockTransfer(0, 1, 1); }
static void lddrx(void) { nextBlockTransfer(1, 1, 0); }

static void ldws(void) {
  uint8_t value = readMemory(state.hl.word, 0);

  writeMemory(state.de.word, value);
  state.hl.bytes.lo++;
  state.af.bytes.lo = (uint8_t)((state.af.bytes.lo & 1u) | sz53((uint8_t)(state.de.bytes.hi + 1u)) |
    ((state.de.bytes.hi & 0x0fu) == 0x0fu ? 0x10u : 0) |
    (state.de.bytes.hi == 0x7fu ? 0x04u : 0));
  state.de.bytes.hi++;
}

// 0x00: NOP
static void nop(void) {
}

// 0x01: LD BC,nn
static void ldBcNN(void) {
  state.bc.word = fetchCodeWord();
}

// 0x02: LD (BC),A
static void ldBciA(void) {
  writeMemory(state.bc.word, state.af.bytes.hi);
  state.wz.bytes.hi = state.af.bytes.hi;
}

// 0x03: INC BC
static void incBc(void) {
  state.bc.word++;
  tactPlusN(2);
}

// 0x04: INC B
static void incB(void) {
  state.bc.bytes.hi = inc8(state.bc.bytes.hi);
}

// 0x05: DEC B
static void decB(void) {
  state.bc.bytes.hi = dec8(state.bc.bytes.hi);
}

// 0x06: LD B,n
static void ldBN(void) {
  state.bc.bytes.hi = readMemory(state.pc++, 0);
}

// 0x07: RLCA
static void rlca(void) {
  uint8_t value = state.af.bytes.hi;

  state.af.bytes.hi = (uint8_t)((value << 1) | (value >> 7));
  state.af.bytes.lo = (uint8_t)((state.af.bytes.lo & 0xc4u) |
    (state.af.bytes.hi & 0x28u) | (value >> 7));
}

// 0x08: EX AF,AF'
static void exAf(void) {
  uint16_t value = state.af.word;

  state.af.word = state.af_alt.word;
  state.af_alt.word = value;
}

// 0x09: ADD HL,BC
static void addHlBc(void) {
  state.hl.word = add16(state.hl.word, state.bc.word);
  tactPlusN(7);
}

// 0x0A: LD A,(BC)
static void ldABci(void) {
  state.wz.word = (uint16_t)(state.bc.word + 1u);
  state.af.bytes.hi = readMemory(state.bc.word, 0);
}

// 0x0B: DEC BC
static void decBc(void) {
  state.bc.word--;
  tactPlusN(2);
}

// 0x0C: INC C
static void incC(void) {
  state.bc.bytes.lo = inc8(state.bc.bytes.lo);
}

// 0x0D: DEC C
static void decC(void) {
  state.bc.bytes.lo = dec8(state.bc.bytes.lo);
}

// 0x0E: LD C,n
static void ldCN(void) {
  state.bc.bytes.lo = readMemory(state.pc++, 0);
}

// 0x0F: RRCA
static void rrca(void) {
  uint8_t value = state.af.bytes.hi;

  state.af.bytes.hi = (uint8_t)((value >> 1) | (value << 7));
  state.af.bytes.lo = (uint8_t)((state.af.bytes.lo & 0xc4u) |
    (state.af.bytes.hi & 0x28u) | (value & 1u));
}

// 0x10: DJNZ d
static void djnz(void) {
  uint8_t displacement;

  tactPlusN(1);
  displacement = readMemory(state.pc++, 0);
  if (--state.bc.bytes.hi != 0) {
    tactPlusN(5);
    state.pc = (uint16_t)(state.pc + (int8_t)displacement);
    state.wz.word = state.pc;
  }
}

// 0x11: LD DE,nn
static void ldDeNN(void) {
  state.de.word = fetchCodeWord();
}

// 0x12: LD (DE),A
static void ldDeiA(void) {
  writeMemory(state.de.word, state.af.bytes.hi);
  state.wz.bytes.hi = state.af.bytes.hi;
}

// 0x13: INC DE
static void incDe(void) {
  state.de.word++;
  tactPlusN(2);
}

// 0x14: INC D
static void incD(void) {
  state.de.bytes.hi = inc8(state.de.bytes.hi);
}

// 0x15: DEC D
static void decD(void) {
  state.de.bytes.hi = dec8(state.de.bytes.hi);
}

// 0x16: LD D,n
static void ldDN(void) {
  state.de.bytes.hi = readMemory(state.pc++, 0);
}

// 0x17: RLA
static void rla(void) {
  uint8_t value = state.af.bytes.hi;

  state.af.bytes.hi = (uint8_t)((value << 1) | (state.af.bytes.lo & 1u));
  state.af.bytes.lo = (uint8_t)((state.af.bytes.lo & 0xc4u) |
    (state.af.bytes.hi & 0x28u) | (value >> 7));
}

// 0x18: JR d
static void jr(void) {
  uint8_t displacement = readMemory(state.pc++, 0);

  tactPlusN(5);
  state.pc = (uint16_t)(state.pc + (int8_t)displacement);
  state.wz.word = state.pc;
}

// 0x19: ADD HL,DE
static void addHlDe(void) {
  state.hl.word = add16(state.hl.word, state.de.word);
  tactPlusN(7);
}

// 0x1A: LD A,(DE)
static void ldADei(void) {
  state.wz.word = (uint16_t)(state.de.word + 1u);
  state.af.bytes.hi = readMemory(state.de.word, 0);
}

// 0x1B: DEC DE
static void decDe(void) {
  state.de.word--;
  tactPlusN(2);
}

// 0x1C: INC E
static void incE(void) {
  state.de.bytes.lo = inc8(state.de.bytes.lo);
}

// 0x1D: DEC E
static void decE(void) {
  state.de.bytes.lo = dec8(state.de.bytes.lo);
}

// 0x1E: LD E,n
static void ldEN(void) {
  state.de.bytes.lo = readMemory(state.pc++, 0);
}

// 0x1F: RRA
static void rra(void) {
  uint8_t value = state.af.bytes.hi;

  state.af.bytes.hi = (uint8_t)((value >> 1) | ((state.af.bytes.lo & 1u) << 7));
  state.af.bytes.lo = (uint8_t)((state.af.bytes.lo & 0xc4u) |
    (state.af.bytes.hi & 0x28u) | (value & 1u));
}

// Setup dependencies used by the literal S00/S10 test-page clones.
static void ldHlNN(void) {
  state.hl.word = fetchCodeWord();
}

static void scf(void) {
  state.af.bytes.lo = (uint8_t)((state.af.bytes.lo & 0xc4u) |
    (state.af.bytes.hi & 0x28u) | 0x01u);
}

static void ld_a_n(void) {
  state.af.bytes.hi = readMemory(state.pc++, 0);
}

// 0x20: JR NZ,d
static void jrnz(void) { uint8_t d = readMemory(state.pc++, 0); if ((state.af.bytes.lo & 0x40u) == 0) { tactPlusN(5); state.pc = (uint16_t)(state.pc + (int8_t)d); state.wz.word = state.pc; } }
// 0x22: LD (nn),HL
static void ldNNiHl(void) { uint16_t a = fetchCodeWord(); writeMemory(a, state.hl.bytes.lo); state.wz.word = (uint16_t)(a + 1u); writeMemory(state.wz.word, state.hl.bytes.hi); }
// 0x23: INC HL
static void incHl(void) { state.hl.word++; tactPlusN(2); }
// 0x24: INC H
static void incH(void) { state.hl.bytes.hi = inc8(state.hl.bytes.hi); }
// 0x25: DEC H
static void decH(void) { state.hl.bytes.hi = dec8(state.hl.bytes.hi); }
// 0x26: LD H,n
static void ldHN(void) { state.hl.bytes.hi = readMemory(state.pc++, 0); }
// 0x27: DAA
static void daa(void) {
  uint8_t f = state.af.bytes.lo;
  uint8_t adjust = 0;
  unsigned int carry = f & 1u;

  if ((f & 0x10u) != 0 || (state.af.bytes.hi & 0x0fu) > 9u) adjust = 0x06u;
  if (carry || state.af.bytes.hi > 0x99u) adjust |= 0x60u;
  if (state.af.bytes.hi > 0x99u) carry = 1;
  if ((f & 0x02u) != 0) state.af.bytes.hi = sub8(state.af.bytes.hi, adjust, 0);
  else state.af.bytes.hi = add8(state.af.bytes.hi, adjust, 0);
  initializeParityTable();
  state.af.bytes.lo = (uint8_t)((state.af.bytes.lo & ~0x05u) | carry | parity_table[state.af.bytes.hi]);
}
// 0x28: JR Z,d
static void jrz(void) { uint8_t d = readMemory(state.pc++, 0); if ((state.af.bytes.lo & 0x40u) != 0) { tactPlusN(5); state.pc = (uint16_t)(state.pc + (int8_t)d); state.wz.word = state.pc; } }
// 0x29: ADD HL,HL
static void addHlHl(void) { state.hl.word = add16(state.hl.word, state.hl.word); tactPlusN(7); }
// 0x2A: LD HL,(nn)
static void ldHlNNi(void) { uint16_t a = fetchCodeWord(); state.hl.bytes.lo = readMemory(a, 0); state.wz.word = (uint16_t)(a + 1u); state.hl.bytes.hi = readMemory(state.wz.word, 0); }
// 0x2B: DEC HL
static void decHl(void) { state.hl.word--; tactPlusN(2); }
// 0x2C: INC L
static void incL(void) { state.hl.bytes.lo = inc8(state.hl.bytes.lo); }
// 0x2D: DEC L
static void decL(void) { state.hl.bytes.lo = dec8(state.hl.bytes.lo); }
// 0x2E: LD L,n
static void ldLN(void) { state.hl.bytes.lo = readMemory(state.pc++, 0); }
// 0x2F: CPL
static void cpl(void) { state.af.bytes.hi = (uint8_t)~state.af.bytes.hi; state.af.bytes.lo = (uint8_t)((state.af.bytes.lo & 0xc5u) | 0x12u | (state.af.bytes.hi & 0x28u)); }
// Setup dependency: 0x3D DEC A
static void decA(void) { state.af.bytes.hi = dec8(state.af.bytes.hi); }
static void jrnc(void) { uint8_t d = readMemory(state.pc++, 0); if ((state.af.bytes.lo & 1u) == 0) { tactPlusN(5); state.pc = (uint16_t)(state.pc + (int8_t)d); state.wz.word = state.pc; } }
static void ldSpNN(void) { state.sp = fetchCodeWord(); }
static void ldNNiA(void) { uint16_t a = fetchCodeWord(); state.wz.word = (uint16_t)(a + 1u); state.wz.bytes.hi = state.af.bytes.hi; writeMemory(a, state.af.bytes.hi); }
static void incSp(void) { state.sp++; tactPlusN(2); }
static void incHli(void) { uint8_t v = readMemory(state.hl.word, 0); tactPlusN(1); v = inc8(v); writeMemory(state.hl.word, v); }
static void decHli(void) { uint8_t v = readMemory(state.hl.word, 0); tactPlusN(1); v = dec8(v); writeMemory(state.hl.word, v); }
static void ldHliN(void) { writeMemory(state.hl.word, readMemory(state.pc++, 0)); }
static void jrc(void) { uint8_t d = readMemory(state.pc++, 0); if ((state.af.bytes.lo & 1u) != 0) { tactPlusN(5); state.pc = (uint16_t)(state.pc + (int8_t)d); state.wz.word = state.pc; } }
static void addHlSp(void) { state.hl.word = add16(state.hl.word, state.sp); tactPlusN(7); }
static void ldANNi(void) { state.wz.word = fetchCodeWord(); state.af.bytes.hi = readMemory(state.wz.word, 0); state.wz.word++; }
static void decSp(void) { state.sp--; tactPlusN(2); }
static void incA(void) { state.af.bytes.hi = inc8(state.af.bytes.hi); }
static void ccf(void) { uint8_t c = state.af.bytes.lo & 1u; state.af.bytes.lo = (uint8_t)((state.af.bytes.lo & 0xc4u) | (state.af.bytes.hi & 0x28u) | (c ? 0x10u : 1u)); }

static uint8_t readRegister(unsigned int registerCode) {
  switch (registerCode) {
    case 0: return state.bc.bytes.hi;
    case 1: return state.bc.bytes.lo;
    case 2: return state.de.bytes.hi;
    case 3: return state.de.bytes.lo;
    case 4: return state.hl.bytes.hi;
    case 5: return state.hl.bytes.lo;
    case 6: return readMemory(state.hl.word, 0);
    default: return state.af.bytes.hi;
  }
}

static void writeRegister(unsigned int registerCode, uint8_t value) {
  switch (registerCode) {
    case 0: state.bc.bytes.hi = value; break;
    case 1: state.bc.bytes.lo = value; break;
    case 2: state.de.bytes.hi = value; break;
    case 3: state.de.bytes.lo = value; break;
    case 4: state.hl.bytes.hi = value; break;
    case 5: state.hl.bytes.lo = value; break;
    case 6: writeMemory(state.hl.word, value); break;
    default: state.af.bytes.hi = value; break;
  }
}

// 0x40-0x6F: LD r,r' / LD r,(HL). Individual encodings share identical
// selector semantics; HALT (0x76) is deliberately owned by S70.
static void ldRegisterToRegister(void) {
  unsigned int destination = (state.op_code >> 3) & 7u;
  unsigned int source = state.op_code & 7u;

  writeRegister(destination, readRegister(source));
}

// 0x76: HALT
static void halt(void) {
  state.flags |= Z80_STATE_HALTED;
  state.pc--;
}

// 0x80-0x87: ADD A,r
static void addAR(void) { state.af.bytes.hi = add8(state.af.bytes.hi, readRegister(state.op_code & 7u), 0); }
// 0x88-0x8F: ADC A,r
static void adcAR(void) { state.af.bytes.hi = add8(state.af.bytes.hi, readRegister(state.op_code & 7u), state.af.bytes.lo & 1u); }
// 0x90-0x97: SUB r
static void subR(void) { state.af.bytes.hi = sub8(state.af.bytes.hi, readRegister(state.op_code & 7u), 0); }
// 0x98-0x9F: SBC A,r
static void sbcAR(void) { state.af.bytes.hi = sub8(state.af.bytes.hi, readRegister(state.op_code & 7u), state.af.bytes.lo & 1u); }
// 0xA0-0xA7: AND r
static void andR(void) { state.af.bytes.hi &= readRegister(state.op_code & 7u); initializeParityTable(); state.af.bytes.lo = (uint8_t)(0x10u | (state.af.bytes.hi & 0xa8u) | (state.af.bytes.hi == 0 ? 0x40u : 0) | parity_table[state.af.bytes.hi]); }
// 0xA8-0xAF: XOR r
static void xorR(void) { state.af.bytes.hi ^= readRegister(state.op_code & 7u); initializeParityTable(); state.af.bytes.lo = (uint8_t)((state.af.bytes.hi & 0xa8u) | (state.af.bytes.hi == 0 ? 0x40u : 0) | parity_table[state.af.bytes.hi]); }
// 0xB0-0xB7: OR r
static void orR(void) { state.af.bytes.hi |= readRegister(state.op_code & 7u); initializeParityTable(); state.af.bytes.lo = (uint8_t)((state.af.bytes.hi & 0xa8u) | (state.af.bytes.hi == 0 ? 0x40u : 0) | parity_table[state.af.bytes.hi]); }
// 0xB8-0xBF: CP r
static void cpR(void) { uint8_t a = state.af.bytes.hi; uint8_t value = readRegister(state.op_code & 7u); (void)sub8(a, value, 0); state.af.bytes.hi = a; state.af.bytes.lo = (uint8_t)((state.af.bytes.lo & ~0x28u) | (value & 0x28u)); }

static void ret(void) {
  state.wz.bytes.lo = readMemory(state.sp++, 0);
  state.wz.bytes.hi = readMemory(state.sp++, 0);
  state.pc = state.wz.word;
}

static void retCC(void) {
  tactPlusN(1);
  if (conditionIsTrue((state.op_code >> 3) & 7u)) ret();
}

static void jpCC(void) {
  state.wz.word = fetchCodeWord();
  if (conditionIsTrue((state.op_code >> 3) & 7u)) state.pc = state.wz.word;
}

static void jp(void) {
  state.wz.word = fetchCodeWord();
  state.pc = state.wz.word;
}

static void call(void) {
  state.wz.word = fetchCodeWord();
  push_pc();
  state.pc = state.wz.word;
}

static void callCC(void) {
  state.wz.word = fetchCodeWord();
  if (conditionIsTrue((state.op_code >> 3) & 7u)) {
    push_pc();
    state.pc = state.wz.word;
  }
}

static void popQQ(void) {
  uint16_t value = (uint16_t)(readMemory(state.sp++, 0) | (readMemory(state.sp++, 0) << 8));

  switch ((state.op_code >> 4) & 3u) {
    case 0: state.bc.word = value; break;
    case 1: state.de.word = value; break;
    case 2: state.hl.word = value; break;
    default: state.af.word = value; break;
  }
}

static void pushQQ(void) {
  uint16_t value;

  tactPlusN(1);
  switch ((state.op_code >> 4) & 3u) {
    case 0: value = state.bc.word; break;
    case 1: value = state.de.word; break;
    case 2: value = state.hl.word; break;
    default: value = state.af.word; break;
  }
  state.sp--;
  writeMemory(state.sp, value >> 8);
  state.sp--;
  writeMemory(state.sp, value);
}

static void rst(void) {
  push_pc();
  state.pc = state.wz.word = (uint16_t)(state.op_code & 0x38u);
}

static void addAN(void) {
  state.af.bytes.hi = add8(state.af.bytes.hi, readMemory(state.pc++, 0), 0);
}

static void adcAN(void) {
  state.af.bytes.hi = add8(state.af.bytes.hi, readMemory(state.pc++, 0), state.af.bytes.lo & 1u);
}

static void subAN(void) {
  state.af.bytes.hi = sub8(state.af.bytes.hi, readMemory(state.pc++, 0), 0);
}

static void sbcAN(void) {
  state.af.bytes.hi = sub8(state.af.bytes.hi, readMemory(state.pc++, 0), state.af.bytes.lo & 1u);
}

// 0xD3: OUT (n),A
static void outNA(void) {
  uint8_t low = readMemory(state.pc++, 0);
  uint16_t port = (uint16_t)(low | (state.af.bytes.hi << 8));

  state.wz.bytes.hi = state.af.bytes.hi;
  state.wz.bytes.lo = (uint8_t)(low + 1u);
  writePort(port, state.af.bytes.hi);
}

// 0xD9: EXX
static void exx(void) {
  uint16_t value = state.bc.word;

  state.bc.word = state.bc_alt.word;
  state.bc_alt.word = value;
  value = state.de.word;
  state.de.word = state.de_alt.word;
  state.de_alt.word = value;
  value = state.hl.word;
  state.hl.word = state.hl_alt.word;
  state.hl_alt.word = value;
}

// 0xDB: IN A,(n)
static void inAN(void) {
  uint16_t port = (uint16_t)(readMemory(state.pc++, 0) | (state.af.bytes.hi << 8));

  state.af.bytes.hi = readPort(port);
  state.wz.word = (uint16_t)(port + 1u);
}

// 0xE3: EX (SP),HL
static void exSpiHl(void) {
  uint16_t sp1 = (uint16_t)(state.sp + 1u);
  uint8_t low = readMemory(state.sp, 0);
  uint8_t high = readMemory(sp1, 0);

  tactPlusN(1);
  writeMemory(sp1, state.hl.bytes.hi);
  writeMemory(state.sp, state.hl.bytes.lo);
  tactPlusN(2);
  state.wz.bytes.lo = low;
  state.wz.bytes.hi = high;
  state.hl.word = state.wz.word;
}

// 0xE6: AND A,n
static void andAN(void) {
  state.af.bytes.hi &= readMemory(state.pc++, 0);
  initializeParityTable();
  state.af.bytes.lo = (uint8_t)(0x10u | (state.af.bytes.hi & 0xa8u) |
    (state.af.bytes.hi == 0 ? 0x40u : 0) | parity_table[state.af.bytes.hi]);
}

// 0xE9: JP (HL)
static void jpHl(void) {
  state.pc = state.hl.word;
}

// 0xEB: EX DE,HL
static void exDeHl(void) {
  uint16_t value = state.de.word;

  state.de.word = state.hl.word;
  state.hl.word = value;
}

// 0xEE: XOR A,n
static void xorAN(void) {
  state.af.bytes.hi ^= readMemory(state.pc++, 0);
  initializeParityTable();
  state.af.bytes.lo = (uint8_t)((state.af.bytes.hi & 0xa8u) |
    (state.af.bytes.hi == 0 ? 0x40u : 0) | parity_table[state.af.bytes.hi]);
}

// 0xF3: DI
static void di(void) {
  state.flags &= (uint8_t)~(Z80_STATE_IFF1 | Z80_STATE_IFF2);
}

// 0xF6: OR A,n
static void orAN(void) {
  state.af.bytes.hi |= readMemory(state.pc++, 0);
  initializeParityTable();
  state.af.bytes.lo = (uint8_t)((state.af.bytes.hi & 0xa8u) |
    (state.af.bytes.hi == 0 ? 0x40u : 0) | parity_table[state.af.bytes.hi]);
}

// 0xF9: LD SP,HL
static void ldSpHl(void) {
  tactPlusN(2);
  state.sp = state.hl.word;
}

// 0xFB: EI
static void ei(void) {
  state.flags |= Z80_STATE_IFF1 | Z80_STATE_IFF2;
  state.ei_backlog = 2;
}

// 0xFE: CP A,n
static void cpAN(void) {
  uint8_t accumulator = state.af.bytes.hi;
  uint8_t value = readMemory(state.pc++, 0);

  (void)sub8(accumulator, value, 0);
  state.af.bytes.hi = accumulator;
  state.af.bytes.lo = (uint8_t)((state.af.bytes.lo & ~0x28u) | (value & 0x28u));
}

static unsigned int active_index_prefix;

static Z80Register16 *activeIndexRegister(void) {
  return active_index_prefix == 4 ? &state.iy : &state.ix;
}

static uint8_t readIndexedRegister(unsigned int registerCode) {
  Z80Register16 *index = activeIndexRegister();

  switch (registerCode & 7u) {
    case 0: return state.bc.bytes.hi;
    case 1: return state.bc.bytes.lo;
    case 2: return state.de.bytes.hi;
    case 3: return state.de.bytes.lo;
    case 4: return index->bytes.hi;
    case 5: return index->bytes.lo;
    case 6: return readMemory(state.wz.word, 0);
    default: return state.af.bytes.hi;
  }
}

static void writeIndexedRegister(unsigned int registerCode, uint8_t value) {
  Z80Register16 *index = activeIndexRegister();

  switch (registerCode & 7u) {
    case 0: state.bc.bytes.hi = value; break;
    case 1: state.bc.bytes.lo = value; break;
    case 2: state.de.bytes.hi = value; break;
    case 3: state.de.bytes.lo = value; break;
    case 4: index->bytes.hi = value; break;
    case 5: index->bytes.lo = value; break;
    case 6: writeMemory(state.wz.word, value); break;
    default: state.af.bytes.hi = value; break;
  }
}

static void fetchIndexedAddress(void) {
  uint8_t displacement = readMemory(state.pc, 0);

  tactPlusN(5);
  state.pc++;
  state.wz.word = (uint16_t)(activeIndexRegister()->word + (int8_t)displacement);
}

static void addXBc(void) { Z80Register16 *x = activeIndexRegister(); tactPlusN(7); x->word = add16(x->word, state.bc.word); }
static void addXDe(void) { Z80Register16 *x = activeIndexRegister(); tactPlusN(7); x->word = add16(x->word, state.de.word); }
static void ldXNN(void) { activeIndexRegister()->word = fetchCodeWord(); }
static void ldNNiX(void) {
  uint16_t address = fetchCodeWord();
  Z80Register16 *x = activeIndexRegister();

  writeMemory(address, x->bytes.lo);
  state.wz.word = (uint16_t)(address + 1u);
  writeMemory(state.wz.word, x->bytes.hi);
}
static void incX(void) { activeIndexRegister()->word++; tactPlusN(2); }
static void incXh(void) { Z80Register16 *x = activeIndexRegister(); x->bytes.hi = inc8(x->bytes.hi); }
static void decXh(void) { Z80Register16 *x = activeIndexRegister(); x->bytes.hi = dec8(x->bytes.hi); }
static void ldXhN(void) { activeIndexRegister()->bytes.hi = readMemory(state.pc++, 0); }
static void addXX(void) { Z80Register16 *x = activeIndexRegister(); tactPlusN(7); x->word = add16(x->word, x->word); }
static void ldXNNi(void) {
  uint16_t address = fetchCodeWord();
  Z80Register16 *x = activeIndexRegister();

  x->bytes.lo = readMemory(address, 0);
  state.wz.word = (uint16_t)(address + 1u);
  x->bytes.hi = readMemory(state.wz.word, 0);
}
static void decX(void) { activeIndexRegister()->word--; tactPlusN(2); }
static void incXl(void) { Z80Register16 *x = activeIndexRegister(); x->bytes.lo = inc8(x->bytes.lo); }
static void decXl(void) { Z80Register16 *x = activeIndexRegister(); x->bytes.lo = dec8(x->bytes.lo); }
static void ldXlN(void) { activeIndexRegister()->bytes.lo = readMemory(state.pc++, 0); }
static void incXi(void) { uint8_t value; fetchIndexedAddress(); value = readMemory(state.wz.word, 0); tactPlusN(1); value = inc8(value); writeMemory(state.wz.word, value); }
static void decXi(void) { uint8_t value; fetchIndexedAddress(); value = readMemory(state.wz.word, 0); tactPlusN(1); value = dec8(value); writeMemory(state.wz.word, value); }
static void ldXiN(void) {
  uint8_t displacement = readMemory(state.pc++, 0);
  uint8_t value;

  state.wz.word = (uint16_t)(activeIndexRegister()->word + (int8_t)displacement);
  value = readMemory(state.pc++, 0);
  tactPlusN(2);
  writeMemory(state.wz.word, value);
}
static void addXSp(void) { Z80Register16 *x = activeIndexRegister(); tactPlusN(7); x->word = add16(x->word, state.sp); }

static void indexedLdRegisterToRegister(void) {
  unsigned int source = state.op_code & 7u;
  unsigned int destination = (state.op_code >> 3) & 7u;
  uint8_t value;

  if (source == 6 || destination == 6) fetchIndexedAddress();
  if (source == 6) {
    value = readMemory(state.wz.word, 0);
    if (destination == 4) state.hl.bytes.hi = value;
    else if (destination == 5) state.hl.bytes.lo = value;
    else writeIndexedRegister(destination, value);
  } else if (destination == 6) {
    value = source == 4 ? state.hl.bytes.hi : (source == 5 ? state.hl.bytes.lo : readIndexedRegister(source));
    writeMemory(state.wz.word, value);
  } else {
    writeIndexedRegister(destination, readIndexedRegister(source));
  }
}

static void indexedAddAR(void) { if ((state.op_code & 7u) == 6) fetchIndexedAddress(); state.af.bytes.hi = add8(state.af.bytes.hi, readIndexedRegister(state.op_code & 7u), 0); }
static void indexedAdcAR(void) { if ((state.op_code & 7u) == 6) fetchIndexedAddress(); state.af.bytes.hi = add8(state.af.bytes.hi, readIndexedRegister(state.op_code & 7u), state.af.bytes.lo & 1u); }
static void indexedSubR(void) { if ((state.op_code & 7u) == 6) fetchIndexedAddress(); state.af.bytes.hi = sub8(state.af.bytes.hi, readIndexedRegister(state.op_code & 7u), 0); }
static void indexedSbcAR(void) { if ((state.op_code & 7u) == 6) fetchIndexedAddress(); state.af.bytes.hi = sub8(state.af.bytes.hi, readIndexedRegister(state.op_code & 7u), state.af.bytes.lo & 1u); }
static void indexedAndR(void) { if ((state.op_code & 7u) == 6) fetchIndexedAddress(); state.af.bytes.hi &= readIndexedRegister(state.op_code & 7u); initializeParityTable(); state.af.bytes.lo = (uint8_t)(0x10u | (state.af.bytes.hi & 0xa8u) | (state.af.bytes.hi == 0 ? 0x40u : 0) | parity_table[state.af.bytes.hi]); }
static void indexedXorR(void) { if ((state.op_code & 7u) == 6) fetchIndexedAddress(); state.af.bytes.hi ^= readIndexedRegister(state.op_code & 7u); initializeParityTable(); state.af.bytes.lo = (uint8_t)((state.af.bytes.hi & 0xa8u) | (state.af.bytes.hi == 0 ? 0x40u : 0) | parity_table[state.af.bytes.hi]); }
static void indexedOrR(void) { if ((state.op_code & 7u) == 6) fetchIndexedAddress(); state.af.bytes.hi |= readIndexedRegister(state.op_code & 7u); initializeParityTable(); state.af.bytes.lo = (uint8_t)((state.af.bytes.hi & 0xa8u) | (state.af.bytes.hi == 0 ? 0x40u : 0) | parity_table[state.af.bytes.hi]); }
static void indexedCpR(void) {
  uint8_t accumulator = state.af.bytes.hi;
  uint8_t value;

  if ((state.op_code & 7u) == 6) fetchIndexedAddress();
  value = readIndexedRegister(state.op_code & 7u);
  (void)sub8(accumulator, value, 0);
  state.af.bytes.hi = accumulator;
  state.af.bytes.lo = (uint8_t)((state.af.bytes.lo & ~0x28u) | (value & 0x28u));
}

static void popX(void) {
  Z80Register16 *x = activeIndexRegister();

  x->bytes.lo = readMemory(state.sp++, 0);
  x->bytes.hi = readMemory(state.sp++, 0);
}

static void exSpiX(void) {
  uint16_t sp1 = (uint16_t)(state.sp + 1u);
  uint8_t low = readMemory(state.sp, 0);
  uint8_t high = readMemory(sp1, 0);
  Z80Register16 *x = activeIndexRegister();

  tactPlusN(1);
  writeMemory(sp1, x->bytes.hi);
  writeMemory(state.sp, x->bytes.lo);
  tactPlusN(2);
  state.wz.bytes.lo = low;
  state.wz.bytes.hi = high;
  x->word = state.wz.word;
}

static void pushX(void) {
  Z80Register16 *x = activeIndexRegister();

  tactPlusN(1);
  state.sp--;
  writeMemory(state.sp, x->bytes.hi);
  state.sp--;
  writeMemory(state.sp, x->bytes.lo);
}

static void jpX(void) {
  state.pc = activeIndexRegister()->word;
}

static void ldSpX(void) {
  tactPlusN(2);
  state.sp = activeIndexRegister()->word;
}

static void indexedBitRotateShift(void) {
  unsigned int selector = state.op_code & 7u;
  unsigned int group = (state.op_code >> 3) & 7u;
  uint8_t result = executeBitRotateShift(readMemory(state.wz.word, 0), group);

  tactPlusN(1);
  writeMemory(state.wz.word, result);
  if (selector != 6) writeRegister(selector, result);
}

static void indexedBitTest(void) {
  unsigned int bit = (state.op_code >> 3) & 7u;
  uint8_t value = readMemory(state.wz.word, 0);
  uint8_t mask = (uint8_t)(1u << bit);
  uint8_t flags = (uint8_t)((state.af.bytes.lo & 1u) | 0x10u | (state.wz.bytes.hi & 0x28u));

  tactPlusN(1);
  if ((value & mask) == 0) flags |= 0x44u;
  if (bit == 7 && (value & 0x80u) != 0) flags |= 0x80u;
  state.af.bytes.lo = flags;
}

static void indexedBitReset(void) {
  unsigned int selector = state.op_code & 7u;
  uint8_t mask = (uint8_t)(1u << ((state.op_code >> 3) & 7u));
  uint8_t result = (uint8_t)(readMemory(state.wz.word, 0) & ~mask);

  tactPlusN(1);
  writeMemory(state.wz.word, result);
  if (selector != 6) writeRegister(selector, result);
}

static void indexedBitSet(void) {
  unsigned int selector = state.op_code & 7u;
  uint8_t mask = (uint8_t)(1u << ((state.op_code >> 3) & 7u));
  uint8_t result = (uint8_t)(readMemory(state.wz.word, 0) | mask);

  tactPlusN(1);
  writeMemory(state.wz.word, result);
  if (selector != 6) writeRegister(selector, result);
}

static Z80Operation standard_ops[256];
static Z80Operation bit_ops[256];
static Z80Operation extended_ops[256];
static Z80Operation z80n_extended_ops[256];
static Z80Operation indexed_ops[256];
static Z80Operation indexed_bit_ops[256];
static unsigned int operation_tables_initialized;

static void copyIndexedStandardRange(unsigned int first, unsigned int last) {
  unsigned int opcode;

  for (opcode = first; opcode <= last; opcode++) indexed_ops[opcode] = standard_ops[opcode];
}

static void initialize_operation_tables(void) {
  unsigned int opcode;
  if (operation_tables_initialized) return;
  for (opcode = 0; opcode < 256; opcode++) {
    standard_ops[opcode] = illegal_operation;
    bit_ops[opcode] = illegal_operation;
    extended_ops[opcode] = illegal_operation;
    z80n_extended_ops[opcode] = illegal_operation;
    indexed_ops[opcode] = illegal_operation;
    indexed_bit_ops[opcode] = illegal_operation;
  }
  standard_ops[0x00] = nop;
  standard_ops[0x01] = ldBcNN;
  standard_ops[0x02] = ldBciA;
  standard_ops[0x03] = incBc;
  standard_ops[0x04] = incB;
  standard_ops[0x05] = decB;
  standard_ops[0x06] = ldBN;
  standard_ops[0x07] = rlca;
  standard_ops[0x08] = exAf;
  standard_ops[0x09] = addHlBc;
  standard_ops[0x0a] = ldABci;
  standard_ops[0x0b] = decBc;
  standard_ops[0x0c] = incC;
  standard_ops[0x0d] = decC;
  standard_ops[0x0e] = ldCN;
  standard_ops[0x0f] = rrca;
  standard_ops[0x10] = djnz;
  standard_ops[0x11] = ldDeNN;
  standard_ops[0x12] = ldDeiA;
  standard_ops[0x13] = incDe;
  standard_ops[0x14] = incD;
  standard_ops[0x15] = decD;
  standard_ops[0x16] = ldDN;
  standard_ops[0x17] = rla;
  standard_ops[0x18] = jr;
  standard_ops[0x19] = addHlDe;
  standard_ops[0x1a] = ldADei;
  standard_ops[0x1b] = decDe;
  standard_ops[0x1c] = incE;
  standard_ops[0x1d] = decE;
  standard_ops[0x1e] = ldEN;
  standard_ops[0x1f] = rra;
  standard_ops[0x20] = jrnz;
  standard_ops[0x22] = ldNNiHl;
  standard_ops[0x23] = incHl;
  standard_ops[0x24] = incH;
  standard_ops[0x25] = decH;
  standard_ops[0x26] = ldHN;
  standard_ops[0x27] = daa;
  standard_ops[0x28] = jrz;
  standard_ops[0x29] = addHlHl;
  standard_ops[0x2a] = ldHlNNi;
  standard_ops[0x2b] = decHl;
  standard_ops[0x2c] = incL;
  standard_ops[0x2d] = decL;
  standard_ops[0x2e] = ldLN;
  standard_ops[0x2f] = cpl;
  standard_ops[0x21] = ldHlNN;
  standard_ops[0x37] = scf;
  standard_ops[0x3e] = ld_a_n;
  standard_ops[0x3d] = decA;
  standard_ops[0x30] = jrnc; standard_ops[0x31] = ldSpNN; standard_ops[0x32] = ldNNiA; standard_ops[0x33] = incSp;
  standard_ops[0x34] = incHli; standard_ops[0x35] = decHli; standard_ops[0x36] = ldHliN;
  standard_ops[0x38] = jrc; standard_ops[0x39] = addHlSp; standard_ops[0x3a] = ldANNi; standard_ops[0x3b] = decSp;
  standard_ops[0x3c] = incA; standard_ops[0x3f] = ccf;
  for (opcode = 0x40; opcode <= 0x6f; opcode++) standard_ops[opcode] = ldRegisterToRegister;
  for (opcode = 0x70; opcode <= 0x75; opcode++) standard_ops[opcode] = ldRegisterToRegister;
  standard_ops[0x76] = halt;
  for (opcode = 0x77; opcode <= 0x7f; opcode++) standard_ops[opcode] = ldRegisterToRegister;
  for (opcode = 0x80; opcode <= 0x87; opcode++) standard_ops[opcode] = addAR;
  for (opcode = 0x88; opcode <= 0x8f; opcode++) standard_ops[opcode] = adcAR;
  for (opcode = 0x90; opcode <= 0x97; opcode++) standard_ops[opcode] = subR;
  for (opcode = 0x98; opcode <= 0x9f; opcode++) standard_ops[opcode] = sbcAR;
  for (opcode = 0xa0; opcode <= 0xa7; opcode++) standard_ops[opcode] = andR;
  for (opcode = 0xa8; opcode <= 0xaf; opcode++) standard_ops[opcode] = xorR;
  for (opcode = 0xb0; opcode <= 0xb7; opcode++) standard_ops[opcode] = orR;
  for (opcode = 0xb8; opcode <= 0xbf; opcode++) standard_ops[opcode] = cpR;
  for (opcode = 0xc0; opcode <= 0xf8; opcode += 8) standard_ops[opcode] = retCC;
  standard_ops[0xc9] = ret;
  for (opcode = 0xc2; opcode <= 0xfa; opcode += 8) standard_ops[opcode] = jpCC;
  standard_ops[0xc3] = jp;
  for (opcode = 0xc4; opcode <= 0xfc; opcode += 8) standard_ops[opcode] = callCC;
  standard_ops[0xcd] = call;
  standard_ops[0xc1] = popQQ; standard_ops[0xd1] = popQQ; standard_ops[0xe1] = popQQ; standard_ops[0xf1] = popQQ;
  standard_ops[0xc5] = pushQQ; standard_ops[0xd5] = pushQQ; standard_ops[0xe5] = pushQQ; standard_ops[0xf5] = pushQQ;
  for (opcode = 0xc7; opcode <= 0xff; opcode += 8) standard_ops[opcode] = rst;
  standard_ops[0xc6] = addAN; standard_ops[0xce] = adcAN; standard_ops[0xd6] = subAN; standard_ops[0xde] = sbcAN;
  standard_ops[0xd3] = outNA;
  standard_ops[0xd9] = exx;
  standard_ops[0xdb] = inAN;
  standard_ops[0xe3] = exSpiHl;
  standard_ops[0xe6] = andAN;
  standard_ops[0xe9] = jpHl;
  standard_ops[0xeb] = exDeHl;
  standard_ops[0xee] = xorAN;
  standard_ops[0xf3] = di;
  standard_ops[0xf6] = orAN;
  standard_ops[0xf9] = ldSpHl;
  standard_ops[0xfb] = ei;
  standard_ops[0xfe] = cpAN;
  for (opcode = 0x00; opcode <= 0x3f; opcode++) bit_ops[opcode] = bitRotateShift;
  for (opcode = 0x40; opcode <= 0x7f; opcode++) bit_ops[opcode] = bitTest;
  for (opcode = 0x80; opcode <= 0xbf; opcode++) bit_ops[opcode] = bitReset;
  for (opcode = 0xc0; opcode <= 0xff; opcode++) bit_ops[opcode] = bitSet;
  for (opcode = 0x40; opcode <= 0x7f; opcode += 8) extended_ops[opcode] = extendedInOut;
  for (opcode = 0x41; opcode <= 0x79; opcode += 8) extended_ops[opcode] = extendedInOut;
  for (opcode = 0x42; opcode <= 0x7a; opcode += 8) extended_ops[opcode] = extendedAdcSbcHl;
  for (opcode = 0x43; opcode <= 0x7b; opcode += 8) extended_ops[opcode] = extendedLoad16;
  extended_ops[0x44] = neg; extended_ops[0x4c] = neg; extended_ops[0x54] = neg; extended_ops[0x5c] = neg;
  extended_ops[0x64] = neg; extended_ops[0x6c] = neg; extended_ops[0x74] = neg; extended_ops[0x7c] = neg;
  extended_ops[0x45] = retn; extended_ops[0x4d] = retn; extended_ops[0x55] = retn; extended_ops[0x5d] = retn;
  extended_ops[0x65] = retn; extended_ops[0x6d] = retn; extended_ops[0x75] = retn; extended_ops[0x7d] = retn;
  extended_ops[0x46] = extendedIm; extended_ops[0x4e] = extendedIm; extended_ops[0x66] = extendedIm; extended_ops[0x6e] = extendedIm;
  extended_ops[0x56] = extendedIm; extended_ops[0x76] = extendedIm; extended_ops[0x5e] = extendedIm; extended_ops[0x7e] = extendedIm;
  extended_ops[0x47] = ldIA; extended_ops[0x4f] = ldRA; extended_ops[0x57] = ldAI; extended_ops[0x5f] = ldAR;
  extended_ops[0x67] = rrd; extended_ops[0x6f] = rld;
  extended_ops[0xa0] = ldi; extended_ops[0xa1] = cpi; extended_ops[0xa2] = ini; extended_ops[0xa3] = outi;
  extended_ops[0xa8] = ldd; extended_ops[0xa9] = cpd; extended_ops[0xaa] = ind; extended_ops[0xab] = outd;
  extended_ops[0xb0] = ldir; extended_ops[0xb1] = cpir; extended_ops[0xb2] = inir; extended_ops[0xb3] = otir;
  extended_ops[0xb8] = lddr; extended_ops[0xb9] = cpdr; extended_ops[0xba] = indr; extended_ops[0xbb] = otdr;
  for (opcode = 0; opcode < 256; opcode++) z80n_extended_ops[opcode] = extended_ops[opcode];
  z80n_extended_ops[0x23] = swapnib; z80n_extended_ops[0x24] = mirrorA; z80n_extended_ops[0x27] = testN;
  z80n_extended_ops[0x28] = bsla; z80n_extended_ops[0x29] = bsra; z80n_extended_ops[0x2a] = bsrl; z80n_extended_ops[0x2b] = bsrf; z80n_extended_ops[0x2c] = brlc;
  z80n_extended_ops[0x30] = mulDE; z80n_extended_ops[0x31] = addHLA; z80n_extended_ops[0x32] = addDEA; z80n_extended_ops[0x33] = addBCA;
  z80n_extended_ops[0x34] = addHLNN; z80n_extended_ops[0x35] = addDENN; z80n_extended_ops[0x36] = addBCNN;
  z80n_extended_ops[0x8a] = pushNN; z80n_extended_ops[0x90] = outinb; z80n_extended_ops[0x91] = nextregn; z80n_extended_ops[0x92] = nextrega;
  z80n_extended_ops[0x93] = pixeldn; z80n_extended_ops[0x94] = pixelad; z80n_extended_ops[0x95] = setae; z80n_extended_ops[0x98] = jpc;
  z80n_extended_ops[0xa4] = ldix; z80n_extended_ops[0xa5] = ldws; z80n_extended_ops[0xac] = lddx;
  z80n_extended_ops[0xb4] = ldirx; z80n_extended_ops[0xb7] = ldpirx; z80n_extended_ops[0xbc] = lddrx;
  extended_ops[0x23] = nop; extended_ops[0x24] = nop; extended_ops[0x27] = nop;
  extended_ops[0x28] = nop; extended_ops[0x29] = nop; extended_ops[0x2a] = nop; extended_ops[0x2b] = nop; extended_ops[0x2c] = nop;
  extended_ops[0x30] = nop; extended_ops[0x31] = nop; extended_ops[0x32] = nop; extended_ops[0x33] = nop; extended_ops[0x34] = nop; extended_ops[0x35] = nop; extended_ops[0x36] = nop;
  extended_ops[0x8a] = nop; extended_ops[0x90] = nop; extended_ops[0x91] = nop; extended_ops[0x92] = nop; extended_ops[0x93] = nop; extended_ops[0x94] = nop; extended_ops[0x95] = nop; extended_ops[0x98] = nop;
  extended_ops[0xa4] = nop; extended_ops[0xa5] = nop; extended_ops[0xac] = nop; extended_ops[0xb4] = nop; extended_ops[0xb7] = nop; extended_ops[0xbc] = nop;
  copyIndexedStandardRange(0x00, 0x08);
  copyIndexedStandardRange(0x0a, 0x18);
  copyIndexedStandardRange(0x1a, 0x20);
  copyIndexedStandardRange(0x27, 0x28);
  copyIndexedStandardRange(0x2f, 0x33);
  copyIndexedStandardRange(0x37, 0x38);
  copyIndexedStandardRange(0x3a, 0x3f);
  indexed_ops[0x09] = addXBc; indexed_ops[0x19] = addXDe;
  indexed_ops[0x21] = ldXNN; indexed_ops[0x22] = ldNNiX; indexed_ops[0x23] = incX;
  indexed_ops[0x24] = incXh; indexed_ops[0x25] = decXh; indexed_ops[0x26] = ldXhN;
  indexed_ops[0x29] = addXX; indexed_ops[0x2a] = ldXNNi; indexed_ops[0x2b] = decX;
  indexed_ops[0x2c] = incXl; indexed_ops[0x2d] = decXl; indexed_ops[0x2e] = ldXlN;
  indexed_ops[0x34] = incXi; indexed_ops[0x35] = decXi; indexed_ops[0x36] = ldXiN; indexed_ops[0x39] = addXSp;
  for (opcode = 0x40; opcode <= 0x7f; opcode++) indexed_ops[opcode] = indexedLdRegisterToRegister;
  indexed_ops[0x76] = halt;
  for (opcode = 0x80; opcode <= 0x87; opcode++) indexed_ops[opcode] = indexedAddAR;
  for (opcode = 0x88; opcode <= 0x8f; opcode++) indexed_ops[opcode] = indexedAdcAR;
  for (opcode = 0x90; opcode <= 0x97; opcode++) indexed_ops[opcode] = indexedSubR;
  for (opcode = 0x98; opcode <= 0x9f; opcode++) indexed_ops[opcode] = indexedSbcAR;
  for (opcode = 0xa0; opcode <= 0xa7; opcode++) indexed_ops[opcode] = indexedAndR;
  for (opcode = 0xa8; opcode <= 0xaf; opcode++) indexed_ops[opcode] = indexedXorR;
  for (opcode = 0xb0; opcode <= 0xb7; opcode++) indexed_ops[opcode] = indexedOrR;
  for (opcode = 0xb8; opcode <= 0xbf; opcode++) indexed_ops[opcode] = indexedCpR;
  copyIndexedStandardRange(0xc0, 0xff);
  indexed_ops[0xe1] = popX; indexed_ops[0xe3] = exSpiX; indexed_ops[0xe5] = pushX;
  indexed_ops[0xe9] = jpX; indexed_ops[0xed] = nop; indexed_ops[0xf9] = ldSpX;
  for (opcode = 0x00; opcode <= 0x3f; opcode++) indexed_bit_ops[opcode] = indexedBitRotateShift;
  for (opcode = 0x40; opcode <= 0x7f; opcode++) indexed_bit_ops[opcode] = indexedBitTest;
  for (opcode = 0x80; opcode <= 0xbf; opcode++) indexed_bit_ops[opcode] = indexedBitReset;
  for (opcode = 0xc0; opcode <= 0xff; opcode++) indexed_bit_ops[opcode] = indexedBitSet;
  operation_tables_initialized = 1;
}

static unsigned int execute_operation(Z80Operation operation) {
  if (operation == illegal_operation) return Z80_EXECUTION_NOT_IMPLEMENTED;
  operation();
  return Z80_EXECUTION_COMPLETED;
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
  tactPlusN(4);
  leave_halt();
  if ((state.flags & Z80_STATE_IFF1) != 0) state.flags |= Z80_STATE_IFF2;
  else state.flags &= (uint8_t)~Z80_STATE_IFF2;
  state.flags &= (uint8_t)~Z80_STATE_IFF1;
  apply_ld_air_quirk();
  push_pc();
  refreshMemory();
  state.pc = 0x0066;
  state.wz.word = 0x0066;
}

static void process_int(void) {
  uint16_t vector_address;
  tactPlusN(6);
  leave_halt();
  state.flags &= (uint8_t)~(Z80_STATE_IFF1 | Z80_STATE_IFF2);
  apply_ld_air_quirk();
  push_pc();
  refreshMemory();
  if (state.interrupt_mode == 2) {
    vector_address = (uint16_t)(((uint16_t)state.ir.bytes.hi << 8) | state.interrupt_vector);
    state.wz.bytes.lo = readMemory(vector_address, 0);
    state.wz.bytes.hi = readMemory((uint16_t)(vector_address + 1u), 0);
  } else {
    state.wz.word = 0x0038;
  }
  state.pc = state.wz.word;
}

/* Mirrors Z80Cpu.executeCpuCycle(): signal/HALT/fetch/prefix handling lives
 * here; opcode tables select the operation implementation. */
static unsigned int executeCpuCycle(void) {
  uint8_t opcode;

  initialize_operation_tables();

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
    tactPlusN(3);
    refreshMemory();
    tactPlusN(1);
    return Z80_EXECUTION_COMPLETED;
  }

  if (state.prefix == 0) {
    memory_log_count = 0;
    if (z80_bus_mode == Z80_BUS_SP48) io_log_count = 0;
  }
  opcode = readMemory(state.pc, 0);
  state.pc++;
  state.op_code = opcode;

  if (state.prefix == 0) {
    refreshMemory();
    tactPlusN(1);
    switch (opcode) {
      case 0xcb: state.prefix = 2; return Z80_EXECUTION_PREFIX_PENDING;
      case 0xed: state.prefix = 1; return Z80_EXECUTION_PREFIX_PENDING;
      case 0xdd: state.prefix = 3; return Z80_EXECUTION_PREFIX_PENDING;
      case 0xfd: state.prefix = 4; return Z80_EXECUTION_PREFIX_PENDING;
      default: return execute_operation(standard_ops[opcode]);
    }
  }

  if (state.prefix == 1) {
    state.prefix = 0;
    tactPlusN(1);
    return execute_operation((state.z80n_mode ? z80n_extended_ops : extended_ops)[opcode]);
  }

  if (state.prefix == 2) {
    state.prefix = 0;
    return execute_operation(bit_ops[opcode]);
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
    active_index_prefix = state.prefix;
    state.prefix = 0;
    {
      unsigned int result = execute_operation(indexed_ops[opcode]);
      if (result == Z80_EXECUTION_COMPLETED) tactPlusN(1);
      return result;
    }
  }

  if (state.prefix == 5 || state.prefix == 6) {
    uint8_t bit_opcode;

    active_index_prefix = state.prefix == 5 ? 3 : 4;
    state.wz.word = (uint16_t)(activeIndexRegister()->word + (int8_t)opcode);
    bit_opcode = readMemory(state.pc, 0);
    tactPlusN(2);
    state.pc++;
    state.op_code = bit_opcode;
    state.prefix = 0;
    {
      unsigned int result = execute_operation(indexed_bit_ops[bit_opcode]);
      if (result == Z80_EXECUTION_COMPLETED) tactPlusN(1);
      return result;
    }
  }

  return Z80_EXECUTION_NOT_IMPLEMENTED;
}

unsigned int z80_cpu_execute_instruction(void) {
  return executeCpuCycle();
}
