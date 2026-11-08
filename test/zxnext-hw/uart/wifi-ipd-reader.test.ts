import { describe, expect, it } from "vitest";

import { createSession } from "../../harness/zxnext";

/*
 * The +IPD reader listed in "Wi-Fi: A Telegraph Clerk on a Serial Line"
 * (docs/content/en/under-the-hood/emulator-internals/next-wifi.mdx), run on the machine with the UART
 * peer playing the module's part. Keep `READER` identical to the article's listing.
 */
const READER = `
; read one +IPD packet from UART 0 to (DE); HL = its length
GetPacket:
        ld hl,Tag
Match:  call GetByte
        cp (hl)
        jr z,Hit
        ld hl,Tag              ; no: start over, but this byte
        cp (hl)                ; may be a new "+"
        jr nz,Match
Hit:    inc hl
        ld a,(hl)
        or a
        jr nz,Match            ; more of the tag to find
        ld hl,0                ; now the length, in decimal
Digit:  call GetByte
        cp ':'
        jr z,Body
        sub '0'
        add hl,hl              ; HL * 2
        ld b,h
        ld c,l
        add hl,hl              ; * 4
        add hl,hl              ; * 8
        add hl,bc              ; * 10
        add hl,a               ; Z80N: plus the digit
        jr Digit
Body:   push hl                ; keep the length
Copy:   ld a,h
        or l
        jr z,Done
        call GetByte
        ld (de),a
        inc de
        dec hl
        jr Copy
Done:   pop hl
        ret

GetByte:
        ld bc,$133b
Wait:   in a,(c)               ; status
        rra
        jr nc,Wait             ; nothing yet
        inc b                  ; $143B: RX
        in a,(c)               ; the oldest byte
        ret

Tag:    .defb "+IPD,",0
`;

const DEST = 0x9000;
const RESULT = 0x8f00;

/** Runs the reader while the peer sends `stream`; returns the length and the packet it read. */
async function readPacket(stream: string): Promise<{ length: number; data: string }> {
  const s = await createSession();
  await s.loadCode(`
        .org $8000
Start:  di
        ld bc,$153b
        xor a                  ; UART 0
        out (c),a
        ld de,${DEST}
        call GetPacket
        ld (${RESULT}),hl
        nextreg $7f,$a5
Park:   jr Park
${READER}`);
  s.uartSend(0, [...stream].map((c) => c.charCodeAt(0)));
  s.runUntilReady({ maxFrames: 100 });
  const length = s.peekWord(RESULT);
  return { length, data: String.fromCharCode(...s.peekBytes(DEST, length)) };
}

describe("the +IPD reader of the Wi-Fi chapter", () => {
  it("skips the module's chatter and takes the packet the chapter shows", async () => {
    const payload = "HTTP/1.0 200 OK\r\n\r\nHello, Next!";
    expect(payload.length).toBe(31);
    const r = await readPacket(`SEND OK\r\n\r\n+IPD,31:${payload}CLOSED\r\n`);
    expect(r).toEqual({ length: 31, data: payload });
  });

  it("restarts on a false start without losing a new plus sign", async () => {
    const r = await readPacket("++IP+IPD,5:Hello\r\n");
    expect(r).toEqual({ length: 5, data: "Hello" });
  });

  it("does not look inside the data: a tag in the payload is payload", async () => {
    const r = await readPacket("+IPD,8:+IPD,1:x\r\n");
    expect(r).toEqual({ length: 8, data: "+IPD,1:x" });
  });

  it("copes with a packet longer than the receive buffer while it keeps reading", async () => {
    const payload = "x".repeat(1460);
    const r = await readPacket(`+IPD,1460:${payload}`);
    expect(r).toEqual({ length: 1460, data: payload });
  });
});
