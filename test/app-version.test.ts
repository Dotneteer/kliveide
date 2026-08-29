import packageInfo from "../package.json";
import { describe, expect, it } from "vitest";
import { KLIVE_APP_VERSION } from "../src/main/app-version";

describe("Klive application version", () => {
  it("uses the project package version", () => {
    expect(KLIVE_APP_VERSION).toBe(packageInfo.version);
  });
});
