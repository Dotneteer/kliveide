/*
 * The one model every ZX Spectrum snapshot format parses into (`.plans/ZX_SPECTRUM_SNAPSHOT_PLAN.md`
 * §4.1, decision D1). Mapping, machine loading, orchestration and the viewer's machine sections all
 * work on this model and never on a file format; format-specific detail survives only as
 * `header` items (and `chunks` for `.szx`) for the viewer's "File" section.
 *
 * Pure: no Node, no DOM.
 */

/** The size of a ZX Spectrum RAM bank (and of a ROM page) */
export const SPECTRUM_BANK_SIZE = 0x4000;

/** The file formats Klive reads */
export type SpectrumSnapshotFormat = "sna" | "z80" | "szx";

/** The machines a snapshot can name that Klive can run (some with a warning, see the mapping) */
export type SnapshotMachineKind =
  | "16k"
  | "48k"
  | "48k-ntsc"
  | "128k"
  | "plus2"
  | "plus2a"
  | "plus3"
  | "plus3e"
  | "pentagon"
  | "tc2048"
  | "tc2068"
  | "ts2068"
  | "scorpion";

/**
 * The machine the snapshot was taken on, as the file says it. `unsupported` names a machine Klive
 * has no core for (Pentagon 512/1024, Scorpion, SamRam, Timex, ...): the file still parses and is shown, but
 * the mapping refuses to load it (D2).
 */
export type SnapshotMachine = SnapshotMachineKind | { unsupported: string };

/** The Z80's state */
export type SpectrumSnapshotCpu = {
  af: number;
  bc: number;
  de: number;
  hl: number;
  af_: number;
  bc_: number;
  de_: number;
  hl_: number;
  ix: number;
  iy: number;
  sp: number;
  pc: number;
  i: number;
  /** All 8 bits, bit 7 included */
  r: number;
  im: number;
  iff1: boolean;
  iff2: boolean;
  /** The CPU is executing HALT (PC is on the HALT opcode, as in Klive's core) */
  halted?: boolean;
  /** Interrupts are not accepted before the next instruction (after EI, or a DD/FD prefix) */
  suppressInterrupt?: boolean;
  /** MEMPTR (WZ), when the file has it */
  memptr?: number;
};

/** The ULA's state */
export type SpectrumSnapshotUla = {
  /** The border colour, 0-7 */
  border: number;
  /** The last value written to port $FE, when the file has it (only MIC/EAR are reliable) */
  lastFe?: number;
  /** T-states since the start of the frame (the interrupt), when the file has it */
  frameTact?: number;
  /** `.szx`: the machine used the alternate (late) ULA timings */
  alternateTimings?: boolean;
};

/** Memory paging ports */
export type SpectrumSnapshotPaging = {
  port7ffd: number;
  /** +2A/+3 and Scorpion only */
  port1ffd?: number;
};

/** An 8K page of a 2068's DOCK or EXROM bank (`.szx` DOCK block) */
export type SnapshotDockPage = {
  /** 0-7: the chunk */
  page: number;
  /** The DOCK bank (else the EXROM bank) */
  dock: boolean;
  /** Read-write */
  ram: boolean;
  /** The 8K */
  data: Uint8Array;
};

/** The Timex SCLD's registers (`.szx` SCLD block; `.z80` bytes 35-36 in a Timex mode) */
export type SpectrumSnapshotTimex = {
  /** Port $F4, the 2068's chunk paging (0 on the TC2048) */
  portF4: number;
  /** Port $FF: the screen mode, the 64-column colours, the interrupt inhibit, the EXROM select */
  portFf: number;
  /** The cartridge's pages (the 2068s; `.szx` only) */
  dock?: SnapshotDockPage[];
};

/** The AY-3-8912 sound chip */
export type SpectrumSnapshotAy = {
  /** The selected register (the last OUT to $FFFD) */
  selected: number;
  /** R0..R15 */
  regs: Uint8Array;
  /** The chip was an add-on of a 16K/48K (Melodik, Fuller Box) */
  on48k?: boolean;
};

/** A disk a `.szx` file says is in a +3 drive */
export type SnapshotDisk = {
  /** 0 = A:, 1 = B: */
  drive: number;
  /** The linked disk image file */
  fileName?: string;
  /** An embedded image (the spec reserves it, but no writer produces it today) */
  embedded?: Uint8Array;
  /** Side B of a double-sided disk is the active one */
  sideB?: boolean;
};

/** A tape a `.szx` file says is in the cassette recorder */
export type SnapshotTape = {
  /** The tape head's block, from 0 */
  currentBlock: number;
  /** The linked tape file */
  fileName?: string;
  /** An embedded tape image (decompressed) */
  embedded?: Uint8Array;
  /** The file extension of an embedded image ("tap", "tzx", ...) */
  extension?: string;
};

/** Hardware around the machine the file records, which Klive uses or warns about */
export type SpectrumSnapshotPeripherals = {
  /** Issue 2 keyboard emulation (16K/48K) */
  issue2?: boolean;
  /** The joystick the file says was emulated */
  joystick?: string;
  /** Interface 1 was present (or its ROM paged) */
  interface1?: boolean;
  /** An M.G.T. (Disciple/Plus D) interface was present */
  mgt?: boolean;
  /** A Multiface ROM was paged */
  multiface?: boolean;
  /** The TR-DOS ROM was paged (`.sna` 128K, or the `.szx` B128 block) */
  trdosPaged?: boolean;
  /** The Beta 128 disk interface (`.szx` B128 and BDSK blocks; `.plans/BETA128_TRDOS_PLAN.md`) */
  beta128?: SnapshotBeta128;
  /** A custom ROM (`.szx` ROM block), which Klive does not install */
  customRomSize?: number;
  /** +3 disk drives */
  plus3?: { drives: number; motorOn: boolean; disks: SnapshotDisk[] };
  /** The cassette recorder */
  tape?: SnapshotTape;
};

/** A disk in a Beta 128 drive (`.szx` BDSK block) */
export type SnapshotBetaDisk = {
  drive: number;
  /** Where the head is */
  cylinder: number;
  /** The image format: 0 TRD, 1 SCL, 2 FDI, 3 UDI (zx-state `ZXSTBDT_*`) */
  diskType: number;
  writeProtected: boolean;
  fileName?: string;
  embedded?: Uint8Array;
};

/** The Beta 128's state (`.szx` B128 block) */
export type SnapshotBeta128 = {
  drives: number;
  paged: boolean;
  /** The system register (port $FF) and the WD1793's registers */
  system: number;
  track: number;
  sector: number;
  data: number;
  status: number;
  disks: SnapshotBetaDisk[];
};

/** A header field, as the viewer's "File" section lists it */
export type SnapshotHeaderItem = {
  label: string;
  value: string;
};

/** A `.szx` block, as the viewer lists it */
export type SnapshotChunkInfo = {
  id: string;
  size: number;
  /** Klive reads this block */
  known: boolean;
};

/** A parsed snapshot, whatever its format */
export type SpectrumSnapshot = {
  format: SpectrumSnapshotFormat;
  /** "48K", "128K" (`.sna`), "v1".."v3" (`.z80`), "1.4" (`.szx`) */
  formatVersion: string;
  machine: SnapshotMachine;
  cpu: SpectrumSnapshotCpu;
  ula: SpectrumSnapshotUla;
  paging?: SpectrumSnapshotPaging;
  /** The Timex machines' SCLD */
  timex?: SpectrumSnapshotTimex;
  /**
   * 16K RAM banks in 128K numbering, for every machine: a 48K snapshot holds banks 5 ($4000),
   * 2 ($8000) and 0 ($C000); a 16K one holds bank 5 only.
   */
  ram: Map<number, Uint8Array>;
  ay?: SpectrumSnapshotAy;
  peripherals: SpectrumSnapshotPeripherals;
  header: SnapshotHeaderItem[];
  /** `.szx` only: every block of the file, in order */
  chunks?: SnapshotChunkInfo[];
  /** `.szx` only: the program that wrote the file */
  creator?: string;
  /** Things the parser noticed that do not stop it */
  warnings: string[];
};

/** The banks a 48K address-space slot holds (`$4000`, `$8000`, `$C000`) */
export const SPECTRUM_48K_BANKS: readonly [number, number, number] = [5, 2, 0];

/** The display name of a snapshot machine */
export function snapshotMachineName(machine: SnapshotMachine): string {
  if (typeof machine === "object") {
    return machine.unsupported;
  }
  switch (machine) {
    case "16k":
      return "ZX Spectrum 16K";
    case "48k":
      return "ZX Spectrum 48K";
    case "48k-ntsc":
      return "ZX Spectrum 48K (NTSC)";
    case "128k":
      return "ZX Spectrum 128K";
    case "plus2":
      return "ZX Spectrum +2";
    case "plus2a":
      return "ZX Spectrum +2A";
    case "plus3":
      return "ZX Spectrum +3";
    case "plus3e":
      return "ZX Spectrum +3e";
    case "pentagon":
      return "Pentagon 128";
    case "tc2048":
      return "Timex TC2048";
    case "tc2068":
      return "Timex TC2068";
    case "ts2068":
      return "Timex TS2068";
    case "scorpion":
      return "Scorpion ZS-256";
  }
}

/** Is this a machine with 128K paging (`$7FFD`)? */
export function isPagedSnapshotMachine(machine: SnapshotMachine): boolean {
  return (
    machine === "128k" ||
    machine === "plus2" ||
    machine === "plus2a" ||
    machine === "plus3" ||
    machine === "plus3e" ||
    machine === "pentagon" ||
    machine === "scorpion"
  );
}

/** The 16K RAM banks a paged machine holds: sixteen on the Scorpion ZS-256, eight elsewhere */
export function snapshotBankCount(machine: SnapshotMachine): number {
  return machine === "scorpion" ? 16 : 8;
}

/** Is this a +2A/+3 family machine (`$1FFD`)? */
export function isPlus3SnapshotMachine(machine: SnapshotMachine): boolean {
  return machine === "plus2a" || machine === "plus3" || machine === "plus3e";
}

/** Is this a Timex machine (the SCLD's port $FF)? */
export function isTimexSnapshotMachine(machine: SnapshotMachine): boolean {
  return machine === "tc2048" || machine === "tc2068" || machine === "ts2068";
}

/** Is this a Timex 2068 (the chunk map, the built-in AY, the DOCK)? */
export function isTimex2068SnapshotMachine(machine: SnapshotMachine): boolean {
  return machine === "tc2068" || machine === "ts2068";
}

/** The machine's frame length in T-states (the cores' values) */
export function snapshotFrameLength(machine: SnapshotMachine): number {
  if (machine === "48k-ntsc") return 59136;
  if (machine === "ts2068") return 58688;
  if (machine === "pentagon") return 71680;
  return isPagedSnapshotMachine(machine) ? 70908 : 69888;
}

// --- Little helpers the parsers share

/** Reads a little-endian 16-bit word */
export function readWord(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

/** Reads a little-endian 32-bit unsigned value */
export function readDword(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] |
      (bytes[offset + 1] << 8) |
      (bytes[offset + 2] << 16) |
      (bytes[offset + 3] << 24)) >>>
    0
  );
}

/** Formats a value as `$XX` / `$XXXX` */
export function hex(value: number, digits = 2): string {
  return "$" + value.toString(16).toUpperCase().padStart(digits, "0");
}
