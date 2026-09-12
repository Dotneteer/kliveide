import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import type { SysVar } from "@abstractions/SysVar";
import { SysVarType } from "@abstractions/SysVar";

import { act, createMockStore, renderWithProviders } from "../react-test-utils";
import { setMachineTypeAction } from "@state/actions";
import { MI_SPECTRUM_48, MI_SPECTRUM_128 } from "@common/machines/constants";

/*
 * `VirtualizedList` renders through `virtua`, which needs a `ResizeObserver` jsdom does not ship
 * and a measured viewport it will never get here — with either missing it renders no rows at all.
 * Rendering every item keeps this file about what the panel decides rather than about
 * virtualization, which `test/phase8/VirtualizedList.test.tsx` already covers.
 */
vi.mock("@renderer/controls/VirtualizedList", () => ({
  VirtualizedList: ({ items, renderItem }: any) => (
    <div data-testid="virtualized-list">
      {items.map((_: unknown, index: number) => (
        <div key={index}>{renderItem(index)}</div>
      ))}
    </div>
  )
}));

const emuApi = vi.hoisted(() => ({
  getSysVars: vi.fn(),
  getMemoryContents: vi.fn()
}));

/*
 * The emulator's refresh timer, captured rather than run.
 *
 * The panel's second and later samples are what "changed" is computed from, so the test needs to
 * drive a refresh on demand. Letting the real listener's 100ms interval do it would make every
 * assertion about timing instead.
 */
const listener = vi.hoisted(() => ({ refresh: null as null | (() => Promise<void>) }));

vi.mock("@renderer/core/EmuApi", () => ({ useEmuApi: () => emuApi }));
vi.mock("@renderer/appIde/useStateRefresh", () => ({
  useEmuStateListener: (_api: unknown, callback: () => Promise<void>): void => {
    listener.refresh = callback;
  }
}));

import { SysVarsPanel } from "@renderer/appIde/SiteBarPanels/SysVarsPanel";

const byteVar = (address: number, name: string, description = ""): SysVar => ({
  address,
  name,
  type: SysVarType.Byte,
  description
});

const wordVar = (address: number, name: string): SysVar => ({
  address,
  name,
  type: SysVarType.Word
});

const flagsVar = (address: number, name: string): SysVar => ({
  address,
  name,
  type: SysVarType.Flags,
  flagDecriptions: Array.from({ length: 8 }, (_, bit) => `Bit ${bit} does something`)
});

const arrayVar = (address: number, name: string, length: number): SysVar => ({
  address,
  name,
  type: SysVarType.Array,
  length
});

/** 64K of memory whose every byte is its own low address byte, so a cell's text names its index. */
const memoryByAddress = () => Uint8Array.from({ length: 0x10000 }, (_, i) => i & 0xff);

const SYS_VARS: SysVar[] = [
  arrayVar(0x5c00, "KSTATE", 8),
  byteVar(0x5c08, "LAST-K", "Last key pressed"),
  wordVar(0x5c0b, "DEFADD"),
  flagsVar(0x5c3b, "FLAGS"),
  arrayVar(0x5c4f, "MEMBOT", 30)
];

async function renderPanel(sysVars: SysVar[] = SYS_VARS, memory = memoryByAddress()) {
  emuApi.getSysVars.mockResolvedValue(sysVars);
  emuApi.getMemoryContents.mockResolvedValue({ memory });
  const store = createMockStore();
  store.dispatch(setMachineTypeAction(MI_SPECTRUM_48));
  const result = renderWithProviders(<SysVarsPanel />, { store });
  // --- A machine with no system variables never asks for memory, so wait on the table itself.
  await waitFor(() =>
    expect(sysVars.length ? emuApi.getMemoryContents : emuApi.getSysVars).toHaveBeenCalled()
  );
  return { ...result, store };
}

/** One emulator refresh, with the memory the machine now has. */
async function tick(memory: Uint8Array) {
  emuApi.getMemoryContents.mockResolvedValue({ memory });
  await act(async () => {
    await listener.refresh?.();
  });
}

describe("SysVarsPanel", () => {
  beforeEach(() => {
    emuApi.getSysVars.mockReset();
    emuApi.getMemoryContents.mockReset();
    listener.refresh = null;
  });

  describe("what a row shows", () => {
    it("puts the address in front of the name", async () => {
      await renderPanel();
      // --- The anchor column. It used to be reachable only through the tooltip.
      expect(screen.getByText("$5C08")).toBeTruthy();
      expect(screen.getByText("LAST-K")).toBeTruthy();
    });

    it("shows a byte in hex and decimal", async () => {
      await renderPanel();
      expect(screen.getByText("$08")).toBeTruthy();
      expect(screen.getByText("(8)")).toBeTruthy();
    });

    it("shows a word little-endian", async () => {
      await renderPanel();
      // --- $5C0B holds $0B, $5C0C holds $0C -> $0C0B.
      expect(screen.getByText("$0C0B")).toBeTruthy();
    });
  });

  describe("array variables", () => {
    it("shows a short array in full, with no byte count to disclose", async () => {
      await renderPanel();
      // --- KSTATE is exactly one grid row, so there is nothing to collapse and nothing to count.
      expect(screen.queryByText("(8 bytes)")).toBeNull();
      expect(screen.getByText("07")).toBeTruthy();
    });

    it("collapses a long array to one grid row plus its length", async () => {
      await renderPanel();
      expect(screen.getByText("(30 bytes)")).toBeTruthy();
      // --- MEMBOT runs $5C4F..$5C6C, so its last byte reads 6C and its eighth reads 56.
      expect(screen.getByText("56")).toBeTruthy();
      expect(screen.queryByText("6C")).toBeNull();
    });

    it("expands and collapses the array when its row is clicked", async () => {
      await renderPanel();
      fireEvent.click(screen.getByText("MEMBOT"));
      expect(await screen.findByText("6C")).toBeTruthy();

      fireEvent.click(screen.getByText("MEMBOT"));
      await waitFor(() => expect(screen.queryByText("6C")).toBeNull());
    });
  });

  describe("the filter", () => {
    const filterBox = () => screen.getByLabelText("Filter system variables");

    it("matches on name", async () => {
      await renderPanel();
      fireEvent.change(filterBox(), { target: { value: "mem" } });
      expect(screen.getByText("MEMBOT")).toBeTruthy();
      expect(screen.queryByText("LAST-K")).toBeNull();
    });

    it("matches on the address as it is written in the row", async () => {
      await renderPanel();
      fireEvent.change(filterBox(), { target: { value: "5c0b" } });
      expect(screen.getByText("DEFADD")).toBeTruthy();
      expect(screen.queryByText("MEMBOT")).toBeNull();
    });

    it("counts what survived", async () => {
      await renderPanel();
      fireEvent.change(filterBox(), { target: { value: "5c0" } });
      // --- $5C00, $5C08 and $5C0B.
      expect(screen.getByText("3 / 5")).toBeTruthy();
    });

    it("says so when nothing matches, instead of showing an empty list", async () => {
      await renderPanel();
      fireEvent.change(filterBox(), { target: { value: "nosuchvar" } });
      expect(screen.getByText('No system variable matches "nosuchvar"')).toBeTruthy();
    });

    it("clears from the keyboard and from the button", async () => {
      await renderPanel();
      fireEvent.change(filterBox(), { target: { value: "mem" } });
      fireEvent.keyDown(filterBox(), { key: "Escape" });
      expect(screen.getByText("LAST-K")).toBeTruthy();

      fireEvent.change(filterBox(), { target: { value: "mem" } });
      fireEvent.click(screen.getByLabelText("Clear filter"));
      expect(screen.getByText("LAST-K")).toBeTruthy();
    });

    it("offers no filter box when the machine has no system variables", async () => {
      await renderPanel([]);
      expect(screen.queryByLabelText("Filter system variables")).toBeNull();
      expect(screen.getByText("No system variables available")).toBeTruthy();
    });
  });

  describe("what moved", () => {
    /*
     * The wash, not `.changed`.
     *
     * `--data-changed` and `--color-state-value` are both the accent's `solid`, so the colour form
     * of this signal repaints an accent value in the same accent — visible in the DOM, invisible on
     * screen. Asserting on the class is what keeps a future "simplify this to `changed`" from
     * silently removing the only thing the reader can see.
     */
    const washed = (text: string) => screen.getByText(text).className.includes("changedWash");

    it("marks nothing on the first sample", async () => {
      await renderPanel();
      expect(washed("$08")).toBe(false);
    });

    it("marks a value that moved since the previous refresh", async () => {
      await renderPanel();
      const moved = memoryByAddress();
      moved[0x5c08] = 0x99;
      await tick(moved);
      expect(washed("$99")).toBe(true);
      // --- And only that one: DEFADD did not move.
      expect(washed("$0C0B")).toBe(false);
    });

    it("stops marking it once it holds still", async () => {
      await renderPanel();
      const moved = memoryByAddress();
      moved[0x5c08] = 0x99;
      await tick(moved);
      await tick(moved);
      expect(washed("$99")).toBe(false);
    });

    it("marks the individual array bytes that moved", async () => {
      await renderPanel();
      const moved = memoryByAddress();
      moved[0x5c02] = 0xaa;
      await tick(moved);
      expect(washed("AA")).toBe(true);
      expect(washed("07")).toBe(false);
    });
  });

  describe("what it asks the emulator for", () => {
    /*
     * The variable table is static per machine; only its values move. This used to be two IPC round
     * trips per tick, one of which could only ever return the descriptors it returned last time.
     */
    it("fetches the variable table once, however often the values refresh", async () => {
      await renderPanel();
      expect(emuApi.getSysVars).toHaveBeenCalledTimes(1);

      await tick(memoryByAddress());
      await tick(memoryByAddress());

      expect(emuApi.getSysVars).toHaveBeenCalledTimes(1);
      expect(emuApi.getMemoryContents.mock.calls.length).toBeGreaterThanOrEqual(3);
    });

    it("re-fetches the table when the machine changes", async () => {
      const { store } = await renderPanel();
      expect(emuApi.getSysVars).toHaveBeenCalledTimes(1);

      emuApi.getSysVars.mockResolvedValue([byteVar(0x00a2, "TIME")]);
      await act(async () => {
        store.dispatch(setMachineTypeAction(MI_SPECTRUM_128));
      });

      await waitFor(() => expect(emuApi.getSysVars).toHaveBeenCalledTimes(2));
      expect(await screen.findByText("TIME")).toBeTruthy();
      expect(screen.queryByText("LAST-K")).toBeNull();
    });
  });
});
