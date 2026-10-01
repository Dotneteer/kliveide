import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";

const setPath = vi.fn();
const getPath = vi.fn((name: string) => (name === "home" ? "/real-home" : `/electron/${name}`));

vi.mock("electron", () => ({
  app: {
    getPath: (name: string) => getPath(name),
    setPath: (name: string, value: string) => setPath(name, value),
    isPackaged: false
  }
}));

import {
  detectPortableDataRoot,
  getKliveHomeBase,
  isPortableMode,
  PORTABLE_DATA_FOLDER,
  setPortableDataRootForTests
} from "@main/portable";

const exePath = path.join("C:", "Apps", "Klive", "Klive IDE.exe");
const exeFolder = path.dirname(exePath);
const writable = () => true;

afterEach(() => {
  setPortableDataRootForTests(undefined);
});

describe("portable mode detection (#1382)", () => {
  it("treats a packaged Windows build without an uninstaller as portable", () => {
    const root = detectPortableDataRoot({
      platform: "win32",
      isPackaged: true,
      exePath,
      readDir: () => ["Klive IDE.exe", "resources", "ffmpeg.dll"],
      ensureWritable: writable
    });
    expect(root).toBe(path.join(exeFolder, PORTABLE_DATA_FOLDER));
  });

  it("treats the NSIS install (uninstaller beside the executable) as installed", () => {
    const root = detectPortableDataRoot({
      platform: "win32",
      isPackaged: true,
      exePath,
      readDir: () => ["Klive IDE.exe", "Uninstall Klive IDE.exe"],
      ensureWritable: writable
    });
    expect(root).toBeUndefined();
  });

  it.each(["darwin", "linux"] as NodeJS.Platform[])("never applies on %s", (platform) => {
    expect(
      detectPortableDataRoot({
        platform,
        isPackaged: true,
        exePath,
        readDir: () => [],
        ensureWritable: writable
      })
    ).toBeUndefined();
  });

  it("never applies to an unpackaged (development) run", () => {
    expect(
      detectPortableDataRoot({
        platform: "win32",
        isPackaged: false,
        exePath,
        readDir: () => [],
        ensureWritable: writable
      })
    ).toBeUndefined();
  });

  it("falls back to the user profile when the data folder cannot be written", () => {
    expect(
      detectPortableDataRoot({
        platform: "win32",
        isPackaged: true,
        exePath,
        readDir: () => ["Klive IDE.exe"],
        ensureWritable: () => false
      })
    ).toBeUndefined();
  });

  it("creates the data folder beside the executable by default", () => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), "klive-portable-"));
    try {
      const root = detectPortableDataRoot({
        platform: "win32",
        isPackaged: true,
        exePath: path.join(folder, "Klive IDE.exe")
      });
      expect(root).toBe(path.join(folder, PORTABLE_DATA_FOLDER));
      expect(fs.statSync(root!).isDirectory()).toBe(true);
    } finally {
      fs.rmSync(folder, { recursive: true, force: true });
    }
  });
});

describe("Klive home base", () => {
  it("is the user's home folder outside portable mode", () => {
    expect(isPortableMode()).toBe(false);
    expect(getKliveHomeBase()).toBe("/real-home");
  });

  it("is the portable data folder in portable mode", () => {
    setPortableDataRootForTests("/usb/Klive/KliveData");
    expect(isPortableMode()).toBe(true);
    expect(getKliveHomeBase()).toBe("/usb/Klive/KliveData");
  });
});
