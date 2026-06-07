#include <stdint.h>

#define FLAG_S  0x80
#define FLAG_Z  0x40
#define FLAG_R5 0x20
#define FLAG_H  0x10
#define FLAG_R3 0x08
#define FLAG_PV 0x04
#define FLAG_N  0x02
#define FLAG_C  0x01

typedef struct Z80State {
  uint16_t af;
  uint16_t bc;
  uint16_t de;
  uint16_t hl;
  uint16_t af_alt;
  uint16_t bc_alt;
  uint16_t de_alt;
  uint16_t hl_alt;
  uint16_t ix;
  uint16_t iy;
  uint16_t ir;
  uint16_t wz;
  uint16_t pc;
  uint16_t sp;
  uint32_t tacts;
  uint8_t halted;
  uint8_t prefix;
  uint8_t op_code;
} Z80State;

static Z80State cpu;
static uint8_t memory[0x10000];

static uint8_t hi(uint16_t value) { return (uint8_t)(value >> 8); }
static uint8_t lo(uint16_t value) { return (uint8_t)value; }
static uint16_t pair(uint8_t high, uint8_t low) { return ((uint16_t)high << 8) | low; }

static uint8_t get_a(void) { return hi(cpu.af); }
static uint8_t get_f(void) { return lo(cpu.af); }
static uint8_t get_b(void) { return hi(cpu.bc); }
static uint8_t get_c(void) { return lo(cpu.bc); }

static void set_a(uint8_t value) { cpu.af = pair(value, get_f()); }
static void set_f(uint8_t value) { cpu.af = pair(get_a(), value); }
static void set_b(uint8_t value) { cpu.bc = pair(value, get_c()); }
static void set_c(uint8_t value) { cpu.bc = pair(get_b(), value); }

static uint8_t read_u8(void) {
  uint8_t value = memory[cpu.pc];
  cpu.pc = (uint16_t)(cpu.pc + 1);
  return value;
}

static uint16_t read_u16_le(void) {
  uint8_t low = read_u8();
  uint8_t high = read_u8();
  return pair(high, low);
}

static uint8_t inc8(uint8_t value) {
  uint8_t result = (uint8_t)(value + 1);
  uint8_t flags = get_f() & FLAG_C;

  if (result & 0x80) flags |= FLAG_S;
  if (result == 0) flags |= FLAG_Z;
  if ((value & 0x0f) == 0x0f) flags |= FLAG_H;
  if (value == 0x7f) flags |= FLAG_PV;
  flags |= result & (FLAG_R5 | FLAG_R3);
  set_f(flags);
  return result;
}

static uint8_t dec8(uint8_t value) {
  uint8_t result = (uint8_t)(value - 1);
  uint8_t flags = (get_f() & FLAG_C) | FLAG_N;

  if (result & 0x80) flags |= FLAG_S;
  if (result == 0) flags |= FLAG_Z;
  if ((value & 0x0f) == 0x00) flags |= FLAG_H;
  if (value == 0x80) flags |= FLAG_PV;
  flags |= result & (FLAG_R5 | FLAG_R3);
  set_f(flags);
  return result;
}

static void add_hl(uint16_t value) {
  uint32_t result = (uint32_t)cpu.hl + value;
  uint8_t flags = get_f() & (FLAG_S | FLAG_Z | FLAG_PV);

  if (((cpu.hl & 0x0fff) + (value & 0x0fff)) > 0x0fff) flags |= FLAG_H;
  if (result > 0xffff) flags |= FLAG_C;
  cpu.hl = (uint16_t)result;
  flags |= hi(cpu.hl) & (FLAG_R5 | FLAG_R3);
  set_f(flags);
  cpu.tacts += 11;
}

void z80_reset(void) {
  cpu.af = 0xffff;
  cpu.bc = 0x0000;
  cpu.de = 0x0000;
  cpu.hl = 0x0000;
  cpu.af_alt = 0xffff;
  cpu.bc_alt = 0x0000;
  cpu.de_alt = 0x0000;
  cpu.hl_alt = 0x0000;
  cpu.ix = 0x0000;
  cpu.iy = 0x0000;
  cpu.ir = 0x0000;
  cpu.wz = 0x0000;
  cpu.pc = 0x0000;
  cpu.sp = 0xffff;
  cpu.tacts = 0;
  cpu.halted = 0;
  cpu.prefix = 0;
  cpu.op_code = 0;
}

uint8_t *z80_memory_ptr(void) {
  return memory;
}

void z80_execute_cpu_cycle(void) {
  if (cpu.halted) {
    cpu.tacts += 4;
    return;
  }

  cpu.op_code = read_u8();

  switch (cpu.op_code) {
    case 0x00:
      cpu.tacts += 4;
      break;
    case 0x01:
      cpu.bc = read_u16_le();
      cpu.tacts += 10;
      break;
    case 0x02:
      memory[cpu.bc] = get_a();
      cpu.wz = pair(get_a(), lo((uint16_t)(cpu.bc + 1)));
      cpu.tacts += 7;
      break;
    case 0x03:
      cpu.bc = (uint16_t)(cpu.bc + 1);
      cpu.tacts += 6;
      break;
    case 0x04:
      set_b(inc8(get_b()));
      cpu.tacts += 4;
      break;
    case 0x05:
      set_b(dec8(get_b()));
      cpu.tacts += 4;
      break;
    case 0x06:
      set_b(read_u8());
      cpu.tacts += 7;
      break;
    case 0x07: {
      uint8_t a = get_a();
      uint8_t carry = (a & 0x80) ? FLAG_C : 0;
      set_a((uint8_t)((a << 1) | (a >> 7)));
      set_f((get_f() & (FLAG_S | FLAG_Z | FLAG_PV)) | (get_a() & (FLAG_R5 | FLAG_R3)) | carry);
      cpu.tacts += 4;
      break;
    }
    case 0x08: {
      uint16_t old_af = cpu.af;
      cpu.af = cpu.af_alt;
      cpu.af_alt = old_af;
      cpu.tacts += 4;
      break;
    }
    case 0x09:
      add_hl(cpu.bc);
      break;
    case 0x0a:
      set_a(memory[cpu.bc]);
      cpu.wz = (uint16_t)(cpu.bc + 1);
      cpu.tacts += 7;
      break;
    case 0x0b:
      cpu.bc = (uint16_t)(cpu.bc - 1);
      cpu.tacts += 6;
      break;
    case 0x0c:
      set_c(inc8(get_c()));
      cpu.tacts += 4;
      break;
    case 0x0d:
      set_c(dec8(get_c()));
      cpu.tacts += 4;
      break;
    case 0x0e:
      set_c(read_u8());
      cpu.tacts += 7;
      break;
    case 0x0f: {
      uint8_t a = get_a();
      uint8_t carry = (a & 0x01) ? FLAG_C : 0;
      set_a((uint8_t)((a >> 1) | (a << 7)));
      set_f((get_f() & (FLAG_S | FLAG_Z | FLAG_PV)) | (get_a() & (FLAG_R5 | FLAG_R3)) | carry);
      cpu.tacts += 4;
      break;
    }
    case 0x21:
      cpu.hl = read_u16_le();
      cpu.tacts += 10;
      break;
    case 0x3e:
      set_a(read_u8());
      cpu.tacts += 7;
      break;
    case 0x76:
      cpu.halted = 1;
      cpu.tacts += 4;
      break;
    default:
      cpu.halted = 1;
      cpu.tacts += 4;
      break;
  }
}

uint32_t z80_get_tacts(void) { return cpu.tacts; }
void z80_set_tacts(uint32_t value) { cpu.tacts = value; }

uint32_t z80_get_af(void) { return cpu.af; }
void z80_set_af(uint32_t value) { cpu.af = (uint16_t)value; }
uint32_t z80_get_bc(void) { return cpu.bc; }
void z80_set_bc(uint32_t value) { cpu.bc = (uint16_t)value; }
uint32_t z80_get_de(void) { return cpu.de; }
void z80_set_de(uint32_t value) { cpu.de = (uint16_t)value; }
uint32_t z80_get_hl(void) { return cpu.hl; }
void z80_set_hl(uint32_t value) { cpu.hl = (uint16_t)value; }
uint32_t z80_get_af_alt(void) { return cpu.af_alt; }
void z80_set_af_alt(uint32_t value) { cpu.af_alt = (uint16_t)value; }
uint32_t z80_get_bc_alt(void) { return cpu.bc_alt; }
void z80_set_bc_alt(uint32_t value) { cpu.bc_alt = (uint16_t)value; }
uint32_t z80_get_de_alt(void) { return cpu.de_alt; }
void z80_set_de_alt(uint32_t value) { cpu.de_alt = (uint16_t)value; }
uint32_t z80_get_hl_alt(void) { return cpu.hl_alt; }
void z80_set_hl_alt(uint32_t value) { cpu.hl_alt = (uint16_t)value; }
uint32_t z80_get_ix(void) { return cpu.ix; }
void z80_set_ix(uint32_t value) { cpu.ix = (uint16_t)value; }
uint32_t z80_get_iy(void) { return cpu.iy; }
void z80_set_iy(uint32_t value) { cpu.iy = (uint16_t)value; }
uint32_t z80_get_ir(void) { return cpu.ir; }
void z80_set_ir(uint32_t value) { cpu.ir = (uint16_t)value; }
uint32_t z80_get_wz(void) { return cpu.wz; }
void z80_set_wz(uint32_t value) { cpu.wz = (uint16_t)value; }
uint32_t z80_get_pc(void) { return cpu.pc; }
void z80_set_pc(uint32_t value) { cpu.pc = (uint16_t)value; }
uint32_t z80_get_sp(void) { return cpu.sp; }
void z80_set_sp(uint32_t value) { cpu.sp = (uint16_t)value; }
uint32_t z80_get_prefix(void) { return cpu.prefix; }
uint32_t z80_get_halted(void) { return cpu.halted; }
