import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  app: {
    getPath: (name: string) => (name === "home" ? "/home/me" : `/electron/${name}`),
    setPath: () => {},
    isPackaged: false
  }
}));

import {
  defaultCartridgeFolder,
  defaultDiskFolder,
  defaultFolderForDiskType,
  newCartridgeDialogFolder
} from "@main/disk-folders";
import { setPortableDataRootForTests } from "@main/portable";

/* Where a new disk image goes unless the user names a folder (the Create Disk File dialog, `crd`) */

afterEach(() => setPortableDataRootForTests(undefined));

describe("defaultDiskFolder", () => {
  it("is the open project's disks folder", () => {
    expect(defaultDiskFolder("/home/me/KliveProjects/Game")).toBe(path.join("/home/me/KliveProjects/Game", "disks"));
  });

  it("is Klive/Disks in the user's home folder without a project", () => {
    expect(defaultDiskFolder("")).toBe(path.join("/home/me", "Klive", "Disks"));
  });

  it("follows Klive's home folder in portable mode", () => {
    setPortableDataRootForTests("/usb/Klive-data");
    expect(defaultDiskFolder(undefined)).toBe(path.join("/usb/Klive-data", "Klive", "Disks"));
  });
});

/* Where a new Microdrive cartridge goes (New Blank Cartridge, `crd mdr`): apart from the disks */
describe("defaultCartridgeFolder", () => {
  it("is the open project's cartridges folder", () => {
    expect(defaultCartridgeFolder("/home/me/KliveProjects/Game")).toBe(path.join("/home/me/KliveProjects/Game", "cartridges"));
  });

  it("is Klive/Cartridges in the user's home folder without a project", () => {
    expect(defaultCartridgeFolder("")).toBe(path.join("/home/me", "Klive", "Cartridges"));
  });

  it("is picked for the cartridge types only", () => {
    expect(defaultFolderForDiskType("mdr")).toBe(defaultCartridgeFolder());
    expect(defaultFolderForDiskType("mdrblank")).toBe(defaultCartridgeFolder());
    expect(defaultFolderForDiskType("trd80ds")).toBe(defaultDiskFolder());
  });
});

/* Where Machine › Interfaces › New Blank Cartridge starts */
describe("newCartridgeDialogFolder", () => {
  it("is the open project's cartridges folder, which it makes", () => {
    const project = fs.mkdtempSync(path.join(os.tmpdir(), "klive-cartridges-"));
    try {
      const folder = newCartridgeDialogFolder("/somewhere/else", project);
      expect(folder).toBe(path.join(project, "cartridges"));
      expect(fs.statSync(folder).isDirectory()).toBe(true);
    } finally {
      fs.rmSync(project, { recursive: true, force: true });
    }
  });

  it("is the last cartridge's folder, or home, without a project", () => {
    expect(newCartridgeDialogFolder("/somewhere/else", "")).toBe("/somewhere/else");
    expect(newCartridgeDialogFolder(undefined, "")).toBe("/home/me");
  });
});
