/**
 * Tests for "$" (current address) in Z80 instructions.
 *
 * "$" must always evaluate to the address of the FIRST byte of the
 * current instruction, regardless of how many opcode-prefix bytes have
 * already been emitted by the time the expression operand is processed.
 */
import { describe, it } from "vitest";
import { testCodeEmit } from "./test-helpers";

describe("Assembler - $ (current address) in instructions", async () => {
  // -------------------------------------------------------------------------
  // jp $
  // -------------------------------------------------------------------------

  it("jp $: points to first byte of jp instruction (default start 0x8000)", async () => {
    // jp $ → jp to 0x8000 → 0xC3 0x00 0x80
    await testCodeEmit("jp $", 0xC3, 0x00, 0x80);
  });

  it("jp $: points to first byte of jp instruction (org #0000)", async () => {
    await testCodeEmit(
      `
      .org #0000
      jp $
      `,
      0xC3,
      0x00,
      0x00
    );
  });

  it("jp $: points to first byte of jp instruction (org #1234)", async () => {
    await testCodeEmit(
      `
      .org #1234
      jp $
      `,
      0xC3,
      0x34,
      0x12
    );
  });

  it("jp $: $ advances with preceding instructions", async () => {
    // nop (1 byte) at 0x8000, then jp $ at 0x8001 → jp to 0x8001
    await testCodeEmit(
      `
      nop
      jp $
      `,
      0x00,
      0xC3,
      0x01,
      0x80
    );

    // two nops (2 bytes), then jp $ at 0x8002 → jp to 0x8002
    await testCodeEmit(
      `
      nop
      nop
      jp $
      `,
      0x00,
      0x00,
      0xC3,
      0x02,
      0x80
    );
  });

  it("jp conditional $: points to first byte of jp cc instruction", async () => {
    // jp nz, $ at 0x8000 → 0xC2 0x00 0x80
    await testCodeEmit("jp nz, $", 0xC2, 0x00, 0x80);
    // jp z,  $ at 0x8000 → 0xCA 0x00 0x80
    await testCodeEmit("jp z, $",  0xCA, 0x00, 0x80);
    // jp nc, $ at 0x8000 → 0xD2 0x00 0x80
    await testCodeEmit("jp nc, $", 0xD2, 0x00, 0x80);
    // jp c,  $ at 0x8000 → 0xDA 0x00 0x80
    await testCodeEmit("jp c, $",  0xDA, 0x00, 0x80);
  });

  // -------------------------------------------------------------------------
  // call $
  // -------------------------------------------------------------------------

  it("call $: points to first byte of call instruction (default start 0x8000)", async () => {
    // call $ → call 0x8000 → 0xCD 0x00 0x80
    await testCodeEmit("call $", 0xCD, 0x00, 0x80);
  });

  it("call $: points to first byte of call instruction (org #1234)", async () => {
    await testCodeEmit(
      `
      .org #1234
      call $
      `,
      0xCD,
      0x34,
      0x12
    );
  });

  it("call conditional $: points to first byte of call cc instruction", async () => {
    // call z, $ at 0x8000 → 0xCC 0x00 0x80
    await testCodeEmit("call z, $",  0xCC, 0x00, 0x80);
    // call nz, $ at 0x8000 → 0xC4 0x00 0x80
    await testCodeEmit("call nz, $", 0xC4, 0x00, 0x80);
    // call c, $ at 0x8000 → 0xDC 0x00 0x80
    await testCodeEmit("call c, $",  0xDC, 0x00, 0x80);
    // call nc, $ at 0x8000 → 0xD4 0x00 0x80
    await testCodeEmit("call nc, $", 0xD4, 0x00, 0x80);
  });

  // -------------------------------------------------------------------------
  // jr $  (relative jump — expression is evaluated before any bytes are
  // emitted, so this was already correct, but we keep the test for safety)
  // -------------------------------------------------------------------------

  it("jr $: displacement is always -2 (self-loop)", async () => {
    // The jr instruction is 2 bytes; jumping to $ means jumping -2 from
    // the PC after the instruction = offset 0xFE
    await testCodeEmit("jr $", 0x18, 0xFE);
  });

  it("jr $: displacement is -2 regardless of org address", async () => {
    await testCodeEmit(
      `
      .org #1234
      jr $
      `,
      0x18,
      0xFE
    );
  });

  // -------------------------------------------------------------------------
  // djnz $
  // -------------------------------------------------------------------------

  it("djnz $: displacement is always -2 (self-loop)", async () => {
    await testCodeEmit("djnz $", 0x10, 0xFE);
  });

  // -------------------------------------------------------------------------
  // ld with $ — 16-bit immediate
  // -------------------------------------------------------------------------

  it("ld hl, $: $ points to first byte of ld hl instruction (default 0x8000)", async () => {
    // ld hl, nn → 0x21 lo hi
    await testCodeEmit("ld hl, $", 0x21, 0x00, 0x80);
  });

  it("ld hl, $: $ points to first byte of ld hl instruction (org #1234)", async () => {
    await testCodeEmit(
      `
      .org #1234
      ld hl, $
      `,
      0x21,
      0x34,
      0x12
    );
  });

  it("ld hl, $: $ advances with preceding instructions", async () => {
    // nop at 0x8000, ld hl, $ at 0x8001 → ld hl, 0x8001
    await testCodeEmit(
      `
      nop
      ld hl, $
      `,
      0x00,
      0x21,
      0x01,
      0x80
    );
  });

  // -------------------------------------------------------------------------
  // ld with $ — 8-bit immediate (value truncated to low byte of address)
  // -------------------------------------------------------------------------

  it("ld a, $: $ points to first byte of ld a instruction (org #00AB)", async () => {
    // ld a, n → 0x3E n; $ = 0x00AB, truncated to 0xAB
    await testCodeEmit(
      `
      .org #00AB
      ld a, $
      `,
      0x3E,
      0xAB
    );
  });

  // -------------------------------------------------------------------------
  // $ in fixup expression (forward-declared label forces deferred resolution)
  // -------------------------------------------------------------------------

  it("jp $ + forward-label: $ in fixup resolves to instruction start address", async () => {
    // Offset is defined AFTER the jp, so the expression is deferred (fixup).
    // jp $ + Offset at 0x0000, Offset=3 → jp to 0x0003 → 0xC3 0x03 0x00
    await testCodeEmit(
      `
      .org #0000
      jp $ + Offset
      Offset .equ 3
      `,
      0xC3,
      0x03,
      0x00
    );
  });

  it("jp $ + forward-label: fixup $ advances correctly with preceding instruction", async () => {
    // nop at 0x0000, jp $ + Offset at 0x0001, Offset=0 → jp to 0x0001
    await testCodeEmit(
      `
      .org #0000
      nop
      jp $ + Offset
      Offset .equ 0
      `,
      0x00,
      0xC3,
      0x01,
      0x00
    );
  });
});
