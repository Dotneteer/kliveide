import { SysVar, SysVarType } from "@abstractions/SysVar";

/*
 * SAM BASIC's system variables, for the System Variables panel and for naming the operands that read
 * them (`dev/plans/SAM_COUPE_PLAN.md` §11). Addresses are in section B (page 0) under BASIC's paging.
 *
 * The names and addresses are MGT's, from the SAM Coupé Technical Manual v3.0 as the research pack
 * records them (STORAGE_FIRMWARE_SOFTWARE.md §3.3-§3.4, §5.5 of the ASIC notes), not from any emulator's
 * symbol file; the descriptions are Klive's own words. Only the variables the manual documents are
 * listed; the ROM's private workspace is not.
 */
export const samSysVars: SysVar[] = [
  { address: 0x5100, name: "ALLOCT", type: SysVarType.Array, length: 33, description: "The page allocation table: a byte per page (FFh not fitted, 00h free, 40h BASIC, C0h screen, 60h DOS, 20h utilities), then FFh." },
  { address: 0x5a40, name: "MODE", type: SysVarType.Byte, description: "The current screen mode, 0-3 for modes 1-4." },
  { address: 0x5a9f, name: "PROGP", type: SysVarType.Byte, description: "The page of the BASIC program's start." },
  { address: 0x5aa0, name: "PROG", type: SysVarType.Word, description: "The offset (8000h-BFFFh) of the BASIC program's start." },
  { address: 0x5ad1, name: "LASTSTAT", type: SysVarType.Byte, description: "STATUS as the interrupt handler last read it." },
  { address: 0x5ae0, name: "NMIV", type: SysVarType.Word, description: "The NMI (BREAK) vector; 0 for the ROM's own handling." },
  { address: 0x5ae2, name: "FRAMIV", type: SysVarType.Word, description: "The frame interrupt vector, called on every frame interrupt; 0 for none." },
  { address: 0x5ae4, name: "LINIV", type: SysVarType.Word, description: "The line interrupt vector." },
  { address: 0x5ae6, name: "COMSV", type: SysVarType.Word, description: "The comms (MIDI IN) interrupt vector." },
  { address: 0x5ae8, name: "MIPV", type: SysVarType.Word, description: "The MIDI IN vector." },
  { address: 0x5aea, name: "MOPV", type: SysVarType.Word, description: "The MIDI OUT interrupt vector." },
  { address: 0x5aee, name: "RST8V", type: SysVarType.Word, description: "The RST 8 vector: error codes and DOS hooks pass through it." },
  { address: 0x5af0, name: "RST28V", type: SysVarType.Word, description: "The RST 28h (calculator) vector." },
  { address: 0x5af2, name: "RST30V", type: SysVarType.Word, description: "The RST 30h vector, the user's restart." },
  { address: 0x5afc, name: "MOUSV", type: SysVarType.Word, description: "The mouse vector: lets a program take over the ROM's mouse scan." },
  { address: 0x5b70, name: "ANYIV", type: SysVarType.Word, description: "Called on every interrupt with B = LMPR and C = STATUS." },
  { address: 0x5bc0, name: "DOSER", type: SysVarType.Word, description: "A routine the DOS returns errors through, if set." },
  { address: 0x5bc2, name: "DOSFLG", type: SysVarType.Byte, description: "The DOS's page; 0 when no DOS is loaded." },
  { address: 0x5c08, name: "LAST_K", type: SysVarType.Byte, description: "The last key pressed." },
  { address: 0x5c3a, name: "ERR_NR", type: SysVarType.Byte, description: "The error code minus one." },
  { address: 0x5c3b, name: "FLAGS", type: SysVarType.Flags, description: "BASIC's flags (bit 5: a new key)." },
  { address: 0x5c48, name: "BORDCR", type: SysVarType.Byte, description: "The border colour and the lower screen's attributes." },
  { address: 0x5c78, name: "FRAMES", type: SysVarType.Array, length: 3, description: "The frame counter, incremented on every frame interrupt." },
  { address: 0x5cb4, name: "PRAMTP", type: SysVarType.Byte, description: "The last physical RAM page fitted (15 or 31)." }
];
