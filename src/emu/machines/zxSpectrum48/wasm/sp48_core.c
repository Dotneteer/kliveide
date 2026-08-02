#include "sp48_core.h"

/*
 * The first vertical slice of the C core. Keep the ABI free of libc, pointers,
 * and host callbacks so it compiles with either clang+wasm-ld or Emscripten.
 * CPU, ULA, tape, audio, and contention move here only behind conformance tests.
 */
static unsigned char memory[0x10000];
static unsigned char ula_port;

/* clang may lower simple loops to memset even with -nostdlib. */
void *memset(void *destination, int value, unsigned long length) {
  unsigned char *bytes = (unsigned char *)destination;
  unsigned long index;
  for (index = 0; index < length; index++) bytes[index] = (unsigned char)value;
  return destination;
}

unsigned int sp48_abi_version(void) { return 1; }

void sp48_create(void) { sp48_reset(); }

void sp48_reset(void) {
  unsigned int address;
  ula_port = 0;
  for (address = 0x4000; address < 0x10000; address++) memory[address] = 0;
}

void sp48_load_rom_byte(unsigned int address, unsigned int value) {
  if (address < 0x4000) memory[address] = (unsigned char)value;
}

unsigned int sp48_read_memory(unsigned int address) { return memory[address & 0xffff]; }

void sp48_write_memory(unsigned int address, unsigned int value) {
  address &= 0xffff;
  if (address >= 0x4000) memory[address] = (unsigned char)value;
}

unsigned int sp48_read_port(unsigned int address) {
  /* ULA read is intentionally a placeholder until keyboard/floating-bus parity. */
  return (address & 1) == 0 ? 0xff : 0xff;
}

void sp48_write_port(unsigned int address, unsigned int value) {
  if ((address & 1) == 0) ula_port = (unsigned char)value;
}
