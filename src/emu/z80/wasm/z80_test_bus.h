#ifndef KLIVE_Z80_TEST_BUS_H
#define KLIVE_Z80_TEST_BUS_H

#include <stdint.h>

#define Z80_TEST_MEMORY_SIZE 0x10000u
#define Z80_TEST_LOG_CAPACITY 256u
#define Z80_BUS_TEST 0u
#define Z80_BUS_SP48 1u
#define Z80_BUS_SP48_DEBUG 2u

typedef struct {
  uint16_t address;
  uint8_t value;
  uint8_t operation;
} Z80TestBusLogEntry;

extern uint8_t test_memory[Z80_TEST_MEMORY_SIZE];
extern Z80TestBusLogEntry memory_log[Z80_TEST_LOG_CAPACITY];
extern Z80TestBusLogEntry io_log[Z80_TEST_LOG_CAPACITY];
extern Z80TestBusLogEntry tbblue_log[Z80_TEST_LOG_CAPACITY];
extern uint8_t io_input[Z80_TEST_LOG_CAPACITY];
extern unsigned int z80_bus_mode;
extern unsigned int memory_log_count;
extern unsigned int io_log_count;
extern unsigned int tbblue_log_count;
extern unsigned int io_input_count;
extern unsigned int io_input_index;

#endif
