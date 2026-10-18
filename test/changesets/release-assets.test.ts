import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { compareAssets, downloadsFrom, expectedAssets } from "../../scripts/release-assets.cjs";

describe("release assets", () => {
  it("names the six kits of a version", () => {
    expect(expectedAssets("0.64.0")).toEqual([
      "KliveIdeSetup-0.64.0-arm64.pkg",
      "KliveIdeSetup-0.64.0-x64.pkg",
      "KliveIdeSetup-0.64.0-x64.exe",
      "KliveIde-Portable-0.64.0-x64.zip",
      "KliveIdeSetup-0.64.0-x86_64.AppImage",
      "KliveIdeSetup-0.64.0-arm64.AppImage"
    ]);
  });

  it("follows electron-builder's artifactName settings", () => {
    const build = JSON.parse(readFileSync(join(__dirname, "../../package.json"), "utf8")).build;
    expect(build.artifactName).toBe("KliveIdeSetup-${version}-${arch}.${ext}");
    expect(build.win.artifactName).toBe("KliveIde-Portable-${version}-${arch}.${ext}");
    expect(build.nsis.artifactName).toBe("KliveIdeSetup-${version}-${arch}.${ext}");
  });

  it("maps each kit to its platform without mixing up the architectures", () => {
    const d = downloadsFrom(expectedAssets("1.2.3"), "v1.2.3");
    expect(d.macArm64).toMatch(/arm64\.pkg$/);
    expect(d.macX64).toMatch(/-x64\.pkg$/);
    expect(d.linuxX64).toMatch(/x86_64\.AppImage$/);
    expect(d.linuxArm64).toMatch(/arm64\.AppImage$/);
    expect(d.windowsPortable).toMatch(/Portable-1\.2\.3-x64\.zip$/);
    expect(d.windowsX64).toBe("https://github.com/Dotneteer/kliveide/releases/download/v1.2.3/KliveIdeSetup-1.2.3-x64.exe");
  });

  it("reports missing and unexpected files", () => {
    const names = [...expectedAssets("1.0.0").slice(1), "stray.txt"];
    expect(compareAssets(names, "1.0.0")).toEqual({ missing: ["KliveIdeSetup-1.0.0-arm64.pkg"], unexpected: ["stray.txt"] });
    expect(compareAssets([...expectedAssets("1.0.0"), "SHA256SUMS.txt"], "1.0.0", { withChecksums: true })).toEqual({ missing: [], unexpected: [] });
  });
});
