# Z88-DK Integration Plan for Klive IDE

## Goal

Compile C programs with Z88-DK's `zcc` for all ZX Spectrum models (48K, 128K, +3e, Next) and inject/run the resulting binaries through Klive's emulator.

## Current State

The codebase already has:
- `z88dk-config.ts` — config key stubs (`z88dk.root`)
- `Zcc.ts` — a full `ZccCommandManager` wrapping `zcc` CLI via `CliManager`
- `Z88DK.ts` — a KSX script-callable `Z88dk.compile()` function
- `Z88DkCommands.ts` — an IDE command `z88dk-reset` to set the install folder
- A project template at `src/public/project-templates/sp48/z88-dk/` with a build script (`build.ksx`) that calls `Z88dk.compile()` and injects binary output
- File type registry already maps `.c` files to `subType: "c"` with `canBeBuildRoot: true`

What's **missing** is a proper `IKliveCompiler` implementation (like `Pasta80Compiler` or `ZxBasicCompiler`) that:
1. Maps machine model → `zcc` target/subtarget flags
2. Reads settings for compiler options
3. Invokes `zcc`, parses output, returns `KliveCompilerOutput`
4. Is registered in the compiler registry so `.c` files compile through the standard build flow (not only via KSX scripts)

---

## Steps

### Step 1 — Expand `z88dk-config.ts` with settings keys

Add configuration keys for the options Klive needs to expose:

| Key | Purpose |
|-----|---------|
| `z88dk.root` | Z88-DK installation folder (already exists) |
| `z88dk.compiler` | Backend compiler: `"sccz80"` (default) or `"sdcc"` |
| `z88dk.optimizationLevel` | Peephole opt level (0–3, default 2) |
| `z88dk.machineCodeOrigin` | Override `-zorg` (optional) |
| `z88dk.createApp` | Generate emulator-ready file via `appmake` (bool) |
| `z88dk.keepTempFiles` | Keep intermediate `.o` / `.asm` files (bool) |
| `z88dk.additionalArgs` | Raw extra CLI args (string, advanced users) |

**Test:** Unit-test that each constant matches its expected string literal.

---

### Step 2 — Create `Z88dkCompiler.ts` implementing `IKliveCompiler`

Create `src/main/z88dk-integration/Z88dkCompiler.ts` following the `Pasta80Compiler` pattern:

- `id = "Z88dkCompiler"`
- `language = "z88dk-c"` (new language key to distinguish from generic C)
- `providesKliveOutput = true`
- `setAppState()` — stores state
- `compileFile(filename)`:
  1. Read install folder from `z88dk.root` setting; error if missing.
  2. Map current machine ID → zcc target string (`+zx` for 48K/128K/+3e, `+zxn` for Next).
  3. Map current machine ID → zcc target options (e.g., `-subtype=nex` for Next, `-startup=31` for Next, no special flags for 48K).
  4. Build args: target, `-mz80` or `-mz80n`, `-compiler=sccz80|sdcc`, `-O<level>`, `-create-app`, etc.
  5. Invoke `createZccRunner()` with the assembled options.
  6. On failure → return errors from `CompilerResult`.
  7. On success → read the output binary (`_output.bin`), wrap in `BinarySegment`, return `InjectableOutput`.
  8. Clean up temp files unless `keepTempFiles` is set.
- `lineCanHaveBreakpoint()` → return `false` (no source-level debug initially).
- `getErrorFilterDescription()` — reuse the filter from `ZccCommandManager`.

**Test:** 
- Mock `CliRunner`/`CliManager`, verify correct args for each machine model.
- Verify error cases (missing install folder, compilation failure).
- Verify the binary is read and returned as a proper segment.

---

### Step 3 — Register the compiler in the compiler registry

In `src/main/compiler-integration/compiler-registry.ts`:
- Import `Z88dkCompiler`
- Add `registry.registerCompiler(new Z88dkCompiler())`

**Test:** Verify `registry.getCompiler("z88dk-c")` returns the new compiler.

---

### Step 4 — Map `.c` files to the `z88dk-c` language in the file type registry

In `src/renderer/registry.ts`, update the `.c` file entry:
- Change `subType` from `"c"` to `"z88dk-c"` so the build system routes `.c` build roots to `Z88dkCompiler`.

Alternatively, keep `subType: "c"` and register the compiler with `language = "c"`. Choose whichever is simpler — the key requirement is that clicking "Build" on a `.c` file invokes the Z88-DK compiler.

**Test:** Open a `.c` file in a project, verify it resolves to the Z88-DK compiler.

---

### Step 5 — Machine-model-to-target mapping

Implement a helper function `machineIdToZ88dkTarget(machineId)` (follow the `machineIdToTarget` pattern in `Pasta80Compiler.ts`):

| Machine ID | zcc target | Extra flags |
|------------|-----------|-------------|
| `MI_SPECTRUM_48` | `+zx` | (none) |
| `MI_SPECTRUM_128` | `+zx` | `-startup=4` (128K mode) |
| `MI_SPECTRUM_3E` | `+zx` | `-startup=4` |
| `MI_ZXNEXT` | `+zxn` | `-subtype=nex` |

Z88-DK uses the `+zx` target for classic Spectrum and `+zxn` for Next. Startup values select memory model and ROM paging behaviour.

**Test:** Unit-test the mapping for each machine constant. Verify the exact args produced.

---

### Step 6 — Enhance the `z88dk-reset` command with `-p` (project scope) support

Update `Z88DkCommands.ts` to accept a `-p` flag (like `ResetSjasmPlusCommand`), so users can store the Z88-DK path per-project or per-user.

**Test:** Run `z88dk-reset /path/to/z88dk` and verify the setting is persisted. Run with `-p` inside a project and verify project-scoped storage.

---

### Step 7 — Add project templates for 128K and Next

Create new project templates alongside the existing `sp48/z88-dk`:

- `src/public/project-templates/sp128/z88-dk/` — Hello World for 128K
- `src/public/project-templates/spNext/z88-dk/` — Hello World for Next (using `<arch/zxn.h>`)

Each template contains:
- `__$klive.project` — `builder.roots` pointing to `code/main.c`
- `code/main.c` — minimal C program using target-appropriate headers
- `build.ksx` — calls `Z88dk.compile()` or uses the standard build flow

**Test:** Create a project from each template, verify it compiles and runs.

---

### Step 8 — Environment variable setup  

Z88-DK requires the `ZCCCFG` (or `Z88DK_HOME`) environment variable to find its config files. In `Z88dkCompiler.compileFile()`, pass the environment to `CliRunner`:

```typescript
const env = {
  ...process.env,
  ZCCCFG: `${installFolder}/lib/config`,
  Z80_OZFILES: `${installFolder}/lib/`,
  PATH: `${installFolder}/bin:${process.env.PATH}`
};
```

**Test:** Verify compilation succeeds with only `z88dk.root` set (no manual env vars).

---

### Step 9 — Update the existing `build.ksx` for multi-model support

Update `src/public/project-templates/sp48/z88-dk/build.ksx` so that:
- `buildCode()` passes the correct target based on the running machine model
- Alternatively, make this automatic inside `Z88dkCompiler` (preferred — then `build.ksx` stays simple)

The existing KSX script `Z88dk.compile(filename, options, target)` already accepts a target parameter. This can be left as an advanced override while the `IKliveCompiler` path picks the target automatically.

**Test:** Switch the emulator between 48K, 128K, and Next, build the same `.c` file, verify correct target flags.

---

### Step 10 — End-to-end smoke test

1. Install Z88-DK locally.
2. Run `z88dk-reset /path/to/z88dk` in the Klive command bar.
3. Create a new project from the SP48/Z88-DK template.
4. Press Build → verify `.c` compiles to binary, output panel shows success.
5. Press Run → verify code is injected into the running 48K emulator.
6. Switch to SP128 machine → rebuild → verify 128K-targeted binary.
7. Switch to Next machine → rebuild → verify Next-targeted binary.

---

## Implementation Order & Dependencies

```
Step 1 (config keys)
  └── Step 2 (Z88dkCompiler)
        ├── Step 5 (target mapping — used in Step 2 but can be coded/tested independently)
        ├── Step 8 (env vars — part of Step 2 execution logic)
        └── Step 3 (register compiler)
              └── Step 4 (file type mapping)
                    └── Step 9 (build.ksx update)
Step 6 (command enhancement) — independent, do any time
Step 7 (project templates) — after Step 5
Step 10 (end-to-end test) — after all above
```

Recommended order: **1 → 5 → 8 → 2 → 3 → 4 → 6 → 7 → 9 → 10**

## Notes

- The existing `ZccCommandManager` in `Zcc.ts` already handles CLI invocation, option composition, error parsing, and output file reading. `Z88dkCompiler` should reuse it via `createZccRunner()` rather than duplicating that logic.
- Source-level debugging is **out of scope** for the initial integration. Z88-DK can produce `.map` files (`--gen-map-file`) and list files (`--list`) — these can be parsed in a future step to support breakpoints and source mapping.
- The `.c` → `z88dk-c` language mapping may need a Klive project property (e.g., `"compiler": "z88dk"`) to disambiguate `.c` files for projects using a different C compiler in the future.
