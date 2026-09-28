import { describe, expect, it } from "vitest";

import { TapeMode } from "@emu/abstractions/TapeMode";
import { TapeDataBlock } from "@common/structs/TapeDataBlock";
import { MEDIA_TAPE } from "@common/structs/project-const";
import { FAST_LOAD, SAVED_TO_TAPE, TAPE_MODE } from "@emu/machines/machine-props";

import { runBasic } from "./run-kit";

/** SAVE, LOAD and VERIFY through the ROM's tape routines, on the 48K's own tape device. */
function block(bytes: number[]): TapeDataBlock {
  const b = new TapeDataBlock();
  const checksum = bytes.reduce((x, v) => x ^ v, 0);
  b.data = new Uint8Array([...bytes, checksum]);
  return b;
}

function header(name: string, length: number, start: number): TapeDataBlock {
  const field = [...name.padEnd(10).slice(0, 10)].map((c) => c.charCodeAt(0));
  return block([0x00, 3, ...field, length & 0xff, length >> 8, start & 0xff, start >> 8, 0x00, 0x80]);
}

describe("tape", () => {
  it("LOADs CODE by name to the header's address, passing other blocks over", async () => {
    const tape = [header("other", 2, 45000), block([0xff, 9, 9]), header("demo", 3, 40000), block([0xff, 1, 2, 3])];
    const r = await runBasic('LOAD "demo" CODE\nPRINT PEEK 40000; PEEK 40002; " "; PEEK 23610\n', {
      before: (s) => {
        s.machine.setMachineProperty(MEDIA_TAPE, tape);
        s.machine.setMachineProperty(FAST_LOAD, true);
      },
      frames: 1500
    });
    const [bytes, errNr] = r.screen(1)[0].split(" ");
    expect(bytes).toBe("13");
    expect(errNr, "no loading error").not.toBe("26");
    expect(r.session.peek(45000), "the other block was skipped").not.toBe(9);
  });

  it("sets ERR_NR to 26 and goes on when the data fails to load", async () => {
    const r = await runBasic('LOAD "" CODE 50000, 3\nPRINT PEEK 23610\n', {
      before: (s) => {
        s.machine.setMachineProperty(MEDIA_TAPE, [header("x", 3, 40000), corrupt()]);
        s.machine.setMachineProperty(FAST_LOAD, true);
      },
      frames: 1500
    });
    expect(r.screen(1)[0]).toBe("26");
  });

  it("SAVEs a CODE block the tape device records", async () => {
    const r = await runBasic('POKE 40000, 42: POKE 40001, 43\nSAVE "blk" CODE 40000, 2\nPRINT "ok"\n', {
      before: (s) => s.machine.setMachineProperty(TAPE_MODE, TapeMode.Save),
      frames: 3000
    });
    expect(r.screen(1)[0]).toBe("ok");
    const saved = r.session.machine.getMachineProperty(SAVED_TO_TAPE) as { name: string; contents: Uint8Array };
    expect(saved.name).toBe("blk.tzx");
    // --- The data block's bytes: flag $FF, 42, 43, then the checksum
    const bytes = [...saved.contents];
    const at = bytes.findIndex((b, i) => b === 0xff && bytes[i + 1] === 42 && bytes[i + 2] === 43);
    expect(at).toBeGreaterThan(0);
    expect(bytes[at + 3]).toBe(0xff ^ 42 ^ 43);
  });
});

/** A data block whose checksum is wrong. */
function corrupt(): TapeDataBlock {
  const b = block([0xff, 1, 2, 3]);
  b.data[b.data.length - 1] ^= 0x55;
  return b;
}

describe("tape DATA", () => {
  it("LOADs the bytes of a numeric array or variable", async () => {
    const tape = [header("arr", 6, 0), block([0xff, 1, 0, 2, 0, 3, 0]), header("num", 2, 0), block([0xff, 0x39, 0x30])];
    const r = await runBasic('DIM a(2) AS UInteger\nDIM n AS UInteger\nLOAD "arr" DATA a()\nLOAD "num" DATA n\nPRINT a(0); a(1); a(2); " "; n\n', {
      before: (s) => {
        s.machine.setMachineProperty(MEDIA_TAPE, tape);
        s.machine.setMachineProperty(FAST_LOAD, true);
      },
      frames: 1500
    });
    expect(r.screen(1)[0]).toBe("123 12345");
  });

  it("SAVEs and LOADs every variable and the heap with DATA and no name (compatibility plan C8)", async () => {
    // --- One program, run twice: the first run (flag set) saves, the second loads what it saved
    const source = [
      "DIM n AS UInteger",
      "DIM s AS String",
      "DIM a(2) AS UByte",
      "IF PEEK 50000 = 1 THEN",
      '  n = 1234: s = "hello": a(2) = 9',
      '  SAVE "state" DATA',
      "ELSE",
      '  LOAD "state" DATA',
      "END IF",
      'PRINT n; " "; s; " "; a(2)',
      ""
    ].join("\n");
    const first = await runBasic(source, {
      before: (s) => {
        s.poke(50000, 1);
        s.machine.setMachineProperty(TAPE_MODE, TapeMode.Save);
      },
      frames: 6000
    });
    expect(first.screen(1)[0]).toBe("1234 hello 9");
    const saved = first.session.machine.getMachineProperty(SAVED_TO_TAPE) as { contents: Uint8Array };
    // --- The TZX's standard-speed blocks (ID $10: pause, length, then the bytes) become the tape
    const tzx = [...saved.contents];
    const blocks: TapeDataBlock[] = [];
    for (let i = 10; i < tzx.length; ) {
      if (tzx[i] !== 0x10) break;
      const length = tzx[i + 3] | (tzx[i + 4] << 8);
      const b = new TapeDataBlock();
      b.data = new Uint8Array(tzx.slice(i + 5, i + 5 + length));
      blocks.push(b);
      i += 5 + length;
    }
    expect(blocks.length).toBe(2);
    const second = await runBasic(source, {
      before: (s) => {
        s.machine.setMachineProperty(MEDIA_TAPE, blocks);
        s.machine.setMachineProperty(FAST_LOAD, true);
      },
      frames: 3000
    });
    expect(second.screen(1)[0]).toBe("1234 hello 9");
  });
});
