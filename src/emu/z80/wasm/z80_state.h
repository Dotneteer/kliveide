#ifndef KLIVE_Z80_STATE_H
#define KLIVE_Z80_STATE_H

#include <stdint.h>

/* WebAssembly is little-endian. This union is an internal C representation;
 * the exported ABI uses field identifiers rather than exposing struct layout. */
typedef union {
  uint16_t word;
  struct {
    uint8_t lo;
    uint8_t hi;
  } bytes;
} Z80Register16;

typedef struct {
  Z80Register16 af;
  Z80Register16 bc;
  Z80Register16 de;
  Z80Register16 hl;
  Z80Register16 af_alt;
  Z80Register16 bc_alt;
  Z80Register16 de_alt;
  Z80Register16 hl_alt;
  Z80Register16 ix;
  Z80Register16 iy;
  Z80Register16 ir;
  Z80Register16 wz;
  uint16_t pc;
  uint16_t sp;
  uint32_t tacts;
  uint32_t frame_tacts;
  uint32_t frames;
  uint32_t tacts_in_frame;
  uint8_t prefix;
  uint8_t interrupt_mode;
  uint8_t halted;
  uint8_t iff1;
  uint8_t iff2;
  uint8_t sig_int;
  uint8_t sig_nmi;
  uint8_t sig_rst;
  uint8_t after_ld_air;
  uint8_t ret_executed;
  uint8_t retn_executed;
  uint8_t ei_backlog;
  uint8_t op_code;
  uint8_t interrupt_vector;
  uint8_t z80n_mode;
  uint8_t cpu_tact_scale;
} Z80State;

extern Z80State state;

enum Z80WordField {
  Z80_WORD_AF = 0,
  Z80_WORD_BC,
  Z80_WORD_DE,
  Z80_WORD_HL,
  Z80_WORD_AF_ALT,
  Z80_WORD_BC_ALT,
  Z80_WORD_DE_ALT,
  Z80_WORD_HL_ALT,
  Z80_WORD_IX,
  Z80_WORD_IY,
  Z80_WORD_IR,
  Z80_WORD_WZ,
  Z80_WORD_PC,
  Z80_WORD_SP
};

enum Z80ByteField {
  Z80_BYTE_A = 0,
  Z80_BYTE_F,
  Z80_BYTE_B,
  Z80_BYTE_C,
  Z80_BYTE_D,
  Z80_BYTE_E,
  Z80_BYTE_H,
  Z80_BYTE_L,
  Z80_BYTE_IXH,
  Z80_BYTE_IXL,
  Z80_BYTE_IYH,
  Z80_BYTE_IYL,
  Z80_BYTE_I,
  Z80_BYTE_R
};

enum Z80ControlField {
  Z80_CONTROL_PREFIX = 0,
  Z80_CONTROL_HALTED,
  Z80_CONTROL_OPCODE,
  Z80_CONTROL_INTERRUPT_MODE,
  Z80_CONTROL_IFF1,
  Z80_CONTROL_IFF2,
  Z80_CONTROL_SIGNAL_INT,
  Z80_CONTROL_SIGNAL_NMI,
  Z80_CONTROL_SIGNAL_RST,
  Z80_CONTROL_EI_BACKLOG,
  Z80_CONTROL_AFTER_LD_AIR,
  Z80_CONTROL_INTERRUPT_VECTOR,
  Z80_CONTROL_Z80N_MODE,
  Z80_CONTROL_CPU_TACT_SCALE
};

enum Z80CounterField {
  Z80_COUNTER_TACTS = 0,
  Z80_COUNTER_FRAME_TACTS,
  Z80_COUNTER_FRAMES
};

#endif
