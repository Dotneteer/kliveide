import { describe, expect, it } from "vitest";

import { resolveSjasmplusExecutable } from "@main/sjasmp-integration/sjasmplus-resolver";

describe("resolveSjasmplusExecutable", () => {
  it("prefers the explicit executable path", () => {
    expect(
      resolveSjasmplusExecutable({
        readSetting: (key) =>
          key === "sjasmp.executablePath" ? "/custom/bin/sjasmplus" : "/tools/sjasmplus"
      })
    ).toBe("/custom/bin/sjasmplus");
  });

  it("falls back to the install folder on POSIX platforms", () => {
    expect(
      resolveSjasmplusExecutable({
        readSetting: (key) => (key === "sjasmp.root" ? "/tools/sjasmplus" : undefined)
      }, false)
    ).toBe("/tools/sjasmplus/sjasmplus");
  });

  it("falls back to the install folder on Windows", () => {
    expect(
      resolveSjasmplusExecutable({
        readSetting: (key) => (key === "sjasmp.root" ? "C:\\tools\\sjasmplus" : undefined)
      }, true)
    ).toBe("C:/tools/sjasmplus/sjasmplus.exe");
  });
});
