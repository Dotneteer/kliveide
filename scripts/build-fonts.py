#!/usr/bin/env python3
"""
Regenerates the bundled Klive UI fonts in src/renderer/assets/fonts.

The committed .woff2 files are produced by this script; you only need to re-run it
when upgrading the upstream font packages or changing the glyph coverage below.

    python3 -m venv .fontenv && ./.fontenv/bin/pip install fonttools brotli
    npm install                       # provides the @fontsource sources
    ./.fontenv/bin/python scripts/build-fonts.py

Sources (all SIL Open Font License 1.1):
  Iosevka             - node_modules/@fontsource/iosevka
  Inter (variable)    - node_modules/@fontsource-variable/inter
  Inconsolata     (v) - node_modules/@fontsource-variable/inconsolata
  Noto Sans Mono  (v) - node_modules/@fontsource-variable/noto-sans-mono
  JetBrains Mono  (v) - node_modules/@fontsource-variable/jetbrains-mono
  Fira Code       (v) - node_modules/@fontsource-variable/fira-code

ZX-Spectrum is the odd one out: it is vendored (src/renderer/assets/fonts/zxspectrum.woff2,
committed, no upstream package) and carries its own licence, so this script never rebuilds it. It
only repairs it in place - see fix_zxspectrum() - which is idempotent and safe to re-run.

The four editor fonts above are shipped as Fontsource's variable builds, which cover the whole
weight range in a single file. Their `latin` file is copied verbatim (already small); their
`latin-ext` file is subset to Latin Extended-A/B, because Noto's in particular is 287 KB of
coverage Klive will never render. Both halves are declared with a unicode-range in fonts.css, so
accented text keeps the *same* font rather than falling through to the next family in the stack -
which would break column alignment, the whole point of a monospace editor.

Iosevka notes:
  * Upstream ships ~30k glyphs / ~1 MB per weight. We subset to the ranges Klive
    actually renders (Latin + Latin Ext-A, punctuation, arrows, math, box drawing,
    block elements, geometric shapes), which lands around 55 KB per weight.
  * Iosevka's default zero is a plain oval, which is hard to tell from "O" in hex
    dumps. We permanently remap U+0030 onto the slashed-zero alternate so the
    slash survives regardless of CSS font-feature-settings (Monaco does not always
    forward them). Change ZERO_VARIANT below to pick a different shape:
        None  -> plain oval        cv76-2/-3/-9/-10 -> slashed
        cv76-5/-12 -> thin slash   cv76-4/-11/-13/-14 -> dotted
"""

import shutil
import subprocess
import sys
from pathlib import Path

from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
DEST = ROOT / "src/renderer/assets/fonts"
IOSEVKA_SRC = ROOT / "node_modules/@fontsource/iosevka/files"
INTER_SRC = ROOT / "node_modules/@fontsource-variable/inter/files"
VARIABLE_SRC = ROOT / "node_modules/@fontsource-variable"

ZERO_VARIANT = "zero.cv76-2"  # slashed zero; set to None to keep the plain oval

UNICODES = ",".join(
    [
        "U+0000-00FF",  # Basic Latin + Latin-1 Supplement
        "U+0100-017F",  # Latin Extended-A (Hungarian, Polish, Czech, ...)
        "U+0192,U+01FA-01FF,U+02B0-02FF,U+0300-036F",
        "U+2000-206F",  # General punctuation
        "U+2070-209F,U+20A0-20BF,U+2100-214F",
        "U+2190-21FF",  # Arrows
        "U+2200-22FF",  # Mathematical operators
        "U+2300-23FF",  # Miscellaneous technical
        "U+2500-257F",  # Box drawing
        "U+2580-259F",  # Block elements
        "U+25A0-25FF",  # Geometric shapes
        "U+2600-2603,U+266A-266B,U+FFFD",
    ]
)

# --- Latin Extended-A and B: enough for Hungarian, Polish, Czech, Turkish and friends.
LATIN_EXT_UNICODES = "U+0100-017F,U+0180-024F"

# --- Editor fonts offered in View | Editor Options | Font Family, beyond the bundled Iosevka.
# --- `stem` is the Fontsource file stem: "standard" carries every axis the family has (Inconsolata
# --- and Noto Sans Mono both have a width axis worth keeping), "wght" carries weight only.
VARIABLE_MONO_FACES = [
    ("inconsolata", "standard", "normal"),
    ("noto-sans-mono", "standard", "normal"),
    ("jetbrains-mono", "wght", "normal"),
    ("jetbrains-mono", "wght", "italic"),
    ("fira-code", "wght", "normal"),
]

IOSEVKA_FACES = {
    "iosevka-400.woff2": "iosevka-latin-400-normal.woff2",
    "iosevka-700.woff2": "iosevka-latin-700-normal.woff2",
    "iosevka-400-italic.woff2": "iosevka-latin-400-italic.woff2",
}

INTER_FACES = {
    "inter-latin.woff2": "inter-latin-wght-normal.woff2",
    "inter-latin-ext.woff2": "inter-latin-ext-wght-normal.woff2",
    "inter-latin-italic.woff2": "inter-latin-wght-italic.woff2",
    "inter-latin-ext-italic.woff2": "inter-latin-ext-wght-italic.woff2",
}


def bake_zero(src: Path, tmp: Path) -> Path:
    """Point U+0030 at the chosen zero alternate before subsetting."""
    font = TTFont(src)
    if ZERO_VARIANT and ZERO_VARIANT in font.getGlyphOrder():
        for table in font["cmap"].tables:
            if 0x0030 in table.cmap:
                table.cmap[0x0030] = ZERO_VARIANT
    font.save(tmp)
    font.close()
    return tmp


def subset(src: Path, dest: Path, unicodes: str = UNICODES) -> None:
    subprocess.run(
        [
            sys.executable, "-m", "fontTools.subset", str(src),
            f"--output-file={dest}",
            "--flavor=woff2",
            f"--unicodes={unicodes}",
            "--layout-features=ccmp,locl,mark,mkmk",
            "--no-hinting",
            "--desubroutinize",
        ],
        check=True,
    )


def fix_zxspectrum() -> None:
    """Normalises the vendored ZX-Spectrum face to a genuinely fixed pitch.

    The file as vendored gives `x` an advance of 2124 against the 2023 every other glyph uses,
    while its outline is byte-for-byte the same size as `w`, `o` and `m`. That is a bad metric,
    not a wide letter, and it matters because the font is now selectable for the editor and the
    monitoring panels: Monaco measures one character and positions the caret assuming every other
    matches, and the panels lay out hex dumps in `ch` columns. Either one visibly breaks on any
    line containing an x - and `ix`, `iy`, `ex`, `0x` make that nearly every line of Z80 work.

    This rewrites only advance widths, never outlines, and additionally sets the two flags that
    advertise fixed pitch (post.isFixedPitch, PANOSE bProportion) which the file also had wrong.
    Re-running it on an already-repaired file changes nothing.
    """
    from collections import Counter

    dest = DEST / "zxspectrum.woff2"
    font = TTFont(dest)
    cmap = font.getBestCmap()
    hmtx = font["hmtx"]

    # --- The intended advance is simply the one nearly every glyph already agrees on.
    target = Counter(hmtx[g][0] for g in cmap.values()).most_common(1)[0][0]
    repaired = []
    for codepoint, glyph in cmap.items():
        advance, lsb = hmtx[glyph]
        if advance != target:
            hmtx[glyph] = (target, lsb)
            repaired.append((codepoint, glyph, advance))

    already_flagged = font["post"].isFixedPitch == 1 and font["OS/2"].panose.bProportion == 9
    if not repaired and already_flagged:
        print("  zxspectrum.woff2: already fixed pitch, nothing to repair")
        return

    font["post"].isFixedPitch = 1
    font["OS/2"].panose.bProportion = 9  # --- 9 = Monospaced
    font.flavor = "woff2"
    font.save(dest)

    for codepoint, glyph, advance in repaired:
        print(f"  zxspectrum.woff2: U+{codepoint:04X} {glyph!r} advance {advance} -> {target}")
    print(f"  zxspectrum.woff2: {dest.stat().st_size // 1024} KB, fixed pitch at {target}")


def main() -> None:
    DEST.mkdir(parents=True, exist_ok=True)
    tmpdir = DEST / ".tmp"
    tmpdir.mkdir(exist_ok=True)

    for out_name, src_name in IOSEVKA_FACES.items():
        staged = bake_zero(IOSEVKA_SRC / src_name, tmpdir / src_name.replace(".woff2", ".ttf"))
        subset(staged, DEST / out_name)
        print(f"  {out_name}: {(DEST / out_name).stat().st_size // 1024} KB")

    for out_name, src_name in INTER_FACES.items():
        shutil.copyfile(INTER_SRC / src_name, DEST / out_name)
        print(f"  {out_name}: {(DEST / out_name).stat().st_size // 1024} KB")

    for pkg, stem, style in VARIABLE_MONO_FACES:
        src_dir = VARIABLE_SRC / pkg / "files"
        suffix = "" if style == "normal" else "-italic"

        latin_out = DEST / f"{pkg}{suffix}.woff2"
        shutil.copyfile(src_dir / f"{pkg}-latin-{stem}-{style}.woff2", latin_out)
        print(f"  {latin_out.name}: {latin_out.stat().st_size // 1024} KB")

        ext_out = DEST / f"{pkg}-ext{suffix}.woff2"
        subset(
            src_dir / f"{pkg}-latin-ext-{stem}-{style}.woff2",
            ext_out,
            unicodes=LATIN_EXT_UNICODES,
        )
        print(f"  {ext_out.name}: {ext_out.stat().st_size // 1024} KB")

    fix_zxspectrum()

    shutil.rmtree(tmpdir)


if __name__ == "__main__":
    main()
