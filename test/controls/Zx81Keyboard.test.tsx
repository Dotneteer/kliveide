/**
 * The ZX81 virtual keyboard (`.plans/ZX8081_WASM_PLAN.md` §8.1): every key of the approved design is
 * rendered, and each zone sends what §8.1.5 says - the key face holds the key (SHIFT too on the right
 * button), the red legend holds SHIFT with the key, the function and the graphic queue keystrokes
 * with gaps the ROM's debounce accepts.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { renderWithProviders, act } from "../react-test-utils";
import { Zx81Keyboard, ZX81_KEY_ROWS } from "@renderer/appEmu/Keyboard/Zx81Keyboard";
import { zx81GlyphCells } from "@renderer/appEmu/Keyboard/Zx81Key";

const machine = {
  getKeyQueueLength: vi.fn(() => 0),
  setKeyStatus: vi.fn(),
  queueKeystroke: vi.fn()
};

vi.mock("@appIde/services/AppServicesProvider", () => ({
  useAppServices: () => ({
    machineService: {
      getMachineController: () => ({ machine }),
      getMachineInfo: () => ({ machine: { displayName: "Sinclair ZX81" }, model: undefined })
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
    result = renderWithProviders(<Zx81Keyboard width={1400} height={520} />);
  });
  return result!.container;
}

/** The zone of a key: the element carrying its mouse handlers (the face's zone holds the key's rect) */
function zoneOf(container: HTMLElement, code: number, zone: "face" | "shift" | "below" | "glyph"): Element {
  const key = container.querySelector(`svg[data-zx81-key="${code}"]`)!;
  const pick =
    zone === "face"
      ? [...key.querySelectorAll('[data-zone="main"]')].find((g) => g.querySelector("rect[rx]"))
      : key.querySelector(`[data-zone="${zone}"]`);
  if (!pick) throw new Error(`key ${code} has no ${zone} zone`);
  return pick;
}

beforeEach(() => {
  machine.setKeyStatus.mockClear();
  machine.queueKeystroke.mockClear();
  machine.getKeyQueueLength.mockReturnValue(0);
});

describe("ZX81 virtual keyboard", () => {
  it("renders all 40 keys of the matrix, each once", async () => {
    const container = await render();
    const codes = [...container.querySelectorAll("svg[data-zx81-key]")].map((s) => Number(s.getAttribute("data-zx81-key")));
    expect(codes).toHaveLength(40);
    expect(new Set(codes)).toEqual(new Set(Array.from({ length: 40 }, (_, i) => i)));
    expect(ZX81_KEY_ROWS.map((r) => r.length)).toEqual([10, 10, 10, 10]);
  });

  it("prints the legends of the design: keywords above, functions below, the slashed zero", async () => {
    const container = await render();
    const text = container.textContent ?? "";
    for (const legend of ["PLOT", "SIN", "ARCSIN", "INKEY$", "BREAK", "FUNCTION", "GRAPHICS", "RUBOUT", "Ø", "SHIFT"]) {
      expect(text).toContain(legend);
    }
  });

  it("the key face holds the key; the right button adds SHIFT", async () => {
    const container = await render();
    const face = zoneOf(container, 25, "face");
    fireEvent.mouseDown(face, { button: 0 });
    expect(machine.setKeyStatus.mock.calls).toEqual([[25, true]]);
    fireEvent.mouseUp(face, { button: 0 });
    expect(machine.setKeyStatus).toHaveBeenLastCalledWith(25, false);
    machine.setKeyStatus.mockClear();
    fireEvent.mouseDown(face, { button: 2 });
    expect(machine.setKeyStatus.mock.calls).toEqual([[25, true], [0, true]]);
  });

  it("the red legend holds SHIFT with the key", async () => {
    const container = await render();
    fireEvent.mouseDown(zoneOf(container, 25, "shift"), { button: 0 });
    expect(machine.setKeyStatus.mock.calls).toEqual([[25, true], [0, true]]);
  });

  it("the function legend queues FUNCTION mode (SHIFT + NEW LINE), then the key", async () => {
    const container = await render();
    fireEvent.mouseDown(zoneOf(container, 10, "below"), { button: 0 });
    expect(machine.queueKeystroke.mock.calls).toEqual([
      [0, 4, 30, 0],
      [10, 4, 10]
    ]);
  });

  it("the graphic queues GRAPHICS on, SHIFT + the key, GRAPHICS off", async () => {
    const container = await render();
    fireEvent.mouseDown(zoneOf(container, 10, "glyph"), { button: 0 });
    expect(machine.queueKeystroke.mock.calls).toEqual([
      [0, 4, 21, 0],
      [10, 4, 10, 0],
      [20, 4, 21, 0]
    ]);
  });

  it("ignores clicks while queued keystrokes are still playing", async () => {
    const container = await render();
    machine.getKeyQueueLength.mockReturnValue(2);
    fireEvent.mouseDown(zoneOf(container, 25, "face"), { button: 0 });
    expect(machine.setKeyStatus).not.toHaveBeenCalled();
  });

  it("draws the block graphics of §8.1.4, inverse ones with ink and paper swapped", () => {
    expect(zx81GlyphCells(0x01)).toEqual(["i", "p", "p", "p"]);
    expect(zx81GlyphCells(0x87)).toEqual(["p", "p", "p", "i"]);
    expect(zx81GlyphCells(0x0a)).toEqual(["g", "g", "p", "p"]);
    expect(zx81GlyphCells(0x8a)).toEqual(["g", "g", "i", "i"]);
  });
});
