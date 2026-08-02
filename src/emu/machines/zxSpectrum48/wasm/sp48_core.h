#ifndef KLIVE_SP48_CORE_H
#define KLIVE_SP48_CORE_H

/* Versioned, integer-only ABI: JavaScript invokes these exports directly. */
unsigned int sp48_abi_version(void);
void sp48_create(void);
void sp48_reset(void);
void sp48_load_rom_byte(unsigned int address, unsigned int value);
unsigned int sp48_read_memory(unsigned int address);
void sp48_write_memory(unsigned int address, unsigned int value);
unsigned int sp48_read_port(unsigned int address);
void sp48_write_port(unsigned int address, unsigned int value);

#endif
