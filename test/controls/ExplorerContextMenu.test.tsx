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
        onMakeProject={noop}
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

// --- `dev/plans/PLAIN_FOLDER_TO_PROJECT_PLAN.md` §3.5 and decision Q6
describe("ExplorerContextMenu: plain folders", () => {
  function renderMenu(options: {
    isKliveProject: boolean;
    root?: boolean;
    node?: object;
    onMakeProject?: () => void;
  }) {
    const anchor = document.createElement("div");
    document.body.appendChild(anchor);
    const noop = () => {};
    const noopAsync = async () => {};
    render(
      <ExplorerContextMenu
        appServices={{} as any}
        isKliveProject={options.isKliveProject}
        isWindows={false}
        onClickOutside={noop}
        onCollapseAll={noop}
        onConceal={noop}
        onDelete={noop}
        onExclude={noopAsync}
        onExpandAll={noop}
        onMakeProject={options.onMakeProject ?? noop}
        onNewFile={noop}
        onNewFolder={noop}
        onRefresh={noopAsync}
        onRename={noop}
        onReveal={noop}
        onToggleBuildRoot={noopAsync}
        selectedContextNode={{ data: options.node ?? { fullPath: "/work/game", isFolder: true } } as any}
        selectedContextNodeIsFolder={!!options.root}
        selectedNodeIsBuildRoot={false}
        selectedNodeIsProjectFile={false}
        selectedNodeIsRoot={!!options.root}
        state={{ contextVisible: true, contextRef: anchor, contextX: 0, contextY: 0 }}
        store={{ getState: () => ({}) } as any}
      />
    );
  }

  it("offers Make Klive Project... on a plain folder's root", async () => {
    const onMakeProject = vi.fn();
    renderMenu({ isKliveProject: false, root: true, onMakeProject });

    fireEvent.click(await screen.findByText("Make Klive Project..."));

    expect(onMakeProject).toHaveBeenCalledTimes(1);
  });

  it("does not offer it in a Klive project", async () => {
    renderMenu({ isKliveProject: true, root: true });
    await screen.findByText("Refresh");
    expect(screen.queryByText("Make Klive Project...")).toBeNull();
  });

  it("says why Promote to Build Root is disabled in a plain folder", async () => {
    renderMenu({
      isKliveProject: false,
      node: { fullPath: "/work/game/main.bas", isFolder: false, canBeBuildRoot: true }
    });

    const item = (await screen.findByText("Promote to Build Root")).closest("button");
    expect(item).toBeDisabled();
    expect(item?.getAttribute("title")).toContain("Make Klive Project...");
  });

  it("has no such tooltip in a Klive project", async () => {
    renderMenu({
      isKliveProject: true,
      node: { fullPath: "/work/game/main.bas", isFolder: false, canBeBuildRoot: true }
    });

    const item = (await screen.findByText("Promote to Build Root")).closest("button");
    expect(item).not.toBeDisabled();
    expect(item?.hasAttribute("title")).toBe(false);
  });
});
