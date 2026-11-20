/**
 * Palette breakpoints (`dev/plans/NEXT_PALETTE_DEBUGGING_PLAN.md` §3): ZX Spectrum Next breakpoints
 * bound to a palette entry write or a live-bank flip instead of an address, written
 * `pal:<device>[<bank>][:<entries>]` or `pal:<device>:live`:
 *
 * | Spec | Stops after the instruction during which |
 * |---|---|
 * | `pal:spr1:$03` | entry $03 of the first sprite palette is written |
 * | `pal:l2:$00-$0f` | an entry $00-$0F of either Layer 2 palette is written |
 * | `pal:ula2` | any entry of the second ULA palette is written |
 * | `pal:any` | any palette entry is written |
 * | `pal:tm:live` | the tilemap's live bank flips (`$6B` bit 4) |
 *
 * Devices: `ula`, `l2`, `spr`, `tm` and `any`. The normalized spec (lower case, `$` hex, no `pal:`)
 * is stored in `BreakpointInfo.paletteStop` and is the breakpoint's identity; `-c` (Copper writes
 * too) and `-changed` (only writes that change the stored value) are not part of it.
 *
 * Pure: no React, no Node. The command line, the dialog, the Breakpoints panel, `DebugSupport` and
 * the machine share it. The core's record is `zxnext-palette.c`'s (`zxnextPaletteCheckWatch`).
 */

import type { PaletteWriteEvent, PaletteWriteOrigin, PaletteWritePath } from "@common/messaging/EmuApi";

/** A palette-owning device, or every one */
export type PaletteStopDevice = "ula" | "l2" | "spr" | "tm" | "any";

export const PALETTE_STOP_DEVICES: readonly PaletteStopDevice[] = ["ula", "l2", "spr", "tm", "any"];

export type PaletteStop = {
  device: PaletteStopDevice;
  /** 0 or 1; absent means both banks. Never with `live`. */
  bank?: 0 | 1;
  /** Watch the device's live-bank flips instead of entry writes */
  live?: boolean;
  /** The inclusive entry range; absent means all 256 */
  from?: number;
  to?: number;
};

export type PaletteStopParseError = "device" | "entries" | "live" | "extra";

/** The device's first slot in the core (`$43` bits 6-4 order); the second bank is 4 more */
const DEVICE_SLOT: Record<Exclude<PaletteStopDevice, "any">, number> = { ula: 0, l2: 1, spr: 2, tm: 3 };

/** The devices' names, in slot order, as the stop message and the Breakpoints panel show them */
export const PALETTE_DEVICE_NAMES = ["ULA", "Layer 2", "Sprites", "Tilemap"] as const;

/** A number: `$` hex or plain decimal */
function parseNumber(text: string): number {
  if (text.startsWith("$")) return /^\$[0-9a-f]+$/.test(text) ? parseInt(text.slice(1), 16) : NaN;
  return /^\d+$/.test(text) ? parseInt(text, 10) : NaN;
}

/** Parses the part after `pal:` (`spr1:$03`, `l2:$00-$0f`, `ula2`, `tm:live`, `any`) */
export function parsePaletteStop(spec: string): PaletteStop | { error: PaletteStopParseError } {
  const parts = spec.trim().toLowerCase().split(":");
  const m = /^(ula|l2|spr|tm|any)([12])?$/.exec(parts[0]);
  if (!m) return { error: "device" };
  const device = m[1] as PaletteStopDevice;
  const bank = m[2] === undefined ? undefined : ((Number(m[2]) - 1) as 0 | 1);
  if (parts.length > 2) return { error: "extra" };
  if (parts.length === 1) return bank === undefined ? { device } : { device, bank };
  const target = parts[1];
  if (target === "live") {
    // --- A flip changes which bank is live, so naming a bank says nothing
    return bank === undefined ? { device, live: true } : { error: "live" };
  }
  const [a, b, ...rest] = target.split("-");
  if (rest.length) return { error: "entries" };
  const from = parseNumber(a);
  const to = b === undefined ? from : parseNumber(b);
  if (!Number.isFinite(from) || !Number.isFinite(to) || from > 0xff || to > 0xff || to < from) {
    return { error: "entries" };
  }
  const stop: PaletteStop = { device, ...(bank === undefined ? {} : { bank }) };
  // --- All 256 is the default, so it is not spelled out
  return from === 0 && to === 0xff ? stop : { ...stop, from, to };
}

const hex2 = (v: number) => `$${(v & 0xff).toString(16).padStart(2, "0")}`;

/** The normalized spec stored in `BreakpointInfo.paletteStop` (no `pal:` prefix) */
export function formatPaletteStop(stop: PaletteStop): string {
  const head = `${stop.device}${stop.bank === undefined ? "" : stop.bank + 1}`;
  if (stop.live) return `${stop.device}:live`;
  if (stop.from === undefined) return head;
  return stop.from === stop.to ? `${head}:${hex2(stop.from)}` : `${head}:${hex2(stop.from)}-${hex2(stop.to!)}`;
}

/** Parses a stored spec; undefined when it no longer parses (never stops) */
export function paletteStopOf(spec: string | undefined): PaletteStop | undefined {
  if (spec === undefined) return undefined;
  const parsed = parsePaletteStop(spec);
  return "error" in parsed ? undefined : parsed;
}


/** The core slots (0-7) a stop's device and bank cover */
export function paletteStopSlots(stop: PaletteStop): number[] {
  const devices = stop.device === "any" ? [0, 1, 2, 3] : [DEVICE_SLOT[stop.device]];
  const banks = stop.bank === undefined ? [0, 1] : [stop.bank];
  return devices.flatMap((d) => banks.map((b) => d + 4 * b));
}

/** One enabled palette breakpoint, as `buildPaletteWatch` needs it */
export type PaletteWatchEntry = {
  stop: PaletteStop;
  /** `-c`: Copper writes stop too */
  copper?: boolean;
  /** `-changed`: only writes that change the stored value stop */
  changed?: boolean;
};

/** The core's watch flags (`zxnextSetPaletteWatchFlags`) */
export const PaletteWatchFlag = {
  /** Something is watched: the write paths check at all */
  Armed: 0x01,
  /** Report Copper writes */
  Copper: 0x02,
  /** Report writes that store the value already there */
  AnyWrite: 0x04,
  /** Bits 4-7: the devices (ULA, Layer 2, sprites, tilemap) whose live-bank flips are watched */
  LiveShift: 4
} as const;

/** The core's watch: one bit per entry (slot * 32 + index / 8) and the flags */
export type PaletteWatch = {
  entries: Uint8Array;
  flags: number;
};

/** The size of the core's entry bitmap: 8 slots x 256 entries, one bit each */
export const PALETTE_WATCH_BYTES = 256;

/**
 * The watch to arm for these breakpoints. The entry bitmap is exact; Copper and unchanged writes are
 * reported when any breakpoint wants them, and `DebugSupport` applies each breakpoint's own `-c` and
 * `-changed`. 0 flags disarms.
 */
export function buildPaletteWatch(watches: PaletteWatchEntry[]): PaletteWatch {
  const entries = new Uint8Array(PALETTE_WATCH_BYTES);
  let flags = 0;
  let live = 0;
  for (const { stop, copper, changed } of watches) {
    flags |= PaletteWatchFlag.Armed;
    if (copper) flags |= PaletteWatchFlag.Copper;
    if (stop.live) {
      live |= stop.device === "any" ? 0x0f : 1 << DEVICE_SLOT[stop.device];
      continue;
    }
    if (!changed) flags |= PaletteWatchFlag.AnyWrite;
    const from = stop.from ?? 0;
    const to = stop.to ?? 0xff;
    for (const slot of paletteStopSlots(stop)) {
      for (let index = from; index <= to; index++) entries[slot * 32 + (index >> 3)] |= 1 << (index & 7);
    }
  }
  return { entries, flags: flags | (live << PaletteWatchFlag.LiveShift) };
}

const ORIGINS: readonly (PaletteWriteOrigin | undefined)[] = [undefined, "nextreg", "copper", "dma", "port"];
const PATHS: readonly PaletteWritePath[] = ["$41", "$44", "$FF3B", "$43", "$6B"];

/**
 * A latched hit from the core's two words (`zxnextTakePaletteHit`, `zxnextGetPaletteHitValues`):
 * word 0 bit 31 presence, 30 a live-bank flip, 27-29 origin (1 CPU NextReg, 2 Copper, 3 DMA, 4 CPU
 * port), 24-26 path (0 `$41`, 1 `$44`, 2 `$FF3B`, 3 `$43`, 4 `$6B`), 8-10 slot, 0-7 index; word 1 the
 * old value in bits 0-10 and the new one in 16-26 (for a flip, the banks 0/1). Undefined when no hit.
 */
export function decodePaletteHit(word0: number, word1: number): Omit<PaletteWriteEvent, "pc" | "partition"> | undefined {
  if ((word0 & 0x8000_0000) === 0) return undefined;
  const origin = ORIGINS[(word0 >>> 27) & 0x07];
  if (!origin) return undefined;
  return {
    kind: word0 & 0x4000_0000 ? "live" : "entry",
    slot: (word0 >>> 8) & 0x07,
    index: word0 & 0xff,
    oldValue: word1 & 0x7ff,
    newValue: (word1 >>> 16) & 0x7ff,
    origin,
    path: PATHS[(word0 >>> 24) & 0x07] ?? "$41"
  };
}

/** Does this hit fall within this stop's device, bank and entries (or flip)? */
export function matchesPaletteStop(
  stop: PaletteStop,
  hit: Pick<PaletteWriteEvent, "kind" | "slot" | "index">
): boolean {
  const device = hit.slot & 0x03;
  if (stop.device !== "any" && DEVICE_SLOT[stop.device] !== device) return false;
  if (hit.kind === "live") return !!stop.live;
  if (stop.live) return false;
  if (stop.bank !== undefined && stop.bank !== hit.slot >> 2) return false;
  return hit.index >= (stop.from ?? 0) && hit.index <= (stop.to ?? 0xff);
}

/**
 * Do this breakpoint's options let the hit through? `-c` admits Copper writes; `-changed` refuses a
 * write that stored the value already there (a flip always changes something).
 */
export function passesPaletteOptions(
  hit: Pick<PaletteWriteEvent, "kind" | "origin" | "oldValue" | "newValue">,
  options: { copper?: boolean; changed?: boolean }
): boolean {
  if (hit.origin === "copper" && !options.copper) return false;
  if (options.changed && hit.kind === "entry" && hit.oldValue === hit.newValue) return false;
  return true;
}

/**
 * `VAL` and `ADDR` of a palette hit in a condition or a log template (plan §9 Q3): `VAL` is the
 * stored value (9-bit colour, priority bits 9-10), `ADDR` the slot and entry (`slot << 8 | index`)
 * with the old value in bits 16-26. `palSlot`, `palIndex`, `palOld` and `palNew` read them apart.
 * For a flip, the values are the banks (0/1) and the slot is the one now live.
 */
export function paletteHitAccess(hit: Pick<PaletteWriteEvent, "slot" | "index" | "oldValue" | "newValue">): {
  value: number;
  address: number;
} {
  return {
    value: hit.newValue & 0x7ff,
    address: (((hit.oldValue & 0x7ff) << 16) | ((hit.slot & 0x07) << 8) | (hit.index & 0xff)) >>> 0
  };
}

/** A slot as words: `Sprites bank 1` */
export function describePaletteSlot(slot: number): string {
  return `${PALETTE_DEVICE_NAMES[slot & 0x03]} bank ${(slot >> 2) + 1}`;
}

const hex3u = (v: number) => `$${(v & 0x7ff).toString(16).toUpperCase().padStart(3, "0")}`;
const hex2u = (v: number) => `$${(v & 0xff).toString(16).toUpperCase().padStart(2, "0")}`;
const hex4u = (v: number) => `$${(v & 0xffff).toString(16).toUpperCase().padStart(4, "0")}`;

/** Who wrote, through what: `NextReg $41`, `the Copper ($44)`, `the DMA (port $FF3B)` */
export function describePaletteWriter(hit: Pick<PaletteWriteEvent, "origin" | "path">): string {
  const via = hit.path === "$FF3B" ? "port $FF3B" : `NextReg ${hit.path}`;
  switch (hit.origin) {
    case "nextreg":
    case "port":
      return via;
    case "copper":
      return `the Copper (${via})`;
    case "dma":
      return `the DMA (${via})`;
  }
}

/**
 * The Emulator output's line for a palette stop. English, like every stop message (output is not
 * translated):
 *
 *   Palette breakpoint: Sprites bank 1 entry $03 $1C7 -> $003 through NextReg $41, written at $8123 in R0
 *   Palette breakpoint: Layer 2 bank 2 entry $00 $000 -> $001 by the Copper (NextReg $41), with the CPU at $8003
 *   Palette breakpoint: Tilemap now draws with bank 2 (was bank 1) through NextReg $6B, written at $8F40
 */
export function describePaletteStop(event: PaletteWriteEvent, partitionLabels?: Record<number, string>): string {
  const paged = event.partition === undefined ? "" : ` in ${partitionLabels?.[event.partition] ?? event.partition}`;
  const site = `${hex4u(event.pc)}${paged}`;
  const what =
    event.kind === "live"
      ? `${PALETTE_DEVICE_NAMES[event.slot & 0x03]} now draws with bank ${event.newValue + 1} (was bank ${event.oldValue + 1})`
      : `${describePaletteSlot(event.slot)} entry ${hex2u(event.index)} ${hex3u(event.oldValue)} -> ${hex3u(event.newValue)}`;
  const from =
    event.origin === "copper" || event.origin === "dma"
      ? `by ${describePaletteWriter(event)}, with the CPU at ${site}`
      : `through ${describePaletteWriter(event)}, written at ${site}`;
  return `Palette breakpoint: ${what} ${from}`;
}
