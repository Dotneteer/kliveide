import "mocha";

import {
  testCodeEmit,
} from "./test-helpers";

describe("Assembler - struct invocation", () => {
  it("empty struct, no bytes", () => {
    testCodeEmit(`
      MyStruct .struct
      .ends
      
      MyStruct()
    `);
  });

  const validCases = [
    "; this is comment",
    "MyField",
    "MyField:",
    ".defb 0x80",
    ".defw 0x8078",
    '.defc "Hello"',
    '.defm "Hello"',
    '.defn "Hello"',
    '.defh "e345"',
    ".defs 100",
    ".fillb 10,#ff",
    ".fillw 10,#ffe3",
    '.defgx "....OOOO"',
    '.defg "....OOOO"',
  ];
  validCases.forEach((vc) => {
    it(`no invocation, no bytes ${vc}`, () => {
      testCodeEmit(`
        MyStruct .struct
        ${vc}
        .defb 0x80
        .ends
      `);
    });
  });

  it("simple struct, defb #1", () => {
    testCodeEmit(
      `
      MyStruct
      .struct
        .defb 0x00
      .ends
      MyStruct()
    `,
      0x00
    );
  });

  it("simple struct, defb #2", () => {
    testCodeEmit(
      `
      MyStruct
      .struct
      .defb 0x00, 0x23, #a4, 0xc3, 12
      .ends
      MyStruct()
    `,
      0x00,
      0x23,
      0xa4,
      0xc3,
      0x0c
    );
  });

  it("simple struct, defw #1", () => {
    testCodeEmit(
      `
      MyStruct
      .struct
      .defw 0x00
      .ends
      MyStruct()
    `,
      0x00,
      0x00
    );
  });

  it("simple struct, defw #2", () => {
    testCodeEmit(
      `
      MyStruct
      .struct
      .defw 0x1234, #FEDC
      .ends
      MyStruct()
    `,
      0x34,
      0x12,
      0xdc,
      0xfe
    );
  });

  it("simple struct, defm", () => {
    testCodeEmit(
      `
      MyStruct
      .struct
      .defm "ABCD"
      .ends
      MyStruct()
    `,
      0x41,
      0x42,
      0x43,
      0x44
    );
  });

  it("simple struct, defn", () => {
    testCodeEmit(
      `
      MyStruct
      .struct
      .defn "ABCD"
      .ends
      MyStruct()
    `,
      0x41,
      0x42,
      0x43,
      0x44,
      0x00
    );
  });

  it("simple struct, defc", () => {
    testCodeEmit(
      `
      MyStruct
      .struct
      .defc "ABCD"
      .ends
      MyStruct()
    `,
      0x41,
      0x42,
      0x43,
      0xc4
    );
  });

  it("simple struct, defs", () => {
    testCodeEmit(
      `
      MyStruct
      .struct
      .defs 3
      .ends
      MyStruct()
    `,
      0x00,
      0x00,
      0x00
    );
  });

  it("simple struct, fillb", () => {
    testCodeEmit(
      `
      MyStruct
      .struct
      .fillb 3, #A5
      .ends
      MyStruct()
    `,
      0xa5,
      0xa5,
      0xa5
    );
  });

  it("simple struct, fillw", () => {
    testCodeEmit(
      `
      MyStruct
      .struct
      .fillw 2, #12A5
      .ends
      MyStruct()
    `,
      0xa5,
      0x12,
      0xa5,
      0x12
    );
  });

  it("simple struct, defgx", () => {
    testCodeEmit(
      `
      MyStruct
      .struct
      .defgx "----OOOO xxxx...."
      .ends
      MyStruct()
    `,
      0x0f,
      0xf0
    );
  });

  it("simple struct, defg", () => {
    testCodeEmit(
      `
      MyStruct
      .struct
      .defg ----OOOO xxxx....
      .ends
      MyStruct()
    `,
      0x0f,
      0xf0
    );
  });

  it("simple struct, defb, fixup #1", () => {
    testCodeEmit(
      `
      MyStruct
        .struct
          .defb MyAddr
        .ends

      MyStruct()
      MyAddr
        ld a,b
    `,
      0x01,
      0x78
    );
  });

  it("simple struct, defb, fixup #2", () => {
    testCodeEmit(
      `
      MyStruct
        .struct
          .defb #a4, MyAddr
        .ends

      MyStruct()
      MyAddr
        ld a,b
    `,
      0xa4,
      0x02,
      0x78
    );
  });

  it("simple struct, defb, fixup #3", () => {
    testCodeEmit(
      `
      MyStruct
        .struct
          .defb MyAddr, #A4
        .ends

      MyStruct()
      MyAddr
        ld a,b
    `,
      0x02,
      0xa4,
      0x78
    );
  });

  it("simple struct, defw, fixup #1", () => {
    testCodeEmit(
      `
      MyStruct
        .struct
        .defw MyAddr
        .ends

      MyStruct()
      MyAddr
        ld a,b
    `,
      0x02,
      0x80,
      0x78
    );
  });

  it("simple struct, defw, fixup #2", () => {
    testCodeEmit(
      `
      MyStruct
        .struct
        .defw #1234, MyAddr
        .ends

      MyStruct()
      MyAddr
        ld a,b
    `,
      0x34,
      0x12,
      0x04,
      0x80,
      0x78
    );
  });

  it("simple struct, defw, fixup #3", () => {
    testCodeEmit(
      `
      MyStruct
        .struct
        .defw MyAddr, #1234
        .ends

      MyStruct()
      MyAddr
        ld a,b
    `,
      0x04,
      0x80,
      0x34,
      0x12,
      0x78
    );
  });

  it("simple struct, multiple fixups", () => {
    testCodeEmit(
      `
      MyStruct
        .struct
          .defw MyAddr, #1234
          .defb 0xe4, MyAddr1
          .defn "ABCD"
        .ends

      MyStruct()
      MyAddr
        ld a,b
      MyAddr1
        ld a,b
    `,
      0x0b,
      0x80,
      0x34,
      0x12,
      0xe4,
      0x0c,
      0x41,
      0x42,
      0x43,
      0x44,
      0x00,
      0x78,
      0x78
    );
  });
});
