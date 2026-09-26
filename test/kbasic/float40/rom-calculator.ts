import type { Float40 } from "@main/kbasic/semantics/float40";

import { createSp48Session, type Sp48TestSession } from "../../harness/sp48";

/** A calculator literal the batch runs: binary ones take two operands, unary ones one. */
export const CALC = {
  subtract: 0x03,
  multiply: 0x04,
  division: 0x05,
  "<=": 0x09,
  ">=": 0x0a,
  "<>": 0x0b,
  ">": 0x0c,
  "<": 0x0d,
  "=": 0x0e,
  addition: 0x0f,
  negate: 0x1b,
  truncate: 0x3a
} as const;

const UNARY = new Set<number>([CALC.negate, CALC.truncate]);

export type CalcCase = { op: number; a: Float40; b?: Float40 };

/** What the ROM gave: the result's five bytes, or the report it stopped with (ERR_NR). */
export type CalcResult = { result: Float40 } | { error: number };

const IN_TABLE = 0x9000;
const OUT_TABLE = 0xc000;
const CHUNK = 1000;

// --- One entry in: [literal][a:5][b:5]; one entry out: [ERR_NR ($FF: none)][result:5]
const BATCH = `
      .org $8000
Batch:
      ld hl,${IN_TABLE}
      ld (InPtr),hl
      ld hl,${OUT_TABLE}
      ld (OutPtr),hl
      ld hl,($5c3d)
      ld (SavedErrSp),hl
BatchLoop:
      ld hl,(Count)
      ld a,h
      or l
      jr z,BatchDone
      dec hl
      ld (Count),hl
      ld hl,($5c65)
      ld (SavedEnd),hl
      ld (iy+0),$ff
      ld hl,BatchError
      push hl
      ld ($5c3d),sp          ; an error resets SP to here and SET-STK returns to BatchError
      ld hl,(InPtr)
      ld a,(hl)
      ld (CalcOp),a
      inc hl
      call $33b4             ; STACK-NUM: the first operand
      ld a,(CalcOp)
      cp ${CALC.negate}
      jr z,Unary
      cp ${CALC.truncate}
      jr z,Unary
      call $33b4             ; the second operand
      jr Calc
Unary:
      ld de,5
      add hl,de
Calc:
      ld (InPtr),hl
      ld a,(CalcOp)
      ld b,a                 ; BREG: the comparisons read their operation from it, as SCANNING sets it
      rst $28
CalcOp:
      .defb 0
      .defb $38              ; end-calc
      pop hl                 ; drop BatchError
      ld hl,($5c65)
      ld de,5
      or a
      sbc hl,de              ; HL = the result on the calculator stack
      ld de,(OutPtr)
      ld a,$ff
      ld (de),a
      inc de
      ld bc,5
      ldir
      jr Next
BatchError:
      ld de,(OutPtr)
      ld a,(iy+0)
      ld (de),a
      inc de
      xor a
      ld b,5
BatchErrorFill:
      ld (de),a
      inc de
      djnz BatchErrorFill
Next:
      ld (OutPtr),de
      ld hl,(SavedEnd)
      ld ($5c65),hl
      jr BatchLoop
BatchDone:
      ld hl,(SavedErrSp)
      ld ($5c3d),hl
      ld (iy+0),$ff
      ret
Count:      .defw 0
InPtr:      .defw 0
OutPtr:     .defw 0
SavedEnd:   .defw 0
SavedErrSp: .defw 0
`;

/** The 48K ROM's calculator as an oracle: runs batches of operations on the real machine. */
export class RomCalculator {
  private constructor(private readonly s: Sp48TestSession) {}

  static async create(): Promise<RomCalculator> {
    const s = await createSp48Session();
    s.bootToBasic();
    await s.loadCode(BATCH);
    return new RomCalculator(s);
  }

  run(cases: CalcCase[]): CalcResult[] {
    const results: CalcResult[] = [];
    for (let start = 0; start < cases.length; start += CHUNK) {
      const chunk = cases.slice(start, start + CHUNK);
      chunk.forEach((c, i) => {
        const at = IN_TABLE + i * 11;
        if (!UNARY.has(c.op) && !c.b) throw new Error("A binary operation needs two operands");
        this.s.poke(at, [c.op, ...c.a, ...(c.b ?? [0, 0, 0, 0, 0])]);
      });
      this.s.pokeWord(this.s.program!.symbol("Count"), chunk.length);
      this.s.call("Batch", { maxFrames: 5000 });
      chunk.forEach((_, i) => {
        const at = OUT_TABLE + i * 6;
        const err = this.s.peek(at);
        if (err !== 0xff) results.push({ error: err });
        else {
          const r = [1, 2, 3, 4, 5].map((k) => this.s.peek(at + k));
          results.push({ result: r as unknown as Float40 });
        }
      });
    }
    return results;
  }
}
