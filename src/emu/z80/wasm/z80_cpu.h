#ifndef KLIVE_Z80_CPU_H
#define KLIVE_Z80_CPU_H

#include "z80_state.h"

/* Internal state owned by z80_cpu.c. The ABI unit may expose controlled
 * register views, but does not implement CPU execution. */
extern Z80State state;
void z80_cpu_prepare_tables(void);
unsigned int z80_cpu_execute_instruction(void);

#endif
