import { describe, it, expect } from "vitest";
import { testCodeEmit } from "./test-helpers";

describe("Macro - expression argument bug", () => {
  it("Expression with subtraction - labels before macro call", async () => {
    const source = `
      PrintText .macro(addr, length)
        ld de,{{addr}}
        ld bc,{{length}}
      .endm

      Hello_txt:
        .defm "hello"
      Hello_txt_end:

      PrintText(Hello_txt, Hello_txt_end - Hello_txt)
    `;

    await testCodeEmit(source, 
      0x68, 0x65, 0x6c, 0x6c, 0x6f,  // "hello"
      0x11, 0x00, 0x80,                // ld de, $8000
      0x01, 0x05, 0x00                 // ld bc, 5
    );
  });

  it("Expression with subtraction - labels after macro call (forward ref)", async () => {
    const source = `
      PrintText .macro(addr, length)
        ld de,{{addr}}
        ld bc,{{length}}
      .endm

      PrintText(Hello_txt, Hello_txt_end - Hello_txt)

      Hello_txt:
        .defm "hello"
      Hello_txt_end:
    `;

    await testCodeEmit(source, 
      0x11, 0x06, 0x80,                // ld de, $8006
      0x01, 0x05, 0x00,                 // ld bc, 5
      0x68, 0x65, 0x6c, 0x6c, 0x6f     // "hello"
    );
  });

  it("Expression with addition in macro argument", async () => {
    const source = `
      Test .macro(val)
        ld a,{{val}}
      .endm

      Test(5 + 3)
    `;

    await testCodeEmit(source, 0x3e, 0x08);
  });

  it("Complex expression in macro argument", async () => {
    const source = `
      Test .macro(val)
        ld a,{{val}}
      .endm

      Test([(10 + 5) * 2])
    `;

    await testCodeEmit(source, 0x3e, 0x1e); // 30
  });
});
