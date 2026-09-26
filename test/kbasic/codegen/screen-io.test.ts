import { describe, expect, it } from "vitest";

import { runBasic } from "./run-kit";

/** Permanent colours, BORDER, the keyboard (INKEY$, PAUSE) and the ports (IN, OUT) on the 48K. */
const attr = (r: Awaited<ReturnType<typeof runBasic>>, row: number, col: number) => r.session.peek(0x5800 + row * 32 + col);

describe("colours and BORDER", () => {
  it("makes colour statements permanent, and PRINT items last only for their PRINT", async () => {
    const r = await runBasic('INK 2: PAPER 6\nPRINT "A"\nPRINT INK 5; BRIGHT 1; "B"\nPRINT "C"\nFLASH 1: INVERSE 1\nPRINT "D"\n');
    expect(r.screen(4)).toEqual(["A", "B", "C", "D"]);
    expect(attr(r, 0, 0)).toBe((6 << 3) | 2);
    expect(attr(r, 1, 0)).toBe(0x40 | (6 << 3) | 5);
    expect(attr(r, 2, 0)).toBe((6 << 3) | 2);
    expect(attr(r, 3, 0)).toBe(0x80 | (6 << 3) | 2);
    // --- The ROM's permanent colours follow, so BASIC carries on with them
    expect(r.session.peek(0x5c8d), "ATTR_P").toBe(0x80 | (6 << 3) | 2);
    expect(r.session.peek(0x5c91) & 0x0c, "P_FLAG INVERSE").toBe(0x0c);
  });

  it("keeps a field from the screen with 8", async () => {
    const r = await runBasic('PAPER 1\nPRINT AT 0, 0; "X"\nPAPER 8: INK 7\nPRINT AT 0, 0; "Y"\n');
    expect(attr(r, 0, 0)).toBe((1 << 3) | 7);
  });

  it("sets the border and BORDCR", async () => {
    const r = await runBasic("BORDER 2\n");
    expect(r.session.peek(0x5c48)).toBe((2 << 3) | 7);
    const light = await runBasic("DIM c AS UByte = 5\nBORDER c\n");
    expect(light.session.peek(0x5c48)).toBe(5 << 3);
  });

  it("stops with K Invalid colour", async () => {
    const r = await runBasic("DIM c AS UByte = 9\nBORDER c\n", { expectEnd: false, frames: 60 });
    expect(r.session.screenLine(23)).toMatch(/^K Invalid colour/);
  });
});

describe("the keyboard", () => {
  const readKey = 'DIM k$ AS String\nDO\n k$ = INKEY$\nLOOP UNTIL k$ <> ""\nPRINT CODE(k$); " "; k$\n';

  it.each([
    [["G"], "103 g"],
    [["CShift", "G"], "71 G"],
    [["SShift", "P"], '34 "'],
    [["N7"], "55 7"],
    // --- CHR$ 13 is a new line
    [["Enter"], "13"]
  ])("INKEY$ reads %j", async (keys, expected) => {
    const r = await runBasic(readKey, { before: (s) => s.keyDown(...keys), frames: 100 });
    expect(r.screen(1)[0]).toBe(expected);
  });

  it("gives the empty String when no key is down", async () => {
    const r = await runBasic('PRINT LEN(INKEY$); "|"; INKEY$; "|"\n');
    expect(r.screen(1)[0]).toBe("0||");
  });

  it("PAUSE counts frames", async () => {
    const r = await runBasic("DIM t0, t1 AS UInteger\nt0 = PEEK(UInteger, 23672)\nPAUSE 10\nt1 = PEEK(UInteger, 23672)\nPRINT t1 - t0\n");
    expect(r.screen(1)[0]).toBe("10");
  });

  it("PAUSE 0 waits for a key, but not one already down when it starts", async () => {
    const r = await runBasic("PAUSE 0\nPRINT \"done\"\n", { before: (s) => s.keyDown("A"), expectEnd: false, frames: 20 });
    expect(r.screen(1)).toEqual([]);
    r.session.keyUp("A").runFrames(3).keyDown("B").runFrames(3);
    expect(r.screen(1)).toEqual(["done"]);
  });
});

describe("ports", () => {
  it("OUT writes a port and IN reads one", async () => {
    // --- Port $FE bits 0-2 are the border; reading $7FFE gives the SPACE half-row (bit 0 = 0: down)
    const r = await runBasic("OUT 254, 3\nPRINT IN(32766) BAND 1\n", { before: (s) => s.keyDown("Space") });
    expect(r.screen(1)[0]).toBe("0");
  });
});

describe("BOLD, ITALIC and contrast", () => {
  const cell = (r: Awaited<ReturnType<typeof runBasic>>, col: number) => Array.from({ length: 8 }, (_, line) => r.session.peek(0x4000 + (line << 8) + col));

  it("thickens with BOLD and slants with ITALIC", async () => {
    const r = await runBasic('PRINT "I"; BOLD 1; "I"; BOLD 0; ITALIC 1; "I"\n');
    const [plain, bold, italic] = [cell(r, 0), cell(r, 1), cell(r, 2)];
    expect(bold).toEqual(plain.map((row) => row | (row >> 1)));
    expect(italic).toEqual(plain.map((row, line) => (line < 3 ? row >> 1 : line > 4 ? (row << 1) & 0xff : row)));
  });

  it("chooses a contrasting INK or PAPER with 9", async () => {
    const r = await runBasic('PAPER 1: INK 9\nPRINT "a";\nPAPER 6\nPRINT "b";\nINK 2: PAPER 9\nPRINT "c"\n');
    expect([attr(r, 0, 0), attr(r, 0, 1), attr(r, 0, 2)]).toEqual([(1 << 3) | 7, (6 << 3) | 0, (7 << 3) | 2]);
    expect(r.session.peek(0x5c91) & 0xf0, "P_FLAG: PAPER 9 now, INK 9 no longer").toBe(0xc0);
  });
});
