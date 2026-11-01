import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/*
 * Building a WASM core for the test harnesses, once per test process and only when it is out of date.
 *
 * Every test file that runs a core is its own vitest process, and each one used to rebuild the core
 * before its first session. The builds are serialised by the build lock (`scripts/wasm-build-lock.cjs`),
 * so with twenty-odd files for one machine a worker's first test could wait for all the others' clang
 * runs and pass its 30-second timeout (the HT-1080Z's sample-file test did, in a full `npm test`). A
 * core that is newer than every input is used as it is.
 */

const REPO_ROOT = join(__dirname, "../..");

/**
 * The core's inputs: every C source and header under `src/emu` (a core includes the shared Z80 and the
 * shared device sources as well as its own) and the build scripts, which carry the flags and exports.
 */
const CORE_INPUTS: readonly { dir: string; pattern: RegExp }[] = [
  { dir: "src/emu", pattern: /\.(c|h)$/ },
  { dir: "scripts", pattern: /\.cjs$/ }
];

/** Whether `output` exists and is newer than every input. */
export function coreIsCurrent(output: string): boolean {
  if (!existsSync(output)) return false;
  const built = statSync(output).mtimeMs;
  const newer = (path: string, pattern: RegExp): boolean => {
    const stat = statSync(path);
    if (stat.isDirectory()) {
      if (path.endsWith("node_modules") || path.endsWith("dist")) return false;
      return readdirSync(path).some((name) => newer(join(path, name), pattern));
    }
    return pattern.test(path) && stat.mtimeMs > built;
  };
  return !CORE_INPUTS.some(({ dir, pattern }) => newer(join(REPO_ROOT, dir), pattern));
}

const checked = new Set<string>();

/** Builds the core at `output` with `build`, once per test process, unless it is already current. */
export function buildCoreOnce(output: string, build: () => void): void {
  if (checked.has(output)) return;
  if (!coreIsCurrent(output)) build();
  checked.add(output);
}
