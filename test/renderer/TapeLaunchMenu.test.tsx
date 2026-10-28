import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  MI_HT1080Z,
  MI_SPECTRUM_128,
  MI_SPECTRUM_3E,
  MI_SPECTRUM_48,
  MI_TVC,
  MI_Z88,
  MI_ZXNEXT
} from "@common/machines/constants";

/*
 * The tape launch entries (`.plans/TAPE_VIEWER_PLAN.md` §4.6, §7 Q1): the Explorer's context menu and
 * the tape viewer's tab-bar buttons. Both only run the `tape-load` command, which
 * `test/commands/TapeLoadCommand.test.ts` covers.
 */

const PATH = "/project/my game.tzx";

beforeEach(() => {
  Object.defineProperty(document, "queryCommandSupported", {
    configurable: true,
    value: vi.fn(() => false)
  });
});

afterEach(() => {
  cleanup();
  vi.resetModules();
  vi.restoreAllMocks();
});

const appState = (machineId?: string) => ({ emulatorState: { machineId } });

/** One API object per byte array, so the bar's effect does not re-run on every render */
const mainApis = new Map<Uint8Array, unknown>();
const MAIN_API = (bytes: Uint8Array) => {
  if (!mainApis.has(bytes)) mainApis.set(bytes, { readBinaryFile: () => Promise.resolve(bytes) });
  return mainApis.get(bytes);
};

async function loadModule(machineId?: string, fastLoad = true, fileBytes: Uint8Array = new Uint8Array()) {
  const executeCommand = vi.fn(() => Promise.resolve({ success: true }));
  // --- An HT tape's bar reads the file to know whether it names a start address
  vi.doMock("@renderer/core/MainApi", () => ({
    useMainApi: () => MAIN_API(fileBytes)
  }));
  vi.doMock("@renderer/appIde/services/AppServicesProvider", () => ({
    useAppServices: () => ({ ideCommandsService: { executeCommand } })
  }));
  vi.doMock("@renderer/core/RendererProvider", () => ({
    useSelector: (selector: (s: any) => any) => selector(appState(machineId)),
    useGlobalSetting: () => fastLoad,
    useRendererContext: () => ({ store: { getState: () => appState(machineId) } })
  }));
  vi.doMock("@renderer/theming/ThemeProvider", () => ({
    useTheme: () => ({
      theme: { tone: "dark" },
      getIcon: () => ({ width: 16, height: 16, path: "" }),
      getThemeProperty: () => "currentColor"
    }),
    default: ({ children }: { children: ReactNode }) => <>{children}</>
  }));
  vi.doMock("@renderer/controls/Icon", () => ({
    Icon: ({ iconName }: { iconName: string }) => <span data-testid={`icon-${iconName}`} />
  }));
  const module = await import("@renderer/features/documents/TapeLaunchMenu");
  return { ...module, executeCommand };
}

describe("Tape launch - Explorer context menu", () => {
  it.each([
    [0, "Load and run tape", `tape-load "${PATH}" -r`],
    [1, "Insert tape", `tape-load "${PATH}"`],
    [2, "Load and debug tape", `tape-load "${PATH}" -d`]
  ])("entry %i, %s, runs %s", async (index, text, command) => {
    const { getTapeLaunchContextMenuInfo, executeCommand } = await loadModule(MI_SPECTRUM_48);
    const entries = getTapeLaunchContextMenuInfo({ ideCommandsService: { executeCommand } } as any);
    expect(entries).toHaveLength(3);
    expect(entries[index].text).toBe(text);
    await entries[index].clicked!(PATH);
    expect(executeCommand).toHaveBeenCalledWith(command);
  });

  it.each([
    [MI_SPECTRUM_48, false],
    [MI_SPECTRUM_128, false],
    [MI_SPECTRUM_3E, false],
    [MI_ZXNEXT, true],
    [MI_Z88, true]
  ])("on %s the entries are disabled: %s", async (machineId, disabled) => {
    const { getTapeLaunchContextMenuInfo, executeCommand } = await loadModule(machineId);
    const entries = getTapeLaunchContextMenuInfo({ ideCommandsService: { executeCommand } } as any);
    const store = { getState: () => appState(machineId) } as any;
    expect(entries.map((entry) => entry.disabled!(store, PATH))).toEqual([
      disabled,
      disabled,
      disabled
    ]);
  });
});

describe("Tape launch - tab bar", () => {
  it("runs the three actions", async () => {
    const { tapeLaunchCommandBarRenderer, executeCommand } = await loadModule(MI_SPECTRUM_128);
    render(<>{tapeLaunchCommandBarRenderer(PATH)}</>);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(3);
    for (const icon of ["play", "cassette-tape", "debug"]) {
      expect(screen.getByTestId(`icon-${icon}`)).toBeInTheDocument();
    }
    buttons.forEach((b) => fireEvent.click(b));
    expect(executeCommand.mock.calls.map((c: any) => c[0])).toEqual([
      `tape-load "${PATH}" -r`,
      `tape-load "${PATH}"`,
      `tape-load "${PATH}" -d`
    ]);
  });

  it("says whether fast load is on", async () => {
    const { tapeLaunchCommandBarRenderer } = await loadModule(MI_SPECTRUM_48, false);
    render(<>{tapeLaunchCommandBarRenderer(PATH)}</>);
    expect(screen.getAllByRole("button")[0].getAttribute("aria-label")).toMatch(/fast load off/);
  });

  it("disables every button on the ZX Spectrum Next, and says why", async () => {
    const { tapeLaunchCommandBarRenderer, executeCommand } = await loadModule(MI_ZXNEXT);
    render(<>{tapeLaunchCommandBarRenderer(PATH)}</>);
    const buttons = screen.getAllByRole("button");
    for (const button of buttons) {
      expect(button).toBeDisabled();
      expect(button.getAttribute("aria-label")).toMatch(
        /\(requires a ZX Spectrum 48K, 128K or \+2\/\+3 machine\)/
      );
    }
    fireEvent.click(buttons[0]);
    expect(executeCommand).not.toHaveBeenCalled();
  });
});

describe("Tape launch - HT-1080Z tapes (.cas, .cmd)", () => {
  const CAS = "/project/game.cas";

  it.each([
    [MI_HT1080Z, false],
    [MI_SPECTRUM_48, true],
    [MI_ZXNEXT, true]
  ])("on %s the Explorer entries are disabled: %s", async (machineId, disabled) => {
    const { getHtTapeLaunchContextMenuInfo, executeCommand } = await loadModule(machineId);
    const entries = getHtTapeLaunchContextMenuInfo({ ideCommandsService: { executeCommand } } as any);
    const store = { getState: () => appState(machineId) } as any;
    // --- Run, insert, debug, and debug from the start address
    expect(entries.map((entry) => entry.disabled!(store, CAS))).toEqual([disabled, disabled, disabled, disabled]);
    if (!disabled) {
      await entries[0].clicked!(CAS);
      expect(executeCommand).toHaveBeenCalledWith(`tape-load "${CAS}" -r`);
      await entries[3].clicked!(CAS);
      expect(executeCommand).toHaveBeenCalledWith(`tape-load "${CAS}" -e`);
    }
  });

  it("offers debugging from the start address for a machine-code tape", async () => {
    const galaxy = new Uint8Array(readFileSync(join(__dirname, "../testfiles/ht1080z/galaxy.cas")));
    const { htTapeLaunchCommandBarRenderer, executeCommand } = await loadModule(MI_HT1080Z, true, galaxy);
    render(<>{htTapeLaunchCommandBarRenderer(CAS)}</>);
    const entry = await screen.findByRole("button", { name: /stopping at its start address/ });
    fireEvent.click(entry);
    await waitFor(() => expect(executeCommand).toHaveBeenCalledWith(`tape-load "${CAS}" -e`));
  });

  it("offers no start address for a BASIC tape", async () => {
    const amoeba = new Uint8Array(readFileSync(join(__dirname, "../testfiles/ht1080z/amoeba.cas")));
    const basic = await loadModule(MI_HT1080Z, true, amoeba);
    render(<>{basic.htTapeLaunchCommandBarRenderer(CAS)}</>);
    await screen.findAllByRole("button");
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.getAllByRole("button")).toHaveLength(3);
  });

  it("disables the tab-bar buttons on another machine, and says why", async () => {
    const { htTapeLaunchCommandBarRenderer } = await loadModule(MI_SPECTRUM_48);
    render(<>{htTapeLaunchCommandBarRenderer(CAS)}</>);
    for (const button of screen.getAllByRole("button")) {
      expect(button).toBeDisabled();
      // --- A .cas is the Videoton TVC's tape too
      expect(button.getAttribute("aria-label")).toMatch(/\(requires an HT-1080Z or a Videoton TVC machine\)/);
    }
  });

  it("enables a .cas on the Videoton TVC, without the start-address stop", async () => {
    const { htTapeLaunchCommandBarRenderer } = await loadModule(MI_TVC);
    render(<>{htTapeLaunchCommandBarRenderer(CAS)}</>);
    await screen.findAllByRole("button");
    await new Promise((r) => setTimeout(r, 20));
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(3);
    for (const button of buttons) expect(button).toBeEnabled();
  });
});
