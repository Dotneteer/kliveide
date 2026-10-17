# Boriel BASIC integration — handoff

For the next AI session. Written 2026-10-17 at the end of Phase B6 on branch `dotneteer/zxbasic-2`. All planned phases are done.
The plan is `.plans/BORIEL_BASIC_INTEGRATION_PLAN.md`; each phase's section opens with an
**"As built"** note that records what differs from its design. This file says where things stand and
what to do next.

## Read first

| File | Why |
| --- | --- |
| `.plans/BORIEL_BASIC_INTEGRATION_PLAN.md` §0 | Decisions B1, B-L1, B-T1, B-T2 (binding) |
| the plan's "As built" notes in §2-§6 | What was built, and how it differs from the design text below each note |
| the plan's §10 | What does not work with Boriel compared with Klive BASIC |
| `.ai/boriel/README.md`, then `kit.md`, `cli-and-diagnostics.md`, `dbg-observed.md`, `options.md` | Facts about zxbc 2.0.0-beta25, observed, not assumed |
| `.ai/boriel/boriel-issues.md` | zxbc defects found (15 items; Klive works around several) |
| `vendor/boriel-basic/README.md` | Where the setup kits live, and how a clone gets them |

## Where things stand

| Phase | State | Commit |
| --- | --- | --- |
| B0: kit verification, facts | done | `61d119ab7` (and kit move `ceba64395`) |
| B1: bundle, installer, setup dialog, first-run offer | done | `a412a7fcf` |
| B2: `BorielCompiler`, options, diagnostics, switch, 1.x removal | done | `e0e730165` |
| B3: `.dbg` adapter, fixtures, source-level debugging | done | `1bc26fcc7` |
| B4: FASTCALL frames, validator warning, Next error stop, NEX sidecar | done | `8a4d59c93` |
| B4 fix: Next breakpoints (`.nex` built without `--debug`), in-app export checks | done | `3381503f1` |
| B5: banked programs (`--split-modules`), 128K bank injection, far-call decoding | done | `0a02b2566` |
| B6: settings row, status bar, CODEBANK hint, docs, competitive analysis | done | `118d24dd4` |
| B5 gaps: stepping across far calls, routines crossing `$E000`, banked 128K tape export | done | the commit after this file |

**What works (each verified in the running app or on the real cores):**

- Install from the first-run offer or Settings › Integrations › Boriel BASIC (`~/zxbasic2` by default).
- Switch the compiler: Settings › Integrations › Compiler for BASIC programs, the dialog checkbox, or
  `set zxbasic.compiler boriel`. The first two change the project's choice when it has one.
- The status bar names the compiler of the focused BASIC file; a click opens the Boriel BASIC dialog.
- Build, run, inject and export on 48K, 128K, +3, Timex, Scorpion and Next.
- Diagnostics with codes.
- Source breakpoints, the execution point, Step Into/Over/Out, the call stack (FASTCALL included),
  the Variables panel, watches, and runtime-error stops (48K; Next core).
- Source breakpoints in an IDE debug run on the Next, through NextZXOS.
- TAP export; the Next's NEX export with its debug sidecar; `nex-run -d` of that NEX.
- `USE`d modules (zxbc gets `-m <source folder>`).
- Banked programs (`'@split-modules`) on the 128K and the Next: build, run, partition-qualified
  breakpoints, the execution point in a module file, the call stack and Step Into/Over/Out through
  far calls, and (128K) a TAP/TZX export that loads and runs: it is zxbc's own tape.

`scripts/boriel-ide-check.cjs` checks all of this in the running app (parts `run`, `debug`, `next`,
`export`, `ui`, `banked`; all pass).

## Two traps found late

**zxbc's far calls have a shadow stack** (plan §7 "As built", `.ai/boriel/dbg-observed.md` "Far
calls"); the plan had assumed none. The adapter describes it as a CODEBANK runtime with
`shadowStackKind: "zxbc"`, and `stackReader` (`SourceStepDecision.ts`) reads both layouts. zxbc
frames can sit at odd addresses, which a word-stepped stack scan misses.

**`--debug=FILE` changes the code zxbc generates.** Every zxbc run whose output must match the
debugged program passes it (`BorielCompiler`'s `sameCode`). Without it the Next ran a `.nex` shifted
by two bytes against the `.bin`'s `.dbg`, and no breakpoint ever fired. A `.nex` that does not hold
the `.bin` image now gets a `ZXBC-D` warning. Details: plan §6 and `.ai/boriel/cli-and-diagnostics.md`.

**Running the IDE check:**

```
npx electron-vite build --config build/electron.vite.config.ts
node scripts/boriel-ide-check.cjs [run|debug|next|export|ui|banked]
```

It needs `~/zxbasic2` or `BORIEL_ROOT`; `next`, `export` and `banked` also need `~/Klive/ks2.cim`. A kit
unpacked from `vendor/boriel-basic/kits/` works as `BORIEL_ROOT` once `xattr -dr
com.apple.quarantine` has been run on it. All parts take about ten minutes. The `ui` part brings Klive
to the front: Settings opens in the focused window, and with the app in the background that is the
emulator's.

## Next steps, in order

1. **Unverified platforms.** The x86_64 Linux and Windows kits have never been run. Unchecked on
   Windows: Windows `;` as the `-I` separator (`boriel-options.ts`), and skipping the 34.5 MB of
   `.pdb` files.
2. **Klive sometimes does not quit** under the IDE check's Playwright driver: seen twice, once after
   the `ui` part and once after a Next session paused at a breakpoint. The check now ends such a
   session's process after 20 s and says so. Not Boriel-specific as far as known; worth a look.
3. **The readiness gate** (plan §11) before anyone proposes Boriel as the default: a production
   licence for a non-beta version, installs on every platform from a fresh `HOME`, and every template
   and the debugger corpus through `boriel-ide-check.cjs`. The Next template cannot pass while it uses
   CODEBANK; a Boriel variant of it (a `MODULE` with `'@split-modules`) would.
4. **Small leftovers:** debugging a `.nex` built outside Klive from zxbc's raw `.dbg` (plan §6.4);
   why Klive's own 128K tape loader crashes a banked zxbc program (Klive exports zxbc's tape
   instead, plan §7).

## How to work on this

- **Tests:**
  - Unit: `test/main/boriel-*.test.ts`, `test/main/tool-install-archive.test.ts`,
    `test/boriel/dbg-adapter.test.ts`, `test/dialogs/boriel/`.
  - Unit: also `test/main/boriel-banked.test.ts` (finding a banked program in zxbc's output).
  - Core (e2e-kbasic tier): `test/boriel/boriel-debugger.test.ts` (48K), `test/boriel/boriel-next.test.ts` (Next),
    `test/boriel/boriel-banked.test.ts` (banked, 128K and Next; the sp128 harness has debugger methods now).
- **Fixtures** are zxbc output for Klive's own programs, committed under decision B-T1. Never edit
  them by hand: `npm run boriel:fixtures -- <path to zxbc>`. A new one is a folder with `program.bas`
  and `fixture.json` (`"nex": true` adds a `.nex`; `"banked": true` builds `--split-modules` into
  `program.z80` or `program.nex`; `"from"` builds another fixture's sources).
- **The real zxbc in tests:** `boriel-install-service.test.ts` and `boriel-compiler.test.ts` install
  the kit into a temp folder and run it when `vendor/boriel-basic/kits/` holds this platform's kit.
  `npm run dev` fetches it.
- **macOS:** never run a zxbc that still carries `com.apple.quarantine` (`.ai/boriel/kit.md`). A
  quarantined first launch blocks forever.
- **Provenance:** do not read the kit's `lib/` runtime or stdlib to design Klive BASIC
  (`.plans/ZXBASIC_COMPILER_PLAN.md` §0.1).
- **Unrelated flaky test:** `test/main/annotation-file-watcher.test.ts` fails occasionally under the
  full unit tier's load and passes alone.
