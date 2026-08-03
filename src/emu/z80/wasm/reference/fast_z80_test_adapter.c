#include <stdint.h>

typedef struct {
  uint16_t address;
  uint8_t value;
  uint8_t operation;
} FastZ80TestBusLogEntry;

#define FAST_Z80_TEST_MEMORY_SIZE 0x10000u
#define FAST_Z80_TEST_LOG_CAPACITY 256u

static uint8_t fast_test_memory[FAST_Z80_TEST_MEMORY_SIZE];
static uint8_t fast_io_input[FAST_Z80_TEST_LOG_CAPACITY];
static FastZ80TestBusLogEntry fast_memory_log[FAST_Z80_TEST_LOG_CAPACITY];
static FastZ80TestBusLogEntry fast_io_log[FAST_Z80_TEST_LOG_CAPACITY];
static FastZ80TestBusLogEntry fast_tbblue_log[FAST_Z80_TEST_LOG_CAPACITY];
static uint8_t fast_z80_state_block[64];
static unsigned int fast_memory_log_count;
static unsigned int fast_io_log_count;
static unsigned int fast_tbblue_log_count;
static unsigned int fast_io_input_count;
static unsigned int fast_io_input_index;
static uint32_t fast_frame_tacts;
static uint32_t fast_frames;
static uint32_t fast_tacts_in_frame = 1000000u;
static uint8_t fast_cpu_tact_scale = 1;

static uint8_t fast_read_memory(uint16_t address) {
  uint8_t value = fast_test_memory[address];
  if (fast_memory_log_count < FAST_Z80_TEST_LOG_CAPACITY) {
    fast_memory_log[fast_memory_log_count].address = address;
    fast_memory_log[fast_memory_log_count].value = value;
    fast_memory_log[fast_memory_log_count].operation = 0;
    fast_memory_log_count++;
  }
  return value;
}

static void fast_write_memory(uint16_t address, uint8_t value) {
  fast_test_memory[address] = value;
  if (fast_memory_log_count < FAST_Z80_TEST_LOG_CAPACITY) {
    fast_memory_log[fast_memory_log_count].address = address;
    fast_memory_log[fast_memory_log_count].value = value;
    fast_memory_log[fast_memory_log_count].operation = 1;
    fast_memory_log_count++;
  }
}

static uint8_t fast_read_port(uint16_t address) {
  uint8_t value = fast_io_input_index < fast_io_input_count
    ? fast_io_input[fast_io_input_index++]
    : 0;
  if (fast_io_log_count < FAST_Z80_TEST_LOG_CAPACITY) {
    fast_io_log[fast_io_log_count].address = address;
    fast_io_log[fast_io_log_count].value = value;
    fast_io_log[fast_io_log_count].operation = 0;
    fast_io_log_count++;
  }
  return value;
}

static void fast_write_port(uint16_t address, uint8_t value) {
  if (fast_io_log_count < FAST_Z80_TEST_LOG_CAPACITY) {
    fast_io_log[fast_io_log_count].address = address;
    fast_io_log[fast_io_log_count].value = value;
    fast_io_log[fast_io_log_count].operation = 1;
    fast_io_log_count++;
  }
}

#define Z80_EXTERNAL_BUS 1
#define Z80_MEMORY_PTR() fast_test_memory
#define Z80_READ_MEMORY(address) fast_read_memory(address)
#define Z80_WRITE_MEMORY(address, value) fast_write_memory(address, value)
#define Z80_POKE_MEMORY(address, value) (fast_test_memory[(uint16_t)(address)] = (uint8_t)(value))
#define Z80_READ_PORT(address) fast_read_port(address)
#define Z80_WRITE_PORT(address, value) fast_write_port(address, value)

#define z80Reset fastZ80Reset
#define z80MemoryPtr fastZ80MemoryPtr
#define z80ExecuteCpuCycle fastZ80ExecuteCpuCycle
#define z80GetTacts fastZ80GetTacts
#define z80SetTacts fastZ80SetTacts
#define z80GetAf fastZ80GetAf
#define z80SetAf fastZ80SetAf
#define z80GetBc fastZ80GetBc
#define z80SetBc fastZ80SetBc
#define z80GetDe fastZ80GetDe
#define z80SetDe fastZ80SetDe
#define z80GetHl fastZ80GetHl
#define z80SetHl fastZ80SetHl
#define z80GetAfAlt fastZ80GetAfAlt
#define z80SetAfAlt fastZ80SetAfAlt
#define z80GetBcAlt fastZ80GetBcAlt
#define z80SetBcAlt fastZ80SetBcAlt
#define z80GetDeAlt fastZ80GetDeAlt
#define z80SetDeAlt fastZ80SetDeAlt
#define z80GetHlAlt fastZ80GetHlAlt
#define z80SetHlAlt fastZ80SetHlAlt
#define z80GetIx fastZ80GetIx
#define z80SetIx fastZ80SetIx
#define z80GetIy fastZ80GetIy
#define z80SetIy fastZ80SetIy
#define z80GetIr fastZ80GetIr
#define z80SetIr fastZ80SetIr
#define z80GetWz fastZ80GetWz
#define z80SetWz fastZ80SetWz
#define z80GetPc fastZ80GetPc
#define z80SetPc fastZ80SetPc
#define z80GetSp fastZ80GetSp
#define z80SetSp fastZ80SetSp
#define z80GetPrefix fastZ80GetPrefix
#define z80GetHalted fastZ80GetHalted
#define z80GetZ80NMode fastZ80GetZ80NMode
#define z80SetZ80NMode fastZ80SetZ80NMode
#define z80GetSigInt fastZ80GetSigInt
#define z80SetSigInt fastZ80SetSigInt
#define z80GetSigNmi fastZ80GetSigNmi
#define z80SetSigNmi fastZ80SetSigNmi
#define z80GetSigRst fastZ80GetSigRst
#define z80SetSigRst fastZ80SetSigRst
#define z80GetInterruptMode fastZ80GetInterruptMode
#define z80SetInterruptMode fastZ80SetInterruptMode
#define z80SetInterruptVector fastZ80SetInterruptVector
#define z80GetIff1 fastZ80GetIff1
#define z80SetIff1 fastZ80SetIff1
#define z80GetIff2 fastZ80GetIff2
#define z80SetIff2 fastZ80SetIff2
#define z80GetEiBacklog fastZ80GetEiBacklog
#define z80SetEiBacklog fastZ80SetEiBacklog
#define z80GetRetExecuted fastZ80GetRetExecuted
#define z80SetRetExecuted fastZ80SetRetExecuted
#define z80GetRetnExecuted fastZ80GetRetnExecuted
#define z80SetRetnExecuted fastZ80SetRetnExecuted
#define z80TactPlusN fastZ80TactPlusN
#define z80PeekMemory fastZ80PeekMemory
#define z80PokeMemory fastZ80PokeMemory
#define z80GetLastMemAddress fastZ80GetLastMemAddress
#define z80GetLastMemValue fastZ80GetLastMemValue
#define z80GetLastMemIsWrite fastZ80GetLastMemIsWrite
#define z80GetLastPortAddress fastZ80GetLastPortAddress
#define z80GetLastPortValue fastZ80GetLastPortValue
#define z80GetLastPortIsWrite fastZ80GetLastPortIsWrite
#define z80SetPortReadValue fastZ80SetPortReadValue
#define z80GetLastTbBlueAddress fastZ80GetLastTbBlueAddress
#define z80GetLastTbBlueValue fastZ80GetLastTbBlueValue
#define z80GetLastTbBlueIsWrite fastZ80GetLastTbBlueIsWrite
#define z80ClearBusEvents fastZ80ClearBusEvents

#include "fast_z80.c"

static void fast_put_u16(unsigned int offset, uint16_t value) {
  fast_z80_state_block[offset] = (uint8_t)value;
  fast_z80_state_block[offset + 1u] = (uint8_t)(value >> 8);
}

static uint16_t fast_get_u16(unsigned int offset) {
  return (uint16_t)(fast_z80_state_block[offset] | ((uint16_t)fast_z80_state_block[offset + 1u] << 8));
}

static void fast_put_u32(unsigned int offset, uint32_t value) {
  fast_z80_state_block[offset] = (uint8_t)value;
  fast_z80_state_block[offset + 1u] = (uint8_t)(value >> 8);
  fast_z80_state_block[offset + 2u] = (uint8_t)(value >> 16);
  fast_z80_state_block[offset + 3u] = (uint8_t)(value >> 24);
}

static uint32_t fast_get_u32(unsigned int offset) {
  return (uint32_t)fast_z80_state_block[offset]
    | ((uint32_t)fast_z80_state_block[offset + 1u] << 8)
    | ((uint32_t)fast_z80_state_block[offset + 2u] << 16)
    | ((uint32_t)fast_z80_state_block[offset + 3u] << 24);
}

unsigned int fast_z80_abi_version(void) { return 1; }

unsigned int fast_z80_state_block_ptr(void) {
  return (unsigned int)(uintptr_t)fast_z80_state_block;
}

unsigned int fast_z80_state_block_size(void) { return sizeof fast_z80_state_block; }

void fast_z80_state_export(void) {
  fast_put_u16(0u, (uint16_t)fastZ80GetAf());
  fast_put_u16(2u, (uint16_t)fastZ80GetBc());
  fast_put_u16(4u, (uint16_t)fastZ80GetDe());
  fast_put_u16(6u, (uint16_t)fastZ80GetHl());
  fast_put_u16(8u, (uint16_t)fastZ80GetAfAlt());
  fast_put_u16(10u, (uint16_t)fastZ80GetBcAlt());
  fast_put_u16(12u, (uint16_t)fastZ80GetDeAlt());
  fast_put_u16(14u, (uint16_t)fastZ80GetHlAlt());
  fast_put_u16(16u, (uint16_t)fastZ80GetIx());
  fast_put_u16(18u, (uint16_t)fastZ80GetIy());
  fast_put_u16(20u, (uint16_t)fastZ80GetIr());
  fast_put_u16(22u, (uint16_t)fastZ80GetWz());
  fast_put_u16(24u, (uint16_t)fastZ80GetPc());
  fast_put_u16(26u, (uint16_t)fastZ80GetSp());
  fast_put_u32(28u, fastZ80GetTacts());
  fast_put_u32(32u, fast_frame_tacts);
  fast_put_u32(36u, fast_frames);
  fast_put_u32(40u, fast_tacts_in_frame);
  fast_z80_state_block[44u] = (uint8_t)fastZ80GetPrefix();
  fast_z80_state_block[45u] = (uint8_t)fastZ80GetHalted();
  fast_z80_state_block[46u] = cpu.opCode;
  fast_z80_state_block[47u] = (uint8_t)fastZ80GetInterruptMode();
  fast_z80_state_block[48u] = (uint8_t)fastZ80GetIff1();
  fast_z80_state_block[49u] = (uint8_t)fastZ80GetIff2();
  fast_z80_state_block[50u] = (uint8_t)fastZ80GetSigInt();
  fast_z80_state_block[51u] = (uint8_t)fastZ80GetSigNmi();
  fast_z80_state_block[52u] = (uint8_t)fastZ80GetSigRst();
  fast_z80_state_block[53u] = (uint8_t)fastZ80GetEiBacklog();
  fast_z80_state_block[54u] = cpu.afterLdAIR;
  fast_z80_state_block[55u] = cpu.interruptVector;
  fast_z80_state_block[56u] = (uint8_t)fastZ80GetZ80NMode();
  fast_z80_state_block[57u] = fast_cpu_tact_scale;
}

void fast_z80_state_import(void) {
  fastZ80SetAf(fast_get_u16(0u));
  fastZ80SetBc(fast_get_u16(2u));
  fastZ80SetDe(fast_get_u16(4u));
  fastZ80SetHl(fast_get_u16(6u));
  fastZ80SetAfAlt(fast_get_u16(8u));
  fastZ80SetBcAlt(fast_get_u16(10u));
  fastZ80SetDeAlt(fast_get_u16(12u));
  fastZ80SetHlAlt(fast_get_u16(14u));
  fastZ80SetIx(fast_get_u16(16u));
  fastZ80SetIy(fast_get_u16(18u));
  fastZ80SetIr(fast_get_u16(20u));
  fastZ80SetWz(fast_get_u16(22u));
  fastZ80SetPc(fast_get_u16(24u));
  fastZ80SetSp(fast_get_u16(26u));
  fastZ80SetTacts(fast_get_u32(28u));
  cpu.halted = fast_z80_state_block[45u] != 0;
  cpu.prefix = cpu.halted ? 0u : fast_z80_state_block[44u];
  cpu.opCode = fast_z80_state_block[46u];
  fast_frame_tacts = fast_get_u32(32u);
  fast_frames = fast_get_u32(36u);
  fast_tacts_in_frame = fast_get_u32(40u) == 0 ? 1000000u : fast_get_u32(40u);
  fastZ80SetInterruptMode(fast_z80_state_block[47u]);
  fastZ80SetIff1(fast_z80_state_block[48u] != 0);
  fastZ80SetIff2(fast_z80_state_block[49u] != 0);
  fastZ80SetSigInt(fast_z80_state_block[50u] != 0);
  fastZ80SetSigNmi(fast_z80_state_block[51u] != 0);
  fastZ80SetSigRst(fast_z80_state_block[52u] != 0);
  fastZ80SetEiBacklog(fast_z80_state_block[53u]);
  fastZ80SetInterruptVector(fast_z80_state_block[55u]);
  fastZ80SetZ80NMode(fast_z80_state_block[56u] != 0);
  fast_cpu_tact_scale = fast_z80_state_block[57u] == 0 ? 1 : fast_z80_state_block[57u];
  cpu.afterLdAIR = fast_z80_state_block[54u] != 0;
}

void fast_z80_reset(void) {
  fastZ80Reset();
  fast_memory_log_count = 0;
  fast_io_log_count = 0;
  fast_tbblue_log_count = 0;
  fast_z80_state_export();
}

unsigned int fast_z80_execute_instruction(void) {
  unsigned int had_tbblue_event;
  uint8_t prefix_before;
  uint8_t opcode_before;
  uint16_t wz_before;
  uint32_t start_tacts;
  uint32_t tact_delta;
  uint32_t scaled_delta;
  if (fast_z80_state_block[44u] == 0) {
    fast_memory_log_count = 0;
  }
  prefix_before = fast_z80_state_block[44u];
  opcode_before = fast_test_memory[fast_get_u16(24u)];
  wz_before = fast_get_u16(22u);
  fast_z80_state_import();
  start_tacts = fastZ80GetTacts();
  fastZ80ClearBusEvents();
  fastZ80ExecuteCpuCycle();
  if ((prefix_before == 0u || prefix_before == 3u || prefix_before == 4u) && opcode_before == 0x02u) {
    fastZ80SetWz((uint16_t)((fastZ80GetAf() & 0xff00u) | (wz_before & 0x00ffu)));
  }
  tact_delta = fastZ80GetTacts() - start_tacts;
  scaled_delta = tact_delta * (fastZ80GetZ80NMode() ? fast_cpu_tact_scale : 1u);
  fast_frame_tacts += scaled_delta;
  if (fast_tacts_in_frame != 0 && fast_frame_tacts >= fast_tacts_in_frame) {
    fast_frames += fast_frame_tacts / fast_tacts_in_frame;
    fast_frame_tacts %= fast_tacts_in_frame;
  }
  had_tbblue_event = fastZ80GetLastTbBlueIsWrite();
  if (had_tbblue_event && fast_tbblue_log_count < FAST_Z80_TEST_LOG_CAPACITY) {
    fast_tbblue_log[fast_tbblue_log_count].address = (uint16_t)fastZ80GetLastTbBlueAddress();
    fast_tbblue_log[fast_tbblue_log_count].value = (uint8_t)fastZ80GetLastTbBlueValue();
    fast_tbblue_log[fast_tbblue_log_count].operation = 1;
    fast_tbblue_log_count++;
  }
  fast_z80_state_export();
  return fast_z80_state_block[44u] == 0u ? 0u : 2u;
}

unsigned int fast_z80_test_memory_ptr(void) { return (unsigned int)(uintptr_t)fast_test_memory; }
unsigned int fast_z80_test_memory_size(void) { return FAST_Z80_TEST_MEMORY_SIZE; }
unsigned int fast_z80_test_memory_log_capacity(void) { return FAST_Z80_TEST_LOG_CAPACITY; }
unsigned int fast_z80_test_io_log_capacity(void) { return FAST_Z80_TEST_LOG_CAPACITY; }
unsigned int fast_z80_test_tbblue_log_capacity(void) { return FAST_Z80_TEST_LOG_CAPACITY; }
unsigned int fast_z80_test_memory_log_count(void) { return fast_memory_log_count; }
unsigned int fast_z80_test_memory_log_ptr(void) { return (unsigned int)(uintptr_t)fast_memory_log; }
unsigned int fast_z80_test_io_log_count(void) { return fast_io_log_count; }
unsigned int fast_z80_test_io_log_ptr(void) { return (unsigned int)(uintptr_t)fast_io_log; }
unsigned int fast_z80_test_tbblue_log_count(void) { return fast_tbblue_log_count; }
unsigned int fast_z80_test_tbblue_log_ptr(void) { return (unsigned int)(uintptr_t)fast_tbblue_log; }
unsigned int fast_z80_test_io_input_ptr(void) { return (unsigned int)(uintptr_t)fast_io_input; }

void fast_z80_test_io_input_count_set(unsigned int count) {
  fast_io_input_count = count > FAST_Z80_TEST_LOG_CAPACITY ? FAST_Z80_TEST_LOG_CAPACITY : count;
  fast_io_input_index = 0;
}

void fast_z80_test_bus_reset(void) {
  unsigned int index;
  for (index = 0; index < FAST_Z80_TEST_MEMORY_SIZE; index++) fast_test_memory[index] = 0;
  for (index = 0; index < FAST_Z80_TEST_LOG_CAPACITY; index++) {
    fast_memory_log[index].operation = 0;
    fast_io_log[index].operation = 0;
    fast_tbblue_log[index].operation = 0;
    fast_io_input[index] = 0;
  }
  fast_memory_log_count = 0;
  fast_io_log_count = 0;
  fast_tbblue_log_count = 0;
  fast_io_input_count = 0;
  fast_io_input_index = 0;
}

unsigned int z80_abi_version(void) { return fast_z80_abi_version(); }
void z80_reset(void) { fast_z80_reset(); }
unsigned int z80_state_block_ptr(void) { return fast_z80_state_block_ptr(); }
unsigned int z80_state_block_size(void) { return fast_z80_state_block_size(); }
void z80_state_export(void) { fast_z80_state_export(); }
void z80_state_import(void) { fast_z80_state_import(); }
unsigned int z80_execute_instruction(void) { return fast_z80_execute_instruction(); }
unsigned int z80_test_memory_ptr(void) { return fast_z80_test_memory_ptr(); }
unsigned int z80_test_memory_size(void) { return fast_z80_test_memory_size(); }
unsigned int z80_test_memory_log_capacity(void) { return fast_z80_test_memory_log_capacity(); }
unsigned int z80_test_io_log_capacity(void) { return fast_z80_test_io_log_capacity(); }
unsigned int z80_test_tbblue_log_capacity(void) { return fast_z80_test_tbblue_log_capacity(); }
unsigned int z80_test_memory_log_count(void) { return fast_z80_test_memory_log_count(); }
unsigned int z80_test_memory_log_ptr(void) { return fast_z80_test_memory_log_ptr(); }
unsigned int z80_test_io_log_count(void) { return fast_z80_test_io_log_count(); }
unsigned int z80_test_io_log_ptr(void) { return fast_z80_test_io_log_ptr(); }
unsigned int z80_test_tbblue_log_count(void) { return fast_z80_test_tbblue_log_count(); }
unsigned int z80_test_tbblue_log_ptr(void) { return fast_z80_test_tbblue_log_ptr(); }
unsigned int z80_test_io_input_ptr(void) { return fast_z80_test_io_input_ptr(); }
void z80_test_io_input_count_set(unsigned int count) { fast_z80_test_io_input_count_set(count); }
void z80_test_bus_reset(void) { fast_z80_test_bus_reset(); }
