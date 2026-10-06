import type { NextLayer2State } from "@common/messaging/EmuApi";
import {
  isOutsideRam,
  isPriorityEntry,
  isTransparentEntry,
  LAYER2_NO_PIXEL,
  layer2Image,
  layer2PaletteIndex,
  layer2Size,
  layer2StoredPixel,
  pixelAddress,
  windowZ80Address,
  writeTarget,
  type Layer2PixelAddress,
  type Layer2Size,
  type Layer2WriteTarget
} from "@common/zxnext/layer2/layer2Decode";
import { layer2Diagnostics, setBanks, type Layer2Diagnostic } from "@common/zxnext/layer2/layer2Diagnostics";
import {
  bankRegions,
  displayedImage,
  effectiveClip,
  isInsideClip,
  sourceOfDisplay,
  visibleWindow,
  type LayerRect
} from "@common/zxnext/layer2/layer2Geometry";
import type { Layer2Source } from "./layer2Reveal";

/*
 * The Layer 2 Inspector's view model (`.plans/LAYER2_INSPECTOR_PLAN.md` §4.4-§4.5). Pure: the document
 * turns a snapshot into this once per version and renders from it.
 */

export type Layer2Model = {
  state: NextLayer2State;
  size: Layer2Size;
  target: Layer2WriteTarget;
  source: Layer2Source;
  /** The first 16K bank of the set the source shows (`$12` or `$13`) */
  baseBank: number;
  /** The set's bytes, or undefined while the shadow banks have not been read yet (T9) */
  data?: Uint8Array;
};

/** Which set a source shows (D4): `$12`, `$13`, or the one the `$123B` window maps (bit 3). */
export function sourceSet(state: NextLayer2State, source: Layer2Source): { bank: number; shadow: boolean } {
  const r = state.regs;
  const shadow = source === "shadow" || (source === "window" && writeTarget(r).useShadow);
  return { bank: shadow ? r.shadowBank : r.activeBank, shadow };
}

/** Whether a source needs the shadow banks read (T9). */
export function needsShadow(state: NextLayer2State | undefined, source: Layer2Source): boolean {
  if (source === "shadow") return true;
  return source === "window" && !!state && writeTarget(state.regs).useShadow;
}

export function buildLayer2Model(state: NextLayer2State, source: Layer2Source): Layer2Model {
  const set = sourceSet(state, source);
  return {
    state,
    size: layer2Size(state.regs.resolution),
    target: writeTarget(state.regs),
    source,
    baseBank: set.bank,
    data: set.shadow ? state.shadow : state.displayed
  };
}

/** FNV-1a over a byte array, continuing from `h`. */
export function hashBytes(bytes: ArrayLike<number>, h = 0x811c9dc5): number {
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i] & 0xff;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** The hash that gates re-decoding (D9): the banks read, the registers, the paging and the Copper flag. */
export function layer2StateHash(state: NextLayer2State): number {
  let h = hashBytes(state.displayed);
  h = state.shadow ? hashBytes(state.shadow, h) : hashBytes([0xff], h);
  const r = state.regs;
  h = hashBytes(
    [
      r.enabled ? 1 : 0,
      r.activeBank,
      r.shadowBank,
      r.port123B,
      r.bankOffset,
      r.resolution,
      r.paletteOffset,
      r.scrollX & 0xff,
      r.scrollX >> 8,
      r.scrollY,
      ...r.clip,
      r.clipIndex,
      r.globalTransparency,
      r.secondPalette ? 1 : 0,
      state.copperRunning ? 1 : 0
    ],
    h
  );
  for (const o of state.slotOffsets) h = hashBytes([o & 0xff, (o >> 8) & 0xff, (o >> 16) & 0xff, (o >>> 24) & 0xff], h);
  return h;
}

// --- Palette (T6, D10)

export type Layer2PaletteFlags = {
  /** 1 where the entry's RGB equals `$14` */
  transparent: Uint8Array;
  /** 1 where the entry has the Layer 2 priority bit */
  priority: Uint8Array;
};

export function paletteFlags(deviceValues: number[], globalTransparency: number): Layer2PaletteFlags {
  const transparent = new Uint8Array(256);
  const priority = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    const v = deviceValues[i] ?? 0;
    transparent[i] = isTransparentEntry(v, globalTransparency) ? 1 : 0;
    priority[i] = isPriorityEntry(v) ? 1 : 0;
  }
  return { transparent, priority };
}

// --- Images (D5)

/** The source's indices, whole layer or as displayed; undefined while its banks are unread. */
export function viewImage(model: Layer2Model, asDisplayed: boolean): Int16Array | undefined {
  if (!model.data) return undefined;
  const r = model.state.regs;
  return asDisplayed
    ? displayedImage(r, model.data, model.baseBank)
    : layer2Image(r.resolution, model.data, r.paletteOffset, model.baseBank);
}

/** The image with transparent entries cleared, so the checker shows through them (T6). */
export function withTransparency(pixels: Int16Array, flags: Layer2PaletteFlags): Int16Array {
  return pixels.map((p) => (p >= 0 && flags.transparent[p] ? LAYER2_NO_PIXEL : p));
}

/** Every pixel without the priority bit dimmed, so the priority ones stand out (D10). */
export function priorityDim(pixels: Int16Array, flags: Layer2PaletteFlags): Uint8Array {
  const dim = new Uint8Array(pixels.length);
  for (let i = 0; i < pixels.length; i++) {
    const p = pixels[i];
    dim[i] = p >= 0 && flags.priority[p] ? 0 : 1;
  }
  return dim;
}

/** The diagnostics, with the transparency check when a palette is known. */
export function modelDiagnostics(model: Layer2Model, flags?: Layer2PaletteFlags): Layer2Diagnostic[] {
  const r = model.state.regs;
  const displayed = flags ? displayedImage(r, model.state.displayed, r.activeBank) : undefined;
  return layer2Diagnostics({
    regs: r,
    displayed,
    isTransparent: flags ? (i) => flags.transparent[i & 0xff] === 1 : undefined
  });
}

// --- Text

const hex = (v: number, digits: number) => `$${v.toString(16).toUpperCase().padStart(digits, "0")}`;
const z80Range = (a: number, b: number) => `${hex(a, 4)}-${hex(b, 4)}`;

export const resolutionText = (size: Layer2Size) => `${size.width}×${size.height}`;

/** The `$123B` window in words (T1): where a write to `$0000-$3FFF` lands now. */
export function windowText(target: Layer2WriteTarget): string {
  const access =
    target.mappedForWrites && target.mappedForReads
      ? "reads+writes"
      : target.mappedForWrites
        ? "writes"
        : target.mappedForReads
          ? "reads"
          : undefined;
  if (!access) return "window off";
  const s = target.slices;
  const banks = s.length === 1 ? `bank ${s[0].bank16}` : `banks ${s.map((x) => x.bank16).join(", ")}`;
  return `${access} → ${banks} (${z80Range(s[0].z80Start, s[s.length - 1].z80End)})`;
}

// --- The globals strip (§4.4)

export type GlobalItem = {
  key: string;
  value: string;
  title?: string;
  /** Shown even when the strip is collapsed */
  primary?: boolean;
  /** A diagnostic chip */
  flag?: Layer2Diagnostic["level"];
};

export function globalsStrip(model: Layer2Model, diagnostics: Layer2Diagnostic[]): GlobalItem[] {
  const { state, size, target } = model;
  const r = state.regs;
  const banks = (base: number) => {
    const b = setBanks(base, r.resolution);
    return `${base} (banks ${b[0]}-${b[b.length - 1]})`;
  };
  const clip = effectiveClip(r);
  const items: GlobalItem[] = [
    ...diagnostics.map((d) => ({ key: d.id, value: d.chip, title: d.sentence, flag: d.level })),
    { key: "Layer 2", value: r.enabled ? "on" : "off", primary: true, title: "$123B bit 1 / $69 bit 7" },
    { key: "Mode", value: resolutionText(size), primary: true, title: `$70 bits 5-4 = ${r.resolution}` },
    { key: "$12", value: banks(r.activeBank), primary: true, title: "The displayed layer's first 16K bank" },
    { key: "$13", value: banks(r.shadowBank), primary: true, title: "The shadow layer's first 16K bank" },
    {
      key: "$123B",
      value: `${hex(r.port123B, 2)}: ${windowText(target)}`,
      primary: true,
      title: [
        "Port $123B as a read returns it",
        `Bits 7-6: segment ${target.segment}${target.segment === 3 ? " (48K at $0000-$BFFF)" : " (16K at $0000-$3FFF)"}`,
        `Bit 3: ${target.useShadow ? "maps the shadow layer ($13)" : "maps the displayed layer ($12)"}`,
        `Bit 2: reads ${target.mappedForReads ? "mapped" : "not mapped"}; bit 0: writes ${target.mappedForWrites ? "mapped" : "not mapped"}`
      ].join("\n")
    },
    { key: "Offset", value: `+${target.bankOffset}`, title: "The bank offset ($123B writes with bit 4 set)" },
    { key: "Scroll", value: `${r.scrollX},${r.scrollY}`, title: "$16 with $71 bit 0 (X, 9 bits) and $17 (Y)" },
    {
      key: "Clip",
      value: r.clip.join(","),
      title: `$18: x1, x2, y1, y2 (next write sets ${["x1", "x2", "y1", "y2"][r.clipIndex & 3]})\nIn layer pixels: x ${clip.x1}-${clip.x2}, y ${clip.y1}-${clip.y2}`
    },
    {
      key: "$14",
      value: hex(r.globalTransparency, 2),
      title: "A pixel is transparent when its palette entry's RGB (bits 8-1) equals $14 - the colour, not the index"
    },
    {
      key: "Palette",
      value: `${r.secondPalette ? "2" : "1"}, offset ${r.paletteOffset}`,
      title: "$43 bit 2 picks the Layer 2 palette; $70 bits 3-0 are the palette offset"
    }
  ];
  if (state.copperRunning) {
    items.push({
      key: "Copper",
      value: "running",
      title: "The Copper may change these registers per line; the values shown are the ones at the stop"
    });
  }
  return items;
}

/** Flags first, then the primary items, then the rest (the strip collapses to flags and primary). */
export function orderGlobals(items: GlobalItem[]): GlobalItem[] {
  const rank = (g: GlobalItem) => (g.flag === "warning" ? 0 : g.flag ? 1 : g.primary ? 2 : 3);
  return items.slice().sort((a, b) => rank(a) - rank(b));
}

// --- The Banks strip (§4.5)

export type BankRole = "displayed" | "shadow" | "window";

export type BankChip = {
  /** 0-4: which bank of the set */
  index: number;
  bank16: number;
  pages: [number, number];
  roles: BankRole[];
  outsideRam: boolean;
  rect: LayerRect;
};

export function bankChips(model: Layer2Model): BankChip[] {
  const r = model.state.regs;
  const displayed = setBanks(r.activeBank, r.resolution);
  const shadow = setBanks(r.shadowBank, r.resolution);
  const window = model.target.mappedForWrites || model.target.mappedForReads ? model.target.slices.map((s) => s.bank16) : [];
  return bankRegions(r.resolution).map(({ index, rect }) => {
    const bank16 = model.baseBank + index;
    const roles: BankRole[] = [];
    if (displayed.includes(bank16)) roles.push("displayed");
    if (shadow.includes(bank16)) roles.push("shadow");
    if (window.includes(bank16)) roles.push("window");
    return { index, bank16, pages: [bank16 * 2, bank16 * 2 + 1], roles, outsideRam: isOutsideRam(bank16), rect };
  });
}

export const bankChipLabel = (c: BankChip) => `bank ${c.bank16} · pages ${c.pages[0]}–${c.pages[1]}`;

/** The bank's pixels cut out of a whole-layer image, for its thumbnail. */
export function bankThumbnail(model: Layer2Model, whole: Int16Array, chip: BankChip): { pixels: Int16Array; width: number; height: number } {
  const { rect } = chip;
  const width = rect.x2 - rect.x1 + 1;
  const height = rect.y2 - rect.y1 + 1;
  const pixels = new Int16Array(width * height);
  for (let y = 0; y < height; y++) {
    const from = (rect.y1 + y) * model.size.width + rect.x1;
    pixels.set(whole.subarray(from, from + width), y * width);
  }
  return { pixels, width, height };
}

// --- Overlays (§4.5)

export type OverlayRole = "visible" | "clip" | "window" | "selected" | "bank" | "bankSelected" | "outside";

export type OverlayShape =
  | { kind: "rect"; role: OverlayRole; rect: LayerRect; dashed?: boolean }
  | { kind: "hatch"; rect: LayerRect }
  | { kind: "label"; x: number; y: number; text: string };

export type OverlayOptions = {
  asDisplayed: boolean;
  banks: boolean;
  /** A selected pixel, in view coordinates */
  pixel?: { x: number; y: number };
  /** A selected bank of the set (0-4) */
  bank?: number;
};

/** A rectangle cut to the image, or undefined when it is off the image. */
function onImage(r: LayerRect, size: Layer2Size): LayerRect | undefined {
  const c = { x1: Math.max(0, r.x1), y1: Math.max(0, r.y1), x2: Math.min(size.width - 1, r.x2), y2: Math.min(size.height - 1, r.y2) };
  return c.x1 <= c.x2 && c.y1 <= c.y2 ? c : undefined;
}

export function layer2Overlay(model: Layer2Model, o: OverlayOptions): OverlayShape[] {
  const { size, state } = model;
  const shapes: OverlayShape[] = [];
  if (o.asDisplayed) {
    const clip = onImage(effectiveClip(state.regs), size);
    if (clip) shapes.push({ kind: "rect", role: "clip", rect: clip });
  } else {
    const chips = bankChips(model);
    for (const c of chips) if (c.outsideRam) shapes.push({ kind: "hatch", rect: c.rect });
    if (o.banks) {
      for (const c of chips) {
        shapes.push({ kind: "rect", role: "bank", rect: c.rect });
        shapes.push({ kind: "label", x: c.rect.x1 + 1, y: c.rect.y1 + 1, text: `${c.bank16}` });
      }
    }
    for (const c of chips) if (c.roles.includes("window")) shapes.push({ kind: "rect", role: "window", rect: c.rect });
    for (const r of visibleWindow(state.regs)) {
      const rect = onImage(r, size);
      if (rect) shapes.push({ kind: "rect", role: "visible", rect, dashed: true });
    }
    if (o.bank !== undefined && chips[o.bank]) shapes.push({ kind: "rect", role: "bankSelected", rect: chips[o.bank].rect });
  }
  if (o.pixel) {
    const { x, y } = o.pixel;
    // --- A box one pixel wider each way, so the stroke frames the pixel instead of covering it
    shapes.push({ kind: "rect", role: "selected", rect: { x1: x - 1, x2: x + 1, y1: y - 1, y2: y + 1 } });
  }
  return shapes;
}

// --- The pixel (§4.5, D6)

export type Layer2PixelInfo = {
  /** The pixel of the view */
  view: { x: number; y: number };
  /** The source pixel: the view's in *Whole layer*, the scrolled one in *As displayed* */
  layer: { x: number; y: number };
  /** *As displayed*: outside the clip window */
  clipped: boolean;
  /** The byte (or, at 640 x 256, the nibble) as stored */
  stored: number;
  byte: number;
  index: number;
  /** The palette entry (9-bit RGB with the priority bit), when a palette is known */
  entry?: number;
  transparent?: boolean;
  priority?: boolean;
  address: Layer2PixelAddress;
  /** The Z80 address through the MMU (or ROM/DivMMC paging), if the page is mapped now */
  z80Mmu?: number;
  /** The Z80 address through the `$123B` window, if it maps the byte now */
  z80Window?: number;
};

/** The Z80 address a physical byte is read from through the slots, or undefined. */
export function mmuZ80Address(slotOffsets: number[], physical: number): number | undefined {
  for (let slot = 0; slot < slotOffsets.length; slot++) {
    const start = slotOffsets[slot];
    if (physical >= start && physical < start + 0x2000) return slot * 0x2000 + (physical - start);
  }
  return undefined;
}

export function pixelInfo(
  model: Layer2Model,
  x: number,
  y: number,
  asDisplayed: boolean,
  deviceValues?: number[]
): Layer2PixelInfo | undefined {
  const { size, state, target } = model;
  if (!model.data || x < 0 || y < 0 || x >= size.width || y >= size.height) return undefined;
  const r = state.regs;
  const layer = asDisplayed ? sourceOfDisplay(r, x, y) : { x, y };
  const address = pixelAddress(r.resolution, model.baseBank, layer.x, layer.y);
  const stored = layer2StoredPixel(r.resolution, model.data, layer.x, layer.y);
  const index = layer2PaletteIndex(r.resolution, stored, r.paletteOffset);
  const entry = deviceValues?.[index];
  return {
    view: { x, y },
    layer,
    clipped: asDisplayed && !isInsideClip(r, x, y),
    stored,
    byte: model.data[address.setOffset] ?? 0,
    index,
    entry,
    transparent: entry === undefined ? undefined : isTransparentEntry(entry, r.globalTransparency),
    priority: entry === undefined ? undefined : isPriorityEntry(entry),
    address,
    z80Mmu: mmuZ80Address(state.slotOffsets, address.physical),
    z80Window: target.mappedForWrites || target.mappedForReads ? windowZ80Address(target, address.physical) : undefined
  };
}

export type InspectorField = { name: string; value: string; title?: string; muted?: boolean; warn?: boolean };

/** RGB333 of a 9-bit entry as `R G B`. */
const rgbText = (entry: number) => `${(entry >> 6) & 7} ${(entry >> 3) & 7} ${entry & 7}`;

export function pixelFields(model: Layer2Model, p: Layer2PixelInfo): InspectorField[] {
  const r = model.state.regs;
  const fields: InspectorField[] = [
    { name: "Layer", value: `(${p.layer.x}, ${p.layer.y})`, title: "The pixel in the unscrolled layer" }
  ];
  if (p.view.x !== p.layer.x || p.view.y !== p.layer.y) {
    fields.push({ name: "Display", value: `(${p.view.x}, ${p.view.y})${p.clipped ? " clipped" : ""}`, muted: p.clipped });
  }
  if (!model.size.wide) {
    fields.push({
      name: "Screen",
      value: `(${p.layer.x + 32}, ${p.layer.y + 32})`,
      title: "In the 320×256 layer space, where the paper starts at (32, 32)"
    });
  }
  fields.push(
    model.size.nibbles
      ? {
          name: "Stored",
          value: `${hex(p.stored, 1)} (${p.address.nibble} nibble of ${hex(p.byte, 2)})`,
          title: "640×256: two 4-bit pixels per byte, the high nibble on the left"
        }
      : { name: "Stored", value: hex(p.stored, 2) },
    {
      name: "Index",
      value: `${hex(p.index, 2)} (${p.index})`,
      title: model.size.nibbles
        ? `The palette offset (${r.paletteOffset}) is the high nibble`
        : `The palette offset (${r.paletteOffset}) is added to the high nibble`
    }
  );
  if (p.entry !== undefined) {
    fields.push(
      {
        name: "Colour",
        value: `RGB ${rgbText(p.entry)}${p.priority ? " · priority" : ""}`,
        title: p.priority ? "The entry's priority bit puts this pixel over sprites and the ULA in most $15 orders" : undefined
      },
      {
        name: "Transparent",
        value: p.transparent ? `yes: RGB = $14 (${hex(r.globalTransparency, 2)})` : "no",
        title: "Layer 2 compares the entry's RGB (bits 8-1) with $14, not the index (T6)",
        muted: !p.transparent
      }
    );
  }
  fields.push(
    { name: "Bank", value: `${p.address.bank16}:${hex(p.address.offset, 4)}`, warn: p.address.outsideRam },
    { name: "8K page", value: String(p.address.page8k) },
    { name: "Physical", value: hex(p.address.physical, 6) },
    {
      name: "Z80 (MMU)",
      value: p.z80Mmu === undefined ? "not mapped" : hex(p.z80Mmu, 4),
      muted: p.z80Mmu === undefined,
      title: "Where the byte's 8K page is mapped now through the MMU"
    },
    {
      name: "Z80 ($123B)",
      value: p.z80Window === undefined ? "not mapped" : hex(p.z80Window, 4),
      muted: p.z80Window === undefined,
      title: "Where the $123B window maps the byte now"
    }
  );
  return fields;
}

/** Why a pixel might not reach the screen; empty when it should show. */
export function pixelReasons(model: Layer2Model, p: Layer2PixelInfo): string[] {
  const r = model.state.regs;
  const out: string[] = [];
  if (p.address.outsideRam) out.push("Its bank is past the 2 MB SRAM: the display has no pixel here.");
  if (!r.enabled) out.push("Layer 2 is off ($123B bit 1, $69 bit 7).");
  if (model.source !== "displayed" && !setBanks(r.activeBank, r.resolution).includes(p.address.bank16)) {
    out.push("This byte is not in the displayed layer ($12).");
  }
  if (p.clipped) out.push("Outside the $18 clip window.");
  if (p.transparent) out.push("Its palette colour equals $14, so it is transparent.");
  return out;
}

/**
 * Where the Memory view shows the pixel's byte: at its Z80 address when the MMU maps it now, otherwise
 * in its 8K page (the view's partition mode; a Next partition is a RAM page). Undefined past 2 MB.
 * Layer 2 banks are rarely mapped while a program runs, so the page view is the usual answer.
 */
export type Layer2MemoryLocation =
  | { kind: "z80"; address: number; text: string }
  | { kind: "page"; page8k: number; offset: number; text: string };

export function memoryLocation(p: Layer2PixelInfo): Layer2MemoryLocation | undefined {
  if (p.address.outsideRam) return undefined;
  if (p.z80Mmu !== undefined) return { kind: "z80", address: p.z80Mmu, text: hex(p.z80Mmu, 4) };
  const offset = p.address.offset & 0x1fff;
  const page = p.address.page8k.toString(16).toUpperCase().padStart(2, "0");
  return { kind: "page", page8k: p.address.page8k, offset, text: `page ${page}:${hex(offset, 4)}` };
}

/**
 * The `bp-set` commands that stop on a write to the pixel's byte (D6):
 * - a **bank-relative** write breakpoint (`<bank>:+<offset>`), which fires wherever the MMU pages the
 *   bank in, so it works whether or not the byte is mapped now;
 * - and, when the `$123B` window maps the byte for writes, a write breakpoint on its window address,
 *   because a write through the window does not go through the MMU's pages.
 * Empty past 2 MB.
 */
export function breakOnWriteCommands(model: Layer2Model, p: Layer2PixelInfo): string[] {
  if (p.address.outsideRam) return [];
  const bank = p.address.bank16.toString(16).toUpperCase().padStart(2, "0");
  const commands = [`bp-set ${bank}:+${hex(p.address.offset, 4)} -w`];
  if (model.target.mappedForWrites && p.z80Window !== undefined) commands.push(`bp-set ${hex(p.z80Window, 4)} -w`);
  return commands;
}

export const coordinatesText = (p: Layer2PixelInfo) =>
  `(${p.layer.x}, ${p.layer.y}) bank ${p.address.bank16}:${hex(p.address.offset, 4)} ${hex(p.address.physical, 6)}`;
