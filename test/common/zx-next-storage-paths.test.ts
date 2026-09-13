import { describe, expect, it } from "vitest";

import {
  getZxNextStorageOverwriteTarget,
  isCimFilePath,
  normalizeZxNextStoragePath,
  normalizeZxNextStorageTargetPath,
  ZX_NEXT_STORAGE_TARGET_EXISTS_PREFIX
} from "@common/utils/zx-next-storage-paths";

describe("ZX Spectrum Next storage path helpers", () => {
  it("normalizes image paths to slash-separated relative FAT paths", () => {
    expect(normalizeZxNextStoragePath("/games/demo.nex")).toBe("games/demo.nex");
    expect(normalizeZxNextStoragePath("\\games\\demo.nex")).toBe("games/demo.nex");
    expect(normalizeZxNextStoragePath("games\\levels\\one.bin")).toBe(
      "games/levels/one.bin"
    );
  });

  it("rejects empty, directory, and traversal storage paths", () => {
    expect(() => normalizeZxNextStoragePath("")).toThrow("empty");
    expect(() => normalizeZxNextStoragePath("/")).toThrow("file name");
    expect(() => normalizeZxNextStoragePath("/games/")).toThrow("file name");
    expect(() => normalizeZxNextStoragePath("/games//demo.nex")).toThrow("cannot contain");
    expect(() => normalizeZxNextStoragePath("../demo.nex")).toThrow("cannot contain");
    expect(() => normalizeZxNextStoragePath("./demo.nex")).toThrow("cannot contain");
  });

  it("normalizes target paths while preserving directory hints", () => {
    expect(normalizeZxNextStorageTargetPath("/games/demo.nex")).toEqual({
      path: "games/demo.nex",
      directoryHint: false
    });
    expect(normalizeZxNextStorageTargetPath("\\games\\")).toEqual({
      path: "games",
      directoryHint: true
    });
    expect(normalizeZxNextStorageTargetPath("/")).toEqual({
      path: "",
      directoryHint: true
    });
  });

  it("checks .cim extension case-insensitively", () => {
    expect(isCimFilePath("/cards/ks2.cim")).toBe(true);
    expect(isCimFilePath("C:\\Cards\\KS2.CIM")).toBe(true);
    expect(isCimFilePath("/cards/ks2.img")).toBe(false);
  });

  it("extracts overwrite targets from storage-copy error messages", () => {
    expect(
      getZxNextStorageOverwriteTarget(`${ZX_NEXT_STORAGE_TARGET_EXISTS_PREFIX}games/demo.nex`)
    ).toBe("games/demo.nex");
    expect(getZxNextStorageOverwriteTarget("disk full")).toBeUndefined();
  });
});
