import { describe, expect, it } from "vitest";

import { SJASMP_CONFIGURED_FAILED_MESSAGE } from "@main/sjasmp-integration/sjasmp-config";
import {
  resolveSjasmplusExecutable,
  sjasmplusNotWorkingMessage,
  SJASMPLUS_NOT_CONFIGURED_MESSAGE
} from "@main/sjasmp-integration/sjasmplus-resolver";

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

describe("SJASMPLUS failure messages", () => {
  it("says what the dialog says about a broken setup, and names the executable", () => {
    const message = sjasmplusNotWorkingMessage("/Users/me/sjasmp/sjasmplus");

    // --- One source of truth: the compiler and the dialog use the same phrase
    expect(message).toContain(SJASMP_CONFIGURED_FAILED_MESSAGE);
    expect(message).toContain("/Users/me/sjasmp/sjasmplus");
    // --- ...and it says where to fix it
    expect(message).toContain("Integrations | SjasmPlus Assembler");
  });

  it("distinguishes 'never set up' from 'set up but broken'", () => {
    expect(SJASMPLUS_NOT_CONFIGURED_MESSAGE).toContain("No SJASMPLUS assembler is set up yet");
    expect(SJASMPLUS_NOT_CONFIGURED_MESSAGE).not.toContain(SJASMP_CONFIGURED_FAILED_MESSAGE);
    expect(SJASMPLUS_NOT_CONFIGURED_MESSAGE).toContain("Integrations | SjasmPlus Assembler");
  });
});
