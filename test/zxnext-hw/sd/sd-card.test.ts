import { describe, expect, it } from "vitest";

import { createSession, MemorySdCard, type NextTestSession, type SdCardBacking } from "../../harness/zxnext";

/*
 * SPI master and SD card (catalogue SPI-001 - SPI-008; SPI-001's register-level half, the WASM `$E7`
 * latch, is `spi-flash-select.test.ts`).
 *
 * Hardware:
 * - zxnext.vhd ~3296-3321: port $E7 selects one slave - low bits `10` SD card 0, `01` SD card 1, $FB / $F7
 *   the Pi, $7F the flash (config mode or reset type bit 2); anything else deselects all. ~2375 port
 *   enable bit 11 ($83 bit 3) gates $E7 and $EB.
 * - serial/spi_master.vhd: a write to $EB shifts the byte out; a read returns the byte shifted in by the
 *   previous exchange and starts a new one with $FF out. A deselected bus reads high: $FF.
 * - The card is outside the FPGA: expectations for it come from the SD Physical Layer Simplified
 *   Specification, SPI mode. A command is 6 bytes (01 + index, 32-bit argument, CRC7 + 1); the card
 *   answers R1 after 0-8 bytes of $FF (NCR). CMD0 -> R1 $01 (idle); CMD8 -> R7 = R1 + 4 bytes echoing the
 *   voltage and check pattern; CMD55 + ACMD41 -> $00 once initialised; CMD58 -> R3 = R1 + OCR (bit 31
 *   power-up done, bit 30 CCS = SDHC). SDHC addresses are sector numbers. CMD17 -> R1, $FE, 512 bytes,
 *   CRC16 (CCITT, polynomial $1021, initial 0). CMD24 -> R1; the host sends $FE + 512 bytes + CRC; the
 *   card answers a data response token (xxx0 0101 = accepted), then busy ($00) until done. CMD18 streams
 *   blocks ($FE + 512 + CRC each) until CMD12. Bytes of $FF between commands are not commands (a command
 *   starts with bits 01).
 *
 * The image is served from memory (`attachSdCard`); the async run methods answer the machines' sector
 * frame commands through their own `processFrameCommand`.
 */

const SECTORS = 2048; // --- 1 MB
const sectorByte = (sector: number, i: number) => (sector * 7 + i * 3 + (i >> 8)) & 0xff;

function image(): Uint8Array {
  const img = new Uint8Array(SECTORS * 512);
  for (let s = 0; s < 64; s++) for (let i = 0; i < 512; i++) img[s * 512 + i] = sectorByte(s, i);
  return img;
}

const sectorOf = (img: Uint8Array, s: number) => Array.from(img.subarray(s * 512, (s + 1) * 512));

/** CRC16-CCITT (XMODEM): polynomial $1021, initial 0, no reflection. */
function crc16(bytes: number[]): number {
  let crc = 0;
  for (const b of bytes) {
    crc ^= b << 8;
    for (let k = 0; k < 8; k++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc;
}

/** A 6-byte SD command with a 32-bit argument. CRC7 is right for CMD0 and CMD8, a dummy otherwise. */
function cmd(index: number, arg = 0): number[] {
  const crc = index === 0 ? 0x95 : index === 8 ? 0x87 : 0x01;
  return [0x40 | index, (arg >>> 24) & 0xff, (arg >>> 16) & 0xff, (arg >>> 8) & 0xff, arg & 0xff, crc];
}

const defb = (bytes: number[]) => `.defb ${bytes.map((b) => `$${b.toString(16)}`).join(",")}`;

/**
 * SPI routines (C = $EB throughout):
 * - SendCmd: sends the 6 bytes at HL, polls up to 64 reads for R1; A = R1 ($FF: none). HL advances.
 * - WaitTok: polls up to 4000 reads for a byte other than $FF; A = it.
 * - Store: appends A to the log at `Log`.
 */
const LIB = `
SendCmd:
        ld bc,$06eb
        otir
        ld b,64
SendCmd1:
        in a,(c)
        cp $ff
        ret nz
        djnz SendCmd1
        ret
WaitTok:
        ld de,4000
WaitTok1:
        in a,(c)
        cp $ff
        ret nz
        dec de
        ld a,d
        or e
        jr nz,WaitTok1
        ld a,$ff
        ret
Store:  push hl
        ld hl,(LogPtr)
        ld (hl),a
        inc hl
        ld (LogPtr),hl
        pop hl
        ret
LogPtr: .defw Log
`;

/** The bytes a program logged (Log lives at $A000, clear of the code). */
const LOG = 0xa000;
const logOf = (s: NextTestSession, n: number) => Array.from(s.peekBytes(LOG, n));

/** Runs `body` (after selecting `select` on $E7) with the image attached; returns the session. */
async function run(body: string, opts: { select?: number; img?: Uint8Array | SdCardBacking; data?: string; maxFrames?: number } = {}) {
  const s = await createSession();
  await s.loadCode(" .org $8000\n di\nPark: jr Park");
  s.poke(LOG, new Array(0x1800).fill(0xee));
  s.attachSdCard(opts.img ?? image());
  await s.loadCode(
    `
        .org $8000
Start:  di
        ld a,$${(opts.select ?? 0xfe).toString(16)}
        out ($e7),a
        ld c,$eb
${body}
        nextreg $7f,$a5
Park:   jr Park
${LIB}
${opts.data ?? ""}
Log     .equ $a000`,
    { entry: "Start" }
  );
  await s.runUntilReadyAsync({ maxFrames: opts.maxFrames ?? 50 });
  return s;
}

/** `SendCmd` for the command at `label`, logging R1. */
const send = (label: string) => `
        ld hl,${label}
        call SendCmd
        call Store`;

/** Logs `n` more response bytes. */
const readMore = (n: number) => Array.from({ length: n }, () => "        in a,(c)\n        call Store").join("\n");

/** CMD0, CMD8, CMD55 + ACMD41 until ready (up to 50 times), CMD58 + OCR. */
const INIT_DATA = `
Cmd0:   ${defb(cmd(0))}
Cmd8:   ${defb(cmd(8, 0x1aa))}
Cmd55:  ${defb(cmd(55))}
Acmd41: ${defb(cmd(41, 0x40000000))}
Cmd58:  ${defb(cmd(58))}`;
const INIT = `
${send("Cmd0")}
${send("Cmd8")}
${readMore(4)}
        ld a,50
        ld (Tries),a
Acmd:
${send("Cmd55")}
${send("Acmd41")}
        or a
        jr z,AcmdDone
        ld a,(Tries)
        dec a
        ld (Tries),a
        jr nz,Acmd
AcmdDone:
${send("Cmd58")}
${readMore(4)}`;

// ---------------------------------------------------------------------------------------------------

describe("SPI / SD card", () => {
  /*
   * SPI-001 through the card itself (both cores): only a value whose low bits are 10 selects card 0;
   * $FD selects the empty slot 1; the Pi, the flash (outside config mode) and every other value select
   * nothing.
   */
  const SELECTS: Array<[value: number, answers: boolean]> = [
    [0xfe, true], [0x02, true], [0x7e, true], [0xfa, true],
    [0xfd, false], [0x01, false], [0xfb, false], [0xf7, false], [0xff, false], [0x00, false], [0x03, false], [0xf3, false], [0x7f, false]
  ];
  it("SPI-001: $E7 decode seen by the card: low bits 10 select card 0, nothing else does", async () => {
    const got: Record<string, number> = {};
    for (const [value] of SELECTS) {
      const s = await run(send("Cmd0"), { select: value, data: INIT_DATA });
      got[`$${value.toString(16)}`] = logOf(s, 1)[0];
    }
    expect(got).toEqual(Object.fromEntries(SELECTS.map(([v, a]) => [`$${v.toString(16)}`, a ? 0x01 : 0xff])));
  });

  it("SPI-002: with no slave selected every exchange reads $FF", async () => {
    const s = await run(`${send("Cmd0")}\n${readMore(8)}`, { select: 0xff, data: INIT_DATA });
    expect(logOf(s, 9)).toEqual(new Array(9).fill(0xff));
  });

  it("SPI-002: with port enable bit 11 ($83 bit 3) off, $E7 and $EB do nothing: reads are $FF", async () => {
    const s = await run(
      `
        ld bc,$243b
        ld a,$83
        out (c),a
        inc b
        in a,(c)
        and $f7
        out (c),a
        ld c,$eb
${send("Cmd0")}
${readMore(4)}`,
      { data: INIT_DATA }
    );
    expect(logOf(s, 5)).toEqual(new Array(5).fill(0xff));
  });

  it("SPI-003: CMD0 idle, CMD8 echoes the check pattern, ACMD41 finishes, CMD58 reports an SDHC card", async () => {
    const s = await run(INIT, { data: `${INIT_DATA}\nTries: .defb 0` });
    const log = logOf(s, 200);
    expect(log.slice(0, 6), "CMD0 R1, CMD8 R7").toEqual([0x01, 0x01, 0x00, 0x00, 0x01, 0xaa]);
    const end = log.indexOf(0xee);
    const acmd = log.slice(6, end - 5);
    expect(acmd.length % 2, "CMD55 + ACMD41 pairs").toBe(0);
    expect(acmd[acmd.length - 1], "ACMD41 finally 0").toBe(0x00);
    const r3 = log.slice(end - 5, end);
    expect(r3[0], "CMD58 R1").toBe(0x00);
    expect(r3[1] & 0xc0, "OCR: powered up, CCS (SDHC)").toBe(0xc0);
  });

  it("SPI-003: $FF bytes written between commands are not commands", async () => {
    const s = await run(
      `
        ld a,$ff
        out (c),a
        out (c),a
        out (c),a
${send("Cmd0")}`,
      { data: INIT_DATA }
    );
    expect(logOf(s, 1)).toEqual([0x01]);
  });

  it("SPI-004: CMD17 reads a sector: R1, $FE, the 512 image bytes, CRC16", async () => {
    const img = image();
    const s = await run(
      `${INIT}
${send("Cmd17")}
        call WaitTok
        call Store
        ld hl,Block
        ld b,0
        inir
        inir
${readMore(2)}`,
      { img, data: `${INIT_DATA}\nTries: .defb 0\nCmd17: ${defb(cmd(17, 5))}\nBlock .equ $b000` }
    );
    const log = logOf(s, 200);
    const end = log.indexOf(0xee);
    expect(log.slice(end - 4, end - 2), "R1, token").toEqual([0x00, 0xfe]);
    const data = Array.from(s.peekBytes(0xb000, 512));
    expect(data, "sector 5").toEqual(sectorOf(img, 5));
    const crc = crc16(data);
    expect(log.slice(end - 2, end), "CRC16").toEqual([crc >> 8, crc & 0xff]);
  });

  it("SPI-005: CMD24 writes a sector: data response accepted, the image changes, CMD17 reads it back", async () => {
    const img = image();
    const block = Array.from({ length: 512 }, (_, i) => (i * 11 + 0x5a) & 0xff);
    const crc = crc16(block);
    const s = await run(
      `${INIT}
${send("Cmd24")}
        ld a,$ff
        out (c),a
        ld a,$fe
        out (c),a
        ld hl,Block
        ld b,0
        otir
        otir
        ld a,$${(crc >> 8).toString(16)}
        out (c),a
        ld a,$${(crc & 0xff).toString(16)}
        out (c),a
        call WaitTok
        call Store                ; data response
        ld de,4000
Busy:   in a,(c)
        cp $ff
        jr z,NotBusy
        dec de
        ld a,d
        or e
        jr nz,Busy
NotBusy:
        call Store                ; $FF once done
${send("Cmd17")}
        call WaitTok
        call Store
        ld hl,Back
        ld b,0
        inir
        inir
${readMore(2)}`,
      {
        img,
        data: `${INIT_DATA}\nTries: .defb 0\nCmd24: ${defb(cmd(24, 7))}\nCmd17: ${defb(cmd(17, 7))}\nBlock: ${defb(block)}\nBack .equ $b000`
      }
    );
    const log = logOf(s, 200);
    const end = log.indexOf(0xee);
    const [r1, response, done, r1Read, token] = log.slice(end - 7, end - 2);
    expect(r1, "CMD24 R1").toBe(0x00);
    expect(response & 0x1f, "data response: accepted").toBe(0x05);
    expect(done, "not busy any more").toBe(0xff);
    expect([r1Read, token], "CMD17").toEqual([0x00, 0xfe]);
    expect(sectorOf(s.sdImage, 7), "the image").toEqual(block);
    expect(Array.from(s.peekBytes(0xb000, 512)), "read back").toEqual(block);
    expect(sectorOf(s.sdImage, 6), "the sector before it is untouched").toEqual(sectorOf(image(), 6));
  });

  it("SPI-006: CMD18 streams consecutive sectors until CMD12", async () => {
    const img = image();
    const blocks = [0, 1, 2]
      .map(
        (k) => `
        call WaitTok
        call Store                ; token
        ld hl,$${(0xb000 + k * 0x200).toString(16)}
        ld b,0
        inir
        inir
${readMore(2)}`
      )
      .join("\n");
    const s = await run(
      `${INIT}
${send("Cmd18")}
${blocks}
${send("Cmd12")}
        call WaitTok
        call Store`,
      { img, data: `${INIT_DATA}\nTries: .defb 0\nCmd18: ${defb(cmd(18, 20))}\nCmd12: ${defb(cmd(12))}` }
    );
    for (let k = 0; k < 3; k++) {
      expect(Array.from(s.peekBytes(0xb000 + k * 0x200, 512)), `block ${k}`).toEqual(sectorOf(img, 20 + k));
    }
    const log = logOf(s, 200);
    const end = log.indexOf(0xee);
    const tail = log.slice(end - 12, end);
    expect(tail[0], "CMD18 R1").toBe(0x00);
    expect([tail[1], tail[4], tail[7]], "a data token before each block").toEqual([0xfe, 0xfe, 0xfe]);
    expect(tail[10] & 0x80, "CMD12 R1 (start bit 0)").toBe(0x00);
  });

  it("SPI-007: selecting card 1 ($E7 = $FD) with only card 0 in its slot reads $FF", async () => {
    const s = await run(`${send("Cmd0")}\n${readMore(4)}`, { select: 0xfd, data: INIT_DATA });
    expect(logOf(s, 5)).toEqual(new Array(5).fill(0xff));
  });

  it("SPI-007: deselecting ($E7 = $FF) mid-conversation: the card no longer answers", async () => {
    const s = await run(
      `
${send("Cmd0")}
        ld a,$ff
        out ($e7),a
${send("Cmd8")}
${readMore(4)}`,
      { data: INIT_DATA }
    );
    expect(logOf(s, 6)).toEqual([0x01, 0xff, 0xff, 0xff, 0xff, 0xff]);
  });

  it("SPI-008: the flash chip ($E7 = $7F, config mode) is not modelled: a JEDEC ID read gives $FF", async () => {
    const s = await run(
      `
        nextreg $03,$07          ; config mode
        ld a,$7f
        out ($e7),a
        ld a,$9f
        out (c),a
${readMore(3)}`,
      { select: 0xff }
    );
    expect(logOf(s, 3)).toEqual([0xff, 0xff, 0xff]);
  });

  /*
   * Ported from test/zxnext/SdCardDevice.test.ts (D5, write error response, D1 "no SD swap").
   */

  it("SPI-010: once a response has been clocked out the card drives $FF (after R1, after a data block)", async () => {
    // --- SD Physical Layer spec, SPI mode: DO is high between responses; a data block ends with its CRC16
    const s = await run(
      `
${send("Cmd0")}
${readMore(6)}
${INIT}
${send("Cmd17")}
        call WaitTok
        call Store
        ld hl,$b000
        ld b,0
        inir
        inir
${readMore(6)}`,
      { data: `${INIT_DATA}\nTries: .defb 0\nCmd17: ${defb(cmd(17, 3))}` }
    );
    const log = logOf(s, 200);
    expect(log.slice(0, 7), "CMD0: R1, then high").toEqual([0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]);
    const end = log.indexOf(0xee);
    const crc = crc16(Array.from(s.peekBytes(0xb000, 512)));
    expect(log.slice(end - 8, end), "CMD17: R1, token, 512 bytes (in memory), CRC16, then high").toEqual([
      0x00, 0xfe, crc >> 8, crc & 0xff, 0xff, 0xff, 0xff, 0xff
    ]);
  });

  it("SPI-011: a write the medium refuses answers the data response 'write error' and leaves the sector as it was", async () => {
    // --- SD spec 7.3.3.1: data response token xxx0 sss1, sss = 010 accepted, 110 write error (& $1F = $0D).
    // --- The host storage throws on sector 9, as a failed or unconfirmed write of the image file does.
    const img = image();
    const inner = new MemorySdCard(img);
    const refusing: SdCardBacking = {
      get totalSectors() {
        return inner.totalSectors;
      },
      readSector: (n) => inner.readSector(n),
      writeSector: (n, d) => {
        if (n === 9) throw new Error("medium error");
        inner.writeSector(n, d);
      }
    };
    const block = Array.from({ length: 512 }, (_, i) => (i * 5 + 0x33) & 0xff);
    const crc = crc16(block);
    const s = await run(
      `${INIT}
${send("Cmd24")}
        ld a,$ff
        out (c),a
        ld a,$fe
        out (c),a
        ld hl,Block
        ld b,0
        otir
        otir
        ld a,$${(crc >> 8).toString(16)}
        out (c),a
        ld a,$${(crc & 0xff).toString(16)}
        out (c),a
        call WaitTok
        call Store                ; data response
        ld de,4000
Busy:   in a,(c)
        cp $ff
        jr z,NotBusy
        dec de
        ld a,d
        or e
        jr nz,Busy
NotBusy:
${send("Cmd17")}
        call WaitTok
        call Store
        ld hl,$b000
        ld b,0
        inir
        inir`,
      { img: refusing, data: `${INIT_DATA}\nTries: .defb 0\nCmd24: ${defb(cmd(24, 9))}\nCmd17: ${defb(cmd(17, 9))}\nBlock: ${defb(block)}` }
    );
    const log = logOf(s, 200);
    const end = log.indexOf(0xee);
    const [r1, response, r1Read, token] = log.slice(end - 4, end);
    expect(r1, "CMD24 R1").toBe(0x00);
    expect(response & 0x1f, "data response: write error").toBe(0x0d);
    expect([r1Read, token], "the card still answers CMD17").toEqual([0x00, 0xfe]);
    expect(Array.from(s.peekBytes(0xb000, 512)), "sector 9 unchanged").toEqual(sectorOf(image(), 9));
    expect(sectorOf(img, 9), "the image too").toEqual(sectorOf(image(), 9));
  });

  it("SPI-012: NextReg $0A bit 5 does not swap the SD cards: $E7 = $FE still reaches card 0", async () => {
    // --- nextreg.txt $0A bit 5 "Reserved, must be zero"; zxnext.vhd ~5171-5175 stores no bit 5 and the
    // --- $E7 decode (~3305-3321) looks at nothing else: there is no card swap on the Next.
    const s = await run(`        nextreg $0a,$30\n${send("Cmd0")}`, { data: INIT_DATA });
    expect(logOf(s, 1)).toEqual([0x01]);
  });

  it("SPI-012: NextReg $0A bit 5 reads back 0", async () => {
    // --- zxnext.vhd ~5858: $0A reads mf_type & '0' & automap & reverse & '0' & dpi
    const s = await createSession();
    await s.loadCode(" .org $8000\n di\nPark: jr Park");
    s.setNextReg(0x0a, 0x30);
    expect(s.readNextReg(0x0a) & 0x20).toBe(0x00);
  });
});
