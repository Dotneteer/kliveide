import { beforeEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

/*
 * Editing a disk image from the IDE (.plans/DISK_IMAGES_AND_FILE_SYSTEMS_PLAN.md, D4/D5): a running
 * machine with the disk in a drive is paused and resumed around the edit, the file is replaced
 * safely, the first edit keeps a `.bak`, and a mounted disk goes back into its drive.
 */

const state: { media: Record<string, unknown>; emulatorState: Record<string, unknown> } = { media: {}, emulatorState: {} };
const emu = { issueMachineCommand: vi.fn(async () => {}), setDiskFile: vi.fn(async () => {}) };

vi.mock("@main/main-store", () => ({ mainStore: { getState: () => state } }));
vi.mock("@messaging/MainToEmuMessenger", () => ({ getEmuApi: () => emu }));

import { MachineControllerState } from "@abstractions/MachineControllerState";
import {
  beginDiskImageEdit,
  cancelDiskImageEdit,
  commitDiskImageEdit,
  resetDiskImageBackups
} from "@main/disk-image-edit";

let folder: string;
let disk: string;

beforeEach(() => {
  folder = fs.mkdtempSync(path.join(os.tmpdir(), "klive-disk-edit-"));
  disk = path.join(folder, "game.dsk");
  fs.writeFileSync(disk, new Uint8Array([1, 2, 3]));
  state.media = {};
  state.emulatorState = {};
  emu.issueMachineCommand.mockClear();
  emu.setDiskFile.mockClear();
  resetDiskImageBackups();
});

describe("disk image edits", () => {
  it("edits a disk no drive holds without touching the machine", async () => {
    const start = await beginDiskImageEdit(disk);
    expect(start).toMatchObject({ contents: new Uint8Array([1, 2, 3]), drive: undefined, resume: false });
    await commitDiskImageEdit(disk, new Uint8Array([4, 5]), start);
    expect(new Uint8Array(fs.readFileSync(disk))).toEqual(new Uint8Array([4, 5]));
    expect(new Uint8Array(fs.readFileSync(`${disk}.bak`))).toEqual(new Uint8Array([1, 2, 3]));
    expect(emu.issueMachineCommand).not.toHaveBeenCalled();
    expect(emu.setDiskFile).not.toHaveBeenCalled();
  });

  it("pauses a running machine with the disk in drive B, re-inserts it and runs on", async () => {
    state.media = { diskB: { diskFile: disk } };
    state.emulatorState = { machineState: MachineControllerState.Running, isDebugging: true };
    const start = await beginDiskImageEdit(disk);
    expect(start).toMatchObject({ drive: 1, resume: true, debug: true });
    expect(emu.issueMachineCommand).toHaveBeenCalledWith("pause");
    await commitDiskImageEdit(disk, new Uint8Array([9]), start);
    expect(emu.setDiskFile).toHaveBeenCalledWith(1, disk, new Uint8Array([9]));
    expect(emu.issueMachineCommand).toHaveBeenLastCalledWith("debug");
  });

  it("leaves a paused machine paused, and resumes after an abandoned edit", async () => {
    state.media = { diskA: { diskFile: disk } };
    state.emulatorState = { machineState: MachineControllerState.Paused };
    const paused = await beginDiskImageEdit(disk);
    expect(paused).toMatchObject({ drive: 0, resume: false });
    await commitDiskImageEdit(disk, new Uint8Array([7]), paused);
    expect(emu.issueMachineCommand).not.toHaveBeenCalled();

    state.emulatorState = { machineState: MachineControllerState.Running };
    const running = await beginDiskImageEdit(disk);
    await cancelDiskImageEdit(running);
    expect(emu.issueMachineCommand.mock.calls.map((c) => c[0])).toEqual(["pause", "start"]);
    expect(new Uint8Array(fs.readFileSync(disk))).toEqual(new Uint8Array([7]));
  });

  it("keeps one backup per session: the disk as it was before the first edit", async () => {
    await commitDiskImageEdit(disk, new Uint8Array([4]));
    await commitDiskImageEdit(disk, new Uint8Array([5]));
    expect(new Uint8Array(fs.readFileSync(`${disk}.bak`))).toEqual(new Uint8Array([1, 2, 3]));
    expect(fs.readdirSync(folder).sort()).toEqual(["game.dsk", "game.dsk.bak"]);
  });
});
