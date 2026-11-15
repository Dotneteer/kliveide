# The Boriel BASIC 2.0.0 setup kits

## Downloads and hashes

The kits are public: `https://files.boriel-basic.net/v2/<file>`. The URL is recorded in each file's
`kMDItemWhereFroms`. Boriel publishes no checksums. The beta25 sizes served on 2026-10-17 equalled
the copies Boriel sent; the beta29 kits were downloaded twice on 2026-10-24, and the 2.0.0 kits on 2026-11-15, and both
copies hashed the same. CI fetches by pinned URL and verifies the SHA-256, so the archives need not be committed.

In the source tree the kits live in **`dev/vendor/boriel-basic/`**. `kit.json` there is the
authoritative copy of the table below (keys are `process.platform`-`process.arch`), and the
archives sit in the git-ignored `kits/` (see that folder's `README.md`).

| File | Bytes | SHA-256 | Klive installer |
| --- | --- | --- | --- |
| `boriel-basic-v2.0.0_arm64-macos.tar.gz` | 3065176 | `55152c5d41656643c1d1ad1de12ea05601fa44aa362702b7a5f43c94dc65e374` | mac arm64 |
| `boriel-basic-v2.0.0_x86_64-macos.tar.gz` | 3327346 | `1360dbbdc5b5f1aac4437e8315f9f0b3064950e4bdc07cc3d5b1fb79a8595598` | mac x64 |
| `boriel-basic-v2.0.0_x86_64-linux.tar.gz` | 3409701 | `fabe3b8e97f2355a0ad77c0f0457d5dd2a78d4a502d8bda18a991154876c9579` | linux x64 |
| `boriel-basic-v2.0.0_arm64-linux.tar.gz` | 3289681 | `0fa5b80bbd8f0625b79fda732032736ab6bf85957bf5d8c6e8c9bba98fcd131a` | linux arm64 |
| `boriel-basic-v2.0.0_x86_64-win.zip` | 13706885 | `e474b96d286fe34bd1cb908d06f955eb529bd0cb574acade3ebacb15a6e94d45` | win x64 |
| `boriel-basic-v2.0.0_arm64-win.zip` | 13105025 | `69cd0ed6ec4f430608c0b72aab6c14f4fbde5857f345a6305a0b6a726c7b6cba` | none (no win arm64 build) |
| `boriel-basic-v2.0.0_armv6-linux.tar.gz` | 3662929 | `5ed26f02d857a3c17ec20ccd9d03092b5272ac858fa5b7b957ced9ea2a3c2263` | none (no armv7l build) |

## Layout

- One top-level folder, `boriel-basic-v<version>_<arch>-<os>/`. Strip it on extraction.
- 754 files (Windows: 763; beta25 had 750 and 759), no symlinks, longest path 88 characters (95
  in the betas, whose folder name is longer). Tarballs use the GNU
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
- `lib/` (runtime and stdlib, the data zxbc links in) is **identical in all seven kits**. In 2.0.0
  `lib/` and `arch/` are byte-identical to beta29's; only the executables changed. `arch/`
  differs only in the tool executables' names.
- **Windows `.pdb` files are 34.5 MB of the 46 MB unpacked, and nothing loads them**, so the
  installer leaves them out. Checked without running anything (2026-11-04, beta29, both Windows
  kits): each of the nine executables imports only `KERNEL32.dll` and `ntdll.dll`, has no CodeView
  (`RSDS`) record naming a `.pdb`, and contains no `LoadLibrary` or `dbghelp`.
  `test/main/boriel-install-service.test.ts` ("Boriel BASIC Windows kits") re-checks this on every
  kit version when the kits are fetched.
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
