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
});
