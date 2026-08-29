import { describe, expect, it, vi } from "vitest";
import {
  decimalAddress,
  newItemName,
  optionalPath,
  renamedItemName,
  requiredFilename,
  requiredPath
} from "@renderer/appIde/dialogs/dialogValidators";

const validationService = {
  isValidFilename: vi.fn((value: string) => value === "valid.asm"),
  isValidPath: vi.fn((value: string, allowEmpty = true) => (allowEmpty && !value) || value === "/valid")
};

describe("dialog validators", () => {
  it("makes required and optional values explicit", () => {
    expect(requiredFilename(validationService, "")).toBe("Enter a file name.");
    expect(requiredFilename(validationService, "bad.asm")).toBe("Enter a valid file name.");
    expect(requiredPath(validationService, "")).toBe("Choose a folder.");
    expect(optionalPath(validationService, "")).toBeUndefined();
  });

  it("treats nullable values as empty input", () => {
    expect(requiredFilename(validationService, null)).toBe("Enter a file name.");
    expect(requiredPath(validationService, null)).toBe("Choose a folder.");
    expect(optionalPath(validationService, null)).toBeUndefined();
    expect(decimalAddress(null)).toBeUndefined();
  });

  it("treats whitespace-only optional paths as empty input", () => {
    expect(optionalPath(validationService, "   ")).toBeUndefined();
  });

  it("explains duplicate and unchanged item names", () => {
    expect(newItemName(validationService, ["valid.asm"], "valid.asm")).toBe(
      "An item with this name already exists."
    );
    expect(renamedItemName(validationService, "valid.asm", "valid.asm")).toBe(
      "Enter a different name."
    );
  });

  it("accepts only decimal addresses when a value is present", () => {
    expect(decimalAddress("")).toBeUndefined();
    expect(decimalAddress("32768")).toBeUndefined();
    expect(decimalAddress("$8000")).toBe("Enter a decimal address.");
  });
});
