#include "z80_test_bus.h"

Z80TestBusLogEntry memory_log[Z80_TEST_LOG_CAPACITY];
Z80TestBusLogEntry io_log[Z80_TEST_LOG_CAPACITY];
unsigned int memory_log_count;
unsigned int io_log_count;
unsigned int tbblue_log_count;
