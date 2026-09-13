import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "../react-test-utils";

const executeCommand = vi.hoisted(() => vi.fn().mockResolvedValue({ success: true }));

vi.mock("@renderer/appIde/services/AppServicesProvider", () => ({
  useAppServices: () => ({ ideCommandsService: { executeCommand } })
}));

import { BreakpointIndicator } from "@renderer/appIde/DocumentPanels/BreakpointIndicator";

/*
 * The disassembly view has no row menu, so the indicator's own double-click is the way into the
 * breakpoint editor there. The Breakpoints panel leaves `onEdit` unset because its row already
 * handles the same gesture — hence the tests that nothing happens without it.
 */

/*
 * The glyph is the inner div that carries the gestures: host > wrapper > glyph. The wrapper is the
 * element that stops right-click propagation, so a test that acted on it instead would prove
 * nothing about either behaviour.
 */
const glyph = () =>
  screen.getByTestId("bp-indicator").firstElementChild!.firstElementChild! as HTMLElement;

const renderIndicator = (props: Partial<Parameters<typeof BreakpointIndicator>[0]> = {}) =>
  renderWithProviders(
    <div data-testid="bp-indicator">
      <BreakpointIndicator
        address={0x8000}
        hasBreakpoint={true}
        disabled={false}
        current={false}
        {...props}
      />
    </div>
  );

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("BreakpointIndicator - editing", () => {
  it("opens the editor when double-clicked", () => {
    const onEdit = vi.fn();
    renderIndicator({ onEdit });

    fireEvent.doubleClick(glyph());

    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("does nothing on a double-click where no editor was offered", () => {
    // --- The Breakpoints panel's case: its row owns the gesture, so the indicator must not also
    // --- act on it.
    renderIndicator();

    fireEvent.doubleClick(glyph());

    expect(executeCommand).not.toHaveBeenCalled();
  });

  it("offers no editor for an address that has no breakpoint yet", () => {
    const onEdit = vi.fn();
    renderIndicator({ hasBreakpoint: false, onEdit });

    fireEvent.doubleClick(glyph());

    expect(onEdit).not.toHaveBeenCalled();
  });

  it("does not let a row behind it open a second editor", () => {
    const onEdit = vi.fn();
    const onRowDoubleClick = vi.fn();
    renderWithProviders(
      <div data-testid="bp-indicator" onDoubleClick={onRowDoubleClick}>
        <BreakpointIndicator
          address={0x8000}
          hasBreakpoint={true}
          disabled={false}
          current={false}
          onEdit={onEdit}
        />
      </div>
    );

    fireEvent.doubleClick(glyph());

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onRowDoubleClick).not.toHaveBeenCalled();
  });

  it("still deletes on right-click, and keeps that from reaching a row menu", () => {
    const onRowContextMenu = vi.fn();
    renderWithProviders(
      <div data-testid="bp-indicator" onContextMenu={onRowContextMenu}>
        <BreakpointIndicator
          address={0x8000}
          hasBreakpoint={true}
          disabled={false}
          current={false}
          onEdit={vi.fn()}
        />
      </div>
    );

    fireEvent.contextMenu(glyph());

    expect(executeCommand).toHaveBeenCalledWith(expect.stringContaining("bp-del"));
    expect(onRowContextMenu).not.toHaveBeenCalled();
  });
});
