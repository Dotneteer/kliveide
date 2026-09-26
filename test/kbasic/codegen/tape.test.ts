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
