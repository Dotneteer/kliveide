import { describe, expect, it } from "vitest";

import {
  getPathFolder,
  isSamePath,
  normalizeSeparators,
  removeTrailingSeparators
} from "@utils/path-compare";

describe("normalizeSeparators", () => {
  it.each([
    ["C:\\tools\\sjasmplus", "C:/tools/sjasmplus"],
    ["/tools/sjasmplus", "/tools/sjasmplus"],
    ["mixed\\path/here", "mixed/path/here"],
    ["", ""]
  ])("%s -> %s", (input, expected) => {
    expect(normalizeSeparators(input)).toBe(expected);
  });
});

describe("removeTrailingSeparators", () => {
  it.each([
    ["/tools/sjasmplus/", "/tools/sjasmplus"],
    ["C:\\tools\\", "C:\\tools"],
    ["/tools//", "/tools"],
    ["/tools/sjasmplus", "/tools/sjasmplus"],
    // --- A lone root separator is the whole path, so it is not trimmed away
    // --- into an empty string by accident.
    ["/", ""]
  ])("%s -> %s", (input, expected) => {
    expect(removeTrailingSeparators(input)).toBe(expected);
  });
});

describe("getPathFolder", () => {
  it.each([
    ["/tools/sjasmplus/sjasmplus", "/tools/sjasmplus"],
    ["C:\\tools\\sjasmplus\\sjasmplus.exe", "C:/tools/sjasmplus"],
    ["/sjasmplus", ""],
    // --- No separator at all: there is no folder to report
    ["sjasmplus", ""],
    ["", ""]
  ])("%s -> %s", (input, expected) => {
    expect(getPathFolder(input)).toBe(expected);
  });
});

describe("isSamePath", () => {
  it.each([
    // --- Separator shapes differ, the file does not
    ["C:\\tools\\sjasmplus\\sjasmplus.exe", "C:/tools/sjasmplus/sjasmplus.exe", true, true],
    // --- Windows paths are case-insensitive...
    ["C:/Tools/SjasmPlus/sjasmplus.exe", "c:/tools/sjasmplus/SJASMPLUS.EXE", true, true],
    // --- ...but everywhere else casing names a different file
    ["/tools/sjasmplus", "/Tools/SjasmPlus", false, false],
    // --- A trailing separator does not make a folder a different folder
    ["/tools/sjasmplus/", "/tools/sjasmplus", false, true],
    ["/tools/sjasmplus", "/tools/sjasmplus", false, true],
    ["/tools/sjasmplus", "/tools/other", false, false],
    // --- Nothing is "the same path" as an unknown path
    [undefined, "/tools/sjasmplus", false, false],
    ["/tools/sjasmplus", undefined, false, false],
    [undefined, undefined, false, false],
    ["", "", false, false]
  ])("%s vs %s (windows=%s) -> %s", (left, right, isWindows, expected) => {
    expect(isSamePath(left, right, isWindows)).toBe(expected);
  });

  it("is symmetric", () => {
    expect(isSamePath("C:\\tools\\a.exe", "C:/Tools/A.EXE", true)).toBe(
      isSamePath("C:/Tools/A.EXE", "C:\\tools\\a.exe", true)
    );
  });
});
