import "mocha";

import { testCodeEmit } from "./test-helpers";

describe("Assembler - parse-time function emit", async () => {
  it("textof - ld", async () => {
    await testCodeEmit(
      `
      .dm textof(ld)
    `,
    0x4C, 0x44
    );
  });

  it("ltextof - ld", async () => {
    await testCodeEmit(
      `
      .dm ltextof(ld)
    `,
    0x6C, 0x64
    );
  });

  it("textof - bc", async () => {
    await testCodeEmit(
      `
      .dm textof(bc)
    `,
    0x42, 0x43
    );
  });

  it("ltextof - bc", async () => {
    await testCodeEmit(
      `
      .dm ltextof(bc)
    `,
    0x62, 0x63
    );
  });

  it("textof - (bc)", async () => {
    await testCodeEmit(
      `
      .dm textof((bc))
    `,
    0x28, 0x42, 0x43, 0x29
    );
  });

  it("ltextof - (bc)", async () => {
    await testCodeEmit(
      `
      .dm ltextof((bc))
    `,
    0x28, 0x62, 0x63, 0x29
    );
  });
});
