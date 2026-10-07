/*
 * The ZX Spectrum Next zxnDMA program decoder.
 *
 * One pure module (no React, no Node), a sibling of `copperDecoder.ts`. It reads the byte stream a
 * program uploads to port `$6B` and splits it into register writes the way the DMA does: the
 * follow-byte bits of each base byte - not the assembler's conventions - decide how many bytes a
 * write takes. See `.plans/NEX_DMA_COPPER_REGIONS_PLAN.md` §4 (decisions D1, D2, D9).
 *
 * The sequencing is that of `zxnextDmaWriteBase` / `zxnextDmaWritePort` in
 * `src/emu/machines/zxNext/wasm/zxnext/zxnext-dma.c`, whose reference is
 * `_input/next-fpga/src/device/dma.vhd`. In short, for a base byte `d`:
 *
 *   D7=0, D1D0≠00       WR0  D3/D4 port A low/high, D5/D6 block length low/high follow
 *   D7=0, D2D1D0=100    WR1  D6: a timing byte follows; its D5: one more byte (swallowed)
 *   D7=0, D2D1D0=000    WR2  D6: a timing byte follows; its D5: the prescaler follows
 *   D7=1, D1D0=00       WR3  D3: mask, D4: match follow (both ignored by the Next)
 *   D7=1, D1D0=01       WR4  D2/D3: port B low/high follow; D4 alone: the DMA goes deaf
 *   D7=1, D1D0=10       WR5  only when D7D6=10 and D2D1D0=010; any other such byte is ignored
 *   D7=1, D1D0=11       WR6  a command; $BB takes one follow byte (the read mask)
 *
 * The module knows nothing about annotations or listings: it takes bytes and a range and returns
 * commands and text, so an editor hover or a DMA panel can use it unchanged.
 */

/** What a follow byte (or a pair of them) carries. */
export type DmaFieldRole =
  | "portA"
  | "portALo"
  | "portAHi"
  | "length"
  | "lengthLo"
  | "lengthHi"
  | "portB"
  | "portBLo"
  | "portBHi"
  | "timing"
  /** WR1's second timing byte: port A has no prescaler, so the DMA swallows it. */
  | "timingExtra"
  | "prescaler"
  | "mask"
  | "match"
  | "readMask";

/** One follow field: a single byte, or a little-endian pair of bytes. */
export type DmaField = {
  /** Offset of the field's first byte in the decoded byte array */
  offset: number;
  size: 1 | 2;
  value: number;
  role: DmaFieldRole;
};

type DmaCommandCommon = {
  /** Offset of the base byte in the decoded byte array */
  offset: number;
  /** The base byte */
  base: number;
  /** Every byte of the command that is inside the decoded range, the base byte first */
  bytes: number[];
  /** The complete follow fields that are inside the decoded range, in stream order */
  fields: DmaField[];
  /** How many follow bytes the DMA still expects past the end of the range (0: complete) */
  missing: number;
};

/** The address modes of WR1/WR2 (D5D4): `11` is not a mode the `.dma` pragma can write. */
export const DMA_ADDR_MODES = ["decrement", "increment", "fixed"] as const;

/** The operating modes of WR4 (D6D5): `11` is not a mode the `.dma` pragma can write. */
export const DMA_OPERATING_MODES = ["byte", "continuous", "burst"] as const;

/** The transfer types of WR0 (D1D0): `00` is not a WR0 at all. */
export const DMA_TRANSFER_TYPES = [undefined, "transfer", "search", "search_transfer"] as const;

export type DmaCommand = DmaCommandCommon &
  (
    | {
        kind: "wr0";
        dirAtoB: boolean;
        /** D1D0: 1 = transfer, 2 = search, 3 = search + transfer */
        transferType: number;
        portA?: number;
        blockLength?: number;
      }
    | {
        kind: "wr1" | "wr2";
        portIsIo: boolean;
        /** D5D4: 0 = decrement, 1 = increment, 2 = fixed, 3 = (not writable by the pragma) */
        addrMode: number;
        /** The timing byte, when D6 announces one */
        timing?: number;
        /** WR2: the prescaler; WR1: the swallowed byte */
        prescaler?: number;
      }
    | {
        kind: "wr3";
        dmaEnable: boolean;
        intEnable: boolean;
        stopOnMatch: boolean;
        mask?: number;
        match?: number;
      }
    | {
        kind: "wr4";
        /** D6D5: 0 = byte, 1 = continuous, 2 = burst, 3 = (not writable by the pragma) */
        mode: number;
        portB?: number;
        /**
         * D4 set with D2 and D3 clear: the DMA enters a write state that has no handler in
         * `dma.vhd` and ignores every later write until a hardware reset.
         */
        deaf: boolean;
      }
    | { kind: "wr5"; autoRestart: boolean }
    | { kind: "wr6"; command: number; readMask?: number }
    /** D7=1, D1D0=10, but not `10xxx010`: the DMA ignores the byte. */
    | { kind: "invalid" }
  );

export type DmaCommandKind = DmaCommand["kind"];

/** The number of bytes a command covers inside the decoded range. */
export const dmaCommandSize = (cmd: DmaCommand) => cmd.bytes.length;

// ---------------------------------------------------------------------------------------------
// Decoding
// ---------------------------------------------------------------------------------------------

type PlannedRole = Exclude<DmaFieldRole, "portA" | "length" | "portB">;

/** The register group of a base byte, as `zxnextDmaWriteBase` decides it. */
export function dmaGroupOf(base: number): DmaCommandKind {
  base &= 0xff;
  if ((base & 0x80) === 0) {
    if (base & 0x03) return "wr0";
    return base & 0x04 ? "wr1" : "wr2";
  }
  switch (base & 0x03) {
    case 0:
      return "wr3";
    case 1:
      return "wr4";
    case 2:
      return (base & 0xc7) === 0x82 ? "wr5" : "invalid";
    default:
      return "wr6";
  }
}

/** The follow bytes a base byte announces, in the order the DMA takes them. */
function plannedFollow(base: number): PlannedRole[] {
  const roles: PlannedRole[] = [];
  switch (dmaGroupOf(base)) {
    case "wr0":
      if (base & 0x08) roles.push("portALo");
      if (base & 0x10) roles.push("portAHi");
      if (base & 0x20) roles.push("lengthLo");
      if (base & 0x40) roles.push("lengthHi");
      break;
    case "wr1":
    case "wr2":
      // --- The byte after the timing byte depends on the timing byte's own D5: decided later
      if (base & 0x40) roles.push("timing");
      break;
    case "wr3":
      if (base & 0x08) roles.push("mask");
      if (base & 0x10) roles.push("match");
      break;
    case "wr4":
      // --- D4 has no follow byte of its own when D2 or D3 is set: the sequencer stops after them
      if (base & 0x04) roles.push("portBLo");
      if (base & 0x08) roles.push("portBHi");
      break;
    case "wr6":
      if ((base & 0xff) === 0xbb) roles.push("readMask");
      break;
  }
  return roles;
}

const PAIRS: Partial<Record<PlannedRole, [PlannedRole, DmaFieldRole]>> = {
  portALo: ["portAHi", "portA"],
  lengthLo: ["lengthHi", "length"],
  portBLo: ["portBHi", "portB"]
};

/**
 * Decodes the DMA command whose base byte is at `offset`. Never reads at or past `end`.
 * @param bytes The byte array
 * @param offset The base byte's offset
 * @param end The exclusive end of the range
 */
export function decodeDmaCommand(bytes: ArrayLike<number>, offset: number, end: number): DmaCommand {
  const base = (bytes[offset] ?? 0) & 0xff;
  const kind = dmaGroupOf(base);
  const planned = plannedFollow(base);
  const taken: { role: PlannedRole; offset: number; value: number }[] = [];
  let at = offset + 1;
  for (let i = 0; i < planned.length; i++) {
    if (at >= end) break;
    const value = (bytes[at] ?? 0) & 0xff;
    taken.push({ role: planned[i], offset: at, value });
    at++;
    // --- WR1/WR2: the timing byte's D5 announces one more byte
    if (planned[i] === "timing" && value & 0x20) {
      planned.push(kind === "wr1" ? "timingExtra" : "prescaler");
    }
  }
  const missing = planned.length - taken.length;

  // --- Pair up adjacent low/high bytes into 16-bit fields
  const fields: DmaField[] = [];
  for (let i = 0; i < taken.length; i++) {
    const pair = PAIRS[taken[i].role];
    if (pair && taken[i + 1]?.role === pair[0]) {
      fields.push({
        offset: taken[i].offset,
        size: 2,
        value: taken[i].value | (taken[i + 1].value << 8),
        role: pair[1]
      });
      i++;
    } else {
      fields.push({ offset: taken[i].offset, size: 1, value: taken[i].value, role: taken[i].role });
    }
  }

  const common: DmaCommandCommon = {
    offset,
    base,
    bytes: [base, ...taken.map((t) => t.value)],
    fields,
    missing
  };
  const field = (role: DmaFieldRole) => fields.find((f) => f.role === role)?.value;

  switch (kind) {
    case "wr0":
      return {
        ...common,
        kind,
        dirAtoB: (base & 0x04) !== 0,
        transferType: base & 0x03,
        portA: field("portA"),
        blockLength: field("length")
      };
    case "wr1":
    case "wr2":
      return {
        ...common,
        kind,
        portIsIo: (base & 0x08) !== 0,
        addrMode: (base >> 4) & 0x03,
        timing: field("timing"),
        prescaler: field(kind === "wr1" ? "timingExtra" : "prescaler")
      };
    case "wr3":
      return {
        ...common,
        kind,
        dmaEnable: (base & 0x40) !== 0,
        intEnable: (base & 0x20) !== 0,
        stopOnMatch: (base & 0x04) !== 0,
        mask: field("mask"),
        match: field("match")
      };
    case "wr4":
      return {
        ...common,
        kind,
        mode: (base >> 5) & 0x03,
        portB: field("portB"),
        deaf: (base & 0x1c) === 0x10
      };
    case "wr5":
      return { ...common, kind, autoRestart: (base & 0x20) !== 0 };
    case "wr6":
      return { ...common, kind, command: base, readMask: field("readMask") };
    default:
      return { ...common, kind: "invalid" };
  }
}

/**
 * Decodes a DMA program greedily, one command after the other, the way the DMA takes the bytes.
 * A command whose follow bytes run past `end` is returned with `missing > 0`; nothing at or past
 * `end` is ever read.
 * @param bytes The byte array
 * @param start The offset of the first base byte (default 0)
 * @param end The exclusive end of the program (default: the array length)
 */
export function decodeDmaStream(
  bytes: ArrayLike<number>,
  start = 0,
  end = bytes.length
): DmaCommand[] {
  const result: DmaCommand[] = [];
  end = Math.min(end, bytes.length);
  for (let offset = start; offset < end; ) {
    const cmd = decodeDmaCommand(bytes, offset, end);
    result.push(cmd);
    offset += cmd.bytes.length;
  }
  return result;
}

// ---------------------------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------------------------

export type DmaFormatOptions = {
  /** Numbers in decimal rather than `$`-hex */
  decimal?: boolean;
};

export type DmaFormattedCommand = {
  /** Source text that assembles (with `.model next`) to exactly the command's bytes */
  text: string;
  /** Whether the text is a `.dma` pragma of the register group, rather than a raw fallback */
  representable: boolean;
};

const hex = (value: number, digits: number) => value.toString(16).toUpperCase().padStart(digits, "0");

export const formatDmaByte = (value: number, opts?: DmaFormatOptions) =>
  opts?.decimal ? `${value & 0xff}` : `$${hex(value & 0xff, 2)}`;

export const formatDmaWord = (value: number, opts?: DmaFormatOptions) =>
  opts?.decimal ? `${value & 0xffff}` : `$${hex(value & 0xffff, 4)}`;

/** `WR0` … `WR6`, or `—` for an ignored byte. */
export function dmaGroupName(kind: DmaCommandKind): string {
  return kind === "invalid" ? "—" : kind.toUpperCase();
}

/** The cycle-length keyword of a timing byte's D1D0, or undefined for `11`. */
function cycleKeyword(timing: number): string | undefined {
  return ["4t", "3t", "2t"][timing & 0x03];
}

const WR6_KEYWORDS: Record<number, string> = {
  0xc3: "reset",
  0xcf: "load",
  0x87: "enable",
  0x83: "disable",
  0xd3: "continue"
};

const rawBytes = (bytes: number[], opts?: DmaFormatOptions): DmaFormattedCommand =>
  bytes.length === 1
    ? { text: `.dma cmd ${formatDmaByte(bytes[0], opts)}`, representable: false }
    : { text: `.defb ${bytes.map((b) => formatDmaByte(b, opts)).join(", ")}`, representable: false };

/**
 * The pragma that emits only the base byte of a command whose follow bytes are written as data
 * (the documented runtime-patching form): `.dma wr0 a_to_b, transfer` or `.dma wr4 continuous`.
 * Any other base byte is `.dma cmd $xx`, which also emits exactly one byte.
 */
export function formatDmaBase(cmd: DmaCommand, opts?: DmaFormatOptions): DmaFormattedCommand {
  if (cmd.kind === "wr0" && (cmd.base & 0x78) === 0x78) {
    return {
      text: `.dma wr0 ${cmd.dirAtoB ? "a_to_b" : "b_to_a"}, ${DMA_TRANSFER_TYPES[cmd.transferType]}`,
      representable: true
    };
  }
  if (cmd.kind === "wr4" && (cmd.base & 0x1c) === 0x0c && cmd.mode !== 3) {
    return { text: `.dma wr4 ${DMA_OPERATING_MODES[cmd.mode]}`, representable: true };
  }
  if (cmd.bytes.length === 1) return formatDmaCommand(cmd, opts);
  return { text: `.dma cmd ${formatDmaByte(cmd.base, opts)}`, representable: false };
}

/**
 * The source text of one command. A command the `.dma` pragma cannot express - or one cut off by
 * the end of the range - falls back to `.dma cmd $xx` (one byte) or `.defb` (several), so the text
 * always reassembles to the command's bytes (plan D1).
 */
export function formatDmaCommand(cmd: DmaCommand, opts?: DmaFormatOptions): DmaFormattedCommand {
  if (cmd.missing > 0) {
    return { text: `.defb ${cmd.bytes.map((b) => formatDmaByte(b, opts)).join(", ")}`, representable: false };
  }
  const ok = (text: string): DmaFormattedCommand => ({ text, representable: true });
  switch (cmd.kind) {
    case "wr0": {
      if ((cmd.base & 0x78) !== 0x78) break;
      return ok(
        `.dma wr0 ${cmd.dirAtoB ? "a_to_b" : "b_to_a"}, ${DMA_TRANSFER_TYPES[cmd.transferType]}, ` +
          `${formatDmaWord(cmd.portA!, opts)}, ${formatDmaWord(cmd.blockLength!, opts)}`
      );
    }
    case "wr1":
    case "wr2": {
      if (cmd.addrMode === 3) break;
      let text = `.dma ${cmd.kind} ${cmd.portIsIo ? "io" : "memory"}, ${DMA_ADDR_MODES[cmd.addrMode]}`;
      if (cmd.timing !== undefined) {
        // --- WR1 takes only the cycle length; WR2 takes the cycle length and the D5 prescaler flag
        const allowed = cmd.kind === "wr1" ? 0x03 : 0x23;
        const cycle = cycleKeyword(cmd.timing);
        if (cmd.timing & ~allowed || !cycle) break;
        text += `, ${cycle}`;
        if (cmd.prescaler !== undefined) text += `, ${formatDmaByte(cmd.prescaler, opts)}`;
      }
      return ok(text);
    }
    case "wr3": {
      // --- The pragma writes the mask and the match as a pair
      if ((cmd.mask === undefined) !== (cmd.match === undefined)) break;
      const parts: string[] = [];
      if (cmd.dmaEnable) parts.push("dma_enable");
      if (cmd.intEnable) parts.push("int_enable");
      if (cmd.stopOnMatch) parts.push("stop_on_match");
      if (cmd.mask !== undefined) {
        parts.push(formatDmaByte(cmd.mask, opts), formatDmaByte(cmd.match!, opts));
      }
      return ok(parts.length ? `.dma wr3 ${parts.join(", ")}` : ".dma wr3");
    }
    case "wr4": {
      if ((cmd.base & 0x1c) !== 0x0c || cmd.mode === 3) break;
      return ok(`.dma wr4 ${DMA_OPERATING_MODES[cmd.mode]}, ${formatDmaWord(cmd.portB!, opts)}`);
    }
    case "wr5":
      if (cmd.base === 0x82) return ok(".dma wr5");
      if (cmd.base === 0xa2) return ok(".dma wr5 auto_restart");
      break;
    case "wr6": {
      const keyword = WR6_KEYWORDS[cmd.command];
      if (keyword) return ok(`.dma ${keyword}`);
      // --- The assembler masks the read mask to 7 bits
      if (cmd.command === 0xbb && cmd.readMask! <= 0x7f) {
        return ok(`.dma readmask ${formatDmaByte(cmd.readMask!, opts)}`);
      }
      break;
    }
  }
  return rawBytes(cmd.bytes, opts);
}

const WR6_MEANINGS: Record<number, string> = {
  0xc3: "reset",
  0xcf: "load: port A/B addresses into the transfer engine, counter cleared",
  0x87: "enable: start the transfer",
  0x83: "disable: stop the transfer",
  0xd3: "continue: counter cleared, addresses kept",
  0x8b: "reinitialize status byte",
  0xa7: "start read sequence",
  0xbf: "read status byte",
  0xc7: "reset port A timing",
  0xcb: "reset port B timing",
  0xbb: "read mask"
};

const portKind = (io: boolean) => (io ? "I/O" : "memory");
const addrModeText = (mode: number) => ["decrement", "increment", "fixed", "fixed (mode 11)"][mode & 3];
const cycleText = (timing: number) => `${[4, 3, 2, 4][timing & 3]}T cycle`;
const wordText = (value: number) => `$${hex(value, 4)}`;
const byteText = (value: number) => `$${hex(value, 2)}`;

/** Partial (single-byte) follow fields, as words for the comment. */
function partialFieldsText(cmd: DmaCommand): string[] {
  const names: Partial<Record<DmaFieldRole, string>> = {
    portALo: "port A low",
    portAHi: "port A high",
    lengthLo: "length low",
    lengthHi: "length high",
    portBLo: "port B low",
    portBHi: "port B high"
  };
  return cmd.fields
    .filter((f) => names[f.role])
    .map((f) => `${names[f.role]} ${byteText(f.value)}`);
}

/**
 * The meaning column: what the write does to the DMA, in a few words. A command cut off by the end
 * of the range says how many bytes it still expects.
 */
export function describeDmaCommand(cmd: DmaCommand): string {
  const group = dmaGroupName(cmd.kind);
  if (cmd.missing > 0) {
    return `truncated: ${group} expects ${cmd.missing} more byte${cmd.missing === 1 ? "" : "s"}`;
  }
  const parts: string[] = [];
  switch (cmd.kind) {
    case "wr0": {
      const type = ["", "transfer", "search", "search + transfer"][cmd.transferType];
      parts.push(`${cmd.dirAtoB ? "A→B" : "B→A"} ${type}`);
      if (cmd.portA !== undefined) parts.push(`port A ${wordText(cmd.portA)}`);
      if (cmd.blockLength !== undefined) {
        parts.push(`length ${wordText(cmd.blockLength)} (${cmd.blockLength})`);
      }
      parts.push(...partialFieldsText(cmd));
      break;
    }
    case "wr1":
    case "wr2": {
      parts.push(
        `port ${cmd.kind === "wr1" ? "A" : "B"} ${portKind(cmd.portIsIo)}, ${addrModeText(cmd.addrMode)}`
      );
      if (cmd.timing !== undefined) parts.push(cycleText(cmd.timing));
      if (cmd.prescaler !== undefined) {
        parts.push(
          cmd.kind === "wr2"
            ? `prescaler ${cmd.prescaler}`
            : `${byteText(cmd.prescaler)} ignored (port A has no prescaler)`
        );
      }
      break;
    }
    case "wr3": {
      if (cmd.dmaEnable) parts.push("start the transfer");
      if (cmd.intEnable) parts.push("interrupt enable");
      if (cmd.stopOnMatch) parts.push("stop on match");
      if (cmd.mask !== undefined) parts.push(`mask ${byteText(cmd.mask)}`);
      if (cmd.match !== undefined) parts.push(`match ${byteText(cmd.match)}`);
      if (cmd.intEnable || cmd.stopOnMatch || cmd.mask !== undefined || cmd.match !== undefined) {
        parts.push("only the start bit has an effect on the Next");
      }
      if (!parts.length) parts.push("no effect");
      break;
    }
    case "wr4": {
      parts.push(cmd.mode === 3 ? "mode 11 (invalid)" : `${DMA_OPERATING_MODES[cmd.mode]} mode`);
      if (cmd.portB !== undefined) parts.push(`port B ${wordText(cmd.portB)}`);
      parts.push(...partialFieldsText(cmd));
      if (cmd.deaf) parts.push("the DMA ignores every later write until a hardware reset");
      break;
    }
    case "wr5":
      parts.push(cmd.autoRestart ? "auto restart" : "no auto restart");
      break;
    case "wr6": {
      const meaning = WR6_MEANINGS[cmd.command];
      if (cmd.command === 0xbb) {
        parts.push(
          cmd.readMask !== undefined ? `read mask ${byteText(cmd.readMask)}` : "read mask"
        );
      } else {
        parts.push(meaning ?? `command ${byteText(cmd.command)}: no effect on the Next`);
      }
      break;
    }
    case "invalid":
      return `${byteText(cmd.base)}: not a DMA register write, ignored`;
  }
  return `${group}: ${parts.join(", ")}`;
}
