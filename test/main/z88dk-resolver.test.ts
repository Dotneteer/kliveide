import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  resolveZ88dkInstall,
  rootOf,
  z88dkCandidateRoots,
  z88dkRunEnvironment
} from "@main/z88dk-integration/z88dk-resolver";
import {
  buildOfVersion,
  compareTags,
  isSupportedBuild,
  isSupportedTag,
  parseZccBanner
} from "@main/z88dk-integration/z88dk-version";

let tempRoot: string;
beforeEach(() => (tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "klive-z88dk-res-"))));
afterEach(() => fs.rmSync(tempRoot, { recursive: true, force: true }));

function install(folder: string): string {
  fs.mkdirSync(path.join(folder, "bin"), { recursive: true });
  fs.mkdirSync(path.join(folder, "lib", "config"), { recursive: true });
  fs.writeFileSync(path.join(folder, "bin", process.platform === "win32" ? "zcc.exe" : "zcc"), "");
  return folder.replaceAll("\\", "/");
}

const settings = (values: Record<string, unknown>) => ({ readSetting: (key: string) => values[key] });

describe("parseZccBanner", () => {
  it("reads the v2.4 and v2.3 banners", () => {
    expect(parseZccBanner("zcc - Frontend for the z88dk Cross-C Compiler - v23854-4d530b6eb7-20251002")).toEqual({
      text: "23854-4d530b6eb7-20251002",
      build: 23854,
      date: "20251002"
    });
    expect(parseZccBanner("zcc - v22110-51889e5300-20231220")?.build).toBe(22110);
    expect(parseZccBanner("Usage: zcc +[target]")).toBeUndefined();
  });

  it("reads a stored version back and judges the supported range (C3)", () => {
    expect(buildOfVersion("v23854-4d530b6eb7-20251002")).toBe(23854);
    expect(isSupportedBuild(23854)).toBe(true);
    expect(isSupportedBuild(22110)).toBe(false);
    expect(isSupportedBuild(undefined)).toBe(false);
  });
});

describe("release tags", () => {
  it("orders tags as versions, letter suffixes included", () => {
    expect(["v2.0", "v1.99c", "v2.4", "v2.10", "v1.99B"].sort(compareTags)).toEqual([
      "v1.99B",
      "v1.99c",
      "v2.0",
      "v2.4",
      "v2.10"
    ]);
  });

  it("supports v2.4 and newer", () => {
    expect(isSupportedTag("v2.4")).toBe(true);
    expect(isSupportedTag("v2.5")).toBe(true);
    expect(isSupportedTag("v2.3")).toBe(false);
    expect(isSupportedTag("nightly")).toBe(false);
  });
});

describe("z88dkRunEnvironment", () => {
  it("sets ZCCCFG and puts the install's bin first on PATH", () => {
    const env = z88dkRunEnvironment("/opt/z88dk", { PATH: "/usr/bin" }, false);
    expect(env.ZCCCFG).toBe(path.join("/opt/z88dk", "lib", "config"));
    expect(env.PATH).toBe(`${path.join("/opt/z88dk", "bin")}:/usr/bin`);
  });

  it("keeps Windows' own spelling of Path", () => {
    const env = z88dkRunEnvironment("C:/z88dk", { Path: "C:\\Windows" }, true);
    expect(env.Path).toBe(`${path.join("C:/z88dk", "bin")};C:\\Windows`);
    expect(env.PATH).toBeUndefined();
  });
});

describe("resolveZ88dkInstall", () => {
  it("prefers the configured root, even when it no longer exists", () => {
    const resolved = resolveZ88dkInstall(settings({ "z88dk.root": "/gone/z88dk" }), { env: {}, isWindows: false });
    expect(resolved).toEqual({ root: "/gone/z88dk", zcc: "/gone/z88dk/bin/zcc", source: "settings" });
  });

  it("accepts zcc itself as the configured path", () => {
    expect(rootOf("/opt/z88dk/bin/zcc", false)).toBe("/opt/z88dk");
    expect(rootOf("C:\\z88dk\\bin\\zcc.exe", true)).toBe("C:/z88dk");
  });

  it("falls back to the Z88DK variable, then detection", () => {
    const fromEnv = install(path.join(tempRoot, "env"));
    expect(resolveZ88dkInstall(settings({}), { env: { Z88DK: fromEnv }, home: tempRoot })?.source).toBe("environment");
    const home = install(path.join(tempRoot, "z88dk"));
    expect(resolveZ88dkInstall(settings({}), { env: {}, home: tempRoot })).toMatchObject({ root: home, source: "detected" });
    expect(resolveZ88dkInstall(settings({}), { env: {}, home: tempRoot, detect: false })).toBeUndefined();
  });
});

describe("z88dkCandidateRoots", () => {
  it("derives the root from ZCCCFG and lists the well-known folders once", () => {
    const roots = z88dkCandidateRoots({ ZCCCFG: "/x/z88dk/lib/config/", Z88DK: "/x/z88dk" }, { home: "/home/u", isWindows: false });
    expect(roots[0]).toBe("/x/z88dk");
    expect(roots.filter((r) => r === "/x/z88dk")).toHaveLength(1);
    expect(roots).toContain("/home/u/z88dk");
    expect(roots).toContain("/opt/z88dk");
  });
});
