import "mocha";

import { codeRaisesError, testCodeEmit } from "./test-helpers";

describe("Assembler - .break", async () => {
  it("break - fails in global scope", async () => {
    await codeRaisesError(
      `
      ld a,b
      .break
    `,
      "Z0707"
    );
  });

  it("break - fails in non-loop scope", async () => {
    await codeRaisesError(
      `
    ld a,b
    .if true
      .break
    .endif
    `,
      "Z0707"
    );
  });

  it("break - in loop scope", async () => {
    await testCodeEmit(
      `
    ld a,b
    .loop 3
        .break
    .endl
    `,
      0x78
    );
  });

  it("break - in repeat scope", async () => {
    await testCodeEmit(
      `
    ld a,b
    .repeat
        .break
    .until true
    `,
      0x78
    );
  });

  it("break - in while scope", async () => {
    await testCodeEmit(
      `
    ld a,b
    exit = false
    .while !exit
        .break
        exit = true;
    .endw
    `,
      0x78
    );
  });

  it("break - in for scope", async () => {
    await testCodeEmit(
      `
    ld a,b
    .for _i = 0 .to 3
        .break
    .next
    `,
      0x78
    );
  });

  it("emit - with loop", async () => {
    await testCodeEmit(
      `
    .loop 5
      .if $cnt == 4
        .break
      .endif
      .db $cnt
    .endl
    `,
      0x01,
      0x02,
      0x03
    );
  });

  it("emit - with repeat", async () => {
    await testCodeEmit(
      `
    .repeat
      .if $cnt == 4
        .break
      .endif
      .db $cnt
    .until $cnt == 5
    `,
      0x01,
      0x02,
      0x03
    );
  });

  it("emit - with while", async () => {
    await testCodeEmit(
      `
    .while $cnt < 5
      .if $cnt == 4
        .break
      .endif
      .db $cnt
    .endw
    `,
      0x01,
      0x02,
      0x03
    );
  });

  it("emit - with for", async () => {
    await testCodeEmit(
      `
    .for value = 1 to 5
      .if value == 4
        .break
      .endif
      .db value
    .next
    `,
      0x01,
      0x02,
      0x03
    );
  });

  it("emit - with nested loop", async () => {
    await testCodeEmit(
      `
    .loop 2
      ld bc,#1234
      .loop 3
          inc a
          .if $cnt == 2
            .break;
          .endif
          nop
      .endl
    .endl
    `,
      0x01,
      0x34,
      0x12,
      0x3c,
      0x00,
      0x3c,
      0x01,
      0x34,
      0x12,
      0x3c,
      0x00,
      0x3c
    );
  });

  it("emit - with nested repeat", async () => {
    await testCodeEmit(
      `
    .loop 2
      ld bc,#1234
      counter = 0
      .repeat
        inc a
        .if $cnt == 2
          .break;
        .endif
        nop
        counter = counter + 1
      .until counter == 3
    .endl
    `,
      0x01,
      0x34,
      0x12,
      0x3c,
      0x00,
      0x3c,
      0x01,
      0x34,
      0x12,
      0x3c,
      0x00,
      0x3c
    );
  });

  it("emit - with nested while", async () => {
    await testCodeEmit(
      `
    .loop 2
      ld bc,#1234
      counter = 0
      .while counter < 3
        inc a
        .if $cnt == 2
          .break;
        .endif
        nop
        counter = counter + 1
      .endw
    .endl
    `,
      0x01,
      0x34,
      0x12,
      0x3c,
      0x00,
      0x3c,
      0x01,
      0x34,
      0x12,
      0x3c,
      0x00,
      0x3c
    );
  });

  it("emit - with nested for", async () => {
    await testCodeEmit(
      `
    .loop 2
      ld bc,#1234
      .for _i = 1 to 3
        inc a
        .if $cnt == 2
          .break;
        .endif
        nop
      .next
    .endl
    `,
      0x01,
      0x34,
      0x12,
      0x3c,
      0x00,
      0x3c,
      0x01,
      0x34,
      0x12,
      0x3c,
      0x00,
      0x3c
    );
  });

  it("Experiment", async () => {
    const lineText = "aaa {{a}}, {{ab}}, {{abc}}, {{de}}"; 
    const replacements: any = {
      a: "_A$A_",
      ab: "_AB$AB_",
      abc: "_ABC$ABC_",
      de: "_DE$DE_"
    };
    let newText = lineText;
    const regExpr = /{{\s*([_a-zA-Z][_a-zA-Z0-9]*)\s*}}/g;
    let myStr: RegExpExecArray;
    while ((myStr = regExpr.exec(lineText)) !== null) {
      const toReplace = myStr[0];
      const argName = myStr[1];
      if (replacements[argName]) {
        newText = newText.replace(toReplace, replacements[argName]);
      }
    }
  });
});
