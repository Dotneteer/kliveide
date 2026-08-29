import { describe, it, expect } from "vitest";
import { createValidationService } from "@renderer/core/ValidationService";

describe("ValidationService", () => {
  it("Path validation (Windows)", () => {
    // --- Act
    const vals = createValidationService(true);
    const isValid = vals.isValidPath("C:\\Users\\User\\Documents\\MyProject", true);

    // --- Assert
    expect(isValid).toEqual(true);
  });

  it("Path validation (Mac)", () => {
    // --- Act
    const vals = createValidationService(false);
    const isValid = vals.isValidPath("/Users/User/Documents/MyProject", true);

    // --- Assert
    expect(isValid).toEqual(true);
  });

  it("distinguishes required and optional empty values", () => {
    const vals = createValidationService(false);

    expect(vals.isValidFilename("", false)).toEqual(false);
    expect(vals.isValidFilename("", true)).toEqual(true);
    expect(vals.isValidPath("", false)).toEqual(false);
    expect(vals.isValidPath("", true)).toEqual(true);
  });

  it("rejects invalid and reserved Windows file names", () => {
    const vals = createValidationService(true);

    expect(vals.isValidFilename("disk.dsk")).toEqual(true);
    expect(vals.isValidFilename("bad/name")).toEqual(false);
    expect(vals.isValidFilename("con")).toEqual(false);
    expect(vals.isValidFilename("NUL")).toEqual(false);
  });

  it("rejects invalid macOS names and overlong path segments", () => {
    const vals = createValidationService(false);

    expect(vals.isValidFilename(".hidden")).toEqual(false);
    expect(vals.isValidFilename("file:name")).toEqual(false);
    expect(vals.isValidPath("/Users/me/file:name")).toEqual(false);
    expect(vals.isValidPath(`/${"x".repeat(256)}`)).toEqual(false);
  });
});
