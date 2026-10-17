# Boriel BASIC integration — handoff

For the next AI session. Written 2026-10-17 at the end of Phase B4 on branch `dotneteer/zxbasic-2`.
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
| `.ai/boriel/boriel-issues.md` | zxbc defects found (11 items; two worked around in the adapter) |
| `vendor/boriel-basic/README.md` | Where the setup kits live, and how a clone gets them |

## Where things stand

| Phase | State | Commit |
| --- | --- | --- |
| B0: kit verification, facts | done | `61d119ab7` (and kit move `ceba64395`) |
| B1: bundle, installer, setup dialog, first-run offer | done | `a412a7fcf` |
| B2: `BorielCompiler`, options, diagnostics, switch, 1.x removal | done | `e0e730165` |
| B3: `.dbg` adapter, fixtures, source-level debugging | done | `1bc26fcc7` |
| B4: FASTCALL frames, validator warning, Next error stop, NEX sidecar | done except one open issue | the commit after this file |
| B5: banked programs (`--split-modules`), 128K bank injection, trampoline decoding | not started | — |
| B6: settings/status-bar polish, competitive analysis update | not started | — |

**What works (each verified in the running app or on the real cores):**

- Install from the first-run offer or Settings › Integrations › Boriel BASIC (`~/zxbasic2` by default).
- Switch the compiler: the dialog checkbox, or `set zxbasic.compiler boriel`.
- Build, run, inject and export on 48K, 128K, +3, Timex, Scorpion and Next.
- Diagnostics with codes.
- Source breakpoints, the execution point, Step Into/Over/Out, the call stack (FASTCALL included),
  the Variables panel, watches, and runtime-error stops (48K; Next core).

## The open issue: Next breakpoints in an IDE debug run

In the running app, with Boriel selected on a ZX Spectrum Next project, a breakpoint never pauses the
program. The program loads through NextZXOS and runs correctly; the same flow with Klive BASIC pauses.

**Reproduce:**

```
npx electron-vite build --config build/electron.vite.config.ts
node scripts/boriel-ide-check.cjs next
```

It needs `~/zxbasic2` (or `BORIEL_ROOT`) and `~/Klive/ks2.cim`, and takes about two minutes. The
plan's §6 "Open" lists what is ruled out (the core, breakpoint resolution, keystroke suppression,
timing) and the suspects, starting with the Next debug-run path for a `prebuiltNex` output.

## Next steps, in order

1. **Fix the open issue above**, then make `scripts/boriel-ide-check.cjs next` pass.
2. **Verify in the app** what only unit tests cover so far: TAP export of a Boriel build, the NEX
   export's sidecar, and `nex-run -d` on that NEX.
3. **Phase B5** (plan §7):
   - banked 128K: build with `-f z80 -B -a` and read the snapshot's banks into segments;
   - banked Next: the `.nex` carries the banks;
   - a decoder for zxbc's far-call trampoline (`extensions.codebank.callFar`), so the call stack
     walks through bank switches.

   Partition numbering is settled in `.ai/boriel/dbg-observed.md` (128K: 16K bank; Next: first
   8K page + offset).
4. **Phase B6:**
   - the settings row and status bar (plan §8);
   - the `.plans/LANDING_PAGE_COMPETITIVE_ANALYSIS.md` tables (standing instruction in `AGENTS.md`);
   - the Next BASIC template uses CODEBANK, which Boriel cannot compile, so it is not yet a shared
     template.
5. **Unverified platforms.** The x86_64 Linux and Windows kits have never been run. Unchecked on
   Windows: Windows `;` as the `-I` separator (`boriel-options.ts`), and skipping the 34.5 MB of
   `.pdb` files.

## How to work on this

- **Tests:**
  - Unit: `test/main/boriel-*.test.ts`, `test/main/tool-install-archive.test.ts`,
    `test/boriel/dbg-adapter.test.ts`, `test/dialogs/boriel/`.
  - Core (e2e-kbasic tier): `test/boriel/boriel-debugger.test.ts` (48K), `test/boriel/boriel-next.test.ts` (Next).
- **Fixtures** are zxbc output for Klive's own programs, committed under decision B-T1. Never edit
  them by hand: `npm run boriel:fixtures -- <path to zxbc>`. A new one is a folder with `program.bas`
  and `fixture.json` (`"nex": true` adds a `.nex`).
- **The real zxbc in tests:** `boriel-install-service.test.ts` and `boriel-compiler.test.ts` install
  the kit into a temp folder and run it when `vendor/boriel-basic/kits/` holds this platform's kit.
  `npm run dev` fetches it.
- **macOS:** never run a zxbc that still carries `com.apple.quarantine` (`.ai/boriel/kit.md`). A
  quarantined first launch blocks forever.
- **Provenance:** do not read the kit's `lib/` runtime or stdlib to design Klive BASIC
  (`.plans/ZXBASIC_COMPILER_PLAN.md` §0.1).
- **Unrelated flaky test:** `test/main/annotation-file-watcher.test.ts` fails occasionally under the
  full unit tier's load and passes alone.
