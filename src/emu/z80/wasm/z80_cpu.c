// CPU execution implementation; compiled separately from z80_abi.c.
#include "z80_abi.h"
#include "z80_state.h"
#include "z80_test_bus.h"

Z80State state;

static void tactPlusN(unsigned int tacts) {
  state.tacts += tacts;
  state.frame_tacts += tacts;
  if (state.frame_tacts >= state.tacts_in_frame) {
    state.frames++;
    state.frame_tacts -= state.tacts_in_frame;
  }
}

static void refreshMemory(void) {
  state.ir.bytes.lo = (uint8_t)(((state.ir.bytes.lo + 1u) & 0x7fu) | (state.ir.bytes.lo & 0x80u));
}

static uint8_t readMemory(uint16_t address, unsigned int operation) {
  uint8_t value = test_memory[address];
  if (memory_log_count < Z80_TEST_LOG_CAPACITY) {
    memory_log[memory_log_count].address = address;
    memory_log[memory_log_count].value = value;
    memory_log[memory_log_count].operation = (uint8_t)operation;
    memory_log_count++;
  }
  tactPlusN(3);
  return value;
}

static void writeMemory(uint16_t address, uint8_t value) {
  test_memory[address] = value;
  if (memory_log_count < Z80_TEST_LOG_CAPACITY) {
    memory_log[memory_log_count].address = address;
    memory_log[memory_log_count].value = value;
    memory_log[memory_log_count].operation = 1;
    memory_log_count++;
  }
  tactPlusN(3);
}

static uint8_t readPort(uint16_t address) {
  uint8_t value = io_input_index < io_input_count ? io_input[io_input_index++] : 0;
  if (io_log_count < Z80_TEST_LOG_CAPACITY) {
    io_log[io_log_count].address = address;
    io_log[io_log_count].value = value;
    io_log[io_log_count].operation = 0;
    io_log_count++;
  }
  tactPlusN(4);
  return value;
}

static void writePort(uint16_t address, uint8_t value) {
  if (io_log_count < Z80_TEST_LOG_CAPACITY) {
    io_log[io_log_count].address = address;
    io_log[io_log_count].value = value;
    io_log[io_log_count].operation = 1;
    io_log_count++;
  }
  tactPlusN(4);
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

static Z80Operation standard_ops[256];
static Z80Operation bit_ops[256];
static Z80Operation extended_ops[256];
static Z80Operation indexed_ops[256];
static Z80Operation indexed_bit_ops[256];
static unsigned int operation_tables_initialized;

static void initialize_operation_tables(void) {
  unsigned int opcode;
  if (operation_tables_initialized) return;
  for (opcode = 0; opcode < 256; opcode++) {
    standard_ops[opcode] = illegal_operation;
    bit_ops[opcode] = illegal_operation;
    extended_ops[opcode] = illegal_operation;
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

  if (state.prefix == 0) memory_log_count = 0;
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
    return execute_operation(extended_ops[opcode]);
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
    state.prefix = 0;
    return execute_operation(indexed_ops[opcode]);
  }

  if (state.prefix == 5 || state.prefix == 6) {
    state.prefix = 0;
    return execute_operation(indexed_bit_ops[opcode]);
  }

  return Z80_EXECUTION_NOT_IMPLEMENTED;
}

unsigned int z80_execute_instruction(void) {
  return executeCpuCycle();
}

unsigned int z80_test_fetch_byte(void) { return readMemory(state.pc++, 0); }
unsigned int z80_test_fetch_word(void) { return fetchCodeWord(); }
void z80_test_push_word(unsigned int value) {
  state.sp--;
  tactPlusN(1);
  writeMemory(state.sp, (uint8_t)(value >> 8));
  state.sp--;
  writeMemory(state.sp, (uint8_t)value);
}
unsigned int z80_test_pop_word(void) {
  uint16_t low = readMemory(state.sp++, 0);
  uint16_t high = readMemory(state.sp++, 0);
  return low | (high << 8);
}
unsigned int z80_test_sign_extend(unsigned int value) { return (unsigned int)(int32_t)(int8_t)value; }
unsigned int z80_test_condition(unsigned int condition) { return conditionIsTrue(condition); }
unsigned int z80_test_parity(unsigned int value) { initializeParityTable(); return parity_table[(uint8_t)value]; }
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
unsigned int z80_test_port_read(unsigned int address) { return readPort((uint16_t)address); }
void z80_test_port_write(unsigned int address, unsigned int value) { writePort((uint16_t)address, (uint8_t)value); }
