# Boriel BASIC integration — handoff

For the next AI session. Written 2026-10-17 after Phase B4's last fix on branch `dotneteer/zxbasic-2`.
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
| `.ai/boriel/boriel-issues.md` | zxbc defects found (13 items; Klive works around several) |
| `vendor/boriel-basic/README.md` | Where the setup kits live, and how a clone gets them |

## Where things stand

| Phase | State | Commit |
| --- | --- | --- |
| B0: kit verification, facts | done | `61d119ab7` (and kit move `ceba64395`) |
| B1: bundle, installer, setup dialog, first-run offer | done | `a412a7fcf` |
| B2: `BorielCompiler`, options, diagnostics, switch, 1.x removal | done | `e0e730165` |
| B3: `.dbg` adapter, fixtures, source-level debugging | done | `1bc26fcc7` |
| B4: FASTCALL frames, validator warning, Next error stop, NEX sidecar | done | `8a4d59c93` |
| B4 fix: Next breakpoints (`.nex` built without `--debug`), in-app export checks | done | the commit after this file |
| B5: banked programs (`--split-modules`), 128K bank injection, trampoline decoding | not started | — |
| B6: settings/status-bar polish, competitive analysis update | not started | — |

**What works (each verified in the running app or on the real cores):**

- Install from the first-run offer or Settings › Integrations › Boriel BASIC (`~/zxbasic2` by default).
- Switch the compiler: the dialog checkbox, or `set zxbasic.compiler boriel`.
- Build, run, inject and export on 48K, 128K, +3, Timex, Scorpion and Next.
- Diagnostics with codes.
- Source breakpoints, the execution point, Step Into/Over/Out, the call stack (FASTCALL included),
  the Variables panel, watches, and runtime-error stops (48K; Next core).
- Source breakpoints in an IDE debug run on the Next, through NextZXOS.
- TAP export; the Next's NEX export with its debug sidecar; `nex-run -d` of that NEX.

`scripts/boriel-ide-check.cjs` checks all of this in the running app (parts `run`, `debug`, `next`,
`export`; all pass).

## The trap the last fix found

**`--debug=FILE` changes the code zxbc generates.** Every zxbc run whose output must match the
debugged program passes it (`BorielCompiler`'s `sameCode`). Without it the Next ran a `.nex` shifted
by two bytes against the `.bin`'s `.dbg`, and no breakpoint ever fired. A `.nex` that does not hold
the `.bin` image now gets a `ZXBC-D` warning. Details: plan §6 and `.ai/boriel/cli-and-diagnostics.md`.

**Running the IDE check:**

```
npx electron-vite build --config build/electron.vite.config.ts
node scripts/boriel-ide-check.cjs [run|debug|next|export]
```

It needs `~/zxbasic2` or `BORIEL_ROOT`; `next` and `export` also need `~/Klive/ks2.cim`. A kit
unpacked from `vendor/boriel-basic/kits/` works as `BORIEL_ROOT` once `xattr -dr
com.apple.quarantine` has been run on it. All parts take about five minutes.

## Next steps, in order

1. **Phase B5** (plan §7):
   - banked 128K: build with `-f z80 -B -a` and read the snapshot's banks into segments. That run
     produces the code Klive debugs, so it must pass `--debug` (see the trap above);
   - banked Next: the `.nex` carries the banks;
   - a decoder for zxbc's far-call trampoline (`extensions.codebank.callFar`), so the call stack
     walks through bank switches.

   Partition numbering is settled in `.ai/boriel/dbg-observed.md` (128K: 16K bank; Next: first
   8K page + offset).
2. **Phase B6:**
   - the settings row and status bar (plan §8);
   - the `.plans/LANDING_PAGE_COMPETITIVE_ANALYSIS.md` tables (standing instruction in `AGENTS.md`);
   - the Next BASIC template uses CODEBANK, which Boriel cannot compile, so it is not yet a shared
     template.
3. **Unverified platforms.** The x86_64 Linux and Windows kits have never been run. Unchecked on
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
