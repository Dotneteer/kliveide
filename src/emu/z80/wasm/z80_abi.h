#ifndef KLIVE_Z80_ABI_H
#define KLIVE_Z80_ABI_H

enum Z80ExecutionResult {
  Z80_EXECUTION_COMPLETED = 0,
  Z80_EXECUTION_NOT_IMPLEMENTED = 1,
  Z80_EXECUTION_PREFIX_PENDING = 2
};

unsigned int z80_abi_version(void);
unsigned int z80_state_size(void);
void z80_reset(void);
unsigned int z80_state_read_word(unsigned int field);
void z80_state_write_word(unsigned int field, unsigned int value);
unsigned int z80_state_read_byte(unsigned int field);
void z80_state_write_byte(unsigned int field, unsigned int value);
unsigned int z80_state_read_control(unsigned int field);
void z80_state_write_control(unsigned int field, unsigned int value);
unsigned int z80_state_read_counter(unsigned int field);
unsigned int z80_execute_instruction(void);
unsigned int z80_register_layout_probe(void);
unsigned int z80_test_memory_ptr(void);
unsigned int z80_test_memory_size(void);
unsigned int z80_test_memory_log_capacity(void);
unsigned int z80_test_io_log_capacity(void);
unsigned int z80_test_tbblue_log_capacity(void);
unsigned int z80_test_memory_log_count(void);
void z80_test_bus_reset(void);

#endif
