import { describe, expect, it } from "vitest";

import { HOME, NEXT_SD, PROJECT, ROOT, openFileManager } from "./fakes";

/*
 * The machine's own storage in the File Manager (.plans/FILE_MANAGER_PLAN.md, Phase 5, D4): a drive
 * only while the machine is stopped; a pane on it blocks while the machine runs and comes back after.
 */

const withCard = { listDrives: [ROOT, HOME, PROJECT, NEXT_SD] };

describe("machine storage", () => {
  it("is a group of its own in the drive menu, named by its place in the machine", async () => {
    const h = await openFileManager(withCard);
    await h.dispatch({ type: "driveMenuToggled", side: 1 });
    const group = h.vm.menu!.groups.find((g) => g.title === "Machine storage")!;
    expect(group.items).toEqual([
      { id: NEXT_SD.id, label: "SD card", detail: "next.img · FAT32", free: "2 GB", icon: "machine", selected: false, disabled: false }
    ]);
  });

  it("while the machine runs, its drives are listed but cannot be chosen", async () => {
    const running = { ...NEXT_SD, available: false, fileSystem: "" };
    const h = await openFileManager({ listDrives: [ROOT, HOME, PROJECT, running] });
    h.ports.fm.listDrives.mockResolvedValue([ROOT, HOME, PROJECT, running]);
    await h.dispatch({ type: "machineStateChanged", stopped: false });
    await h.dispatch({ type: "driveMenuToggled", side: 1 });
    const group = h.vm.menu!.groups.find((g) => g.title.startsWith("Machine storage"))!;
    expect(group.title).toBe("Machine storage (the machine is running)");
    expect(group.items[0]).toMatchObject({ disabled: true, detail: "next.img · stop the machine to use it" });
    await h.dispatch({ type: "driveChosen", side: 1, driveId: NEXT_SD.id });
    expect(h.state.panes[1].drive?.id).toBe(HOME.id);
  });

  it("a pane on it blocks while the machine runs, takes no command, and comes back where it was", async () => {
    const h = await openFileManager(withCard);
    await h.dispatch({ type: "driveChosen", side: 1, driveId: NEXT_SD.id });
    await h.dispatch({ type: "rowActivated", side: 1, index: 0 });
    expect(h.state.panes[1].dir).toBe("GAMES");

    await h.dispatch({ type: "machineStateChanged", stopped: false });
    expect(h.vm.panes[1].blocked).toEqual({
      title: "The machine is running",
      text: "Stop the machine to use its storage. The pane comes back to this folder when it stops.",
      stopLabel: "Stop the machine"
    });
    expect(h.vm.panes[0].blocked).toBeUndefined();
    const listsBefore = h.ports.fm.list.mock.calls.length;
    await h.dispatch({ type: "deleteRequested" });
    await h.dispatch({ type: "refreshRequested", side: 1 });
    expect(h.ports.dialogs.confirmDelete).not.toHaveBeenCalled();
    expect(h.ports.fm.list.mock.calls.length).toBe(listsBefore);

    await h.dispatch({ type: "stopMachineRequested" });
    expect(h.ports.machine.stop).toHaveBeenCalled();
    await h.dispatch({ type: "machineStateChanged", stopped: true });
    expect(h.vm.panes[1].blocked).toBeUndefined();
    expect(h.ports.fm.list).toHaveBeenLastCalledWith(NEXT_SD.id, "GAMES");
    expect(h.vm.panes[1].rows.map((r) => r.cells[0])).toEqual(["..", "WARHAWK.NEX"]);
  });

  it("the same state twice changes nothing", async () => {
    const h = await openFileManager(withCard);
    const calls = h.ports.fm.listDrives.mock.calls.length;
    await h.dispatch({ type: "machineStateChanged", stopped: true });
    expect(h.ports.fm.listDrives.mock.calls.length).toBe(calls);
  });

  it("says when the machine started under a copy", async () => {
    const h = await openFileManager({ ...withCard, result: { written: 0, skipped: 0, failed: [], cancelled: false, aborted: "machineRunning" } });
    await h.dispatch({ type: "cursorMoved", side: 0, to: 1 });
    await h.dispatch({ type: "transferRequested", move: false });
    expect(h.vm.notice?.text).toBe("The machine is running: stop it to use its storage. Nothing was written.");
  });
});
