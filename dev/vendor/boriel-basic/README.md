# Boriel BASIC setup kits

Klive bundles Boriel BASIC (the `zxbc` compiler, 2.x) with its installers and offers to install it
on first run. This folder is where the setup kits live in the source tree. How the integration
uses them is `dev/ai/boriel/integration.md`; the observed facts about the kits are in
`dev/ai/boriel/kit.md`.

| Path | Tracked | What it is |
| --- | --- | --- |
| `kit.json` | yes | The pinned version, the download URL base, and each platform's kit: file name, size, SHA-256. Keys are Node's `process.platform`-`process.arch`. |
| `kits/` | **no** (git-ignored) | The kit archives under Boriel's own file names. Fetched from `urlBase` + `file` and checked against `kit.json`, or copied in by hand. |
| `stage/` | **no** (git-ignored) | The one kit a package build includes, staged there by the packaging step (`npm run package:*`). |

## Getting the kits

After a fresh clone `kits/` is empty, and that is expected. `npm run package:*` and `npm run dev`
fetch what they need through `dev/scripts/boriel-kit.cjs`, from `urlBase` (then the listed `mirrors`),
and verify each SHA-256; `node dev/scripts/boriel-kit.cjs fetch --all` fetches all seven. By hand,
download each `file` named in `kit.json` from `urlBase` into `kits/` and check it with
`shasum -a 256 kits/*`. Do not unpack
them here. Do not run anything from an archive extracted with `tar` or Finder on macOS without
first removing `com.apple.quarantine` (`dev/ai/boriel/kit.md`, "The macOS first-launch trap").

## Licence

Version `2.0.0-beta29` is redistributed with Boriel's written permission (B-L1, `dev/ai/boriel/integration.md`). The kits
contain no LICENSE file. A production version needs its licence text shipped with Klive and an
entry in `THIRD_PARTY_NOTICES.md`.

## Changing the version

Follow `dev/ai/boriel/updating.md`, the action list for a version bump: the licence question, the
double download and layout check, `kit.json`, the re-checks, the fixtures, the tests and the records.
