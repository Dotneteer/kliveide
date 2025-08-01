import { describe, it, expect } from "vitest";
import { codeRaisesError, testCodeEmit } from "./test-helpers";
import { Z80Assembler } from "@main/z80-compiler/z80-assembler";

describe("Assembler - .ifnused", async () => {
  it("ifnused - simple", async () => {
    await testCodeEmit(
      `
    .ifnused MyId 
    .endif
    `
    );
  });

  it("ifnused - compound", async () => {
    await testCodeEmit(
      `
    .ifnused MyComponent.MyId 
    .endif
    `
    );
  });

  it("ifnused - compound with global start", async () => {
    await testCodeEmit(
      `
    .ifnused ::MyComponent.MyId 
    .endif
    `
    );
  });

  it("start label", async () => {
    const compiler = new Z80Assembler();
    const source = `
    Start: .ifnused MyId
    .endif
    `;

    const output = await compiler.compile(source);

    expect(output.errorCount).toBe(0);
    expect(output.containsSymbol("Start")).toBe(true);
    expect(output.getSymbol("Start").value.value).toBe(0x8000);
  });

  it("ifnused - else", async () => {
    await testCodeEmit(
      `
    .ifnused MyId 
    .else
    .endif
    `
    );
  });

  it("ifnused - elif", async () => {
    await testCodeEmit(
      `
    .ifnused MyId 
    .elif true
    .endif
    `
    );
  });

  it("ifnused - elif - else", async () => {
    await testCodeEmit(
      `
    .ifnused MyId
    .elif true
    .else
    .endif
    `
    );
  });

  it("ifnused - multiple elif", async () => {
    await testCodeEmit(
      `
    .ifnused MyId 
    .elif true
    .elif false
    .endif
    `
    );
  });

  it("ifnused - multiple elif - else", async () => {
    await testCodeEmit(
      `
    .ifnused MyId 
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
    .ifnused MyId 
    Label: .elif true
    .endif
    `,
      "Z0503"
    );
  });

  it("hanging labeled elif fails", async () => {
    await codeRaisesError(
      `
    .ifnused MyId
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
    .ifnused MyId 
    Label: .else
    .endif
    `,
      "Z0503"
    );
  });

  it("hanging labeled else fails", async () => {
    await codeRaisesError(
      `
    .ifnused MyId
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
    .ifnused MyId
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
    .ifnused MyId
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
    .ifnused MyId 
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
    .ifnused MyId 
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
    .ifnused MyId
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
    .ifnused MyId
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
    .ifnused MyId 
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

  it("emits nothing with false condition", async () => {
    await testCodeEmit(
      `
    cond = 3
    useCond = cond
    .ifnused cond
      nop
    .endif
    `
    );
  });

  it("emits with true condition", async () => {
    await testCodeEmit(
      `
    .ifnused cond
      nop
    .endif
    `,
      0x00
    );
  });

  it("emits with true condition and else", async () => {
    await testCodeEmit(
      `
    .ifnused cond
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
    cond = 3
    usedCond = cond
    .ifnused cond
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
    useCond = cond
    .ifnused cond
      nop
    .elif cond
       nop
    .elif cond
      nop
    .endif
    `
    );
  });

  const equConditions = [
    { expr: "3", expected: 0x03 },
    { expr: "1\nuseCond = cond\n", expected: 0x04 },
    { expr: "2\nuseCond = cond\n", expected: 0x05 },
    { expr: "123\nuseCond = cond\n", expected: 0x06 }
  ];
  equConditions.forEach(tc => {
    it(`equ conditions: ${tc.expr}`, async () => {
      const source = `
    cond = ${tc.expr}
    .ifnused cond
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
    { expr: "3", expected: 0x03 },
    { expr: "1\nuseCond = cond\n", expected: 0x04 },
    { expr: "2\nuseCond = cond\n", expected: 0x05 },
    { expr: "123\nuseCond = cond\n", expected: 0x06 }
  ];
  varConditions.forEach(tc => {
    it(`var conditions: ${tc.expr}`, async () => {
      const source = `
    cond = ${tc.expr}
    .ifnused cond
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
    { expr: "3", expected: 0x3c },
    { expr: "1\nuseCond = cond\n", expected: 0x04 },
    { expr: "2\nuseCond = cond\n", expected: 0x0c },
    { expr: "123\nuseCond = cond\n", expected: 0x14 }
  ];
  labelConditions.forEach(tc => {
    it(`branch start label conditions: ${tc.expr}`, async () => {
      const source = `
    cond = ${tc.expr}
    .ifnused cond
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
    .ifnused cond
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
      .ifnused cond
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
      .ifnused cond
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
      .ifnused cond
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
      .ifnused cond
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

  it("ifused recognizes label", async () => {
    await testCodeEmit(
      `
    cond = 3
    .ifnused cond
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

  it("ifused recognizes missing label", async () => {
    await codeRaisesError(
      `
    cond = 3
    usedCond = cond
    .ifnused cond
      value = 100
    .else
    .endif
    ld hl,value
    `,
      "Z0605"
    );
  });
});
