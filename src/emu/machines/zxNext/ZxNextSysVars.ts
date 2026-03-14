import { SysVar, SysVarType } from "@abstractions/SysVar";

/**
 * System variables of ZX Spectrum Next
 * Source: https://wiki.specnext.dev/System_Variables
 */
export const zxNextSysVars: SysVar[] = [
  // --- $5Bxx: ZX Spectrum 128K / +2A / +3 / Next workspace ---
  {
    address: 0x5b00,
    name: "SWAP",
    type: SysVarType.Array,
    length: 16,
    description: "Paging subroutine. (Do not modify.)"
  },
  {
    address: 0x5b10,
    name: "STOO",
    type: SysVarType.Array,
    length: 17,
    description:
      "Paging subroutine. Entered with interrupts already disabled and AF, BC on the stack. (Do not modify.)"
  },
  {
    address: 0x5b21,
    name: "YOUNGER",
    type: SysVarType.Array,
    length: 9,
    description: "Paging subroutine. (Do not modify.)"
  },
  {
    address: 0x5b2a,
    name: "REGNUOY",
    type: SysVarType.Array,
    length: 16,
    description: "Paging subroutine. (Do not modify.)"
  },
  {
    address: 0x5b3a,
    name: "ONERR",
    type: SysVarType.Array,
    length: 24,
    description: "Paging subroutine. (Do not modify.)"
  },
  {
    address: 0x5b52,
    name: "OLDHL",
    type: SysVarType.Word,
    description: "Temporary register store while switching ROMs."
  },
  {
    address: 0x5b54,
    name: "OLDBC",
    type: SysVarType.Word,
    description: "Temporary register store while switching ROMs."
  },
  {
    address: 0x5b56,
    name: "OLDAF",
    type: SysVarType.Word,
    description: "Temporary register store while switching ROMs."
  },
  {
    address: 0x5b58,
    name: "TARGET",
    type: SysVarType.Word,
    description: "Subroutine address in ROM 3."
  },
  {
    address: 0x5b5a,
    name: "RETADDR",
    type: SysVarType.Word,
    description: "Return address in ROM 1."
  },
  {
    address: 0x5b5c,
    name: "BANKM",
    type: SysVarType.Byte,
    description:
      "Copy of last byte output to IO:$7FFD. " +
      "This byte must be kept up to date with the last value output to the port if interrupts are enabled."
  },
  {
    address: 0x5b5d,
    name: "RAMRST",
    type: SysVarType.Byte,
    description: "RST 8 instruction. Used by ROM 1 to report old errors to ROM 3."
  },
  {
    address: 0x5b5e,
    name: "RAMERR",
    type: SysVarType.Byte,
    description:
      "Error number passed from ROM 1 to ROM 3. Also used by SAVE/LOAD as temporary drive store."
  },
  {
    address: 0x5b5f,
    name: "BAUD",
    type: SysVarType.Word,
    description: "RS232 bit period in T states/26. Set by FORMAT LINE."
  },
  {
    address: 0x5b61,
    name: "SERFL",
    type: SysVarType.Word,
    description: "Second-character-received-flag, and data."
  },
  {
    address: 0x5b63,
    name: "COL",
    type: SysVarType.Byte,
    description: "Current column from 1 to WIDTH."
  },
  {
    address: 0x5b64,
    name: "WIDTH",
    type: SysVarType.Byte,
    description: "Paper column width. Defaults to 80."
  },
  {
    address: 0x5b65,
    name: "TVPARS",
    type: SysVarType.Byte,
    description: "Number of inline parameters expected by RS232."
  },
  {
    address: 0x5b66,
    name: "FLAGS3",
    type: SysVarType.Flags,
    description: "Various flags.",
    flagDecriptions: [
      "Unlikely to be useful",
      "Unlikely to be useful",
      "Set when tokens are to be expanded on printing",
      "Set if print output is RS232 (default at reset is Centronics)",
      "Set if a disk interface is present",
      "Set if drive B: is present",
      "Unlikely to be useful",
      "Unlikely to be useful"
    ]
  },
  {
    address: 0x5b67,
    name: "BANK678",
    type: SysVarType.Byte,
    description:
      "Copy of last byte output to IO:$1FFD. " +
      "This byte must be kept up to date with the last value output to the port if interrupts are enabled."
  },
  {
    address: 0x5b68,
    name: "FLAGN",
    type: SysVarType.Byte,
    description: "Flags for the NextZXOS system. (ZX Spectrum Next specific.)"
  },
  {
    address: 0x5b69,
    name: "MAXBNK",
    type: SysVarType.Byte,
    description: "Maximum available RAM bank number. (ZX Spectrum Next specific.)"
  },
  {
    address: 0x5b6a,
    name: "OLDSP",
    type: SysVarType.Word,
    description: "Old SP (stack pointer) when TSTACK is in use."
  },
  {
    address: 0x5b6c,
    name: "SYNRET",
    type: SysVarType.Word,
    description: "Return address for ONERR."
  },
  {
    address: 0x5b6e,
    name: "LASTV",
    type: SysVarType.Array,
    length: 5,
    description: "Last value printed by calculator."
  },
  {
    address: 0x5b73,
    name: "TILEBNKL",
    type: SysVarType.Byte,
    description: "Tiles bank for Lores. (ZX Spectrum Next specific.)"
  },
  {
    address: 0x5b74,
    name: "TILEML",
    type: SysVarType.Byte,
    description: "Tilemap bank for Lores. (ZX Spectrum Next specific.)"
  },
  {
    address: 0x5b75,
    name: "TILEBNK2",
    type: SysVarType.Byte,
    description: "Tiles bank for Layer 2. (ZX Spectrum Next specific.)"
  },
  {
    address: 0x5b77,
    name: "NXTBNK",
    type: SysVarType.Byte,
    description: "Bank containing NXTLIN. (ZX Spectrum Next specific.)"
  },
  {
    address: 0x5b78,
    name: "DATABNK",
    type: SysVarType.Byte,
    description: "Bank containing DATADD. (ZX Spectrum Next specific.)"
  },
  {
    address: 0x5b79,
    name: "LODDRV",
    type: SysVarType.Byte,
    description:
      "Holds 'T' if LOAD, VERIFY, MERGE are from tape, otherwise holds 'A', 'B' or 'M'."
  },
  {
    address: 0x5b7a,
    name: "SAVDRV",
    type: SysVarType.Byte,
    description: "Holds 'T' if SAVE is to tape, otherwise holds 'A', 'B' or 'M'."
  },
  {
    address: 0x5b7b,
    name: "L2SOFT",
    type: SysVarType.Byte,
    description: "Soft copy of IO:$123B."
  },
  {
    address: 0x5b7c,
    name: "TILEWL",
    type: SysVarType.Word,
    description: "Width of Lo-res tilemap."
  },
  {
    address: 0x5b7e,
    name: "TILEW2",
    type: SysVarType.Word,
    description: "Width of Layer 2 tilemap."
  },
  {
    address: 0x5b80,
    name: "TILEOFFL",
    type: SysVarType.Word,
    description: "Offset in bank for Lo-res tilemap."
  },
  {
    address: 0x5b82,
    name: "TILEOFF2",
    type: SysVarType.Word,
    description: "Offset in bank for Layer 2 tilemap."
  },
  {
    address: 0x5b84,
    name: "COORDSL",
    type: SysVarType.Word,
    description: "x,y coords of last point plotted (lo-res)."
  },
  {
    address: 0x5b86,
    name: "COORDS2",
    type: SysVarType.Word,
    description: "x,y coords of last point plotted (layer 2)."
  },
  {
    address: 0x5b88,
    name: "COORDSULA",
    type: SysVarType.Word,
    description: "x,y coords of last point plotted (standard)."
  },
  {
    address: 0x5b8a,
    name: "COORDSHR",
    type: SysVarType.Word,
    description: "x,y coords of last point plotted (hi-res)."
  },
  {
    address: 0x5b8c,
    name: "COORDSHC",
    type: SysVarType.Word,
    description: "x,y coords of last point plotted (hi-colour)."
  },
  {
    address: 0x5b8e,
    name: "INKL",
    type: SysVarType.Byte,
    description: "INK colour for Lo-res mode."
  },
  {
    address: 0x5b8f,
    name: "INK2",
    type: SysVarType.Byte,
    description: "INK colour for Layer 2 mode."
  },
  {
    address: 0x5b90,
    name: "ATTRULA",
    type: SysVarType.Byte,
    description: "Attributes for standard mode."
  },
  {
    address: 0x5b91,
    name: "INKHR",
    type: SysVarType.Byte,
    description: "INK colour for Hi-res mode."
  },
  {
    address: 0x5b92,
    name: "ATTRHC",
    type: SysVarType.Byte,
    description: "Attributes for Hi-colour mode."
  },
  {
    address: 0x5b93,
    name: "INKMASK",
    type: SysVarType.Byte,
    description: "Softcopy of NextReg:$42 (or 0)."
  },
  {
    address: 0x5b94,
    name: "STRIP1",
    type: SysVarType.Array,
    length: 8,
    description: "Stripe one bitmap."
  },
  {
    address: 0x5b9c,
    name: "STRIP2",
    type: SysVarType.Array,
    length: 8,
    description: "Stripe two bitmap."
  },
  {
    address: 0x5bff,
    name: "TSTACK",
    type: SysVarType.Array,
    length: 91,
    description:
      "Temporary stack grows down from here. Used when RAM page 7 is switched in at top of memory " +
      "(while executing the editor or calling +3DOS). May safely go down to $5B9D."
  },
  // --- $5Cxx: Standard ZX Spectrum / Next system variables ---
  {
    address: 0x5c00,
    name: "KSTATE",
    type: SysVarType.Array,
    length: 8,
    description:
      "Used in reading the keyboard.\nThere are two sets of four bytes here,\n" +
      "each set corresponding to a separate keypress.",
    byteDescriptions: [
      "$FF if the set is unused, or a main code from the main key table otherwise",
      "Call counter; initially +05, and decremented on each call to the KEYBOARD routine",
      "Repeat delay counter; initially REPDEL, decremented on each call to KEYBOARD, " +
        "reset to REPPER whenever it reaches zero",
      "Final code from the key tables (as computed by K_DECODE)",
      "$FF if the set is unused, or a main code from the main key table otherwise",
      "Call counter; initially +05, and decremented on each call to the KEYBOARD routine",
      "Repeat delay counter; initially REPDEL, decremented on each call to KEYBOARD, " +
        "reset to REPPER whenever it reaches zero",
      "Final code from the key tables (as computed by K_DECODE)"
    ]
  },
  {
    address: 0x5c08,
    name: "LASTK",
    type: SysVarType.Byte,
    description: "Stores newly pressed key."
  },
  {
    address: 0x5c09,
    name: "REPDEL",
    type: SysVarType.Byte,
    description: "Time (in 50ths of a second) that a key must be held down before it repeats."
  },
  {
    address: 0x5c0a,
    name: "REPPER",
    type: SysVarType.Byte,
    description: "Delay (in 50ths of a second) between successive repeats of a key held down."
  },
  {
    address: 0x5c0b,
    name: "DEFADD",
    type: SysVarType.Word,
    description:
      "Address of arguments of user defined function (if one is being evaluated), otherwise 0."
  },
  {
    address: 0x5c0d,
    name: "K DATA",
    type: SysVarType.Byte,
    description: "Stores 2nd byte of colour controls entered from keyboard."
  },
  {
    address: 0x5c0e,
    name: "TVDATA",
    type: SysVarType.Byte,
    description: "Stores bytes of colour, AT and TAB controls going to TV."
  },
  {
    address: 0x5c10,
    name: "STRMS",
    type: SysVarType.Array,
    length: 38,
    description: "Addresses of channels attached to streams.",
    byteDescriptions: [
      "Stream $FD (keyboard), LSB",
      "Stream $FD (keyboard), MSB",
      "Stream $FE (screen), LSB",
      "Stream $FE (screen), MSB",
      "Stream $FF (workspace), LSB",
      "Stream $FF (workspace), MSB",
      "Stream $00 (keyboard), LSB",
      "Stream $00 (keyboard), MSB",
      "Stream $01 (keyboard), LSB",
      "Stream $01 (keyboard), MSB",
      "Stream $02 (screen), LSB",
      "Stream $02 (screen), MSB",
      "Stream $03 (printer), LSB",
      "Stream $03 (printer), MSB",
      "Stream $04, LSB",
      "Stream $04, MSB",
      "Stream $05, LSB",
      "Stream $05, MSB",
      "Stream $06, LSB",
      "Stream $06, MSB",
      "Stream $07, LSB",
      "Stream $07, MSB",
      "Stream $08, LSB",
      "Stream $08, MSB",
      "Stream $09, LSB",
      "Stream $09, MSB",
      "Stream $0A, LSB",
      "Stream $0A, MSB",
      "Stream $0B, LSB",
      "Stream $0B, MSB",
      "Stream $0C, LSB",
      "Stream $0C, MSB",
      "Stream $0D, LSB",
      "Stream $0D, MSB",
      "Stream $0E, LSB",
      "Stream $0E, MSB",
      "Stream $0F, LSB",
      "Stream $0F, MSB"
    ]
  },
  {
    address: 0x5c36,
    name: "CHARS",
    type: SysVarType.Word,
    description:
      "256 less than address of character set (which starts with space and carries on to copyright). " +
      "Normally in ROM, but you can set up your own in RAM and make CHARS point to it."
  },
  {
    address: 0x5c38,
    name: "RASP",
    type: SysVarType.Byte,
    description: "Length of warning buzz."
  },
  {
    address: 0x5c39,
    name: "PIP",
    type: SysVarType.Byte,
    description: "Length of keyboard click."
  },
  {
    address: 0x5c3a,
    name: "ERRNR",
    type: SysVarType.Byte,
    description:
      "1 less than the report code. Starts off at 255 (for -1) so PEEK 23610 gives 255."
  },
  {
    address: 0x5c3b,
    name: "FLAGS",
    type: SysVarType.Flags,
    description: "Various flags to control the BASIC system.",
    flagDecriptions: [
      "Leading space flag (set to suppress leading space)",
      "Printer flag (set when printer in use)",
      "Printer mode: K (reset) or L (set)",
      "Keyboard mode: K (reset) or L (set)",
      "Unused",
      "Set when a new key has been pressed",
      "Variable type flag: string (reset) or numeric (set)",
      "Reset when checking syntax, set during execution"
    ]
  },
  {
    address: 0x5c3c,
    name: "TVFLAG",
    type: SysVarType.Flags,
    description: "Flags associated with the TV.",
    flagDecriptions: [
      "Set when printing to the lower screen",
      "Unused",
      "Unused",
      "Set when the input mode has changed",
      "Set when an automatic listing is being produced",
      "Set when the lower screen needs clearing",
      "Unused",
      "Unused"
    ]
  },
  {
    address: 0x5c3d,
    name: "ERRSP",
    type: SysVarType.Word,
    description: "Address of item on machine stack to be used as error return."
  },
  {
    address: 0x5c3f,
    name: "LISTSP",
    type: SysVarType.Word,
    description: "Address of return address from automatic listing."
  },
  {
    address: 0x5c41,
    name: "MODE",
    type: SysVarType.Byte,
    description: "Specifies 'K', 'L', 'C', 'E' or 'G' cursor."
  },
  {
    address: 0x5c42,
    name: "NEWPPC",
    type: SysVarType.Word,
    description: "Line to be jumped to."
  },
  {
    address: 0x5c44,
    name: "NSPPC",
    type: SysVarType.Byte,
    description:
      "Statement number in line to be jumped to. " +
      "Poking first NEWPPC and then NSPPC forces a jump to a specified statement in a line."
  },
  {
    address: 0x5c45,
    name: "PPC",
    type: SysVarType.Word,
    description: "Line number of statement currently being executed."
  },
  {
    address: 0x5c47,
    name: "SUBPPC",
    type: SysVarType.Byte,
    description: "Number within line of statement currently being executed."
  },
  {
    address: 0x5c48,
    name: "BORDCR",
    type: SysVarType.Byte,
    description:
      "Border colour multiplied by 8; also contains the attributes normally used for the lower half of the screen."
  },
  {
    address: 0x5c49,
    name: "E PPC",
    type: SysVarType.Word,
    description: "Number of current line (with program cursor)."
  },
  {
    address: 0x5c4b,
    name: "VARS",
    type: SysVarType.Word,
    description: "Address of variables."
  },
  {
    address: 0x5c4d,
    name: "DEST",
    type: SysVarType.Word,
    description: "Address of variable in assignment."
  },
  {
    address: 0x5c4f,
    name: "CHANS",
    type: SysVarType.Word,
    description: "Address of channel data."
  },
  {
    address: 0x5c51,
    name: "CURCHL",
    type: SysVarType.Word,
    description: "Address of information currently being used for input and output."
  },
  {
    address: 0x5c53,
    name: "PROG",
    type: SysVarType.Word,
    description: "Address of BASIC program."
  },
  {
    address: 0x5c55,
    name: "NXTLIN",
    type: SysVarType.Word,
    description: "Address of next line in program."
  },
  {
    address: 0x5c57,
    name: "DATADD",
    type: SysVarType.Word,
    description: "Address of terminator of last DATA item."
  },
  {
    address: 0x5c59,
    name: "E LINE",
    type: SysVarType.Word,
    description: "Address of command being typed in."
  },
  {
    address: 0x5c5b,
    name: "K CUR",
    type: SysVarType.Word,
    description: "Address of cursor."
  },
  {
    address: 0x5c5d,
    name: "CH ADD",
    type: SysVarType.Word,
    description:
      "Address of the next character to be interpreted - " +
      "the character after the argument of PEEK, or the NEWLINE at the end of a POKE statement."
  },
  {
    address: 0x5c5f,
    name: "X PTR",
    type: SysVarType.Word,
    description: "Address of the character after the [] marker."
  },
  {
    address: 0x5c61,
    name: "WORKSP",
    type: SysVarType.Word,
    description: "Address of temporary work space."
  },
  {
    address: 0x5c63,
    name: "STKBOT",
    type: SysVarType.Word,
    description: "Address of bottom of calculator stack."
  },
  {
    address: 0x5c65,
    name: "STKEND",
    type: SysVarType.Word,
    description: "Address of start of spare space."
  },
  {
    address: 0x5c67,
    name: "BREG",
    type: SysVarType.Byte,
    description: "Calculator's B register."
  },
  {
    address: 0x5c68,
    name: "MEM",
    type: SysVarType.Word,
    description: "Address of area used for calculator's memory."
  },
  {
    address: 0x5c6a,
    name: "FLAGS2",
    type: SysVarType.Flags,
    description: "More flags. (Bit 3 set when CAPS SHIFT or CAPS LOCK is on.)",
    flagDecriptions: [
      "Reset when the screen is clear",
      "Set when the printer buffer is in use",
      "Set when in quotes during line parsing",
      "Set when CAPS LOCK is on",
      "Set when using channel K (keyboard)",
      "Unused",
      "Unused",
      "Unused"
    ]
  },
  {
    address: 0x5c6b,
    name: "DF SZ",
    type: SysVarType.Byte,
    description:
      "The number of lines (including one blank line) in the lower part of the screen."
  },
  {
    address: 0x5c6c,
    name: "S TOP",
    type: SysVarType.Word,
    description: "The number of the top program line in automatic listings."
  },
  {
    address: 0x5c6e,
    name: "OLDPPC",
    type: SysVarType.Word,
    description: "Line number to which CONTINUE jumps."
  },
  {
    address: 0x5c70,
    name: "OSPPC",
    type: SysVarType.Byte,
    description: "Number within line of statement to which CONTINUE jumps."
  },
  {
    address: 0x5c71,
    name: "FLAGX",
    type: SysVarType.Flags,
    description: "Various flags.",
    flagDecriptions: [
      "Set when dealing with a complete simple string",
      "Set when dealing with a new (rather than existing) variable",
      "Unused",
      "Unused",
      "Unused",
      "Reset when in editing mode, set when in INPUT mode",
      "Unused",
      "Set when dealing with INPUT LINE"
    ]
  },
  {
    address: 0x5c72,
    name: "STRLEN",
    type: SysVarType.Word,
    description: "Length of string type destination in assignment."
  },
  {
    address: 0x5c74,
    name: "T ADDR",
    type: SysVarType.Word,
    description: "Address of next item in syntax table (very unlikely to be useful)."
  },
  {
    address: 0x5c76,
    name: "SEED",
    type: SysVarType.Word,
    description: "The seed for RND. This is the variable that is set by RANDOMIZE."
  },
  {
    address: 0x5c78,
    name: "FRAMES",
    type: SysVarType.Array,
    length: 3,
    description: "3 byte (least significant byte first), frame counter incremented every 20ms.",
    byteDescriptions: ["LSB", "MSB", "MSB #2"]
  },
  {
    address: 0x5c7b,
    name: "UDG",
    type: SysVarType.Word,
    description: "Address of first user-defined graphic."
  },
  {
    address: 0x5c7d,
    name: "COORDS",
    type: SysVarType.Array,
    length: 2,
    description: "Coordinates of last point plotted.",
    byteDescriptions: ["X-coordinate", "Y-coordinate"]
  },
  {
    address: 0x5c7f,
    name: "GMODE",
    type: SysVarType.Byte,
    description: "Graphical layer/mode flags."
  },
  {
    address: 0x5c80,
    name: "PRCC",
    type: SysVarType.Word,
    description:
      "Full address of next position for LPRINT to print at (in ZX printer buffer). " +
      "Legal values 5B00-5B1F."
  },
  {
    address: 0x5c82,
    name: "ECHO E",
    type: SysVarType.Array,
    length: 2,
    description: "33-column number and 24-line number (in lower half) of end of input buffer.",
    byteDescriptions: ["Column number", "Line number"]
  },
  {
    address: 0x5c84,
    name: "DF CC",
    type: SysVarType.Word,
    description: "Address in display file of PRINT position."
  },
  {
    address: 0x5c86,
    name: "DF CCL",
    type: SysVarType.Word,
    description: "Like DF CC for lower part of screen."
  },
  {
    address: 0x5c88,
    name: "S POSN",
    type: SysVarType.Array,
    length: 2,
    description: "Column and line number for PRINT position.",
    byteDescriptions: ["33-column number for PRINT position", "24-line number for PRINT position"]
  },
  {
    address: 0x5c8a,
    name: "SPOSNL",
    type: SysVarType.Word,
    description: "Like S POSN for lower part of screen."
  },
  {
    address: 0x5c8c,
    name: "SCR CT",
    type: SysVarType.Byte,
    description:
      "Counts scrolls - it is always 1 more than the number of scrolls that will be done before stopping with 'scroll?'."
  },
  {
    address: 0x5c8d,
    name: "ATTR P",
    type: SysVarType.Byte,
    description: "Permanent current colours, etc., (as set up by colour statements)."
  },
  {
    address: 0x5c8e,
    name: "MASK P",
    type: SysVarType.Byte,
    description:
      "Used for transparent colours, etc. Any bit that is 1 shows that the corresponding attribute bit " +
      "is taken not from ATTR P, but from what is already on the screen."
  },
  {
    address: 0x5c8f,
    name: "ATTR T",
    type: SysVarType.Byte,
    description: "Temporary current colours, etc., (as set up by colour items)."
  },
  {
    address: 0x5c90,
    name: "MASK T",
    type: SysVarType.Byte,
    description: "Like MASK P, but temporary."
  },
  {
    address: 0x5c91,
    name: "P FLAG",
    type: SysVarType.Flags,
    description: "More flags.",
    flagDecriptions: [
      "OVER bit (temporary)",
      "OVER bit (permanent)",
      "INVERSE bit (temporary)",
      "INVERSE bit (permanent)",
      "INK 9 if set (temporary)",
      "INK 9 if set (permanent)",
      "PAPER 9 if set (temporary)",
      "PAPER 9 if set (permanent)"
    ]
  },
  {
    address: 0x5c92,
    name: "MEMBOT",
    type: SysVarType.Array,
    length: 30,
    description: "Calculator's memory area - used to store numbers that cannot conveniently be put on the calculator stack.",
    byteDescriptions: [
      "mem-0 (byte 0)",
      "mem-0 (byte 1)",
      "mem-0 (byte 2)",
      "mem-0 (byte 3)",
      "mem-0 (byte 4)",
      "mem-1 (byte 0)",
      "mem-1 (byte 1)",
      "mem-1 (byte 2)",
      "mem-1 (byte 3)",
      "mem-1 (byte 4)",
      "mem-2 (byte 0)",
      "mem-2 (byte 1)",
      "mem-2 (byte 2)",
      "mem-2 (byte 3)",
      "mem-2 (byte 4)",
      "mem-3 (byte 0)",
      "mem-3 (byte 1)",
      "mem-3 (byte 2)",
      "mem-3 (byte 3)",
      "mem-3 (byte 4)",
      "mem-4 (byte 0)",
      "mem-4 (byte 1)",
      "mem-4 (byte 2)",
      "mem-4 (byte 3)",
      "mem-4 (byte 4)",
      "mem-5 (byte 0)",
      "mem-5 (byte 1)",
      "mem-5 (byte 2)",
      "mem-5 (byte 3)",
      "mem-5 (byte 4)"
    ]
  },
  {
    address: 0x5cb0,
    name: "NMIADD",
    type: SysVarType.Word,
    description: "Holds the address of the users NMI service routine."
  },
  {
    address: 0x5cb2,
    name: "RAMTOP",
    type: SysVarType.Word,
    description: "Address of last byte of BASIC system area."
  },
  {
    address: 0x5cb4,
    name: "P RAMT",
    type: SysVarType.Word,
    description: "Address of last byte of physical RAM."
  }
];
