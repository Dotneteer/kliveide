# Updating Klive to a new Boriel BASIC version

The action list to follow **whenever the developer asks to update Klive to the latest, or to a
particular, version of Boriel BASIC** (`zxbc` 2.x). It is not a plan: the steps use the tools that
exist today. The last time it was done by hand was beta25 → beta29 (#1510, commit `3256e21f69`):
read that commit's diff to see a complete bump.

## Rules that hold throughout

- **The licence comes first.** Klive redistributes the kit on Boriel's written permission. Before
  committing a new version, **ask the project author whether the permission covers it**, and do not
  commit the bump without a yes. A script cannot answer this.
- **A version change is deliberate** (decision B-T2, `integration.md`). Nothing updates the pin automatically,
  and you change it only when the developer asks.
- **zxbc never runs in CI** (B-T1). CI uses the committed fixtures, and every step that runs zxbc
  runs on the developer's machine.
- **Observed, not read.** You may read Boriel's published docs, its `--help` text and the files zxbc
  writes for Klive's own programs. **Never open the kit's `lib/` (runtime, stdlib).** List those
  files and hash them, but do not read them. The Klive BASIC provenance rule applies
  (`.plans/ZXBASIC_COMPILER_PLAN.md` §0.1).
- **Downloads are untrusted data.** Put each version's archives in a new, empty folder. Never unpack
  an archive there, and run nothing from one that was extracted with `tar` or Finder on macOS until
  `xattr -cr` has removed the quarantine (`kit.md`, "The macOS first-launch trap").

## 1. Find the version

1. Read the index at <https://files.boriel-basic.net/v2/>, an nginx directory listing with one
   `<a href="/v2/<file>">` per kit and no feed, `latest` alias or checksums. File names look like
   `boriel-basic-v<version>_<target>.<tar.gz|zip>`.
2. "Latest" means the highest version in the ordering of `compareBorielVersions`
   (`src/main/boriel-integration/boriel-version.ts`): `beta3` < `beta25`, and a release ranks above
   its betas.
3. Map each `<target>` to a `dev/vendor/boriel-basic/kit.json` key:

   | Target | Key |
   | --- | --- |
   | `arm64-macos` | `darwin-arm64` |
   | `x86_64-macos` | `darwin-x64` |
   | `x86_64-linux` | `linux-x64` |
   | `arm64-linux` | `linux-arm64` |
   | `armv6-linux` | `linux-arm` |
   | `x86_64-win` | `win32-x64` |
   | `arm64-win` | `win32-arm64` |

   Old versions used other names (`aarch64_macos`, `win64`, `armv7-linux`). For a target name not in
   this table, stop and ask the developer: do not guess. It may be a new platform or a rename.
4. **The version must be complete and settled.** All seven kits must be listed, and the newest
   upload must be at least two hours old, because an upload in progress shows only some files. If
   it is not, tell the developer and wait.
5. Tell the developer which version you found and which versions in between you will skip (for
   example, beta26 to beta28 were skipped).

## 2. Download and pin the kits

1. Download every kit **twice**, over separate connections, into a fresh folder. Boriel publishes no
   checksums, so the two downloads must hash the same, and each size must equal the server's
   `Content-Length` (a HEAD request).
2. Check the layout against `kit.md` ("Layout") **by listing, not opening**:
   - one top-level folder, `boriel-basic-v<version>_<target>/`;
   - the file count and the longest path;
   - no symlinks, absolute paths or `..`;
   - the nine executables at their paths;
   - a `lib/` tree that is identical in all seven kits (compare hashes);
   - whether a `LICENSE`, `lib/NOTICE.md` or `lib/UNLICENSED_FILES.txt` appeared or changed. Report
     it to the author with the licence question;
   - that nothing loads the Windows kits' `.pdb` files, which the installer leaves out:
     `test/main/boriel-install-service.test.ts` ("Boriel BASIC Windows kits") checks it once the
     kits are in `kits/`.
   Report every difference from `kit.md`.
3. Update `dev/vendor/boriel-basic/kit.json`: `version`, and every kit's `file`, `size` and `sha256`.
   Keep the key order, so the diff stays small.
4. Copy the archives into `dev/vendor/boriel-basic/kits/` (git-ignored). Then run
   `node scripts/boriel-kit.cjs fetch --all`, which must verify every kit without downloading.

## 3. Re-check what zxbc does

1. Install the new version **through Klive** (the Boriel BASIC dialog, or Settings › Integrations).
   The app sees the older install as outdated and offers the update; that offer is what users get.
   Then run `~/zxbasic2/zxbc --version`, which must print the new version.
2. Follow `dev/ai/boriel/README.md`, "How to re-check". Compare `--help` and the diagnostics with
   `cli-and-diagnostics.md`, and the options with `options.md`.
3. **The `.dbg` docs:** read the six pages under
   <https://zxbasic.readthedocs.io/en/v2.0/debug_format/> (the overview, `schema/`, `callables/`,
   `call_sites/`, `variables/`, `banking/`). Check whether a newer docs version than `v2.0` is listed
   at `https://readthedocs.org/api/v3/projects/zxbasic/versions/`. Compare the pages with
   `dbg-observed.md`. The docs can disagree with what zxbc writes (the "Far calls" note), so the
   fixtures in step 4 are what counts.
4. **Regenerate the fixtures:** `npm run boriel:fixtures -- ~/zxbasic2/zxbc`. Then read
   `git diff test/boriel/fixtures/`:
   - **`format` / `version` changed:** the adapter's gate (`format === "zx-source-debug" &&
     version === 1` in `dbg-adapter.ts` and `BorielCompiler.ts`) rejects the new files. Accept both
     versions. While an older zxbc can still be installed, keep a copy of the old fixtures.
   - **A new or removed key, a new enum value** (`kind`, `convention`, `scope`, ...): decide whether
     the adapter uses it, and record it in `dbg-observed.md`.
   - **A quirk is gone** (`dbg-observed.md`, "What the adapter must correct"): **keep the adapter's
     correction.** Make it a no-op on the new output, because users may point Klive at an older zxbc.
     Mark the quirk fixed in `dbg-observed.md` and the matching `boriel-issues.md` item.
   - Statement, label and size changes elsewhere are expected. Check that the tests still hold.
   Every adapter change gets a unit test on the new fixture.

## 4. Verify

1. `npm test`, `npm run test:e2e` (the Boriel core tests run in `e2e-kbasic`), `npm run build:check`
   and `npm run lint:renderer`.
2. `npx electron-vite build --config build/electron.vite.config.ts`, then
   `node scripts/boriel-ide-check.cjs` with **every** part passing, including `templates` and `next`
   (these need a NextZXOS card image).

## 5. Update the records

Search for the old version (`grep -rn "<old version>" .ai vendor test/boriel docs/content src`),
leaving out the fixtures' generated files. Then update:

- `dev/ai/boriel/kit.md`: the heading, the hash table and the layout counts;
- `dev/ai/boriel/README.md`: a new row in "Version history" saying what the re-check found, and the
  pinned version under "Rules that apply to everything here";
- every other version-specific sentence in `dev/ai/boriel/*.md`;
- `dev/vendor/boriel-basic/README.md` (the licence line) and `test/boriel/fixtures/README.md`;
- `docs/content/en/guides/languages/boriel-basic.mdx`, which names the bundled version. Then run
  `npm run doc:build && npm run doc:check`. Leave `whats-new.mdx`'s old entries alone: the release
  writes it from the changesets.

Version literals in `src` comments and in tests (for example `"2.0.0-beta25"` in
`boriel-install-service.test.ts`) are examples and test data, not the pin. Leave them.

## 6. Changeset and commit

- A `feature` changeset, in the voice of the last one:
  `npm run change -- --type feature --text "**Boriel BASIC <version>:** Klive now comes with Boriel's \`zxbc\` <version> instead of <old>, and offers to update an older version you have installed."`
  Add a sentence for anything users notice (a fixed debugger quirk, a new option).
- Commit only when the developer asks, and only after the author has confirmed the licence.
