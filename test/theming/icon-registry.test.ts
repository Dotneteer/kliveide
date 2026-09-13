import { describe, it, expect } from "vitest";
import { buildIconRegistry, listIconNames, lookupIcon } from "@renderer/theming/icon-registry";
import { iconLibrary } from "@renderer/theming/icon-defs";
import { fileIconLibrary } from "@renderer/theming/file-icon-defs";
import type { IconInfo, MarkupIconInfo, PathIconInfo } from "@renderer/theming/theme";

function stockIcon(name: string): PathIconInfo {
  return { name, path: "M0 0h1", width: 16, height: 16 };
}

function fileIcon(name: string): MarkupIconInfo {
  return {
    kind: "markup",
    name,
    content: `<path d="M0 0h1"/>`,
    viewBox: "0 0 24 24",
    width: 24,
    height: 24,
    paint: { fill: "none", stroke: "currentColor" }
  };
}

describe("buildIconRegistry", () => {
  it("registers stock icons", () => {
    const { icons } = buildIconRegistry([stockIcon("play")], []);
    expect(icons.get("play")?.kind).toBeUndefined();
  });

  it("lets a file icon override a stock icon of the same name", () => {
    const { icons } = buildIconRegistry([stockIcon("rocket")], [fileIcon("rocket")]);

    const resolved = icons.get("rocket") as IconInfo;
    expect(resolved.kind).toBe("markup");
  });

  it("reports which names were shadowed", () => {
    const { shadowed } = buildIconRegistry(
      [stockIcon("rocket"), stockIcon("play")],
      [fileIcon("rocket"), fileIcon("brand-new")]
    );

    expect(shadowed).toEqual(["rocket"]);
  });

  it("keeps stock icons that no file overrides", () => {
    const { icons } = buildIconRegistry([stockIcon("play")], [fileIcon("sun")]);

    expect(icons.get("play")).toBeDefined();
    expect(icons.get("sun")?.kind).toBe("markup");
    expect(icons.size).toBe(2);
  });
});

describe("the live icon registry", () => {
  it("loads the .svg files from assets/icons", () => {
    expect(fileIconLibrary.length).toBeGreaterThan(0);
    for (const icon of fileIconLibrary) {
      expect(icon.kind).toBe("markup");
      expect(icon.content).not.toBe("");
    }
  });

  it("resolves a file icon by its file name", () => {
    const icon = lookupIcon("sun");

    expect(icon?.name).toBe("sun");
    expect(icon?.kind).toBe("markup");
  });

  it("keeps no stock entry that a file icon already provides", () => {
    // --- icon-defs.ts is being retired entry by entry as icons move into
    // --- assets/icons. Once the .svg exists the stock entry is dead: the
    // --- registry always prefers the file, so the old definition can never
    // --- render again. This keeps such entries from creeping back in.
    const files = new Set(fileIconLibrary.map((ic) => ic.name));
    const shadowed = iconLibrary.filter((ic) => files.has(ic.name)).map((ic) => ic.name);

    expect(
      shadowed,
      "these stock entries are shadowed by an .svg of the same name and should be deleted"
    ).toEqual([]);
  });

  it("resolves every remaining stock entry to itself", () => {
    // --- Guards the cleanup: deleting the wrong entry would show up here as a
    // --- name that silently falls back to the "unknown" icon.
    for (const ic of iconLibrary) {
      expect(lookupIcon(ic.name)?.name, `${ic.name} should still resolve`).toBe(ic.name);
    }
  });

  it("still resolves stock icons that no file shadows", () => {
    // --- Picked at run time rather than hard-coded: any stock name may later
    // --- be shadowed by a new .svg file (as "play" and "rocket" already are),
    // --- and that must not break this test.
    const shadowed = new Set(fileIconLibrary.map((ic) => ic.name));
    const unshadowed = iconLibrary.find((ic) => !shadowed.has(ic.name));

    expect(unshadowed, "expected at least one un-shadowed stock icon").toBeDefined();
    expect(lookupIcon(unshadowed!.name)?.kind).toBeUndefined();
  });

  it("falls back to the unknown icon for an unregistered name", () => {
    expect(lookupIcon("no-such-icon-anywhere")?.name).toBe("unknown");
  });

  it("keeps the composite debug icon's mask intact and scoped", () => {
    const debug = lookupIcon("debug");
    expect(debug?.kind).toBe("markup");
    const content = (debug as { content: string }).content;

    // --- The mask must survive sanitizing...
    expect(content).toContain("<mask");
    // --- ...and both the definition and the reference must be namespaced, so
    // --- this icon cannot collide with a mask defined by another icon.
    expect(content).toContain('id="klive-icon-debug-bug-cutout"');
    expect(content).toContain('mask="url(#klive-icon-debug-bug-cutout)"');
    // --- No reference may be left pointing at the un-scoped original
    expect(content).not.toContain("url(#bug-cutout)");
  });

  it("uses the same play glyph across the whole run/debug family", () => {
    const play = lookupIcon("play") as { content: string };

    // --- All four icons swap within the same toolbar split button, so they
    // --- must embed the identical, untransformed play path.
    const playPath = /d="(M5 5a2 2[^"]+)"/.exec(play.content)?.[1];
    expect(playPath, "expected to find the play path").toBeDefined();

    for (const name of ["debug", "debug-continue", "debug-continue-with-bug"]) {
      const icon = lookupIcon(name) as { content: string };
      expect(icon.content, `${name} should embed the play glyph`).toContain(playPath!);
    }
  });

  it("gives two icons that define the same internal id distinct namespaces", () => {
    // --- debug.svg and debug-continue-with-bug.svg both declare
    // --- id="bug-cutout". Un-namespaced, whichever rendered second would
    // --- capture the other's mask reference - and only while both were on
    // --- screen at once, which is exactly how such a bug reaches a release.
    const a = lookupIcon("debug") as { content: string };
    const b = lookupIcon("debug-continue-with-bug") as { content: string };

    const idsOf = (c: string) => [...c.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
    const aIds = idsOf(a.content);
    const bIds = idsOf(b.content);

    expect(aIds.length).toBeGreaterThan(0);
    expect(bIds.length).toBeGreaterThan(0);
    expect(aIds.filter((id) => bIds.includes(id))).toEqual([]);

    // --- and each still references its own mask
    for (const [icon, ids] of [[a, aIds], [b, bIds]] as const) {
      expect(icon.content).toContain(`mask="url(#${ids[0]})"`);
    }
  });

  it("puts an identical pause bar on both continue icons", () => {
    const barOf = (name: string) =>
      /<rect x="0\.4"[^>]*\/>/.exec((lookupIcon(name) as { content: string }).content)?.[0];

    const bar = barOf("debug-continue");
    expect(bar, "debug-continue should carry a pause bar").toBeDefined();
    expect(barOf("debug-continue-with-bug")).toBe(bar);

    // --- The icons without a bar must not grow one
    expect(barOf("play")).toBeUndefined();
    expect(barOf("debug")).toBeUndefined();
  });

  it("derives the pin icon from pinned by rotation alone", () => {
    // --- pin.svg reuses pinned.svg's path data under a rotate() group instead
    // --- of baking in rotated coordinates, so the pair cannot drift apart.
    const dOf = (name: string) =>
      [...(lookupIcon(name) as { content: string }).content.matchAll(/d="([^"]+)"/g)].map(
        (m) => m[1]
      );

    expect(dOf("pin")).toEqual(dOf("pinned"));
    expect(dOf("pin").length).toBeGreaterThan(0);
    expect((lookupIcon("pin") as { content: string }).content).toContain("rotate(90, 12, 12)");
    // --- ...and pinned itself must stay unrotated
    expect((lookupIcon("pinned") as { content: string }).content).not.toContain("rotate(");
  });

  it("mirrors reverse-tape out of the debug-continue geometry", () => {
    const contentOf = (name: string) => (lookupIcon(name) as { content: string }).content;
    const rt = contentOf("reverse-tape");
    const dc = contentOf("debug-continue");

    // --- Mirrored by a transform over the shared geometry, not by rewritten
    // --- coordinates, so it cannot drift from the family proportions.
    expect(rt).toContain("translate(24,0) scale(-1,1)");
    expect(rt).toContain("translate(1.65,1.8) scale(0.85)");

    const bar = /<rect x="0\.4"[^>]*\/>/;
    expect(bar.exec(rt)?.[0]).toBe(bar.exec(dc)?.[0]);

    const playPath = /d="(M5 5a2 2[^"]+)"/;
    expect(playPath.exec(rt)?.[1]).toBe(playPath.exec(dc)?.[1]);

    // --- Filled, but the stroke is deliberately kept so the solid triangle
    // --- keeps the outlined one's silhouette rather than shrinking by a unit.
    expect(rt).toMatch(/<path fill="currentColor" d="M5 5a2 2/);
    expect(rt).not.toMatch(/<path fill="currentColor" stroke="none" d="M5 5a2 2/);
  });

  it("draws the combine icon as two sources feeding one result", () => {
    const content = (lookupIcon("combine") as { content: string }).content;
    const rects = [...content.matchAll(/<rect[^>]*>/g)].map((m) => m[0]);

    // --- Two sources plus one result, all the same size. The stock icon this
    // --- replaces had three sources and a taller result block.
    expect(rects).toHaveLength(3);
    expect(rects.filter((r) => r.includes('width="6" height="6"'))).toHaveLength(3);

    // --- A single chevron between them. One mark rather than an arrow per
    // --- source: at the 16px this renders at, four separate marks in the
    // --- middle of the icon crowd into each other.
    const paths = [...content.matchAll(/<path[^>]*>/g)];
    expect(paths).toHaveLength(1);
    expect(paths[0][0]).toContain('stroke-width="2.6"');
  });

  it.each([
    ["file-sjasmp", "#A349A4", "#ffffff"],
    ["file-kz80-asm", "#0078C0", "#ffffff"],
    ["file-zxbas", "#D670D6", "#202020"],
    ["file-project", "#E8A33D", "#202020"]
  ])("keeps the %s file icon self-contained across themes", (name, tile, letter) => {
    const icon = lookupIcon(name) as { content: string; name: string };
    expect(icon.name).toBe(name);

    // --- These carry their own colours, so one file serves both themes. The
    // --- PNG pairs they replace each needed a "-light" variant.
    expect(icon.content).toContain(`fill="${tile}"`);
    expect(icon.content).toContain(`stroke="${letter}"`);
    expect(icon.content).not.toContain("currentColor");
  });

  it("keeps the sjasmp and zxbas tiles visually distinct", () => {
    // --- Both are hue ~300; they are told apart by lightness AND by which of
    // --- the tile/letter is dark. If a future edit gives them the same letter
    // --- treatment, the two file types start looking alike in the explorer.
    const sj = (lookupIcon("file-sjasmp") as { content: string }).content;
    const zx = (lookupIcon("file-zxbas") as { content: string }).content;

    expect(sj).toContain('stroke="#ffffff"');
    expect(zx).toContain('stroke="#202020"');
    expect(sj).not.toContain('fill="#D670D6"');
    expect(zx).not.toContain('fill="#A349A4"');
  });

  it("lists both stock and file icon names", () => {
    const names = listIconNames();

    expect(names).toContain("play");
    expect(names).toContain("sun");
    expect(names).toEqual([...names].sort());
  });
});
