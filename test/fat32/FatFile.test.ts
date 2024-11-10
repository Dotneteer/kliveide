import { describe, it, expect, assert } from "vitest";
import { FatFile } from "@main/fat32/FatFile";
import { FAT_CASE_LC_BASE, FAT_CASE_LC_EXT, FNAME_FLAG_LOST_CHARS } from "@abstractions/Fat32Types";

describe("FatFile", () => {
  it("parsePathToLfn fails #1", () => {
    // --- Arrange
    const ff = new FatFile();
    try {
      // --- Act
      const fn = ff.parsePathToLfn("");
    } catch (err) {
      // --- Assert
      expect(err.message).includes("empty");
      return;
    }
    assert.fail("Exception expected");
  });

  it("parsePathToLfn fails #2", () => {
    // --- Arrange
    const ff = new FatFile();
    try {
      // --- Act
      const fn = ff.parsePathToLfn("*");
    } catch (err) {
      // --- Assert
      expect(err.message).includes("reserved");
      return;
    }
    assert.fail("Exception expected");
  });

  it("parsePathToLfn - single segment #1", () => {
    // --- Arrange
    const ff = new FatFile();

    // --- Act
    const fn = ff.parsePathToLfn("hello");

    // --- Assert
    expect(fn.segments.length).toBe(1);
    expect(fn.segments[0].name).toBe("hello");
    expect(fn.segments[0].flags).toBe(FAT_CASE_LC_BASE);
    expect(fn.segments[0].sfn).toBe("HELLO");
    expect(fn.segments[0].sfn12).toBe("HELLO   .   ");
    expect(fn.segments[0].sfn11).toBe("HELLO      ");
  });

  it("parsePathToLfn - single segment #2", () => {
    // --- Arrange
    const ff = new FatFile();

    // --- Act
    const fn = ff.parsePathToLfn("hello.");

    // --- Assert
    expect(fn.segments.length).toBe(1);
    expect(fn.segments[0].name).toBe("hello");
    expect(fn.segments[0].flags).toBe(FAT_CASE_LC_BASE);
    expect(fn.segments[0].sfn).toBe("HELLO");
    expect(fn.segments[0].sfn12).toBe("HELLO   .   ");
    expect(fn.segments[0].sfn11).toBe("HELLO      ");
  });

  it("parsePathToLfn - single segment #3", () => {
    // --- Arrange
    const ff = new FatFile();

    // --- Act
    const fn = ff.parsePathToLfn("hello.txt");

    // --- Assert
    expect(fn.segments.length).toBe(1);
    expect(fn.segments[0].name).toBe("hello.txt");
    expect(fn.segments[0].flags).toBe(FAT_CASE_LC_BASE | FAT_CASE_LC_EXT);
    expect(fn.segments[0].sfn).toBe("HELLO.TXT");
    expect(fn.segments[0].sfn12).toBe("HELLO   .TXT");
    expect(fn.segments[0].sfn11).toBe("HELLO   TXT");
  });

  it("parsePathToLfn - single segment #4", () => {
    // --- Arrange
    const ff = new FatFile();

    // --- Act
    const fn = ff.parsePathToLfn("  hello   .txt");

    // --- Assert
    expect(fn.segments.length).toBe(1);
    expect(fn.segments[0].name).toBe("hello   .txt");
    expect(fn.segments[0].flags).toBe(FAT_CASE_LC_BASE | FAT_CASE_LC_EXT);
    expect(fn.segments[0].sfn).toBe("HELLO.TXT");
    expect(fn.segments[0].sfn12).toBe("HELLO   .TXT");
    expect(fn.segments[0].sfn11).toBe("HELLO   TXT");
  });

  it("parsePathToLfn - single segment #5", () => {
    // --- Arrange
    const ff = new FatFile();

    // --- Act
    const fn = ff.parsePathToLfn("The quick brown.fox");

    // --- Assert
    expect(fn.segments.length).toBe(1);
    expect(fn.segments[0].name).toBe("The quick brown.fox");
    expect(fn.segments[0].flags).toBe(FNAME_FLAG_LOST_CHARS);
    expect(fn.segments[0].sfn).toBe("THEQUI~1.FOX");
    expect(fn.segments[0].sfn12).toBe("THEQUI~1.FOX");
    expect(fn.segments[0].sfn11).toBe("THEQUI~1FOX");
  });

  it("parsePathToLfn - multiple segment #1", () => {
    // --- Arrange
    const ff = new FatFile();

    // --- Act
    const fn = ff.parsePathToLfn("myroot/hello");

    // --- Assert
    expect(fn.segments.length).toBe(2);
    expect(fn.segments[0].name).toBe("myroot");
    expect(fn.segments[0].flags).toBe(FAT_CASE_LC_BASE);
    expect(fn.segments[0].sfn).toBe("MYROOT");
    expect(fn.segments[0].sfn12).toBe("MYROOT  .   ");
    expect(fn.segments[0].sfn11).toBe("MYROOT     ");
    expect(fn.segments[1].name).toBe("hello");
    expect(fn.segments[1].flags).toBe(FAT_CASE_LC_BASE);
    expect(fn.segments[1].sfn).toBe("HELLO");
    expect(fn.segments[1].sfn12).toBe("HELLO   .   ");
    expect(fn.segments[1].sfn11).toBe("HELLO      ");
  });

  it("parsePathToLfn - multiple segment #2", () => {
    // --- Arrange
    const ff = new FatFile();

    // --- Act
    const fn = ff.parsePathToLfn("myroot.esx/hello.rtf");

    // --- Assert
    expect(fn.segments.length).toBe(2);
    expect(fn.segments[0].name).toBe("myroot.esx");
    expect(fn.segments[0].flags).toBe(FAT_CASE_LC_BASE | FAT_CASE_LC_EXT);
    expect(fn.segments[0].sfn).toBe("MYROOT.ESX");
    expect(fn.segments[0].sfn12).toBe("MYROOT  .ESX");
    expect(fn.segments[0].sfn11).toBe("MYROOT  ESX");
    expect(fn.segments[1].name).toBe("hello.rtf");
    expect(fn.segments[1].flags).toBe(FAT_CASE_LC_BASE | FAT_CASE_LC_EXT);
    expect(fn.segments[1].sfn).toBe("HELLO.RTF");
    expect(fn.segments[1].sfn12).toBe("HELLO   .RTF");
    expect(fn.segments[1].sfn11).toBe("HELLO   RTF");
  });

  it("parsePathToLfn - multiple segment #3", () => {
    // --- Arrange
    const ff = new FatFile();

    // --- Act
    const fn = ff.parsePathToLfn("my root folder.esx/hello.rtf");

    // --- Assert
    expect(fn.segments.length).toBe(2);
    expect(fn.segments[0].name).toBe("my root folder.esx");
    expect(fn.segments[0].flags).toBe(FNAME_FLAG_LOST_CHARS);
    expect(fn.segments[0].sfn).toBe("MYROOT~1.ESX");
    expect(fn.segments[0].sfn12).toBe("MYROOT~1.ESX");
    expect(fn.segments[0].sfn11).toBe("MYROOT~1ESX");
    expect(fn.segments[1].name).toBe("hello.rtf");
    expect(fn.segments[1].flags).toBe(FAT_CASE_LC_BASE | FAT_CASE_LC_EXT);
    expect(fn.segments[1].sfn).toBe("HELLO.RTF");
    expect(fn.segments[1].sfn12).toBe("HELLO   .RTF");
    expect(fn.segments[1].sfn11).toBe("HELLO   RTF");
  });

  it("parsePathToLfn - multiple segment #4", () => {
    // --- Arrange
    const ff = new FatFile();

    // --- Act
    const fn = ff.parsePathToLfn("my root folder.esx/hello buddy.rtf");

    // --- Assert
    expect(fn.segments.length).toBe(2);
    expect(fn.segments[0].name).toBe("my root folder.esx");
    expect(fn.segments[0].flags).toBe(FNAME_FLAG_LOST_CHARS);
    expect(fn.segments[0].sfn).toBe("MYROOT~1.ESX");
    expect(fn.segments[0].sfn12).toBe("MYROOT~1.ESX");
    expect(fn.segments[0].sfn11).toBe("MYROOT~1ESX");
    expect(fn.segments[1].name).toBe("hello buddy.rtf");
    expect(fn.segments[1].flags).toBe(FNAME_FLAG_LOST_CHARS);
    expect(fn.segments[1].sfn).toBe("HELLOB~1.RTF");
    expect(fn.segments[1].sfn12).toBe("HELLOB~1.RTF");
    expect(fn.segments[1].sfn11).toBe("HELLOB~1RTF");
  });
});
