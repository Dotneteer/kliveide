#ifndef KLIVE_Z80_ABI_H
#define KLIVE_Z80_ABI_H

enum Z80ExecutionResult {
  Z80_EXECUTION_COMPLETED = 0,
  Z80_EXECUTION_NOT_IMPLEMENTED = 1,
  Z80_EXECUTION_PREFIX_PENDING = 2
};

unsigned int z80_abi_version(void);
void z80_reset(void);
unsigned int z80_state_block_ptr(void);
unsigned int z80_state_block_size(void);
void z80_state_export(void);
void z80_state_import(void);
unsigned int z80_execute_instruction(void);
unsigned int z80_test_memory_ptr(void);
unsigned int z80_test_memory_size(void);
unsigned int z80_test_memory_log_capacity(void);
unsigned int z80_test_io_log_capacity(void);
unsigned int z80_test_tbblue_log_capacity(void);
unsigned int z80_test_memory_log_count(void);
unsigned int z80_test_memory_log_ptr(void);
unsigned int z80_test_io_log_count(void);
unsigned int z80_test_io_log_ptr(void);
unsigned int z80_test_tbblue_log_count(void);
unsigned int z80_test_tbblue_log_ptr(void);
unsigned int z80_test_io_input_ptr(void);
void z80_test_io_input_count_set(unsigned int count);
void z80_test_bus_reset(void);

#endif
