// ============================================================================
// This file contains constant values that define the memory map of the
// WebAssembly code.

// ============================================================================
// Machine-independent parts
export const VM_MEMORY = 0x0000_0000

// --- CPU state transfer area
export const CPU_STATE_BUFFER = 0x0100_0000;

// --- Execution engine state transfer buffer
export const EXEC_ENGINE_STATE_BUFFER = 0x0100_1000;

// --- Execution options state transfer buffer
export const EXEC_OPTIONS_BUFFER = 0x0100_1400;

// --- Machine state transfer buffer
export const VM_STATE_BUFFER = 0x0100_1800;

// --- Map of breakpoints, 1 byte for each 16-bit address
export const BREAKPOINTS_MAP = 0x0100_2800;

// --- Breakpoint partitions map, 2 bytes for each 16-bit address
export const BRP_PARTITION_MAP = 0x0101_2800;

