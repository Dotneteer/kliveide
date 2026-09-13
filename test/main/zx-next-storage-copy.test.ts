import { describe, expect, it, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

import { CimFile, CimFileManager } from "@main/fat32/CimFileManager";
import { Fat32Volume } from "@main/fat32/Fat32Volume";
import {
  areSameHostFilePath,
  copyZxNextStorageFile,
  isAbsoluteHostPath,
  resolveZxNextHostPath
} from "@main/zx-next-storage-copy";
import { ZX_NEXT_STORAGE_TARGET_EXISTS_PREFIX } from "@common/utils/zx-next-storage-paths";

describe("ZX Spectrum Next storage copy", () => {
  it("resolves relative host paths against the project folder with native paths", () => {
    const projectFolder = path.join(os.tmpdir(), "klive-project");

    expect(resolveZxNextHostPath("build/game.nex", projectFolder)).toBe(
      path.resolve(projectFolder, "build/game.nex")
    );
    expect(resolveZxNextHostPath("/tmp/game.nex", projectFolder)).toBe("/tmp/game.nex");
  });

  it("recognizes Windows absolute host paths without rewriting them on non-Windows hosts", () => {
    expect(isAbsoluteHostPath("C:\\Users\\me\\game.nex")).toBe(true);
    expect(isAbsoluteHostPath("\\\\server\\share\\game.nex")).toBe(true);
    expect(resolveZxNextHostPath("C:\\Users\\me\\game.nex", "/project")).toBe(
      "C:\\Users\\me\\game.nex"
    );
  });

  it("copies host files to explicit CIM storage and copies them back out", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "klive-next-copy-"));
    const cimPath = path.join(dir, "card.cim");
    const hostSource = path.join(dir, "source.bin");
    const hostTarget = path.join(dir, "out", "source.bin");
    const sourceData = Buffer.from([0x00, 0x21, 0x43, 0x65, 0x87, 0xa9, 0xcb, 0xed]);

    fs.writeFileSync(hostSource, sourceData);
    createFormattedCim(cimPath);

    const toResult = await copyZxNextStorageFile({
      direction: "to",
      storage: { kind: "cim", cimFile: cimPath },
      hostPath: hostSource,
      storagePath: "\\tmp\\source.bin"
    });

    expect(toResult).toMatchObject({
      hostPath: hostSource,
      storagePath: "tmp/source.bin",
      cimFile: cimPath,
      bytesCopied: sourceData.length
    });

    const fromResult = await copyZxNextStorageFile({
      direction: "from",
      storage: { kind: "cim", cimFile: cimPath },
      hostPath: hostTarget,
      storagePath: "/tmp/source.bin"
    });

    expect(fromResult.bytesCopied).toBe(sourceData.length);
    expect(fs.readFileSync(hostTarget)).toEqual(sourceData);
  });

  it("uses the source filename when copying to an existing storage folder", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "klive-next-copy-folder-to-"));
    const cimPath = path.join(dir, "card.cim");
    const hostSource = path.join(dir, "source.bin");
    const hostTarget = path.join(dir, "out.bin");
    const sourceData = Buffer.from("folder target");

    fs.writeFileSync(hostSource, sourceData);
    createFormattedCim(cimPath);
    withVolume(cimPath, (volume) => volume.mkdir("games"));

    const toResult = await copyZxNextStorageFile({
      direction: "to",
      storage: { kind: "cim", cimFile: cimPath },
      hostPath: hostSource,
      storagePath: "/games"
    });

    expect(toResult.storagePath).toBe("games/source.bin");

    await copyZxNextStorageFile({
      direction: "from",
      storage: { kind: "cim", cimFile: cimPath },
      hostPath: hostTarget,
      storagePath: "games/source.bin"
    });
    expect(fs.readFileSync(hostTarget)).toEqual(sourceData);
  });

  it("uses the source filename for storage folder hints and creates folders recursively", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "klive-next-copy-folder-hint-to-"));
    const cimPath = path.join(dir, "card.cim");
    const hostSource = path.join(dir, "source.bin");
    const hostTarget = path.join(dir, "out.bin");
    const sourceData = Buffer.from("recursive storage target");

    fs.writeFileSync(hostSource, sourceData);
    createFormattedCim(cimPath);

    const toResult = await copyZxNextStorageFile({
      direction: "to",
      storage: { kind: "cim", cimFile: cimPath },
      hostPath: hostSource,
      storagePath: "/new/deep/"
    });

    expect(toResult.storagePath).toBe("new/deep/source.bin");

    await copyZxNextStorageFile({
      direction: "from",
      storage: { kind: "cim", cimFile: cimPath },
      hostPath: hostTarget,
      storagePath: "new/deep/source.bin"
    });
    expect(fs.readFileSync(hostTarget)).toEqual(sourceData);
  });

  it("uses the source filename when copying from storage to a host folder", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "klive-next-copy-folder-from-"));
    const cimPath = path.join(dir, "card.cim");
    const hostSource = path.join(dir, "boot.txt");
    const hostFolder = path.join(dir, "out");
    const sourceData = Buffer.from("host folder target");

    fs.mkdirSync(hostFolder);
    fs.writeFileSync(hostSource, sourceData);
    createFormattedCim(cimPath);
    await copyZxNextStorageFile({
      direction: "to",
      storage: { kind: "cim", cimFile: cimPath },
      hostPath: hostSource,
      storagePath: "/logs/boot.txt"
    });

    const fromResult = await copyZxNextStorageFile({
      direction: "from",
      storage: { kind: "cim", cimFile: cimPath },
      hostPath: hostFolder,
      storagePath: "/logs/boot.txt"
    });

    const expectedHostPath = path.join(hostFolder, "boot.txt");
    expect(fromResult.hostPath).toBe(expectedHostPath);
    expect(fs.readFileSync(expectedHostPath)).toEqual(sourceData);
  });

  it("uses host folder hints and creates host folders recursively", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "klive-next-copy-folder-hint-from-"));
    const cimPath = path.join(dir, "card.cim");
    const hostSource = path.join(dir, "boot.txt");
    const hostFolder = path.join(dir, "new", "deep");
    const sourceData = Buffer.from("recursive host target");

    fs.writeFileSync(hostSource, sourceData);
    createFormattedCim(cimPath);
    await copyZxNextStorageFile({
      direction: "to",
      storage: { kind: "cim", cimFile: cimPath },
      hostPath: hostSource,
      storagePath: "/logs/boot.txt"
    });

    const fromResult = await copyZxNextStorageFile({
      direction: "from",
      storage: { kind: "cim", cimFile: cimPath },
      hostPath: `${hostFolder}${path.sep}`,
      storagePath: "/logs/boot.txt"
    });

    const expectedHostPath = path.join(hostFolder, "boot.txt");
    expect(fromResult.hostPath).toBe(expectedHostPath);
    expect(fs.readFileSync(expectedHostPath)).toEqual(sourceData);
  });

  it("requires overwrite for existing storage target files", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "klive-next-copy-overwrite-to-"));
    const cimPath = path.join(dir, "card.cim");
    const hostSource = path.join(dir, "source.bin");
    const hostTarget = path.join(dir, "out.bin");

    fs.writeFileSync(hostSource, Buffer.from("first"));
    createFormattedCim(cimPath);
    await copyZxNextStorageFile({
      direction: "to",
      storage: { kind: "cim", cimFile: cimPath },
      hostPath: hostSource,
      storagePath: "/tmp/source.bin"
    });

    fs.writeFileSync(hostSource, Buffer.from("second"));
    await expect(
      copyZxNextStorageFile({
        direction: "to",
        storage: { kind: "cim", cimFile: cimPath },
        hostPath: hostSource,
        storagePath: "/tmp/source.bin"
      })
    ).rejects.toThrow(ZX_NEXT_STORAGE_TARGET_EXISTS_PREFIX);

    await copyZxNextStorageFile({
      direction: "to",
      storage: { kind: "cim", cimFile: cimPath },
      hostPath: hostSource,
      storagePath: "/tmp/source.bin",
      overwrite: true
    });
    await copyZxNextStorageFile({
      direction: "from",
      storage: { kind: "cim", cimFile: cimPath },
      hostPath: hostTarget,
      storagePath: "/tmp/source.bin"
    });

    expect(fs.readFileSync(hostTarget)).toEqual(Buffer.from("second"));
  });

  it("requires overwrite for existing host target files", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "klive-next-copy-overwrite-from-"));
    const cimPath = path.join(dir, "card.cim");
    const hostSource = path.join(dir, "boot.txt");
    const hostTarget = path.join(dir, "out.txt");

    fs.writeFileSync(hostSource, Buffer.from("from storage"));
    fs.writeFileSync(hostTarget, Buffer.from("old host"));
    createFormattedCim(cimPath);
    await copyZxNextStorageFile({
      direction: "to",
      storage: { kind: "cim", cimFile: cimPath },
      hostPath: hostSource,
      storagePath: "/logs/boot.txt"
    });

    await expect(
      copyZxNextStorageFile({
        direction: "from",
        storage: { kind: "cim", cimFile: cimPath },
        hostPath: hostTarget,
        storagePath: "/logs/boot.txt"
      })
    ).rejects.toThrow(ZX_NEXT_STORAGE_TARGET_EXISTS_PREFIX);

    await copyZxNextStorageFile({
      direction: "from",
      storage: { kind: "cim", cimFile: cimPath },
      hostPath: hostTarget,
      storagePath: "/logs/boot.txt",
      overwrite: true
    });

    expect(fs.readFileSync(hostTarget)).toEqual(Buffer.from("from storage"));
  });

  it("invalidates current storage writes and explicit writes to the same current image", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "klive-next-copy-current-"));
    const cimPath = path.join(dir, "card.cim");
    const hostSource = path.join(dir, "source.bin");
    const invalidateCurrentStorage = vi.fn();

    fs.writeFileSync(hostSource, Buffer.from("current"));
    createFormattedCim(cimPath);

    await copyZxNextStorageFile(
      {
        direction: "to",
        storage: { kind: "current" },
        hostPath: hostSource,
        storagePath: "/tmp/current.bin"
      },
      { currentStoragePath: cimPath, invalidateCurrentStorage }
    );

    await copyZxNextStorageFile(
      {
        direction: "to",
        storage: { kind: "cim", cimFile: cimPath },
        hostPath: hostSource,
        storagePath: "/tmp/explicit-current.bin"
      },
      { currentStoragePath: cimPath, invalidateCurrentStorage }
    );

    expect(invalidateCurrentStorage).toHaveBeenCalledTimes(2);
    expect(areSameHostFilePath(cimPath, path.join(dir, ".", "card.cim"))).toBe(true);
  });

  it("rejects non-CIM explicit images", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "klive-next-copy-invalid-"));
    const imgPath = path.join(dir, "card.img");
    const hostSource = path.join(dir, "source.bin");

    fs.writeFileSync(imgPath, Buffer.from("not a cim"));
    fs.writeFileSync(hostSource, Buffer.from("data"));

    await expect(
      copyZxNextStorageFile({
        direction: "to",
        storage: { kind: "cim", cimFile: imgPath },
        hostPath: hostSource,
        storagePath: "/tmp/source.bin"
      })
    ).rejects.toThrow(".cim");
  });
});

function createFormattedCim(cimPath: string): void {
  const manager = new CimFileManager();
  const cimFile = manager.createFile(cimPath, 2048);
  const volume = new Fat32Volume(cimFile);
  volume.format("KSTEST");
  volume.init();
  cimFile.close();
}

function withVolume(cimPath: string, action: (volume: Fat32Volume) => void): void {
  const cimFile = new CimFile(cimPath);
  try {
    const volume = new Fat32Volume(cimFile);
    volume.init();
    action(volume);
  } finally {
    cimFile.close();
  }
}
