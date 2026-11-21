/*
 * Benchmarks the SAM Coupé WASM core (`src/emu/machines/samcoupe/wasm/README.md`): milliseconds per 20 ms
 * emulation frame and the multiple of real time, with ROM 3.0, at the copyright screen (the line
 * interrupt's colour bars every line), in SAM BASIC's editor, and with the SAA playing a tone with the host's
 * samples on. The plan's floor is 10x real time (§13).
 *
 * Usage: npm run benchmark:sam-wasm   (builds the artifact first)
 */
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { buildSamWasm, productionOutput } = require("./build-sam-wasm.cjs");
const { REPO_ROOT } = require("./repo-root.cjs");

const ROM = join(REPO_ROOT, "src/public/roms/sam-rom30.rom");
const FRAMES = 1000;
const FLOOR = 10;
/** A frame is 119 808 T at 6 MHz: 19.968 ms */
const FRAME_MS = (119_808 / 6_000_000) * 1000;

async function machine() {
  const { instance } = await WebAssembly.instantiate(readFileSync(productionOutput));
  const x = instance.exports;
  x.samConfigure(32, 0, 1, 1);
  new Uint8Array(x.memory.buffer, x.samRomPtr(), 0x8000).set(readFileSync(ROM));
  x.samHardReset();
  const frames = (n) => {
    for (let i = 0; i < n; i++) x.samExecuteFrame();
  };
  frames(250);
  return { x, frames };
}

function measure(label, frames) {
  const start = performance.now();
  frames(FRAMES);
  const ms = (performance.now() - start) / FRAMES;
  const times = FRAME_MS / ms;
  console.log(`${label.padEnd(32)} ${ms.toFixed(3)} ms/frame  ${times.toFixed(0)}x real time`);
  return times;
}

(async () => {
  buildSamWasm();
  const copyright = await machine();
  const atCopyright = measure("Copyright screen", copyright.frames);

  const editor = await machine();
  editor.x.samSetKeyStatus(56, 1);
  editor.frames(5);
  editor.x.samSetKeyStatus(56, 0);
  editor.frames(50);
  const inEditor = measure("SAM BASIC's editor", editor.frames);

  const sound = await machine();
  sound.x.samSetAudioSampleRate(48_000, 0.9998);
  const saa = (reg, value) => {
    sound.x.samWritePort(0x01ff, reg);
    sound.x.samWritePort(0x00ff, value);
  };
  saa(0x00, 0xff);
  saa(0x08, 200);
  saa(0x10, 0x05);
  saa(0x14, 0x3f);
  saa(0x15, 0x3f);
  saa(0x1c, 0x01);
  const withSound = measure("SAA playing, 48 kHz samples", sound.frames);

  if (Math.min(atCopyright, inEditor, withSound) < FLOOR) {
    console.error(`The core is below the ${FLOOR}x real-time floor.`);
    process.exitCode = 1;
  }
})();
