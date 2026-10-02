import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  MI_SPECTRUM_128,
  MI_SPECTRUM_3E,
  MI_SPECTRUM_48,
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

async function loadModule(machineId?: string, fastLoad = true) {
  const executeCommand = vi.fn(() => Promise.resolve({ success: true }));
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
