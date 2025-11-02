import { SysVar, SysVarType } from "../../../common/abstractions/SysVar";

/**
 * System variables of Commodore 64
 */
export const c64SysVars: SysVar[] = [
  {
    address: 0x0000,
    name: "D6510",
    type: SysVarType.Byte,
    description: "6510 On-Chip Data-Direction register"
  },
  {
    address: 0x0001,
    name: "R6510",
    type: SysVarType.Byte,
    description: "6510 On-Chip 8-Bit Input/Output register"
  },
  {
    address: 0x0003,
    name: "ADRAY1",
    type: SysVarType.Word,
    description: "Jump Vector: Convert Floating-Integer"
  },
  {
    address: 0x0005,
    name: "ADRAY2",
    type: SysVarType.Word,
    description: "Jump Vector: Convert Integer-Floating"
  },
  {
    address: 0x0007,
    name: "CHARAC",
    type: SysVarType.Byte,
    description: "Search Character"
  },
  {
    address: 0x0008,
    name: "ENDCHR",
    type: SysVarType.Byte,
    description: "Flag: Scan for Quote as End of String"
  },
  {
    address: 0x0009,
    name: "TRMPOS",
    type: SysVarType.Byte,
    description: "Screen Column from Last TAB"
  },
  {
    address: 0x000a,
    name: "VERCK",
    type: SysVarType.Byte,
    description: "Flag: 0 = LOAD, 1 = VERIFY"
  },
  {
    address: 0x000b,
    name: "COUNT",
    type: SysVarType.Byte,
    description: "Input Buffer Pointer / # of Subscripts"
  },
  {
    address: 0x000c,
    name: "DIMFLG",
    type: SysVarType.Byte,
    description: "Flag: DIM Statement Indicator (0 = false)"
  },
  {
    address: 0x000d,
    name: "VALTYP",
    type: SysVarType.Byte,
    description: "Data Type: $00=Numeric, $FF=String"
  },
  {
    address: 0x000e,
    name: "INTFLG",
    type: SysVarType.Byte,
    description: "Data Type: $00=Floating, $80=Integer"
  },
  {
    address: 0x000f,
    name: "GARBFL",
    type: SysVarType.Byte,
    description: "Flag: DATA scan/LIST quote/Garbage collection"
  },
  {
    address: 0x0010,
    name: "SUBFLG",
    type: SysVarType.Byte,
    description: "Flag: Subscript reference / User function call"
  },
  {
    address: 0x0011,
    name: "INPFLG",
    type: SysVarType.Byte,
    description: "Flag: $00=INPUT, $40=GET, $98=READ"
  },
  {
    address: 0x0012,
    name: "TANSGN",
    type: SysVarType.Byte,
    description: "Flag: TAN sign/Comparison result"
  },
  {
    address: 0x0013,
    name: "CHANNL",
    type: SysVarType.Byte,
    description: "Current I/O Channel for BASIC (CMD logical file)"
  },
  {
    address: 0x0014,
    name: "LINNUM",
    type: SysVarType.Word,
    description: "Temp: Integer value"
  },
  {
    address: 0x0016,
    name: "TEMPPT",
    type: SysVarType.Byte,
    description: "Pointer: Temporary string descriptor stack"
  },
  {
    address: 0x0017,
    name: "LASTPT",
    type: SysVarType.Word,
    description: "Last-used Temporary string address"
  },
  {
    address: 0x0019,
    name: "TEMPST",
    type: SysVarType.Array,
    length: 9,
    description: "Stack for Temporary strings"
  },
  {
    address: 0x0022,
    name: "INDEX",
    type: SysVarType.Word,
    description: "Utility Pointer Area"
  },
  {
    address: 0x0024,
    name: "RESHO",
    type: SysVarType.Byte,
    description: "Floating-point work area"
  },
  {
    address: 0x0025,
    name: "RESMOH",
    type: SysVarType.Byte,
    description: "Floating-point work area"
  },
  {
    address: 0x0026,
    name: "ADDEND",
    type: SysVarType.Byte,
    description: "Floating-point work area"
  },
  {
    address: 0x002b,
    name: "RESMO",
    type: SysVarType.Byte,
    description: "Floating-point work area"
  },
  {
    address: 0x002c,
    name: "RESLO",
    type: SysVarType.Byte,
    description: "Floating-point work area"
  },
  {
    address: 0x002d,
    name: "TXTTAB",
    type: SysVarType.Word,
    description: "Pointer: Start of BASIC Text"
  },
  {
    address: 0x002f,
    name: "VARTAB",
    type: SysVarType.Word,
    description: "Pointer: Start of BASIC Variables"
  },
  {
    address: 0x0031,
    name: "ARYTAB",
    type: SysVarType.Word,
    description: "Pointer: Start of BASIC Arrays"
  },
  {
    address: 0x0033,
    name: "STREND",
    type: SysVarType.Word,
    description: "Pointer: End of BASIC Arrays (End of BASIC active memory)"
  },
  {
    address: 0x0035,
    name: "FRETOP",
    type: SysVarType.Word,
    description: "Pointer: Bottom of String storage"
  },
  {
    address: 0x0037,
    name: "FRESPC",
    type: SysVarType.Word,
    description: "Utility String pointer"
  },
  {
    address: 0x0039,
    name: "MEMSIZ",
    type: SysVarType.Word,
    description: "Pointer: Highest address used by BASIC"
  },
  {
    address: 0x003b,
    name: "CURLIN",
    type: SysVarType.Word,
    description: "Current BASIC Line number"
  },
  {
    address: 0x003d,
    name: "OLDLIN",
    type: SysVarType.Word,
    description: "Previous BASIC Line number"
  },
  {
    address: 0x003f,
    name: "OLDTXT",
    type: SysVarType.Word,
    description: "Pointer: BASIC Statement for CONT"
  },
  {
    address: 0x0041,
    name: "DATLIN",
    type: SysVarType.Word,
    description: "Current DATA Line number"
  },
  {
    address: 0x0043,
    name: "DATPTR",
    type: SysVarType.Word,
    description: "Pointer: Current DATA item address"
  },
  {
    address: 0x0045,
    name: "INPPTR",
    type: SysVarType.Word,
    description: "Pointer: INPUT routine active point"
  },
  {
    address: 0x0047,
    name: "VARNAM",
    type: SysVarType.Word,
    description: "Current BASIC Variable name"
  },
  {
    address: 0x0049,
    name: "VARPNT",
    type: SysVarType.Word,
    description: "Pointer: Current BASIC Variable data"
  },
  {
    address: 0x004b,
    name: "FORPNT",
    type: SysVarType.Word,
    description: "Pointer: BASIC Variable pointer for FOR/NEXT"
  },
  {
    address: 0x004d,
    name: "VARTXT",
    type: SysVarType.Word,
    description: "Pointer: Current BASIC Variable name"
  },
  {
    address: 0x004f,
    name: "OPMASK",
    type: SysVarType.Byte,
    description: "Mask for comparison operation"
  },
  {
    address: 0x0050,
    name: "DEFPNT",
    type: SysVarType.Word,
    description: "Pointer: Function definition/string descriptor"
  },
  {
    address: 0x0052,
    name: "DSCPNT",
    type: SysVarType.Word,
    description: "Temporary pointer for string array descriptors"
  },
  {
    address: 0x0054,
    name: "FOUR6",
    type: SysVarType.Array,
    length: 6,
    description: "Floating point: Constant 4.0"
  },
  {
    address: 0x005a,
    name: "JMPER",
    type: SysVarType.Array,
    length: 3,
    description: "JMP instruction for function calls"
  },
  {
    address: 0x005d,
    name: "TEMPF3",
    type: SysVarType.Array,
    length: 3,
    description: "Misc Numeric work area"
  },
  {
    address: 0x0060,
    name: "FAC",
    type: SysVarType.Array,
    length: 6,
    description: "Floating-point Accumulator #1"
  },
  {
    address: 0x0066,
    name: "FACEXP",
    type: SysVarType.Byte,
    description: "Floating-point Accumulator #1: Exponent"
  },
  {
    address: 0x0067,
    name: "FACHO",
    type: SysVarType.Byte,
    description: "Floating-point Accumulator #1: Mantissa MSB"
  },
  {
    address: 0x0068,
    name: "FACMOH",
    type: SysVarType.Byte,
    description: "Floating-point Accumulator #1: Mantissa"
  },
  {
    address: 0x0069,
    name: "FACMO",
    type: SysVarType.Byte,
    description: "Floating-point Accumulator #1: Mantissa"
  },
  {
    address: 0x006a,
    name: "FACLO",
    type: SysVarType.Byte,
    description: "Floating-point Accumulator #1: Mantissa LSB"
  },
  {
    address: 0x006b,
    name: "FACSGN",
    type: SysVarType.Byte,
    description: "Floating-point Accumulator #1: Sign"
  },
  {
    address: 0x006c,
    name: "SGNFLG",
    type: SysVarType.Byte,
    description: "Pointer: Series Evaluation Constant"
  },
  {
    address: 0x006d,
    name: "BITS",
    type: SysVarType.Byte,
    description: "Floating-point Accumulator #1: Overflow digit"
  },
  {
    address: 0x006e,
    name: "ARGEXP",
    type: SysVarType.Byte,
    description: "Floating-point Accumulator #2: Exponent"
  },
  {
    address: 0x006f,
    name: "ARGHO",
    type: SysVarType.Byte,
    description: "Floating-point Accumulator #2: Mantissa MSB"
  },
  {
    address: 0x0070,
    name: "ARGMOH",
    type: SysVarType.Byte,
    description: "Floating-point Accumulator #2: Mantissa"
  },
  {
    address: 0x0071,
    name: "ARGMO",
    type: SysVarType.Byte,
    description: "Floating-point Accumulator #2: Mantissa"
  },
  {
    address: 0x0072,
    name: "ARGLO",
    type: SysVarType.Byte,
    description: "Floating-point Accumulator #2: Mantissa LSB"
  },
  {
    address: 0x0073,
    name: "ARGSGN",
    type: SysVarType.Byte,
    description: "Floating-point Accumulator #2: Sign"
  },
  {
    address: 0x0074,
    name: "ARISGN",
    type: SysVarType.Byte,
    description: "Sign of result of Arithmetic Comparison"
  },
  {
    address: 0x0075,
    name: "FACOV",
    type: SysVarType.Byte,
    description: "Floating-point Accumulator #1: Low-order rounding"
  },
  {
    address: 0x0076,
    name: "FBUFPT",
    type: SysVarType.Word,
    description: "Pointer: Cassette buffer"
  },
  {
    address: 0x0078,
    name: "CHRGET",
    type: SysVarType.Array,
    length: 6,
    description: "Subroutine: Get next BASIC character"
  },
  {
    address: 0x007e,
    name: "CHRGOT",
    type: SysVarType.Array,
    length: 1,
    description: "Entry to get same BASIC character again"
  },
  {
    address: 0x007f,
    name: "TXTPTR",
    type: SysVarType.Word,
    description: "Pointer: Current BASIC text address"
  },
  {
    address: 0x0081,
    name: "RNDX",
    type: SysVarType.Array,
    length: 5,
    description: "Random number seed"
  },
  {
    address: 0x0086,
    name: "STATUS",
    type: SysVarType.Byte,
    description: "KERNAL I/O Status word: ST"
  },
  {
    address: 0x0087,
    name: "STKEY",
    type: SysVarType.Byte,
    description: "Flag: STOP key / RVS key"
  },
  {
    address: 0x0088,
    name: "SVXT",
    type: SysVarType.Byte,
    description: "Timing constant for tape"
  },
  {
    address: 0x0089,
    name: "VERCK",
    type: SysVarType.Byte,
    description: "Flag: 0=LOAD, 1=VERIFY"
  },
  {
    address: 0x008a,
    name: "C3PO",
    type: SysVarType.Byte,
    description: "Flag: Serial character buffer"
  },
  {
    address: 0x008b,
    name: "BSOUR",
    type: SysVarType.Byte,
    description: "Character buffer for serial"
  },
  {
    address: 0x008c,
    name: "SYNO",
    type: SysVarType.Byte,
    description: "Cassette sync number"
  },
  {
    address: 0x008d,
    name: "TEMPX",
    type: SysVarType.Byte,
    description: "Temporary for CHRIN"
  },
  {
    address: 0x008e,
    name: "LDTND",
    type: SysVarType.Byte,
    description: "Number of open files / index to file table"
  },
  {
    address: 0x008f,
    name: "DFLTN",
    type: SysVarType.Byte,
    description: "Default input device (0)"
  },
  {
    address: 0x0090,
    name: "DFLTO",
    type: SysVarType.Byte,
    description: "Default output device (3)"
  },
  {
    address: 0x0091,
    name: "PRTY",
    type: SysVarType.Byte,
    description: "Parity byte for cassette"
  },
  {
    address: 0x0092,
    name: "DPSW",
    type: SysVarType.Byte,
    description: "Flag: Tape byte-received"
  },
  {
    address: 0x0093,
    name: "MSGFLG",
    type: SysVarType.Byte,
    description: "Flag: Kernal Message Control"
  },
  {
    address: 0x0094,
    name: "PTR1",
    type: SysVarType.Byte,
    description: "Tape pass 1 error log pointer"
  },
  {
    address: 0x0095,
    name: "PTR2",
    type: SysVarType.Byte,
    description: "Tape pass 2 error log pointer"
  },
  {
    address: 0x0096,
    name: "TIME",
    type: SysVarType.Array,
    length: 3,
    description: "Real-time jiffy clock (approx 1/60 sec)"
  },
  {
    address: 0x0099,
    name: "TSFCNT",
    type: SysVarType.Byte,
    description: "EOT / tape sequence counter"
  },
  {
    address: 0x009a,
    name: "TBTCNT",
    type: SysVarType.Word,
    description: "Tape bit count / block count"
  },
  {
    address: 0x009c,
    name: "CNTDN",
    type: SysVarType.Byte,
    description: "Cassette sync countdown"
  },
  {
    address: 0x009d,
    name: "BUFPNT",
    type: SysVarType.Byte,
    description: "Tape I/O buffer pointer"
  },
  {
    address: 0x009e,
    name: "INBIT",
    type: SysVarType.Byte,
    description: "Tape: receiver bit storage"
  },
  {
    address: 0x009f,
    name: "BITCI",
    type: SysVarType.Byte,
    description: "Tape: receiver bit count in"
  },
  {
    address: 0x00a0,
    name: "RINONE",
    type: SysVarType.Byte,
    description: "Tape: Start bit on flag for receiver"
  },
  {
    address: 0x00a1,
    name: "RIDATA",
    type: SysVarType.Byte,
    description: "Tape: Byte input buffer for receiver"
  },
  {
    address: 0x00a2,
    name: "RIPRTY",
    type: SysVarType.Byte,
    description: "Tape: Parity storage for receiver"
  },
  {
    address: 0x00a3,
    name: "SAL",
    type: SysVarType.Byte,
    description: "Tape: Start address for load"
  },
  {
    address: 0x00a4,
    name: "SAH",
    type: SysVarType.Byte,
    description: "Tape: Start address for load (high byte)"
  },
  {
    address: 0x00a5,
    name: "EAL",
    type: SysVarType.Byte,
    description: "Tape: End address for load"
  },
  {
    address: 0x00a6,
    name: "EAH",
    type: SysVarType.Byte,
    description: "Tape: End address for load (high byte)"
  },
  {
    address: 0x00a7,
    name: "CMPO",
    type: SysVarType.Byte,
    description: "Tape: Nonstandard-block flag"
  },
  {
    address: 0x00a8,
    name: "TAPE1",
    type: SysVarType.Word,
    description: "Pointer: Start of tape buffer"
  },
  {
    address: 0x00aa,
    name: "BITTS",
    type: SysVarType.Byte,
    description: "Tape: Transmitter bit count"
  },
  {
    address: 0x00ab,
    name: "NXTBIT",
    type: SysVarType.Byte,
    description: "Tape: Next bit to be transmitted"
  },
  {
    address: 0x00ac,
    name: "RODATA",
    type: SysVarType.Byte,
    description: "Tape: Output byte buffer"
  },
  {
    address: 0x00ad,
    name: "FNLEN",
    type: SysVarType.Byte,
    description: "Length of current filename"
  },
  {
    address: 0x00ae,
    name: "LA",
    type: SysVarType.Byte,
    description: "Current logical file number"
  },
  {
    address: 0x00af,
    name: "SA",
    type: SysVarType.Byte,
    description: "Current secondary address"
  },
  {
    address: 0x00b0,
    name: "FA",
    type: SysVarType.Byte,
    description: "Current device number"
  },
  {
    address: 0x00b1,
    name: "FNADR",
    type: SysVarType.Word,
    description: "Pointer: Current filename address"
  },
  {
    address: 0x00b3,
    name: "ROPRTY",
    type: SysVarType.Byte,
    description: "Tape: Parity byte for writing"
  },
  {
    address: 0x00b4,
    name: "FSBLK",
    type: SysVarType.Byte,
    description: "Tape: First byte in block flag"
  },
  {
    address: 0x00b5,
    name: "MYCH",
    type: SysVarType.Byte,
    description: "Serial: Byte buffer"
  },
  {
    address: 0x00b6,
    name: "CAS1",
    type: SysVarType.Byte,
    description: "Tape: I/O operation indicator"
  },
  {
    address: 0x00b7,
    name: "STAL",
    type: SysVarType.Byte,
    description: "Tape: Start address for save (low byte)"
  },
  {
    address: 0x00b8,
    name: "STAH",
    type: SysVarType.Byte,
    description: "Tape: Start address for save (high byte)"
  },
  {
    address: 0x00b9,
    name: "MEMUSS",
    type: SysVarType.Word,
    description: "KERNAL address for memory dump"
  },
  {
    address: 0x00bb,
    name: "LSTX",
    type: SysVarType.Byte,
    description: "Last used matrix coordinate (keyboard)"
  },
  {
    address: 0x00bc,
    name: "NDX",
    type: SysVarType.Byte,
    description: "Number of chars in keyboard buffer"
  },
  {
    address: 0x00bd,
    name: "RVS",
    type: SysVarType.Byte,
    description: "Flag: Reverse on/off (1=on)"
  },
  {
    address: 0x00be,
    name: "INDX",
    type: SysVarType.Byte,
    description: "Pointer: End of logical line for INPUT"
  },
  {
    address: 0x00bf,
    name: "LXSP",
    type: SysVarType.Byte,
    description: "Cursor X-Y position at start of INPUT"
  },
  {
    address: 0x00c0,
    name: "SFDX",
    type: SysVarType.Byte,
    description: "Flag: Print shifted chars (0=disable)"
  },
  {
    address: 0x00c1,
    name: "BLNSW",
    type: SysVarType.Byte,
    description: "Cursor blink enable (0=disable blink)"
  },
  {
    address: 0x00c2,
    name: "BLNCT",
    type: SysVarType.Byte,
    description: "Cursor blink countdown"
  },
  {
    address: 0x00c3,
    name: "GDBLN",
    type: SysVarType.Byte,
    description: "Character under cursor"
  },
  {
    address: 0x00c4,
    name: "BLNON",
    type: SysVarType.Byte,
    description: "Flag: Cursor is visible (0=not visible)"
  },
  {
    address: 0x00c5,
    name: "CRSW",
    type: SysVarType.Byte,
    description: "Flag: INPUT or GET from keyboard"
  },
  {
    address: 0x00c6,
    name: "KEYTAB",
    type: SysVarType.Word,
    description: "Vector: Keyboard decode table"
  },
  {
    address: 0x00c8,
    name: "SHFLAG",
    type: SysVarType.Byte,
    description: "Flag: Shift/Ctrl/C= pressed"
  },
  {
    address: 0x00c9,
    name: "SFDX",
    type: SysVarType.Byte,
    description: "Flag: Shift mode active"
  },
  {
    address: 0x00ca,
    name: "LSTSHF",
    type: SysVarType.Byte,
    description: "Last keyboard shift pattern"
  },
  {
    address: 0x00cb,
    name: "KOUNT",
    type: SysVarType.Byte,
    description: "Repeat key countdown"
  },
  {
    address: 0x00cc,
    name: "DELAY",
    type: SysVarType.Byte,
    description: "Repeat key speed counter"
  },
  {
    address: 0x00cd,
    name: "SHFTO",
    type: SysVarType.Byte,
    description: "Flag: Keyboard keyswitch shifted"
  },
  {
    address: 0x00ce,
    name: "KCHAR",
    type: SysVarType.Byte,
    description: "Most recently pressed keyboard key"
  },
  {
    address: 0x00cf,
    name: "QTSW",
    type: SysVarType.Byte,
    description: "Flag: Editor in quote mode (0=not in quote mode)"
  },
  {
    address: 0x00d0,
    name: "LNMX",
    type: SysVarType.Byte,
    description: "Current logical line length"
  },
  {
    address: 0x00d1,
    name: "TBLX",
    type: SysVarType.Byte,
    description: "Current cursor physical line number"
  },
  {
    address: 0x00d2,
    name: "PNTR",
    type: SysVarType.Byte,
    description: "Current cursor column on line"
  },
  {
    address: 0x00d3,
    name: "LINES",
    type: SysVarType.Byte,
    description: "Maximum number of screen lines"
  },
  {
    address: 0x00d4,
    name: "LSXP",
    type: SysVarType.Byte,
    description: "Cursor Y-X position at start of line"
  },
  {
    address: 0x00d5,
    name: "LSTP",
    type: SysVarType.Byte,
    description: "Flag: Editor last action (0=list, insert, delete)"
  },
  {
    address: 0x00d6,
    name: "INDX",
    type: SysVarType.Byte,
    description: "Pointer: End of logical line for INPUT"
  },
  {
    address: 0x00d7,
    name: "LSXP",
    type: SysVarType.Byte,
    description: "Cursor X-Y position at start of INPUT"
  },
  {
    address: 0x00d8,
    name: "SFDX",
    type: SysVarType.Byte,
    description: "Flag: Print shifted chars"
  },
  {
    address: 0x00d9,
    name: "LSTP",
    type: SysVarType.Byte,
    description: "Matrix value of last key pressed"
  },
  {
    address: 0x00da,
    name: "SWCHC",
    type: SysVarType.Byte,
    description: "Flag: Scroll screen?"
  },
  {
    address: 0x00db,
    name: "SCHAR",
    type: SysVarType.Byte,
    description: "Screen code of character under cursor"
  },
  {
    address: 0x00dc,
    name: "INSRT",
    type: SysVarType.Byte,
    description: "Flag: Insert mode (>0 = # chars to insert)"
  },
  {
    address: 0x00dd,
    name: "LDTB1",
    type: SysVarType.Word,
    description: "Screen line link table"
  },
  {
    address: 0x00f3,
    name: "ADIELF",
    type: SysVarType.Byte,
    description: "Flag: Auto scroll down when past bottom of screen"
  },
  {
    address: 0x00f5,
    name: "ADRSTP",
    type: SysVarType.Byte,
    description: "Tape: Temporary end address for load"
  },
  {
    address: 0x00f6,
    name: "TPTR",
    type: SysVarType.Word,
    description: "Tape: Temporary end address for load"
  },
  {
    address: 0x00f8,
    name: "TPBYTE",
    type: SysVarType.Byte,
    description: "Tape: Temporary byte value"
  },
  {
    address: 0x00f9,
    name: "FIRT",
    type: SysVarType.Byte,
    description: "Flag: First or second pass on tape write"
  },
  {
    address: 0x00fa,
    name: "CNTDN",
    type: SysVarType.Byte,
    description: "Temporary counter for tape timing"
  },
  {
    address: 0x00fb,
    name: "BUFPNT",
    type: SysVarType.Byte,
    description: "Pointer to Tape I/O buffer"
  },
  {
    address: 0x00fc,
    name: "RIDBE",
    type: SysVarType.Byte,
    description: "Tape: Bit error counter in read"
  },
  {
    address: 0x00fd,
    name: "RDFLG",
    type: SysVarType.Byte,
    description: "Flag: Tape read error"
  },
  {
    address: 0x00fe,
    name: "SHCNL",
    type: SysVarType.Byte,
    description: "Tape: Counter for short header blocks"
  },
  {
    address: 0x00ff,
    name: "IQJMP",
    type: SysVarType.Byte,
    description: "Flag: Serial clock state"
  },

  // System variables in page 2-3
  {
    address: 0x0200,
    name: "BUF",
    type: SysVarType.Array,
    length: 160,
    description: "BASIC input buffer"
  },
  {
    address: 0x0259,
    name: "LAT",
    type: SysVarType.Array,
    length: 16,
    description: "Logical file numbers table"
  },
  {
    address: 0x0269,
    name: "FAT",
    type: SysVarType.Array,
    length: 16,
    description: "Device numbers table"
  },
  {
    address: 0x0279,
    name: "SAT",
    type: SysVarType.Array,
    length: 16,
    description: "Secondary addresses table"
  },
  {
    address: 0x0289,
    name: "KEYD",
    type: SysVarType.Array,
    length: 10,
    description: "Keyboard buffer"
  },
  {
    address: 0x0291,
    name: "MEMSTR",
    type: SysVarType.Word,
    description: "Pointer: Bottom of memory for OS"
  },
  {
    address: 0x0293,
    name: "MEMSIZ",
    type: SysVarType.Word,
    description: "Pointer: Top of memory for OS"
  },
  {
    address: 0x0295,
    name: "TIMOUT",
    type: SysVarType.Byte,
    description: "Flag: Kernal variable for IEEE timeout"
  },
  {
    address: 0x0296,
    name: "COLOR",
    type: SysVarType.Byte,
    description: "Current active text color"
  },
  {
    address: 0x0297,
    name: "GDCOL",
    type: SysVarType.Byte,
    description: "Background color under cursor"
  },
  {
    address: 0x0298,
    name: "HIBASE",
    type: SysVarType.Byte,
    description: "Top page of screen memory (screenmem/256)"
  },
  {
    address: 0x0299,
    name: "XMAX",
    type: SysVarType.Byte,
    description: "Maximum size of keyboard buffer"
  },
  {
    address: 0x029a,
    name: "RPTFLG",
    type: SysVarType.Byte,
    description: "Flag: REPEAT key used"
  },
  {
    address: 0x029b,
    name: "KOUNT",
    type: SysVarType.Byte,
    description: "Repeat key delay counter"
  },
  {
    address: 0x029c,
    name: "DELAY",
    type: SysVarType.Byte,
    description: "Repeat key speed counter"
  },
  {
    address: 0x029d,
    name: "SHFLAG",
    type: SysVarType.Byte,
    description: "Flag: Keyboard SHIFT/CTRL/C= pressed"
  },
  {
    address: 0x029e,
    name: "LSTX",
    type: SysVarType.Byte,
    description: "Matrix code of last key pressed"
  },
  {
    address: 0x029f,
    name: "SFDX",
    type: SysVarType.Byte,
    description: "Flag: Keyboard SHIFT pressed"
  },
  {
    address: 0x02a0,
    name: "INDX",
    type: SysVarType.Byte,
    description: "Index into keyboard decode table"
  },
  {
    address: 0x02a1,
    name: "TXTTAB",
    type: SysVarType.Word,
    description: "Pointer: Start of BASIC program text"
  },
  {
    address: 0x02a3,
    name: "VARTAB",
    type: SysVarType.Word,
    description: "Pointer: Start of BASIC variables"
  },
  {
    address: 0x02a5,
    name: "ARYTAB",
    type: SysVarType.Word,
    description: "Pointer: Start of BASIC arrays"
  },
  {
    address: 0x02a7,
    name: "STREND",
    type: SysVarType.Word,
    description: "Pointer: End of BASIC arrays + 1"
  },
  {
    address: 0x02a9,
    name: "FRETOP",
    type: SysVarType.Word,
    description: "Pointer: Bottom of string storage"
  },
  {
    address: 0x02ab,
    name: "FRESPC",
    type: SysVarType.Word,
    description: "Temporary pointer for strings"
  },
  {
    address: 0x02ad,
    name: "MEMSIZ",
    type: SysVarType.Word,
    description: "Pointer: Highest address for BASIC"
  },
  {
    address: 0x02af,
    name: "CURLIN",
    type: SysVarType.Word,
    description: "Current BASIC line number"
  },
  {
    address: 0x02b1,
    name: "OLDLIN",
    type: SysVarType.Word,
    description: "Previous BASIC line number"
  },
  {
    address: 0x02b3,
    name: "OLDTXT",
    type: SysVarType.Word,
    description: "Pointer: BASIC statement for CONT"
  },
  {
    address: 0x02b5,
    name: "DATLIN",
    type: SysVarType.Word,
    description: "Current DATA line number"
  },
  {
    address: 0x02b7,
    name: "DATPTR",
    type: SysVarType.Word,
    description: "Pointer: Current DATA item address"
  },
  {
    address: 0x02b9,
    name: "INPPTR",
    type: SysVarType.Word,
    description: "Pointer: Get value from string"
  },
  {
    address: 0x02bb,
    name: "VARNAM",
    type: SysVarType.Word,
    description: "Current BASIC variable name"
  },
  {
    address: 0x02bd,
    name: "VARPNT",
    type: SysVarType.Word,
    description: "Pointer: Current BASIC variable data"
  },
  {
    address: 0x02bf,
    name: "FORPNT",
    type: SysVarType.Word,
    description: "Pointer: FOR/NEXT variable address"
  },
  {
    address: 0x02c1,
    name: "OPPTR",
    type: SysVarType.Word,
    description: "Math operator table displacement"
  },
  {
    address: 0x02c3,
    name: "OPMASK",
    type: SysVarType.Byte,
    description: "Mask for comparison operation"
  },
  {
    address: 0x02c4,
    name: "DEFPNT",
    type: SysVarType.Word,
    description: "Pointer: Default arguments for DEF FN"
  },
  {
    address: 0x02c6,
    name: "DSCPNT",
    type: SysVarType.Word,
    description: "Temporary pointer for string description"
  },
  {
    address: 0x02c8,
    name: "FOUR6",
    type: SysVarType.Word,
    description: "Constant for garbage collection"
  },
  {
    address: 0x02c9,
    name: "JMPER",
    type: SysVarType.Array,
    length: 3,
    description: "Jump vector for functions"
  },
  {
    address: 0x02cc,
    name: "OLDOV",
    type: SysVarType.Byte,
    description: "Flag: Variable has old value"
  },
  {
    address: 0x02cd,
    name: "TEMPF1",
    type: SysVarType.Array,
    length: 33,
    description: "Misc Floating Point work area"
  },
  {
    address: 0x02f0,
    name: "ARISGN",
    type: SysVarType.Byte,
    description: "Sign of primary argument"
  },
  {
    address: 0x02f1,
    name: "FACOV",
    type: SysVarType.Byte,
    description: "Floating point overflow digit"
  },
  {
    address: 0x02f2,
    name: "FACHO",
    type: SysVarType.Byte,
    description: "Floating Accum#1: Mantissa MSB"
  },
  {
    address: 0x02f3,
    name: "FACMOH",
    type: SysVarType.Byte,
    description: "Floating Accum#1: Mantissa"
  },
  {
    address: 0x02f4,
    name: "FACMO",
    type: SysVarType.Byte,
    description: "Floating Accum#1: Mantissa"
  },
  {
    address: 0x02f5,
    name: "FACLO",
    type: SysVarType.Byte,
    description: "Floating Accum#1: Mantissa LSB"
  },
  {
    address: 0x02f6,
    name: "FACSGN",
    type: SysVarType.Byte,
    description: "Floating Accum#1: Sign"
  },
  {
    address: 0x02f7,
    name: "SGNFLG",
    type: SysVarType.Byte,
    description: "Temp sign comparison result"
  },
  {
    address: 0x02f8,
    name: "BITS",
    type: SysVarType.Byte,
    description: "Temp bit counter"
  },
  {
    address: 0x02f9,
    name: "ARGEXP",
    type: SysVarType.Byte,
    description: "Floating Accum#2: Exponent"
  },
  {
    address: 0x02fa,
    name: "ARGHO",
    type: SysVarType.Byte,
    description: "Floating Accum#2: Mantissa MSB"
  },
  {
    address: 0x02fb,
    name: "ARGMOH",
    type: SysVarType.Byte,
    description: "Floating Accum#2: Mantissa"
  },
  {
    address: 0x02fc,
    name: "ARGMO",
    type: SysVarType.Byte,
    description: "Floating Accum#2: Mantissa"
  },
  {
    address: 0x02fd,
    name: "ARGLO",
    type: SysVarType.Byte,
    description: "Floating Accum#2: Mantissa LSB"
  },
  {
    address: 0x02fe,
    name: "ARGSGN",
    type: SysVarType.Byte,
    description: "Floating Accum#2: Sign"
  },
  {
    address: 0x02ff,
    name: "STRNG1",
    type: SysVarType.Word,
    description: "Pointer: Current string"
  },
  {
    address: 0x0300,
    name: "BUFPTR",
    type: SysVarType.Word,
    description: "Pointer: Buffer Address"
  },
  {
    address: 0x0302,
    name: "FREKZP",
    type: SysVarType.Byte,
    description: "Free zero page for user programs"
  },
  {
    address: 0x0304,
    name: "BASZPT",
    type: SysVarType.Array,
    length: 15,
    description: "BASIC free zero page"
  },
  {
    address: 0x0313,
    name: "FREKZP",
    type: SysVarType.Byte,
    description: "Free zero page for user programs"
  },
  {
    address: 0x0314,
    name: "CINV",
    type: SysVarType.Word,
    description: "Vector: IRQ"
  },
  {
    address: 0x0316,
    name: "CBINV",
    type: SysVarType.Word,
    description: "Vector: BRK"
  },
  {
    address: 0x0318,
    name: "NMINV",
    type: SysVarType.Word,
    description: "Vector: NMI"
  },
  {
    address: 0x031a,
    name: "IOPEN",
    type: SysVarType.Word,
    description: "Vector: OPEN"
  },
  {
    address: 0x031c,
    name: "ICLOSE",
    type: SysVarType.Word,
    description: "Vector: CLOSE"
  },
  {
    address: 0x031e,
    name: "ICHKIN",
    type: SysVarType.Word,
    description: "Vector: CHKIN"
  },
  {
    address: 0x0320,
    name: "ICKOUT",
    type: SysVarType.Word,
    description: "Vector: CKOUT"
  },
  {
    address: 0x0322,
    name: "ICLRCH",
    type: SysVarType.Word,
    description: "Vector: CLRCHN"
  },
  {
    address: 0x0324,
    name: "IBASIN",
    type: SysVarType.Word,
    description: "Vector: CHRIN"
  },
  {
    address: 0x0326,
    name: "IBSOUT",
    type: SysVarType.Word,
    description: "Vector: CHROUT"
  },
  {
    address: 0x0328,
    name: "ISTOP",
    type: SysVarType.Word,
    description: "Vector: STOP"
  },
  {
    address: 0x032a,
    name: "IGETIN",
    type: SysVarType.Word,
    description: "Vector: GETIN"
  },
  {
    address: 0x032c,
    name: "ICLALL",
    type: SysVarType.Word,
    description: "Vector: CLALL"
  },
  {
    address: 0x032e,
    name: "USRCMD",
    type: SysVarType.Word,
    description: "Vector: User-defined command"
  },
  {
    address: 0x0330,
    name: "ILOAD",
    type: SysVarType.Word,
    description: "Vector: LOAD"
  },
  {
    address: 0x0332,
    name: "ISAVE",
    type: SysVarType.Word,
    description: "Vector: SAVE"
  },
  {
    address: 0x033c,
    name: "TBUFFER",
    type: SysVarType.Array,
    length: 192,
    description: "Tape I/O buffer"
  }
];
