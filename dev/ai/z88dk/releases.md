# z88dk GitHub releases

Source: `https://api.github.com/repos/z88dk/z88dk/releases` (queried 2026-10-18).

| Tag | Published | macOS asset | Windows asset | Source |
|---|---|---|---|---|
| v2.4 | 2025-10-02 | `z88dk-osx-2.4.zip` 71 934 026 B | `z88dk-win32-2.4.zip` 117 797 132 B | `z88dk-src-2.4.tgz` |
| v2.3 | 2023-12-20 | `z88dk-osx-2.3.zip` 63 894 084 B | `z88dk-win32-2.3.zip` 106 298 674 B | `z88dk-src-2.3.tgz` |
| v2.2, v2.1, v2.0 | 2020–2022 | `z88dk-osx-<v>.zip` | `z88dk-win32-<v>.zip` | `z88dk-src-<v>.tgz` |
| v1.99c | 2019-01-19 | `z88dk-osx-1.99C.zip` (capital C) | `z88dk-win32-1.99C.zip` | `z88dk-src-1.99C.tgz` |

- **No Linux binary is published.** Linux users install a distro or snap package, or build from the
  source tarball, then use *Local installation*.
- **Digests:** GitHub reports `digest: "sha256:<hex>"` for the v2.4 assets only (older assets: `null`).
  Klive checks the digest when present and the size always. v2.4 macOS:
  `sha256:96af39ddb264a1158846c176c2ca3cc0f34b8b29b8233dd554229f11d8650d07` (verified on download).
- None of the releases is a pre-release. The asset names classify by the `osx` / `win32` / `src`
  word; `win32` is the only Windows build (it runs on x64 and arm64 Windows).
- **Layout:** both binary zips hold one top-level `z88dk/` folder (checked: the macOS zip by
  extracting it, the Windows zip by reading its central directory). Klive strips it (`stripComponents: 1`).
- The Windows zip's `bin/` holds `zcc.exe`, `z88dk-*.exe`, `zsdcc.exe`, `z80asm.exe`, `m4.exe` and the
  MinGW DLLs they need, plus two Perl scripts without an extension (`z88dk-asmpp`, `z88dk-asmstyle`).
- Download sizes are 72–118 MB; the macOS zip expands to ~410 MB. The installer extracts into a temp
  folder beside the destination and renames it into place, so a cancelled or failed install leaves
  nothing behind.
