/*
 * The memory-layout fingerprint of a WASM machine core
 * (`.plans/SNAPSHOT_SAVING_AND_STATE_FILES_PLAN.md` §4.6, D7).
 *
 * A Klive state file is an image of a core's linear memory. It is only valid for a core build whose
 * memory has the same layout, so every build stamps its layout into the `.wasm` it produces, as a
 * `klive.layout` custom section that the loaders read with `WebAssembly.Module.customSections`:
 *
 *   { version: 1, fingerprint, codeHash, memorySize, volatile: [{ symbol, address, size }] }
 *
 * The fingerprint is a SHA-256 over:
 *  - every data symbol (initialised, read-only and zero-initialised) with its address and size, from
 *    the linker map (`-Wl,--Map=...`);
 *  - the indirect-function table as function *names* in table order, because a function pointer in
 *    memory is a table index: a rebuild that renumbers the table would make a restored pointer call
 *    the wrong function (trap 15). The table holds function indices (the element section); the map
 *    lists the functions in index order, which turns indices into names;
 *  - the memory size and the initial stack pointer.
 * A code change that moves no static and changes no table entry keeps the fingerprint, so state
 * files saved before it stay loadable.
 *
 * `volatile` lists the statics a state does not need (trace rings, logs, audio buffers): the image
 * leaves them out and a restore keeps the live core's bytes there (trap 10). Each core's build
 * script names them.
 */

const { createHash } = require("node:crypto");
const { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync, rmSync, renameSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join, basename } = require("node:path");

/** The custom section's name */
const LAYOUT_SECTION = "klive.layout";

/** A temporary path for a build's linker map */
function layoutMapPath(outputPath) {
  return join(tmpdir(), `${basename(outputPath)}-${process.pid}-${Date.now()}.map`);
}

/** The linker flag that writes the map */
function layoutMapArgs(mapPath) {
  return [`-Wl,--Map=${mapPath}`];
}

/**
 * Parses a wasm-ld map into its data symbols (in address order) and its functions (in index order)
 * @param {string} mapText
 */
function parseLinkerMap(mapText) {
  const symbols = [];
  const functions = [];
  let section = "";
  for (const line of mapText.split(/\r?\n/)) {
    // --- "    Addr      Off     Size Out     In      Symbol": the column of the name tells its kind
    const match = /^\s*(\S+)\s+(\S+)\s+(\S+)( +)(.*)$/.exec(line);
    if (!match) continue;
    const [, addr, , size, gap, rest] = match;
    if (addr === "Addr") continue;
    if (gap.length === 1) {
      // --- An output section header ("CODE", "DATA", ".bss", ...)
      section = rest.trim();
      if (addr !== "-" && /^\./.test(section)) {
        symbols.push({ symbol: section, address: parseInt(addr, 16), size: parseInt(size, 16) });
      }
      continue;
    }
    const name = rest.trim();
    if (section === "CODE") {
      // --- One input section per function body, in function-index order: "file.o:(name)"
      const body = /:\(([^()]*)\)$/.exec(name);
      if (body) functions.push(body[1]);
      continue;
    }
    // --- Input-section lines name an object file and a section in parentheses: skip them
    if (!name || name.includes("(") || name.includes("/") || name.includes("\\")) continue;
    if (addr !== "-") {
      symbols.push({ symbol: name, address: parseInt(addr, 16), size: parseInt(size, 16) });
    }
  }
  return { symbols, functions };
}

/** Reads an unsigned LEB128 */
function readLeb(bytes, state) {
  let result = 0;
  let shift = 0;
  let byte;
  do {
    byte = bytes[state.offset++];
    result += (byte & 0x7f) * 2 ** shift;
    shift += 7;
  } while (byte & 0x80);
  return result;
}

/** Reads a signed LEB128 (32-bit) */
function readSignedLeb(bytes, state) {
  let result = 0;
  let shift = 0;
  let byte;
  do {
    byte = bytes[state.offset++];
    result |= (byte & 0x7f) << shift;
    shift += 7;
  } while (byte & 0x80);
  if (shift < 32 && byte & 0x40) result |= ~0 << shift;
  return result;
}

/** Writes an unsigned LEB128 */
function writeLeb(value) {
  const out = [];
  do {
    let byte = value & 0x7f;
    value = Math.floor(value / 128);
    if (value) byte |= 0x80;
    out.push(byte);
  } while (value);
  return out;
}

/**
 * Reads what the fingerprint needs from a module's binary: the table's function indices, the
 * initial value of the first global (the stack pointer) and the memory's minimum pages
 */
function readWasmLayoutFacts(bytes) {
  const facts = { table: [], stackPointer: undefined, memoryPages: undefined, importedFunctions: 0 };
  const state = { offset: 8 };
  while (state.offset < bytes.length) {
    const id = bytes[state.offset++];
    const length = readLeb(bytes, state);
    const end = state.offset + length;
    if (id === 2) {
      // --- Imports: imported functions come before the defined ones in the index space
      const count = readLeb(bytes, state);
      for (let i = 0; i < count; i++) {
        for (let k = 0; k < 2; k++) state.offset += readLeb(bytes, state); // --- module, name
        const kind = bytes[state.offset++];
        if (kind === 0) {
          facts.importedFunctions++;
          readLeb(bytes, state);
        } else {
          break; // --- Klive's cores import nothing else; stop rather than misparse
        }
      }
    } else if (id === 5) {
      // --- Memory: count, then limits
      readLeb(bytes, state);
      const flags = bytes[state.offset++];
      facts.memoryPages = readLeb(bytes, state);
      if (flags & 1) readLeb(bytes, state);
    } else if (id === 6) {
      // --- Globals: the first is __stack_pointer, initialised with i32.const
      const count = readLeb(bytes, state);
      if (count > 0) {
        state.offset += 2; // --- valtype, mutability
        if (bytes[state.offset++] === 0x41) facts.stackPointer = readSignedLeb(bytes, state);
      }
    } else if (id === 9) {
      // --- Elements: active segments of function indices (flags 0, or 2 with a table index)
      const count = readLeb(bytes, state);
      for (let s = 0; s < count && state.offset < end; s++) {
        const flags = readLeb(bytes, state);
        if (flags !== 0 && flags !== 2) break;
        if (flags === 2) readLeb(bytes, state);
        // --- Offset expression: i32.const n, end
        state.offset++;
        const base = readSignedLeb(bytes, state);
        state.offset++;
        if (flags === 2) state.offset++; // --- elemkind
        const n = readLeb(bytes, state);
        for (let i = 0; i < n; i++) facts.table[base + i] = readLeb(bytes, state);
      }
    }
    state.offset = end;
  }
  return facts;
}

/**
 * SHA-256 over a module's code and data sections (`.plans/DEBUG_SESSION_RECORDING_PLAN.md` D3, T1):
 * unlike the fingerprint, it changes with any edit inside a function body, so a debug recording - a
 * replay of the exact code that made it - opens only in the build that wrote it. Custom sections
 * (the stamp itself, names) are left out.
 * @param {Uint8Array} bytes The module, before the stamp is appended
 */
function computeCodeHash(bytes) {
  const hash = createHash("sha256");
  const state = { offset: 8 };
  while (state.offset < bytes.length) {
    const id = bytes[state.offset++];
    const length = readLeb(bytes, state);
    if (id === 10 || id === 11) {
      hash.update(Buffer.from([id]));
      hash.update(bytes.subarray(state.offset, state.offset + length));
    }
    state.offset += length;
  }
  return hash.digest("hex");
}

/**
 * Computes the layout of a built core
 * @param {Uint8Array} wasmBytes The module
 * @param {string} mapText The linker map of the same link
 * @param {string[]} volatileSymbols Statics a state leaves out
 */
function computeWasmLayout(wasmBytes, mapText, volatileSymbols = [], scratchSymbols = []) {
  const { symbols, functions } = parseLinkerMap(mapText);
  const facts = readWasmLayoutFacts(wasmBytes);
  const table = facts.table.map(
    (index) => functions[index - facts.importedFunctions] ?? `#${index}`
  );
  const memorySize = (facts.memoryPages ?? 0) * 65536;
  const hash = createHash("sha256");
  hash.update(JSON.stringify({ symbols, table, memorySize, stackPointer: facts.stackPointer }));
  const byName = new Map(symbols.map((s) => [s.symbol, s]));
  const volatile = volatileSymbols.map((name) => {
    const s = byName.get(name);
    if (!s) throw new Error(`The volatile symbol '${name}' is not in the linker map`);
    return { symbol: name, address: s.address, size: s.size };
  });
  // --- Frame-boundary scratch (REVERSE_DEBUGGING_PLAN T5): buffers the core rewrites before it reads
  // --- them, so a keyframe taken at a frame boundary may leave them out. State files keep them, and
  // --- they are not part of the fingerprint.
  const scratch = scratchSymbols.map((name) => {
    const s = byName.get(name);
    if (!s) throw new Error(`The scratch symbol '${name}' is not in the linker map`);
    return { symbol: name, address: s.address, size: s.size };
  });
  // --- The C shadow stack: from the end of the statics below the stack pointer up to it. Between
  // --- exported calls it is unwound, so its bytes are stale frames, not machine state; replay leaves
  // --- it out (REVERSE_DEBUGGING_PLAN Phase 1). Not part of the fingerprint: state files keep it.
  let stack;
  if (typeof facts.stackPointer === "number" && facts.stackPointer > 0) {
    let bottom = 0;
    for (const s of symbols) {
      const end = s.address + s.size;
      if (end <= facts.stackPointer && end > bottom) bottom = end;
    }
    stack = { address: bottom, size: facts.stackPointer - bottom };
  }
  return {
    version: 1,
    fingerprint: hash.digest("hex").slice(0, 32),
    // --- Outside the fingerprint: state files survive a code-only change, debug recordings do not
    codeHash: computeCodeHash(wasmBytes),
    memorySize,
    volatile,
    ...(stack ? { stack } : {}),
    ...(scratch.length ? { scratch } : {})
  };
}

/** Appends a custom section to a module's bytes */
function appendCustomSection(wasmBytes, name, payload) {
  const nameBytes = Buffer.from(name, "utf8");
  const content = Buffer.concat([Buffer.from(writeLeb(nameBytes.length)), nameBytes, payload]);
  return Buffer.concat([
    Buffer.from(wasmBytes),
    Buffer.from([0]),
    Buffer.from(writeLeb(content.length)),
    content
  ]);
}

/**
 * Stamps a freshly linked core with its layout, then deletes the map. A build whose `run` was
 * replaced (the build-script tests) writes no map, and is left as it is.
 * @returns The layout, or undefined when there was no map
 */
function stampWasmLayout(outputPath, mapPath, volatileSymbols = [], scratchSymbols = []) {
  if (!existsSync(mapPath)) return undefined;
  try {
    const bytes = readFileSync(outputPath);
    const layout = computeWasmLayout(bytes, readFileSync(mapPath, "utf8"), volatileSymbols, scratchSymbols);
    writeFileSync(
      outputPath,
      appendCustomSection(bytes, LAYOUT_SECTION, Buffer.from(JSON.stringify(layout), "utf8"))
    );
    return layout;
  } finally {
    // --- A measurement that needs symbol names (the reverse-debugging spike's page attribution)
    // --- asks for a copy of the map: KLIVE_WASM_MAP_DIR=<folder>
    const keepDir = process.env.KLIVE_WASM_MAP_DIR;
    if (keepDir) {
      mkdirSync(keepDir, { recursive: true });
      copyFileSync(mapPath, join(keepDir, `${basename(outputPath)}.map`));
    }
    rmSync(mapPath, { force: true });
  }
}

/*
 * Publishing a build atomically.
 *
 * A build writes its module and then rewrites it with the layout stamp. Test workers run in
 * parallel, and several of them rebuild the same production artifact while others read it: a reader
 * that came between the two writes got a module with no stamp ("built without a memory-layout
 * stamp"), or a half-written file. So a real build compiles and stamps a private staging file next
 * to the output and renames it into place - a rename replaces the file in one step, so a reader sees
 * the old complete module or the new one, never one in between.
 */

/**
 * Where a build compiles before publishing: a staging file beside the output when `atomic` (a real
 * compiler run), else the output itself (a test's fake compiler writes nothing to rename)
 * @param {string} outputPath The artifact
 * @param {boolean} atomic Whether to stage and publish
 */
function stagingWasmOutput(outputPath, atomic) {
  return atomic ? `${outputPath}.${process.pid}-${Date.now()}.partial` : outputPath;
}

/** Waits synchronously (a build script has no event loop to yield to) */
function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Renames a staged build into place, in one step. On Windows a rename onto a file another process
 * has open fails for a moment (EPERM/EBUSY/EACCES), so it is retried briefly.
 * @param {string} stagingPath What `stagingWasmOutput` returned
 * @param {string} outputPath The artifact
 */
function publishWasmOutput(stagingPath, outputPath) {
  if (stagingPath === outputPath) return;
  for (let attempt = 0; ; attempt++) {
    try {
      renameSync(stagingPath, outputPath);
      return;
    } catch (error) {
      if (attempt >= 40 || !["EPERM", "EBUSY", "EACCES"].includes(error?.code)) {
        rmSync(stagingPath, { force: true });
        throw error;
      }
      sleepSync(50);
    }
  }
}

/** Removes a staged build that will not be published (the build failed) */
function discardWasmOutput(stagingPath, outputPath) {
  if (stagingPath !== outputPath) rmSync(stagingPath, { force: true });
}

module.exports = {
  stagingWasmOutput,
  publishWasmOutput,
  discardWasmOutput,
  LAYOUT_SECTION,
  layoutMapPath,
  layoutMapArgs,
  parseLinkerMap,
  readWasmLayoutFacts,
  computeWasmLayout,
  computeCodeHash,
  appendCustomSection,
  stampWasmLayout
};
