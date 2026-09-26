import { describe, expect, it } from "vitest";

import { createRuntimeRig, heapUsed, makeString, type RuntimeRig } from "./runtime-kit";

const USES = ["PrintStr", "PrintChar", "PrintNewline", "PrintReset", "PrintU16", "PrintI16", "PrintU8", "PrintI8", "PrintU32", "PrintI32", "Cls"];

/** A String literal in the program image: [length][bytes]. */
function literal(label: string, ...parts: (string | number)[]): string {
  const bytes = parts.flatMap((p) => (typeof p === "number" ? [p] : [...p].map((c) => c.charCodeAt(0))));
  return [`${label}:`, `    .defw ${bytes.length}`, ...(bytes.length ? [`    .defb ${bytes.join(",")}`] : [])].join("\n");
}

/** Main-program lines printing literal `label`. */
function printLit(label: string): string {
  return `    ld hl,${label}\n    xor a\n    call core.PrintStr`;
}

async function printRig(main: string, extra = "", setup?: (rig: RuntimeRig) => void): Promise<RuntimeRig> {
  const rig = await createRuntimeRig({ uses: USES, main, extra, init: false, layout: { heapSize: 500 } });
  setup?.(rig);
  rig.runMain();
  return rig;
}

function attr(rig: RuntimeRig, row: number, col: number): number {
  return rig.session.peek(0x5800 + row * 32 + col);
}

function pixels(rig: RuntimeRig, row: number, col: number): number[] {
  const base = 0x4000 | ((row & 0x18) << 8) | ((row & 7) << 5) | col;
  return Array.from({ length: 8 }, (_, line) => rig.session.peek(base + (line << 8)));
}

describe("Klive BASIC runtime - print", () => {
  it("prints text from the top left and moves to the next line", async () => {
    const rig = await printRig(
      [printLit("Hello"), "    call core.PrintNewline", printLit("World")].join("\n"),
      [literal("Hello", "Hello"), literal("World", "World")].join("\n")
    );
    expect(rig.session.screenLine(0)).toBe("Hello");
    expect(rig.session.screenLine(1)).toBe("World");
    expect(attr(rig, 0, 0)).toBe(0x38);
  });

  it("continues where BASIC's print position (S_POSN) is", async () => {
    const rig = await printRig(printLit("Hi"), literal("Hi", "Hi"), (r) => {
      r.session.poke(0x5c88, [33 - 7, 24 - 3]); // column 7, row 3
    });
    expect(rig.session.screenLine(3)).toBe("       Hi");
  });

  it("wraps long text, and 32 characters and a line feed leave no empty line", async () => {
    const rig = await printRig(
      [printLit("Full"), "    call core.PrintNewline", printLit("Long")].join("\n"),
      [literal("Full", "0123456789".repeat(3) + "AB"), literal("Long", "x".repeat(40))].join("\n")
    );
    expect(rig.session.screenLine(0)).toBe("0123456789".repeat(3) + "AB");
    expect(rig.session.screenLine(1)).toBe("x".repeat(32));
    expect(rig.session.screenLine(2)).toBe("x".repeat(8));
  });

  it("handles AT, TAB, the comma, left and right from control codes", async () => {
    const rig = await printRig(
      printLit("Codes"),
      literal("Codes", 22, 5, 10, "A", 23, 20, 0, "T", 13, "B", 6, "C", 6, "D", 8, 8, "E", 9, "F", 23, 2, 0, "G")
    );
    const s = rig.session;
    expect(s.screenChar(5, 10)).toBe("A");
    expect(s.screenLine(5)).toBe("          A         T");
    expect(s.screenLine(6)).toBe("B               C");
    // --- the comma at column 17 goes to the next line; 8 moves left twice, 9 skips one cell
    expect(s.screenLine(7)).toBe("E F");
    // --- TAB to a column already passed goes to the next line
    expect(s.screenLine(8)).toBe("  G");
  });

  it("scrolls the whole screen when a line feed passes row 23", async () => {
    const lines: string[] = ["    call core.Cls"];
    const extra: string[] = [];
    for (let k = 0; k < 30; k++) {
      lines.push(printLit(`L${k}`), "    call core.PrintNewline");
      extra.push(literal(`L${k}`, `Line ${k}`));
    }
    const rig = await printRig(lines.join("\n"), extra.join("\n"));
    for (let row = 0; row < 23; row++) expect(rig.session.screenLine(row)).toBe(`Line ${row + 7}`);
    expect(rig.session.screenLine(23)).toBe("");
    expect(attr(rig, 23, 5)).toBe(0x38);
  });

  it("prints 8- and 16-bit numbers, signed and unsigned", async () => {
    const cases: [string, number][] = [
      ["core.PrintU16", 0],
      ["core.PrintU16", 10],
      ["core.PrintU16", 65535],
      ["core.PrintI16", 0x8000],
      ["core.PrintI16", 0xffff],
      ["core.PrintI16", 1234],
      ["core.PrintU8", 255],
      ["core.PrintI8", 0x80],
      ["core.PrintI8", 7]
    ];
    const main = cases
      .map(([routine, v]) =>
        routine.endsWith("8")
          ? `    ld a,${v}\n    call ${routine}\n    ld a,' '\n    call core.PrintChar`
          : `    ld hl,${v}\n    call ${routine}\n    ld a,' '\n    call core.PrintChar`
      )
      .join("\n");
    const rig = await printRig(main);
    // --- 34 characters: the last two numbers wrap onto row 1
    expect(rig.session.screenLine(0) + rig.session.screenLine(1)).toBe("0 10 65535 -32768 -1 1234 255 -128 7");
  });

  it("prints 32-bit numbers, signed and unsigned", async () => {
    const cases: [string, number][] = [
      ["core.PrintU32", 0],
      ["core.PrintU32", 4294967295],
      ["core.PrintI32", 0x80000000],
      ["core.PrintI32", 0xffffffff],
      ["core.PrintU32", 100000]
    ];
    const main = cases
      .map(([routine, v]) => `    ld hl,${v & 0xffff}\n    ld de,${v >>> 16}\n    call ${routine}\n    ld a,' '\n    call core.PrintChar`)
      .join("\n");
    const rig = await printRig(main);
    expect(rig.session.screenLine(0) + rig.session.screenLine(1)).toBe("0 4294967295 -2147483648 -1 100000");
  });

  it("applies temporary colours until PrintReset", async () => {
    const rig = await printRig(
      [printLit("Colours"), "    call core.PrintReset", printLit("Plain")].join("\n"),
      [literal("Colours", 16, 2, 17, 5, "a", 19, 1, 18, 1, "b"), literal("Plain", "c")].join("\n")
    );
    expect(attr(rig, 0, 0)).toBe((5 << 3) | 2);
    expect(attr(rig, 0, 1)).toBe(0x80 | 0x40 | (5 << 3) | 2);
    expect(attr(rig, 0, 2)).toBe(0x38);
  });

  it("keeps the screen's attribute bits for colour 8", async () => {
    const rig = await printRig(printLit("Keep"), literal("Keep", 16, 8, 17, 8, "k"), (r) => {
      r.session.poke(0x5800, 0x80 | (1 << 3) | 6);
    });
    expect(attr(rig, 0, 0)).toBe((0x38 & 0xc0) | (1 << 3) | 6);
  });

  it("inverts with INVERSE and combines with OVER", async () => {
    const rig = await printRig(printLit("Fx"), literal("Fx", 20, 1, "A", 20, 0, "B", 8, 21, 1, "B"));
    const glyphA = Array.from({ length: 8 }, (_, i) => rig.session.peek(0x3d00 + ("A".charCodeAt(0) - 32) * 8 + i));
    expect(pixels(rig, 0, 0)).toEqual(glyphA.map((b) => ~b & 0xff));
    expect(pixels(rig, 0, 1), "B OVER B is blank").toEqual(new Array(8).fill(0));
  });

  it("draws block graphics and user-defined graphics", async () => {
    const rig = await printRig(printLit("Gfx"), literal("Gfx", 143, 129, 134, 144));
    expect(pixels(rig, 0, 0)).toEqual(new Array(8).fill(0xff));
    expect(pixels(rig, 0, 1)).toEqual([0x0f, 0x0f, 0x0f, 0x0f, 0, 0, 0, 0]);
    expect(pixels(rig, 0, 2)).toEqual([0xf0, 0xf0, 0xf0, 0xf0, 0x0f, 0x0f, 0x0f, 0x0f]);
    expect(rig.session.screenChar(0, 3), "the ROM initialises UDG A as a copy of A").toBe("A");
  });

  it("prints '?' for an unassigned control code", async () => {
    const rig = await printRig(printLit("Q"), literal("Q", 1, 31));
    expect(rig.session.screenLine(0)).toBe("??");
  });

  it("clears the screen to the permanent attribute", async () => {
    const rig = await printRig(
      [printLit("Text"), "    call core.Cls", printLit("Again")].join("\n"),
      [literal("Text", 22, 10, 0, "Gone"), literal("Again", "Top")].join("\n")
    );
    expect(rig.session.screenLine(10)).toBe("");
    expect(rig.session.screenLine(0)).toBe("Top");
    expect(attr(rig, 23, 31)).toBe(0x38);
  });

  it("frees a temporary String after printing it", async () => {
    const rig = await createRuntimeRig({ uses: [...USES, "StrAlloc"], layout: { heapSize: 500 } });
    const p = makeString(rig, "temp");
    rig.call("core.PrintStr", { hl: p, a: 1 });
    expect(rig.session.screenLine(0)).toBe("temp");
    expect(heapUsed(rig)).toBe(0);
  });

  it("stops with '5 Out of screen' for AT outside the screen", async () => {
    const rig = await createRuntimeRig({
      uses: USES,
      init: false,
      main: printLit("Bad"),
      extra: literal("Bad", 22, 24, 0, "x")
    });
    rig.startAsRunningLine();
    expect(rig.session.peek(23610)).toBe(4);
    expect(rig.session.screenLine(23)).toMatch(/^5 Out of screen,/);
  });

  it("stops with 'K Invalid colour' for a colour out of range", async () => {
    const rig = await createRuntimeRig({
      uses: USES,
      init: false,
      main: printLit("Bad"),
      extra: literal("Bad", 16, 10, "x")
    });
    rig.startAsRunningLine();
    expect(rig.session.peek(23610)).toBe(19);
    expect(rig.session.screenLine(23)).toMatch(/^K Invalid colour,/);
  });
});
