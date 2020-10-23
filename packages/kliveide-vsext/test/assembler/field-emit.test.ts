import "mocha";
import * as expect from "expect";
import { Z80Assembler } from "../../src/z80lang/assembler/assembler";

import { codeRaisesError, testCodeEmit } from "./test-helpers";

describe("Assembler - struct invocation", () => {
  it("defb #1", () => {
    testCodeEmit(
      `
    MyStruct
    .struct
        .defb #23
    .ends

    MyStruct()
    -> .defb #A5
    `,
      0xa5
    );
  });

  it("defb #2", () => {
    testCodeEmit(
      `
    MyStruct
    .struct
    .defb #23, #34
    .ends

    MyStruct()
    -> .defb #A5
    `,
      0xa5,
      0x34
    );
  });

  it("defb #3", () => {
    testCodeEmit(
      `
      MyStruct
      .struct
          .defb #23
      field1:
          .defb #34
      .ends

      MyStruct()
      field1 -> .defb #A5
    `,
      0x23,
      0xa5
    );
  });

  it("defb #4", () => {
    testCodeEmit(
      `
      MyStruct
        .struct
          .defb #23
        field1:
          .defb #34
        .ends
      Start:
        ld a,b
        MyStruct()
        field1 -> .defb #A5
    `,
      0x78,
      0x23,
      0xa5
    );
  });

  it("defb #5", () => {
    testCodeEmit(
      `
    MyStruct
    .struct
        .defb #23
    .ends

    MyStruct()
    ; This is a comment
    -> .defb #A5
    `,
      0xa5
    );
  });

  it("defb, fixup #1", () => {
    testCodeEmit(
      `
    MyStruct:
      .struct
          .defb #23, Start
      .ends
      
    Start:
      MyStruct()
      -> .defb #A5
    `,
      0xa5,
      0x00
    );
  });

  it("defb, fixup #2", () => {
    testCodeEmit(
      `
    MyStruct:
      .struct
      .defb Start, #23
      .ends
      
    Start:
      MyStruct()
      -> .defb #A5
    `,
      0xa5,
      0x23
    );
  });

  it("defb, fixup #3", () => {
    testCodeEmit(
      `
    MyStruct:
      .struct
          .defb Start
      field1
          .defb #23
      .ends
    Start:
      MyStruct()
      field1 -> .defb #A5
    `,
      0x00,
      0xa5
    );
  });

  it("defb, fixup #4", () => {
    testCodeEmit(
      `
    MyStruct:
      .struct
          .defb Start
      field1
          .defb #23
      .ends

      ld a,b
    Start:
      MyStruct()
      field1 -> .defb #A5
    `,
      0x78,
      0x01,
      0xa5
    );
  });

  it("defb, fixup #5", () => {
    testCodeEmit(
      `
    MyStruct:
      .struct
          .defb Start
      field1
          .defb #23
      .ends

      ld a,b
    Start:
      MyStruct()
      field1 -> .defb Next
    Next:
    `,
      0x78,
      0x01,
      0x03
    );
  });

  it("defb, fixup #6", () => {
    testCodeEmit(
      `
    MyStruct:
      .struct
          .defb Start
      field1
          .defb #23
      .ends

      ld a,b
    Start:
      MyStruct()
      -> .defb Next
      field1 -> .defb #a5
    Next:
    `,
      0x78,
      0x03,
      0xa5
    );
  });

  it("defb, fixup #7", () => {
    testCodeEmit(
      `
    MyStruct:
      .struct
          .defb Start
      field1
          .defb #23
      .ends

      ld a,b
    Start:
      MyStruct()
      -> .defb #a5
      field1 -> .defb Next
    Next:
    `,
      0x78,
      0xa5,
      0x03
    );
  });

  it("oversize defb", () => {
    codeRaisesError(
      `
    MyStruct:
      .struct
        .defb Start
        field1
          .defb #23
      .ends

      ld a,b
    Start:
      MyStruct()
      -> .defb #a5
      field1 -> .defb Next
      -> .defb #00
    Next:
      `,
      "Z0801"
    );
  });

  it("defw #1", () => {
    testCodeEmit(
      `
    MyStruct
      .struct
        .defw #234C
    .ends

    MyStruct()
    -> .defb #A5
    `,
      0xa5,
      0x23
    );
  });

  it("defw #2", () => {
    testCodeEmit(
      `
    MyStruct
      .struct
        .defw #234C
    .ends

    MyStruct()
    -> .defw #A516
    `,
      0x16,
      0xa5
    );
  });

  it("defw #3", () => {
    testCodeEmit(
      `
    MyStruct
      .struct
          .defw #234C, #3456
      .ends

    MyStruct()
      -> .defw #A516
    `,
      0x16,
      0xa5,
      0x56,
      0x34
    );
  });

  it("defw #4", () => {
    testCodeEmit(
      `
    MyStruct
      .struct
          .defw #234C, #3456
      .ends

    MyStruct()
      -> .defb #01
      -> .defw #A516
    `,
      0x01,
      0x16,
      0xa5,
      0x34
    );
  });

  it("defw #5", () => {
    testCodeEmit(
      `
    MyStruct
      .struct
          .defb #23
      field1:
          .defw #3429
      .ends

    MyStruct()
      field1 -> .defb #A5
    `,
      0x23,
      0xa5,
      0x34
    );
  });

  it("defw #6", () => {
    testCodeEmit(
      `
    MyStruct
      .struct
          .defb #23
      field1:
          .defw #3429
      .ends
    Start:
      ld a,b
      MyStruct()
      field1 -> .defb #A5
    `,
      0x78,
      0x23,
      0xa5,
      0x34
    );
  });

  it("defw #7", () => {
    testCodeEmit(
      `
    MyStruct
      .struct
          .defb #23
      field1:
          .defw #3429
      .ends
    Start:
      ld a,b
      MyStruct()
      field1 -> .defw #A5C4
    `,
      0x78,
      0x23,
      0xc4,
      0xa5
    );
  });

  it("defw #8", () => {
    testCodeEmit(
      `
    MyStruct
      .struct
          .defb #23
      field1:
          .defw #3429
      .ends
    Start:
      ld a,b
      MyStruct()
      ; This is a comment
      field1 -> .defw #A5C4
    `,
      0x78,
      0x23,
      0xc4,
      0xa5
    );
  });

  it("defw, fixup #1", () => {
    testCodeEmit(
      `
    MyStruct:
      .struct
          .defw #231A, Start
      .ends
      
    Start:
      MyStruct()
      -> .defw #A503
    `,
      0x03,
      0xa5,
      0x00,
      0x80
    );
  });

  it("defw, fixup #2", () => {
    testCodeEmit(
      `
    MyStruct:
      .struct
          .defw Start, #231A
      .ends
      
    Start:
      MyStruct()
      -> .defw #A503
    `,
      0x03,
      0xa5,
      0x1a,
      0x23
    );
  });

  it("defw, fixup #3", () => {
    testCodeEmit(
      `
    MyStruct:
      .struct
          .defw Start
      field1
          .defw #2315
      .ends
      
    Start:
      MyStruct()
      field1 -> .defb #A5
    `,
      0x00,
      0x80,
      0xa5,
      0x23
    );
  });

  it("defw, fixup #4", () => {
    testCodeEmit(
      `
    MyStruct:
      .struct
          .defw Start
      field1
          .defw #23
      .ends

      ld a,b
    Start:
      MyStruct()
      field1 -> .defw #A512
    `,
      0x78,
      0x01,
      0x80,
      0x12,
      0xa5
    );
  });

  it("defw, fixup #5", () => {
    testCodeEmit(
      `
    MyStruct:
      .struct
          .defw Start
      field1
          .defw #232C
      .ends

      ld a,b
    Start:
      MyStruct()
      field1 -> .defb Next
    Next:
    `,
      0x78,
      0x01,
      0x80,
      0x05,
      0x23
    );
  });

  it("defw, fixup #6", () => {
    testCodeEmit(
      `
    MyStruct:
      .struct
          .defw Start
      field1
          .defw #232C
      .ends

      ld a,b
    Start:
      MyStruct()
      -> .defw Next
    Next:
    `,
      0x78,
      0x05,
      0x80,
      0x2c,
      0x23
    );
  });

  it("defw, fixup #7", () => {
    testCodeEmit(
      `
    MyStruct:
      .struct
          .defw Start
      field1
          .defw #232C
      .ends

      ld a,b
    Start:
      MyStruct()
      -> .defw Next
      field1 -> .defb #a5
    Next:
    `,
      0x78,
      0x05,
      0x80,
      0xa5,
      0x23
    );
  });

  it("defw, fixup #8", () => {
    testCodeEmit(
      `
    MyStruct:
      .struct
          .defw Start
      field1
          .defw #232C
      .ends

      ld a,b
    Start:
      MyStruct()
      -> .defb #a5
      field1 -> .defw Next
    Next:
    `,
      0x78,
      0xa5,
      0x80,
      0x05,
      0x80
    );
  });

  it("defw, fixup #9", () => {
    testCodeEmit(
      `
    MyStruct:
      .struct
          .defw Start
      field1
          .defw #232C
      .ends

      ld a,b
    Start:
      MyStruct()
      -> .defb #a5
      field1 -> .defb Next
    Next:
    `,
      0x78,
      0xa5,
      0x80,
      0x05,
      0x23
    );
  });

  it("oversize defw", () => {
    codeRaisesError(
      `
    MyStruct:
      .struct
          .defw Start
      field1
          .defw #23
      .ends

      ld a,b
    Start:
      MyStruct()
      -> .defw #a515
      field1 -> .defw Next
      -> .defb #00
    Next:
      `,
      "Z0801"
    );
  });

  it("defm #1", () => {
    testCodeEmit(
      `
    MyStruct
      .struct
          .defm "ABC"
      .ends

      MyStruct()
      -> .defb #A5
    `,
      0xa5,
      0x42,
      0x43
    );
  });

  it("defm #2", () => {
    testCodeEmit(
      `
    MyStruct
      .struct
          .defm "AB"
          .defm "CD"
      .ends

      MyStruct()
      -> .defb #A5
    `,
      0xa5,
      0x42,
      0x43,
      0x44
    );
  });

  it("defm #3", () => {
    testCodeEmit(
      `
    MyStruct
      .struct
          .defm "AB"
      field1:
          .defm "CD"
      .ends

      MyStruct()
      field1 -> .defb #A5
    `,
      0x41,
      0x42,
      0xa5,
      0x44
    );
  });

  it("defm #4", () => {
    testCodeEmit(
      `
    MyStruct
      .struct
          .defm "AB"
      field1:
          .defm "CD"
      .ends
    Start:
      ld a,b
      MyStruct()
      field1 -> .defb #A5
    `,
      0x78,
      0x41,
      0x42,
      0xa5,
      0x44
    );
  });

  it("defm #5", () => {
    testCodeEmit(
      `
    MyStruct
      .struct
          .defm "AB"
      .ends

      MyStruct()
      ; This is a comment
      -> .defb #A5
    `,
      0xa5,
      0x42
    );
  });

  it("oversize defm", () => {
    codeRaisesError(
      `
    MyStruct:
      .struct
          .defb Start
      field1
          .defb #23
      .ends

      ld a,b
    Start:
      MyStruct()
      -> .defb #a5
      field1 -> .defb Next
      -> .defm "Hi"
    Next:
      `,
      "Z0801"
    );
  });

  it("defn #1", () => {
    testCodeEmit(
      `
    MyStruct
      .struct
          .defn "ABC"
      .ends

      MyStruct()
      -> .defb #A5
    `,
      0xa5,
      0x42,
      0x43,
      0x00
    );
  });

  it("defn #2", () => {
    testCodeEmit(
      `
    MyStruct
      .struct
          .defn "AB"
          .defn "CD"
      .ends

      MyStruct()
      -> .defb #A5
    `,
      0xa5,
      0x42,
      0x00,
      0x43,
      0x44,
      0x00
    );
  });

  it("defn #3", () => {
    testCodeEmit(
      `
    MyStruct
      .struct
          .defn "AB"
      field1:
          .defn "CD"
      .ends

      MyStruct()
      field1 -> .defb #A5
    `,
      0x41,
      0x42,
      0x00,
      0xa5,
      0x44,
      0x00
    );
  });

  it("defn #4", () => {
    testCodeEmit(
      `
    MyStruct
      .struct
          .defn "AB"
      field1:
          .defn "CD"
      .ends
    Start:
      ld a,b
      MyStruct()
      field1 -> .defb #A5
    `,
      0x78,
      0x41,
      0x42,
      0x00,
      0xa5,
      0x44,
      0x00
    );
  });

  it("defn #5", () => {
    testCodeEmit(
      `
    MyStruct
      .struct
          .defn "AB"
      .ends

      MyStruct()
      ; This is a comment
      -> .defb #A5
    `,
      0xa5,
      0x42,
      0x00
    );
  });

  it("oversize defn", () => {
    codeRaisesError(
      `
    MyStruct:
      .struct
          .defb Start
      field1
          .defb #23
      .ends

      ld a,b
    Start:
      MyStruct()
      -> .defb #a5
      field1 -> .defb Next
      -> .defn "Hi"
    Next:
      `,
      "Z0801"
    );
  });

  it("defc #1", () => {
    testCodeEmit(
      `
    MyStruct
      .struct
          .defc "ABC"
      .ends

      MyStruct()
      -> .defb #A5
    `,
      0xa5,
      0x42,
      0xc3
    );
  });

  it("defc #2", () => {
    testCodeEmit(
      `
    MyStruct
      .struct
          .defc "AB"
          .defc "CD"
      .ends

      MyStruct()
      -> .defb #A5
    `,
      0xa5,
      0xc2,
      0x43,
      0xc4
    );
  });

  it("defc #3", () => {
    testCodeEmit(
      `
    MyStruct
      .struct
          .defc "AB"
      field1:
          .defc "CD"
      .ends

      MyStruct()
      field1 -> .defb #A5
    `,
      0x41,
      0xc2,
      0xa5,
      0xc4
    );
  });

  it("defc #4", () => {
    testCodeEmit(
      `
    MyStruct
      .struct
          .defc "AB"
      field1:
          .defc "CD"
      .ends
    Start:
      ld a,b
      MyStruct()
      field1 -> .defb #A5
    `,
      0x78,
      0x41,
      0xc2,
      0xa5,
      0xc4
    );
  });

  it("defc #5", () => {
    testCodeEmit(
      `
    MyStruct
      .struct
          .defc "AB"
      .ends

      MyStruct()
      ; This is a comment
      -> .defb #A5
    `,
      0xa5,
      0xc2
    );
  });

  it("oversize defc", () => {
    codeRaisesError(
      `
    MyStruct:
      .struct
          .defb Start
      field1
          .defb #23
      .ends

      ld a,b
    Start:
      MyStruct()
      -> .defb #a5
      field1 -> .defb Next
      -> .defc "Hi"
    Next:
      `,
      "Z0801"
    );
  });

  it("defh #1", () => {
    testCodeEmit(
      `
    MyStruct
      .struct
          .defh "12AC"
      .ends

      MyStruct()
      -> .defb #A5
    `,
      0xa5,
      0xac
    );
  });

  it("defh #2", () => {
    testCodeEmit(
      `
    MyStruct
      .struct
          .defh "AB"
          .defh "CD"
      .ends

      MyStruct()
      -> .defb #A5
    `,
      0xa5,
      0xcd
    );
  });

  it("defh #3", () => {
    testCodeEmit(
      `
    MyStruct
      .struct
          .defh "AB"
      field1:
          .defh "CD"
      .ends

      MyStruct()
      field1 -> .defb #A5
    `,
      0xab,
      0xa5
    );
  });

  it("defh #4", () => {
    testCodeEmit(
      `
    MyStruct
      .struct
          .defh "AB"
      field1:
          .defh "CD"
      .ends
    Start:
      ld a,b
      MyStruct()
      field1 -> .defb #A5
    `,
      0x78,
      0xab,
      0xa5
    );
  });

  it("defh #5", () => {
    testCodeEmit(
      `
    MyStruct
      .struct
          .defh "AB"
      field1:
          .defh "CD"
      .ends
    Start:
      ld a,b
      MyStruct()
      ; This is a comment
      field1 -> .defb #A5
    `,
      0x78,
      0xab,
      0xa5
    );
  });

  it("oversize defh", () => {
    codeRaisesError(
      `
    MyStruct:
      .struct
          .defb Start
      field1
          .defb #23
      .ends

      ld a,b
    Start:
      MyStruct()
      -> .defb #a5
      field1 -> .defb Next
      -> .defh "E4"
    Next:
      `,
      "Z0801"
    );
  });

  it("defs #1", () => {
    testCodeEmit(
      `
    MyStruct
      .struct
          .defs 3
      .ends

      MyStruct()
      -> .defb #A5
    `,
      0xa5,
      0x00,
      0x00
    );
  });

  it("defs #2", () => {
    testCodeEmit(
      `
    MyStruct
      .struct
          .defs 1
          .defs 2
      .ends

      MyStruct()
      -> .defb #A5
    `,
      0xa5,
      0x00,
      0x00
    );
  });

  it("defs #3", () => {
    testCodeEmit(
      `
    MyStruct
      .struct
          .defs 1
      field1:
          .defs 2
      .ends

      MyStruct()
      field1 -> .defb #A5
    `,
      0x00,
      0xa5,
      0x00
    );
  });

  it("defs #4", () => {
    testCodeEmit(
      `
    MyStruct
      .struct
          .defs 1
      field1:
          .defs 2
      .ends
    Start:
      ld a,b
      MyStruct()
      field1 -> .defb #A5
    `,
      0x78,
      0x00,
      0xa5,
      0x00
    );
  });

  it("defs #5", () => {
    testCodeEmit(
      `
    MyStruct
      .struct
          .defs 1
      field1:
          .defs 2
      .ends
    Start:
      ld a,b
      MyStruct()
      ; This is a comment
      field1 -> .defb #A5
    `,
      0x78,
      0x00,
      0xa5,
      0x00
    );
  });

  it("oversize defs", () => {
    codeRaisesError(
      `
    MyStruct:
      .struct
          .defb Start
      field1
          .defb #23
      .ends

      ld a,b
    Start:
      MyStruct()
      -> .defb #a5
      field1 -> .defb Next
      -> .defs 4
    Next:
      `,
      "Z0801"
    );
  });

  it("fillb #1", () => {
    testCodeEmit(
      `
    MyStruct
      .struct
          .fillb 3, #D9
      .ends

      MyStruct()
      -> .defb #A5
    `,
      0xa5,
      0xd9,
      0xd9
    );
  });

  it("fillb #2", () => {
    testCodeEmit(
      `
    MyStruct
      .struct
          .fillb 1, #D9
          .fillb 2, #D9
      .ends

      MyStruct()
      -> .defb #A5
    `,
      0xa5,
      0xd9,
      0xd9
    );
  });

  it("fillb #3", () => {
    testCodeEmit(
      `
    MyStruct
      .struct
          .fillb 1, #D7
      field1:
          .fillb 2, #D9
      .ends

      MyStruct()
      field1 -> .defb #A5
    `,
      0xd7,
      0xa5,
      0xd9
    );
  });

  it("fillb #4", () => {
    testCodeEmit(
      `
    MyStruct
      .struct
          .fillb 1, #D7
      field1:
          .fillb 2, #D9
      .ends
    Start:
      ld a,b
      MyStruct()
      field1 -> .defb #A5
    `,
      0x78,
      0xd7,
      0xa5,
      0xd9
    );
  });

  it("fillb #5", () => {
    testCodeEmit(
      `
    MyStruct
      .struct
          .fillb 1, #D7
      field1:
          .fillb 2, #D9
      .ends
    Start:
      ld a,b
      MyStruct()
      ; This is a comment
      field1 -> .defb #A5
    `,
      0x78,
      0xd7,
      0xa5,
      0xd9
    );
  });

  it("oversize fillb", () => {
    codeRaisesError(
      `
    MyStruct:
      .struct
          .defb Start
      field1
          .defb #23
      .ends

      ld a,b
    Start:
      MyStruct()
      -> .defb #a5
      field1 -> .defb Next
      -> .fillb 4, #13
    Next:
      `,
      "Z0801"
    );
  });

  it("fillw #1", () => {
    testCodeEmit(
      `
    MyStruct
      .struct
          .fillw 2, #D924
      .ends

      MyStruct()
      -> .defb #A5
    `,
      0xa5,
      0xd9,
      0x24,
      0xd9
    );
  });

  it("fillw #2", () => {
    testCodeEmit(
      `
    MyStruct
      .struct
          .fillw 1, #D924
          .fillw 2, #D924
      .ends

      MyStruct()
      -> .defb #A5
    `,
      0xa5,
      0xd9,
      0x24,
      0xd9,
      0x24,
      0xd9
    );
  });

  it("fillw #3", () => {
    testCodeEmit(
      `
    MyStruct
      .struct
          .fillw 1, #D724
      field1:
          .fillw 2, #D924
      .ends

      MyStruct()
      field1 -> .defb #A5
    `,
      0x24,
      0xd7,
      0xa5,
      0xd9,
      0x24,
      0xd9
    );
  });

  it("fillw #4", () => {
    testCodeEmit(
      `
    MyStruct
      .struct
          .fillw 1, #D724
      field1:
          .fillw 2, #D924
      .ends
    Start:
      ld a,b
      MyStruct()
      field1 -> .defb #A5
    `,
      0x78,
      0x24,
      0xd7,
      0xa5,
      0xd9,
      0x24,
      0xd9
    );
  });

  it("fillw #5", () => {
    testCodeEmit(
      `
    MyStruct
      .struct
          .fillw 2, #D924
      .ends

      MyStruct()
      ; This is a comment
      -> .defb #A5
    `,
      0xa5,
      0xd9,
      0x24,
      0xd9
    );
  });

  it("oversize fillw", () => {
    codeRaisesError(
      `
    MyStruct:
      .struct
          .defb Start
      field1
          .defb #23
      .ends

      ld a,b
    Start:
      MyStruct()
      -> .defb #a5
      field1 -> .defb Next
      -> .fillw 4, #13
    Next:
      `,
      "Z0801"
    );
  });

  it("defg #1", () => {
    testCodeEmit(
      `
    MyStruct
      .struct
          .defg ----OOOO xxxx....
          .defg x.x.x.x. .o.o.o.o
      .ends

      MyStruct()
      -> .defb #A5
    `,
      0xa5,
      0xf0,
      0xaa,
      0x55
    );
  });

  it("defg #2", () => {
    testCodeEmit(
      `
    MyStruct
      .struct
          .defg ----OOOO xxxx....
      .ends

      MyStruct()
      -> .defb #A5
    `,
      0xa5,
      0xf0
    );
  });

  it("defg #3", () => {
    testCodeEmit(
      `
    MyStruct
      .struct
          .defg ----OOOO xxxx....
      field1:
          .defg x.x.x.x. .o.o.o.o
      .ends

      MyStruct()
      field1 -> .defb #A5
    `,
      0x0f,
      0xf0,
      0xa5,
      0x55
    );
  });

  it("defg #4", () => {
    testCodeEmit(
      `
    MyStruct
      .struct
          .defg ----OOOO xxxx....
      field1:
          .defg x.x.x.x. .o.o.o.o
      .ends
    Start:
      ld a,b
      MyStruct()
      field1 -> .defb #A5
    `,
      0x78,
      0x0f,
      0xf0,
      0xa5,
      0x55
    );
  });

  it("defg #5", () => {
    testCodeEmit(
      `
    MyStruct
      .struct
          .defg ----OOOO xxxx....
      .ends

      MyStruct()
      ; This is a comment
      -> .defb #A5
    `,
      0xa5,
      0xf0
    );
  });

  it("oversize defg", () => {
    codeRaisesError(
      `
    MyStruct:
      .struct
          .defb Start
      field1
          .defb #23
      .ends

      ld a,b
    Start:
      MyStruct()
      -> .defb #a5
      field1 -> .defb Next
      -> .defg ----OOOO xxxx....
    Next:
      `,
      "Z0801"
    );
  });

  it("defgx #1", () => {
    testCodeEmit(
      `
    MyStruct
      .struct
          .defgx "----OOOO xxxx...."
      .ends

      MyStruct()
      -> .defb #A5
    `,
      0xa5,
      0xf0
    );
  });

  it("defgx #2", () => {
    testCodeEmit(
      `
    MyStruct
      .struct
          .defgx "----OOOO xxxx...."
          .defgx "x.x.x.x. .o.o.o.o"
      .ends

      MyStruct()
      -> .defb #A5
    `,
      0xa5,
      0xf0,
      0xaa,
      0x55
    );
  });

  it("defgx #3", () => {
    testCodeEmit(
      `
    MyStruct
      .struct
          .defgx "----OOOO xxxx...."
      field1:
          .defgx "x.x.x.x. .o.o.o.o"
      .ends

      MyStruct()
      field1 -> .defb #A5
    `,
      0x0f,
      0xf0,
      0xa5,
      0x55
    );
  });

  it("defgx #4", () => {
    testCodeEmit(
      `
    MyStruct
      .struct
          .defgx "----OOOO xxxx...."
      field1:
          .defgx "x.x.x.x. .o.o.o.o"
      .ends
    Start:
      ld a,b
      MyStruct()
      field1 -> .defb #A5
    `,
    0x78, 0x0F, 0xF0, 0xA5, 0x55
    );
  });

  it("defgx #5", () => {
    testCodeEmit(
      `
    MyStruct
      .struct
          .defgx "----OOOO xxxx...."
      field1:
          .defgx "x.x.x.x. .o.o.o.o"
      .ends
    Start:
      ld a,b
      MyStruct()
      ; this is a comment
      field1 -> .defb #A5
    `,
    0x78, 0x0F, 0xF0, 0xA5, 0x55
    );
  });

  it("oversize defgx", () => {
    codeRaisesError(
      `
    MyStruct:
      .struct
          .defb Start
      field1
          .defb #23
      .ends

      ld a,b
    Start:
      MyStruct()
      -> .defb #a5
      field1 -> .defb Next
      -> .defgx "----OOOO xxxx...."
    Next:
      `,
      "Z0801"
    );
  });

  it("field invocation does not redefine labels", () => {
    const compiler = new Z80Assembler();
    const source = `
    Object2D: .struct
      X: .defw 0
      Y: .defw 0
      DX: .defb 1
      DY: .defb 1
    .ends

    Object2d()

    Apple: Object2D()
      X -> .defw 100
      Y -> .defw 100
    `;

    const output = compiler.compile(source);

    expect(output.errorCount).toBe(0);
  });

  it("struct allows multiple named fields", () => {
    const compiler = new Z80Assembler();
    const source = `
    Object2D: .struct
      XCoord:
      X: .defw 0
      Y: .defw 0
      DX: .defb 1
      DY: .defb 1
    .ends

    Object2d()

    Apple: Object2D()
      X -> .defw 100
      Y -> .defw 100
    `;

    const output = compiler.compile(source);

    expect(output.errorCount).toBe(0);
  });

});
