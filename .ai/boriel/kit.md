# The Boriel BASIC 2.0.0-beta29 setup kits

## Downloads and hashes

The kits are public: `https://files.boriel-basic.net/v2/<file>`. The URL is recorded in each file's
`kMDItemWhereFroms`. Boriel publishes no checksums. The beta25 sizes served on 2026-10-17 equalled
the copies Boriel sent; the beta29 kits were downloaded twice on 2026-10-24 and both copies hashed
the same. CI fetches by pinned URL and verifies the SHA-256, so the archives need not be committed.

In the source tree the kits live in **`vendor/boriel-basic/`**. `kit.json` there is the
authoritative copy of the table below (keys are `process.platform`-`process.arch`), and the
archives sit in the git-ignored `kits/` (see that folder's `README.md`).

| File | Bytes | SHA-256 | Klive installer |
| --- | --- | --- | --- |
| `boriel-basic-v2.0.0-beta29_arm64-macos.tar.gz` | 3064810 | `4c940c0e9dd1aae743da6e459ff4837988dccbbb89e0455ddf9e4d4060a746b5` | mac arm64 |
| `boriel-basic-v2.0.0-beta29_x86_64-macos.tar.gz` | 3326978 | `b535260213e5389a5344f4a163d3278ef4b0d1150cb7007ec799d300318916e2` | mac x64 |
| `boriel-basic-v2.0.0-beta29_x86_64-linux.tar.gz` | 3409272 | `a9833bc9027c03b2cede88d5a304fee4356b89e40ba77946de55036b6d4c4e69` | linux x64 |
| `boriel-basic-v2.0.0-beta29_arm64-linux.tar.gz` | 3286878 | `e23484b96d654889ec7c35d8b8c3ad5bcabc58da1a99492619c8e3a21c04660e` | linux arm64 |
| `boriel-basic-v2.0.0-beta29_x86_64-win.zip` | 13718211 | `60e43ae8c7d819605b3e62c9af2c69dded636bf58b7f9791594a503b6ec512f2` | win x64 |
| `boriel-basic-v2.0.0-beta29_arm64-win.zip` | 13116287 | `90a783822388e14a0f6b8c3339fff92b949b25258fe151ce32006927707108dc` | none (no win arm64 build) |
| `boriel-basic-v2.0.0-beta29_armv6-linux.tar.gz` | 3661441 | `ab19cb0f3c242084636447083ab387bcb1636aafed98b87bca59b6945efb8f97` | none (no armv7l build) |

## Layout

- One top-level folder, `boriel-basic-v<version>_<arch>-<os>/`. Strip it on extraction.
- 754 files (Windows: 763; beta25 had 750 and 759), no symlinks, longest path 95 characters. Tarballs use the GNU
  `ustar  ` magic.
- **Nine executables:**
  - root: `zxbc`, `zxbasm`, `zxbpp`;
  - `tools/`: `zxbpack`, `nextcreator`, `modman`;
  - `arch/zx81sd/tools/`: `build_sd81`, `gen_map`, `split_sd81`.

  The tar headers carry mode `0775` for them. Klive's current tar reader drops modes, so the
  installer must apply them, or chmod this list.
- **Binaries:**
  - Linux: statically linked ELF (no libc dependency).
  - macOS: Mach-O, ad-hoc, linker-signed.
  - Windows: PE32+ console, plus `.pdb` files.
- `lib/` (runtime and stdlib, the data zxbc links in) is **identical in all seven kits**. `arch/`
  differs only in the tool executables' names.
- **Windows `.pdb` files are 34.5 MB of the 46 MB unpacked.** zxbc does not need them to run. The
  installer may skip `*.pdb` (to be confirmed on Windows that nothing loads them).
- No LICENSE file. `lib/NOTICE.md` and `lib/UNLICENSED_FILES.txt` describe the licensing (plan
  B-L1).
- zxbc also searches `~/.local/share/boriel_basic/modules` for `USE` modules (managed by `modman`).

## The macOS first-launch trap

If a binary still carries `com.apple.quarantine` when it is **first** executed, the process blocks:
macOS waits for a Gatekeeper decision that a headless child process can never answer. It was still
blocked after 100 s. Removing the attribute **afterwards does not help**: that file stays blocked,
though a fresh copy of it runs. Stripping the attribute before the first launch makes it start
at once.

- `tar` and Finder propagate the downloaded archive's quarantine to the extracted files. Klive's
  own extractor writes new files and adds none.
- **Installer rule:** never execute anything from the install folder before checking that no file
  carries `com.apple.quarantine`. Strip it with `xattr -dr com.apple.quarantine <folder>` first.
- The version probe must have a timeout and **kill** the process, so a blocked launch becomes a
  clear "macOS blocked zxbc" error instead of a hung IDE.
- The ad-hoc signature is enough on Apple Silicon. `com.apple.provenance` is harmless.

## Platform choice

`process.platform` + `process.arch` → kit:

| Klive (`platform`/`arch`) | Kit |
| --- | --- |
| `darwin`/`arm64` | `arm64-macos` |
| `darwin`/`x64` | `x86_64-macos` |
| `linux`/`x64` | `x86_64-linux` |
| `linux`/`arm64` | `arm64-linux` |
| `linux`/`arm` | `armv6-linux` |
| `win32`/`x64` | `x86_64-win` |
| `win32`/`arm64` | `arm64-win` |

An x64 Klive on Apple Silicon or Windows on ARM runs emulated and gets the x64 kit, which runs
under the same emulation. The macOS x64 kit was verified under Rosetta.
