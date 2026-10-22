import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { findPublicFolder } from "../../src/cli/headless";

/*
 * Where the command line finds its ROMs. Windows sets `PUBLIC` for every process
 * (`C:\Users\Public`); the packaged `klive` took that folder and failed with
 * "ENOENT ... C:\Users\Public\roms\sp48.rom" (the release workflow's Windows smoke test).
 */

let root: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "klive-public-"));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

/** A packaged app's layout: <resources>/app/out/main (the bundle), <resources>/roms and wasm */
function packagedLayout(): { resources: string; baseDir: string } {
  const resources = path.join(root, "resources");
  const baseDir = path.join(resources, "app", "out", "main");
  for (const dir of [baseDir, path.join(resources, "roms"), path.join(resources, "wasm")]) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return { resources, baseDir };
}

describe("findPublicFolder", () => {
  it("ignores a PUBLIC folder without ROMs, as Windows sets for every process", () => {
    const { resources, baseDir } = packagedLayout();
    const windowsPublic = path.join(root, "Users", "Public");
    fs.mkdirSync(windowsPublic, { recursive: true });
    expect(findPublicFolder(baseDir, { PUBLIC: windowsPublic })).toBe(resources);
  });

  it("uses PUBLIC when it holds the ROMs (the IDE sets it for what it starts)", () => {
    const { baseDir } = packagedLayout();
    const ide = path.join(root, "ide-public");
    fs.mkdirSync(path.join(ide, "roms"), { recursive: true });
    expect(findPublicFolder(baseDir, { PUBLIC: ide })).toBe(ide);
  });

  it("finds a packaged app's resources folder without PUBLIC", () => {
    const { resources, baseDir } = packagedLayout();
    expect(findPublicFolder(baseDir, {})).toBe(resources);
  });
});
