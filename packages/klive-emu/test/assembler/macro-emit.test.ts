import "mocha";
import { codeRaisesError, testCodeEmit } from "./test-helpers";

describe("Assembler - macro emit", () => {
  it("fails with unknown name", () => {
    codeRaisesError(
      `
      MyMacro()
      `,
      "Z1007"
    );
  });

  it("works with known name", () => {
    testCodeEmit(
      `
      MyMacro: .macro()
        nop
      .endm
      MyMacro()
    `,
      0x00
    );
  });

  it("works with known name and arguments", () => {
    testCodeEmit(
      `
      MyMacro: .macro(first, second)
        nop
      .endm
      MyMacro(1, 2)
    `,
      0x00
    );
  });

  it("works with less arguments #1", () => {
    testCodeEmit(
      `
      MyMacro: .macro(first, second)
        nop
      .endm
      MyMacro(1)
    `,
      0x00
    );
  });

  it("works with less arguments #2", () => {
    testCodeEmit(
      `
      MyMacro: .macro(first)
        nop
      .endm
      MyMacro()
    `,
      0x00
    );
  });

  it("fails with more arguments", () => {
    codeRaisesError(
      `
      MyMacro: .macro(first)
        nop
        .endm
      MyMacro(12, 13)
      `,
      "Z1008"
    );
  });

  it("works with equ", () => {
    testCodeEmit(
      `
      MyMacro: .macro(first)
        nop
        .endm
      value .equ 123
      MyMacro(value)
    `,
      0x00
    );
  });

  it("works with late binding", () => {
    testCodeEmit(
      `
      MyMacro: .macro(first)
        nop
        .endm
      MyMacro(value)
      value .equ 123
      `,
      0x00
    );
  });

  it("fails with evaluation error #1", () => {
    codeRaisesError(
      `
      MyMacro: .macro(first)
        nop
        .endm
      value .equ 0
      MyMacro(1/value)
      `,
      "Z1012", "Z0606"
    );
  });

  it("works with multiple late binding #1", () => {
    testCodeEmit(
      `
      MyMacro: .macro(first, second)
        nop
        .endm
      value .equ 123
      MyMacro(value, value + 2)
      `,
      0x00
    );
  });

  it("works with multiple late binding #2", () => {
    testCodeEmit(
      `
      MyMacro: .macro(first, second)
        nop
        .endm
      MyMacro(value, value + 2)
      value .equ 123
      `,
      0x00
    );
  });

  it("simple emit", () => {
    testCodeEmit(
      `
      Simple: .macro()
        nop
        ld a,b
        nop
      .endm
      Simple()
      `,
      0x00,
      0x78,
      0x00
    );
  });

  it("simple emit - internal label", () => {
    testCodeEmit(
      `
      Simple: .macro()
        ThisLabel: ld bc,ThisLabel
      .endm
      Simple()
      `,
      0x01,
      0x00,
      0x80
    );
  });

  it("multiple emit - internal label", () => {
    testCodeEmit(
      `
      Simple: .macro()
        ThisLabel: ld bc,ThisLabel
      .endm
      Simple()
      Simple()
      `,
      0x01,
      0x00,
      0x80,
      0x01,
      0x03,
      0x80
    );
  });

  it("multiple emit - internal label, fixup", () => {
    testCodeEmit(
      `
      Simple: .macro()
        ld bc,ThisLabel
        ThisLabel: nop
      .endm
      Simple()
      Simple()
      `,
      0x01,
      0x03,
      0x80,
      0x00,
      0x01,
      0x07,
      0x80,
      0x00
    );
  });

  it("macro with start label", () => {
    testCodeEmit(
      `
      Simple: .macro()
        ld bc,Simple
        nop
      .endm
      Simple()
      Simple()
      `,
      0x01,
      0x00,
      0x80,
      0x00,
      0x01,
      0x04,
      0x80,
      0x00
    );
  });

  it("macro with end label", () => {
    testCodeEmit(
      `
      Simple: .macro()
        ld bc,EndLabel
        nop
      EndLabel: .endm
      Simple()
      Simple()
      `,
      0x01,
      0x04,
      0x80,
      0x00,
      0x01,
      0x08,
      0x80,
      0x00
    );
  });

  it("macro with external fixup label #1", () => {
    testCodeEmit(
      `
      Simple: .macro()
        ld bc,OuterLabel
        nop
      .endm
      Simple()
      Simple()
      OuterLabel: nop
      `,
      0x01,
      0x08,
      0x80,
      0x00,
      0x01,
      0x08,
      0x80,
      0x00,
      0x00
    );
  });

  it("macro with external fixup label #2", () => {
    testCodeEmit(
      `
      Simple: .macro()
        ld bc,OuterLabel
        nop
      .endm
      OuterLabel: nop
      Simple()
      Simple()
      `,
      0x00,
      0x01,
      0x00,
      0x80,
      0x00,
      0x01,
      0x00,
      0x80,
      0x00
    );
  });

  it("macro nested loop #1", () => {
    testCodeEmit(
      `
      Simple: .macro()
        ld bc,#1234
        .loop 3
          inc a
        .endl
        .endm
      Simple()
      Simple()
      `,
      0x01,
      0x34,
      0x12,
      0x3c,
      0x3c,
      0x3c,
      0x01,
      0x34,
      0x12,
      0x3c,
      0x3c,
      0x3c
    );
  });

  it("macro nested loop #2", () => {
    testCodeEmit(
      `
      Simple: .macro()
        inc a
        .loop 2
          ld hl,EndLabel
          ld bc,NopLabel
      EndLabel: .endl
      NopLabel: nop
        .endm
      Simple()
      `,
      0x3c,
      0x21,
      0x07,
      0x80,
      0x01,
      0x0d,
      0x80,
      0x21,
      0x0d,
      0x80,
      0x01,
      0x0d,
      0x80,
      0x00
    );
  });

  it("macro nested loop #3", () => {
    testCodeEmit(
      `
      Simple: .macro()
        inc a
        .loop 2
          ld hl,EndLabel
          ld bc,NopLabel
        EndLabel: 
        nop
        .endl
      NopLabel: nop
        .endm
      Simple()
      `,
      0x3c,
      0x21,
      0x07,
      0x80,
      0x01,
      0x0f,
      0x80,
      0x00,
      0x21,
      0x0e,
      0x80,
      0x01,
      0x0f,
      0x80,
      0x00,
      0x00
    );
  });

  it("macro nested loop #4", () => {
    testCodeEmit(
      `
      Simple: .macro()
        index = 1;
        .loop 2
          ld a,index
          index = index + 1
          nop
        .endl
        .endm
      Simple()
      `,
      0x3e,
      0x01,
      0x00,
      0x3e,
      0x02,
      0x00
    );
  });

  it("macro nested loop #5", () => {
    testCodeEmit(
      `
      Simple: .macro()
        index = 1;
        .loop 2
          index = 5
          ld a,index
          index := index + 1
          nop
      EndLabel: .endl
        .endm
      Simple()
      `,
      0x3e,
      0x05,
      0x00,
      0x3e,
      0x05,
      0x00
    );
  });

  it("macro nested loop #6", () => {
    testCodeEmit(
      `
      Simple: .macro()
        .loop 3
          .db $cnt
        .endl
      .endm
      Simple()
      Simple()
      `,
      0x01,
      0x02,
      0x03,
      0x01,
      0x02,
      0x03
    );
  });

  it("macro nested repeat #1", () => {
    testCodeEmit(
      `
      Simple: .macro()
        counter = 0
        .repeat
          ld bc,#1234
          counter = counter + 1
        .until counter == 2
      .endm
      Simple()
      `,
      0x01,
      0x34,
      0x12,
      0x01,
      0x34,
      0x12
    );
  });

  it("macro nested repeat #2", () => {
    testCodeEmit(
      `
      Simple: .macro()
        counter = 0
        .repeat
          inc b
          inc c
          inc d
          counter = counter + 1
        .until counter == 2
      .endm
      Simple()
      `,
      0x04,
      0x0c,
      0x14,
      0x04,
      0x0c,
      0x14
    );
  });

  it("macro nested repeat #3", () => {
    testCodeEmit(
      `
      Simple: .macro()
        counter = 3
        .repeat
          inc b
          inc c
          inc d
          counter = counter + 1
        .until counter == 5
      .endm
      Simple()
      `,
      0x04,
      0x0c,
      0x14,
      0x04,
      0x0c,
      0x14
    );
  });

  it("macro nested repeat #4", () => {
    testCodeEmit(
      `
      Simple: .macro()
        counter = 0
        .repeat
        ThisLabel: ld bc,ThisLabel
        counter = counter + 1
        .until counter == 2
      .endm
      Simple()
      `,
      0x01,
      0x00,
      0x80,
      0x01,
      0x03,
      0x80
    );
  });

  it("macro nested repeat #5", () => {
    testCodeEmit(
      `
      Simple: .macro()
        counter = 0
        .repeat
          ld bc,ThisLabel
          ThisLabel: nop
          counter = counter + 1
        .until counter == 2
      .endm
      Simple()
      `,
      0x01,
      0x03,
      0x80,
      0x00,
      0x01,
      0x07,
      0x80,
      0x00
    );
  });

  it("macro nested repeat #6", () => {
    testCodeEmit(
      `
      Simple: .macro()
        counter = 0
        StartLabel: .repeat
          ld bc,StartLabel
          nop
          counter = counter + 1
        .until counter == 2
      .endm
      Simple()
      `,
      0x01,
      0x00,
      0x80,
      0x00,
      0x01,
      0x00,
      0x80,
      0x00
    );
  });

  it("macro nested repeat #7", () => {
    testCodeEmit(
      `
      Simple: .macro()
        counter = 0
        .repeat
          ld bc,EndLabel
          nop
          counter = counter + 1
        EndLabel .until counter == 2
      .endm
      Simple()
      `,
      0x01,
      0x04,
      0x80,
      0x00,
      0x01,
      0x08,
      0x80,
      0x00
    );
  });

  it("macro nested repeat #8", () => {
    testCodeEmit(
      `
      Simple: .macro()
        counter = 0
        .repeat
          ld bc,OuterLabel
          nop
          counter = counter + 1
          .until counter == 2
        .endm
      OuterLabel: nop
      Simple()
      `,
      0x00,
      0x01,
      0x00,
      0x80,
      0x00,
      0x01,
      0x00,
      0x80,
      0x00
    );
  });

  it("macro nested repeat #9", () => {
    testCodeEmit(
      `
      Simple: .macro()
        counter = 0
        .repeat
          ld bc,OuterLabel
          nop
          counter = counter + 1
        .until counter == 2
      .endm
      Simple()
      OuterLabel: nop
      `,
      0x01,
      0x08,
      0x80,
      0x00,
      0x01,
      0x08,
      0x80,
      0x00,
      0x00
    );
  });

  it("macro nested repeat/loop #1", () => {
    testCodeEmit(
      `
      Simple: .macro()
        counter = 0
        .repeat
          ld bc,#1234
          .loop 3
            inc a
          .endl
          counter = counter + 1
        .until counter == 2
      .endm
      Simple()
      `,
      0x01,
      0x34,
      0x12,
      0x3c,
      0x3c,
      0x3c,
      0x01,
      0x34,
      0x12,
      0x3c,
      0x3c,
      0x3c
    );
  });

  it("macro nested repeat #10", () => {
    testCodeEmit(
      `
      Simple: .macro()
        counter = 0
        .repeat
          .db $cnt
          counter = counter + 1
        .until counter == 3
      .endm
      Simple()
      Simple()
      `,
      0x01,
      0x02,
      0x03,
      0x01,
      0x02,
      0x03
    );
  });

  it("macro nested while #1", () => {
    testCodeEmit(
      `
      Simple: .macro()
        counter = 0
        .while counter < 2
          ld bc,#1234
          counter = counter + 1
        .wend
      .endm
      Simple()
      `,
      0x01,
      0x34,
      0x12,
      0x01,
      0x34,
      0x12
    );
  });

  it("macro nested while #2", () => {
    testCodeEmit(
      `
      Simple: .macro()
        counter = 0
        .while counter < 2
          inc b
          inc c
          inc d
          counter = counter + 1
        .wend
      .endm
      Simple()
      `,
      0x04,
      0x0c,
      0x14,
      0x04,
      0x0c,
      0x14
    );
  });

  it("macro nested while #3", () => {
    testCodeEmit(
      `
      Simple: .macro()
        counter = 0
        .while counter < 2
        ThisLabel: ld bc,ThisLabel
        counter = counter + 1
        .wend
      .endm
      Simple()
      `,
      0x01,
      0x00,
      0x80,
      0x01,
      0x03,
      0x80
    );
  });

  it("macro nested while #4", () => {
    testCodeEmit(
      `
      Simple: .macro()
        counter = 0
        .while counter < 2
          ld bc,ThisLabel
          ThisLabel: nop
          counter = counter + 1
        .wend
      .endm
      Simple()
      `,
      0x01,
      0x03,
      0x80,
      0x00,
      0x01,
      0x07,
      0x80,
      0x00
    );
  });

  it("macro nested while #5", () => {
    testCodeEmit(
      `
      Simple: .macro()
        counter = 0
        StartLabel: .while counter < 2
          ld bc,StartLabel
          nop
          counter = counter + 1
        .wend
      .endm
      Simple()
      `,
      0x01,
      0x00,
      0x80,
      0x00,
      0x01,
      0x00,
      0x80,
      0x00
    );
  });

  it("macro nested while #6", () => {
    testCodeEmit(
      `
      Simple: .macro()
        counter = 0
        .while counter < 2
          ld bc,EndLabel
          nop
          counter = counter + 1
        EndLabel .wend
      .endm
      Simple()
      `,
      0x01,
      0x04,
      0x80,
      0x00,
      0x01,
      0x08,
      0x80,
      0x00
    );
  });

  it("macro nested while #7", () => {
    testCodeEmit(
      `
      Simple: .macro()
        counter = 0
        .while counter < 2
          ld bc,OuterLabel
          nop
          counter = counter + 1
        .wend
      .endm
      Simple()
      OuterLabel: nop
      `,
      0x01,
      0x08,
      0x80,
      0x00,
      0x01,
      0x08,
      0x80,
      0x00,
      0x00
    );
  });

  it("macro nested while #8", () => {
    testCodeEmit(
      `
      Simple: .macro()
        counter = 0
        .while counter < 2
          ld bc,OuterLabel
          nop
          counter = counter + 1
        .wend
      .endm
      OuterLabel: nop
      Simple()
      `,
      0x00,
      0x01,
      0x00,
      0x80,
      0x00,
      0x01,
      0x00,
      0x80,
      0x00
    );
  });

  it("macro nested while #9", () => {
    testCodeEmit(
      `
      Simple: .macro()
        counter = 0;
        .while counter < 3
          .db $cnt
          counter = counter + 1                    
       .endw
      .endm
      Simple()
      Simple()
      `,
      0x01,
      0x02,
      0x03,
      0x01,
      0x02,
      0x03
    );
  });

  it("macro nested for #1", () => {
    testCodeEmit(
      `
      Simple: .macro()
        .for _i = 1 .to 2
          ld bc,#1234
        .next
      .endm
      Simple()
      `,
      0x01,
      0x34,
      0x12,
      0x01,
      0x34,
      0x12
    );
  });

  it("macro nested for #2", () => {
    testCodeEmit(
      `
      Simple: .macro()
        .for _i = 1 .to 2
          inc b
          inc c
          inc d
        .next
      .endm
      Simple()
      `,
      0x04,
      0x0c,
      0x14,
      0x04,
      0x0c,
      0x14
    );
  });

  it("macro nested for #3", () => {
    testCodeEmit(
      `
      Simple: .macro()
        .for _i = 2 .to 1 step -1
          inc b
          inc c
          inc d
        .next
      .endm
      Simple()
      `,
      0x04,
      0x0c,
      0x14,
      0x04,
      0x0c,
      0x14
    );
  });

  it("macro nested for #4", () => {
    testCodeEmit(
      `
      Simple: .macro()
        .for _i = 1 .to 2
        ThisLabel: ld bc,ThisLabel
        .next
      .endm
      Simple()
      `,
      0x01,
      0x00,
      0x80,
      0x01,
      0x03,
      0x80
    );
  });

  it("macro nested for #5", () => {
    testCodeEmit(
      `
      Simple: .macro()
        .for _i = 2 .to 1 step -1
          ld bc,ThisLabel
          ThisLabel: nop
        .next
      .endm
      Simple()
      `,
      0x01,
      0x03,
      0x80,
      0x00,
      0x01,
      0x07,
      0x80,
      0x00
    );
  });

  it("macro nested for #6", () => {
    testCodeEmit(
      `
      Simple: .macro()
        StartLabel: .for _i = 1 to 2
          ld bc,StartLabel
          nop
        .next
      .endm
      Simple()
      `,
      0x01,
      0x00,
      0x80,
      0x00,
      0x01,
      0x00,
      0x80,
      0x00
    );
  });

  it("macro nested for #7", () => {
    testCodeEmit(
      `
      Simple: .macro()
        .for _i = 1 .to 2
          ld bc,EndLabel
          nop
        EndLabel: .next
        .endm
      Simple()
      `,
      0x01,
      0x04,
      0x80,
      0x00,
      0x01,
      0x08,
      0x80,
      0x00
    );
  });

  it("macro nested for #8", () => {
    testCodeEmit(
      `
      Simple: .macro()
        .for _i = 2 to 1 step -1
          ld bc,OuterLabel
          nop
        .next
      .endm
      Simple()
      OuterLabel: nop
      `,
      0x01,
      0x08,
      0x80,
      0x00,
      0x01,
      0x08,
      0x80,
      0x00,
      0x00
    );
  });

  it("macro nested for #9", () => {
    testCodeEmit(
      `
      Simple: .macro()
        .for _i = 2 to 1 step -1
          ld bc,OuterLabel
          nop
        .next
      .endm
      OuterLabel: nop
      Simple()
      `,
      0x00,
      0x01,
      0x00,
      0x80,
      0x00,
      0x01,
      0x00,
      0x80,
      0x00
    );
  });

  it("macro nested for #10", () => {
    testCodeEmit(
      `
      Simple: .macro()
        .for _i = 6 to 8
          .db $cnt
        .next
      .endm
      Simple()
      Simple()
      `,
      0x01,
      0x02,
      0x03,
      0x01,
      0x02,
      0x03
    );
  });

  it("macro nested for #11", () => {
    testCodeEmit(
      `
      Simple: .macro()
        .for _i = 6 to 8
          .db _i
        .next
      .endm
      Simple()
      Simple()
      `,
      0x06,
      0x07,
      0x08,
      0x06,
      0x07,
      0x08
    );
  });

  it("multiple macros", () => {
    testCodeEmit(
      `
      Simple1: .macro()
        .db #01
      .endm
      Simple2: .macro()
        .db #02
      .endm
      Simple3: .macro()
        .db #03
      .endm
      Simple2()
      Simple1()
      Simple3()
      Simple1()
      Simple2()
      `,
      0x02,
      0x01,
      0x03,
      0x01,
      0x02
    );
  });

  it("macro nested if #1", () => {
    testCodeEmit(
      `
      Simple: .macro()
        cond = false;
        .if cond
          nop
        .endif
      .endm
      Simple()
      `
    );
  });

  it("macro nested if #2", () => {
    testCodeEmit(
      `
      Simple: .macro()
        cond = true;
        .if cond
          nop
        .endif
      .endm
      Simple()
      `,
      0x00
    );
  });

  it("macro nested if #3", () => {
    testCodeEmit(
      `
      Simple: .macro()
        cond = true;
        .if cond
          nop
        .else
          inc c
        .endif
      .endm
      Simple()
      `,
      0x00
    );
  });

  it("macro nested if #4", () => {
    testCodeEmit(
      `
      Simple: .macro()
        cond = false;
        .if cond
          nop
        .else
          inc b
        .endif
      .endm
      Simple()
      `,
      0x04
    );
  });

  it("macro nested if #5", () => {
    testCodeEmit(
      `
      Simple: .macro()
        cond = false;
        .if cond
          nop
        .elif cond
          nop
        .elif cond
          nop
         .endif
      .endm
      Simple()
      `
    );
  });

  const trueConditions = [
    { expr: "0", expected: 0x00 },
    { expr: "1", expected: 0x04 },
    { expr: "2", expected: 0x0c },
    { expr: "123", expected: 0x14 },
  ];
  trueConditions.forEach((tc) => {
    it(`macro if true conditions: ${tc.expr}`, () => {
      const source = `
      Simple: .macro()
        cond = ${tc.expr}
        .if cond == 0
          nop
        .elif cond == 1
          inc b
        .elif cond == 2
          inc c
        .else
          inc d
        .endif
      .endm
      Simple()
    `;
      testCodeEmit(source, tc.expected);
    });
  });

  const equConditions = [
    { expr: "0", expected: 0x03 },
    { expr: "1", expected: 0x04 },
    { expr: "2", expected: 0x05 },
    { expr: "123", expected: 0x06 },
  ];
  equConditions.forEach((tc) => {
    it(`macro if equ conditions: ${tc.expr}`, () => {
      const source = `
      Simple: .macro()
        cond = ${tc.expr}
        .if cond == 0
          value .equ 3
        .elif cond == 1
          value .equ 4
        .elif cond == 2
          value .equ 5
        .else
          value .equ 6
        .endif
        .db value
      .endm
      Simple()
    `;
      testCodeEmit(source, tc.expected);
    });
  });

  equConditions.forEach((tc) => {
    it(`macro if var conditions: ${tc.expr}`, () => {
      const source = `
      Simple: .macro()
        cond = ${tc.expr}
        value = 0
        .if cond == 0
          value = 3
        .elif cond == 1
          value = 4
        .elif cond == 2
          value = 5
        .else
          value = 6
        .endif
          .db value
      .endm
      Simple()
    `;
      testCodeEmit(source, tc.expected);
    });
  });

  const labelConditions = [
    { expr: "0", expected: 0x3c },
    { expr: "1", expected: 0x04 },
    { expr: "2", expected: 0x0c },
    { expr: "123", expected: 0x14 },
  ];
  labelConditions.forEach((tc) => {
    it(`macro if branch: ${tc.expr}`, () => {
      const source = `
      Simple: .macro()
        cond = ${tc.expr}
        .if cond == 0
          Label: nop
          inc a
          ld bc,Label
        .elif cond == 1
          Label: nop
          inc b
          ld bc,Label
        .elif cond == 2
          Label: nop
          inc c
          ld bc,Label
        .else
          Label: nop
          inc d
          ld bc,Label
        .endif
      .endm
      Simple()
    `;
      testCodeEmit(source, 0x00, tc.expected, 0x01, 0x00, 0x80);
    });
  });

  labelConditions.forEach((tc) => {
    it(`macro if branch with hanging labels: ${tc.expr}`, () => {
      const source = `
      Simple: .macro()
        cond = ${tc.expr}
        .if cond == 0
          Label: 
          nop
          inc a
          ld bc,Label
        .elif cond == 1
          Label: 
          nop
          inc b
          ld bc,Label
        .elif cond == 2
          Label: 
          nop
          inc c
          ld bc,Label
        .else
          Label: 
          nop
          inc d
          ld bc,Label
        .endif
      .endm
      Simple()
    `;
      testCodeEmit(source, 0x00, tc.expected, 0x01, 0x00, 0x80);
    });
  });

  labelConditions.forEach((tc) => {
    it(`macro if branch with middle labels: ${tc.expr}`, () => {
      const source = `
      Simple: .macro()
        cond = ${tc.expr}
        .if cond == 0
          nop
          Label: inc a
          ld bc,Label
        .elif cond == 1
          nop
          Label: inc b
          ld bc,Label
        .elif cond == 2
          nop
          Label: inc c
          ld bc,Label
        .else
          nop
          Label: inc d
          ld bc,Label
        .endif
      .endm
      Simple()
    `;
      testCodeEmit(source, 0x00, tc.expected, 0x01, 0x01, 0x80);
    });
  });

  labelConditions.forEach((tc) => {
    it(`macro if branch with end labels: ${tc.expr}`, () => {
      const source = `
      Simple: .macro()
        cond = ${tc.expr}
        .if cond == 0
          nop
          inc a
          Label: ld bc,Label
        .elif cond == 1
          nop
          inc b
          Label: ld bc,Label
        .elif cond == 2
          nop
          inc c
          Label: ld bc,Label
        .else
          nop
          inc d
          Label: ld bc,Label
        .endif
      .endm
      Simple()
    `;
      testCodeEmit(source, 0x00, tc.expected, 0x01, 0x02, 0x80);
    });
  });

  it("macro nested if #6", () => {
    testCodeEmit(
      `
      Simple: .macro()
        .if true
          value = 100
        .else
        .endif
        ld hl,value
      .endm
      Simple()
      `,
      0x21,
      0x64,
      0x00
    );
  });

  it("fails with missing label", () => {
    codeRaisesError(
      `
      Simple: .macro()
        .if false
          value = 100
        .else
        .endif
        ld hl,value
      .endm
      Simple()
      `,
      "Z0605"
    );
  });

  const nestedConditions = [
    { row: 0, col: 0, expected: 0x00 },
    { row: 0, col: 1, expected: 0x01 },
    { row: 0, col: 5, expected: 0x02 },
    { row: 1, col: 0, expected: 0x03 },
    { row: 1, col: 1, expected: 0x04 },
    { row: 1, col: 100, expected: 0x05 },
    { row: 2, col: 0, expected: 0x06 },
    { row: 2, col: 1, expected: 0x07 },
    { row: 2, col: 123, expected: 0x08 },
    { row: 123, col: 0, expected: 0x09 },
    { row: 123, col: 1, expected: 0x0a },
    { row: 123, col: 123, expected: 0x0b },
  ];
  nestedConditions.forEach((tc) => {
    it(`macro nested if branches: ${tc.row}/${tc.col}`, () => {
      const source = `
      Simple: .macro()
        row = ${tc.row}
        col = ${tc.col}
        .if row == 0
          .if col == 0
            .db #00
          .elif col == 1
            .db #01
          .else
            .db #02
          .endif
        .elif row == 1
          .if col == 0
            .db #03
          .elif col == 1
            .db #04
          .else
            .db #05
          .endif
        .elif row == 2
          .if col == 0
            .db #06
          .elif col == 1
            .db #07
          .else
            .db #08
          .endif
        .else
          .if col == 0
            .db #09
          .elif col == 1
            .db #0A
          .else
            .db #0B
          .endif
        .endif
      .endm
      Simple()
    `;
      testCodeEmit(source, tc.expected);
    });
  });

  it("Unpassed argument #1", () => {
    testCodeEmit(
      `
      Simple: .macro(arg1, arg2)
        .if def({{arg1}})
          ld a,b
        .endif
        .if def({{arg2}})
          ld b,a
        .endif
      .endm
      Simple()
      Simple(12)
      Simple(12, 13)
      Simple("", 13)
      `,
      0x78,
      0x78,
      0x47,
      0x47
    );
  });

  it("Unpassed argument #2", () => {
    testCodeEmit(
      `
      Simple: .macro(arg1, arg2)
        .if def({{arg1}})
          ld a,b
        .endif
        .if def({{arg2}})
          ld b,a
        .endif
      .endm
      Simple(, 13)
      Simple(12)
      `,
      0x47,
      0x78
    );
  });

  it("Unpassed argument #3", () => {
    testCodeEmit(
      `
      LdBcDeHl:
        .macro(bcVal, deVal, hlVal)
          .if def({{bcVal}})
            ld bc,{{bcVal}}
          .endif
          .if def({{deVal}})
            ld de,{{deVal}}
          .endif
          .if def({{hlVal}})
            ld hl,{{hlVal}}
          .endif
        .endm
      LdBcDeHl(,#1000, #2000)
      `,
      0x11,
      0x00,
      0x10,
      0x21,
      0x00,
      0x20
    );
  });

  it("fails with macro parameter in argument", () => {
    codeRaisesError(
      `
      Simple: 
      .macro(arg1, arg2)
        {{arg2}}
      .endm
      Simple(c, "ld a,{{arg1}}")
      `,
      "Z1012", "Z1010"
    );
  });

  it("Macro in macro", () => {
    testCodeEmit(
      `
      LdHl:
        .macro(value)
          ld hl,{{value}}    
        .endm

      LdHl2:
        .macro(value1, value2)
          LdHl({{value1}})
          LdHl({{value2}})
        .endm

      LdHl2(2,3)
      `,
      0x21,
      0x02,
      0x00,
      0x21,
      0x03,
      0x00
    );
  });
});
