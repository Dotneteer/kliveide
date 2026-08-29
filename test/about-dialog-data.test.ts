import { describe, expect, it } from "vitest";
import { createAboutDialogData } from "../src/common/messaging/about-dialog";

describe("About dialog data", () => {
  it("preserves the version data supplied by the main process", () => {
    expect(createAboutDialogData("0.58.0", "43.2.0", "test-os")).toEqual({
      version: "0.58.0",
      electronVersion: "43.2.0",
      osVersion: "test-os"
    });
  });
});
