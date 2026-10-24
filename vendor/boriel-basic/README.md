# Boriel BASIC setup kits

Klive bundles Boriel BASIC (the `zxbc` compiler, 2.x) with its installers and offers to install it
on first run. This folder is where the setup kits live in the source tree. The plan is
`.plans/BORIEL_BASIC_INTEGRATION_PLAN.md`; the observed facts about the kits are in
`.ai/boriel/kit.md`.

| Path | Tracked | What it is |
| --- | --- | --- |
| `kit.json` | yes | The pinned version, the download URL base, and each platform's kit: file name, size, SHA-256. Keys are Node's `process.platform`-`process.arch`. |
| `kits/` | **no** (git-ignored) | The kit archives under Boriel's own file names. Fetched from `urlBase` + `file` and checked against `kit.json`, or copied in by hand. |
| `stage/` | **no** (git-ignored) | The one kit a package build includes, staged there by the packaging step (plan §3.1). |

## Getting the kits

After a fresh clone `kits/` is empty, and that is expected. Once Phase B1's
`scripts/boriel-kit.cjs` exists, `npm run package:*` and `npm run dev` fetch what they need from
`urlBase` (then the listed `mirrors`) and verify each SHA-256 (plan §3.1). Until then, download
each `file` named in `kit.json` from `urlBase` into `kits/` and check it with
`shasum -a 256 kits/*`. Do not unpack
them here. Do not run anything from an archive extracted with `tar` or Finder on macOS without
first removing `com.apple.quarantine` (`.ai/boriel/kit.md`, "The macOS first-launch trap").

## Licence

Version `2.0.0-beta29` is redistributed with Boriel's written permission (plan §0.3, B-L1). The kits
contain no LICENSE file. A production version needs its licence text shipped with Klive and an
entry in `THIRD_PARTY_NOTICES.md`.

## Changing the version

1. Update `kit.json`: `version`, every `file`, `size` and `sha256`.
2. Replace the archives in `kits/`.
3. Re-run the Phase B0 checks (`.ai/boriel/README.md`, "How to re-check").
4. Regenerate the test fixtures.
