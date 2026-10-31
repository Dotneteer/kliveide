import { SysVar, SysVarType } from "@abstractions/SysVar";

/*
 * The Enterprise's EXOS system variables, for the System Variables panel and for naming the operands
 * that read them (`ld hl,(LP_POINTER)`) — `.plans/ENTERPRISE_PLAN.md` §11.
 *
 * Recorded from the EXOS 2.1 kernel specification (`_input/enterprise128/docs/Exos.htm`, §5.4 "Using
 * the system segment", and part II, §1 "System segment addresses"): the addresses, names and sizes
 * are interface facts of EXOS, and the descriptions are Klive's own words. These are the variables at
 * fixed addresses at the top of the system segment (segment FFh); the rest of that segment moves
 * between EXOS versions and configurations, so it is not listed.
 *
 * The addresses are Z80 addresses with segment FFh in page 2 (8000h-BFFFh), the way EXOS itself maps
 * it during a call. The panel reads the CPU's view, so the values are EXOS's only while page 2 holds
 * segment FFh.
 *
 * The two sections of the specification disagree on CRDISP_FLAG (BFEFh in §5.4, BFEEh in part II,
 * where it would overlap USER_ISR). The EXOS 2.1 ROM reads it with `ld a,($BFEF)` and reads and
 * writes USER_ISR as a word at BFEDh, so §5.4 is the one recorded here.
 */
export const epSysVars: SysVar[] = [
  {
    address: 0xbfed,
    name: "USER_ISR",
    type: SysVarType.Word,
    description: "The address of the user's interrupt routine, in page 0; zero when there is none."
  },
  {
    address: 0xbfef,
    name: "CRDISP_FLAG",
    type: SysVarType.Byte,
    description: "Non-zero stops the ENTERPRISE start-up banner; a ROM extension may set it while it initialises."
  },
  {
    address: 0xbff0,
    name: "SEC_COUNTER",
    type: SysVarType.Word,
    description: "A 16-bit counter of seconds, free for programs: EXOS and its built-in devices do not use it."
  },
  {
    address: 0xbff2,
    name: "FLAG_SOFT_IRQ",
    type: SysVarType.Byte,
    description: "Set to a non-zero code to raise a software interrupt; the code is the interrupt's reason."
  },
  {
    address: 0xbff3,
    name: "PORTB5",
    type: SysVarType.Byte,
    description: "A copy of what was last written to output port B5h, so a device can change one bit of it."
  },
  {
    address: 0xbff4,
    name: "LP_POINTER",
    type: SysVarType.Word,
    description: "The Z80 address of the start of NICK's line parameter table, the status line's block first."
  },
  {
    address: 0xbff6,
    name: "ST_POINTER",
    type: SysVarType.Word,
    description: "The Z80 address of the status line's 42 bytes of text."
  },
  {
    address: 0xbff8,
    name: "RST_ADDR",
    type: SysVarType.Word,
    description: "Where the RESET key warm-starts, in page 0; EXOS clears it before jumping there, so two quick resets give a cold start."
  },
  {
    address: 0xbffa,
    name: "STACK_LIMIT",
    type: SysVarType.Word,
    description: "The lowest address of the system stack a device may use, for devices that need more stack than the default."
  },
  {
    address: 0xbffc,
    name: "USR_P0",
    type: SysVarType.Byte,
    description: "The segment that was in page 0 when EXOS was last called."
  },
  {
    address: 0xbffd,
    name: "USR_P1",
    type: SysVarType.Byte,
    description: "The segment that was in page 1 when EXOS was last called."
  },
  {
    address: 0xbffe,
    name: "USR_P2",
    type: SysVarType.Byte,
    description: "The segment that was in page 2 when EXOS was last called."
  },
  {
    address: 0xbfff,
    name: "USR_P3",
    type: SysVarType.Byte,
    description: "The segment that was in page 3 when EXOS was last called."
  }
];
