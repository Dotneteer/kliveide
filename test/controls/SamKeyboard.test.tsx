/**
 * The SAM Coupé virtual keyboard (`dev/plans/SAM_COUPE_PLAN.md` §9.1), drawn from a photo of a SAM Coupé:
 * every matrix key is on it (SHIFT and SYMBOL twice, the full stop once more in the cluster), the caps
 * print what the photo prints, no two keys overlap, and each zone sends its matrix key - the cap holds the
 * key (SHIFT too on the right button), a shifted legend holds SHIFT with it, a SYMBOL legend SYMBOL.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { renderWithProviders, act } from "../react-test-utils";
import { SamKeyboard, SAM_KEYS } from "@renderer/appEmu/Keyboard/SamKeyboard";
import { SamKeyCode as K } from "@emu/machines/samcoupe/SamKeyCode";

const machine = {
  getKeyQueueLength: vi.fn(() => 0),
  setKeyStatus: vi.fn()
};

vi.mock("@appIde/services/AppServicesProvider", () => ({
  useAppServices: () => ({
    machineService: {
      getMachineController: () => ({ machine }),
      getMachineInfo: () => ({ machine: { displayName: "SAM Coupé" }, model: undefined })
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
    result = renderWithProviders(<SamKeyboard width={1400} height={500} />);
  });
  return result!.container;
}

function zoneOf(container: HTMLElement, name: string, zone: "main" | "shift" | "symbol", index = 0): Element {
  const key = container.querySelectorAll(`[data-sam-key="${name}"]`)[index];
  const pick = key?.querySelector(`[data-zone="${zone}"]`);
  if (!pick) throw new Error(`key ${name} has no ${zone} zone`);
  return pick;
}

beforeEach(() => {
  machine.setKeyStatus.mockClear();
  machine.getKeyQueueLength.mockReturnValue(0);
});

describe("SAM Coupé virtual keyboard", () => {
  it("draws every key of the matrix; SHIFT and SYMBOL have two caps, the full stop is in the cluster too", async () => {
    const container = await render();
    const names = [...container.querySelectorAll("[data-sam-key]")].map((g) => g.getAttribute("data-sam-key")!);
    expect(new Set(names)).toEqual(new Set(Object.keys(K)));
    const count = (n: string) => names.filter((x) => x === n).length;
    expect([count("Shift"), count("Symbol"), count("Period")]).toEqual([2, 2, 2]);
    expect(names).toHaveLength(Object.keys(K).length + 3);
  });

  it("puts no two keys on top of each other", () => {
    const boxes = SAM_KEYS.flatMap((k) => {
      const w = k.w ?? 1;
      if (k.lowerX === undefined) return [{ name: k.name, x0: k.x, y0: k.y, x1: k.x + w, y1: k.y + (k.h ?? 1) }];
      // --- RETURN: its upper half over its row, its wider lower half over the next
      return [
        { name: k.name, x0: k.x, y0: k.y, x1: k.x + w, y1: k.y + 1 },
        { name: k.name, x0: k.lowerX, y0: k.y + 1, x1: k.x + w, y1: k.y + 2 }
      ];
    });
    for (const a of boxes) {
      for (const b of boxes) {
        if (a === b || a.name === b.name) continue;
        const overlap = a.x0 < b.x1 - 0.01 && b.x0 < a.x1 - 0.01 && a.y0 < b.y1 - 0.01 && b.y0 < a.y1 - 0.01;
        if (overlap) throw new Error(`${a.name} overlaps ${b.name}`);
      }
    }
  });

  it("prints the photo's legends", async () => {
    const text = (await render()).textContent ?? "";
    for (const legend of ["ESC", "TAB", "CAPS", "SHIFT", "SYMBOL", "CNTRL", "EDIT", "DELETE", "RETURN", "INV", "F0", "F9"]) {
      expect(text, legend).toContain(legend);
    }
    const printed = Object.fromEntries(SAM_KEYS.filter((k) => k.top).map((k) => [k.name, `${k.top}${k.topKind === "symbol" ? " sym" : ""}`]));
    expect(printed).toMatchObject({
      N2: "@",
      N0: "~",
      Minus: "/",
      Plus: "*",
      Equals: "_",
      Quote: "©",
      Inv: "\\",
      Q: "< sym",
      W: "> sym",
      R: "[ sym",
      T: "] sym",
      F: "{ sym",
      G: "} sym",
      H: "↑ sym",
      L: "£ sym",
      X: "? sym"
    });
  });

  it("the cap holds the key; the right button adds SHIFT", async () => {
    const container = await render();
    const cap = zoneOf(container, "Z", "main");
    fireEvent.mouseDown(cap, { button: 0 });
    expect(machine.setKeyStatus.mock.calls).toEqual([[K.Z, true]]);
    fireEvent.mouseUp(cap, { button: 0 });
    machine.setKeyStatus.mockClear();
    fireEvent.mouseDown(cap, { button: 2 });
    expect(machine.setKeyStatus.mock.calls).toEqual([
      [K.Z, true],
      [K.Shift, true]
    ]);
  });

  it("a shifted legend holds SHIFT with the key, a SYMBOL legend SYMBOL", async () => {
    const container = await render();
    fireEvent.mouseDown(zoneOf(container, "N2", "shift"), { button: 0 });
    expect(machine.setKeyStatus.mock.calls).toEqual([
      [K.N2, true],
      [K.Shift, true]
    ]);
    machine.setKeyStatus.mockClear();
    fireEvent.mouseDown(zoneOf(container, "L", "symbol"), { button: 0 });
    expect(machine.setKeyStatus.mock.calls).toEqual([
      [K.L, true],
      [K.Symbol, true]
    ]);
  });

  it("the cluster's keys are the function and cursor keys", async () => {
    const container = await render();
    for (const name of ["F0", "F7", "Up", "Left", "Down", "Right"]) {
      machine.setKeyStatus.mockClear();
      fireEvent.mouseDown(zoneOf(container, name, "main"), { button: 0 });
      expect(machine.setKeyStatus.mock.calls, name).toEqual([[K[name], true]]);
    }
  });

  it("a SHIFT cap on the right button presses only itself; clicks wait while the typer types", async () => {
    const container = await render();
    fireEvent.mouseDown(zoneOf(container, "Shift", "main", 1), { button: 2 });
    expect(machine.setKeyStatus.mock.calls).toEqual([[K.Shift, true]]);
    machine.setKeyStatus.mockClear();
    machine.getKeyQueueLength.mockReturnValue(3);
    fireEvent.mouseDown(zoneOf(container, "A", "main"), { button: 0 });
    expect(machine.setKeyStatus).not.toHaveBeenCalled();
  });
});
