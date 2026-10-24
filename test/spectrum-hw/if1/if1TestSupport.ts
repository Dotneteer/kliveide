import { tokenizeBasicProgram } from "@common/basic/spectrumBasicTokenizer";
import { IF1_SLOT_SIZE } from "@emu/machines/zxSpectrum/if1/if1CoreBridge";
import { createSp48Session, type Sp48TestSession } from "../../harness/sp48";

/*
 * Shared by the Interface 1 hardware tests (`.plans/MICRODRIVE_PLAN.md` Phase 2). The cartridge
 * layout and checksum are `_input/microdrive/mdr-and-file-formats.md` §2-§3 and §7.
 */

/** The byte sum mod 255 every block's checksum is (`microdrive-media.md` §4) */
export function mdrChecksum(bytes: ArrayLike<number>): number {
  let sum = 0;
  for (let i = 0; i < bytes.length; i++) sum = (sum + bytes[i]) % 255;
  return sum;
}

/**
 * A cartridge formatted as the tools make one (`mdr-and-file-formats.md` §7): slot i holds sector
 * 254 - i, every record free, every checksum valid
 */
export function formattedMdr(name = "TEST", slots = 254): Uint8Array {
  const mdr = new Uint8Array(slots * IF1_SLOT_SIZE + 1);
  const label = [...name.padEnd(10, " ").slice(0, 10)].map((c) => c.charCodeAt(0));
  for (let i = 0; i < slots; i++) {
    const base = i * IF1_SLOT_SIZE;
    const header = [0x01, 254 - i, 0x00, 0x00, ...label];
    mdr.set(header, base);
    mdr[base + 14] = mdrChecksum(header);
    const descriptor = [0x00, 0x00, 0x00, 0x00, ...Array(10).fill(0x20)];
    mdr.set(descriptor, base + 15);
    mdr[base + 29] = mdrChecksum(descriptor);
    mdr[base + 542] = mdrChecksum(mdr.subarray(base + 30, base + 542));
  }
  return mdr;
}

/** What `installProgram` needs of a session: the 48K's, or the 128K's in 48 BASIC */
type BasicMemory = { peekWord(address: number): number; poke(address: number, bytes: number | ArrayLike<number>): unknown };

/** A BASIC program put where LOAD puts one, its system variables set, as if it had been typed */
export function installProgram(s: BasicMemory, source: string): void {
  const program = tokenizeBasicProgram(source);
  const word = (address: number, value: number) => s.poke(address, [value & 0xff, value >> 8]);
  const prog = s.peekWord(23635);
  s.poke(prog, program);
  const vars = prog + program.length;
  s.poke(vars, 0x80);
  const eLine = vars + 1;
  s.poke(eLine, [0x0d, 0x80]);
  word(23627, vars);
  word(23641, eLine);
  word(23643, eLine);
  word(23649, eLine + 2);
  word(23651, eLine + 2);
  word(23653, eLine + 2);
}

/** Installs a program, RUNs it, runs `frames` frames */
export function runBasic(s: Sp48TestSession, source: string, frames: number): Sp48TestSession {
  installProgram(s, source);
  s.typeKeys([["R"], ["Enter"]]);
  s.runFrames(frames);
  return s;
}

/** The screen's non-empty lines */
export function screenLines(s: { screenLine(row: number): string }): string[] {
  return Array.from({ length: 24 }, (_, row) => s.screenLine(row).trimEnd()).filter((l) => l.length > 0);
}

/** A 48K booted to BASIC with the Interface 1 connected (the shipped ROM by default) */
export async function sp48WithInterface1(rom?: Uint8Array): Promise<Sp48TestSession> {
  const s = await createSp48Session();
  s.bootToBasic();
  return s.connectInterface1(rom);
}

/*
 * A stand-in 8K ROM, for checks the real ROM would hide: at $0008 it records that it ran (and what
 * it reads at $0700 and its mirror $2700) and returns through $0700; at $1708 it records that too.
 */
export const STAND_IN_MARK_0008 = 0x9000;
export const STAND_IN_MARK_1708 = 0x9001;
export const STAND_IN_READ_0700 = 0x9002;
export const STAND_IN_READ_2700 = 0x9003;

export function standInRom(): Uint8Array {
  const rom = new Uint8Array(0x2000).fill(0xff);
  // --- $0008: LD A,$A5 / LD ($9000),A / LD A,($0700) / LD ($9002),A / LD A,($2700) / LD ($9003),A / JP $0700
  rom.set([0x3e, 0xa5, 0x32, 0x00, 0x90, 0x3a, 0x00, 0x07, 0x32, 0x02, 0x90, 0x3a, 0x00, 0x27, 0x32, 0x03, 0x90, 0xc3, 0x00, 0x07], 0x0008);
  // --- $0700: RET (UNPAGE)
  rom[0x0700] = 0xc9;
  // --- $1708: LD A,$5A / LD ($9001),A / JP $0700
  rom.set([0x3e, 0x5a, 0x32, 0x01, 0x90, 0xc3, 0x00, 0x07], 0x1708);
  return rom;
}

/** Selects drive A (1-8; 0 stops all) as the ROM's SW-MOTOR does: eight clocks, drive 8's bit first */
export const SELECT = `
      Select:
        neg
        add a,9
        ld c,a
        ld b,8
      SelLoop:
        dec c
        jr nz,SelOff
        ld a,$ee
        out ($ef),a
        ld a,$ec
        out ($ef),a
        jr SelNext
      SelOff:
        ld a,$ef
        out ($ef),a
        ld a,$ed
        out ($ef),a
      SelNext:
        djnz SelLoop
        ld a,$ee
        out ($ef),a
        ret
`;

/**
 * Reads the next block as the ROM's GET-M-BLK does (`interface1-rom-behaviour.md` §5.1): 8 gap polls,
 * 6 signal polls, then SYNC within 60 polls (else it starts again), then INIR B bytes to HL.
 * `BeforeInir` / `AfterInir` mark the transfer.
 */
export const READ_BLOCK = `
      ReadBlock:
        push bc
      RbGap:
        ld b,8
      RbGapLoop:
        in a,($ef)
        and $04
        jr z,RbGap
        djnz RbGapLoop
      RbSig:
        ld b,6
      RbSigLoop:
        in a,($ef)
        and $04
        jr nz,RbSig
        djnz RbSigLoop
        ld a,$ee
        out ($ef),a
        ld b,60
      RbSync:
        in a,($ef)
        and $02
        jr z,RbReady
        djnz RbSync
        jr RbGap
      RbReady:
        pop bc
        ld c,$e7
      BeforeInir:
        inir
      AfterInir:
        ret
`;
