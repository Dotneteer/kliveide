import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MI_SPECTRUM_128, MI_SPECTRUM_48, MI_Z88 } from "@common/machines/constants";

/*
 * The ZX Spectrum snapshot launch entries (`.plans/ZX_SPECTRUM_SNAPSHOT_PLAN.md` §4.9, Phase 7): the
 * Explorer's context menu and the viewer's tab-bar buttons. Both only run the `zx-snapshot`
 * command, which `test/commands/SpectrumSnapshotCommand.test.ts` covers.
 */

type State = { machineId?: string; isKliveProject?: boolean };

const PATH = "/project/my game.z80";

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

function appState(state: State) {
  return {
    emulatorState: { machineId: state.machineId },
    project: { isKliveProject: state.isKliveProject }
  };
}

async function loadModule(state: State) {
  const executeCommand = vi.fn(() => Promise.resolve({ success: true }));
  vi.doMock("@renderer/appIde/services/AppServicesProvider", () => ({
    useAppServices: () => ({ ideCommandsService: { executeCommand } })
  }));
  vi.doMock("@renderer/core/RendererProvider", () => ({
    useSelector: (selector: (s: any) => any) => selector(appState(state)),
    useRendererContext: () => ({ store: { getState: () => appState(state) } })
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
  const module = await import("@renderer/features/documents/SpectrumSnapshotLaunchMenu");
  return { ...module, executeCommand };
}

describe("Spectrum snapshot launch - Explorer context menu", () => {
  it.each([
    [0, "Run snapshot", `zx-snapshot "${PATH}" -r`],
    [1, "Debug snapshot (stop at PC)", `zx-snapshot "${PATH}" -d`]
  ])("entry %i, %s, runs %s", async (index, text, command) => {
    const { getSpectrumSnapshotContextMenuInfo, executeCommand } = await loadModule({ machineId: MI_SPECTRUM_48 });
    const entries = getSpectrumSnapshotContextMenuInfo({ ideCommandsService: { executeCommand } } as any);
    expect(entries).toHaveLength(2);
    expect(entries[index].text).toBe(text);
    await entries[index].clicked!(PATH);
    expect(executeCommand).toHaveBeenCalledWith(command);
  });

  it.each([
    [{ machineId: MI_Z88 }, false],
    [{ machineId: MI_SPECTRUM_48, isKliveProject: true }, false],
    [{ machineId: MI_SPECTRUM_128, isKliveProject: true }, false],
    [{ machineId: MI_Z88, isKliveProject: true }, true]
  ])("with %o the entries are disabled: %s", async (state, disabled) => {
    const { getSpectrumSnapshotContextMenuInfo, executeCommand } = await loadModule(state);
    const entries = getSpectrumSnapshotContextMenuInfo({ ideCommandsService: { executeCommand } } as any);
    const store = { getState: () => appState(state) } as any;
    expect(entries.map((entry) => entry.disabled!(store, PATH))).toEqual([disabled, disabled]);
  });
});

describe("Spectrum snapshot launch - tab bar", () => {
  it.each([
    ["Load and run this snapshot", `zx-snapshot "${PATH}" -r`],
    ["Load this snapshot and debug it, stopping at its PC", `zx-snapshot "${PATH}" -d`]
  ])("%s runs %s", async (title, command) => {
    const { spectrumSnapshotLaunchCommandBarRenderer, executeCommand } = await loadModule({ machineId: MI_Z88 });
    render(<>{spectrumSnapshotLaunchCommandBarRenderer(PATH)}</>);
    fireEvent.click(screen.getByRole("button", { name: title }));
    expect(executeCommand).toHaveBeenCalledWith(command);
  });

  it("shows the play and debug icons", async () => {
    const { spectrumSnapshotLaunchCommandBarRenderer } = await loadModule({ machineId: MI_Z88 });
    render(<>{spectrumSnapshotLaunchCommandBarRenderer(PATH)}</>);
    for (const icon of ["play", "debug"]) expect(screen.getByTestId(`icon-${icon}`)).toBeInTheDocument();
  });

  it("disables the buttons for a non-Spectrum project, and says why", async () => {
    const { spectrumSnapshotLaunchCommandBarRenderer, executeCommand } = await loadModule({
      machineId: MI_Z88,
      isKliveProject: true
    });
    render(<>{spectrumSnapshotLaunchCommandBarRenderer(PATH)}</>);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(2);
    for (const button of buttons) {
      expect(button).toBeDisabled();
      expect(button.getAttribute("aria-label")).toMatch(/\(The open project targets Cambridge Z88;/);
    }
    fireEvent.click(buttons[1]);
    expect(executeCommand).not.toHaveBeenCalled();
  });
});
