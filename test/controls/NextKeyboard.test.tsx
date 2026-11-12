/**
 * The ZX Spectrum Next virtual keyboard: its sixteen extra keys press the Next's extra-key codes
 * (`NextExtraKeyCode`, 40-55), not the two matrix keys each one enters. The core then sets the key's
 * bit in NextReg $B0/$B1 and enters the pair unless NextReg $68 bit 4 cancels it (KEY-009 in
 * test/zxnext-hw/keyboard/host-keys.test.ts). The ordinary keys still press matrix keys.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { renderWithProviders, act } from "../react-test-utils";
import { NextKeyboard } from "@renderer/appEmu/Keyboard/NextKeyboard";
import { NextExtraKeyCode } from "@emu/machines/zxNext/nextKeyCodes";
import { SpectrumKeyCode } from "@emu/machines/zxSpectrum/SpectrumKeyCode";

const machine = {
  getKeyQueueLength: vi.fn(() => 0),
  setKeyStatus: vi.fn(),
  queueKeystroke: vi.fn(),
  getCursorMode: vi.fn(() => 0)
};

vi.mock("@appIde/services/AppServicesProvider", () => ({
  useAppServices: () => ({
    machineService: {
      getMachineController: () => ({ machine }),
      getMachineInfo: () => ({ machine: { displayName: "ZX Spectrum Next" }, model: undefined })
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
    result = renderWithProviders(<NextKeyboard width={1100} height={420} />);
  });
  return result!.container;
}

/** The SVG text with exactly this content (a key's legend), the `index`-th one */
function legend(container: HTMLElement, text: string, index = 0): Element {
  const found = [...container.querySelectorAll("text")].filter((t) => t.textContent === text);
  if (!found[index]) throw new Error(`no legend '${text}'`);
  return found[index];
}

/** Presses and releases the key with this legend; returns the setKeyStatus calls */
function click(container: HTMLElement, text: string, index = 0): Array<[number, boolean]> {
  machine.setKeyStatus.mockClear();
  const el = legend(container, text, index);
  fireEvent.mouseDown(el, { button: 0 });
  fireEvent.mouseUp(el, { button: 0 });
  return machine.setKeyStatus.mock.calls as Array<[number, boolean]>;
}

beforeEach(() => {
  machine.setKeyStatus.mockClear();
  machine.getKeyQueueLength.mockReturnValue(0);
});

describe("ZX Spectrum Next virtual keyboard", () => {
  const EXTRA: Array<[string, number]> = [
    ["BREAK", NextExtraKeyCode.Break],
    ["EDIT", NextExtraKeyCode.Edit],
    ["DELETE", NextExtraKeyCode.Delete],
    ["TRUE", NextExtraKeyCode.TrueVideo],
    ["INV", NextExtraKeyCode.InvVideo],
    ["CAPS", NextExtraKeyCode.CapsLock],
    ["GRAPH", NextExtraKeyCode.Graph],
    ["EXTEND", NextExtraKeyCode.Extend],
    ["▲", NextExtraKeyCode.Up],
    ["▼", NextExtraKeyCode.Down],
    ["◀", NextExtraKeyCode.Left],
    ["▶", NextExtraKeyCode.Right],
    [";", NextExtraKeyCode.Semicolon],
    ['"', NextExtraKeyCode.DoubleQuote],
    [",", NextExtraKeyCode.Comma],
    [".", NextExtraKeyCode.Period]
  ];

  it("each extra key presses its own extra-key code and nothing else", async () => {
    const container = await render();
    for (const [text, code] of EXTRA) {
      expect(click(container, text), text).toEqual([
        [code, true],
        [code, false]
      ]);
    }
  });

  it("an ordinary key still presses its matrix key", async () => {
    const container = await render();
    expect(click(container, "Q")).toEqual([
      [SpectrumKeyCode.Q, true],
      [SpectrumKeyCode.Q, false]
    ]);
  });
});
