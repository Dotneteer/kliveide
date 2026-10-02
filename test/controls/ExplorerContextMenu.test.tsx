import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { ExplorerContextMenu } from "@renderer/features/explorer/ExplorerContextMenu";

afterEach(cleanup);

/*
 * A file type's own entries (`FileTypeEditor.contextMenuInfo`: Load/Run/Debug for `.z88`, Run/Debug
 * for `.nex`, ...) must close the menu like the built-in ones. `ContextMenuItem` does not close it by
 * itself, and these entries once called their handler directly, so the menu stayed open.
 */
describe("ExplorerContextMenu: file-type entries", () => {
  function renderMenu(clicked: (item: string) => Promise<void>) {
    const onConceal = vi.fn();
    const anchor = document.createElement("div");
    document.body.appendChild(anchor);
    const noop = () => {};
    const noopAsync = async () => {};
    render(
      <ExplorerContextMenu
        appServices={{} as any}
        contextInfo={
          {
            contextMenuInfo: () => [{ text: "Debug Z88 snapshot (stop at PC)", clicked }]
          } as any
        }
        isKliveProject={true}
        isWindows={false}
        onClickOutside={noop}
        onCollapseAll={noop}
        onConceal={onConceal}
        onDelete={noop}
        onExclude={noopAsync}
        onExpandAll={noop}
        onNewFile={noop}
        onNewFolder={noop}
        onRefresh={noopAsync}
        onRename={noop}
        onReveal={noop}
        onToggleBuildRoot={noopAsync}
        selectedContextNode={{ data: { fullPath: "/project/game.z88" } } as any}
        selectedContextNodeIsFolder={false}
        selectedNodeIsBuildRoot={false}
        selectedNodeIsProjectFile={false}
        selectedNodeIsRoot={false}
        state={{ contextVisible: true, contextRef: anchor, contextX: 0, contextY: 0 }}
        store={{ getState: () => ({}) } as any}
      />
    );
    return { onConceal };
  }

  it("closes the menu and runs the entry with the selected file", async () => {
    const clicked = vi.fn(async () => {});
    const { onConceal } = renderMenu(clicked);

    fireEvent.click(await screen.findByText("Debug Z88 snapshot (stop at PC)"));

    await waitFor(() => expect(clicked).toHaveBeenCalledWith("/project/game.z88"));
    expect(onConceal).toHaveBeenCalledTimes(1);
  });

  it("closes the menu before a long-running entry finishes", async () => {
    let finish: () => void = () => {};
    const clicked = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    const { onConceal } = renderMenu(clicked);

    fireEvent.click(await screen.findByText("Debug Z88 snapshot (stop at PC)"));

    expect(onConceal).toHaveBeenCalledTimes(1);
    finish();
  });
});
