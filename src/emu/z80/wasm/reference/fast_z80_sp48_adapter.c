#include <stdint.h>

static void sp48_fast_z80_advance_frame_tacts(uint32_t tacts);
static void sp48_fast_z80_delay_memory_read(uint16_t address);
static void sp48_fast_z80_delay_memory_write(uint16_t address);
static void sp48_fast_z80_delay_port_read(uint16_t address);
static void sp48_fast_z80_delay_port_write(uint16_t address);
static uint8_t sp48_fast_z80_read_memory(uint16_t address);
static void sp48_fast_z80_write_memory(uint16_t address, uint8_t value);
static uint8_t sp48_fast_z80_read_port(uint16_t address);
static void sp48_fast_z80_write_port(uint16_t address, uint8_t value);
void sp48_patch_memory(unsigned int address, unsigned int value);
unsigned int sp48_read_memory(unsigned int address);
void sp48_bus_delay_memory_read(uint16_t address);
void sp48_bus_delay_memory_write(uint16_t address);
void sp48_bus_delay_port_read(uint16_t address);
void sp48_bus_delay_port_write(uint16_t address);
uint8_t sp48_bus_read_memory_value(uint16_t address);
void sp48_bus_write_memory_value(uint16_t address, uint8_t value);
uint8_t sp48_bus_read_port_value(uint16_t address);
void sp48_bus_write_port_value(uint16_t address, uint8_t value);

static unsigned int sp48_fast_z80_debug_access;

#define Z80_EXTERNAL_BUS 1
#define Z80State FastZ80InternalState
#define Z80_MEMORY_PTR() ((uint8_t *)0)
#define Z80_READ_MEMORY(address) sp48_fast_z80_read_memory((uint16_t)(address))
#define Z80_WRITE_MEMORY(address, value) sp48_fast_z80_write_memory((uint16_t)(address), (uint8_t)(value))
#define Z80_POKE_MEMORY(address, value) sp48_patch_memory((uint16_t)(address), (uint8_t)(value))
#define Z80_READ_PORT(address) sp48_fast_z80_read_port((uint16_t)(address))
#define Z80_WRITE_PORT(address, value) sp48_fast_z80_write_port((uint16_t)(address), (uint8_t)(value))
#define Z80_DELAY_MEMORY_READ(address) sp48_fast_z80_delay_memory_read((uint16_t)(address))
#define Z80_DELAY_MEMORY_WRITE(address) sp48_fast_z80_delay_memory_write((uint16_t)(address))
#define Z80_DELAY_PORT_READ(address) sp48_fast_z80_delay_port_read((uint16_t)(address))
#define Z80_DELAY_PORT_WRITE(address) sp48_fast_z80_delay_port_write((uint16_t)(address))
#define Z80_TACT_PLUS_N(value) do { \
  uint32_t sp48_fast_z80_tacts = (uint32_t)(value); \
  cpu.tacts += sp48_fast_z80_tacts; \
  sp48_fast_z80_advance_frame_tacts(sp48_fast_z80_tacts); \
} while (0)

#define z80Reset sp48FastZ80Reset
#define z80MemoryPtr sp48FastZ80MemoryPtr
#define z80ExecuteCpuCycle sp48FastZ80ExecuteCpuCycle
#define z80GetTacts sp48FastZ80GetTacts
#define z80SetTacts sp48FastZ80SetTacts
#define z80GetAf sp48FastZ80GetAf
#define z80SetAf sp48FastZ80SetAf
#define z80GetBc sp48FastZ80GetBc
#define z80SetBc sp48FastZ80SetBc
#define z80GetDe sp48FastZ80GetDe
#define z80SetDe sp48FastZ80SetDe
#define z80GetHl sp48FastZ80GetHl
#define z80SetHl sp48FastZ80SetHl
#define z80GetAfAlt sp48FastZ80GetAfAlt
#define z80SetAfAlt sp48FastZ80SetAfAlt
#define z80GetBcAlt sp48FastZ80GetBcAlt
#define z80SetBcAlt sp48FastZ80SetBcAlt
#define z80GetDeAlt sp48FastZ80GetDeAlt
#define z80SetDeAlt sp48FastZ80SetDeAlt
#define z80GetHlAlt sp48FastZ80GetHlAlt
#define z80SetHlAlt sp48FastZ80SetHlAlt
#define z80GetIx sp48FastZ80GetIx
#define z80SetIx sp48FastZ80SetIx
#define z80GetIy sp48FastZ80GetIy
#define z80SetIy sp48FastZ80SetIy
#define z80GetIr sp48FastZ80GetIr
#define z80SetIr sp48FastZ80SetIr
#define z80GetWz sp48FastZ80GetWz
#define z80SetWz sp48FastZ80SetWz
#define z80GetPc sp48FastZ80GetPc
#define z80SetPc sp48FastZ80SetPc
#define z80GetSp sp48FastZ80GetSp
#define z80SetSp sp48FastZ80SetSp
#define z80GetPrefix sp48FastZ80GetPrefix
#define z80GetHalted sp48FastZ80GetHalted
#define z80GetZ80NMode sp48FastZ80GetZ80NMode
#define z80SetZ80NMode sp48FastZ80SetZ80NMode
#define z80GetSigInt sp48FastZ80GetSigInt
#define z80SetSigInt sp48FastZ80SetSigInt
#define z80GetSigNmi sp48FastZ80GetSigNmi
#define z80SetSigNmi sp48FastZ80SetSigNmi
#define z80GetSigRst sp48FastZ80GetSigRst
#define z80SetSigRst sp48FastZ80SetSigRst
#define z80GetInterruptMode sp48FastZ80GetInterruptMode
#define z80SetInterruptMode sp48FastZ80SetInterruptMode
#define z80SetInterruptVector sp48FastZ80SetInterruptVector
#define z80GetIff1 sp48FastZ80GetIff1
#define z80SetIff1 sp48FastZ80SetIff1
#define z80GetIff2 sp48FastZ80GetIff2
#define z80SetIff2 sp48FastZ80SetIff2
#define z80GetEiBacklog sp48FastZ80GetEiBacklog
#define z80SetEiBacklog sp48FastZ80SetEiBacklog
#define z80GetRetExecuted sp48FastZ80GetRetExecuted
#define z80SetRetExecuted sp48FastZ80SetRetExecuted
#define z80GetRetnExecuted sp48FastZ80GetRetnExecuted
#define z80SetRetnExecuted sp48FastZ80SetRetnExecuted
#define z80TactPlusN sp48FastZ80TactPlusN
#define z80PeekMemory sp48FastZ80PeekMemory
#define z80PokeMemory sp48FastZ80PokeMemory
#define z80GetLastMemAddress sp48FastZ80GetLastMemAddress
#define z80GetLastMemValue sp48FastZ80GetLastMemValue
#define z80GetLastMemIsWrite sp48FastZ80GetLastMemIsWrite
#define z80GetLastPortAddress sp48FastZ80GetLastPortAddress
#define z80GetLastPortValue sp48FastZ80GetLastPortValue
#define z80GetLastPortIsWrite sp48FastZ80GetLastPortIsWrite
#define z80SetPortReadValue sp48FastZ80SetPortReadValue
#define z80GetLastTbBlueAddress sp48FastZ80GetLastTbBlueAddress
#define z80GetLastTbBlueValue sp48FastZ80GetLastTbBlueValue
#define z80GetLastTbBlueIsWrite sp48FastZ80GetLastTbBlueIsWrite
#define z80ClearBusEvents sp48FastZ80ClearBusEvents

#include "fast_z80.c"

#undef Z80State

#include "../z80_abi.h"
#include "../z80_state.h"
#include "../z80_test_bus.h"

extern Z80State state;

static void sp48_fast_z80_advance_frame_tacts(uint32_t tacts) {
  uint32_t scaled_tacts = tacts * (state.z80n_mode ? state.cpu_tact_scale : 1u);
  state.tacts += tacts;
  state.frame_tacts += scaled_tacts;
  if (state.tacts_in_frame != 0u && state.frame_tacts >= state.tacts_in_frame) {
    state.frames += state.frame_tacts / state.tacts_in_frame;
    state.frame_tacts %= state.tacts_in_frame;
  }
}

static void sp48_fast_z80_log_memory(uint16_t address, uint8_t value, uint8_t operation) {
  if (!sp48_fast_z80_debug_access || memory_log_count >= Z80_TEST_LOG_CAPACITY) return;
  memory_log[memory_log_count].address = address;
  memory_log[memory_log_count].value = value;
  memory_log[memory_log_count].operation = operation;
  memory_log_count++;
}

static void sp48_fast_z80_log_io(uint16_t address, uint8_t value, uint8_t operation) {
  if (!sp48_fast_z80_debug_access || io_log_count >= Z80_TEST_LOG_CAPACITY) return;
  io_log[io_log_count].address = address;
  io_log[io_log_count].value = value;
  io_log[io_log_count].operation = operation;
  io_log_count++;
}

static void sp48_fast_z80_delay_memory_read(uint16_t address) {
  uint32_t tacts_before = state.tacts;
  sp48_bus_delay_memory_read(address);
  cpu.tacts += state.tacts - tacts_before;
}

static void sp48_fast_z80_delay_memory_write(uint16_t address) {
  uint32_t tacts_before = state.tacts;
  sp48_bus_delay_memory_write(address);
  cpu.tacts += state.tacts - tacts_before;
}

static void sp48_fast_z80_delay_port_read(uint16_t address) {
  uint32_t tacts_before = state.tacts;
  sp48_bus_delay_port_read(address);
  cpu.tacts += state.tacts - tacts_before;
}

static void sp48_fast_z80_delay_port_write(uint16_t address) {
  uint32_t tacts_before = state.tacts;
  sp48_bus_delay_port_write(address);
  cpu.tacts += state.tacts - tacts_before;
}

static uint8_t sp48_fast_z80_read_memory(uint16_t address) {
  uint8_t value = sp48_bus_read_memory_value(address);
  sp48_fast_z80_log_memory(address, value, 0u);
  return value;
}

static void sp48_fast_z80_write_memory(uint16_t address, uint8_t value) {
  sp48_bus_write_memory_value(address, value);
  sp48_fast_z80_log_memory(address, value, 1u);
}

static uint8_t sp48_fast_z80_read_port(uint16_t address) {
  uint8_t value = sp48_bus_read_port_value(address);
  sp48_fast_z80_log_io(address, value, 0u);
  return value;
}

static void sp48_fast_z80_write_port(uint16_t address, uint8_t value) {
  sp48_bus_write_port_value(address, value);
  sp48_fast_z80_log_io(address, value, 1u);
}

void fast_sp48_z80_import_state(void) {
  sp48FastZ80SetAf(state.af.word);
  sp48FastZ80SetBc(state.bc.word);
  sp48FastZ80SetDe(state.de.word);
  sp48FastZ80SetHl(state.hl.word);
  sp48FastZ80SetAfAlt(state.af_alt.word);
  sp48FastZ80SetBcAlt(state.bc_alt.word);
  sp48FastZ80SetDeAlt(state.de_alt.word);
  sp48FastZ80SetHlAlt(state.hl_alt.word);
  sp48FastZ80SetIx(state.ix.word);
  sp48FastZ80SetIy(state.iy.word);
  sp48FastZ80SetIr(state.ir.word);
  sp48FastZ80SetWz(state.wz.word);
  sp48FastZ80SetPc(state.pc);
  sp48FastZ80SetSp(state.sp);
  sp48FastZ80SetTacts(state.tacts);
  cpu.prefix = state.prefix;
  cpu.halted = state.halted;
  cpu.opCode = state.op_code;
  sp48FastZ80SetInterruptMode(state.interrupt_mode);
  sp48FastZ80SetIff1(state.iff1);
  sp48FastZ80SetIff2(state.iff2);
  sp48FastZ80SetSigInt(state.sig_int);
  sp48FastZ80SetSigNmi(state.sig_nmi);
  sp48FastZ80SetSigRst(state.sig_rst);
  sp48FastZ80SetEiBacklog(state.ei_backlog);
  sp48FastZ80SetInterruptVector(state.interrupt_vector);
  sp48FastZ80SetZ80NMode(state.z80n_mode);
  sp48FastZ80SetRetExecuted(state.ret_executed);
  sp48FastZ80SetRetnExecuted(state.retn_executed);
  cpu.afterLdAIR = state.after_ld_air;
}

void fast_sp48_z80_export_state(void) {
  state.af.word = (uint16_t)sp48FastZ80GetAf();
  state.bc.word = (uint16_t)sp48FastZ80GetBc();
  state.de.word = (uint16_t)sp48FastZ80GetDe();
  state.hl.word = (uint16_t)sp48FastZ80GetHl();
  state.af_alt.word = (uint16_t)sp48FastZ80GetAfAlt();
  state.bc_alt.word = (uint16_t)sp48FastZ80GetBcAlt();
  state.de_alt.word = (uint16_t)sp48FastZ80GetDeAlt();
  state.hl_alt.word = (uint16_t)sp48FastZ80GetHlAlt();
  state.ix.word = (uint16_t)sp48FastZ80GetIx();
  state.iy.word = (uint16_t)sp48FastZ80GetIy();
  state.ir.word = (uint16_t)sp48FastZ80GetIr();
  state.wz.word = (uint16_t)sp48FastZ80GetWz();
  state.pc = (uint16_t)sp48FastZ80GetPc();
  state.sp = (uint16_t)sp48FastZ80GetSp();
  state.tacts = sp48FastZ80GetTacts();
  state.prefix = (uint8_t)sp48FastZ80GetPrefix();
  state.halted = (uint8_t)sp48FastZ80GetHalted();
  state.op_code = cpu.opCode;
  state.interrupt_mode = (uint8_t)sp48FastZ80GetInterruptMode();
  state.iff1 = (uint8_t)sp48FastZ80GetIff1();
  state.iff2 = (uint8_t)sp48FastZ80GetIff2();
  state.sig_int = (uint8_t)sp48FastZ80GetSigInt();
  state.sig_nmi = (uint8_t)sp48FastZ80GetSigNmi();
  state.sig_rst = (uint8_t)sp48FastZ80GetSigRst();
  state.ei_backlog = (uint8_t)sp48FastZ80GetEiBacklog();
  state.ret_executed = (uint8_t)sp48FastZ80GetRetExecuted();
  state.retn_executed = (uint8_t)sp48FastZ80GetRetnExecuted();
  state.after_ld_air = cpu.afterLdAIR;
  state.interrupt_vector = cpu.interruptVector;
}

void fast_sp48_z80_reset(void) {
  sp48FastZ80Reset();
  state.frame_tacts = 0;
  state.frames = 0;
  state.tacts_in_frame = 1000000u;
  state.cpu_tact_scale = 1;
  fast_sp48_z80_export_state();
  state.op_code = 0;
  state.after_ld_air = 0;
  state.interrupt_vector = 0xff;
  memory_log_count = 0;
  io_log_count = 0;
  tbblue_log_count = 0;
}

static unsigned int fast_sp48_z80_execute_with_mode(unsigned int debug_access) {
  uint8_t prefix_before = (uint8_t)sp48FastZ80GetPrefix();
  uint8_t opcode_before = (uint8_t)sp48_read_memory((uint16_t)sp48FastZ80GetPc());
  uint16_t wz_before = (uint16_t)sp48FastZ80GetWz();
  sp48_fast_z80_debug_access = debug_access;
  if (debug_access && prefix_before == 0u) {
    memory_log_count = 0;
    io_log_count = 0;
  }
  sp48FastZ80SetSigInt(state.sig_int);
  sp48FastZ80SetSigNmi(state.sig_nmi);
  sp48FastZ80SetSigRst(state.sig_rst);
  sp48FastZ80ExecuteCpuCycle();
  if ((prefix_before == 0u || prefix_before == 3u || prefix_before == 4u) && opcode_before == 0x02u) {
    sp48FastZ80SetWz((uint16_t)((sp48FastZ80GetAf() & 0xff00u) | (wz_before & 0x00ffu)));
  }
  fast_sp48_z80_export_state();
  sp48_fast_z80_debug_access = 0;
  return state.prefix == 0u ? Z80_EXECUTION_COMPLETED : Z80_EXECUTION_PREFIX_PENDING;
}

unsigned int fast_sp48_z80_execute_instruction(void) {
  return fast_sp48_z80_execute_with_mode(0u);
}

unsigned int fast_sp48_z80_execute_debug_instruction(void) {
  return fast_sp48_z80_execute_with_mode(1u);
}
