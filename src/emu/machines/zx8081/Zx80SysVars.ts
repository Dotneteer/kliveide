import { SysVar, SysVarType } from "@abstractions/SysVar";

/*
 * The ZX80's system variables (the 4K ROM's), for the System Variables panel and for naming the
 * operands that read them — `.plans/REVERSE_ENGINEERING_ANNOTATIONS_PLAN.md` §4.7.
 *
 * Recorded from the ZX80 operating manual's list of system variables: the addresses, names and sizes
 * are interface facts of the machine, and the descriptions are Klive's own words. A ZX80 fitted with
 * the 8K ROM runs the ZX81's BASIC and uses `zx81SysVars` instead. The order of `VARS`, `E_LINE` and
 * `D_FILE` is also what `ZxPFile` reads a `.o` file by.
 */
export const zx80SysVars: SysVar[] = [
  { address: 0x4000, name: "ERR_NR", type: SysVarType.Byte, description: "The report code minus one; 255 while no error has occurred." },
  { address: 0x4001, name: "FLAGS", type: SysVarType.Flags, description: "Flags the BASIC interpreter uses while it runs." },
  { address: 0x4002, name: "PPC", type: SysVarType.Word, description: "The number of the line being run." },
  { address: 0x4004, name: "P_PTR", type: SysVarType.Word, description: "Where the interpreter is in the program." },
  { address: 0x4006, name: "E_PPC", type: SysVarType.Word, description: "The number of the current line, the one with the program cursor." },
  { address: 0x4008, name: "VARS", type: SysVarType.Word, description: "Where the BASIC variables start." },
  { address: 0x400a, name: "E_LINE", type: SysVarType.Word, description: "Where the line being edited starts; also the end of a program file." },
  { address: 0x400c, name: "D_FILE", type: SysVarType.Word, description: "Where the display file starts." },
  { address: 0x400e, name: "DF_EA", type: SysVarType.Word, description: "Where the lower part of the display starts." },
  { address: 0x4010, name: "DF_END", type: SysVarType.Word, description: "Where the display file ends." },
  { address: 0x4012, name: "DF_SZ", type: SysVarType.Byte, description: "The number of lines in the lower part of the screen." },
  { address: 0x4013, name: "S_TOP", type: SysVarType.Word, description: "The number of the top program line an automatic listing shows." },
  { address: 0x4015, name: "X_PTR", type: SysVarType.Word, description: "Where the syntax error marker is." },
  { address: 0x4017, name: "OLDPPC", type: SysVarType.Word, description: "The line CONTINUE jumps back to." },
  { address: 0x4019, name: "FLAGX", type: SysVarType.Flags, description: "More interpreter flags." },
  { address: 0x401a, name: "T_ADDR", type: SysVarType.Word, description: "The next item in the syntax table." },
  { address: 0x401c, name: "SEED", type: SysVarType.Word, description: "The seed RND uses; RANDOMISE sets it." },
  { address: 0x401e, name: "FRAMES", type: SysVarType.Word, description: "Counts the frames shown." },
  { address: 0x4020, name: "DEST", type: SysVarType.Word, description: "The variable an assignment is storing into." },
  { address: 0x4022, name: "RESULT", type: SysVarType.Word, description: "The value of the last expression evaluated." },
  { address: 0x4024, name: "S_POSN", type: SysVarType.Word, description: "The column (low byte) and line (high byte) for PRINT." },
  { address: 0x4026, name: "CH_ADD", type: SysVarType.Word, description: "The character the interpreter reads next." }
];
