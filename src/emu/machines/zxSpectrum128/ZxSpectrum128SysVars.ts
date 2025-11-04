import { SysVar, SysVarType } from "../../../common/abstractions/SysVar";

/**
 * System variables of ZX Spectrum 128K
 */
export const zxSpectrum128SysVars: SysVar[] = [
  {
    address: 0x5b00,
    name: "SWAP",
    type: SysVarType.Array,
    length: 88,
    description: "Paging subroutines"
  },
  {
    address: 0x5b58,
    name: "TARGET",
    type: SysVarType.Word,
    description: "Subroutine address in ROM 3"
  },
  {
    address: 0x5b5a,
    name: "RETADDR",
    type: SysVarType.Word,
    description: "Return address in ROM 1"
  },
  {
    address: 0x5b5c,
    name: "BANK",
    type: SysVarType.Word,
    description:
      "Copy of last byte output to I/O port 7FFDh (32765). This port is used to " +
      "control the RAM paging (bits 0...2), the 'horizontal' ROM switch (0<->1 and 2<->3 - " +
      "bit 4), screen selection (bit 3) and added I/O disabling (bit 5).\nThis byte must be " +
      "kept up to date with the last value output to the port if interrupts are enabled."
  },
  {
    address: 0x5b5d,
    name: "RAMRST",
    type: SysVarType.Byte,
    description: "RST 8 instruction. Used by ROM 1 to report old errors to ROM 3"
  },
  {
    address: 0x5b5e,
    name: "RAMERR",
    type: SysVarType.Byte,
    description:
      "Error number passed from ROM 1 to ROM 3.\nAlso used by SAVE/LOAD as temporary drive store"
  },
  {
    address: 0x5b5f,
    name: "BAUD",
    type: SysVarType.Byte,
    description: "RS232 bit period in T states/26. Set by FORMAT LINE"
  },
  {
    address: 0x5b61,
    name: "SERFL",
    type: SysVarType.Word,
    description: "Second-character-received-flag, and data"
  },
  {
    address: 0x5b63,
    name: "COL",
    type: SysVarType.Byte,
    description: "Current column from 1 to width"
  },
  {
    address: 0x5b64,
    name: "WIDTH",
    type: SysVarType.Byte,
    description: "Paper column width. Defaults to 80"
  },
  {
    address: 0x5b65,
    name: "TVPARS",
    type: SysVarType.Byte,
    description: "Number of inline parameters expected by RS232"
  },
  {
    address: 0x5b66,
    name: "FLAGS3",
    type: SysVarType.Byte,
    description: "Various flags",
    flagDecriptions: [
      "Unused",
      "Unused",
      "Set when tokens are to be expanded on printing",
      "Set if print output is RS232.\nThe default (at reset) is Centronics.",
      "Set if a disk interface is present",
      "Set if drive B: is present",
      "Unused",
      "Unused"
    ]
  },
  {
    address: 0x5b67,
    name: "BANK678",
    type: SysVarType.Flags,
    description:
      "Copy of last byte output to I/O port 1FFDh (8189).\n" +
      "This port is used to control the +3 extended RAM and ROM switching.",
    flagDecriptions: [
      "If clear, bit 2 controls the 'vertical' ROM switch 0<->2 and 1<->3",
      "Unused",
      "'Vertical' ROM switch",
      "Set if disk motor is on",
      "Set if Centronics strobe is on",
      "Unused",
      "Unused",
      "Unused"
    ]
  },
  {
    address: 0x5b68,
    name: "XLOC",
    type: SysVarType.Byte,
    description: "Holds X location when using the unexpanded COPY command"
  },
  {
    address: 0x5b69,
    name: "YLOC",
    type: SysVarType.Byte,
    description: "Holds Y location when using the unexpanded COPY command"
  },
  {
    address: 0x5b6a,
    name: "OLDSP",
    type: SysVarType.Word,
    description: "Old SP (stack pointer) when TSTACK is in use"
  },
  {
    address: 0x5b6c,
    name: "SYNRET",
    type: SysVarType.Word,
    description: "Return address for ONERR"
  },
  {
    address: 0x5b6e,
    name: "LASTV",
    type: SysVarType.Array,
    length: 5,
    description: "Last value printed by calculator"
  },
  {
    address: 0x5b73,
    name: "RCLINE",
    type: SysVarType.Word,
    description: "Current line being renumbered"
  },
  {
    address: 0x5b75,
    name: "RCSTART",
    type: SysVarType.Word,
    description: "Starting line number for renumbering. The default value is 10."
  },
  {
    address: 0x5b77,
    name: "RCSTEP",
    type: SysVarType.Word,
    description: "Incremental value for renumbering. The default is 10."
  },
  {
    address: 0x5b79,
    name: "LODDRV",
    type: SysVarType.Byte,
    description: "Holds 'T' if LOAD, VERIFY, MERGE are from tape;\notherwise holds 'A', 'B' or 'M'"
  },
  {
    address: 0x5b7a,
    name: "SAVDRV",
    type: SysVarType.Byte,
    description: "Holds 'T' if SAVE is to tape; otherwise holds 'A', 'B' or 'M'"
  },
  {
    address: 0x5b7b,
    name: "DUMPFL",
    type: SysVarType.Byte,
    description:
      "Holds the number of 1/216ths user for line feeds\n" +
      "in 'COPY EXP'. This is normally set to 9. If problems\n" +
      "are experienced fitting a dump onto a sheet of A4 paper,\n" +
      "POKE this location with 8. This will reduce the size of\n" +
      "the dump and improve the aspect ratio slightly.\n" +
      "(The quality of the dump will be marginally degraded, however.)"
  },
  {
    address: 0x5b7c,
    name: "STRIP1",
    type: SysVarType.Array,
    length: 8,
    description: "Stripe one bitmap"
  },
  {
    address: 0x5b84,
    name: "STRIP2",
    type: SysVarType.Array,
    length: 8,
    description: "Stripe two bitmap. This extends to 5B8Bh (23436)"
  },
  {
    address: 0x5bff,
    name: "TSTACK",
    type: SysVarType.Array,
    length: 115,
    description:
      "Temporary stack grows down from here. Used when RAM page 7\n" +
      "is switched in at top of memory (while executing the editor\n" +
      "or calling +3DOS). It may safely go down to 5B8Ch (and\n" +
      "across STRIP1 and STRIP2 if necessary). This guarantees at\n" +
      "least 115 bytes of stack when BASIC calls +3DOS."
  }
];
