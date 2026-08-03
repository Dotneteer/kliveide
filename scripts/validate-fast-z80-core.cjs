const { spawnSync } = require("node:child_process");
const { buildSp48Wasm, testOutput } = require("./build-sp48-wasm.cjs");

function run(command, args) {
  const result = spawnSync(command, args, { cwd: process.cwd(), stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with status ${result.status}`);
  }
}

try {
  buildSp48Wasm({ mode: "fast-z80-test", outputPath: testOutput });
  run("npx", ["vitest", "run", "--config", "build/vitest.config.ts", "--project", "node", "test/z80"]);
} finally {
  buildSp48Wasm({ mode: "test" });
}
