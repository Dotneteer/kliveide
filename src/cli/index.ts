import { processIo } from "./io";
import { runCli } from "./run-cli";

/*
 * The CLI's entry point (`.plans/UNIT_TESTS_CLI_PLAN.md` D1): Klive's own Electron binary in Node
 * mode (`ELECTRON_RUN_AS_NODE=1`) runs this bundle - no window, no GPU, no display, and never
 * `main/index.ts` with its single-instance lock. It also runs under plain Node.
 *
 *   ELECTRON_RUN_AS_NODE=1 npx electron out/main/cli.js ide status
 */
// --- A reader that stops early (`klive test | head`) closes the pipe: leave quietly, not with a trace
process.stdout.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EPIPE") process.exit(process.exitCode ?? 0);
  throw err;
});

runCli(process.argv.slice(2), processIo()).then(
  (code) => {
    process.exitCode = code;
    // --- Let the streams flush, then leave even if a socket lingers
    setTimeout(() => process.exit(code), 50).unref();
  },
  (err) => {
    process.stderr.write(`Internal error: ${err?.stack ?? err}\n`);
    process.exit(4);
  }
);
