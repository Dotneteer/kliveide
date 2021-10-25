// ============================================================================
// This file contains constant values that define the memory map of the
// WebAssembly code.

// ============================================================================
// Machine-independent parts
export const VM_MEMORY = 0x00_0000

// --- CPU state transfer area
export const CPU_STATE_BUFFER = 0x0100009c;

// --- Machine state transfer buffer
export const VM_STATE_BUFFER = 0x013db434;

// --- Map of breakpoints, 1 byte for each 16-bit address
export const BREAKPOINTS_MAP = 0x0100_0dfc;

// --- Breakpoint partitions map, 2 bytes for each 16-bit address
export const BRP_PARTITION_MAP = 0x0101_0dfc;

// --- Execution engine state transfer buffer
export const EXEC_ENGINE_STATE_BUFFER = 0x01000de3;

// --- Execution options state transfer buffer
export const EXEC_OPTIONS_BUFFER = 0x01000df0;
