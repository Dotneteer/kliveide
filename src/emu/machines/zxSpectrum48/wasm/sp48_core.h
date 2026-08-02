#ifndef KLIVE_SP48_CORE_H
#define KLIVE_SP48_CORE_H

#ifndef SP48_ABI_VERSION
#define SP48_ABI_VERSION 1
#endif
#ifndef SP48_LAYOUT_VERSION
#define SP48_LAYOUT_VERSION 1
#endif
#ifndef SP48_MACHINE_STATE_BLOCK_SIZE
#define SP48_MACHINE_STATE_BLOCK_SIZE 64
#endif
#ifndef SP48_INPUT_BLOCK_SIZE
#define SP48_INPUT_BLOCK_SIZE 64
#endif
#ifndef SP48_RESULT_BLOCK_SIZE
#define SP48_RESULT_BLOCK_SIZE 64
#endif
#ifndef SP48_EVENT_BUFFER_SIZE
#define SP48_EVENT_BUFFER_SIZE 4096
#endif
#ifndef SP48_MEMORY_SIZE
#define SP48_MEMORY_SIZE 65536
#endif
#ifndef SP48_DIRTY_RANGE_CAPACITY
#define SP48_DIRTY_RANGE_CAPACITY 32
#endif
#ifndef SP48_DIRTY_RANGE_RECORD_SIZE
#define SP48_DIRTY_RANGE_RECORD_SIZE 4
#endif
#ifndef SP48_MACHINE_STATE_CPU_STATE_OFFSET
#define SP48_MACHINE_STATE_CPU_STATE_OFFSET 0
#endif
#ifndef SP48_MACHINE_STATE_FRAME_TACTS_OFFSET
#define SP48_MACHINE_STATE_FRAME_TACTS_OFFSET 32
#endif
#ifndef SP48_MACHINE_STATE_ULA_PORT_OFFSET
#define SP48_MACHINE_STATE_ULA_PORT_OFFSET 36
#endif
#ifndef SP48_MACHINE_STATE_IS_16K_MODEL_OFFSET
#define SP48_MACHINE_STATE_IS_16K_MODEL_OFFSET 37
#endif
#ifndef SP48_INPUT_KEYBOARD_ROWS_OFFSET
#define SP48_INPUT_KEYBOARD_ROWS_OFFSET 0
#endif
#ifndef SP48_INPUT_RUN_MODE_OFFSET
#define SP48_INPUT_RUN_MODE_OFFSET 16
#endif
#ifndef SP48_RESULT_TERMINATION_OFFSET
#define SP48_RESULT_TERMINATION_OFFSET 0
#endif
#ifndef SP48_RESULT_EVENT_COUNT_OFFSET
#define SP48_RESULT_EVENT_COUNT_OFFSET 4
#endif
#ifndef SP48_RESULT_DIRTY_RANGE_COUNT_OFFSET
#define SP48_RESULT_DIRTY_RANGE_COUNT_OFFSET 8
#endif

/* Versioned, integer-only ABI: JavaScript invokes these exports directly. */
unsigned int sp48_abi_version(void);
unsigned int sp48_layout_value(unsigned int id);
unsigned int sp48_machine_state_block_ptr(void);
unsigned int sp48_input_block_ptr(void);
unsigned int sp48_result_block_ptr(void);
unsigned int sp48_event_buffer_ptr(void);
unsigned int sp48_memory_ptr(void);
unsigned int sp48_memory_size(void);
unsigned int sp48_dirty_ranges_ptr(void);
unsigned int sp48_dirty_range_count(void);
void sp48_clear_dirty_ranges(void);
void sp48_set_16k_model(unsigned int enabled);
void sp48_import_state(void);
void sp48_export_state(void);
void sp48_import_snapshot(void);
void sp48_export_snapshot(void);
void sp48_create(void);
void sp48_reset(void);
void sp48_load_rom_byte(unsigned int address, unsigned int value);
unsigned int sp48_read_memory(unsigned int address);
void sp48_write_memory(unsigned int address, unsigned int value);
void sp48_patch_memory(unsigned int address, unsigned int value);
unsigned int sp48_read_port(unsigned int address);
void sp48_write_port(unsigned int address, unsigned int value);

#endif
