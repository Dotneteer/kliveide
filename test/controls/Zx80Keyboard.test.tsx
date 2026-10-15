/**
 * The ZX80 virtual keyboard (`.plans/ZX8081_WASM_PLAN.md` §8.1.9): all 40 keys render, a click holds
 * the key (SHIFT too for an amber legend or the right button), and the legend table agrees with the
 * 4K ROM itself - its key tables, its keyword table and the graphics in its character set.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { renderWithProviders, act } from "../react-test-utils";
import { Zx80Keyboard, ZX80_KEY_ROWS } from "@renderer/appEmu/Keyboard/Zx80Keyboard";
import { zx80GlyphCells, type Zx80KeyDef } from "@renderer/appEmu/Keyboard/Zx80Key";

const machine = {
  getKeyQueueLength: vi.fn(() => 0),
  setKeyStatus: vi.fn(),
  queueKeystroke: vi.fn()
};

vi.mock("@appIde/services/AppServicesProvider", () => ({
  useAppServices: () => ({
    machineService: {
      getMachineController: () => ({ machine }),
      getMachineInfo: () => ({ machine: { displayName: "Sinclair ZX80" }, model: undefined })
    },
    uiService: { dragging: false },
    outputPaneService: { getBuffer: () => null }
  })
}));

(globalThis as any).ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

async function render() {
  let result: ReturnType<typeof renderWithProviders>;
  await act(async () => {
    result = renderWithProviders(<Zx80Keyboard width={1400} height={500} />);
  });
  return result!.container;
}

/** A zone of a key: the face (the zone holding the key's rect), the keyword, or an amber legend */
function zoneOf(container: HTMLElement, code: number, zone: "face" | "keyword" | "shift"): Element {
  const key = container.querySelector(`svg[data-zx80-key="${code}"]`)!;
  const mains = [...key.querySelectorAll('[data-zone="main"]')];
  const pick =
    zone === "face"
      ? mains.find((g) => g.querySelector("rect[rx]"))
      : zone === "keyword"
        ? mains.find((g) => !g.querySelector("rect[rx]"))
        : key.querySelector('[data-zone="shift"]');
  if (!pick) throw new Error(`key ${code} has no ${zone} zone`);
  return pick;
}

beforeEach(() => {
  machine.setKeyStatus.mockClear();
  machine.queueKeystroke.mockClear();
  machine.getKeyQueueLength.mockReturnValue(0);
});

describe("ZX80 virtual keyboard", () => {
  it("renders all 40 keys of the matrix, each once", async () => {
    const container = await render();
    const codes = [...container.querySelectorAll("svg[data-zx80-key]")].map((s) => Number(s.getAttribute("data-zx80-key")));
    expect(codes).toHaveLength(40);
    expect(new Set(codes)).toEqual(new Set(Array.from({ length: 40 }, (_, i) => i)));
    expect(ZX80_KEY_ROWS.map((r) => r.length)).toEqual([10, 10, 10, 10]);
  });

  it("prints the ZX80's legends: keywords, shifted words, NEW LINE, BREAK", async () => {
    const container = await render();
    const text = container.textContent ?? "";
    for (const legend of ["NEW", "LIST", "GOSUB", "RET", "NOT", "HOME", "RUBOUT", "EDIT", "BREAK", "OR", "SHIFT", "LINE"]) {
      expect(text).toContain(legend);
    }
    // --- No ZX81 function mode
    expect(text).not.toContain("FUNCTION");
  });

  it("the key face and the keyword above it hold the key; the right button adds SHIFT", async () => {
    const container = await render();
    fireEvent.mouseDown(zoneOf(container, 10, "face"), { button: 0 });
    expect(machine.setKeyStatus.mock.calls).toEqual([[10, true]]);
    fireEvent.mouseUp(zoneOf(container, 10, "face"), { button: 0 });
    expect(machine.setKeyStatus).toHaveBeenLastCalledWith(10, false);
    machine.setKeyStatus.mockClear();
    fireEvent.mouseDown(zoneOf(container, 10, "keyword"), { button: 0 });
    expect(machine.setKeyStatus.mock.calls).toEqual([[10, true]]);
    machine.setKeyStatus.mockClear();
    fireEvent.mouseDown(zoneOf(container, 10, "face"), { button: 2 });
    expect(machine.setKeyStatus.mock.calls).toEqual([[10, true], [0, true]]);
  });

  it("an amber legend, arrow or graphic holds SHIFT with the key; nothing is queued", async () => {
    const container = await render();
    for (const code of [25, 19, 10, 30]) {
      machine.setKeyStatus.mockClear();
      fireEvent.mouseDown(zoneOf(container, code, "shift"), { button: 0 });
      expect(machine.setKeyStatus.mock.calls).toEqual([[code, true], [0, true]]);
    }
    expect(machine.queueKeystroke).not.toHaveBeenCalled();
  });

  it("ignores clicks while queued keystrokes are still playing", async () => {
    const container = await render();
    machine.getKeyQueueLength.mockReturnValue(2);
    fireEvent.mouseDown(zoneOf(container, 25, "face"), { button: 0 });
    expect(machine.setKeyStatus).not.toHaveBeenCalled();
  });
});

describe("ZX80 key legends against the 4K ROM", () => {
  const rom = readFileSync(join(__dirname, "../../src/public/roms/zx80.rom"));

  /** The ZX80 character set $00-$3F as the keyboard prints it */
  const CHARS = [' ', '"', ...Array(10).fill("▒"), "£", "$", ":", "?", "(", ")", "−", "+", "*", "/", "=", ">", "<", ";", ",", "."]
    .concat([..."0123456789"], [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"]);

  /** The ROM's tokens from $D4, as words; the keyboard prints a few abbreviated */
  const tokens: string[] = [];
  {
    let word = "";
    for (let a = 0xba; tokens.length < 46; a++) {
      word += CHARS[rom[a] & 0x3f];
      if (rom[a] & 0x80) {
        tokens.push(word);
        word = "";
      }
    }
  }
  const token = (code: number) => tokens[code - 0xd4 + 2];
  const PRINTED: Record<string, string> = { CONTINUE: "CONT", "GO TO": "GOTO", "GO SUB": "GOSUB", RETURN: "RET", RANDOMISE: "RAND" };
  const CONTROL: Record<number, Partial<Zx80KeyDef>> = {
    0x70: { arrow: "u" },
    0x71: { arrow: "d" },
    0x72: { arrow: "l" },
    0x73: { arrow: "r" },
    0x74: { sa: "HOME" },
    0x75: { sa: "EDIT" },
    0x77: { sa: "RUBOUT" }
  };

  /** The matrix order of the ROM's tables ($006C unshifted, $0093 shifted): SHIFT itself is not in them */
  const MATRIX_ORDER = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39];
  const byCode = new Map(ZX80_KEY_ROWS.flat().map((d) => [d.c, d]));

  it("every key's main, shifted and keyword legends are the ROM's", () => {
    MATRIX_ORDER.forEach((code, i) => {
      const def = byCode.get(code)!;
      const plain = rom[0x6c + i];
      const shifted = rom[0x93 + i];

      // --- Main legend
      if (plain === 0x76) expect(def.nl).toBe(true);
      else if (plain === 0x00) expect(def.space).toBe(true);
      else expect(def.m).toBe(CHARS[plain]);

      // --- Shifted legend: a graphic, a character, a token or a control
      if (shifted >= 0x02 && shifted <= 0x0b) expect(def.g).toBe(shifted);
      else if (shifted < 0x40) expect(def.s).toBe(CHARS[shifted]);
      else if (shifted >= 0xd4) {
        const t = token(shifted);
        expect(def.s ?? def.sa).toBe(t);
      } else expect(def).toMatchObject(CONTROL[shifted]);

      // --- Keyword: in K mode the ROM adds $C0 to the character ($0346) and keeps it from $E6
      const kw = plain + 0xc0;
      const expected = plain >= 0x26 && plain <= 0x3f && kw <= 0xff && token(kw) && token(kw) !== "?" ? token(kw) : undefined;
      expect(def.k).toBe(expected ? (PRINTED[expected] ?? expected) : undefined);
    });
  });

  it("draws each graphic as the ROM's character set ($0E00) shapes it", () => {
    for (let code = 0x02; code <= 0x0b; code++) {
      const rows = rom.subarray(0xe00 + code * 8, 0xe00 + code * 8 + 8);
      const quadrant = (top: boolean, left: boolean) => {
        const half = top ? rows.subarray(0, 4) : rows.subarray(4, 8);
        const bits = [...half].map((r) => (left ? r >> 4 : r & 0x0f));
        return bits.every((b) => b === 0x0f) ? "i" : bits.every((b) => b === 0) ? "p" : "g";
      };
      expect(zx80GlyphCells(code)).toEqual([quadrant(true, true), quadrant(true, false), quadrant(false, true), quadrant(false, false)]);
    }
  });
});
