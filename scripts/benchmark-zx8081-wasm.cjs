/*
 * Benchmarks the Sinclair ZX80/ZX81 WASM core (`.plans/ZX8081_WASM_PLAN.md` §12): milliseconds per
 * 20 ms (PAL) emulation frame and the multiple of real time, with the real ROM, in three scenarios -
 * SLOW mode at the prompt (the display routine runs every line), SLOW mode running BASIC (`10 GOTO
 * 10`), and FAST mode running the same. The plan's floor is 10x real time in SLOW mode, to catch
 * per-T hook cost early.
 *
 * Usage: npm run benchmark:zx8081-wasm   (builds the artifact first)
 */
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { buildZx8081Wasm, productionOutput } = require("./build-zx8081-wasm.cjs");

const ROM = join(__dirname, "../src/public/roms/zx81.rom");
const FRAMES = 1000;
const FLOOR = 10;

async function machine() {
  const { instance } = await WebAssembly.instantiate(readFileSync(productionOutput));
  const x = instance.exports;
  x.zx8081Configure(1, 1, 16, 0);
  new Uint8Array(x.memory.buffer, x.zx8081RomPtr(), 8192).set(readFileSync(ROM));
  x.zx8081HardReset();
  const frames = (n) => {
    for (let i = 0; i < n; i++) x.zx8081ExecuteFrame();
  };
  // --- Keys held 4 frames and released 6: the ROM's debounce needs 4 key-free frames
  const type = (...chords) => {
    for (const chord of chords) {
      chord.forEach((k) => x.zx8081SetKeyStatus(k, 1));
      frames(4);
      chord.forEach((k) => x.zx8081SetKeyStatus(k, 0));
      frames(6);
    }
  };
  frames(200);
  return { x, frames, type };
}

function measure(label, frames) {
  const start = performance.now();
  frames(FRAMES);
  const ms = (performance.now() - start) / FRAMES;
  const times = 20 / ms;
  console.log(`${label.padEnd(32)} ${ms.toFixed(3)} ms/frame  ${times.toFixed(0)}x real time`);
  return times;
}

(async () => {
  buildZx8081Wasm();
  // --- Key codes: line * 5 + bit
  const [N1, N0, G, R, F, SHIFT, NL] = [15, 20, 9, 13, 8, 0, 30];

  const idle = await machine();
  const slowIdle = measure("SLOW, at the prompt", idle.frames);

  const running = await machine();
  running.type([N1], [N0], [G], [N1], [N0], [NL]);
  running.frames(30);
  running.type([R], [NL]);
  const slowRunning = measure("SLOW, running 10 GOTO 10", running.frames);

  const fast = await machine();
  fast.type([SHIFT, F], [NL]);
  fast.frames(30);
  fast.type([N1], [N0], [G], [N1], [N0], [NL]);
  fast.frames(30);
  fast.type([R], [NL]);
  measure("FAST, running 10 GOTO 10", fast.frames);

  if (Math.min(slowIdle, slowRunning) < FLOOR) {
    console.error(`SLOW mode is below the ${FLOOR}x real-time floor.`);
    process.exitCode = 1;
  }
})();
