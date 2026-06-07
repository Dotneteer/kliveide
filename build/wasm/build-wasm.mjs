import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const wasmTargets = [
  {
    name: "bitmap-demo",
    source: "src/wasm/bitmap-demo/bitmap-demo.c",
    output: "public/wasm/bitmap-demo.wasm",
    exports: ["bitmap_width", "bitmap_height", "bitmap_ptr", "render_frame"]
  },
  {
    name: "z80",
    source: "src/emu/z80/z80.c",
    output: "public/wasm/z80.wasm",
    exports: [
      "z80_memory_ptr",
      "z80_reset",
      "z80_execute_cpu_cycle",
      "z80_get_tacts",
      "z80_set_tacts",
      "z80_get_af",
      "z80_set_af",
      "z80_get_bc",
      "z80_set_bc",
      "z80_get_de",
      "z80_set_de",
      "z80_get_hl",
      "z80_set_hl",
      "z80_get_af_alt",
      "z80_set_af_alt",
      "z80_get_bc_alt",
      "z80_set_bc_alt",
      "z80_get_de_alt",
      "z80_set_de_alt",
      "z80_get_hl_alt",
      "z80_set_hl_alt",
      "z80_get_ix",
      "z80_set_ix",
      "z80_get_iy",
      "z80_set_iy",
      "z80_get_ir",
      "z80_set_ir",
      "z80_get_wz",
      "z80_set_wz",
      "z80_get_pc",
      "z80_set_pc",
      "z80_get_sp",
      "z80_set_sp",
      "z80_get_prefix",
      "z80_get_halted"
    ]
  }
];

export async function buildWasm({ silent = false } = {}) {
  for (const target of wasmTargets) {
    await buildTarget(target, { silent });
  }
}

async function buildTarget(target, { silent }) {
  const outputPath = resolve(repoRoot, target.output);
  await mkdir(dirname(outputPath), { recursive: true });

  const args = [
    "--target=wasm32",
    "-O3",
    "-nostdlib",
    "-Wl,--no-entry",
    "-Wl,--export-memory",
    ...target.exports.map((exportName) => `-Wl,--export=${exportName}`),
    "-o",
    target.output,
    target.source
  ];

  if (!silent) {
    console.log(`[wasm] Building ${target.name}`);
  }

  await run("clang", args);
}

function run(command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      stdio: "inherit"
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  buildWasm().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
