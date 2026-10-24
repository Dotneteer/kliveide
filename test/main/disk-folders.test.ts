import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  app: {
    getPath: (name: string) => (name === "home" ? "/home/me" : `/electron/${name}`),
    setPath: () => {},
    isPackaged: false
  }
}));

import { defaultDiskFolder } from "@main/disk-folders";
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
