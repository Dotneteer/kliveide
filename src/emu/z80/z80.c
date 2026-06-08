#include <stdint.h>

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

#define FLAG_S  0x80
#define FLAG_Z  0x40
#define FLAG_R5 0x20
#define FLAG_H  0x10
#define FLAG_R3 0x08
#define FLAG_PV 0x04
#define FLAG_N  0x02
#define FLAG_C  0x01

#define PREFIX_NONE 0
#define PREFIX_ED   1
#define PREFIX_CB   2
#define PREFIX_DD   3
#define PREFIX_FD   4
#define PREFIX_DDCB 5
#define PREFIX_FDCB 6

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

typedef union RegisterPair {
  uint16_t word;
  struct {
#ifdef __BIG_ENDIAN__
    uint8_t high;
    uint8_t low;
#else
    uint8_t low;
    uint8_t high;
#endif
  } bytes;
} RegisterPair;

typedef struct Z80State {
  RegisterPair af;
  RegisterPair bc;
  RegisterPair de;
  RegisterPair hl;
  RegisterPair afAlt;
  RegisterPair bcAlt;
  RegisterPair deAlt;
  RegisterPair hlAlt;
  RegisterPair ix;
  RegisterPair iy;
  RegisterPair ir;
  RegisterPair wz;
  uint16_t pc;
  uint16_t sp;
  uint32_t tacts;
  uint8_t halted;
  uint8_t prefix;
  uint8_t opCode;
  uint8_t sigInt;
  uint8_t sigNmi;
  uint8_t sigRst;
  uint8_t interruptMode;
  uint8_t iff1;
  uint8_t iff2;
  uint8_t eiBacklog;
  uint8_t retExecuted;
  uint8_t retnExecuted;
  uint8_t afterLdAIR;
  uint8_t interruptVector;
  uint16_t lastPortAddress;
  uint8_t lastPortValue;
  uint8_t lastPortIsWrite;
  uint8_t hasPortEvent;
  uint8_t portReadValue;
  uint8_t z80nMode;
  uint8_t lastTbBlueAddress;
  uint8_t lastTbBlueValue;
  uint8_t hasTbBlueEvent;
} Z80State;

// -----------------------------------------------------------------------------
// CPU state and register aliases
// -----------------------------------------------------------------------------

static Z80State cpu;
static uint8_t memory[0x10000];

#define AF cpu.af.word
#define BC cpu.bc.word
#define DE cpu.de.word
#define HL cpu.hl.word
#define AF_ALT cpu.afAlt.word
#define BC_ALT cpu.bcAlt.word
#define DE_ALT cpu.deAlt.word
#define HL_ALT cpu.hlAlt.word
#define IX cpu.ix.word
#define IY cpu.iy.word
#define IR cpu.ir.word
#define WZ cpu.wz.word

#define A cpu.af.bytes.high
#define F cpu.af.bytes.low
#define B cpu.bc.bytes.high
#define C cpu.bc.bytes.low
#define D cpu.de.bytes.high
#define E cpu.de.bytes.low
#define H cpu.hl.bytes.high
#define L cpu.hl.bytes.low

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

static inline uint8_t hi(uint16_t value) { return (uint8_t)(value >> 8); }
static inline uint8_t lo(uint16_t value) { return (uint8_t)value; }
static inline uint16_t pair(uint8_t high, uint8_t low) { return ((uint16_t)high << 8) | low; }

static inline RegisterPair *activeIndexPair(void) {
  return cpu.prefix == PREFIX_FD || cpu.prefix == PREFIX_FDCB ? &cpu.iy : &cpu.ix;
}

static inline void tactPlusN(uint32_t value) {
  cpu.tacts += value;
}

static inline void tactPlus1WithAddress(uint16_t address) {
  (void)address;
  tactPlusN(1);
}

static inline void tactPlus2WithAddress(uint16_t address) {
  (void)address;
  tactPlusN(1);
  tactPlusN(1);
}

static inline void tactPlus4WithAddress(uint16_t address) {
  (void)address;
  tactPlusN(1);
  tactPlusN(1);
  tactPlusN(1);
  tactPlusN(1);
}

static inline void tactPlus5WithAddress(uint16_t address) {
  (void)address;
  tactPlusN(1);
  tactPlusN(1);
  tactPlusN(1);
  tactPlusN(1);
  tactPlusN(1);
}

static inline void tactPlus7WithAddress(uint16_t address) {
  (void)address;
  tactPlusN(1);
  tactPlusN(1);
  tactPlusN(1);
  tactPlusN(1);
  tactPlusN(1);
  tactPlusN(1);
  tactPlusN(1);
}

static inline void delayMemoryRead(uint16_t address) {
  (void)address;
  tactPlusN(3);
}

static inline void delayMemoryWrite(uint16_t address) {
  (void)address;
  tactPlusN(3);
}

static inline void delayPortRead(uint16_t address) {
  (void)address;
  tactPlusN(4);
}

static inline void delayPortWrite(uint16_t address) {
  (void)address;
  tactPlusN(4);
}

static inline void refreshMemory(void) {
  cpu.ir.bytes.low = ((cpu.ir.bytes.low + 1) & 0x7f) | (cpu.ir.bytes.low & 0x80);
}

static inline void removeFromHaltedState(void) {
  if (cpu.halted) {
    cpu.pc = (uint16_t)(cpu.pc + 1);
    cpu.halted = 0;
  }
}

static inline uint8_t readMemory(uint16_t address) {
  delayMemoryRead(address);
  return memory[address];
}

static inline void writeMemory(uint16_t address, uint8_t value) {
  delayMemoryWrite(address);
  memory[address] = value;
}

static inline uint8_t readPort(uint16_t address) {
  delayPortRead(address);
  cpu.lastPortAddress = address;
  cpu.lastPortValue = cpu.portReadValue;
  cpu.lastPortIsWrite = 0;
  cpu.hasPortEvent = 1;
  return cpu.portReadValue;
}

static inline void writePort(uint16_t address, uint8_t value) {
  delayPortWrite(address);
  cpu.lastPortAddress = address;
  cpu.lastPortValue = value;
  cpu.lastPortIsWrite = 1;
  cpu.hasPortEvent = 1;
}

static inline void tbBlueOut(uint8_t address, uint8_t value) {
  cpu.lastTbBlueAddress = address;
  cpu.lastTbBlueValue = value;
  cpu.hasTbBlueEvent = 1;
}

static inline uint8_t fetchCodeByte(void) {
  uint8_t value = readMemory(cpu.pc);
  cpu.pc = (uint16_t)(cpu.pc + 1);
  return value;
}

static inline uint16_t readU16Le(void) {
  uint8_t low = fetchCodeByte();
  uint8_t high = fetchCodeByte();
  return pair(high, low);
}

static inline int16_t sbyte(uint8_t value) {
  return (int8_t)value;
}

static inline uint8_t parityFlag(uint8_t value) {
  value ^= value >> 4;
  value &= 0x0f;
  return ((0x6996 >> value) & 1) ? 0 : FLAG_PV;
}

static inline uint8_t sz53PvFlags(uint8_t value) {
  uint8_t flags = value & (FLAG_S | FLAG_R5 | FLAG_R3);
  if (value == 0) flags |= FLAG_Z;
  flags |= parityFlag(value);
  return flags;
}

static inline uint8_t sz53Flags(uint8_t value) {
  uint8_t flags = value & (FLAG_S | FLAG_R5 | FLAG_R3);
  if (value == 0) flags |= FLAG_Z;
  return flags;
}

static inline uint8_t inc8(uint8_t value) {
  uint8_t result = (uint8_t)(value + 1);
  uint8_t flags = F & FLAG_C;

  if (result & 0x80) flags |= FLAG_S;
  if (result == 0) flags |= FLAG_Z;
  if ((value & 0x0f) == 0x0f) flags |= FLAG_H;
  if (value == 0x7f) flags |= FLAG_PV;
  flags |= result & (FLAG_R5 | FLAG_R3);
  F = flags;
  return result;
}

static inline uint8_t dec8(uint8_t value) {
  uint8_t result = (uint8_t)(value - 1);
  uint8_t flags = (F & FLAG_C) | FLAG_N;

  if (result & 0x80) flags |= FLAG_S;
  if (result == 0) flags |= FLAG_Z;
  if ((value & 0x0f) == 0x00) flags |= FLAG_H;
  if (value == 0x80) flags |= FLAG_PV;
  flags |= result & (FLAG_R5 | FLAG_R3);
  F = flags;
  return result;
}

static inline void add8ToA(uint8_t value) {
  uint8_t oldA = A;
  uint16_t result = (uint16_t)oldA + value;
  uint8_t newA = (uint8_t)result;
  uint8_t flags = newA & (FLAG_S | FLAG_R5 | FLAG_R3);

  if (newA == 0) flags |= FLAG_Z;
  if (((oldA & 0x0f) + (value & 0x0f)) > 0x0f) flags |= FLAG_H;
  if (((~(oldA ^ value) & (oldA ^ newA)) & 0x80) != 0) flags |= FLAG_PV;
  if (result > 0xff) flags |= FLAG_C;
  A = newA;
  F = flags;
}

static inline void adc8ToA(uint8_t value) {
  uint8_t oldA = A;
  uint8_t carry = F & FLAG_C;
  uint16_t result = (uint16_t)oldA + value + carry;
  uint8_t newA = (uint8_t)result;
  uint8_t flags = newA & (FLAG_S | FLAG_R5 | FLAG_R3);

  if (newA == 0) flags |= FLAG_Z;
  if (((oldA & 0x0f) + (value & 0x0f) + carry) > 0x0f) flags |= FLAG_H;
  if (((~(oldA ^ value) & (oldA ^ newA)) & 0x80) != 0) flags |= FLAG_PV;
  if (result > 0xff) flags |= FLAG_C;
  A = newA;
  F = flags;
}

static inline void sub8FromA(uint8_t value) {
  uint8_t oldA = A;
  uint16_t result = (uint16_t)oldA - value;
  uint8_t newA = (uint8_t)result;
  uint8_t flags = (newA & (FLAG_S | FLAG_R5 | FLAG_R3)) | FLAG_N;

  if (newA == 0) flags |= FLAG_Z;
  if (((oldA ^ value ^ newA) & 0x10) != 0) flags |= FLAG_H;
  if ((((oldA ^ value) & (oldA ^ newA)) & 0x80) != 0) flags |= FLAG_PV;
  if (result > 0xff) flags |= FLAG_C;
  A = newA;
  F = flags;
}

static inline void sbc8FromA(uint8_t value) {
  uint8_t oldA = A;
  uint8_t carry = F & FLAG_C;
  uint16_t result = (uint16_t)oldA - value - carry;
  uint8_t newA = (uint8_t)result;
  uint8_t flags = (newA & (FLAG_S | FLAG_R5 | FLAG_R3)) | FLAG_N;

  if (newA == 0) flags |= FLAG_Z;
  if (((oldA ^ value ^ newA) & 0x10) != 0) flags |= FLAG_H;
  if ((((oldA ^ value) & (oldA ^ newA)) & 0x80) != 0) flags |= FLAG_PV;
  if (result > 0xff) flags |= FLAG_C;
  A = newA;
  F = flags;
}

static inline void and8WithA(uint8_t value) {
  A &= value;
  F = FLAG_H | sz53PvFlags(A);
}

static inline void xor8WithA(uint8_t value) {
  A ^= value;
  F = sz53PvFlags(A);
}

static inline void or8WithA(uint8_t value) {
  A |= value;
  F = sz53PvFlags(A);
}

static inline void cp8WithA(uint8_t value) {
  uint8_t oldA = A;
  uint16_t result = (uint16_t)oldA - value;
  uint8_t newValue = (uint8_t)result;
  uint8_t flags = (value & (FLAG_R5 | FLAG_R3)) | FLAG_N | (newValue & FLAG_S);

  if (newValue == 0) flags |= FLAG_Z;
  if (((oldA ^ value ^ newValue) & 0x10) != 0) flags |= FLAG_H;
  if ((((oldA ^ value) & (oldA ^ newValue)) & 0x80) != 0) flags |= FLAG_PV;
  if (result > 0xff) flags |= FLAG_C;
  F = flags;
}

static inline uint8_t rlc8(uint8_t value) {
  uint8_t result = (uint8_t)((value << 1) | (value >> 7));
  F = (result & FLAG_C) | sz53PvFlags(result);
  return result;
}

static inline uint8_t rrc8(uint8_t value) {
  uint8_t result = (uint8_t)((value >> 1) | (value << 7));
  F = (value & FLAG_C) | sz53PvFlags(result);
  return result;
}

static inline uint8_t rl8(uint8_t value) {
  uint8_t result = (uint8_t)((value << 1) | (F & FLAG_C));
  F = (value >> 7) | sz53PvFlags(result);
  return result;
}

static inline uint8_t rr8(uint8_t value) {
  uint8_t result = (uint8_t)((value >> 1) | ((F & FLAG_C) ? 0x80 : 0));
  F = (value & FLAG_C) | sz53PvFlags(result);
  return result;
}

static inline uint8_t sla8(uint8_t value) {
  uint8_t result = (uint8_t)(value << 1);
  F = (value >> 7) | sz53PvFlags(result);
  return result;
}

static inline uint8_t sra8(uint8_t value) {
  uint8_t result = (uint8_t)((value & 0x80) | (value >> 1));
  F = (value & FLAG_C) | sz53PvFlags(result);
  return result;
}

static inline uint8_t sll8(uint8_t value) {
  uint8_t result = (uint8_t)((value << 1) | 0x01);
  F = (value >> 7) | sz53PvFlags(result);
  return result;
}

static inline uint8_t srl8(uint8_t value) {
  uint8_t result = (uint8_t)(value >> 1);
  F = (value & FLAG_C) | sz53PvFlags(result);
  return result;
}

static inline void bit8(uint8_t bit, uint8_t value, uint8_t flagsSource) {
  uint8_t bitValue = value & (uint8_t)(1 << bit);
  F = (F & FLAG_C) | FLAG_H | (flagsSource & (FLAG_R5 | FLAG_R3)) |
      (bitValue ? 0 : (FLAG_PV | FLAG_Z)) | (bitValue & FLAG_S);
}

static inline void addHl(uint16_t value) {
  uint16_t oldHl = HL;
  uint32_t result = (uint32_t)HL + value;
  uint8_t flags = F & (FLAG_S | FLAG_Z | FLAG_PV);

  if (((HL & 0x0fff) + (value & 0x0fff)) > 0x0fff) flags |= FLAG_H;
  if (result > 0xffff) flags |= FLAG_C;
  WZ = (uint16_t)(oldHl + 1);
  HL = (uint16_t)result;
  flags |= cpu.hl.bytes.high & (FLAG_R5 | FLAG_R3);
  F = flags;
}

static inline uint16_t add16(uint16_t left, uint16_t right) {
  uint32_t result = (uint32_t)left + right;
  uint8_t flags = F & (FLAG_S | FLAG_Z | FLAG_PV);

  if (((left & 0x0fff) + (right & 0x0fff)) > 0x0fff) flags |= FLAG_H;
  if (result > 0xffff) flags |= FLAG_C;
  WZ = (uint16_t)(left + 1);
  flags |= hi((uint16_t)result) & (FLAG_R5 | FLAG_R3);
  F = flags;
  return (uint16_t)result;
}

static inline void adc16ToHl(uint16_t value) {
  uint16_t oldHl = HL;
  uint8_t carry = F & FLAG_C;
  uint32_t result = (uint32_t)oldHl + value + carry;
  uint16_t newHl = (uint16_t)result;
  uint8_t flags = hi(newHl) & (FLAG_S | FLAG_R5 | FLAG_R3);

  if (newHl == 0) flags |= FLAG_Z;
  if (((oldHl & 0x0fff) + (value & 0x0fff) + carry) > 0x0fff) flags |= FLAG_H;
  if (((~(oldHl ^ value) & (oldHl ^ newHl)) & 0x8000) != 0) flags |= FLAG_PV;
  if (result > 0xffff) flags |= FLAG_C;
  WZ = (uint16_t)(oldHl + 1);
  HL = newHl;
  F = flags;
}

static inline void sbc16FromHl(uint16_t value) {
  uint16_t oldHl = HL;
  uint8_t carry = F & FLAG_C;
  uint32_t result = (uint32_t)oldHl - value - carry;
  uint16_t newHl = (uint16_t)result;
  uint8_t flags = (hi(newHl) & (FLAG_S | FLAG_R5 | FLAG_R3)) | FLAG_N;

  if (newHl == 0) flags |= FLAG_Z;
  if (((oldHl ^ value ^ newHl) & 0x1000) != 0) flags |= FLAG_H;
  if ((((oldHl ^ value) & (oldHl ^ newHl)) & 0x8000) != 0) flags |= FLAG_PV;
  if (result > 0xffff) flags |= FLAG_C;
  WZ = (uint16_t)(oldHl + 1);
  HL = newHl;
  F = flags;
}

static inline void relativeJump(uint8_t offset) {
  tactPlus5WithAddress(cpu.pc);
  cpu.pc = (uint16_t)(cpu.pc + sbyte(offset));
  WZ = cpu.pc;
}

static inline void store16(uint8_t low, uint8_t high) {
  uint16_t address = readU16Le();
  writeMemory(address, low);
  WZ = (uint16_t)(address + 1);
  writeMemory(WZ, high);
}

static inline void popTo(RegisterPair *pairValue) {
  pairValue->bytes.low = readMemory(cpu.sp);
  cpu.sp = (uint16_t)(cpu.sp + 1);
  pairValue->bytes.high = readMemory(cpu.sp);
  cpu.sp = (uint16_t)(cpu.sp + 1);
}

static inline void pushPair(RegisterPair pairValue) {
  tactPlus1WithAddress(IR);
  cpu.sp = (uint16_t)(cpu.sp - 1);
  writeMemory(cpu.sp, pairValue.bytes.high);
  cpu.sp = (uint16_t)(cpu.sp - 1);
  writeMemory(cpu.sp, pairValue.bytes.low);
}

static inline void retCore(void) {
  cpu.wz.bytes.low = readMemory(cpu.sp);
  cpu.sp = (uint16_t)(cpu.sp + 1);
  cpu.wz.bytes.high = readMemory(cpu.sp);
  cpu.sp = (uint16_t)(cpu.sp + 1);
  cpu.pc = WZ;
  cpu.retExecuted = 1;
}

static inline void callCore(void) {
  tactPlus1WithAddress(cpu.pc);
  cpu.sp = (uint16_t)(cpu.sp - 1);
  writeMemory(cpu.sp, hi(cpu.pc));
  cpu.sp = (uint16_t)(cpu.sp - 1);
  writeMemory(cpu.sp, lo(cpu.pc));
  cpu.pc = WZ;
}

static inline void rstCore(uint16_t address) {
  tactPlus1WithAddress(IR);
  cpu.sp = (uint16_t)(cpu.sp - 1);
  writeMemory(cpu.sp, hi(cpu.pc));
  cpu.sp = (uint16_t)(cpu.sp - 1);
  writeMemory(cpu.sp, lo(cpu.pc));
  cpu.pc = address;
  WZ = address;
}

static inline uint16_t readIndexedAddress(void) {
  uint8_t displacement = readMemory(cpu.pc);
  tactPlus5WithAddress(cpu.pc);
  cpu.pc = (uint16_t)(cpu.pc + 1);
  WZ = (uint16_t)(activeIndexPair()->word + sbyte(displacement));
  return WZ;
}

static inline void pushPcForInterrupt(void) {
  cpu.sp = (uint16_t)(cpu.sp - 1);
  tactPlusN(1);
  writeMemory(cpu.sp, hi(cpu.pc));
  cpu.sp = (uint16_t)(cpu.sp - 1);
  writeMemory(cpu.sp, lo(cpu.pc));
}

static inline void applyAfterLdAIRInterruptQuirk(void) {
  if (cpu.afterLdAIR) {
    F &= (uint8_t) ~FLAG_PV;
    cpu.afterLdAIR = 0;
  }
}

static inline void processNmi(void) {
  tactPlusN(4);
  removeFromHaltedState();
  cpu.iff2 = cpu.iff1;
  cpu.iff1 = 0;
  applyAfterLdAIRInterruptQuirk();
  pushPcForInterrupt();
  refreshMemory();
  cpu.pc = 0x0066;
  WZ = 0x0066;
}

static inline void processInt(void) {
  tactPlusN(6);
  removeFromHaltedState();
  uint8_t intVector = cpu.interruptVector;
  cpu.iff1 = 0;
  cpu.iff2 = 0;
  applyAfterLdAIRInterruptQuirk();
  pushPcForInterrupt();
  refreshMemory();

  if (cpu.interruptMode == 2) {
    uint16_t address = pair(cpu.ir.bytes.high, intVector);
    cpu.wz.bytes.low = readMemory(address);
    cpu.wz.bytes.high = readMemory((uint16_t)(address + 1));
  } else {
    WZ = 0x0038;
  }
  cpu.pc = WZ;
}

// -----------------------------------------------------------------------------
// Exported reset and memory access
// -----------------------------------------------------------------------------

void z80Reset(void) {
  AF = 0xffff;
  BC = 0x0000;
  DE = 0x0000;
  HL = 0x0000;
  AF_ALT = 0xffff;
  BC_ALT = 0x0000;
  DE_ALT = 0x0000;
  HL_ALT = 0x0000;
  IX = 0x0000;
  IY = 0x0000;
  IR = 0x0000;
  WZ = 0x0000;
  cpu.pc = 0x0000;
  cpu.sp = 0xffff;
  cpu.tacts = 0;
  cpu.halted = 0;
  cpu.prefix = PREFIX_NONE;
  cpu.opCode = 0;
  cpu.sigInt = 0;
  cpu.sigNmi = 0;
  cpu.sigRst = 0;
  cpu.interruptMode = 0;
  cpu.iff1 = 0;
  cpu.iff2 = 0;
  cpu.eiBacklog = 0;
  cpu.retExecuted = 0;
  cpu.retnExecuted = 0;
  cpu.afterLdAIR = 0;
  cpu.interruptVector = 0xff;
  cpu.lastPortAddress = 0;
  cpu.lastPortValue = 0;
  cpu.lastPortIsWrite = 0;
  cpu.hasPortEvent = 0;
  cpu.portReadValue = 0;
  cpu.z80nMode = 0;
  cpu.lastTbBlueAddress = 0;
  cpu.lastTbBlueValue = 0;
  cpu.hasTbBlueEvent = 0;
}

uint8_t *z80MemoryPtr(void) {
  return memory;
}

typedef void (*Z80Operation)(void);

// -----------------------------------------------------------------------------
// Standard instruction implementations
// -----------------------------------------------------------------------------

static void op00Nop(void) {
}

static void op01LdBcNN(void) {
  BC = readU16Le();
}

static void op02LdBcA(void) {
  writeMemory(BC, A);
  WZ = pair(A, lo((uint16_t)(BC + 1)));
}

static void op03IncBc(void) {
  BC = (uint16_t)(BC + 1);
  tactPlus2WithAddress(IR);
}

static void op04IncB(void) {
  B = inc8(B);
}

static void op05DecB(void) {
  B = dec8(B);
}

static void op06LdBN(void) {
  B = fetchCodeByte();
}

static void op07Rlca(void) {
  uint8_t a = A;
  uint8_t carry = (a & 0x80) ? FLAG_C : 0;
  A = (uint8_t)((a << 1) | (a >> 7));
  F = (F & (FLAG_S | FLAG_Z | FLAG_PV)) | (A & (FLAG_R5 | FLAG_R3)) | carry;
}

static void op08ExAfAfAlt(void) {
  RegisterPair oldAf = cpu.af;
  cpu.af = cpu.afAlt;
  cpu.afAlt = oldAf;
}

static void op09AddHlBc(void) {
  tactPlus7WithAddress(IR);
  addHl(BC);
}

static void op0aLdABc(void) {
  WZ = (uint16_t)(BC + 1);
  A = readMemory(BC);
}

static void op0bDecBc(void) {
  BC = (uint16_t)(BC - 1);
  tactPlus2WithAddress(IR);
}

static void op0cIncC(void) {
  C = inc8(C);
}

static void op0dDecC(void) {
  C = dec8(C);
}

static void op0eLdCN(void) {
  C = fetchCodeByte();
}

static void op0fRrca(void) {
  uint8_t a = A;
  uint8_t carry = (a & 0x01) ? FLAG_C : 0;
  A = (uint8_t)((a >> 1) | (a << 7));
  F = (F & (FLAG_S | FLAG_Z | FLAG_PV)) | (A & (FLAG_R5 | FLAG_R3)) | carry;
}

static void op10Djnz(void) {
  tactPlus1WithAddress(IR);
  uint8_t offset = fetchCodeByte();
  B = (uint8_t)(B - 1);
  if (B != 0) {
    relativeJump(offset);
  }
}

static void op11LdDeNN(void) {
  DE = readU16Le();
}

static void op12LdDeA(void) {
  writeMemory(DE, A);
  cpu.wz.bytes.high = A;
}

static void op13IncDe(void) {
  DE = (uint16_t)(DE + 1);
  tactPlus2WithAddress(IR);
}

static void op14IncD(void) {
  D = inc8(D);
}

static void op15DecD(void) {
  D = dec8(D);
}

static void op16LdDN(void) {
  D = fetchCodeByte();
}

static void op17Rla(void) {
  uint8_t a = A;
  uint8_t carry = (a & 0x80) ? FLAG_C : 0;
  A = (uint8_t)((a << 1) | (F & FLAG_C));
  F = (F & (FLAG_S | FLAG_Z | FLAG_PV)) | (A & (FLAG_R5 | FLAG_R3)) | carry;
}

static void op18Jr(void) {
  relativeJump(fetchCodeByte());
}

static void op19AddHlDe(void) {
  tactPlus7WithAddress(IR);
  addHl(DE);
}

static void op1aLdADe(void) {
  WZ = (uint16_t)(DE + 1);
  A = readMemory(DE);
}

static void op1bDecDe(void) {
  DE = (uint16_t)(DE - 1);
  tactPlus2WithAddress(IR);
}

static void op1cIncE(void) {
  E = inc8(E);
}

static void op1dDecE(void) {
  E = dec8(E);
}

static void op1eLdEN(void) {
  E = fetchCodeByte();
}

static void op1fRra(void) {
  uint8_t a = A;
  uint8_t carry = (a & 0x01) ? FLAG_C : 0;
  A = (uint8_t)((a >> 1) | ((F & FLAG_C) ? 0x80 : 0));
  F = (F & (FLAG_S | FLAG_Z | FLAG_PV)) | (A & (FLAG_R5 | FLAG_R3)) | carry;
}

static void op20JrNz(void) {
  uint8_t offset = fetchCodeByte();
  if ((F & FLAG_Z) == 0) {
    relativeJump(offset);
  }
}

static void op21LdHlNN(void) {
  HL = readU16Le();
}

static void op22LdAddrHl(void) {
  store16(L, H);
}

static void op23IncHl(void) {
  HL = (uint16_t)(HL + 1);
  tactPlus2WithAddress(IR);
}

static void op24IncH(void) {
  H = inc8(H);
}

static void op25DecH(void) {
  H = dec8(H);
}

static void op26LdHN(void) {
  H = fetchCodeByte();
}

static void op27Daa(void) {
  uint8_t add = 0;
  uint8_t carry = F & FLAG_C;
  if ((F & FLAG_H) != 0 || (A & 0x0f) > 9) {
    add = 6;
  }
  if (carry != 0 || A > 0x99) {
    add |= 0x60;
  }
  if (A > 0x99) {
    carry = FLAG_C;
  }
  if ((F & FLAG_N) != 0) {
    sub8FromA(add);
  } else {
    add8ToA(add);
  }
  F = (F & (uint8_t) ~(FLAG_C | FLAG_PV)) | carry | parityFlag(A);
}

static void op28JrZ(void) {
  uint8_t offset = fetchCodeByte();
  if ((F & FLAG_Z) != 0) {
    relativeJump(offset);
  }
}

static void op29AddHlHl(void) {
  tactPlus7WithAddress(IR);
  addHl(HL);
}

static void op2aLdHlAddr(void) {
  uint16_t address = readU16Le();
  WZ = (uint16_t)(address + 1);
  uint8_t low = readMemory(address);
  uint8_t high = readMemory(WZ);
  HL = pair(high, low);
}

static void op2bDecHl(void) {
  HL = (uint16_t)(HL - 1);
  tactPlus2WithAddress(IR);
}

static void op2cIncL(void) {
  L = inc8(L);
}

static void op2dDecL(void) {
  L = dec8(L);
}

static void op2eLdLN(void) {
  L = fetchCodeByte();
}

static void op2fCpl(void) {
  A ^= 0xff;
  F = (F & (FLAG_C | FLAG_PV | FLAG_Z | FLAG_S)) | (A & (FLAG_R5 | FLAG_R3)) | FLAG_N | FLAG_H;
}

static void op30JrNc(void) {
  uint8_t offset = fetchCodeByte();
  if ((F & FLAG_C) == 0) {
    relativeJump(offset);
  }
}

static void op31LdSpNN(void) {
  cpu.sp = readU16Le();
}

static void op32LdAddrA(void) {
  uint16_t address = readU16Le();
  cpu.wz.bytes.low = (uint8_t)(address + 1);
  cpu.wz.bytes.high = A;
  writeMemory(address, A);
}

static void op33IncSp(void) {
  cpu.sp = (uint16_t)(cpu.sp + 1);
  tactPlus2WithAddress(IR);
}

static void op34IncHlPtr(void) {
  uint8_t value = readMemory(HL);
  tactPlus1WithAddress(HL);
  value = inc8(value);
  writeMemory(HL, value);
}

static void op35DecHlPtr(void) {
  uint8_t value = readMemory(HL);
  tactPlus1WithAddress(HL);
  value = dec8(value);
  writeMemory(HL, value);
}

static void op36LdHlPtrN(void) {
  writeMemory(HL, fetchCodeByte());
}

static void op37Scf(void) {
  F = (F & (FLAG_S | FLAG_Z | FLAG_PV)) | FLAG_C;
  F = (F & (uint8_t) ~(FLAG_R5 | FLAG_R3)) | (A & (FLAG_R5 | FLAG_R3));
}

static void op38JrC(void) {
  uint8_t offset = fetchCodeByte();
  if ((F & FLAG_C) != 0) {
    relativeJump(offset);
  }
}

static void op39AddHlSp(void) {
  tactPlus7WithAddress(IR);
  addHl(cpu.sp);
}

static void op3aLdAAddr(void) {
  WZ = readU16Le();
  A = readMemory(WZ);
  WZ = (uint16_t)(WZ + 1);
}

static void op3bDecSp(void) {
  cpu.sp = (uint16_t)(cpu.sp - 1);
  tactPlus2WithAddress(IR);
}

static void op3cIncA(void) {
  A = inc8(A);
}

static void op3dDecA(void) {
  A = dec8(A);
}

static void op3eLdAN(void) {
  A = fetchCodeByte();
}

static void op3fCcf(void) {
  F = (F & (FLAG_S | FLAG_Z | FLAG_PV)) | ((F & FLAG_C) ? FLAG_H : FLAG_C);
  F = (F & (uint8_t) ~(FLAG_R5 | FLAG_R3)) | (A & (FLAG_R5 | FLAG_R3));
}

static void op41LdBC(void) { B = C; }
static void op42LdBD(void) { B = D; }
static void op43LdBE(void) { B = E; }
static void op44LdBH(void) { B = H; }
static void op45LdBL(void) { B = L; }
static void op46LdBMemHl(void) { B = readMemory(HL); }
static void op47LdBA(void) { B = A; }

static void op48LdCB(void) { C = B; }
static void op4aLdCD(void) { C = D; }
static void op4bLdCE(void) { C = E; }
static void op4cLdCH(void) { C = H; }
static void op4dLdCL(void) { C = L; }
static void op4eLdCMemHl(void) { C = readMemory(HL); }
static void op4fLdCA(void) { C = A; }

static void op50LdDB(void) { D = B; }
static void op51LdDC(void) { D = C; }
static void op53LdDE(void) { D = E; }
static void op54LdDH(void) { D = H; }
static void op55LdDL(void) { D = L; }
static void op56LdDMemHl(void) { D = readMemory(HL); }
static void op57LdDA(void) { D = A; }

static void op58LdEB(void) { E = B; }
static void op59LdEC(void) { E = C; }
static void op5aLdED(void) { E = D; }
static void op5cLdEH(void) { E = H; }
static void op5dLdEL(void) { E = L; }
static void op5eLdEMemHl(void) { E = readMemory(HL); }
static void op5fLdEA(void) { E = A; }

static void op60LdHB(void) { H = B; }
static void op61LdHC(void) { H = C; }
static void op62LdHD(void) { H = D; }
static void op63LdHE(void) { H = E; }
static void op65LdHL(void) { H = L; }
static void op66LdHMemHl(void) { H = readMemory(HL); }
static void op67LdHA(void) { H = A; }

static void op68LdLB(void) { L = B; }
static void op69LdLC(void) { L = C; }
static void op6aLdLD(void) { L = D; }
static void op6bLdLE(void) { L = E; }
static void op6cLdLH(void) { L = H; }
static void op6eLdLMemHl(void) { L = readMemory(HL); }
static void op6fLdLA(void) { L = A; }

static void op70LdMemHlB(void) { writeMemory(HL, B); }
static void op71LdMemHlC(void) { writeMemory(HL, C); }
static void op72LdMemHlD(void) { writeMemory(HL, D); }
static void op73LdMemHlE(void) { writeMemory(HL, E); }
static void op74LdMemHlH(void) { writeMemory(HL, H); }
static void op75LdMemHlL(void) { writeMemory(HL, L); }
static void op77LdMemHlA(void) { writeMemory(HL, A); }

static void op78LdAB(void) { A = B; }
static void op79LdAC(void) { A = C; }
static void op7aLdAD(void) { A = D; }
static void op7bLdAE(void) { A = E; }
static void op7cLdAH(void) { A = H; }
static void op7dLdAL(void) { A = L; }
static void op7eLdAMemHl(void) { A = readMemory(HL); }

static void op80AddAB(void) { add8ToA(B); }
static void op81AddAC(void) { add8ToA(C); }
static void op82AddAD(void) { add8ToA(D); }
static void op83AddAE(void) { add8ToA(E); }
static void op84AddAH(void) { add8ToA(H); }
static void op85AddAL(void) { add8ToA(L); }
static void op86AddAMemHl(void) { add8ToA(readMemory(HL)); }
static void op87AddAA(void) { add8ToA(A); }

static void op88AdcAB(void) { adc8ToA(B); }
static void op89AdcAC(void) { adc8ToA(C); }
static void op8aAdcAD(void) { adc8ToA(D); }
static void op8bAdcAE(void) { adc8ToA(E); }
static void op8cAdcAH(void) { adc8ToA(H); }
static void op8dAdcAL(void) { adc8ToA(L); }
static void op8eAdcAMemHl(void) { adc8ToA(readMemory(HL)); }
static void op8fAdcAA(void) { adc8ToA(A); }

static void op90SubAB(void) { sub8FromA(B); }
static void op91SubAC(void) { sub8FromA(C); }
static void op92SubAD(void) { sub8FromA(D); }
static void op93SubAE(void) { sub8FromA(E); }
static void op94SubAH(void) { sub8FromA(H); }
static void op95SubAL(void) { sub8FromA(L); }
static void op96SubAMemHl(void) { sub8FromA(readMemory(HL)); }
static void op97SubAA(void) { sub8FromA(A); }

static void op98SbcAB(void) { sbc8FromA(B); }
static void op99SbcAC(void) { sbc8FromA(C); }
static void op9aSbcAD(void) { sbc8FromA(D); }
static void op9bSbcAE(void) { sbc8FromA(E); }
static void op9cSbcAH(void) { sbc8FromA(H); }
static void op9dSbcAL(void) { sbc8FromA(L); }
static void op9eSbcAMemHl(void) { sbc8FromA(readMemory(HL)); }
static void op9fSbcAA(void) { sbc8FromA(A); }

static void opA0AndAB(void) { and8WithA(B); }
static void opA1AndAC(void) { and8WithA(C); }
static void opA2AndAD(void) { and8WithA(D); }
static void opA3AndAE(void) { and8WithA(E); }
static void opA4AndAH(void) { and8WithA(H); }
static void opA5AndAL(void) { and8WithA(L); }
static void opA6AndAMemHl(void) { and8WithA(readMemory(HL)); }
static void opA7AndAA(void) { and8WithA(A); }

static void opA8XorAB(void) { xor8WithA(B); }
static void opA9XorAC(void) { xor8WithA(C); }
static void opAaXorAD(void) { xor8WithA(D); }
static void opAbXorAE(void) { xor8WithA(E); }
static void opAcXorAH(void) { xor8WithA(H); }
static void opAdXorAL(void) { xor8WithA(L); }
static void opAeXorAMemHl(void) { xor8WithA(readMemory(HL)); }
static void opAfXorAA(void) { xor8WithA(A); }

static void opB0OrAB(void) { or8WithA(B); }
static void opB1OrAC(void) { or8WithA(C); }
static void opB2OrAD(void) { or8WithA(D); }
static void opB3OrAE(void) { or8WithA(E); }
static void opB4OrAH(void) { or8WithA(H); }
static void opB5OrAL(void) { or8WithA(L); }
static void opB6OrAMemHl(void) { or8WithA(readMemory(HL)); }
static void opB7OrAA(void) { or8WithA(A); }

static void opB8CpB(void) { cp8WithA(B); }
static void opB9CpC(void) { cp8WithA(C); }
static void opBaCpD(void) { cp8WithA(D); }
static void opBbCpE(void) { cp8WithA(E); }
static void opBcCpH(void) { cp8WithA(H); }
static void opBdCpL(void) { cp8WithA(L); }
static void opBeCpMemHl(void) { cp8WithA(readMemory(HL)); }
static void opBfCpA(void) { cp8WithA(A); }

static void opC0RetNz(void) {
  tactPlus1WithAddress(IR);
  if ((F & FLAG_Z) == 0) retCore();
}

static void opC1PopBc(void) { popTo(&cpu.bc); }

static void opC2JpNz(void) {
  WZ = readU16Le();
  if ((F & FLAG_Z) == 0) cpu.pc = WZ;
}

static void opC3Jp(void) {
  WZ = readU16Le();
  cpu.pc = WZ;
}

static void opC4CallNz(void) {
  WZ = readU16Le();
  if ((F & FLAG_Z) == 0) callCore();
}

static void opC5PushBc(void) { pushPair(cpu.bc); }
static void opC6AddAN(void) { add8ToA(fetchCodeByte()); }
static void opC7Rst00(void) { rstCore(0x0000); }

static void opC8RetZ(void) {
  tactPlus1WithAddress(IR);
  if ((F & FLAG_Z) != 0) retCore();
}

static void opC9Ret(void) { retCore(); }

static void opCaJpZ(void) {
  WZ = readU16Le();
  if ((F & FLAG_Z) != 0) cpu.pc = WZ;
}

static void opCcCallZ(void) {
  WZ = readU16Le();
  if ((F & FLAG_Z) != 0) callCore();
}

static void opCdCall(void) {
  WZ = readU16Le();
  callCore();
}

static void opCeAdcAN(void) { adc8ToA(fetchCodeByte()); }
static void opCfRst08(void) { rstCore(0x0008); }

static void opD0RetNc(void) {
  tactPlus1WithAddress(IR);
  if ((F & FLAG_C) == 0) retCore();
}

static void opD1PopDe(void) { popTo(&cpu.de); }

static void opD2JpNc(void) {
  WZ = readU16Le();
  if ((F & FLAG_C) == 0) cpu.pc = WZ;
}

static void opD3OutNA(void) {
  uint8_t portLow = fetchCodeByte();
  uint16_t port = ((uint16_t)A << 8) | portLow;
  cpu.wz.bytes.high = A;
  cpu.wz.bytes.low = (uint8_t)(portLow + 1);
  writePort(port, A);
}

static void opD4CallNc(void) {
  WZ = readU16Le();
  if ((F & FLAG_C) == 0) callCore();
}

static void opD5PushDe(void) { pushPair(cpu.de); }
static void opD6SubAN(void) { sub8FromA(fetchCodeByte()); }
static void opD7Rst10(void) { rstCore(0x0010); }

static void opD8RetC(void) {
  tactPlus1WithAddress(IR);
  if ((F & FLAG_C) != 0) retCore();
}

static void opD9Exx(void) {
  RegisterPair oldBc = cpu.bc;
  RegisterPair oldDe = cpu.de;
  RegisterPair oldHl = cpu.hl;
  cpu.bc = cpu.bcAlt;
  cpu.de = cpu.deAlt;
  cpu.hl = cpu.hlAlt;
  cpu.bcAlt = oldBc;
  cpu.deAlt = oldDe;
  cpu.hlAlt = oldHl;
}

static void opDaJpC(void) {
  WZ = readU16Le();
  if ((F & FLAG_C) != 0) cpu.pc = WZ;
}

static void opDbInAN(void) {
  uint16_t port = fetchCodeByte() | ((uint16_t)A << 8);
  A = readPort(port);
  WZ = (uint16_t)(port + 1);
}

static void opDcCallC(void) {
  WZ = readU16Le();
  if ((F & FLAG_C) != 0) callCore();
}

static void opDeSbcAN(void) { sbc8FromA(fetchCodeByte()); }
static void opDfRst18(void) { rstCore(0x0018); }

static void opE1PopHl(void) { popTo(&cpu.hl); }

static void opE0RetPo(void) {
  tactPlus1WithAddress(IR);
  if ((F & FLAG_PV) == 0) retCore();
}

static void opE2JpPo(void) {
  WZ = readU16Le();
  if ((F & FLAG_PV) == 0) cpu.pc = WZ;
}

static void opE3ExSpHl(void) {
  uint16_t sp1 = (uint16_t)(cpu.sp + 1);
  uint8_t tempL = readMemory(cpu.sp);
  uint8_t tempH = readMemory(sp1);
  tactPlus1WithAddress(sp1);
  writeMemory(sp1, H);
  writeMemory(cpu.sp, L);
  tactPlus2WithAddress(cpu.sp);
  cpu.wz.bytes.low = tempL;
  cpu.wz.bytes.high = tempH;
  HL = WZ;
}

static void opE4CallPo(void) {
  WZ = readU16Le();
  if ((F & FLAG_PV) == 0) callCore();
}

static void opE5PushHl(void) { pushPair(cpu.hl); }
static void opE6AndAN(void) { and8WithA(fetchCodeByte()); }
static void opE7Rst20(void) { rstCore(0x0020); }

static void opE8RetPe(void) {
  tactPlus1WithAddress(IR);
  if ((F & FLAG_PV) != 0) retCore();
}

static void opE9JpHl(void) { cpu.pc = HL; }

static void opEaJpPe(void) {
  WZ = readU16Le();
  if ((F & FLAG_PV) != 0) cpu.pc = WZ;
}

static void opEbExDeHl(void) {
  RegisterPair oldDe = cpu.de;
  cpu.de = cpu.hl;
  cpu.hl = oldDe;
}

static void opEcCallPe(void) {
  WZ = readU16Le();
  if ((F & FLAG_PV) != 0) callCore();
}

static void opEeXorAN(void) { xor8WithA(fetchCodeByte()); }
static void opEfRst28(void) { rstCore(0x0028); }

static void opF0RetP(void) {
  tactPlus1WithAddress(IR);
  if ((F & FLAG_S) == 0) retCore();
}

static void opF1PopAf(void) { popTo(&cpu.af); }

static void opF2JpP(void) {
  WZ = readU16Le();
  if ((F & FLAG_S) == 0) cpu.pc = WZ;
}

static void opF3Di(void) {
  cpu.iff1 = 0;
  cpu.iff2 = 0;
}

static void opF4CallP(void) {
  WZ = readU16Le();
  if ((F & FLAG_S) == 0) callCore();
}

static void opF5PushAf(void) { pushPair(cpu.af); }
static void opF6OrAN(void) { or8WithA(fetchCodeByte()); }
static void opF7Rst30(void) { rstCore(0x0030); }

static void opF8RetM(void) {
  tactPlus1WithAddress(IR);
  if ((F & FLAG_S) != 0) retCore();
}

static void opF9LdSpHl(void) {
  tactPlus2WithAddress(IR);
  cpu.sp = HL;
}

static void opFaJpM(void) {
  WZ = readU16Le();
  if ((F & FLAG_S) != 0) cpu.pc = WZ;
}

static void opFbEi(void) {
  cpu.iff1 = 1;
  cpu.iff2 = 1;
  cpu.eiBacklog = 2;
}

static void opFcCallM(void) {
  WZ = readU16Le();
  if ((F & FLAG_S) != 0) callCore();
}

static void opFeCpAN(void) { cp8WithA(fetchCodeByte()); }
static void opFfRst38(void) { rstCore(0x0038); }

static void op76Halt(void) {
  cpu.halted = 1;
  cpu.pc = (uint16_t)(cpu.pc - 1);
}

// -----------------------------------------------------------------------------
// Extended instruction implementations
// -----------------------------------------------------------------------------

static inline void extInTo(uint8_t *target) {
  WZ = (uint16_t)(BC + 1);
  *target = readPort(BC);
  F = (F & FLAG_C) | sz53Flags(*target);
}

static inline void extOutFrom(uint8_t value) {
  writePort(BC, value);
  WZ = (uint16_t)(BC + 1);
}

static inline void extLoadPairFromAddr(RegisterPair *pairValue) {
  uint16_t address = readU16Le();
  pairValue->bytes.low = readMemory(address);
  WZ = (uint16_t)(address + 1);
  pairValue->bytes.high = readMemory(WZ);
}

static void ext40InBC(void) { extInTo(&B); }
static void ext41OutCB(void) { extOutFrom(B); }
static void ext42SbcHlBc(void) {
  tactPlus7WithAddress(IR);
  sbc16FromHl(BC);
}
static void ext43LdAddrBc(void) { store16(C, B); }
static void ext44Neg(void) {
  uint8_t value = A;
  A = 0;
  sub8FromA(value);
}

static void ext45Retn(void) {
  cpu.iff1 = cpu.iff2;
  cpu.retnExecuted = 1;
  retCore();
}

static void ext46Im0(void) {
  cpu.interruptMode = 0;
}

static void ext47LdIA(void) {
  tactPlus1WithAddress(IR);
  cpu.ir.bytes.high = A;
}

static void ext48InCC(void) { extInTo(&C); }
static void ext49OutCC(void) { extOutFrom(C); }
static void ext4aAdcHlBc(void) {
  tactPlus7WithAddress(IR);
  adc16ToHl(BC);
}
static void ext4bLdBcAddr(void) { extLoadPairFromAddr(&cpu.bc); }

static void ext4fLdRA(void) {
  tactPlus1WithAddress(IR);
  cpu.ir.bytes.low = A;
}

static void ext50InDC(void) { extInTo(&D); }
static void ext51OutCD(void) { extOutFrom(D); }
static void ext52SbcHlDe(void) {
  tactPlus7WithAddress(IR);
  sbc16FromHl(DE);
}
static void ext53LdAddrDe(void) { store16(E, D); }

static void ext56Im1(void) {
  cpu.interruptMode = 1;
}

static void ext57LdAI(void) {
  tactPlus1WithAddress(IR);
  A = cpu.ir.bytes.high;
  F = (F & FLAG_C) | sz53Flags(A) | (cpu.iff2 ? FLAG_PV : 0);
  cpu.afterLdAIR = 1;
}

static void ext58InEC(void) { extInTo(&E); }
static void ext59OutCE(void) { extOutFrom(E); }
static void ext5aAdcHlDe(void) {
  tactPlus7WithAddress(IR);
  adc16ToHl(DE);
}
static void ext5bLdDeAddr(void) { extLoadPairFromAddr(&cpu.de); }

static void ext5eIm2(void) {
  cpu.interruptMode = 2;
}

static void ext5fLdAR(void) {
  tactPlus1WithAddress(IR);
  A = cpu.ir.bytes.low;
  F = (F & FLAG_C) | sz53Flags(A) | (cpu.iff2 ? FLAG_PV : 0);
  cpu.afterLdAIR = 1;
}

static void ext60InHC(void) { extInTo(&H); }
static void ext61OutCH(void) { extOutFrom(H); }
static void ext62SbcHlHl(void) {
  tactPlus7WithAddress(IR);
  sbc16FromHl(HL);
}
static void ext63LdAddrHl(void) { store16(L, H); }
static void ext67Rrd(void) {
  uint8_t value = readMemory(HL);
  tactPlus4WithAddress(HL);
  writeMemory(HL, (uint8_t)((A << 4) | (value >> 4)));
  A = (A & 0xf0) | (value & 0x0f);
  F = (F & FLAG_C) | sz53PvFlags(A);
  WZ = (uint16_t)(HL + 1);
}

static void ext68InLC(void) { extInTo(&L); }
static void ext69OutCL(void) { extOutFrom(L); }
static void ext6aAdcHlHl(void) {
  tactPlus7WithAddress(IR);
  adc16ToHl(HL);
}
static void ext6bLdHlAddr(void) { extLoadPairFromAddr(&cpu.hl); }
static void ext6fRld(void) {
  uint8_t value = readMemory(HL);
  tactPlus4WithAddress(HL);
  writeMemory(HL, (uint8_t)((value << 4) | (A & 0x0f)));
  A = (A & 0xf0) | (value >> 4);
  F = (F & FLAG_C) | sz53PvFlags(A);
  WZ = (uint16_t)(HL + 1);
}

static void ext70InC(void) {
  WZ = (uint16_t)(BC + 1);
  uint8_t value = readPort(BC);
  F = (F & FLAG_C) | sz53Flags(value);
}
static void ext71OutC0(void) { extOutFrom(0); }
static void ext72SbcHlSp(void) {
  tactPlus7WithAddress(IR);
  sbc16FromHl(cpu.sp);
}
static void ext73LdAddrSp(void) { store16(lo(cpu.sp), hi(cpu.sp)); }
static void ext78InAC(void) { extInTo(&A); }
static void ext79OutCA(void) { extOutFrom(A); }
static void ext7aAdcHlSp(void) {
  tactPlus7WithAddress(IR);
  adc16ToHl(cpu.sp);
}
static void ext7bLdSpAddr(void) {
  uint16_t address = readU16Le();
  uint8_t low = readMemory(address);
  WZ = (uint16_t)(address + 1);
  cpu.sp = pair(readMemory(WZ), low);
}

static inline void extLdiCore(int8_t delta, uint8_t repeat) {
  uint8_t value = readMemory(HL);
  writeMemory(DE, value);
  tactPlus2WithAddress(DE);
  BC = (uint16_t)(BC - 1);
  uint8_t flagsValue = (uint8_t)(value + A);
  F = (F & (FLAG_C | FLAG_Z | FLAG_S)) | (BC != 0 ? FLAG_PV : 0) |
      (flagsValue & FLAG_R3) | ((flagsValue & 0x02) ? FLAG_R5 : 0);
  if (repeat && BC != 0) {
    tactPlus5WithAddress(DE);
    cpu.pc = (uint16_t)(cpu.pc - 2);
    WZ = (uint16_t)(cpu.pc + 1);
  }
  HL = (uint16_t)(HL + delta);
  DE = (uint16_t)(DE + delta);
}

static inline void extCpiCore(int8_t delta, uint8_t repeat) {
  uint8_t value = readMemory(HL);
  uint8_t result = (uint8_t)(A - value);
  uint8_t flags = (F & FLAG_C) | FLAG_N | (result & FLAG_S);
  tactPlus5WithAddress(HL);
  BC = (uint16_t)(BC - 1);
  if (BC != 0) flags |= FLAG_PV;
  if (result == 0) flags |= FLAG_Z;
  if (((A ^ value ^ result) & 0x10) != 0) flags |= FLAG_H;
  if (flags & FLAG_H) result = (uint8_t)(result - 1);
  flags |= (result & FLAG_R3) | ((result & 0x02) ? FLAG_R5 : 0);
  F = flags;
  if (repeat && (F & (FLAG_PV | FLAG_Z)) == FLAG_PV) {
    tactPlus5WithAddress(HL);
    cpu.pc = (uint16_t)(cpu.pc - 2);
    WZ = (uint16_t)(cpu.pc + 1);
  } else {
    WZ = (uint16_t)(WZ + delta);
  }
  HL = (uint16_t)(HL + delta);
}

static inline void extIniCore(int8_t delta, uint8_t repeat) {
  tactPlus1WithAddress(IR);
  uint8_t value = readPort(BC);
  writeMemory(HL, value);
  WZ = (uint16_t)(BC + delta);
  B = (uint8_t)(B - 1);
  uint8_t flagsValue = (uint8_t)(value + C + delta);
  F = ((value & 0x80) ? FLAG_N : 0) |
      (flagsValue < value ? (FLAG_H | FLAG_C) : 0) |
      (parityFlag((uint8_t)((flagsValue & 0x07) ^ B)) ? FLAG_PV : 0) |
      sz53Flags(B);
  if (repeat && B != 0) {
    tactPlus5WithAddress(HL);
    cpu.pc = (uint16_t)(cpu.pc - 2);
  }
  HL = (uint16_t)(HL + delta);
}

static inline void extOutiCore(int8_t delta, uint8_t repeat) {
  tactPlus1WithAddress(IR);
  uint8_t value = readMemory(HL);
  B = (uint8_t)(B - 1);
  WZ = (uint16_t)(BC + delta);
  writePort(BC, value);
  HL = (uint16_t)(HL + delta);
  uint8_t flagsValue = (uint8_t)(value + L);
  F = ((value & 0x80) ? FLAG_N : 0) |
      (flagsValue < value ? (FLAG_H | FLAG_C) : 0) |
      (parityFlag((uint8_t)((flagsValue & 0x07) ^ B)) ? FLAG_PV : 0) |
      sz53Flags(B);
  if (repeat && B != 0) {
    tactPlus5WithAddress(HL);
    cpu.pc = (uint16_t)(cpu.pc - 2);
  }
}

static void extA0Ldi(void) { extLdiCore(1, 0); }
static void extA1Cpi(void) { extCpiCore(1, 0); }
static void extA2Ini(void) { extIniCore(1, 0); }
static void extA3Outi(void) { extOutiCore(1, 0); }
static void extA8Ldd(void) { extLdiCore(-1, 0); }
static void extA9Cpd(void) { extCpiCore(-1, 0); }
static void extAaInd(void) { extIniCore(-1, 0); }
static void extAbOutd(void) { extOutiCore(-1, 0); }
static void extB0Ldir(void) { extLdiCore(1, 1); }
static void extB1Cpir(void) { extCpiCore(1, 1); }
static void extB2Inir(void) { extIniCore(1, 1); }
static void extB3Otir(void) { extOutiCore(1, 1); }
static void extB8Lddr(void) { extLdiCore(-1, 1); }
static void extB9Cpdr(void) { extCpiCore(-1, 1); }
static void extBaIndr(void) { extIniCore(-1, 1); }
static void extBbOtdr(void) { extOutiCore(-1, 1); }

// -----------------------------------------------------------------------------
// Z80N extended instruction implementations
// -----------------------------------------------------------------------------

static void z80n23Swapnib(void) {
  A = (uint8_t)((A << 4) | (A >> 4));
}

static void z80n24MirrorA(void) {
  uint8_t value = A;
  value = (uint8_t)(((value & 0xf0) >> 4) | ((value & 0x0f) << 4));
  value = (uint8_t)(((value & 0xcc) >> 2) | ((value & 0x33) << 2));
  A = (uint8_t)(((value & 0xaa) >> 1) | ((value & 0x55) << 1));
}

static void z80n27TestN(void) {
  uint8_t value = fetchCodeByte();
  F = FLAG_H | sz53PvFlags((uint8_t)(A & value));
}

static void z80n28Bsla(void) {
  uint8_t shiftAmount = B & 0x1f;
  if (shiftAmount == 0) return;
  DE = shiftAmount >= 0x10 ? 0 : (uint16_t)(DE << shiftAmount);
}

static void z80n29Bsra(void) {
  uint8_t shiftAmount = B & 0x1f;
  uint8_t signSet = (DE & 0x8000) != 0;
  if (shiftAmount == 0) return;
  if (shiftAmount >= 15) {
    DE = signSet ? 0xffff : 0x0000;
    return;
  }
  DE = (uint16_t)((DE >> shiftAmount) | (signSet ? (0xffff << (15 - shiftAmount)) : 0));
}

static void z80n2aBsrl(void) {
  uint8_t shiftAmount = B & 0x1f;
  if (shiftAmount == 0) return;
  DE = shiftAmount >= 0x10 ? 0 : (uint16_t)(DE >> shiftAmount);
}

static void z80n2bBsrf(void) {
  uint8_t shiftAmount = B & 0x1f;
  if (shiftAmount == 0) return;
  DE = shiftAmount >= 0x10 ? 0xffff : (uint16_t)((DE >> shiftAmount) | (0xffff << (16 - shiftAmount)));
}

static void z80n2cBrlc(void) {
  uint8_t rolls = B & 0x0f;
  if (rolls == 0) return;
  DE = (uint16_t)((DE << rolls) | (DE >> (16 - rolls)));
}

static void z80n30MulDE(void) { DE = (uint16_t)(D * E); }
static void z80n31AddHLA(void) { HL = (uint16_t)(HL + A); }
static void z80n32AddDEA(void) { DE = (uint16_t)(DE + A); }
static void z80n33AddBCA(void) { BC = (uint16_t)(BC + A); }

static void z80n34AddHLNN(void) {
  HL = (uint16_t)(HL + readU16Le());
  tactPlusN(2);
}

static void z80n35AddDENN(void) {
  DE = (uint16_t)(DE + readU16Le());
  tactPlusN(2);
}

static void z80n36AddBCNN(void) {
  BC = (uint16_t)(BC + readU16Le());
  tactPlusN(2);
}

static void z80n8aPushNN(void) {
  cpu.sp = (uint16_t)(cpu.sp - 1);
  writeMemory(cpu.sp, fetchCodeByte());
  cpu.sp = (uint16_t)(cpu.sp - 1);
  writeMemory(cpu.sp, fetchCodeByte());
  tactPlusN(3);
}

static void z80n90Outinb(void) {
  tactPlus1WithAddress(IR);
  uint8_t value = readMemory(HL);
  writePort(BC, value);
  HL = (uint16_t)(HL + 1);
}

static void z80n91NextregN(void) {
  uint8_t reg = fetchCodeByte();
  uint8_t value = fetchCodeByte();
  tbBlueOut(reg, value);
  tactPlusN(6);
}

static void z80n92NextregA(void) {
  uint8_t reg = fetchCodeByte();
  tbBlueOut(reg, A);
  tactPlusN(3);
}

static void z80n93Pixeldn(void) {
  uint16_t value = HL;
  if ((value & 0x0700) != 0x0700) {
    H = (uint8_t)(H + 1);
  } else if ((value & 0xe0) != 0xe0) {
    HL = (uint16_t)((value & 0xf8ff) + 0x20);
  } else {
    HL = (uint16_t)((value & 0xf81f) + 0x0800);
  }
}

static void z80n94Pixelad(void) {
  HL = (uint16_t)(0x4000 + ((D & 0xc0) << 5) + ((D & 0x07) << 8) +
                  ((D & 0x38) << 2) + (E >> 3));
}

static void z80n95Setae(void) { A = (uint8_t)(0x80 >> (E & 0x07)); }

static void z80n98JpC(void) {
  cpu.pc = WZ = (uint16_t)((cpu.pc & 0xc000) | (readPort(BC) << 6));
  tactPlusN(1);
}

static inline void z80nLdXCore(int8_t delta) {
  uint8_t value = readMemory(HL);
  if (value != A) {
    writeMemory(DE, value);
  } else {
    tactPlusN(3);
  }
  tactPlus2WithAddress(DE);
  BC = (uint16_t)(BC - 1);
  DE = (uint16_t)(DE + 1);
  HL = (uint16_t)(HL + delta);
}

static void z80nA4Ldix(void) { z80nLdXCore(1); }

static void z80nA5Ldws(void) {
  uint8_t value = readMemory(HL);
  writeMemory(DE, value);
  L = (uint8_t)(L + 1);
  D = inc8(D);
}

static void z80nAcLddx(void) { z80nLdXCore(-1); }

static void z80nB4Ldirx(void) {
  z80nLdXCore(1);
  if (BC != 0) {
    tactPlus5WithAddress(DE);
    cpu.pc = (uint16_t)(cpu.pc - 2);
  }
}

static void z80nB7Ldpirx(void) {
  uint16_t sourceAddress = (uint16_t)((HL & ~0x07) | (E & 0x07));
  if (B != 0 || C != 1) WZ = cpu.pc;
  uint8_t value = readMemory(sourceAddress);
  if (value != A) {
    writeMemory(DE, value);
  } else {
    tactPlusN(3);
  }
  tactPlus2WithAddress(DE);
  BC = (uint16_t)(BC - 1);
  if (BC != 0) {
    tactPlus5WithAddress(DE);
    cpu.pc = (uint16_t)(cpu.pc - 2);
  }
  DE = (uint16_t)(DE + 1);
}

static void z80nBcLddrx(void) {
  z80nLdXCore(-1);
  if (BC != 0) {
    tactPlus5WithAddress(DE);
    cpu.pc = (uint16_t)(cpu.pc - 2);
  }
}

// -----------------------------------------------------------------------------
// Indexed instruction implementations
// -----------------------------------------------------------------------------

static void idx09AddXBc(void) {
  RegisterPair *index = activeIndexPair();
  tactPlus7WithAddress(IR);
  index->word = add16(index->word, BC);
}

static void idx19AddXDe(void) {
  RegisterPair *index = activeIndexPair();
  tactPlus7WithAddress(IR);
  index->word = add16(index->word, DE);
}

static void idx21LdXNN(void) {
  RegisterPair *index = activeIndexPair();
  index->bytes.low = fetchCodeByte();
  index->bytes.high = fetchCodeByte();
}

static void idx22LdAddrX(void) {
  RegisterPair *index = activeIndexPair();
  store16(index->bytes.low, index->bytes.high);
}

static void idx23IncX(void) {
  activeIndexPair()->word = (uint16_t)(activeIndexPair()->word + 1);
  tactPlus2WithAddress(IR);
}

static void idx24IncXh(void) {
  RegisterPair *index = activeIndexPair();
  index->bytes.high = inc8(index->bytes.high);
}

static void idx25DecXh(void) {
  RegisterPair *index = activeIndexPair();
  index->bytes.high = dec8(index->bytes.high);
}

static void idx26LdXhN(void) {
  activeIndexPair()->bytes.high = fetchCodeByte();
}

static void idx29AddXX(void) {
  RegisterPair *index = activeIndexPair();
  tactPlus7WithAddress(IR);
  index->word = add16(index->word, index->word);
}

static void idx2aLdXAddr(void) {
  RegisterPair *index = activeIndexPair();
  uint16_t address = readU16Le();
  index->bytes.low = readMemory(address);
  WZ = (uint16_t)(address + 1);
  index->bytes.high = readMemory(WZ);
}

static void idx2bDecX(void) {
  activeIndexPair()->word = (uint16_t)(activeIndexPair()->word - 1);
  tactPlus2WithAddress(IR);
}

static void idx2cIncXl(void) {
  RegisterPair *index = activeIndexPair();
  index->bytes.low = inc8(index->bytes.low);
}

static void idx2dDecXl(void) {
  RegisterPair *index = activeIndexPair();
  index->bytes.low = dec8(index->bytes.low);
}

static void idx2eLdXlN(void) {
  activeIndexPair()->bytes.low = fetchCodeByte();
}

static void idx34IncXPtr(void) {
  uint16_t address = readIndexedAddress();
  uint8_t value = readMemory(address);
  tactPlus1WithAddress(address);
  value = inc8(value);
  writeMemory(address, value);
}

static void idx35DecXPtr(void) {
  uint16_t address = readIndexedAddress();
  uint8_t value = readMemory(address);
  tactPlus1WithAddress(address);
  value = dec8(value);
  writeMemory(address, value);
}

static void idx36LdXPtrN(void) {
  uint8_t displacement = fetchCodeByte();
  WZ = (uint16_t)(activeIndexPair()->word + sbyte(displacement));
  uint8_t value = fetchCodeByte();
  tactPlus2WithAddress(cpu.pc);
  writeMemory(WZ, value);
}

static void idx39AddXSp(void) {
  RegisterPair *index = activeIndexPair();
  tactPlus7WithAddress(IR);
  index->word = add16(index->word, cpu.sp);
}

static void idx44LdBXh(void) { B = activeIndexPair()->bytes.high; }
static void idx45LdBXl(void) { B = activeIndexPair()->bytes.low; }
static void idx46LdBXPtr(void) { B = readMemory(readIndexedAddress()); }

static void idx4cLdCXh(void) { C = activeIndexPair()->bytes.high; }
static void idx4dLdCXl(void) { C = activeIndexPair()->bytes.low; }
static void idx4eLdCXPtr(void) { C = readMemory(readIndexedAddress()); }

static void idx54LdDXh(void) { D = activeIndexPair()->bytes.high; }
static void idx55LdDXl(void) { D = activeIndexPair()->bytes.low; }
static void idx56LdDXPtr(void) { D = readMemory(readIndexedAddress()); }

static void idx5cLdEXh(void) { E = activeIndexPair()->bytes.high; }
static void idx5dLdEXl(void) { E = activeIndexPair()->bytes.low; }
static void idx5eLdEXPtr(void) { E = readMemory(readIndexedAddress()); }

static void idx60LdXhB(void) { activeIndexPair()->bytes.high = B; }
static void idx61LdXhC(void) { activeIndexPair()->bytes.high = C; }
static void idx62LdXhD(void) { activeIndexPair()->bytes.high = D; }
static void idx63LdXhE(void) { activeIndexPair()->bytes.high = E; }
static void idx65LdXhXl(void) {
  RegisterPair *index = activeIndexPair();
  index->bytes.high = index->bytes.low;
}
static void idx66LdHXPtr(void) { H = readMemory(readIndexedAddress()); }
static void idx67LdXhA(void) { activeIndexPair()->bytes.high = A; }

static void idx68LdXlB(void) { activeIndexPair()->bytes.low = B; }
static void idx69LdXlC(void) { activeIndexPair()->bytes.low = C; }
static void idx6aLdXlD(void) { activeIndexPair()->bytes.low = D; }
static void idx6bLdXlE(void) { activeIndexPair()->bytes.low = E; }
static void idx6cLdXlXh(void) {
  RegisterPair *index = activeIndexPair();
  index->bytes.low = index->bytes.high;
}
static void idx6eLdLXPtr(void) { L = readMemory(readIndexedAddress()); }
static void idx6fLdXlA(void) { activeIndexPair()->bytes.low = A; }

static void idx70LdXPtrB(void) { writeMemory(readIndexedAddress(), B); }
static void idx71LdXPtrC(void) { writeMemory(readIndexedAddress(), C); }
static void idx72LdXPtrD(void) { writeMemory(readIndexedAddress(), D); }
static void idx73LdXPtrE(void) { writeMemory(readIndexedAddress(), E); }
static void idx74LdXPtrH(void) { writeMemory(readIndexedAddress(), H); }
static void idx75LdXPtrL(void) { writeMemory(readIndexedAddress(), L); }
static void idx77LdXPtrA(void) { writeMemory(readIndexedAddress(), A); }

static void idx7cLdAXh(void) { A = activeIndexPair()->bytes.high; }
static void idx7dLdAXl(void) { A = activeIndexPair()->bytes.low; }
static void idx7eLdAXPtr(void) { A = readMemory(readIndexedAddress()); }

static void idx84AddAXh(void) { add8ToA(activeIndexPair()->bytes.high); }
static void idx85AddAXl(void) { add8ToA(activeIndexPair()->bytes.low); }
static void idx86AddAXPtr(void) { add8ToA(readMemory(readIndexedAddress())); }

static void idx8cAdcAXh(void) { adc8ToA(activeIndexPair()->bytes.high); }
static void idx8dAdcAXl(void) { adc8ToA(activeIndexPair()->bytes.low); }
static void idx8eAdcAXPtr(void) { adc8ToA(readMemory(readIndexedAddress())); }

static void idx94SubAXh(void) { sub8FromA(activeIndexPair()->bytes.high); }
static void idx95SubAXl(void) { sub8FromA(activeIndexPair()->bytes.low); }
static void idx96SubAXPtr(void) { sub8FromA(readMemory(readIndexedAddress())); }

static void idx9cSbcAXh(void) { sbc8FromA(activeIndexPair()->bytes.high); }
static void idx9dSbcAXl(void) { sbc8FromA(activeIndexPair()->bytes.low); }
static void idx9eSbcAXPtr(void) { sbc8FromA(readMemory(readIndexedAddress())); }

static void idxA4AndAXh(void) { and8WithA(activeIndexPair()->bytes.high); }
static void idxA5AndAXl(void) { and8WithA(activeIndexPair()->bytes.low); }
static void idxA6AndAXPtr(void) { and8WithA(readMemory(readIndexedAddress())); }

static void idxAcXorAXh(void) { xor8WithA(activeIndexPair()->bytes.high); }
static void idxAdXorAXl(void) { xor8WithA(activeIndexPair()->bytes.low); }
static void idxAeXorAXPtr(void) { xor8WithA(readMemory(readIndexedAddress())); }

static void idxB4OrAXh(void) { or8WithA(activeIndexPair()->bytes.high); }
static void idxB5OrAXl(void) { or8WithA(activeIndexPair()->bytes.low); }
static void idxB6OrAXPtr(void) { or8WithA(readMemory(readIndexedAddress())); }

static void idxBcCpXh(void) { cp8WithA(activeIndexPair()->bytes.high); }
static void idxBdCpXl(void) { cp8WithA(activeIndexPair()->bytes.low); }
static void idxBeCpXPtr(void) { cp8WithA(readMemory(readIndexedAddress())); }

static void idxE1PopX(void) {
  popTo(activeIndexPair());
}

static void idxE3ExSpX(void) {
  RegisterPair *index = activeIndexPair();
  uint16_t sp1 = (uint16_t)(cpu.sp + 1);
  uint8_t tempL = readMemory(cpu.sp);
  uint8_t tempH = readMemory(sp1);
  tactPlus1WithAddress(sp1);
  writeMemory(sp1, index->bytes.high);
  writeMemory(cpu.sp, index->bytes.low);
  tactPlus2WithAddress(cpu.sp);
  cpu.wz.bytes.low = tempL;
  cpu.wz.bytes.high = tempH;
  index->word = WZ;
}

static void idxE5PushX(void) {
  pushPair(*activeIndexPair());
}

static void idxE9JpX(void) {
  cpu.pc = activeIndexPair()->word;
}

static void idxF9LdSpX(void) {
  tactPlus2WithAddress(IR);
  cpu.sp = activeIndexPair()->word;
}

#define DEFINE_INDEXED_BIT_SHIFT_REG_OP(name, transform, operand) \
  static void name(void) { \
    uint8_t value = transform(readMemory(WZ)); \
    tactPlus1WithAddress(WZ); \
    operand = value; \
    writeMemory(WZ, value); \
  }

#define DEFINE_INDEXED_BIT_SHIFT_MEM_OP(name, transform) \
  static void name(void) { \
    uint8_t value = transform(readMemory(WZ)); \
    tactPlus1WithAddress(WZ); \
    writeMemory(WZ, value); \
  }

DEFINE_INDEXED_BIT_SHIFT_REG_OP(xbit00RlcB, rlc8, B)
DEFINE_INDEXED_BIT_SHIFT_REG_OP(xbit01RlcC, rlc8, C)
DEFINE_INDEXED_BIT_SHIFT_REG_OP(xbit02RlcD, rlc8, D)
DEFINE_INDEXED_BIT_SHIFT_REG_OP(xbit03RlcE, rlc8, E)
DEFINE_INDEXED_BIT_SHIFT_REG_OP(xbit04RlcH, rlc8, H)
DEFINE_INDEXED_BIT_SHIFT_REG_OP(xbit05RlcL, rlc8, L)
DEFINE_INDEXED_BIT_SHIFT_MEM_OP(xbit06Rlc, rlc8)
DEFINE_INDEXED_BIT_SHIFT_REG_OP(xbit07RlcA, rlc8, A)

DEFINE_INDEXED_BIT_SHIFT_REG_OP(xbit08RrcB, rrc8, B)
DEFINE_INDEXED_BIT_SHIFT_REG_OP(xbit09RrcC, rrc8, C)
DEFINE_INDEXED_BIT_SHIFT_REG_OP(xbit0aRrcD, rrc8, D)
DEFINE_INDEXED_BIT_SHIFT_REG_OP(xbit0bRrcE, rrc8, E)
DEFINE_INDEXED_BIT_SHIFT_REG_OP(xbit0cRrcH, rrc8, H)
DEFINE_INDEXED_BIT_SHIFT_REG_OP(xbit0dRrcL, rrc8, L)
DEFINE_INDEXED_BIT_SHIFT_MEM_OP(xbit0eRrc, rrc8)
DEFINE_INDEXED_BIT_SHIFT_REG_OP(xbit0fRrcA, rrc8, A)

DEFINE_INDEXED_BIT_SHIFT_REG_OP(xbit10RlB, rl8, B)
DEFINE_INDEXED_BIT_SHIFT_REG_OP(xbit11RlC, rl8, C)
DEFINE_INDEXED_BIT_SHIFT_REG_OP(xbit12RlD, rl8, D)
DEFINE_INDEXED_BIT_SHIFT_REG_OP(xbit13RlE, rl8, E)
DEFINE_INDEXED_BIT_SHIFT_REG_OP(xbit14RlH, rl8, H)
DEFINE_INDEXED_BIT_SHIFT_REG_OP(xbit15RlL, rl8, L)
DEFINE_INDEXED_BIT_SHIFT_MEM_OP(xbit16Rl, rl8)
DEFINE_INDEXED_BIT_SHIFT_REG_OP(xbit17RlA, rl8, A)

DEFINE_INDEXED_BIT_SHIFT_REG_OP(xbit18RrB, rr8, B)
DEFINE_INDEXED_BIT_SHIFT_REG_OP(xbit19RrC, rr8, C)
DEFINE_INDEXED_BIT_SHIFT_REG_OP(xbit1aRrD, rr8, D)
DEFINE_INDEXED_BIT_SHIFT_REG_OP(xbit1bRrE, rr8, E)
DEFINE_INDEXED_BIT_SHIFT_REG_OP(xbit1cRrH, rr8, H)
DEFINE_INDEXED_BIT_SHIFT_REG_OP(xbit1dRrL, rr8, L)
DEFINE_INDEXED_BIT_SHIFT_MEM_OP(xbit1eRr, rr8)
DEFINE_INDEXED_BIT_SHIFT_REG_OP(xbit1fRrA, rr8, A)

DEFINE_INDEXED_BIT_SHIFT_REG_OP(xbit20SlaB, sla8, B)
DEFINE_INDEXED_BIT_SHIFT_REG_OP(xbit21SlaC, sla8, C)
DEFINE_INDEXED_BIT_SHIFT_REG_OP(xbit22SlaD, sla8, D)
DEFINE_INDEXED_BIT_SHIFT_REG_OP(xbit23SlaE, sla8, E)
DEFINE_INDEXED_BIT_SHIFT_REG_OP(xbit24SlaH, sla8, H)
DEFINE_INDEXED_BIT_SHIFT_REG_OP(xbit25SlaL, sla8, L)
DEFINE_INDEXED_BIT_SHIFT_MEM_OP(xbit26Sla, sla8)
DEFINE_INDEXED_BIT_SHIFT_REG_OP(xbit27SlaA, sla8, A)

DEFINE_INDEXED_BIT_SHIFT_REG_OP(xbit28SraB, sra8, B)
DEFINE_INDEXED_BIT_SHIFT_REG_OP(xbit29SraC, sra8, C)
DEFINE_INDEXED_BIT_SHIFT_REG_OP(xbit2aSraD, sra8, D)
DEFINE_INDEXED_BIT_SHIFT_REG_OP(xbit2bSraE, sra8, E)
DEFINE_INDEXED_BIT_SHIFT_REG_OP(xbit2cSraH, sra8, H)
DEFINE_INDEXED_BIT_SHIFT_REG_OP(xbit2dSraL, sra8, L)
DEFINE_INDEXED_BIT_SHIFT_MEM_OP(xbit2eSra, sra8)
DEFINE_INDEXED_BIT_SHIFT_REG_OP(xbit2fSraA, sra8, A)

DEFINE_INDEXED_BIT_SHIFT_REG_OP(xbit30SllB, sll8, B)
DEFINE_INDEXED_BIT_SHIFT_REG_OP(xbit31SllC, sll8, C)
DEFINE_INDEXED_BIT_SHIFT_REG_OP(xbit32SllD, sll8, D)
DEFINE_INDEXED_BIT_SHIFT_REG_OP(xbit33SllE, sll8, E)
DEFINE_INDEXED_BIT_SHIFT_REG_OP(xbit34SllH, sll8, H)
DEFINE_INDEXED_BIT_SHIFT_REG_OP(xbit35SllL, sll8, L)
DEFINE_INDEXED_BIT_SHIFT_MEM_OP(xbit36Sll, sll8)
DEFINE_INDEXED_BIT_SHIFT_REG_OP(xbit37SllA, sll8, A)

DEFINE_INDEXED_BIT_SHIFT_REG_OP(xbit38SrlB, srl8, B)
DEFINE_INDEXED_BIT_SHIFT_REG_OP(xbit39SrlC, srl8, C)
DEFINE_INDEXED_BIT_SHIFT_REG_OP(xbit3aSrlD, srl8, D)
DEFINE_INDEXED_BIT_SHIFT_REG_OP(xbit3bSrlE, srl8, E)
DEFINE_INDEXED_BIT_SHIFT_REG_OP(xbit3cSrlH, srl8, H)
DEFINE_INDEXED_BIT_SHIFT_REG_OP(xbit3dSrlL, srl8, L)
DEFINE_INDEXED_BIT_SHIFT_MEM_OP(xbit3eSrl, srl8)
DEFINE_INDEXED_BIT_SHIFT_REG_OP(xbit3fSrlA, srl8, A)

#undef DEFINE_INDEXED_BIT_SHIFT_MEM_OP
#undef DEFINE_INDEXED_BIT_SHIFT_REG_OP

#define DEFINE_INDEXED_BIT_OP(name, bit) \
  static void name(void) { \
    uint8_t value = readMemory(WZ); \
    tactPlus1WithAddress(WZ); \
    bit8(bit, value, cpu.wz.bytes.high); \
  }

DEFINE_INDEXED_BIT_OP(xbit40Bit0, 0)
DEFINE_INDEXED_BIT_OP(xbit48Bit1, 1)
DEFINE_INDEXED_BIT_OP(xbit50Bit2, 2)
DEFINE_INDEXED_BIT_OP(xbit58Bit3, 3)
DEFINE_INDEXED_BIT_OP(xbit60Bit4, 4)
DEFINE_INDEXED_BIT_OP(xbit68Bit5, 5)
DEFINE_INDEXED_BIT_OP(xbit70Bit6, 6)
DEFINE_INDEXED_BIT_OP(xbit78Bit7, 7)

#undef DEFINE_INDEXED_BIT_OP

#define DEFINE_INDEXED_RES_REG_OP(name, bit, operand) \
  static void name(void) { \
    uint8_t value = readMemory(WZ) & (uint8_t)~(1 << bit); \
    tactPlus1WithAddress(WZ); \
    operand = value; \
    writeMemory(WZ, value); \
  }

#define DEFINE_INDEXED_RES_MEM_OP(name, bit) \
  static void name(void) { \
    uint8_t value = readMemory(WZ) & (uint8_t)~(1 << bit); \
    tactPlus1WithAddress(WZ); \
    writeMemory(WZ, value); \
  }

DEFINE_INDEXED_RES_REG_OP(xbit80Res0B, 0, B)
DEFINE_INDEXED_RES_REG_OP(xbit81Res0C, 0, C)
DEFINE_INDEXED_RES_REG_OP(xbit82Res0D, 0, D)
DEFINE_INDEXED_RES_REG_OP(xbit83Res0E, 0, E)
DEFINE_INDEXED_RES_REG_OP(xbit84Res0H, 0, H)
DEFINE_INDEXED_RES_REG_OP(xbit85Res0L, 0, L)
DEFINE_INDEXED_RES_MEM_OP(xbit86Res0, 0)
DEFINE_INDEXED_RES_REG_OP(xbit87Res0A, 0, A)

DEFINE_INDEXED_RES_REG_OP(xbit88Res1B, 1, B)
DEFINE_INDEXED_RES_REG_OP(xbit89Res1C, 1, C)
DEFINE_INDEXED_RES_REG_OP(xbit8aRes1D, 1, D)
DEFINE_INDEXED_RES_REG_OP(xbit8bRes1E, 1, E)
DEFINE_INDEXED_RES_REG_OP(xbit8cRes1H, 1, H)
DEFINE_INDEXED_RES_REG_OP(xbit8dRes1L, 1, L)
DEFINE_INDEXED_RES_MEM_OP(xbit8eRes1, 1)
DEFINE_INDEXED_RES_REG_OP(xbit8fRes1A, 1, A)

DEFINE_INDEXED_RES_REG_OP(xbit90Res2B, 2, B)
DEFINE_INDEXED_RES_REG_OP(xbit91Res2C, 2, C)
DEFINE_INDEXED_RES_REG_OP(xbit92Res2D, 2, D)
DEFINE_INDEXED_RES_REG_OP(xbit93Res2E, 2, E)
DEFINE_INDEXED_RES_REG_OP(xbit94Res2H, 2, H)
DEFINE_INDEXED_RES_REG_OP(xbit95Res2L, 2, L)
DEFINE_INDEXED_RES_MEM_OP(xbit96Res2, 2)
DEFINE_INDEXED_RES_REG_OP(xbit97Res2A, 2, A)

DEFINE_INDEXED_RES_REG_OP(xbit98Res3B, 3, B)
DEFINE_INDEXED_RES_REG_OP(xbit99Res3C, 3, C)
DEFINE_INDEXED_RES_REG_OP(xbit9aRes3D, 3, D)
DEFINE_INDEXED_RES_REG_OP(xbit9bRes3E, 3, E)
DEFINE_INDEXED_RES_REG_OP(xbit9cRes3H, 3, H)
DEFINE_INDEXED_RES_REG_OP(xbit9dRes3L, 3, L)
DEFINE_INDEXED_RES_MEM_OP(xbit9eRes3, 3)
DEFINE_INDEXED_RES_REG_OP(xbit9fRes3A, 3, A)

DEFINE_INDEXED_RES_REG_OP(xbitA0Res4B, 4, B)
DEFINE_INDEXED_RES_REG_OP(xbitA1Res4C, 4, C)
DEFINE_INDEXED_RES_REG_OP(xbitA2Res4D, 4, D)
DEFINE_INDEXED_RES_REG_OP(xbitA3Res4E, 4, E)
DEFINE_INDEXED_RES_REG_OP(xbitA4Res4H, 4, H)
DEFINE_INDEXED_RES_REG_OP(xbitA5Res4L, 4, L)
DEFINE_INDEXED_RES_MEM_OP(xbitA6Res4, 4)
DEFINE_INDEXED_RES_REG_OP(xbitA7Res4A, 4, A)

DEFINE_INDEXED_RES_REG_OP(xbitA8Res5B, 5, B)
DEFINE_INDEXED_RES_REG_OP(xbitA9Res5C, 5, C)
DEFINE_INDEXED_RES_REG_OP(xbitAaRes5D, 5, D)
DEFINE_INDEXED_RES_REG_OP(xbitAbRes5E, 5, E)
DEFINE_INDEXED_RES_REG_OP(xbitAcRes5H, 5, H)
DEFINE_INDEXED_RES_REG_OP(xbitAdRes5L, 5, L)
DEFINE_INDEXED_RES_MEM_OP(xbitAeRes5, 5)
DEFINE_INDEXED_RES_REG_OP(xbitAfRes5A, 5, A)

DEFINE_INDEXED_RES_REG_OP(xbitB0Res6B, 6, B)
DEFINE_INDEXED_RES_REG_OP(xbitB1Res6C, 6, C)
DEFINE_INDEXED_RES_REG_OP(xbitB2Res6D, 6, D)
DEFINE_INDEXED_RES_REG_OP(xbitB3Res6E, 6, E)
DEFINE_INDEXED_RES_REG_OP(xbitB4Res6H, 6, H)
DEFINE_INDEXED_RES_REG_OP(xbitB5Res6L, 6, L)
DEFINE_INDEXED_RES_MEM_OP(xbitB6Res6, 6)
DEFINE_INDEXED_RES_REG_OP(xbitB7Res6A, 6, A)

DEFINE_INDEXED_RES_REG_OP(xbitB8Res7B, 7, B)
DEFINE_INDEXED_RES_REG_OP(xbitB9Res7C, 7, C)
DEFINE_INDEXED_RES_REG_OP(xbitBaRes7D, 7, D)
DEFINE_INDEXED_RES_REG_OP(xbitBbRes7E, 7, E)
DEFINE_INDEXED_RES_REG_OP(xbitBcRes7H, 7, H)
DEFINE_INDEXED_RES_REG_OP(xbitBdRes7L, 7, L)
DEFINE_INDEXED_RES_MEM_OP(xbitBeRes7, 7)
DEFINE_INDEXED_RES_REG_OP(xbitBfRes7A, 7, A)

#undef DEFINE_INDEXED_RES_MEM_OP
#undef DEFINE_INDEXED_RES_REG_OP

#define DEFINE_INDEXED_SET_REG_OP(name, bit, operand) \
  static void name(void) { \
    uint8_t value = readMemory(WZ) | (uint8_t)(1 << bit); \
    tactPlus1WithAddress(WZ); \
    operand = value; \
    writeMemory(WZ, value); \
  }

#define DEFINE_INDEXED_SET_MEM_OP(name, bit) \
  static void name(void) { \
    uint8_t value = readMemory(WZ) | (uint8_t)(1 << bit); \
    tactPlus1WithAddress(WZ); \
    writeMemory(WZ, value); \
  }

DEFINE_INDEXED_SET_REG_OP(xbitC0Set0B, 0, B)
DEFINE_INDEXED_SET_REG_OP(xbitC1Set0C, 0, C)
DEFINE_INDEXED_SET_REG_OP(xbitC2Set0D, 0, D)
DEFINE_INDEXED_SET_REG_OP(xbitC3Set0E, 0, E)
DEFINE_INDEXED_SET_REG_OP(xbitC4Set0H, 0, H)
DEFINE_INDEXED_SET_REG_OP(xbitC5Set0L, 0, L)
DEFINE_INDEXED_SET_MEM_OP(xbitC6Set0, 0)
DEFINE_INDEXED_SET_REG_OP(xbitC7Set0A, 0, A)

DEFINE_INDEXED_SET_REG_OP(xbitC8Set1B, 1, B)
DEFINE_INDEXED_SET_REG_OP(xbitC9Set1C, 1, C)
DEFINE_INDEXED_SET_REG_OP(xbitCaSet1D, 1, D)
DEFINE_INDEXED_SET_REG_OP(xbitCbSet1E, 1, E)
DEFINE_INDEXED_SET_REG_OP(xbitCcSet1H, 1, H)
DEFINE_INDEXED_SET_REG_OP(xbitCdSet1L, 1, L)
DEFINE_INDEXED_SET_MEM_OP(xbitCeSet1, 1)
DEFINE_INDEXED_SET_REG_OP(xbitCfSet1A, 1, A)

DEFINE_INDEXED_SET_REG_OP(xbitD0Set2B, 2, B)
DEFINE_INDEXED_SET_REG_OP(xbitD1Set2C, 2, C)
DEFINE_INDEXED_SET_REG_OP(xbitD2Set2D, 2, D)
DEFINE_INDEXED_SET_REG_OP(xbitD3Set2E, 2, E)
DEFINE_INDEXED_SET_REG_OP(xbitD4Set2H, 2, H)
DEFINE_INDEXED_SET_REG_OP(xbitD5Set2L, 2, L)
DEFINE_INDEXED_SET_MEM_OP(xbitD6Set2, 2)
DEFINE_INDEXED_SET_REG_OP(xbitD7Set2A, 2, A)

DEFINE_INDEXED_SET_REG_OP(xbitD8Set3B, 3, B)
DEFINE_INDEXED_SET_REG_OP(xbitD9Set3C, 3, C)
DEFINE_INDEXED_SET_REG_OP(xbitDaSet3D, 3, D)
DEFINE_INDEXED_SET_REG_OP(xbitDbSet3E, 3, E)
DEFINE_INDEXED_SET_REG_OP(xbitDcSet3H, 3, H)
DEFINE_INDEXED_SET_REG_OP(xbitDdSet3L, 3, L)
DEFINE_INDEXED_SET_MEM_OP(xbitDeSet3, 3)
DEFINE_INDEXED_SET_REG_OP(xbitDfSet3A, 3, A)

DEFINE_INDEXED_SET_REG_OP(xbitE0Set4B, 4, B)
DEFINE_INDEXED_SET_REG_OP(xbitE1Set4C, 4, C)
DEFINE_INDEXED_SET_REG_OP(xbitE2Set4D, 4, D)
DEFINE_INDEXED_SET_REG_OP(xbitE3Set4E, 4, E)
DEFINE_INDEXED_SET_REG_OP(xbitE4Set4H, 4, H)
DEFINE_INDEXED_SET_REG_OP(xbitE5Set4L, 4, L)
DEFINE_INDEXED_SET_MEM_OP(xbitE6Set4, 4)
DEFINE_INDEXED_SET_REG_OP(xbitE7Set4A, 4, A)

DEFINE_INDEXED_SET_REG_OP(xbitE8Set5B, 5, B)
DEFINE_INDEXED_SET_REG_OP(xbitE9Set5C, 5, C)
DEFINE_INDEXED_SET_REG_OP(xbitEaSet5D, 5, D)
DEFINE_INDEXED_SET_REG_OP(xbitEbSet5E, 5, E)
DEFINE_INDEXED_SET_REG_OP(xbitEcSet5H, 5, H)
DEFINE_INDEXED_SET_REG_OP(xbitEdSet5L, 5, L)
DEFINE_INDEXED_SET_MEM_OP(xbitEeSet5, 5)
DEFINE_INDEXED_SET_REG_OP(xbitEfSet5A, 5, A)

DEFINE_INDEXED_SET_REG_OP(xbitF0Set6B, 6, B)
DEFINE_INDEXED_SET_REG_OP(xbitF1Set6C, 6, C)
DEFINE_INDEXED_SET_REG_OP(xbitF2Set6D, 6, D)
DEFINE_INDEXED_SET_REG_OP(xbitF3Set6E, 6, E)
DEFINE_INDEXED_SET_REG_OP(xbitF4Set6H, 6, H)
DEFINE_INDEXED_SET_REG_OP(xbitF5Set6L, 6, L)
DEFINE_INDEXED_SET_MEM_OP(xbitF6Set6, 6)
DEFINE_INDEXED_SET_REG_OP(xbitF7Set6A, 6, A)

DEFINE_INDEXED_SET_REG_OP(xbitF8Set7B, 7, B)
DEFINE_INDEXED_SET_REG_OP(xbitF9Set7C, 7, C)
DEFINE_INDEXED_SET_REG_OP(xbitFaSet7D, 7, D)
DEFINE_INDEXED_SET_REG_OP(xbitFbSet7E, 7, E)
DEFINE_INDEXED_SET_REG_OP(xbitFcSet7H, 7, H)
DEFINE_INDEXED_SET_REG_OP(xbitFdSet7L, 7, L)
DEFINE_INDEXED_SET_MEM_OP(xbitFeSet7, 7)
DEFINE_INDEXED_SET_REG_OP(xbitFfSet7A, 7, A)

#undef DEFINE_INDEXED_SET_MEM_OP
#undef DEFINE_INDEXED_SET_REG_OP

// -----------------------------------------------------------------------------
// Bit instruction implementations
// -----------------------------------------------------------------------------

static void bit00RlcB(void) { B = rlc8(B); }
static void bit01RlcC(void) { C = rlc8(C); }
static void bit02RlcD(void) { D = rlc8(D); }
static void bit03RlcE(void) { E = rlc8(E); }
static void bit04RlcH(void) { H = rlc8(H); }
static void bit05RlcL(void) { L = rlc8(L); }
static void bit06RlcMemHl(void) {
  uint8_t value = rlc8(readMemory(HL));
  tactPlus1WithAddress(HL);
  writeMemory(HL, value);
}
static void bit07RlcA(void) { A = rlc8(A); }

static void bit08RrcB(void) { B = rrc8(B); }
static void bit09RrcC(void) { C = rrc8(C); }
static void bit0aRrcD(void) { D = rrc8(D); }
static void bit0bRrcE(void) { E = rrc8(E); }
static void bit0cRrcH(void) { H = rrc8(H); }
static void bit0dRrcL(void) { L = rrc8(L); }
static void bit0eRrcMemHl(void) {
  uint8_t value = rrc8(readMemory(HL));
  tactPlus1WithAddress(HL);
  writeMemory(HL, value);
}
static void bit0fRrcA(void) { A = rrc8(A); }

static void bit10RlB(void) { B = rl8(B); }
static void bit11RlC(void) { C = rl8(C); }
static void bit12RlD(void) { D = rl8(D); }
static void bit13RlE(void) { E = rl8(E); }
static void bit14RlH(void) { H = rl8(H); }
static void bit15RlL(void) { L = rl8(L); }
static void bit16RlMemHl(void) {
  uint8_t value = rl8(readMemory(HL));
  tactPlus1WithAddress(HL);
  writeMemory(HL, value);
}
static void bit17RlA(void) { A = rl8(A); }

static void bit18RrB(void) { B = rr8(B); }
static void bit19RrC(void) { C = rr8(C); }
static void bit1aRrD(void) { D = rr8(D); }
static void bit1bRrE(void) { E = rr8(E); }
static void bit1cRrH(void) { H = rr8(H); }
static void bit1dRrL(void) { L = rr8(L); }
static void bit1eRrMemHl(void) {
  uint8_t value = rr8(readMemory(HL));
  tactPlus1WithAddress(HL);
  writeMemory(HL, value);
}
static void bit1fRrA(void) { A = rr8(A); }

static void bit20SlaB(void) { B = sla8(B); }
static void bit21SlaC(void) { C = sla8(C); }
static void bit22SlaD(void) { D = sla8(D); }
static void bit23SlaE(void) { E = sla8(E); }
static void bit24SlaH(void) { H = sla8(H); }
static void bit25SlaL(void) { L = sla8(L); }
static void bit26SlaMemHl(void) {
  uint8_t value = sla8(readMemory(HL));
  tactPlus1WithAddress(HL);
  writeMemory(HL, value);
}
static void bit27SlaA(void) { A = sla8(A); }

static void bit28SraB(void) { B = sra8(B); }
static void bit29SraC(void) { C = sra8(C); }
static void bit2aSraD(void) { D = sra8(D); }
static void bit2bSraE(void) { E = sra8(E); }
static void bit2cSraH(void) { H = sra8(H); }
static void bit2dSraL(void) { L = sra8(L); }
static void bit2eSraMemHl(void) {
  uint8_t value = sra8(readMemory(HL));
  tactPlus1WithAddress(HL);
  writeMemory(HL, value);
}
static void bit2fSraA(void) { A = sra8(A); }

static void bit30SllB(void) { B = sll8(B); }
static void bit31SllC(void) { C = sll8(C); }
static void bit32SllD(void) { D = sll8(D); }
static void bit33SllE(void) { E = sll8(E); }
static void bit34SllH(void) { H = sll8(H); }
static void bit35SllL(void) { L = sll8(L); }
static void bit36SllMemHl(void) {
  uint8_t value = sll8(readMemory(HL));
  tactPlus1WithAddress(HL);
  writeMemory(HL, value);
}
static void bit37SllA(void) { A = sll8(A); }

static void bit38SrlB(void) { B = srl8(B); }
static void bit39SrlC(void) { C = srl8(C); }
static void bit3aSrlD(void) { D = srl8(D); }
static void bit3bSrlE(void) { E = srl8(E); }
static void bit3cSrlH(void) { H = srl8(H); }
static void bit3dSrlL(void) { L = srl8(L); }
static void bit3eSrlMemHl(void) {
  uint8_t value = srl8(readMemory(HL));
  tactPlus1WithAddress(HL);
  writeMemory(HL, value);
}
static void bit3fSrlA(void) { A = srl8(A); }

#define DEFINE_BIT_REG_OP(name, bit, operand) static void name(void) { bit8(bit, operand, operand); }
#define DEFINE_BIT_MEM_OP(name, bit) \
  static void name(void) { \
    uint8_t value = readMemory(HL); \
    tactPlus1WithAddress(HL); \
    bit8(bit, value, cpu.wz.bytes.high); \
  }

DEFINE_BIT_REG_OP(bit40Bit0B, 0, B)
DEFINE_BIT_REG_OP(bit41Bit0C, 0, C)
DEFINE_BIT_REG_OP(bit42Bit0D, 0, D)
DEFINE_BIT_REG_OP(bit43Bit0E, 0, E)
DEFINE_BIT_REG_OP(bit44Bit0H, 0, H)
DEFINE_BIT_REG_OP(bit45Bit0L, 0, L)
DEFINE_BIT_MEM_OP(bit46Bit0MemHl, 0)
DEFINE_BIT_REG_OP(bit47Bit0A, 0, A)

DEFINE_BIT_REG_OP(bit48Bit1B, 1, B)
DEFINE_BIT_REG_OP(bit49Bit1C, 1, C)
DEFINE_BIT_REG_OP(bit4aBit1D, 1, D)
DEFINE_BIT_REG_OP(bit4bBit1E, 1, E)
DEFINE_BIT_REG_OP(bit4cBit1H, 1, H)
DEFINE_BIT_REG_OP(bit4dBit1L, 1, L)
DEFINE_BIT_MEM_OP(bit4eBit1MemHl, 1)
DEFINE_BIT_REG_OP(bit4fBit1A, 1, A)

DEFINE_BIT_REG_OP(bit50Bit2B, 2, B)
DEFINE_BIT_REG_OP(bit51Bit2C, 2, C)
DEFINE_BIT_REG_OP(bit52Bit2D, 2, D)
DEFINE_BIT_REG_OP(bit53Bit2E, 2, E)
DEFINE_BIT_REG_OP(bit54Bit2H, 2, H)
DEFINE_BIT_REG_OP(bit55Bit2L, 2, L)
DEFINE_BIT_MEM_OP(bit56Bit2MemHl, 2)
DEFINE_BIT_REG_OP(bit57Bit2A, 2, A)

DEFINE_BIT_REG_OP(bit58Bit3B, 3, B)
DEFINE_BIT_REG_OP(bit59Bit3C, 3, C)
DEFINE_BIT_REG_OP(bit5aBit3D, 3, D)
DEFINE_BIT_REG_OP(bit5bBit3E, 3, E)
DEFINE_BIT_REG_OP(bit5cBit3H, 3, H)
DEFINE_BIT_REG_OP(bit5dBit3L, 3, L)
DEFINE_BIT_MEM_OP(bit5eBit3MemHl, 3)
DEFINE_BIT_REG_OP(bit5fBit3A, 3, A)

DEFINE_BIT_REG_OP(bit60Bit4B, 4, B)
DEFINE_BIT_REG_OP(bit61Bit4C, 4, C)
DEFINE_BIT_REG_OP(bit62Bit4D, 4, D)
DEFINE_BIT_REG_OP(bit63Bit4E, 4, E)
DEFINE_BIT_REG_OP(bit64Bit4H, 4, H)
DEFINE_BIT_REG_OP(bit65Bit4L, 4, L)
DEFINE_BIT_MEM_OP(bit66Bit4MemHl, 4)
DEFINE_BIT_REG_OP(bit67Bit4A, 4, A)

DEFINE_BIT_REG_OP(bit68Bit5B, 5, B)
DEFINE_BIT_REG_OP(bit69Bit5C, 5, C)
DEFINE_BIT_REG_OP(bit6aBit5D, 5, D)
DEFINE_BIT_REG_OP(bit6bBit5E, 5, E)
DEFINE_BIT_REG_OP(bit6cBit5H, 5, H)
DEFINE_BIT_REG_OP(bit6dBit5L, 5, L)
DEFINE_BIT_MEM_OP(bit6eBit5MemHl, 5)
DEFINE_BIT_REG_OP(bit6fBit5A, 5, A)

DEFINE_BIT_REG_OP(bit70Bit6B, 6, B)
DEFINE_BIT_REG_OP(bit71Bit6C, 6, C)
DEFINE_BIT_REG_OP(bit72Bit6D, 6, D)
DEFINE_BIT_REG_OP(bit73Bit6E, 6, E)
DEFINE_BIT_REG_OP(bit74Bit6H, 6, H)
DEFINE_BIT_REG_OP(bit75Bit6L, 6, L)
DEFINE_BIT_MEM_OP(bit76Bit6MemHl, 6)
DEFINE_BIT_REG_OP(bit77Bit6A, 6, A)

DEFINE_BIT_REG_OP(bit78Bit7B, 7, B)
DEFINE_BIT_REG_OP(bit79Bit7C, 7, C)
DEFINE_BIT_REG_OP(bit7aBit7D, 7, D)
DEFINE_BIT_REG_OP(bit7bBit7E, 7, E)
DEFINE_BIT_REG_OP(bit7cBit7H, 7, H)
DEFINE_BIT_REG_OP(bit7dBit7L, 7, L)
DEFINE_BIT_MEM_OP(bit7eBit7MemHl, 7)
DEFINE_BIT_REG_OP(bit7fBit7A, 7, A)

#undef DEFINE_BIT_MEM_OP
#undef DEFINE_BIT_REG_OP

#define DEFINE_RES_REG_OP(name, bit, operand) static void name(void) { operand &= (uint8_t) ~(1 << bit); }
#define DEFINE_RES_MEM_OP(name, bit) \
  static void name(void) { \
    uint8_t value = readMemory(HL) & (uint8_t) ~(1 << bit); \
    tactPlus1WithAddress(HL); \
    writeMemory(HL, value); \
  }

DEFINE_RES_REG_OP(bit80Res0B, 0, B)
DEFINE_RES_REG_OP(bit81Res0C, 0, C)
DEFINE_RES_REG_OP(bit82Res0D, 0, D)
DEFINE_RES_REG_OP(bit83Res0E, 0, E)
DEFINE_RES_REG_OP(bit84Res0H, 0, H)
DEFINE_RES_REG_OP(bit85Res0L, 0, L)
DEFINE_RES_MEM_OP(bit86Res0MemHl, 0)
DEFINE_RES_REG_OP(bit87Res0A, 0, A)

DEFINE_RES_REG_OP(bit88Res1B, 1, B)
DEFINE_RES_REG_OP(bit89Res1C, 1, C)
DEFINE_RES_REG_OP(bit8aRes1D, 1, D)
DEFINE_RES_REG_OP(bit8bRes1E, 1, E)
DEFINE_RES_REG_OP(bit8cRes1H, 1, H)
DEFINE_RES_REG_OP(bit8dRes1L, 1, L)
DEFINE_RES_MEM_OP(bit8eRes1MemHl, 1)
DEFINE_RES_REG_OP(bit8fRes1A, 1, A)

DEFINE_RES_REG_OP(bit90Res2B, 2, B)
DEFINE_RES_REG_OP(bit91Res2C, 2, C)
DEFINE_RES_REG_OP(bit92Res2D, 2, D)
DEFINE_RES_REG_OP(bit93Res2E, 2, E)
DEFINE_RES_REG_OP(bit94Res2H, 2, H)
DEFINE_RES_REG_OP(bit95Res2L, 2, L)
DEFINE_RES_MEM_OP(bit96Res2MemHl, 2)
DEFINE_RES_REG_OP(bit97Res2A, 2, A)

DEFINE_RES_REG_OP(bit98Res3B, 3, B)
DEFINE_RES_REG_OP(bit99Res3C, 3, C)
DEFINE_RES_REG_OP(bit9aRes3D, 3, D)
DEFINE_RES_REG_OP(bit9bRes3E, 3, E)
DEFINE_RES_REG_OP(bit9cRes3H, 3, H)
DEFINE_RES_REG_OP(bit9dRes3L, 3, L)
DEFINE_RES_MEM_OP(bit9eRes3MemHl, 3)
DEFINE_RES_REG_OP(bit9fRes3A, 3, A)

DEFINE_RES_REG_OP(bitA0Res4B, 4, B)
DEFINE_RES_REG_OP(bitA1Res4C, 4, C)
DEFINE_RES_REG_OP(bitA2Res4D, 4, D)
DEFINE_RES_REG_OP(bitA3Res4E, 4, E)
DEFINE_RES_REG_OP(bitA4Res4H, 4, H)
DEFINE_RES_REG_OP(bitA5Res4L, 4, L)
DEFINE_RES_MEM_OP(bitA6Res4MemHl, 4)
DEFINE_RES_REG_OP(bitA7Res4A, 4, A)

DEFINE_RES_REG_OP(bitA8Res5B, 5, B)
DEFINE_RES_REG_OP(bitA9Res5C, 5, C)
DEFINE_RES_REG_OP(bitAaRes5D, 5, D)
DEFINE_RES_REG_OP(bitAbRes5E, 5, E)
DEFINE_RES_REG_OP(bitAcRes5H, 5, H)
DEFINE_RES_REG_OP(bitAdRes5L, 5, L)
DEFINE_RES_MEM_OP(bitAeRes5MemHl, 5)
DEFINE_RES_REG_OP(bitAfRes5A, 5, A)

DEFINE_RES_REG_OP(bitB0Res6B, 6, B)
DEFINE_RES_REG_OP(bitB1Res6C, 6, C)
DEFINE_RES_REG_OP(bitB2Res6D, 6, D)
DEFINE_RES_REG_OP(bitB3Res6E, 6, E)
DEFINE_RES_REG_OP(bitB4Res6H, 6, H)
DEFINE_RES_REG_OP(bitB5Res6L, 6, L)
DEFINE_RES_MEM_OP(bitB6Res6MemHl, 6)
DEFINE_RES_REG_OP(bitB7Res6A, 6, A)

DEFINE_RES_REG_OP(bitB8Res7B, 7, B)
DEFINE_RES_REG_OP(bitB9Res7C, 7, C)
DEFINE_RES_REG_OP(bitBaRes7D, 7, D)
DEFINE_RES_REG_OP(bitBbRes7E, 7, E)
DEFINE_RES_REG_OP(bitBcRes7H, 7, H)
DEFINE_RES_REG_OP(bitBdRes7L, 7, L)
DEFINE_RES_MEM_OP(bitBeRes7MemHl, 7)
DEFINE_RES_REG_OP(bitBfRes7A, 7, A)

#undef DEFINE_RES_MEM_OP
#undef DEFINE_RES_REG_OP

#define DEFINE_SET_REG_OP(name, bit, operand) static void name(void) { operand |= (uint8_t)(1 << bit); }
#define DEFINE_SET_MEM_OP(name, bit) \
  static void name(void) { \
    uint8_t value = readMemory(HL) | (uint8_t)(1 << bit); \
    tactPlus1WithAddress(HL); \
    writeMemory(HL, value); \
  }

DEFINE_SET_REG_OP(bitC0Set0B, 0, B)
DEFINE_SET_REG_OP(bitC1Set0C, 0, C)
DEFINE_SET_REG_OP(bitC2Set0D, 0, D)
DEFINE_SET_REG_OP(bitC3Set0E, 0, E)
DEFINE_SET_REG_OP(bitC4Set0H, 0, H)
DEFINE_SET_REG_OP(bitC5Set0L, 0, L)
DEFINE_SET_MEM_OP(bitC6Set0MemHl, 0)
DEFINE_SET_REG_OP(bitC7Set0A, 0, A)

DEFINE_SET_REG_OP(bitC8Set1B, 1, B)
DEFINE_SET_REG_OP(bitC9Set1C, 1, C)
DEFINE_SET_REG_OP(bitCaSet1D, 1, D)
DEFINE_SET_REG_OP(bitCbSet1E, 1, E)
DEFINE_SET_REG_OP(bitCcSet1H, 1, H)
DEFINE_SET_REG_OP(bitCdSet1L, 1, L)
DEFINE_SET_MEM_OP(bitCeSet1MemHl, 1)
DEFINE_SET_REG_OP(bitCfSet1A, 1, A)

DEFINE_SET_REG_OP(bitD0Set2B, 2, B)
DEFINE_SET_REG_OP(bitD1Set2C, 2, C)
DEFINE_SET_REG_OP(bitD2Set2D, 2, D)
DEFINE_SET_REG_OP(bitD3Set2E, 2, E)
DEFINE_SET_REG_OP(bitD4Set2H, 2, H)
DEFINE_SET_REG_OP(bitD5Set2L, 2, L)
DEFINE_SET_MEM_OP(bitD6Set2MemHl, 2)
DEFINE_SET_REG_OP(bitD7Set2A, 2, A)

DEFINE_SET_REG_OP(bitD8Set3B, 3, B)
DEFINE_SET_REG_OP(bitD9Set3C, 3, C)
DEFINE_SET_REG_OP(bitDaSet3D, 3, D)
DEFINE_SET_REG_OP(bitDbSet3E, 3, E)
DEFINE_SET_REG_OP(bitDcSet3H, 3, H)
DEFINE_SET_REG_OP(bitDdSet3L, 3, L)
DEFINE_SET_MEM_OP(bitDeSet3MemHl, 3)
DEFINE_SET_REG_OP(bitDfSet3A, 3, A)

DEFINE_SET_REG_OP(bitE0Set4B, 4, B)
DEFINE_SET_REG_OP(bitE1Set4C, 4, C)
DEFINE_SET_REG_OP(bitE2Set4D, 4, D)
DEFINE_SET_REG_OP(bitE3Set4E, 4, E)
DEFINE_SET_REG_OP(bitE4Set4H, 4, H)
DEFINE_SET_REG_OP(bitE5Set4L, 4, L)
DEFINE_SET_MEM_OP(bitE6Set4MemHl, 4)
DEFINE_SET_REG_OP(bitE7Set4A, 4, A)

DEFINE_SET_REG_OP(bitE8Set5B, 5, B)
DEFINE_SET_REG_OP(bitE9Set5C, 5, C)
DEFINE_SET_REG_OP(bitEaSet5D, 5, D)
DEFINE_SET_REG_OP(bitEbSet5E, 5, E)
DEFINE_SET_REG_OP(bitEcSet5H, 5, H)
DEFINE_SET_REG_OP(bitEdSet5L, 5, L)
DEFINE_SET_MEM_OP(bitEeSet5MemHl, 5)
DEFINE_SET_REG_OP(bitEfSet5A, 5, A)

DEFINE_SET_REG_OP(bitF0Set6B, 6, B)
DEFINE_SET_REG_OP(bitF1Set6C, 6, C)
DEFINE_SET_REG_OP(bitF2Set6D, 6, D)
DEFINE_SET_REG_OP(bitF3Set6E, 6, E)
DEFINE_SET_REG_OP(bitF4Set6H, 6, H)
DEFINE_SET_REG_OP(bitF5Set6L, 6, L)
DEFINE_SET_MEM_OP(bitF6Set6MemHl, 6)
DEFINE_SET_REG_OP(bitF7Set6A, 6, A)

DEFINE_SET_REG_OP(bitF8Set7B, 7, B)
DEFINE_SET_REG_OP(bitF9Set7C, 7, C)
DEFINE_SET_REG_OP(bitFaSet7D, 7, D)
DEFINE_SET_REG_OP(bitFbSet7E, 7, E)
DEFINE_SET_REG_OP(bitFcSet7H, 7, H)
DEFINE_SET_REG_OP(bitFdSet7L, 7, L)
DEFINE_SET_MEM_OP(bitFeSet7MemHl, 7)
DEFINE_SET_REG_OP(bitFfSet7A, 7, A)

#undef DEFINE_SET_MEM_OP
#undef DEFINE_SET_REG_OP

// -----------------------------------------------------------------------------
// Jump tables
// -----------------------------------------------------------------------------

static const Z80Operation standardOps[256] = {
    // 0x00-0x0f
    op00Nop, op01LdBcNN, op02LdBcA, op03IncBc, op04IncB, op05DecB, op06LdBN, op07Rlca, op08ExAfAfAlt, op09AddHlBc, op0aLdABc, op0bDecBc, op0cIncC, op0dDecC, op0eLdCN, op0fRrca,
    // 0x10-0x1f
    op10Djnz, op11LdDeNN, op12LdDeA, op13IncDe, op14IncD, op15DecD, op16LdDN, op17Rla, op18Jr, op19AddHlDe, op1aLdADe, op1bDecDe, op1cIncE, op1dDecE, op1eLdEN, op1fRra,
    // 0x20-0x2f
    op20JrNz, op21LdHlNN, op22LdAddrHl, op23IncHl, op24IncH, op25DecH, op26LdHN, op27Daa, op28JrZ, op29AddHlHl, op2aLdHlAddr, op2bDecHl, op2cIncL, op2dDecL, op2eLdLN, op2fCpl,
    // 0x30-0x3f
    op30JrNc, op31LdSpNN, op32LdAddrA, op33IncSp, op34IncHlPtr, op35DecHlPtr, op36LdHlPtrN, op37Scf, op38JrC, op39AddHlSp, op3aLdAAddr, op3bDecSp, op3cIncA, op3dDecA, op3eLdAN, op3fCcf,
    // 0x40-0x4f
    op00Nop, op41LdBC, op42LdBD, op43LdBE, op44LdBH, op45LdBL, op46LdBMemHl, op47LdBA, op48LdCB, op00Nop, op4aLdCD, op4bLdCE, op4cLdCH, op4dLdCL, op4eLdCMemHl, op4fLdCA,
    // 0x50-0x5f
    op50LdDB, op51LdDC, op00Nop, op53LdDE, op54LdDH, op55LdDL, op56LdDMemHl, op57LdDA, op58LdEB, op59LdEC, op5aLdED, op00Nop, op5cLdEH, op5dLdEL, op5eLdEMemHl, op5fLdEA,
    // 0x60-0x6f
    op60LdHB, op61LdHC, op62LdHD, op63LdHE, op00Nop, op65LdHL, op66LdHMemHl, op67LdHA, op68LdLB, op69LdLC, op6aLdLD, op6bLdLE, op6cLdLH, op00Nop, op6eLdLMemHl, op6fLdLA,
    // 0x70-0x7f
    op70LdMemHlB, op71LdMemHlC, op72LdMemHlD, op73LdMemHlE, op74LdMemHlH, op75LdMemHlL, op76Halt, op77LdMemHlA, op78LdAB, op79LdAC, op7aLdAD, op7bLdAE, op7cLdAH, op7dLdAL, op7eLdAMemHl, op00Nop,
    // 0x80-0x8f
    op80AddAB, op81AddAC, op82AddAD, op83AddAE, op84AddAH, op85AddAL, op86AddAMemHl, op87AddAA, op88AdcAB, op89AdcAC, op8aAdcAD, op8bAdcAE, op8cAdcAH, op8dAdcAL, op8eAdcAMemHl, op8fAdcAA,
    // 0x90-0x9f
    op90SubAB, op91SubAC, op92SubAD, op93SubAE, op94SubAH, op95SubAL, op96SubAMemHl, op97SubAA, op98SbcAB, op99SbcAC, op9aSbcAD, op9bSbcAE, op9cSbcAH, op9dSbcAL, op9eSbcAMemHl, op9fSbcAA,
    // 0xa0-0xaf
    opA0AndAB, opA1AndAC, opA2AndAD, opA3AndAE, opA4AndAH, opA5AndAL, opA6AndAMemHl, opA7AndAA, opA8XorAB, opA9XorAC, opAaXorAD, opAbXorAE, opAcXorAH, opAdXorAL, opAeXorAMemHl, opAfXorAA,
    // 0xb0-0xbf
    opB0OrAB, opB1OrAC, opB2OrAD, opB3OrAE, opB4OrAH, opB5OrAL, opB6OrAMemHl, opB7OrAA, opB8CpB, opB9CpC, opBaCpD, opBbCpE, opBcCpH, opBdCpL, opBeCpMemHl, opBfCpA,
    // 0xc0-0xcf
    opC0RetNz, opC1PopBc, opC2JpNz, opC3Jp, opC4CallNz, opC5PushBc, opC6AddAN, opC7Rst00, opC8RetZ, opC9Ret, opCaJpZ, op00Nop, opCcCallZ, opCdCall, opCeAdcAN, opCfRst08,
    // 0xd0-0xdf
    opD0RetNc, opD1PopDe, opD2JpNc, opD3OutNA, opD4CallNc, opD5PushDe, opD6SubAN, opD7Rst10, opD8RetC, opD9Exx, opDaJpC, opDbInAN, opDcCallC, op00Nop, opDeSbcAN, opDfRst18,
    // 0xe0-0xef
    opE0RetPo, opE1PopHl, opE2JpPo, opE3ExSpHl, opE4CallPo, opE5PushHl, opE6AndAN, opE7Rst20, opE8RetPe, opE9JpHl, opEaJpPe, opEbExDeHl, opEcCallPe, op00Nop, opEeXorAN, opEfRst28,
    // 0xf0-0xff
    opF0RetP, opF1PopAf, opF2JpP, opF3Di, opF4CallP, opF5PushAf, opF6OrAN, opF7Rst30, opF8RetM, opF9LdSpHl, opFaJpM, opFbEi, opFcCallM, op00Nop, opFeCpAN, opFfRst38};

#define NOP_ROW \
    op00Nop, op00Nop, op00Nop, op00Nop, op00Nop, op00Nop, op00Nop, op00Nop, \
    op00Nop, op00Nop, op00Nop, op00Nop, op00Nop, op00Nop, op00Nop, op00Nop

static const Z80Operation bitOps[256] = {
    // 0x00-0x0f
    bit00RlcB, bit01RlcC, bit02RlcD, bit03RlcE, bit04RlcH, bit05RlcL, bit06RlcMemHl, bit07RlcA, bit08RrcB, bit09RrcC, bit0aRrcD, bit0bRrcE, bit0cRrcH, bit0dRrcL, bit0eRrcMemHl, bit0fRrcA,
    // 0x10-0x1f
    bit10RlB, bit11RlC, bit12RlD, bit13RlE, bit14RlH, bit15RlL, bit16RlMemHl, bit17RlA, bit18RrB, bit19RrC, bit1aRrD, bit1bRrE, bit1cRrH, bit1dRrL, bit1eRrMemHl, bit1fRrA,
    // 0x20-0x2f
    bit20SlaB, bit21SlaC, bit22SlaD, bit23SlaE, bit24SlaH, bit25SlaL, bit26SlaMemHl, bit27SlaA, bit28SraB, bit29SraC, bit2aSraD, bit2bSraE, bit2cSraH, bit2dSraL, bit2eSraMemHl, bit2fSraA,
    // 0x30-0x3f
    bit30SllB, bit31SllC, bit32SllD, bit33SllE, bit34SllH, bit35SllL, bit36SllMemHl, bit37SllA, bit38SrlB, bit39SrlC, bit3aSrlD, bit3bSrlE, bit3cSrlH, bit3dSrlL, bit3eSrlMemHl, bit3fSrlA,
    // 0x40-0x4f
    bit40Bit0B, bit41Bit0C, bit42Bit0D, bit43Bit0E, bit44Bit0H, bit45Bit0L, bit46Bit0MemHl, bit47Bit0A, bit48Bit1B, bit49Bit1C, bit4aBit1D, bit4bBit1E, bit4cBit1H, bit4dBit1L, bit4eBit1MemHl, bit4fBit1A,
    // 0x50-0x5f
    bit50Bit2B, bit51Bit2C, bit52Bit2D, bit53Bit2E, bit54Bit2H, bit55Bit2L, bit56Bit2MemHl, bit57Bit2A, bit58Bit3B, bit59Bit3C, bit5aBit3D, bit5bBit3E, bit5cBit3H, bit5dBit3L, bit5eBit3MemHl, bit5fBit3A,
    // 0x60-0x6f
    bit60Bit4B, bit61Bit4C, bit62Bit4D, bit63Bit4E, bit64Bit4H, bit65Bit4L, bit66Bit4MemHl, bit67Bit4A, bit68Bit5B, bit69Bit5C, bit6aBit5D, bit6bBit5E, bit6cBit5H, bit6dBit5L, bit6eBit5MemHl, bit6fBit5A,
    // 0x70-0x7f
    bit70Bit6B, bit71Bit6C, bit72Bit6D, bit73Bit6E, bit74Bit6H, bit75Bit6L, bit76Bit6MemHl, bit77Bit6A, bit78Bit7B, bit79Bit7C, bit7aBit7D, bit7bBit7E, bit7cBit7H, bit7dBit7L, bit7eBit7MemHl, bit7fBit7A,
    // 0x80-0x8f
    bit80Res0B, bit81Res0C, bit82Res0D, bit83Res0E, bit84Res0H, bit85Res0L, bit86Res0MemHl, bit87Res0A, bit88Res1B, bit89Res1C, bit8aRes1D, bit8bRes1E, bit8cRes1H, bit8dRes1L, bit8eRes1MemHl, bit8fRes1A,
    // 0x90-0x9f
    bit90Res2B, bit91Res2C, bit92Res2D, bit93Res2E, bit94Res2H, bit95Res2L, bit96Res2MemHl, bit97Res2A, bit98Res3B, bit99Res3C, bit9aRes3D, bit9bRes3E, bit9cRes3H, bit9dRes3L, bit9eRes3MemHl, bit9fRes3A,
    // 0xa0-0xaf
    bitA0Res4B, bitA1Res4C, bitA2Res4D, bitA3Res4E, bitA4Res4H, bitA5Res4L, bitA6Res4MemHl, bitA7Res4A, bitA8Res5B, bitA9Res5C, bitAaRes5D, bitAbRes5E, bitAcRes5H, bitAdRes5L, bitAeRes5MemHl, bitAfRes5A,
    // 0xb0-0xbf
    bitB0Res6B, bitB1Res6C, bitB2Res6D, bitB3Res6E, bitB4Res6H, bitB5Res6L, bitB6Res6MemHl, bitB7Res6A, bitB8Res7B, bitB9Res7C, bitBaRes7D, bitBbRes7E, bitBcRes7H, bitBdRes7L, bitBeRes7MemHl, bitBfRes7A,
    // 0xc0-0xcf
    bitC0Set0B, bitC1Set0C, bitC2Set0D, bitC3Set0E, bitC4Set0H, bitC5Set0L, bitC6Set0MemHl, bitC7Set0A, bitC8Set1B, bitC9Set1C, bitCaSet1D, bitCbSet1E, bitCcSet1H, bitCdSet1L, bitCeSet1MemHl, bitCfSet1A,
    // 0xd0-0xdf
    bitD0Set2B, bitD1Set2C, bitD2Set2D, bitD3Set2E, bitD4Set2H, bitD5Set2L, bitD6Set2MemHl, bitD7Set2A, bitD8Set3B, bitD9Set3C, bitDaSet3D, bitDbSet3E, bitDcSet3H, bitDdSet3L, bitDeSet3MemHl, bitDfSet3A,
    // 0xe0-0xef
    bitE0Set4B, bitE1Set4C, bitE2Set4D, bitE3Set4E, bitE4Set4H, bitE5Set4L, bitE6Set4MemHl, bitE7Set4A, bitE8Set5B, bitE9Set5C, bitEaSet5D, bitEbSet5E, bitEcSet5H, bitEdSet5L, bitEeSet5MemHl, bitEfSet5A,
    // 0xf0-0xff
    bitF0Set6B, bitF1Set6C, bitF2Set6D, bitF3Set6E, bitF4Set6H, bitF5Set6L, bitF6Set6MemHl, bitF7Set6A, bitF8Set7B, bitF9Set7C, bitFaSet7D, bitFbSet7E, bitFcSet7H, bitFdSet7L, bitFeSet7MemHl, bitFfSet7A};

static const Z80Operation extendedOps[256] = {
    // 0x00-0x0f
    NOP_ROW,
    // 0x10-0x1f
    NOP_ROW,
    // 0x20-0x2f
    NOP_ROW,
    // 0x30-0x3f
    NOP_ROW,
    // 0x40-0x4f
    ext40InBC, ext41OutCB, ext42SbcHlBc, ext43LdAddrBc, ext44Neg, ext45Retn, ext46Im0, ext47LdIA, ext48InCC, ext49OutCC, ext4aAdcHlBc, ext4bLdBcAddr, ext44Neg, ext45Retn, ext46Im0, ext4fLdRA,
    // 0x50-0x5f
    ext50InDC, ext51OutCD, ext52SbcHlDe, ext53LdAddrDe, ext44Neg, ext45Retn, ext56Im1, ext57LdAI, ext58InEC, ext59OutCE, ext5aAdcHlDe, ext5bLdDeAddr, ext44Neg, ext45Retn, ext5eIm2, ext5fLdAR,
    // 0x60-0x6f
    ext60InHC, ext61OutCH, ext62SbcHlHl, ext63LdAddrHl, ext44Neg, ext45Retn, ext46Im0, ext67Rrd, ext68InLC, ext69OutCL, ext6aAdcHlHl, ext6bLdHlAddr, ext44Neg, ext45Retn, ext46Im0, ext6fRld,
    // 0x70-0x7f
    ext70InC, ext71OutC0, ext72SbcHlSp, ext73LdAddrSp, ext44Neg, ext45Retn, ext56Im1, op00Nop, ext78InAC, ext79OutCA, ext7aAdcHlSp, ext7bLdSpAddr, ext44Neg, ext45Retn, ext5eIm2, op00Nop,
    // 0x80-0x8f
    NOP_ROW,
    // 0x90-0x9f
    NOP_ROW,
    // 0xa0-0xaf
    extA0Ldi, extA1Cpi, extA2Ini, extA3Outi, op00Nop, op00Nop, op00Nop, op00Nop, extA8Ldd, extA9Cpd, extAaInd, extAbOutd, op00Nop, op00Nop, op00Nop, op00Nop,
    // 0xb0-0xbf
    extB0Ldir, extB1Cpir, extB2Inir, extB3Otir, op00Nop, op00Nop, op00Nop, op00Nop, extB8Lddr, extB9Cpdr, extBaIndr, extBbOtdr, op00Nop, op00Nop, op00Nop, op00Nop,
    // 0xc0-0xcf
    NOP_ROW,
    // 0xd0-0xdf
    NOP_ROW,
    // 0xe0-0xef
    NOP_ROW,
    // 0xf0-0xff
    NOP_ROW};

static inline Z80Operation getExtendedOperation(void) {
  if (!cpu.z80nMode) return extendedOps[cpu.opCode];

  switch (cpu.opCode) {
    case 0x23: return z80n23Swapnib;
    case 0x24: return z80n24MirrorA;
    case 0x27: return z80n27TestN;
    case 0x28: return z80n28Bsla;
    case 0x29: return z80n29Bsra;
    case 0x2a: return z80n2aBsrl;
    case 0x2b: return z80n2bBsrf;
    case 0x2c: return z80n2cBrlc;
    case 0x30: return z80n30MulDE;
    case 0x31: return z80n31AddHLA;
    case 0x32: return z80n32AddDEA;
    case 0x33: return z80n33AddBCA;
    case 0x34: return z80n34AddHLNN;
    case 0x35: return z80n35AddDENN;
    case 0x36: return z80n36AddBCNN;
    case 0x8a: return z80n8aPushNN;
    case 0x90: return z80n90Outinb;
    case 0x91: return z80n91NextregN;
    case 0x92: return z80n92NextregA;
    case 0x93: return z80n93Pixeldn;
    case 0x94: return z80n94Pixelad;
    case 0x95: return z80n95Setae;
    case 0x98: return z80n98JpC;
    case 0xa4: return z80nA4Ldix;
    case 0xa5: return z80nA5Ldws;
    case 0xac: return z80nAcLddx;
    case 0xb4: return z80nB4Ldirx;
    case 0xb7: return z80nB7Ldpirx;
    case 0xbc: return z80nBcLddrx;
    default: return extendedOps[cpu.opCode];
  }
}

static const Z80Operation indexedOps[256] = {
    // 0x00-0x0f
    op00Nop, op01LdBcNN, op02LdBcA, op03IncBc, op04IncB, op05DecB, op06LdBN, op07Rlca, op08ExAfAfAlt, idx09AddXBc, op0aLdABc, op0bDecBc, op0cIncC, op0dDecC, op0eLdCN, op0fRrca,
    // 0x10-0x1f
    op10Djnz, op11LdDeNN, op12LdDeA, op13IncDe, op14IncD, op15DecD, op16LdDN, op17Rla, op18Jr, idx19AddXDe, op1aLdADe, op1bDecDe, op1cIncE, op1dDecE, op1eLdEN, op1fRra,
    // 0x20-0x2f
    op20JrNz, idx21LdXNN, idx22LdAddrX, idx23IncX, idx24IncXh, idx25DecXh, idx26LdXhN, op27Daa, op28JrZ, idx29AddXX, idx2aLdXAddr, idx2bDecX, idx2cIncXl, idx2dDecXl, idx2eLdXlN, op2fCpl,
    // 0x30-0x3f
    op30JrNc, op31LdSpNN, op32LdAddrA, op33IncSp, idx34IncXPtr, idx35DecXPtr, idx36LdXPtrN, op37Scf, op38JrC, idx39AddXSp, op3aLdAAddr, op3bDecSp, op3cIncA, op3dDecA, op3eLdAN, op3fCcf,
    // 0x40-0x4f
    op00Nop, op41LdBC, op42LdBD, op43LdBE, idx44LdBXh, idx45LdBXl, idx46LdBXPtr, op47LdBA, op48LdCB, op00Nop, op4aLdCD, op4bLdCE, idx4cLdCXh, idx4dLdCXl, idx4eLdCXPtr, op4fLdCA,
    // 0x50-0x5f
    op50LdDB, op51LdDC, op00Nop, op53LdDE, idx54LdDXh, idx55LdDXl, idx56LdDXPtr, op57LdDA, op58LdEB, op59LdEC, op5aLdED, op00Nop, idx5cLdEXh, idx5dLdEXl, idx5eLdEXPtr, op5fLdEA,
    // 0x60-0x6f
    idx60LdXhB, idx61LdXhC, idx62LdXhD, idx63LdXhE, op00Nop, idx65LdXhXl, idx66LdHXPtr, idx67LdXhA, idx68LdXlB, idx69LdXlC, idx6aLdXlD, idx6bLdXlE, idx6cLdXlXh, op00Nop, idx6eLdLXPtr, idx6fLdXlA,
    // 0x70-0x7f
    idx70LdXPtrB, idx71LdXPtrC, idx72LdXPtrD, idx73LdXPtrE, idx74LdXPtrH, idx75LdXPtrL, op76Halt, idx77LdXPtrA, op78LdAB, op79LdAC, op7aLdAD, op7bLdAE, idx7cLdAXh, idx7dLdAXl, idx7eLdAXPtr, op00Nop,
    // 0x80-0x8f
    op80AddAB, op81AddAC, op82AddAD, op83AddAE, idx84AddAXh, idx85AddAXl, idx86AddAXPtr, op87AddAA, op88AdcAB, op89AdcAC, op8aAdcAD, op8bAdcAE, idx8cAdcAXh, idx8dAdcAXl, idx8eAdcAXPtr, op8fAdcAA,
    // 0x90-0x9f
    op90SubAB, op91SubAC, op92SubAD, op93SubAE, idx94SubAXh, idx95SubAXl, idx96SubAXPtr, op97SubAA, op98SbcAB, op99SbcAC, op9aSbcAD, op9bSbcAE, idx9cSbcAXh, idx9dSbcAXl, idx9eSbcAXPtr, op9fSbcAA,
    // 0xa0-0xaf
    opA0AndAB, opA1AndAC, opA2AndAD, opA3AndAE, idxA4AndAXh, idxA5AndAXl, idxA6AndAXPtr, opA7AndAA, opA8XorAB, opA9XorAC, opAaXorAD, opAbXorAE, idxAcXorAXh, idxAdXorAXl, idxAeXorAXPtr, opAfXorAA,
    // 0xb0-0xbf
    opB0OrAB, opB1OrAC, opB2OrAD, opB3OrAE, idxB4OrAXh, idxB5OrAXl, idxB6OrAXPtr, opB7OrAA, opB8CpB, opB9CpC, opBaCpD, opBbCpE, idxBcCpXh, idxBdCpXl, idxBeCpXPtr, opBfCpA,
    // 0xc0-0xcf
    opC0RetNz, opC1PopBc, opC2JpNz, opC3Jp, opC4CallNz, opC5PushBc, opC6AddAN, opC7Rst00, opC8RetZ, opC9Ret, opCaJpZ, op00Nop, opCcCallZ, opCdCall, opCeAdcAN, opCfRst08,
    // 0xd0-0xdf
    opD0RetNc, opD1PopDe, opD2JpNc, opD3OutNA, opD4CallNc, opD5PushDe, opD6SubAN, opD7Rst10, opD8RetC, opD9Exx, opDaJpC, opDbInAN, opDcCallC, op00Nop, opDeSbcAN, opDfRst18,
    // 0xe0-0xef
    opE0RetPo, idxE1PopX, opE2JpPo, idxE3ExSpX, opE4CallPo, idxE5PushX, opE6AndAN, opE7Rst20, opE8RetPe, idxE9JpX, opEaJpPe, opEbExDeHl, opEcCallPe, op00Nop, opEeXorAN, opEfRst28,
    // 0xf0-0xff
    opF0RetP, opF1PopAf, opF2JpP, opF3Di, opF4CallP, opF5PushAf, opF6OrAN, opF7Rst30, opF8RetM, idxF9LdSpX, opFaJpM, opFbEi, opFcCallM, op00Nop, opFeCpAN, opFfRst38};

static const Z80Operation indexedBitOps[256] = {
    // 0x00-0x0f
    xbit00RlcB, xbit01RlcC, xbit02RlcD, xbit03RlcE, xbit04RlcH, xbit05RlcL, xbit06Rlc, xbit07RlcA, xbit08RrcB, xbit09RrcC, xbit0aRrcD, xbit0bRrcE, xbit0cRrcH, xbit0dRrcL, xbit0eRrc, xbit0fRrcA,
    // 0x10-0x1f
    xbit10RlB, xbit11RlC, xbit12RlD, xbit13RlE, xbit14RlH, xbit15RlL, xbit16Rl, xbit17RlA, xbit18RrB, xbit19RrC, xbit1aRrD, xbit1bRrE, xbit1cRrH, xbit1dRrL, xbit1eRr, xbit1fRrA,
    // 0x20-0x2f
    xbit20SlaB, xbit21SlaC, xbit22SlaD, xbit23SlaE, xbit24SlaH, xbit25SlaL, xbit26Sla, xbit27SlaA, xbit28SraB, xbit29SraC, xbit2aSraD, xbit2bSraE, xbit2cSraH, xbit2dSraL, xbit2eSra, xbit2fSraA,
    // 0x30-0x3f
    xbit30SllB, xbit31SllC, xbit32SllD, xbit33SllE, xbit34SllH, xbit35SllL, xbit36Sll, xbit37SllA, xbit38SrlB, xbit39SrlC, xbit3aSrlD, xbit3bSrlE, xbit3cSrlH, xbit3dSrlL, xbit3eSrl, xbit3fSrlA,
    // 0x40-0x4f
    xbit40Bit0, xbit40Bit0, xbit40Bit0, xbit40Bit0, xbit40Bit0, xbit40Bit0, xbit40Bit0, xbit40Bit0, xbit48Bit1, xbit48Bit1, xbit48Bit1, xbit48Bit1, xbit48Bit1, xbit48Bit1, xbit48Bit1, xbit48Bit1,
    // 0x50-0x5f
    xbit50Bit2, xbit50Bit2, xbit50Bit2, xbit50Bit2, xbit50Bit2, xbit50Bit2, xbit50Bit2, xbit50Bit2, xbit58Bit3, xbit58Bit3, xbit58Bit3, xbit58Bit3, xbit58Bit3, xbit58Bit3, xbit58Bit3, xbit58Bit3,
    // 0x60-0x6f
    xbit60Bit4, xbit60Bit4, xbit60Bit4, xbit60Bit4, xbit60Bit4, xbit60Bit4, xbit60Bit4, xbit60Bit4, xbit68Bit5, xbit68Bit5, xbit68Bit5, xbit68Bit5, xbit68Bit5, xbit68Bit5, xbit68Bit5, xbit68Bit5,
    // 0x70-0x7f
    xbit70Bit6, xbit70Bit6, xbit70Bit6, xbit70Bit6, xbit70Bit6, xbit70Bit6, xbit70Bit6, xbit70Bit6, xbit78Bit7, xbit78Bit7, xbit78Bit7, xbit78Bit7, xbit78Bit7, xbit78Bit7, xbit78Bit7, xbit78Bit7,
    // 0x80-0x8f
    xbit80Res0B, xbit81Res0C, xbit82Res0D, xbit83Res0E, xbit84Res0H, xbit85Res0L, xbit86Res0, xbit87Res0A, xbit88Res1B, xbit89Res1C, xbit8aRes1D, xbit8bRes1E, xbit8cRes1H, xbit8dRes1L, xbit8eRes1, xbit8fRes1A,
    // 0x90-0x9f
    xbit90Res2B, xbit91Res2C, xbit92Res2D, xbit93Res2E, xbit94Res2H, xbit95Res2L, xbit96Res2, xbit97Res2A, xbit98Res3B, xbit99Res3C, xbit9aRes3D, xbit9bRes3E, xbit9cRes3H, xbit9dRes3L, xbit9eRes3, xbit9fRes3A,
    // 0xa0-0xaf
    xbitA0Res4B, xbitA1Res4C, xbitA2Res4D, xbitA3Res4E, xbitA4Res4H, xbitA5Res4L, xbitA6Res4, xbitA7Res4A, xbitA8Res5B, xbitA9Res5C, xbitAaRes5D, xbitAbRes5E, xbitAcRes5H, xbitAdRes5L, xbitAeRes5, xbitAfRes5A,
    // 0xb0-0xbf
    xbitB0Res6B, xbitB1Res6C, xbitB2Res6D, xbitB3Res6E, xbitB4Res6H, xbitB5Res6L, xbitB6Res6, xbitB7Res6A, xbitB8Res7B, xbitB9Res7C, xbitBaRes7D, xbitBbRes7E, xbitBcRes7H, xbitBdRes7L, xbitBeRes7, xbitBfRes7A,
    // 0xc0-0xcf
    xbitC0Set0B, xbitC1Set0C, xbitC2Set0D, xbitC3Set0E, xbitC4Set0H, xbitC5Set0L, xbitC6Set0, xbitC7Set0A, xbitC8Set1B, xbitC9Set1C, xbitCaSet1D, xbitCbSet1E, xbitCcSet1H, xbitCdSet1L, xbitCeSet1, xbitCfSet1A,
    // 0xd0-0xdf
    xbitD0Set2B, xbitD1Set2C, xbitD2Set2D, xbitD3Set2E, xbitD4Set2H, xbitD5Set2L, xbitD6Set2, xbitD7Set2A, xbitD8Set3B, xbitD9Set3C, xbitDaSet3D, xbitDbSet3E, xbitDcSet3H, xbitDdSet3L, xbitDeSet3, xbitDfSet3A,
    // 0xe0-0xef
    xbitE0Set4B, xbitE1Set4C, xbitE2Set4D, xbitE3Set4E, xbitE4Set4H, xbitE5Set4L, xbitE6Set4, xbitE7Set4A, xbitE8Set5B, xbitE9Set5C, xbitEaSet5D, xbitEbSet5E, xbitEcSet5H, xbitEdSet5L, xbitEeSet5, xbitEfSet5A,
    // 0xf0-0xff
    xbitF0Set6B, xbitF1Set6C, xbitF2Set6D, xbitF3Set6E, xbitF4Set6H, xbitF5Set6L, xbitF6Set6, xbitF7Set6A, xbitF8Set7B, xbitF9Set7C, xbitFaSet7D, xbitFbSet7E, xbitFcSet7H, xbitFdSet7L, xbitFeSet7, xbitFfSet7A};

// -----------------------------------------------------------------------------
// CPU execution
// -----------------------------------------------------------------------------

void z80ExecuteCpuCycle(void) {
  cpu.retExecuted = 0;
  cpu.retnExecuted = 0;

  if (cpu.eiBacklog > 0) {
    cpu.eiBacklog--;
  }

  if (cpu.sigRst) {
    uint8_t z80nMode = cpu.z80nMode;
    z80Reset();
    cpu.z80nMode = z80nMode;
    cpu.sigRst = 0;
    return;
  }

  if (cpu.sigNmi && cpu.prefix == PREFIX_NONE) {
    processNmi();
    return;
  }

  if (cpu.sigInt && cpu.prefix == PREFIX_NONE && cpu.iff1 && cpu.eiBacklog == 0) {
    processInt();
    return;
  }

  cpu.afterLdAIR = 0;

  if (cpu.halted) {
    delayMemoryRead(cpu.pc);
    refreshMemory();
    tactPlus1WithAddress(IR);
    return;
  }

  uint8_t m1Active = cpu.prefix == PREFIX_NONE;
  cpu.opCode = readMemory(cpu.pc);
  if (m1Active) {
    refreshMemory();
    tactPlus1WithAddress(IR);
  }
  cpu.pc = (uint16_t)(cpu.pc + 1);

  switch (cpu.prefix) {
    case PREFIX_NONE:
      switch (cpu.opCode) {
        case 0xcb:
          cpu.prefix = PREFIX_CB;
          break;
        case 0xed:
          cpu.prefix = PREFIX_ED;
          break;
        case 0xdd:
          cpu.prefix = PREFIX_DD;
          break;
        case 0xfd:
          cpu.prefix = PREFIX_FD;
          break;
        default:
          standardOps[cpu.opCode]();
          cpu.prefix = PREFIX_NONE;
          break;
      }
      break;

    case PREFIX_CB:
      bitOps[cpu.opCode]();
      tactPlusN(1);
      cpu.prefix = PREFIX_NONE;
      break;

    case PREFIX_ED:
      getExtendedOperation()();
      tactPlusN(1);
      cpu.prefix = PREFIX_NONE;
      break;

    case PREFIX_DD:
    case PREFIX_FD:
      if (cpu.opCode == 0xdd) {
        cpu.prefix = PREFIX_DD;
      } else if (cpu.opCode == 0xfd) {
        cpu.prefix = PREFIX_FD;
      } else if (cpu.opCode == 0xcb) {
        cpu.prefix = cpu.prefix == PREFIX_DD ? PREFIX_DDCB : PREFIX_FDCB;
      } else {
        indexedOps[cpu.opCode]();
        tactPlusN(1);
        cpu.prefix = PREFIX_NONE;
      }
      break;

    case PREFIX_DDCB:
    case PREFIX_FDCB:
      WZ = (uint16_t)(activeIndexPair()->word + sbyte(cpu.opCode));
      cpu.opCode = readMemory(cpu.pc);
      tactPlus2WithAddress(cpu.pc);
      cpu.pc = (uint16_t)(cpu.pc + 1);
      indexedBitOps[cpu.opCode]();
      tactPlusN(1);
      cpu.prefix = PREFIX_NONE;
      break;
  }
}

// -----------------------------------------------------------------------------
// Exported state accessors
// -----------------------------------------------------------------------------

uint32_t z80GetTacts(void) { return cpu.tacts; }
void z80SetTacts(uint32_t value) { cpu.tacts = value; }

uint32_t z80GetAf(void) { return AF; }
void z80SetAf(uint32_t value) { AF = (uint16_t)value; }
uint32_t z80GetBc(void) { return BC; }
void z80SetBc(uint32_t value) { BC = (uint16_t)value; }
uint32_t z80GetDe(void) { return DE; }
void z80SetDe(uint32_t value) { DE = (uint16_t)value; }
uint32_t z80GetHl(void) { return HL; }
void z80SetHl(uint32_t value) { HL = (uint16_t)value; }
uint32_t z80GetAfAlt(void) { return AF_ALT; }
void z80SetAfAlt(uint32_t value) { AF_ALT = (uint16_t)value; }
uint32_t z80GetBcAlt(void) { return BC_ALT; }
void z80SetBcAlt(uint32_t value) { BC_ALT = (uint16_t)value; }
uint32_t z80GetDeAlt(void) { return DE_ALT; }
void z80SetDeAlt(uint32_t value) { DE_ALT = (uint16_t)value; }
uint32_t z80GetHlAlt(void) { return HL_ALT; }
void z80SetHlAlt(uint32_t value) { HL_ALT = (uint16_t)value; }
uint32_t z80GetIx(void) { return IX; }
void z80SetIx(uint32_t value) { IX = (uint16_t)value; }
uint32_t z80GetIy(void) { return IY; }
void z80SetIy(uint32_t value) { IY = (uint16_t)value; }
uint32_t z80GetIr(void) { return IR; }
void z80SetIr(uint32_t value) { IR = (uint16_t)value; }
uint32_t z80GetWz(void) { return WZ; }
void z80SetWz(uint32_t value) { WZ = (uint16_t)value; }
uint32_t z80GetPc(void) { return cpu.pc; }
void z80SetPc(uint32_t value) { cpu.pc = (uint16_t)value; }
uint32_t z80GetSp(void) { return cpu.sp; }
void z80SetSp(uint32_t value) { cpu.sp = (uint16_t)value; }
uint32_t z80GetPrefix(void) { return cpu.prefix; }
uint32_t z80GetHalted(void) { return cpu.halted; }
uint32_t z80GetZ80NMode(void) { return cpu.z80nMode; }
void z80SetZ80NMode(uint32_t value) { cpu.z80nMode = value != 0; }

uint32_t z80GetSigInt(void) { return cpu.sigInt; }
void z80SetSigInt(uint32_t value) { cpu.sigInt = value != 0; }
uint32_t z80GetSigNmi(void) { return cpu.sigNmi; }
void z80SetSigNmi(uint32_t value) { cpu.sigNmi = value != 0; }
uint32_t z80GetSigRst(void) { return cpu.sigRst; }
void z80SetSigRst(uint32_t value) { cpu.sigRst = value != 0; }
uint32_t z80GetInterruptMode(void) { return cpu.interruptMode; }
void z80SetInterruptMode(uint32_t value) { cpu.interruptMode = (uint8_t)(value & 0x03); }
void z80SetInterruptVector(uint32_t value) { cpu.interruptVector = (uint8_t)value; }
uint32_t z80GetIff1(void) { return cpu.iff1; }
void z80SetIff1(uint32_t value) { cpu.iff1 = value != 0; }
uint32_t z80GetIff2(void) { return cpu.iff2; }
void z80SetIff2(uint32_t value) { cpu.iff2 = value != 0; }
uint32_t z80GetEiBacklog(void) { return cpu.eiBacklog; }
void z80SetEiBacklog(uint32_t value) { cpu.eiBacklog = (uint8_t)value; }
uint32_t z80GetRetExecuted(void) { return cpu.retExecuted; }
void z80SetRetExecuted(uint32_t value) { cpu.retExecuted = value != 0; }
uint32_t z80GetRetnExecuted(void) { return cpu.retnExecuted; }
void z80SetRetnExecuted(uint32_t value) { cpu.retnExecuted = value != 0; }
void z80TactPlusN(uint32_t value) { tactPlusN(value); }

uint32_t z80PeekMemory(uint32_t address) { return memory[address & 0xffff]; }
void z80PokeMemory(uint32_t address, uint32_t value) { memory[address & 0xffff] = (uint8_t)value; }
uint32_t z80GetLastMemAddress(void) { return 0; }
uint32_t z80GetLastMemValue(void) { return 0; }
uint32_t z80GetLastMemIsWrite(void) { return 0; }
uint32_t z80GetLastPortAddress(void) { return cpu.hasPortEvent ? cpu.lastPortAddress : 0; }
uint32_t z80GetLastPortValue(void) { return cpu.hasPortEvent ? cpu.lastPortValue : 0; }
uint32_t z80GetLastPortIsWrite(void) { return cpu.hasPortEvent ? cpu.lastPortIsWrite : 0; }
void z80SetPortReadValue(uint32_t value) { cpu.portReadValue = (uint8_t)value; }
uint32_t z80GetLastTbBlueAddress(void) { return cpu.hasTbBlueEvent ? cpu.lastTbBlueAddress : 0; }
uint32_t z80GetLastTbBlueValue(void) { return cpu.hasTbBlueEvent ? cpu.lastTbBlueValue : 0; }
uint32_t z80GetLastTbBlueIsWrite(void) { return cpu.hasTbBlueEvent; }
void z80ClearBusEvents(void) {
  cpu.hasPortEvent = 0;
  cpu.hasTbBlueEvent = 0;
}
