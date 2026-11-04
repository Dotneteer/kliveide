const {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeSync
} = require("node:fs");
const { dirname } = require("node:path");

/*
 * A cross-process lock for a WASM build output.
 *
 * Vitest runs test files in parallel workers, and several of them build the same artifact before
 * reading it. Without a lock two clang runs race on one output file. The lock file holds the
 * owner's PID; a lock whose owner is gone, or that is older than the timeout, is cleared.
 *
 * Used by `build-z88-wasm.cjs`. (`build-zxnext-wasm.cjs` carries an older copy of the same logic.)
 */

/**
 * Acquires the lock, waiting for another holder if needed.
 * @param {string} lockPath The lock file
 * @param {string} label What is being built, for the timeout message
 * @param {number} timeoutMs How long to wait before giving up
 * @returns {() => void} Releases the lock
 */
function acquireWasmBuildLock(lockPath, label, timeoutMs = 120000) {
  mkdirSync(dirname(lockPath), { recursive: true });
  const started = Date.now();
  while (true) {
    try {
      const fd = openSync(lockPath, "wx");
      writeSync(fd, `${process.pid}\n${Date.now()}\n`);
      return () => {
        closeSync(fd);
        if (existsSync(lockPath)) unlinkSync(lockPath);
      };
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      clearStaleWasmBuildLock(lockPath, label, started, timeoutMs);
      sleepSync(50);
    }
  }
}

/**
 * Waits until nobody holds the lock (for readers of the artifact).
 * @param {string} lockPath The lock file
 * @param {string} label What is being built, for the timeout message
 * @param {number} timeoutMs How long to wait before giving up
 */
function waitForWasmBuildLock(lockPath, label, timeoutMs = 120000) {
  const started = Date.now();
  while (existsSync(lockPath)) {
    clearStaleWasmBuildLock(lockPath, label, started, timeoutMs);
    sleepSync(50);
  }
}

function clearStaleWasmBuildLock(lockPath, label, started, timeoutMs) {
  if (Date.now() - started > timeoutMs) {
    throw new Error(`Timed out waiting for the ${label} WASM build lock: ${lockPath}`);
  }
  try {
    const ageMs = Date.now() - statSync(lockPath).mtimeMs;
    const owner = readLockOwner(lockPath);
    if (owner?.pid != null && !isProcessAlive(owner.pid)) {
      unlinkSync(lockPath);
      return;
    }
    if (owner == null && ageMs > 1000) {
      unlinkSync(lockPath);
      return;
    }
    if (ageMs > timeoutMs) unlinkSync(lockPath);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

function readLockOwner(lockPath) {
  try {
    const [pidLine] = readFileSync(lockPath, "utf8").split(/\r?\n/);
    const pid = Number.parseInt(pidLine, 10);
    if (!Number.isInteger(pid) || pid <= 0) return undefined;
    return { pid };
  } catch (error) {
    if (error?.code === "ENOENT") return undefined;
    throw error;
  }
}

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

module.exports = {
  acquireWasmBuildLock,
  waitForWasmBuildLock
};
