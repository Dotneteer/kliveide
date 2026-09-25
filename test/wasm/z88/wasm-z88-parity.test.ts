import { describe, expect, it } from "vitest";

import { MC_SCREEN_SIZE } from "@common/machines/constants";
import { machineRegistry } from "@common/machines/machine-registry";
import { AUDIO_SAMPLE_RATE } from "@emu/machines/machine-props";
import { createZ88Session, z88Model, type Z88Key, type Z88TestSession } from "../../harness/z88";
import { audioDigest, Digest, goldens, machineState, sha256 } from "./z88-goldens";

/*
 * The Cambridge Z88 against fixed goldens: OZ booting and at the keyboard on every model, a mixed
 * program instruction by instruction, the beeper at several sample rates, the LCD from random screen
 * memory at every size, and the cards programmed from Z80 code.
 *
 * Until the TypeScript machine was removed these suites ran it and the WASM core in lockstep and
 * compared them (`.plans/CAMBRIDGE_Z88_TYPESCRIPT_REMOVAL_PLAN.md`); the TypeScript side's values
 * at every checkpoint - CPU registers, tacts and frames, the Blink state, snooze and sleep, and the
 * hashes of all 4 MB of memory, the LCD picture and the frame's audio samples - are the goldens in
 * `goldens/wasm-z88-parity.json` (`z88-goldens.ts`). Checkpoints that were compared after every frame
 * or instruction are digests of that whole stretch.
 */

const golden = goldens("wasm-z88-parity");

/** The app's usual rate; without one the beeper emits a sample at every clock step */
const AUDIO_RATE = 44_100;

const MODELS = machineRegistry
  .find((m) => m.machineId === "z88")
  .models.map((m) => m.modelId);

describe("Z88 goldens: OZ boots", () => {
  it.each(MODELS)(
    "%s",
    async (model) => {
      const s = await createZ88Session({ model, rom: "model", audioSampleRate: AUDIO_RATE });
      golden.expect(`boot ${model}: after the hard reset`, machineState(s));
      for (const checkpoint of [1, 7, 8, 9, 50, 200, 600, 1700]) {
        s.runFrames(checkpoint - s.frames);
        golden.expect(`boot ${model}: at frame ${checkpoint}`, machineState(s, { audio: true }));
      }
    },
    60_000
  );
});

/*
 * A program that keeps the CPU, the paging and the Blink busy: prefixed and block instructions, bank
 * switching through SR1-SR3, reads from an empty slot (the pseudo-random values), the RTC interrupt
 * with IM 1, HALT until the next interrupt, and the Blink's status ports.
 */
const MIXED = `
      .org $0038
      jp irq

      .org $8000
start:
      ld sp,$bff0
      im 1
      ld a,$03
      out ($b1),a          ; INT = TIME | GINT
      ld a,$01
      out ($b5),a          ; TMK = TICK
      ld a,$07
      out ($b4),a          ; TACK
      ei
loop:
      ; --- arithmetic and flags
      ld a,(counter)
      inc a
      ld (counter),a
      add a,$37
      daa
      rla
      sbc a,$12
      cpl
      neg
      ; --- block moves and searches (bank $22 to bank $23)
      ld hl,$8000
      ld de,$c100
      ld bc,$0040
      ldir
      ld hl,$c100
      ld bc,$0040
      ld a,$3e
      cpir
      ; --- IX/IY and bit operations
      ld ix,table
      ld iy,table+4
      ld a,(ix+1)
      add a,(iy+2)
      ld (ix+3),a
      set 3,(ix+0)
      bit 3,(ix+0)
      res 3,(iy-4)
      rlc (ix+2)
      srl b
      ; --- exchanges and the stack
      ex af,af'
      exx
      push hl
      pop de
      exx
      ex af,af'
      ; --- paging: bank $C5 (slot 3, empty) into segment 3, read the random values, bank $23 back
      ld a,$c5
      out ($d3),a
      ld hl,$c000
      ld b,(hl)
      ld c,(hl)
      ld a,$23
      out ($d3),a
      ; --- the Blink: status and timer ports
      in a,($b1)
      in a,($d0)
      in a,($b5)
      ; --- wait for the next RTC interrupt now and then
      ld a,(counter)
      and $07
      jr nz,loop
      halt
      jr loop

irq:
      push af
      ld a,$07
      out ($b4),a          ; TACK
      ld a,(ticks)
      inc a
      ld (ticks),a
      pop af
      ei
      reti

counter: .defb 0
ticks:   .defb 0
table:   .defb $11,$22,$33,$44,$55,$66,$77,$88
`;

describe("Z88 goldens: a mixed program, instruction by instruction", () => {
  it("30000 instructions: the registers and tacts after each, the machine at the end", async () => {
    const s = await createZ88Session();
    await s.loadCode(MIXED, { entry: "start" });

    // --- HALT waits for the next RTC tick (a 4-tact step each), so it takes this many to cross
    // --- several interrupts and frames
    const digest = new Digest();
    for (let i = 0; i < 30000; i++) {
      s.step();
      digest.add({ registers: s.registers(), tacts: s.tacts });
      if ((i + 1) % 1000 === 0) golden.expect(`mixed: instructions ${i - 998}-${i + 1}`, digest.take());
    }
    golden.expect("mixed: after 30000 instructions", machineState(s));
    // --- The program really went through interrupts and frames
    expect(s.peek(s.symbol("ticks"))).toBeGreaterThanOrEqual(3);
    expect(s.machine.frames).toBeGreaterThanOrEqual(6);
  });

  it("the same program in whole frames", async () => {
    const s = await createZ88Session();
    await s.loadCode(MIXED, { entry: "start" });
    for (const frames of [1, 3, 20, 100]) {
      s.runFrames(frames);
      golden.expect(`mixed frames: after ${frames} more frames`, machineState(s));
    }
  });

  it("a frame stopped midway (runTo), then finished", async () => {
    const s = await createZ88Session();
    await s.loadCode(MIXED, { entry: "start" });
    for (let round = 0; round < 5; round++) {
      s.runTo("irq");
      golden.expect(`mixed runTo: at the interrupt handler, round ${round}`, machineState(s));
      s.runFrames(1);
      golden.expect(`mixed runTo: after finishing the frame, round ${round}`, machineState(s));
    }
  });
});

/*
 * OZ driven from the keyboard: the key interrupt, the KWAIT snooze and wake-up, the screens OZ draws
 * in response, and whatever it beeps - after every frame.
 */
describe("Z88 goldens: OZ at the keyboard", () => {
  // --- Each entry is held for a few frames, then released for a few; a chord is pressed together
  const SCRIPT: Z88Key[][] = [
    ["Index"],
    ["Down"],
    ["Down"],
    ["Menu"],
    ["Escape"],
    ["Diamond", "P"],
    ["H"],
    ["E"],
    ["L"],
    ["L"],
    ["O"],
    ["Enter"],
    ["ShiftL", "N1"],
    ["CapsLock"],
    ["Q"],
    ["Delete"],
    ["Left"],
    ["Help"],
    ["Escape"],
    ["Square", "Index"],
    ["Escape"],
    ["Index"]
  ];

  it.each(MODELS)(
    "%s: the machine after every frame of a typing session",
    async (model) => {
      const s = await createZ88Session({ model, rom: "model", audioSampleRate: AUDIO_RATE });
      s.runFrames(1700);
      golden.expect(`typing ${model}: after booting`, machineState(s));
      const bootPicture = s.screen();

      // --- Every frame's whole machine goes into the digest of the key's hold or release
      const digest = new Digest();
      for (const [index, keys] of SCRIPT.entries()) {
        s.keyDown(...keys);
        for (let i = 0; i < 6; i++) digest.add(machineState(s.runFrames(1), { audio: true }));
        golden.expect(`typing ${model}: holding ${keys.join("+")} (#${index})`, digest.take());
        s.keyUp(...keys);
        for (let i = 0; i < 18; i++) digest.add(machineState(s.runFrames(1), { audio: true }));
        golden.expect(`typing ${model}: after releasing ${keys.join("+")} (#${index})`, digest.take());
      }
      golden.expect(`typing ${model}: at the end`, machineState(s, { audio: true }));
      // --- The keys really reached OZ: the picture is not the one it booted to
      expect(s.screen()).not.toEqual(bootPicture);
    },
    120_000
  );
});

/*
 * The beeper from Z80 code: the 3200 Hz oscillator (COM.SRUN) gated by COM.SBIT, and the ear bit
 * (SBIT with SRUN clear) toggled at several periods, at several sample rates - each rate set as the app
 * sets it, before a reset.
 */
const BEEPER = `
      .org $8000
start:
      ld sp,$bff0
      di
      ld e,0               ; the pattern counter
next:
      ; --- the oscillator for a while, then gated off by SBIT
      ld a,$05             ; RAMS | LCDON
      or $80               ; SRUN
      out ($b0),a
      ld bc,$0300
osc:  dec bc
      ld a,b
      or c
      jr nz,osc
      ld a,$c5             ; SRUN | SBIT: silent
      out ($b0),a
      ld bc,$0100
gate: dec bc
      ld a,b
      or c
      jr nz,gate
      ; --- the ear bit: 64 toggles with a period that grows with the counter
      ld d,64
ear:  ld a,$45             ; SBIT
      out ($b0),a
      ld a,e
      and $1f
      inc a
      ld b,a
w1:   djnz w1
      ld a,$05             ; SBIT clear
      out ($b0),a
      ld a,e
      and $1f
      add a,3
      ld b,a
w2:   djnz w2
      dec d
      jr nz,ear
      inc e
      jr next
`;

describe("Z88 goldens: the beeper", () => {
  it.each([44_100, 48_000, 22_050, 11_025, 96_000])(
    "at %i Hz: the samples of every frame",
    async (rate) => {
      const s = await createZ88Session({ audioSampleRate: rate });
      await s.loadCode(BEEPER, { entry: "start" });
      let nonZero = 0;
      const digest = new Digest();
      for (let frame = 0; frame < 120; frame++) {
        s.runFrames(1);
        const samples = s.machine.getAudioSamples();
        digest.add(audioDigest(samples));
        if ((frame + 1) % 20 === 0) golden.expect(`beeper ${rate} Hz: frames ${frame - 19}-${frame}`, digest.take());
        nonZero += samples.filter((sample) => sample.left !== 0).length;
      }
      golden.expect(`beeper ${rate} Hz: after 120 frames`, machineState(s, { audio: true }));
      // --- The program really made sound
      expect(nonZero).toBeGreaterThan(1000);
    },
    60_000
  );

  it("a rate change (set, then a reset) takes effect", async () => {
    const s = await createZ88Session({ audioSampleRate: 44_100 });
    const digest = new Digest();
    for (const rate of [44_100, 32_000, 8_000]) {
      s.machine.setMachineProperty(AUDIO_SAMPLE_RATE, rate);
      s.reset();
      await s.loadCode(BEEPER, { entry: "start" });
      for (let frame = 0; frame < 30; frame++) digest.add(audioDigest(s.runFrames(1).machine.getAudioSamples()));
      golden.expect(`beeper rate change: 30 frames at ${rate} Hz`, digest.take());
    }
  });
});

/*
 * The LCD from random screen memory: every cell kind (LORES, UDG, HIRES, cursor, null) and attribute
 * combination turns up in a 64K of random bytes, for all five LCD sizes, through the text flash and
 * cursor phases, and with the LCD switched off and on again.
 */
describe("Z88 goldens: the LCD from random screen memory", () => {
  /** A small deterministic generator, so a failure reproduces */
  function random(seed: number): () => number {
    let x = seed >>> 0 || 1;
    return () => {
      x ^= x << 13;
      x ^= x >>> 17;
      x ^= x << 5;
      return (x >>> 0) & 0xff;
    };
  }

  /** Writes a 16-bit LCD register: B (the port's high byte) carries its high byte */
  function outWord(s: Z88TestSession, port: number, value: number): void {
    s.out(((value >> 8) << 8) | port, value & 0xff);
  }

  it.each([undefined, "640x320", "640x480", "800x320", "800x480"])(
    "LCD size %s",
    async (size) => {
      const model = z88Model();
      const config = size ? { ...model.config, [MC_SCREEN_SIZE]: size } : undefined;
      const s = await createZ88Session({ config });
      const next = random(size ? size.length * 7919 + size.charCodeAt(4) : 88);
      const bytes = Array.from({ length: 0xf000 }, next);
      await s.loadCode(`
      .org $f000
spin: jr spin
      `);
      s.poke(0x0000, bytes);
      // --- The screen map in bank $22, the fonts spread over banks $20-$23
      outWord(s, 0x70, (0x21 << 5) | (0x1200 >> 9)); // PB0: LORES0 (UDGs)
      outWord(s, 0x71, (0x23 << 2) | (0x1000 >> 12)); // PB1: LORES1
      outWord(s, 0x72, (0x20 << 1) | (0x2000 >> 13)); // PB2: HIRES0
      outWord(s, 0x73, (0x21 << 3) | (0x2800 >> 11)); // PB3: HIRES1
      outWord(s, 0x74, (0x22 << 3) | (0x0000 >> 11)); // SBR
      s.out(0xb0, 0x05); // RAMS | LCDON
      // --- Past two text flash toggles (every 200 frames), through the cursor phases of TIM0; the
      // --- picture every 8th frame goes into the digest of each 80 frames
      const digest = new Digest();
      for (let frame = 1; frame <= 480; frame++) {
        s.runFrames(1);
        if (frame % 8 === 1) digest.add({ width: s.lcdWidth, height: s.lcdHeight, sha256: sha256(s.screen()) });
        if (frame % 80 === 0) golden.expect(`lcd ${size ?? "default"}: frames ${frame - 79}-${frame}`, digest.take());
        if (frame === 240) s.out(0xb0, 0x04);
        if (frame === 264) s.out(0xb0, 0x05);
      }
      golden.expect(`lcd ${size ?? "default"}: at the end`, machineState(s));
    },
    60_000
  );
});

/*
 * The cards, hot-plugged into slots 1-3 while a program runs, as the card dialogs insert them: the
 * program waits, the card goes in, then Z80 code programs, identifies and erases it with the chip's
 * own command sequences (and a UV EPROM with VPP and EPR) - including the failures (a 0 bit
 * programmed back to 1, a write without VPP, the wrong EPR) and a sector erase through a mirrored
 * bank. The whole machine, all 4 MB included, is compared after the plug, after the program and
 * after the card is pulled out again.
 */
describe("Z88 goldens: cards hot-plugged and programmed from Z80 code", () => {
  type Family = "amd" | "intel" | "eprom" | "plain";
  const CARDS: { label: string; cardType: string; size: number; family: Family }[] = [
    { label: "AMD 29F040B", cardType: "AMDF29F040B", size: 512, family: "amd" },
    { label: "AMD 29F080B", cardType: "AMDF29F080B", size: 1024, family: "amd" },
    { label: "Intel 28F004S5", cardType: "IF28F004S5", size: 512, family: "intel" },
    { label: "Intel 28F008S5", cardType: "IF28F008S5", size: 1024, family: "intel" },
    { label: "UV EPROM 32K", cardType: "EPROMUV32", size: 32, family: "eprom" },
    { label: "UV EPROM 128K", cardType: "EPROMUV128", size: 128, family: "eprom" },
    { label: "UV EPROM 256K", cardType: "EPROMUV256", size: 256, family: "eprom" },
    { label: "RAM 128K", cardType: "RAM128", size: 128, family: "plain" },
    { label: "RAM 1M", cardType: "RAM1024", size: 1024, family: "plain" },
    { label: "ROM 128K", cardType: "ROM", size: 128, family: "plain" }
  ];

  /* The part every program shares: wait for the card, write 16 bytes to $C100 in two banks */
  const prologue = `
      .org $8000
start:
      ld sp,$bff0
wait: ld a,(go)
      or a
      jr z,wait
`;
  const epilogue = `
      ; --- what the CPU reads back, into RAM
      ld a,BANK1
      out ($d3),a
      ld hl,$c100
      ld de,back1
      ld bc,16
      ldir
      ld a,BANK4
      out ($d3),a
      ld hl,$c100
      ld de,back4
      ld bc,16
      ldir
      ld a,$23
      out ($d3),a
done: di
      halt
      jr done

go:     .defb 0
ids:    .defs 4
stat:   .defs 4
back1:  .defs 16
back4:  .defs 16
data:   .defb $12,$34,$56,$78,$9a,$bc,$de,$f0,$0f,$1e,$2d,$3c,$4b,$5a,$69,$78
`;

  function writeBlock(bank: string): string {
    return `
      ld a,${bank}
      out ($d3),a
      ld hl,$c100
      ld de,data
      ld b,16
`;
  }

  const AMD = `
${prologue}
      ; --- program 16 bytes in two sectors
${writeBlock("BANK1")}
      call aprog
${writeBlock("BANK4")}
      call aprog
      ; --- a 0 bit cannot become 1: the error toggle, then the reset
      ld a,BANK1
      out ($d3),a
      ld a,$a0
      call cmd
      ld a,$ff
      ld ($c100),a
      ld hl,$c100
      ld a,(hl)
      ld (stat),a
      ld a,(hl)
      ld (stat+1),a
      call poll
      ; --- autoselect
      ld a,$90
      call cmd
      ld a,($c000)
      ld (ids),a
      ld a,($c001)
      ld (ids+1),a
      ld a,$f0
      ld ($c000),a
      ; --- a read aborts a command being accumulated
      ld a,$aa
      ld ($c555),a
      ld a,($c000)
      ld (ids+2),a
      ; --- erase the sector of BANK1, then one through a mirrored bank
      ld a,$80
      call cmd
      ld a,$30
      call cmd
      ld hl,$c000
      call poll
      ld a,BANK21
      out ($d3),a
      ld a,$80
      call cmd
      ld a,$30
      call cmd
      ld hl,$c000
      call poll
      ld a,BANK1
      out ($d3),a
      ; --- program one byte again after the erase
      ld a,$a0
      call cmd
      ld a,$a5
      ld ($c1ff),a
      ld hl,$c1ff
      call poll
      jp finish

aprog:
      ld a,$a0
      call cmd
      ld a,(de)
      ld (hl),a
      call poll
      inc hl
      inc de
      djnz aprog
      ret

cmd:  push af
      ld a,$aa
      ld ($c555),a
      ld a,$55
      ld ($c2aa),a
      pop af
      ld ($c555),a
      ret

; --- DQ6 toggle polling, bounded; on a persisting error the chip is reset
poll: push bc
      ld b,8
pl:   ld a,(hl)
      ld c,a
      ld a,(hl)
      xor c
      and $40
      jr z,pdone
      djnz pl
      ld a,$f0
      ld (hl),a
pdone:
      pop bc
      ret
finish:
${epilogue}`;

  const INTEL = `
${prologue}
${writeBlock("BANK1")}
      call iprog
${writeBlock("BANK4")}
      call iprog
      ; --- a 0 bit cannot become 1: the status says so
      ld a,BANK1
      out ($d3),a
      ld hl,$c100
      ld a,$40
      ld (hl),a
      ld a,$ff
      ld (hl),a
      ld a,(hl)
      ld (stat),a
      ld a,$50
      ld (hl),a
      ld a,$ff
      ld (hl),a
      ; --- identification: in the card's bottom bank, and (unknown) in another one
      ld a,BANK0
      out ($d3),a
      ld a,$90
      ld ($c000),a
      ld a,($c000)
      ld (ids),a
      ld a,($c001)
      ld (ids+1),a
      ld a,$ff
      ld ($c000),a
      ld a,BANK1
      out ($d3),a
      ld a,$90
      ld ($c000),a
      ld a,($c000)
      ld (ids+2),a
      ld a,$ff
      ld ($c000),a
      ; --- erase the sector of BANK1, then one through a mirrored bank
      ld hl,$c000
      call ierase
      ld a,BANK21
      out ($d3),a
      call ierase
      jp finish

iprog:
      ld a,$40
      ld (hl),a
      ld a,(de)
      ld (hl),a
ip:   ld a,(hl)
      and $80
      jr z,ip
      ld a,$50
      ld (hl),a
      ld a,$ff
      ld (hl),a
      inc hl
      inc de
      djnz iprog
      ret

ierase:
      ld a,$20
      ld ($c000),a
      ld a,$d0
      ld ($c000),a
ie:   ld a,($c000)
      and $80
      jr z,ie
      ld (stat+1),a
      ld a,$ff
      ld ($c000),a
      ret
finish:
${epilogue}`;

  const EPROM = `
${prologue}
      ; --- blow 16 bytes: EPR for the chip, VPP on, PROGRAM (RAMS kept for the flat RAM)
      ld a,EPR
      out ($b3),a
      ld a,$0e
      out ($b0),a
${writeBlock("BANK1")}
      call blow
      ; --- overprogramming (OVERP) in the other bank
      ld a,$26
      out ($b0),a
${writeBlock("BANK4")}
      call blow
      ; --- without VPP, and with the wrong EPR, nothing is blown
      ld a,$04
      out ($b0),a
      ld a,BANK1
      out ($d3),a
      xor a
      ld ($c200),a
      ld a,$00
      out ($b3),a
      ld a,$0e
      out ($b0),a
      xor a
      ld ($c300),a
      ld a,$04
      out ($b0),a
      jp finish

blow: ld a,(de)
      ld (hl),a
      inc hl
      inc de
      djnz blow
      ret
finish:
${epilogue}`;

  const PLAIN = `
${prologue}
${writeBlock("BANK1")}
      call copy
${writeBlock("BANK4")}
      call copy
      jp finish

copy: ld a,(de)
      ld (hl),a
      inc hl
      inc de
      djnz copy
      ret
finish:
${epilogue}`;

  const SOURCES: Record<Family, string> = { amd: AMD, intel: INTEL, eprom: EPROM, plain: PLAIN };

  const cases = CARDS.flatMap((card) => ([1, 2, 3] as const).map((slot) => ({ ...card, slot })));

  it.each(cases)("$label in slot $slot", async ({ label, cardType, size, family, slot }) => {
    const base = slot * 0x40;
    const source = SOURCES[family]
      .replace(/\bBANK0\b/g, `$${base.toString(16)}`)
      .replace(/\bBANK1\b/g, `$${(base + 1).toString(16)}`)
      .replace(/\bBANK4\b/g, `$${(base + 4).toString(16)}`)
      .replace(/\bBANK21\b/g, `$${(base + 0x21).toString(16)}`)
      .replace(/\bEPR\b/g, size === 32 ? "$48" : "$69");

    const where = `${label} in slot ${slot}`;
    const s = await createZ88Session();
    await s.loadCode(source, { entry: "start" });
    s.runFrames(3);
    await s.plugCard(slot, { cardType, size });
    golden.expect(`${where}: after the card went in`, machineState(s));

    s.poke(s.symbol("go"), 1);
    s.runTo("done", { maxFrames: 400 });
    golden.expect(`${where}: after the program`, machineState(s));

    // --- The program really reached the card as the chip documentation says
    const bytes = (name: string, length = 16) => [...s.peekBytes(s.symbol(name), length)];
    const data = bytes("data");
    const erased = new Array(16).fill(0xff);
    const card = slot * 0x10_0000;
    switch (family) {
      case "amd":
        expect(bytes("ids", 3)).toEqual([0x01, size === 512 ? 0xa4 : 0xd5, 0xff]);
        expect(bytes("stat", 2)).toEqual([0x60, 0x20]);
        expect(bytes("back1")).toEqual(erased);
        expect(bytes("back4")).toEqual(data);
        expect(s.physPeek(card + 0x4000 + 0x1ff)).toBe(0xa5);
        break;
      case "intel":
        expect(bytes("ids", 3)).toEqual([0x89, size === 512 ? 0xa7 : 0xa6, 0xff]);
        expect(bytes("stat", 2)).toEqual([0x90, 0x80]);
        expect(bytes("back1")).toEqual(erased);
        expect(bytes("back4")).toEqual(data);
        break;
      case "eprom":
        // --- Only slot 3 has the programming voltage
        expect(bytes("back1")).toEqual(slot === 3 ? data : erased);
        expect(bytes("back4")).toEqual(slot === 3 ? data : erased);
        expect([s.physPeek(card + 0x4000 + 0x200), s.physPeek(card + 0x4000 + 0x300)]).toEqual([0xff, 0xff]);
        break;
      case "plain":
        expect(bytes("back1")).toEqual(cardType === "ROM" ? new Array(16).fill(0) : data);
        break;
    }

    s.runFrames(2);
    await s.plugCard(slot, undefined);
    s.runFrames(2);
    golden.expect(`${where}: after the card came out`, machineState(s));
  });
});
