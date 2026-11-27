import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { Z80Assembler } from "@main/z80-compiler/z80-assembler";
import { SpectrumModelType } from "@main/z80-compiler/SpectrumModelTypes";
import { buildSamBootDisk } from "@common/samcoupe/samBootDisk";
import { placeSamCode } from "@common/samcoupe/codePlacement";
import { mgtSectorOffset } from "@common/samcoupe/mgtImage";
import { SamKeyCode } from "@emu/machines/samcoupe/SamKeyCode";
import { AUDIO_SAMPLE_RATE } from "@emu/machines/machine-props";
import { createSamSession } from "../../harness/samcoupe";
import { mgtToEdsk, mgtToSad } from "./diskFormats";
import { probeTape, tapeBlocks } from "./tapes";

/*
 * The parity probes (dev/plans/SAM_SIMCOUPE_PARITY_PLAN.md §1-§2): Klive-written programs that measure
 * something and write a result block to their own boot disk. The same disk runs in Klive (here) and in
 * SimCoupé (dev/scripts/sam-parity/oracle.cjs); the blocks are compared byte for byte.
 */

export const PROBES_DIR = join(__dirname, "probes");
export const EXPECTED_DIR = join(__dirname, "expected");
const INCLUDE = "parity.inc.asm";

/** Where the result block lives: track 79, side 2, sector 10 */
export const RESULT_OFFSET = mgtSectorOffset(128 + 79, 10);
export const RESULT_SIZE = 512;

export type ParityRecord = { name: string; value: number };
export type ParityResult = { version: number; records: ParityRecord[] };

/** The probes' names (`probes/<name>.kz80.asm`, the include left out) */
export function probeNames(): string[] {
  return readdirSync(PROBES_DIR)
    .filter((f) => f.endsWith(".kz80.asm"))
    .map((f) => f.slice(0, -".kz80.asm".length))
    .sort();
}

/**
 * The machine a probe runs on, from flags in its source: "@extmem" (a 1 MB external pack), "@ram256" (the
 * 256K model), "@rom31" (ROM 3.1). dev/scripts/sam-parity/oracle.cjs reads the same flags.
 */
export function probeMachine(name: string): {
  extmem: boolean;
  model: string;
  rom: string;
  disk2?: "rw" | "wp";
  image: "mgt" | "sad" | "edsk";
  typed?: string;
  hold?: string;
  tape?: string;
} {
  const source = readFileSync(join(PROBES_DIR, `${name}.kz80.asm`), "utf8");
  return {
    extmem: /@extmem/.test(source),
    model: /@ram256/.test(source) ? "sam256" : "sam512",
    rom: /@rom31/.test(source) ? "31" : "30",
    // --- "@disk2": a second drive with a blank 800K disk; "@disk2wp": the same disk write-protected
    disk2: /@disk2wp/.test(source) ? "wp" : /@disk2/.test(source) ? "rw" : undefined,
    // --- "@image sad" / "@image edsk": the boot disk in that format instead of MGT
    image: (/@image (sad|edsk)/.exec(source)?.[1] as "sad" | "edsk" | undefined) ?? "mgt",
    // --- "@typed <text>": the text and RETURN typed into SAM BASIC's editor before the probe boots
    typed: /@typed (.*)$/m.exec(source)?.[1],
    // --- "@hold <key>": a SamKeyCode key held from the probe's start
    hold: /@hold (\w+)/.exec(source)?.[1],
    // --- "@tape <name>": the tape of that name (tapes.ts) in the deck from the start
    tape: /@tape ([\w-]+)/.exec(source)?.[1]
  };
}

/** The blank disk "@disk2" probes find in drive 2: 819 200 bytes, each sector filled with its number */
export function blankDisk2(): Uint8Array {
  const image = new Uint8Array(80 * 2 * 10 * 512);
  for (let s = 0; s < 1600; s++) image.fill(s & 0xff, s * 512, s * 512 + 512);
  return image;
}

/** The sample rate of a sound probe's recording (SimCoupé's is the loopback device's) */
export const SOUND_RATE = 48_000;

/** Whether a probe is heard ("@sound" in its source): its output is recorded in both emulators */
export function probeHasSound(name: string): boolean {
  return /@sound/.test(readFileSync(join(PROBES_DIR, `${name}.kz80.asm`), "utf8"));
}

/** Whether a probe draws a picture to compare ("@picture" in its source) */
export function probeHasPicture(name: string): boolean {
  return /@picture/.test(readFileSync(join(PROBES_DIR, `${name}.kz80.asm`), "utf8"));
}

/** Assembles the shared frame and one probe into a bootable .mgt */
export async function buildProbeDisk(name: string): Promise<Uint8Array> {
  const probe = readFileSync(join(PROBES_DIR, `${name}.kz80.asm`), "utf8");
  // --- "@use <name>" appends probes/<name>.inc.asm after the probe, in the order they are named
  const uses = [...probe.matchAll(/@use (\w[\w-]*)/g)].map((m) => readFileSync(join(PROBES_DIR, `${m[1]}.inc.asm`), "utf8"));
  const source = [readFileSync(join(PROBES_DIR, INCLUDE), "utf8"), probe, ...uses].join("\n");
  const out = await new Z80Assembler().compile(source);
  if (out.errors.length > 0) {
    throw new Error(`${name}: ${out.errors.map((e) => `line ${e.line}: ${e.message}`).join("; ")}`);
  }
  if (out.modelType !== SpectrumModelType.SamCoupe) throw new Error(`${name}: not assembled for the SAM`);
  const placement = placeSamCode(
    out.segments.map((s) => ({ startAddress: s.startAddress, emittedCode: s.emittedCode })),
    out.entryAddress
  );
  if ("code" in placement) throw new Error(`${name}: ${placement.code}`);
  return buildSamBootDisk(placement);
}

/** Decodes the result block of a disk image; undefined when the probe never wrote it */
export function readResult(image: Uint8Array): ParityResult | undefined {
  const block = image.subarray(RESULT_OFFSET, RESULT_OFFSET + RESULT_SIZE);
  if (String.fromCharCode(...block.subarray(0, 4)) !== "KLPR") return undefined;
  const count = block[5];
  const records: ParityRecord[] = [];
  for (let i = 0; i < count; i++) {
    const at = 16 + i * 12;
    const name = String.fromCharCode(...block.subarray(at, at + 8)).trimEnd();
    const value = (block[at + 8] | (block[at + 9] << 8) | (block[at + 10] << 16) | (block[at + 11] << 24)) >>> 0;
    records.push({ name, value });
  }
  return { version: block[4], records };
}

/**
 * Runs a probe disk in Klive as Run does (a key leaves the copyright screen, F9 boots) until the frame
 * signals the end with a green (done) or red (write failed) border; returns the written-back image
 */
export async function runProbeInKlive(
  disk: Uint8Array,
  {
    maxFrames = 3000,
    extmem = false,
    model = "sam512",
    rom = "30",
    disk2,
    image = "mgt",
    typed,
    hold,
    tape,
    picture,
    audio
  }: {
    maxFrames?: number;
    extmem?: boolean;
    model?: string;
    rom?: string;
    disk2?: "rw" | "wp";
    image?: "mgt" | "sad" | "edsk";
    typed?: string;
    hold?: string;
    tape?: string;
    picture?: (pixels: Uint32Array) => void;
    /** Gets the output's samples, frame by frame, from F9 to the probe's end (at SOUND_RATE) */
    audio?: (left: number[], right: number[]) => void;
  } = {}
): Promise<Uint8Array> {
  const s = await createSamSession({ extmem, model, rom, drives: disk2 ? 2 : 1 });
  if (audio) s.machine.setMachineProperty(AUDIO_SAMPLE_RATE, SOUND_RATE);
  s.insertDisk(0, image === "sad" ? mgtToSad(disk) : image === "edsk" ? mgtToEdsk(disk) : disk);
  if (disk2) s.insertDisk(1, blankDisk2(), { writeProtected: disk2 === "wp" });
  if (tape) s.insertTape(tapeBlocks(probeTape(tape)), { fastLoad: false });
  s.bootToCopyright();
  s.pressKey(SamKeyCode.Space).runFrames(20);
  if (typed !== undefined) s.typeKeys(`${typed}\n`);
  // --- A typed line that boots by itself (LOAD ...: BOOT) needs no F9
  if (!typed?.includes("BOOT")) s.pressKey(SamKeyCode.F9);
  if (hold) {
    const key = SamKeyCode[hold];
    if (key === undefined) throw new Error(`@hold: no key ${hold}`);
    s.runUntil(() => s.wasm.samGetCpuPc() >= 0x8000 && s.wasm.samGetCpuPc() < 0xc000, { maxFrames }, "the probe's start").keyDown(key);
  }
  // --- The probe runs in page 1 (8000h-BFFFh); the ROM's LOAD runs ROM1 code at C000h+ with a red border
  const ended = () =>
    s.wasm.samGetCpuPc() >= 0x8000 && s.wasm.samGetCpuPc() < 0xc000 && [2, 4].includes(s.wasm.samGetBorder() & 0x07);
  if (audio) {
    for (let frame = 0; !ended(); frame++) {
      if (frame >= maxFrames) throw new Error(`the probe's end did not happen in ${maxFrames} frames`);
      s.runFrames(1);
      const samples = s.machine.getAudioSamples();
      audio(
        samples.map((x) => x.left),
        samples.map((x) => x.right)
      );
    }
  } else {
    s.runUntil(ended, { maxFrames }, "the probe's end");
  }
  if ((s.wasm.samGetBorder() & 0x07) !== 4) throw new Error("the probe could not write its result (red border)");
  s.runFrames(5);
  picture?.(s.pixels());
  const written = s.publishedDiskA();
  if (!written) throw new Error("the machine published no disk image");
  return written;
}

/** The recorded values: name -> value */
export function recordMap(result: ParityResult): Record<string, number> {
  return Object.fromEntries(result.records.map((r) => [r.name, r.value]));
}
