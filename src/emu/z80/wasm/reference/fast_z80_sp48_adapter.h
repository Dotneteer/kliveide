#ifndef KLIVE_FAST_Z80_SP48_ADAPTER_H
#define KLIVE_FAST_Z80_SP48_ADAPTER_H

void fast_sp48_z80_reset(void);
void fast_sp48_z80_import_state(void);
void fast_sp48_z80_export_state(void);
unsigned int fast_sp48_z80_execute_instruction(void);
unsigned int fast_sp48_z80_execute_debug_instruction(void);

#endif
