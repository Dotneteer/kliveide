/* Shared by the Memory and Disassembly view mockups: the machine model. Inlined by each build. */
const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const h2 = (n) => n.toString(16).toUpperCase().padStart(2, "0");
const h4 = (n) => n.toString(16).toUpperCase().padStart(4, "0");
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
let seed = 0x1234;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

/* =====================================================================================
 * Machines. A machine is its partitions (id, name, group, kind, size, roles), the regions
 * of the 64K the CPU sees (which partition, at which offset), its registers and the user's
 * labels. Everything else in the view is generic over this.
 * ===================================================================================== */
const ROLE_NAMES = { ula: "ULA screen", shadow: "Shadow screen", l2: "Layer 2", l2s: "Layer 2 shadow", tile: "Tilemap", stack: "Stack", sys: "OZ system", app: "Application" };
const KIND_NAMES = { rom: "ROM", ram: "RAM", card: "RAM card", flash: "Flash card", div: "DivMMC RAM", divrom: "DivMMC ROM", empty: "Empty slot", mirror: "Mirror" };

function program(at) {
  // ld hl,$5800 / ld b,32 / loop: ld a,b / and 7 / ld (hl),a / inc hl / djnz loop / ld de,msg / call print / jr $ / print: ...
  return [0x21, 0x00, 0x58, 0x06, 0x20, 0x78, 0xe6, 0x07, 0x77, 0x23, 0x10, 0xf9, 0x11, (at + 0x20) & 0xff, (at + 0x20) >> 8,
    0xcd, (at + 0x18) & 0xff, (at + 0x18) >> 8, 0x18, 0xfe, 0, 0, 0, 0, 0x1a, 0xb7, 0xc8, 0xd7, 0x13, 0x18, 0xf9, 0];
}
const userLabelsAt = (at) => ({ [at]: "main", [at + 5]: "loop", [at + 0x12]: "halt", [at + 0x18]: "print", [at + 0x20]: "message", [at + 0x40]: "table" });
/** The user's data regions, as the annotations would mark them: padding, the message, the table */
const userRegionsAt = (at) => [
  { start: at + 0x14, end: at + 0x17, type: "bytes" },
  { start: at + 0x1f, end: at + 0x1f, type: "bytes" },
  { start: at + 0x20, end: at + 0x31, type: "text" },
  { start: at + 0x40, end: at + 0x4f, type: "words" }
];

function screenFill(buf, base) {
  for (let y = 0; y < 192; y++) for (let x = 0; x < 32; x++) {
    const a = ((y & 0xc0) << 5) | ((y & 7) << 8) | ((y & 0x38) << 2) | x;
    if (a - base >= 0 && a - base < buf.length) buf[a - base] = (y >> 3) % 4 === 0 ? 0 : ((x + (y >> 3)) % 3 === 0 ? 0xaa : (y & 1 ? 0x0f : 0xf0));
  }
}

function buildSp128() {
  const parts = [
    { id: "R0", name: "ROM 0", group: "ROM", kind: "rom", size: 0x4000, rom: "sp128/R0" },
    { id: "R1", name: "ROM 1", group: "ROM", kind: "rom", size: 0x4000, rom: "sp128/R1" },
    ...Array.from({ length: 8 }, (_, i) => ({ id: "B" + i, name: "Bank " + i, group: "RAM", kind: "ram", size: 0x4000, roles: i === 5 ? ["ula"] : i === 7 ? ["shadow"] : [] }))
  ];
  return {
    id: "sp128", title: "ZX Spectrum 128K", unit: "16K bank", slotName: (i) => `Slot ${i}`,
    parts, regions: [["R1", 0], ["B5", 0], ["B2", 0], ["B0", 0]].map(([p, o], i) => ({ start: i * 0x4000, len: 0x4000, part: p, off: o, cap: `SLOT ${i}` })),
    regs: { PC: 0x8008, SP: 0xff3c, HL: 0x5812, DE: 0x8020, BC: 0x0e00, AF: 0x0701, IX: 0x5c3a, IY: 0x5c3a },
    userLabels: { ...userLabelsAt(0x8000), 0xff3c: "stack_top" },
    userRegions: userRegionsAt(0x8000), sysvars: typeof SYSVARS !== "undefined" ? SYSVARS : {},
    setup(m) {
      const s5 = m.store("B5"); screenFill(s5, 0); for (let i = 0; i < 768; i++) s5[0x1800 + i] = 0x38; for (let i = 0; i < 18; i++) s5[0x1800 + i] = (i & 7) | 0x40;
      m.store("B2").set(program(0x8000)); [..."HELLO FROM KLIVE!"].forEach((c, i) => (m.store("B2")[0x20 + i] = c.charCodeAt(0)));
      m.store("B0").set([0x12, 0x80, 0x76, 0x1b, 0x03, 0x13, 0x00, 0x3e], 0x3f3c);
      m.changed = new Set([...Array.from({ length: 18 }, (_, i) => "B5:" + (0x1800 + i)), "B0:" + 0x3f3c, "B0:" + 0x3f3d]);
      for (let o = 0; o < 0x20; o++) m.addHeat("B2", o, 0, o >= 5 && o < 12 ? 32 : 3);
      for (let o = 0x10; o < 0x18; o++) m.addHeat("R1", o, 0, 17);
      for (let o = 0x1800; o < 0x1820; o++) m.addHeat("B5", o, 2, 1);
    }
  };
}

function buildZ88() {
  // --- Slot 0: OZ 4.7 ROM (512K, $00-$1F) and 512K internal RAM ($20-$3F)
  // --- Slot 1: a 128K RAM card ($40-$47, mirrored through $7F); slot 2: a 1 MB flash card; slot 3: empty
  const parts = [];
  for (let b = 0; b < 256; b++) {
    const id = h2(b), slot = b >> 6;
    let p = { id, name: `Bank $${id}`, size: 0x4000, slot, group: `Slot ${slot}` };
    if (b < 0x20) Object.assign(p, { kind: "rom", note: "OZ 4.7 ROM", rom: b === 0 ? "z88/00" : b === 0x1f ? "z88/1F" : undefined });
    else if (b < 0x40) Object.assign(p, { kind: "ram", note: "Internal RAM (512K)" });
    else if (b < 0x48) Object.assign(p, { kind: "card", note: "RAM card, 128K" });
    else if (b < 0x80) Object.assign(p, { kind: "mirror", mirrorOf: h2(0x40 + (b & 7)), note: `Mirror of $${h2(0x40 + (b & 7))}: the 128K card repeats through the slot` });
    else if (b < 0xc0) Object.assign(p, { kind: "flash", note: "Flash card, 1 MB (Intel 28F008)" });
    else Object.assign(p, { kind: "empty", note: "Slot 3 is empty" });
    p.roles = b === 0x20 ? ["sys"] : b === 0x21 ? ["app"] : b === 0x1f ? ["sys"] : [];
    parts.push(p);
  }
  const SR = { SR0: 0x20, SR1: 0x21, SR2: 0x40, SR3: 0x1f };
  return {
    id: "z88", title: "Cambridge Z88", unit: "16K bank", slotName: (i) => (i === 0 ? "Segment 0" : `Segment ${i}`),
    slotTitles: ["Slot 0 · OZ ROM 512K + internal RAM 512K", "Slot 1 · RAM card 128K", "Slot 2 · Flash card 1 MB", "Slot 3 · empty"],
    parts,
    regions: [
      { start: 0x0000, len: 0x2000, part: "00", off: 0x0000, cap: "SEG 0 · LOW" },
      { start: 0x2000, len: 0x2000, part: h2(SR.SR0), off: 0x2000, cap: "SEG 0 · SR0" },
      { start: 0x4000, len: 0x4000, part: h2(SR.SR1), off: 0, cap: "SEG 1 · SR1" },
      { start: 0x8000, len: 0x4000, part: h2(SR.SR2), off: 0, cap: "SEG 2 · SR2" },
      { start: 0xc000, len: 0x4000, part: h2(SR.SR3), off: 0, cap: "SEG 3 · SR3" }
    ],
    regs: { PC: 0x4008, SP: 0x3ff0, HL: 0x4040, DE: 0x4020, BC: 0x0e00, AF: 0x2044, IX: 0x2a00, IY: 0x3800 },
    userLabels: { ...userLabelsAt(0x4000), 0x3ff0: "stack_top" },
    userRegions: userRegionsAt(0x4000), sysvars: {},
    setup(m) {
      m.store("21").set(program(0x4000)); [..."HELLO FROM KLIVE!"].forEach((c, i) => (m.store("21")[0x20 + i] = c.charCodeAt(0)));
      const card = m.store("40"); for (let i = 0; i < 0x400; i++) card[i] = Math.floor(rnd() * 256);
      const fl = m.store("80"); fl.fill(0xff); [..."oz"].forEach((c, i) => (fl[0x3ffe + i] = c.charCodeAt(0)));
      m.changed = new Set([...Array.from({ length: 8 }, (_, i) => "20:" + (0x3ff0 + i)), "40:16", "40:17"]);
      for (let o = 0; o < 0x20; o++) m.addHeat("21", o, 0, o >= 5 && o < 12 ? 32 : 3);
      for (let o = 0; o < 0x40; o++) m.addHeat("1F", 0x100 + o, 0, 9);
      for (let o = 0x3fe0; o < 0x4000; o++) m.addHeat("20", o, 2, 4);
    }
  };
}

function buildNext(ks3) {
  const parts = [];
  ["R0", "R1", "R2", "R3"].forEach((id, i) => parts.push({ id, name: `Next ROM ${i}`, group: "Next ROM", kind: "rom", size: 0x4000, rom: i === 0 ? "next/R0" : undefined }));
  ["X0", "X1"].forEach((id, i) => parts.push({ id, name: `Alt ROM ${i}`, group: "Alt ROM", kind: "rom", size: 0x4000 }));
  parts.push({ id: "DM", name: "DivMMC ROM", group: "DivMMC ROM", kind: "divrom", size: 0x2000 });
  for (let i = 0; i < 16; i++) parts.push({ id: "M" + i.toString(16).toUpperCase(), name: `DivMMC RAM ${i}`, group: "DivMMC RAM", kind: "div", size: 0x2000 });
  for (let i = 0; i < 224; i++) {
    const roles = [];
    if (i === 0x0a || i === 0x0b) roles.push("ula", "tile");
    if (i === 0x0e || i === 0x0f) roles.push("shadow");
    if (i >= 0x12 && i <= 0x17) roles.push("l2");
    if (i >= 0x18 && i <= 0x1d) roles.push("l2s");
    parts.push({ id: h2(i), name: `RAM page $${h2(i)}`, group: "RAM pages", kind: "ram", size: 0x2000, roles, bank16: `16K bank ${i >> 1}, ${i & 1 ? "high" : "low"} half` });
  }
  if (ks3) for (let i = 0; i < 256; i++) parts.push({ id: "U" + h2(i), name: `Upper RAM page $${h2(i)}`, group: "Upper RAM", kind: "ram", size: 0x2000, roles: [], note: "Physical $" + (0x200000 + i * 0x2000).toString(16).toUpperCase() + ", reachable by DMA, not by the MMU" });
  const mmu = [["R0", 0], ["R0", 0x2000], ["0A", 0], ["0B", 0], ["04", 0], ["05", 0], ["00", 0], ["01", 0]];
  return {
    id: ks3 ? "nextks3" : "next", title: ks3 ? "ZX Spectrum Next KS3 (4 MB)" : "ZX Spectrum Next (2 MB)", unit: "8K page", slotName: (i) => `MMU${i}`,
    parts,
    regions: mmu.map(([p, o], i) => ({ start: i * 0x2000, len: 0x2000, part: p, off: o, cap: `MMU${i} · $${h2(0x50 + i)}` })),
    regs: { PC: 0x8008, SP: 0xff3c, HL: 0x5812, DE: 0x8020, BC: 0x0e00, AF: 0x0701, IX: 0x5c3a, IY: 0x5c3a },
    userLabels: { ...userLabelsAt(0x8000), 0xff3c: "stack_top" },
    userRegions: userRegionsAt(0x8000), sysvars: typeof SYSVARS !== "undefined" ? SYSVARS : {}, z80n: true,
    setup(m) {
      const a = m.store("0A"); screenFill(a, 0); const b = m.store("0B"); for (let i = 0; i < 768; i++) a[0x1800 + i] = 0x38; for (let i = 0; i < 18; i++) a[0x1800 + i] = (i & 7) | 0x40;
      b[0] = 0;
      m.store("04").set(program(0x8000)); [..."HELLO FROM KLIVE!"].forEach((c, i) => (m.store("04")[0x20 + i] = c.charCodeAt(0)));
      m.store("01").set([0x12, 0x80, 0x76, 0x1b, 0x03, 0x13, 0x00, 0x3e], 0x1f3c);
      for (let p = 0x12; p <= 0x17; p++) { const s = m.store(h2(p)); for (let i = 0; i < 0x2000; i++) s[i] = ((i >> 5) + p * 7) & 0xff; }
      m.changed = new Set([...Array.from({ length: 18 }, (_, i) => "0A:" + (0x1800 + i)), "01:" + 0x1f3c, "01:" + 0x1f3d, "14:100", "14:101", "15:7"]);
      for (let o = 0; o < 0x20; o++) m.addHeat("04", o, 0, o >= 5 && o < 12 ? 32 : 3);
      for (let o = 0x10; o < 0x18; o++) m.addHeat("R0", o, 0, 17);
      for (let o = 0x1800; o < 0x1820; o++) m.addHeat("0A", o, 2, 1);
      for (let o = 0; o < 0x2000; o += 7) m.addHeat("14", o, 2, 2);
    }
  };
}

function instantiate(def) {
  const m = { ...def, stores: {}, heat: new Map(), changed: new Set() };
  m.byId = new Map(m.parts.map((p) => [p.id, p]));
  m.big = m.parts.length > 16;
  m.store = (id) => {
    const p = m.byId.get(id); if (!p) return null;
    if (p.mirrorOf) return m.store(p.mirrorOf);
    if (p.kind === "empty") return null;
    if (!m.stores[id]) {
      const s = new Uint8Array(p.size);
      if (p.rom && ROMS[p.rom]) s.set(b64(ROMS[p.rom].bytes).subarray(0, p.size));
      else if (p.kind === "rom" || p.kind === "divrom") for (let i = 0; i < p.size; i++) s[i] = (i * 31 + (i >> 7) + id.charCodeAt(0)) & 0xff;
      else if (p.kind === "flash") s.fill(0xff);
      else for (let i = 0; i < p.size; i += 1 + Math.floor(rnd() * 90)) s[i] = Math.floor(rnd() * 256);
      m.stores[id] = s;
    }
    return m.stores[id];
  };
  m.addHeat = (part, off, k, n) => { const key = part + ":" + off; const h = m.heat.get(key) ?? [0, 0, 0]; h[k] += n; m.heat.set(key, h); };
  m.romLabels = (part, off) => { const p = m.byId.get(part); const r = p?.rom && ROMS[p.rom]; return r ? r.labels[off] : undefined; };
  /** The ROM sidecar's data region at an offset: { start, end, type: "bytes", decode? } */
  m.romRegion = (part, off) => { const p = m.byId.get(part); const r = p?.rom && ROMS[p.rom]; return r?.regions?.find((g) => off >= g.start && off <= g.end && g.type !== "disassemble"); };
  /** The ROM sidecar's line annotation at an offset: { c: comment, s: synopsis } */
  m.romNote = (part, off) => { const p = m.byId.get(part); const r = p?.rom && ROMS[p.rom]; return r?.notes?.[off]; };
  seed = 0x1234; def.setup(m);
  return m;
}

const MACHINES = { sp128: buildSp128, z88: buildZ88, next: () => buildNext(false), nextks3: () => buildNext(true) };
let M;
