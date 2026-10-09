import { SysVar, SysVarType } from "@abstractions/SysVar";

/*
 * The ZX81's system variables, for the System Variables panel and for naming the operands that
 * read them (`ld hl,(E_LINE)`) — `.plans/REVERSE_ENGINEERING_ANNOTATIONS_PLAN.md` §4.7.
 *
 * Recorded from the ZX81 BASIC Programming manual's table of system variables (chapter 28): the
 * addresses, names and sizes are interface facts of the machine, and the descriptions are Klive's
 * own words. They apply to the 8K ROM, so a ZX80 fitted with it uses this table too.
 * `test/zx8081-hw/zx8081-sysvars.test.ts` checks them against the addresses the IDE already uses.
 */
export const zx81SysVars: SysVar[] = [
  { address: 0x4000, name: "ERR_NR", type: SysVarType.Byte, description: "The report code minus one; 255 while no error has occurred." },
  { address: 0x4001, name: "FLAGS", type: SysVarType.Flags, description: "Flags the BASIC interpreter uses while it runs." },
  { address: 0x4002, name: "ERR_SP", type: SysVarType.Word, description: "Where the error handler's return address sits on the machine stack." },
  { address: 0x4004, name: "RAMTOP", type: SysVarType.Word, description: "The first address above the memory BASIC uses." },
  { address: 0x4006, name: "MODE", type: SysVarType.Byte, description: "The cursor mode: K, L, F or G." },
  { address: 0x4007, name: "PPC", type: SysVarType.Word, description: "The number of the line being run." },
  { address: 0x4009, name: "VERSN", type: SysVarType.Byte, description: "Zero for the ZX81: the first byte a program file holds." },
  { address: 0x400a, name: "E_PPC", type: SysVarType.Word, description: "The number of the current line, the one with the program cursor." },
  { address: 0x400c, name: "D_FILE", type: SysVarType.Word, description: "Where the display file starts." },
  { address: 0x400e, name: "DF_CC", type: SysVarType.Word, description: "Where in the display file the next character is printed." },
  { address: 0x4010, name: "VARS", type: SysVarType.Word, description: "Where the BASIC variables start." },
  { address: 0x4012, name: "DEST", type: SysVarType.Word, description: "The variable an assignment is storing into." },
  { address: 0x4014, name: "E_LINE", type: SysVarType.Word, description: "Where the line being edited starts; also the end of a program file." },
  { address: 0x4016, name: "CH_ADD", type: SysVarType.Word, description: "The character the interpreter reads next." },
  { address: 0x4018, name: "X_PTR", type: SysVarType.Word, description: "The character before the syntax error marker." },
  { address: 0x401a, name: "STKBOT", type: SysVarType.Word, description: "The bottom of the calculator stack." },
  { address: 0x401c, name: "STKEND", type: SysVarType.Word, description: "The end of the calculator stack." },
  { address: 0x401e, name: "BERG", type: SysVarType.Byte, description: "The calculator's B register." },
  { address: 0x401f, name: "MEM", type: SysVarType.Word, description: "Where the calculator's memory area is." },
  { address: 0x4022, name: "DF_SZ", type: SysVarType.Byte, description: "The number of lines in the lower part of the screen, the edit area included." },
  { address: 0x4023, name: "S_TOP", type: SysVarType.Word, description: "The number of the top program line an automatic listing shows." },
  { address: 0x4025, name: "LAST_K", type: SysVarType.Word, description: "The keyboard as it was last read." },
  { address: 0x4027, name: "DB_ST", type: SysVarType.Byte, description: "The keyboard debounce status." },
  { address: 0x4028, name: "MARGIN", type: SysVarType.Byte, description: "The number of blank lines above and below the picture: 55 on a 50 Hz set, 31 on 60 Hz." },
  { address: 0x4029, name: "NXTLIN", type: SysVarType.Word, description: "The program line to be run next." },
  { address: 0x402b, name: "OLDPPC", type: SysVarType.Word, description: "The line CONT jumps back to." },
  { address: 0x402d, name: "FLAGX", type: SysVarType.Flags, description: "More interpreter flags." },
  { address: 0x402e, name: "STRLEN", type: SysVarType.Word, description: "The length of the string an assignment is storing." },
  { address: 0x4030, name: "T_ADDR", type: SysVarType.Word, description: "The next item in the syntax table." },
  { address: 0x4032, name: "SEED", type: SysVarType.Word, description: "The seed RND uses; RAND sets it." },
  { address: 0x4034, name: "FRAMES", type: SysVarType.Word, description: "Counts the frames shown down from 65535; bit 15 is set while PAUSE runs." },
  { address: 0x4036, name: "COORDS", type: SysVarType.Word, description: "The x (low byte) and y (high byte) of the last point plotted." },
  { address: 0x4038, name: "PR_CC", type: SysVarType.Byte, description: "The low byte of where LPRINT puts its next character in the printer buffer." },
  { address: 0x4039, name: "S_POSN", type: SysVarType.Word, description: "The column (low byte) and line (high byte) for PRINT." },
  { address: 0x403b, name: "CDFLAG", type: SysVarType.Flags, description: "Bit 7 is set in SLOW mode; bit 0 while the display is being produced." },
  { address: 0x403c, name: "PRBUFF", type: SysVarType.Array, length: 33, description: "The printer buffer: 32 characters and a NEWLINE." },
  { address: 0x405d, name: "MEMBOT", type: SysVarType.Array, length: 30, description: "The calculator's memory area." }
];
