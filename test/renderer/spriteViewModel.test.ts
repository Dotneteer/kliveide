import { describe, expect, it } from "vitest";

import type { NextSpriteState } from "@common/messaging/EmuApi";
import {
  attributesAsDb,
  attributesAsNextreg,
  buildSpriteModel,
  cellOfSprite,
  changedSlots,
  defaultFilter,
  globalsStrip,
  hashBytes,
  orderGlobals,
  patternCells,
  spriteAtMapPoint,
  spriteFields,
  spriteMap,
  spriteRows,
  spriteSummary,
  syncSelection,
  uploadCell
} from "@renderer/features/sprites/spriteViewModel";

// --- SPRITE_INSPECTOR_PLAN Phases 4-7: the document's logic, without React

type Resolved = { visible?: boolean; x?: number; y?: number; fourBit?: boolean; pattern7?: number; pal?: number };

function stateOf(
  attrs: number[][],
  resolved: Resolved[],
  extra: Partial<NextSpriteState> = {}
): NextSpriteState {
  const attributes = new Uint8Array(640);
  attrs.forEach((a, i) => attributes.set(a, i * 5));
  const buf = new Uint8Array(1024);
  resolved.forEach((r, i) => {
    const x = r.x ?? 100;
    const y = r.y ?? 100;
    buf.set([(r.visible ? 1 : 0) | (r.fourBit ? 0x10 : 0), x & 0xff, x >> 8, y & 0xff, y >> 8, r.pal ?? 0, 0, r.pattern7 ?? 0], i * 8);
  });
  let lastVisible = -1;
  attrs.forEach((a, i) => {
    if (a[3] & 0x80) lastVisible = i;
  });
  return {
    attributes,
    patterns: new Uint8Array(0x4000).fill(0x11),
    resolved: buf,
    lastVisible,
    control: 0x01,
    clip: [0, 255, 0, 191],
    clipIndex: 0,
    transparencyIndex: 0xe3,
    status: { tooMany: false, collision: false },
    upload: { spriteIndex: 0, spriteSub: 0, patternIndex: 0, patternSub: 0, mirrorIndex: 0, tied: false },
    spritePaletteBank: 0,
    ...extra
  };
}

describe("globalsStrip", () => {
  const values = (s: NextSpriteState) => Object.fromEntries(globalsStrip(buildSpriteModel(s)).map((g) => [g.key, g.value]));

  it("shows the effective clip in each mode (T8)", () => {
    expect(values(stateOf([], [])).Clip).toBe("(32,32)-(287,223)");
    expect(values(stateOf([], [], { control: 0x23, clip: [10, 100, 20, 200] })).Clip).toBe("(20,20)-(201,200)");
    expect(values(stateOf([], [], { control: 0x03 })).Clip).toBe("off (whole 320×256)");
  });

  it("flags the sprite layer off and a raised status, and says tied (T12)", () => {
    const strip = globalsStrip(
      buildSpriteModel(
        stateOf([], [], {
          control: 0x40,
          status: { tooMany: true, collision: true },
          upload: { spriteIndex: 24, spriteSub: 0, patternIndex: 12, patternSub: 0x80, mirrorIndex: 24, tied: true }
        })
      )
    );
    const by = Object.fromEntries(strip.map((g) => [g.key, g]));
    expect(by.Sprites).toMatchObject({ value: "OFF", flag: true });
    expect(by.Status).toMatchObject({ value: "too many, collision", flag: true });
    expect(by["On top"].value).toBe("#0");
    expect(by.Upload.value).toBe("#24.0 pat 12.$80");
    expect(by.Mirror.value).toBe("#24 (tied)");
  });
});

describe("spriteRows", () => {
  const attrs = [
    [100, 100, 0x30, 0xc1, 0x20], // --- 0: anchor, unified, visible, palette 3
    [8, 0xfc, 0x21, 0xc2, 0x40], // --- 1: relative, palette relative +2
    [0, 0, 0, 0x00, 0], // --- 2: empty
    [5, 5, 0, 0x85, 0x0a] // --- 3: 4-byte, stale attr4
  ];
  const resolved: Resolved[] = [
    { visible: true, pattern7: 2, pal: 3 },
    { visible: true, x: 108, y: 96, pattern7: 4, pal: 5 },
    {},
    { visible: true, pattern7: 10 }
  ];

  it("decodes each slot for the table", () => {
    const model = buildSpriteModel(stateOf(attrs, resolved));
    const rows = spriteRows(model, "all");
    expect(rows).toHaveLength(128);
    expect(rows[0]).toMatchObject({ visibility: "effective", pattern: "1", type: "anchor", format: "8", palette: "3" });
    expect(rows[1]).toMatchObject({ anchor: 0, type: "rel·unified", x: 108, delta: "Δ+8,−4", palette: "+2" });
    expect(rows[3].type).toBe("anchor·4B");
    expect(rows[3].diagnostics.map((d) => d.code)).toContain("staleAttr4");
    expect(rows[3].raw).toEqual(["$05", "$05", "$00", "$85", "$0A"]);
  });

  it("filters", () => {
    const state = stateOf(attrs, resolved);
    const model = buildSpriteModel(state);
    expect(defaultFilter(state)).toBe("upToLastVisible");
    expect(spriteRows(model, "upToLastVisible").map((r) => r.index)).toEqual([0, 1, 2, 3]);
    expect(spriteRows(model, "visible").map((r) => r.index)).toEqual([0, 1, 3]);
    expect(spriteRows(model, "nonEmpty").map((r) => r.index)).toEqual([0, 1, 3]);
    expect(defaultFilter(stateOf([], []))).toBe("all");
  });

  it("marks the rows changed since the previous stop (D16)", () => {
    const before = stateOf(attrs, resolved).attributes;
    const after = before.slice();
    after[3 * 5 + 1] = 99;
    const changed = changedSlots(before, after);
    expect([...changed]).toEqual([3]);
    expect(changedSlots(undefined, after).size).toBe(0);
    const rows = spriteRows(buildSpriteModel(stateOf(attrs, resolved)), "all", changed);
    expect(rows.filter((r) => r.changed).map((r) => r.index)).toEqual([3]);
  });

  it("copies attributes as nextreg and .db, 4 or 5 bytes", () => {
    const model = buildSpriteModel(stateOf(attrs, resolved));
    expect(attributesAsDb(model.slots[0])).toBe(".db $64,$64,$30,$C1,$20");
    expect(attributesAsDb(model.slots[3])).toBe(".db $05,$05,$00,$85");
    expect(attributesAsNextreg(model.slots[3]).split("\n")).toEqual([
      "nextreg $34,3",
      "nextreg $35,$05",
      "nextreg $36,$05",
      "nextreg $37,$00",
      "nextreg $38,$85"
    ]);
  });
});

describe("patternCells", () => {
  // --- Slot 1 read as 8-bit by #0; slot 2 read as 4-bit (both halves) by #1 and #2, and as 8-bit by #3
  const attrs = [[0, 0, 0, 0x81, 0], [0, 0, 0, 0x82, 0], [0, 0, 0, 0x82, 0], [0, 0, 0, 0x82, 0]];
  const resolved: Resolved[] = [
    { visible: true, pattern7: 2 },
    { visible: true, fourBit: true, pattern7: 4, pal: 6 },
    { visible: false, fourBit: true, pattern7: 5 },
    { visible: false, pattern7: 4 }
  ];
  const model = buildSpriteModel(stateOf(attrs, resolved, { upload: { spriteIndex: 0, spriteSub: 0, patternIndex: 5, patternSub: 0x90, mirrorIndex: 0, tied: false } }));

  it("has 64 cells in 8-bit, 128 in 4-bit", () => {
    expect(patternCells(model, "8bit", "8bit")).toHaveLength(64);
    expect(patternCells(model, "4bit", "8bit")).toHaveLength(128);
  });

  it("draws each slot as used, with the fallback for unused ones (D17)", () => {
    const cells = patternCells(model, "asUsed", "8bit");
    // --- Slot 2 is mixed: 8-bit wins and the warning corner says the rest
    expect(cells).toHaveLength(64);
    expect(cells[2]).toMatchObject({ slot: 2, format: "8bit", mixed: true, users: [3] });
    expect(cells[1]).toMatchObject({ users: [0], visibleUsers: [0], mixed: false });
    const four = patternCells(model, "asUsed", "4bit");
    expect(four).toHaveLength(2 + 1 + 1 + 61 * 2);
  });

  it("finds a 4-bit sprite's half, and the upload cursor (T12)", () => {
    const cells = patternCells(model, "4bit", "8bit");
    expect(cellOfSprite(cells, model.resolved[2])).toMatchObject({ slot: 2, half: 1, users: [2], number: "#5", secondary: "2·hi" });
    expect(uploadCell(model, cells)).toMatchObject({ slot: 5, half: 1 });
    expect(uploadCell(model, patternCells(model, "8bit", "8bit"))).toMatchObject({ slot: 5, format: "8bit" });
  });

  it("keeps the two views' selections in step", () => {
    const cells = patternCells(model, "4bit", "8bit");
    expect(syncSelection(model, cells, { kind: "sprite", index: 1 })).toMatchObject({ cell: { slot: 2, half: 0 }, rows: [1], sprite: 1 });
    expect(syncSelection(model, cells, { kind: "pattern", slot: 2, half: 1 })).toMatchObject({ rows: [2] });
    expect(syncSelection(model, cells, undefined)).toEqual({ rows: [] });
  });
});

describe("the sprite-space map", () => {
  it("outlines visible sprites and picks the topmost under a point", () => {
    const attrs = [[0, 0, 0, 0x80, 0], [0, 0, 0, 0x80, 0], [0, 0, 0, 0x00, 0]];
    const model = buildSpriteModel(
      stateOf(attrs, [{ visible: true, x: 100, y: 100 }, { visible: true, x: 108, y: 104 }, { x: 0, y: 0 }])
    );
    const map = spriteMap(model, 1);
    expect(map.sprites.map((s) => s.index)).toEqual([0, 1]);
    expect(map.sprites[1]).toMatchObject({ selected: true, rect: { x1: 108, y1: 104, x2: 123, y2: 119 } });
    expect(map.clip).toEqual({ x1: 32, y1: 32, x2: 287, y2: 223 });
    expect(spriteAtMapPoint(map, 110, 110, false)).toBe(1);
    expect(spriteAtMapPoint(map, 110, 110, true)).toBe(0);
    expect(spriteAtMapPoint(map, 5, 5, false)).toBeUndefined();
  });
});

describe("hashBytes (T9)", () => {
  it("changes when a byte does", () => {
    const a = new Uint8Array(0x4000);
    const b = a.slice();
    b[0x3fff] = 1;
    expect(hashBytes(a)).toBe(hashBytes(a.slice()));
    expect(hashBytes(a)).not.toBe(hashBytes(b));
  });
});

describe("the inspector's fields and summary", () => {
  const attrs = [
    [100, 100, 0x30, 0xc1, 0x20], // --- 0: anchor, unified
    [8, 0xfc, 0x21, 0xc2, 0x40] // --- 1: relative, palette +2
  ];
  const model = buildSpriteModel(
    stateOf(attrs, [
      { visible: true, pattern7: 2, pal: 3 },
      { visible: true, x: 108, y: 96, pattern7: 4, pal: 5 }
    ])
  );
  const byName = (index: number) => Object.fromEntries(spriteFields(model, index).map((f) => [f.name, f]));

  it("gives a relative's own reading only where it differs from the effective value", () => {
    const f = byName(1);
    expect(f.Type).toEqual({ name: "Type", value: "relative", own: "anchor #0, unified" });
    expect(f.X).toEqual({ name: "X", value: "108", own: "own Δ+8" });
    expect(f.Y.own).toBe("own Δ−4");
    expect(f.Palette).toEqual({ name: "Palette", value: "5", own: "own +2" });
    expect(f.Visible.own).toBeUndefined();
    expect(f.Scale.own).toBeUndefined();
  });

  it("gives an anchor no own readings but its relatives' type", () => {
    const f = byName(0);
    expect(f.Type.own).toBe("relatives unified");
    expect(f.X.own).toBeUndefined();
    expect(f.Pattern.value).toBe("1");
  });

  it("summarises a sprite in one line", () => {
    expect(spriteSummary(model, 0)).toBe("drawn · 100,100 · pattern 1 · 8-bit");
  });
});

describe("orderGlobals", () => {
  it("puts flags first, then the primary items, in their order", () => {
    const strip = orderGlobals(
      globalsStrip(buildSpriteModel(stateOf([], [], { status: { tooMany: false, collision: true } })))
    );
    expect(strip.map((g) => g.key).slice(0, 4)).toEqual(["Status", "Sprites", "Clip", "Last visible"]);
    expect(strip.slice(4).every((g) => !g.flag && !g.primary)).toBe(true);
  });
});

describe("the map selects a pattern's users", () => {
  it("fills every chosen sprite, hidden ones included", () => {
    const model = buildSpriteModel(
      stateOf([[0, 0, 0, 0x80, 0], [0, 0, 0, 0x00, 0]], [{ visible: true }, { visible: false }])
    );
    const map = spriteMap(model, [0, 1]);
    expect(map.sprites.map((s) => [s.index, s.selected])).toEqual([
      [0, true],
      [1, true]
    ]);
  });
});

describe("4-bit sprites in the table", () => {
  it("pins the number alone and puts the half in fmt", () => {
    const model = buildSpriteModel(stateOf([[0, 0, 0, 0x80, 0]], [{ visible: true, fourBit: true, pattern7: 81 }]));
    const [row] = spriteRows(model, "all");
    expect(row).toMatchObject({ patternNumber: "81", format: "4·hi", pattern: "81 (40·hi)" });
  });
});
