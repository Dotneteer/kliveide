import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({ app: { isPackaged: false }, dialog: {} }));

import { cliLauncherPath, installAppleScript, linkPointsTo, shellQuote } from "@main/cli-install";

/*
 * Klive › Install Command Line Tool… (`.plans/UNIT_TESTS_CLI_PLAN.md` D12): the pieces that do not
 * need the administrator prompt.
 */
describe("Install Command Line Tool", () => {
  it("quotes paths for the shell and the AppleScript string", () => {
    expect(shellQuote("/Applications/Klive IDE.app")).toBe("'/Applications/Klive IDE.app'");
    expect(shellQuote("it's")).toBe("'it'\\''s'");
    expect(installAppleScript("/Applications/Klive IDE.app/Contents/Resources/cli/klive")).toBe(
      `do shell script "mkdir -p '/usr/local/bin' && ln -sf '/Applications/Klive IDE.app/Contents/Resources/cli/klive' '/usr/local/bin/klive'" with administrator privileges`
    );
    expect(installAppleScript('/a"b\\c', "/x/klive")).toBe(
      `do shell script "mkdir -p '/x' && ln -sf '/a\\"b\\\\c' '/x/klive'" with administrator privileges`
    );
  });

  it("knows whether the link points at this launcher", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "klive-link-"));
    try {
      const link = path.join(dir, "klive");
      expect(linkPointsTo(link, "/launcher")).toBe(false);
      fs.symlinkSync("/launcher", link);
      expect(linkPointsTo(link, "/launcher")).toBe(true);
      expect(linkPointsTo(link, "/other")).toBe(false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("has no launcher in a development run", () => {
    expect(cliLauncherPath()).toBeUndefined();
  });
});
