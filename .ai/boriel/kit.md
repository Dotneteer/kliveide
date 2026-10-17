# The Boriel BASIC 2.0.0-beta25 setup kits

## Downloads and hashes

The kits are public: `https://files.boriel-basic.net/v2/<file>`. The URL is recorded in each file's
`kMDItemWhereFroms`. The sizes served on 2026-10-17 equal the copies in `_input/zxbasic-setup/`,
so CI can fetch by pinned URL and verify the SHA-256; the archives need not be committed.

| File | Bytes | SHA-256 | Klive installer |
| --- | --- | --- | --- |
| `boriel-basic-v2.0.0-beta25_arm64-macos.tar.gz` | 3069013 | `41c225e078b0811a36b043ab4afa8f66be0156d865fef243c40c1397407e523f` | mac arm64 |
| `boriel-basic-v2.0.0-beta25_x86_64-macos.tar.gz` | 3374038 | `528b6c18ec25478203bbdc4df9905979c3d608d081f0252c2ab3d2aa5a450465` | mac x64 |
| `boriel-basic-v2.0.0-beta25_x86_64-linux.tar.gz` | 3391237 | `07914d463118917e3e45fe188f70646073f236711b9e06cc157a278252331546` | linux x64 |
| `boriel-basic-v2.0.0-beta25_arm64-linux.tar.gz` | 3241916 | `e7f8b2f965017de6b25c481b3fa28bb4f775134590ba240c44317194be19f4eb` | linux arm64 |
| `boriel-basic-v2.0.0-beta25_x86_64-win.zip` | 13697031 | `ee797b323f778c29a238b3225fc74be8146c44cb1cdf4702410547da6c5a321d` | win x64 |
| `boriel-basic-v2.0.0-beta25_arm64-win.zip` | 13046014 | `5c99a4de4abc84b8a56d076e7554d1da376717a5ce6d0213f100a0735c0092ae` | none (no win arm64 build) |
| `boriel-basic-v2.0.0-beta25_armv6-linux.tar.gz` | 3696098 | `897273b25199a0b7907cdc59e6b14503333a0cb316585433b767b3705112fc9b` | none (no armv7l build) |

## Layout

- One top-level folder, `boriel-basic-v2.0.0-beta25_<arch>-<os>/`. Strip it on extraction.
- 750 files (Windows: 759), no symlinks, longest path 95 characters. Tarballs use the GNU
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
