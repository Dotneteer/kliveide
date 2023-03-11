import "mocha";
import { expect } from "expect";
import * as path from "path";

import {
  compileFileFails,
  compileFileWorks,
  testCodeFileEmit
} from "./test-helpers";

describe("Assembler - include directive", () => {
  it("no include works", async () => {
    const output = await compileFileWorks("NoInclude.z80asm");

    const filename = path.basename(output.sourceItem.filename);
    expect(filename).toBe("NoInclude.z80asm");
    expect(output.sourceItem.includes.length).toBe(0);
  });

  it("single include works", async () => {
    const output = await compileFileWorks("SingleInclude.z80asm");

    const filename = path.basename(output.sourceItem.filename);
    expect(filename).toBe("SingleInclude.z80asm");
    expect(output.sourceItem.includes.length).toBe(1);
    expect(path.basename(output.sourceItem.includes[0].filename)).toBe(
      "inc1.z80asm"
    );
  });

  it("multiple include works", async () => {
    const output = await compileFileWorks("MultipleInclude.z80asm");

    const filename = path.basename(output.sourceItem.filename);
    expect(filename).toBe("MultipleInclude.z80asm");
    expect(output.sourceItem.includes.length).toBe(2);
    expect(path.basename(output.sourceItem.includes[0].filename)).toBe(
      "inc1.z80asm"
    );
    expect(path.basename(output.sourceItem.includes[1].filename)).toBe(
      "inc2.z80asm"
    );
  });

  it("fails with repetition", async () => {
    await compileFileFails("RepetitionInclude.z80asm", "Z0202");
  });

  it("fails with single circularity", async () => {
    await compileFileFails("SingleCircular.z80asm", "Z0203");
  });

  it("nested include works", async () => {
    const output = await compileFileWorks("NestedInclude.z80asm");

    const filename = path.basename(output.sourceItem.filename);
    expect(filename).toBe("NestedInclude.z80asm");
    expect(output.sourceItem.includes.length).toBe(2);
    expect(path.basename(output.sourceItem.includes[0].filename)).toBe(
      "incA.z80asm"
    );
    const itemA = output.sourceItem.includes[0];
    expect(itemA.includes.length).toBe(2);
    expect(path.basename(itemA.includes[0].filename)).toBe("inc1.z80asm");
    expect(path.basename(itemA.includes[1].filename)).toBe("inc2.z80asm");
    expect(path.basename(output.sourceItem.includes[1].filename)).toBe(
      "incB.z80asm"
    );
    const itemB = output.sourceItem.includes[1];
    expect(path.basename(itemB.includes[0].filename)).toBe("inc1.z80asm");
    expect(path.basename(itemB.includes[1].filename)).toBe("inc2.z80asm");
  });

  it("missing endif detected #1", async () => {
    await compileFileFails("MissingEndIf1.z80asm", "Z0205");
  });

  it("missing endif detected #2", async () => {
    await compileFileFails("MissingEndIf2.z80asm", "Z0205");
  });

  it("missing endif detected #3", async () => {
    await compileFileFails("MissingEndIf3.z80asm", "Z0205");
  });

  it("missing endif detected #4", async () => {
    await compileFileFails("MissingEndIf4.z80asm", "Z0205");
  });

  it("scenario works #1", async () => {
    await testCodeFileEmit("Scenario1.z80asm", 0x78, 0x01, 0xcd, 0xab, 0x41);
  });

  it("scenario works #2", async () => {
    await testCodeFileEmit(
      "Scenario2.z80asm",
      0x78,
      0x01,
      0x34,
      0x12,
      0x41,
      0x01,
      0x45,
      0x23,
      0x37,
      0x21,
      0x56,
      0x34,
      0xc9
    );
  });
});
