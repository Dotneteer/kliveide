import { describe, it, expect } from "vitest";
import { codeRaisesError, testCodeEmit } from "./test-helpers";
import { Z80Assembler } from "@main/z80-compiler/z80-assembler";

describe("Assembler - .if", async () => {
  it("if - simple", async () => {
    await testCodeEmit(
      `
    .if true 
    .endif
    `
    );
  });

  it("if - label", async () => {
    const compiler = new Z80Assembler();
    const source = `
    Start: .if true 
    .endif
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.containsSymbol("Start")).toBe(true);
    expect(output.getSymbol("Start").value.value).toBe(0x8000);
  });

  it("if - else", async () => {
    await testCodeEmit(
      `
    .if true 
    .else
    .endif
    `
    );
  });

  it("if - elif", async () => {
    await testCodeEmit(
      `
    .if true 
    .elif true
    .endif
    `
    );
  });

  it("if - elif - else", async () => {
    await testCodeEmit(
      `
    .if true 
    .elif true
    .else
    .endif
    `
    );
  });

  it("if - multiple elif", async () => {
    await testCodeEmit(
      `
    .if true 
    .elif true
    .elif false
    .endif
    `
    );
  });

  it("if - multiple elif - else", async () => {
    await testCodeEmit(
      `
    .if true 
    .elif true
    .elif false
    .else
    .endif
    `
    );
  });

  it("labeled elif fails", async () => {
    await codeRaisesError(
      `
    .if true 
    Label: .elif true
    .endif
    `,
      "Z0503"
    );
  });

  it("hanging labeled elif fails", async () => {
    await codeRaisesError(
      `
    .if true 
    Label: 
      .elif true
    .endif
    `,
      "Z0503"
    );
  });

  it("labeled else fails", async () => {
    await codeRaisesError(
      `
    .if true 
    Label: .else
    .endif
    `,
      "Z0503"
    );
  });

  it("hanging labeled else fails", async () => {
    await codeRaisesError(
      `
    .if true 
    Label:
      .else
    .endif
    `,
      "Z0503"
    );
  });

  it("labeled elif - else fails", async () => {
    await codeRaisesError(
      `
    .if true 
    Label: .elif true
    .else
    .endif
    `,
      "Z0503"
    );
  });

  it("hanging labeled elif - else fails", async () => {
    await codeRaisesError(
      `
    .if true 
    Label:
      .elif true
    .else
    .endif
    `,
      "Z0503"
    );
  });

  it("multiple label issues detected", async () => {
    const compiler = new Z80Assembler();
    const source = `
    .if true 
    Label1: 
      .elif true
    Label2: .elif true
    Label3:
      .else
      .endif
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(3);
    expect(output.errors[0].errorCode === "Z0503").toBe(true);
    expect(output.errors[1].errorCode === "Z0503").toBe(true);
    expect(output.errors[2].errorCode === "Z0503").toBe(true);
  });

  it("elif - after else fails", async () => {
    await codeRaisesError(
      `
    .if true 
    .else
    .elif true
    .endif
    `,
      "Z0709"
    );
  });

  it("else - after else fails", async () => {
    await codeRaisesError(
      `
    .if true 
    .else
    .else
    .endif
    `,
      "Z0709"
    );
  });

  it("multiple elif after else", async () => {
    const compiler = new Z80Assembler();
    const source = `
    .if true 
    .else
    .elif false
    .elif false
    .endif
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(2);
    expect(output.errors[0].errorCode === "Z0709").toBe(true);
    expect(output.errors[1].errorCode === "Z0709").toBe(true);
  });

  it("multiple elif and else after else", async () => {
    const compiler = new Z80Assembler();
    const source = `
    .if true 
    .elif true
    .else
    .elif false
    .elif false
    .else
    .else
    .endif
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(4);
    expect(output.errors[0].errorCode === "Z0709").toBe(true);
    expect(output.errors[1].errorCode === "Z0709").toBe(true);
    expect(output.errors[2].errorCode === "Z0709").toBe(true);
    expect(output.errors[3].errorCode === "Z0709").toBe(true);
  });

  it("if with string condition fails", async () => {
    await codeRaisesError(
      `
    .if "cond"
    nop
    .endif
    `,
      "Z0603"
    );
  });

  it("elif with string condition fails #1", async () => {
    await codeRaisesError(
      `
    .if false
      nop
    .elif "cond"
      nop
    .endif
    `,
      "Z0603"
    );
  });

  it("elif with string condition fails #2", async () => {
    await codeRaisesError(
      `
    .if false
      nop
    .elif false
      nop
    .elif "cond"
      nop
    .endif
    `,
      "Z0603"
    );
  });

  it("emits nothing with false condition", async () => {
    await testCodeEmit(
      `
    cond = false;
    .if cond
      nop
    .endif
    `
    );
  });

  it("emits with true condition", async () => {
    await testCodeEmit(
      `
    cond = true;
    .if cond
      nop
    .endif
    `,
      0x00
    );
  });

  it("emits with true condition and else", async () => {
    await testCodeEmit(
      `
    cond = true;
    .if cond
      nop
    .else
      inc c
    .endif
    `,
      0x00
    );
  });

  it("emits with false condition and else", async () => {
    await testCodeEmit(
      `
    cond = false;
    .if cond
      nop
    .else
      inc b
    .endif
    `,
      0x04
    );
  });

  it("emits nothing with multiple false condition", async () => {
    await testCodeEmit(
      `
    cond = false;
    .if cond
      nop
    .elif cond
      nop
    .elif cond
      nop
    .endif
    `
    );
  });

  const trueConditions = [
    { expr: "0", expected: 0x00 },
    { expr: "1", expected: 0x04 },
    { expr: "2", expected: 0x0c },
    { expr: "123", expected: 0x14 }
  ];
  trueConditions.forEach(tc => {
    it(`true conditions: ${tc.expr}`, async () => {
      const source = `
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
  `;
      await testCodeEmit(source, tc.expected);
    });
  });

  const equConditions = [
    { expr: "0", expected: 0x03 },
    { expr: "1", expected: 0x04 },
    { expr: "2", expected: 0x05 },
    { expr: "123", expected: 0x06 }
  ];
  equConditions.forEach(tc => {
    it(`equ conditions: ${tc.expr}`, async () => {
      const source = `
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
    `;
      await testCodeEmit(source, tc.expected);
    });
  });

  const varConditions = [
    { expr: "0", expected: 0x03 },
    { expr: "1", expected: 0x04 },
    { expr: "2", expected: 0x05 },
    { expr: "123", expected: 0x06 }
  ];
  varConditions.forEach(tc => {
    it(`var conditions: ${tc.expr}`, async () => {
      const source = `
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
    `;
      await testCodeEmit(source, tc.expected);
    });
  });

  const labelConditions = [
    { expr: "0", expected: 0x3c },
    { expr: "1", expected: 0x04 },
    { expr: "2", expected: 0x0c },
    { expr: "123", expected: 0x14 }
  ];
  labelConditions.forEach(tc => {
    it(`branch start label conditions: ${tc.expr}`, async () => {
      const source = `
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
    `;
      await testCodeEmit(source, 0x00, tc.expected, 0x01, 0x00, 0x80);
    });
  });

  labelConditions.forEach(tc => {
    it(`branch start hanging label conditions: ${tc.expr}`, async () => {
      const source = `
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
    `;
      await testCodeEmit(source, 0x00, tc.expected, 0x01, 0x00, 0x80);
    });
  });

  labelConditions.forEach(tc => {
    it(`branch middle label conditions: ${tc.expr}`, async () => {
      const source = `
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
    `;
      await testCodeEmit(source, 0x00, tc.expected, 0x01, 0x01, 0x80);
    });
  });

  labelConditions.forEach(tc => {
    it(`branch middle hanging label conditions: ${tc.expr}`, async () => {
      const source = `
      cond = ${tc.expr}
      .if cond == 0
        nop
      Label:
        inc a
        ld bc,Label
      .elif cond == 1
        nop
      Label:
        inc b
        ld bc,Label
      .elif cond == 2
        nop
      Label:
        inc c
        ld bc,Label
      .else
        nop
      Label:
        inc d
        ld bc,Label
      .endif
    `;
      await testCodeEmit(source, 0x00, tc.expected, 0x01, 0x01, 0x80);
    });
  });

  labelConditions.forEach(tc => {
    it(`branch end label conditions: ${tc.expr}`, async () => {
      const source = `
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
    `;
      await testCodeEmit(source, 0x00, tc.expected, 0x01, 0x02, 0x80);
    });
  });

  labelConditions.forEach(tc => {
    it(`branch end hanging label conditions: ${tc.expr}`, async () => {
      const source = `
      cond = ${tc.expr}
      .if cond == 0
        nop
        inc a
      Label:
        ld bc,Label
      .elif cond == 1
        nop
        inc b
      Label:
        ld bc,Label
      .elif cond == 2
        nop
        inc c
      Label:
        ld bc,Label
      .else
        nop
        inc d
      Label:
        ld bc,Label
      .endif
    `;
      await testCodeEmit(source, 0x00, tc.expected, 0x01, 0x02, 0x80);
    });
  });

  it("if recognizes label", async () => {
    await testCodeEmit(
      `
    .if true
      value = 100
    .else
    .endif
    ld hl,value
    `,
      0x21,
      0x64,
      0x00
    );
  });

  it("if recognizes missing label", async () => {
    await codeRaisesError(
      `
    .if false
      value = 100
    .else
    .endif
    ld hl,value
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
    { row: 123, col: 123, expected: 0x0b }
  ];
  nestedConditions.forEach(tc => {
    it(`branch start label conditions: ${tc.row}/${tc.col}`, async () => {
      const source = `
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
    `;
      await testCodeEmit(source, tc.expected);
    });
  });
});
